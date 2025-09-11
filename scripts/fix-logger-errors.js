#!/usr/bin/env node

/**
 * Automated Logger Error Fix Script
 * 
 * Fixes all logger.error() calls to use correct signature:
 * FROM: logger.error('message', { data })  
 * TO:   logger.error('message', undefined, { data })
 * OR:   logger.error('message', error instanceof Error ? error : new Error('Unknown error'))
 */

import fs from 'fs'
import path from 'path'
import { glob } from 'glob'

function fixLoggerErrors(content) {
  let modified = false
  let newContent = content

  // Fix pattern: logger.error('message', { key: value, error }) -> proper signature
  const errorWithDataPattern = /logger\.error\(\s*'([^']+)',\s*\{([^}]*error[^}]*)\}\s*\)/g
  newContent = newContent.replace(errorWithDataPattern, (match, message, dataContent) => {
    modified = true
    // If the data object contains 'error', extract it
    if (dataContent.includes('error:') || dataContent.includes('error ')) {
      // Extract other properties (remove error-related ones)
      const cleanData = dataContent
        .replace(/,?\s*error:[^,}]*/g, '')
        .replace(/,?\s*error\s*[^,}]*/g, '')
        .trim()
        .replace(/^,|,$/g, '') // Remove leading/trailing commas
      
      if (cleanData) {
        return `logger.error('${message}', error instanceof Error ? error : new Error('Unknown error'), {${cleanData}})`
      } else {
        return `logger.error('${message}', error instanceof Error ? error : new Error('Unknown error'))`
      }
    } else {
      // No error in data, just move data to third parameter
      return `logger.error('${message}', undefined, {${dataContent}})`
    }
  })

  // Fix pattern: logger.error('message', { error }) -> logger.error('message', error)  
  const simpleErrorPattern = /logger\.error\(\s*'([^']+)',\s*\{\s*error\s*\}\s*\)/g
  newContent = newContent.replace(simpleErrorPattern, (match, message) => {
    modified = true
    return `logger.error('${message}', error instanceof Error ? error : new Error('Unknown error'))`
  })

  return { content: newContent, modified }
}

function fixFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const result = fixLoggerErrors(content)
    
    if (result.modified) {
      fs.writeFileSync(filePath, result.content, 'utf8')
      console.log(`✅ Fixed: ${filePath}`)
      return true
    }
    
    return false
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message)
    return false
  }
}

async function main() {
  console.log('🔧 Starting automated logger error fixes...\n')
  
  try {
    // Find all TypeScript files
    const files = await glob('src/**/*.ts', { 
      ignore: ['src/**/*.d.ts', 'src/**/*.test.ts'] 
    })
    
    let fixedCount = 0
    let totalFiles = files.length
    
    files.forEach(file => {
      if (fixFile(file)) {
        fixedCount++
      }
    })
    
    console.log(`\n🎉 Complete!`)
    console.log(`📊 Fixed ${fixedCount} out of ${totalFiles} files`)
    console.log(`\nRun 'npm run build' to check remaining errors.`)
  } catch (error) {
    console.error('❌ Script failed:', error.message)
    process.exit(1)
  }
}

main()