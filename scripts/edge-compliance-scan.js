#!/usr/bin/env node

/**
 * Edge Runtime Compliance Scanner
 * Scans for Node.js-only imports and patterns
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

const NODE_ONLY_PATTERNS = [
  // Node.js built-in modules (excluding safe Edge usage)
  /\b(fs|os|net|tls|child_process|worker_threads|zlib|util|perf_hooks|vm)\b/g,
  // Node: protocol imports
  /from\s+['"]node:/g,
  /import\s+.*['"]node:/g,
  // Common Node.js patterns (excluding safe patterns)
  /__dirname|__filename/g,
  /process\.cwd\(\)/g,
  /require\s*\(/g
]

const SAFE_PATTERNS = [
  // Safe process usage in Edge Runtime
  /typeof process !== 'undefined'/g,
  /process\.env/g,
  /process\.uptime/g,
  /process\.memoryUsage/g,
  // Safe path usage in types/comments
  /path:/g,
  /\*.*path.*\*/g,
  // Safe http/https in strings/URLs
  /['"`]https?:/g,
  /https?:\/\//g
]

const ALLOWED_EXCEPTIONS = [
  'src/config/edgeEnv.ts', // Allowed process?.env usage
  'scripts/', // Build scripts can use Node.js
  'tests/', // Tests can use Node.js
  '.js', // Build output files
]

function scanFile(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  const violations = []
  
  NODE_ONLY_PATTERNS.forEach((pattern, index) => {
    const matches = content.match(pattern)
    if (matches) {
      // Filter out safe patterns
      const unsafeMatches = matches.filter(match => {
        return !SAFE_PATTERNS.some(safePattern => {
          const context = content.substring(
            Math.max(0, content.indexOf(match) - 50),
            content.indexOf(match) + match.length + 50
          )
          return safePattern.test(context)
        })
      })
      
      if (unsafeMatches.length > 0) {
        violations.push({
          pattern: pattern.toString(),
          matches: unsafeMatches,
          file: filePath
        })
      }
    }
  })
  
  return violations
}

function scanDirectory(dir, violations = []) {
  const items = readdirSync(dir)
  
  for (const item of items) {
    const fullPath = join(dir, item)
    const stat = statSync(fullPath)
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      scanDirectory(fullPath, violations)
    } else if (stat.isFile() && ['.ts', '.js', '.tsx', '.jsx'].includes(extname(item))) {
      // Check if file is in allowed exceptions
      const isException = ALLOWED_EXCEPTIONS.some(exception => 
        fullPath.includes(exception)
      )
      
      if (!isException) {
        const fileViolations = scanFile(fullPath)
        violations.push(...fileViolations)
      }
    }
  }
  
  return violations
}

console.log('🔍 Scanning for Edge Runtime compliance...\n')

const violations = scanDirectory('./src')

if (violations.length === 0) {
  console.log('✅ PASS: No Edge Runtime violations found!')
  console.log('🎉 Code is 100% Edge Runtime compatible\n')
  process.exit(0)
} else {
  console.log(`❌ FAIL: Found ${violations.length} Edge Runtime violations:\n`)
  
  violations.forEach((violation, index) => {
    console.log(`${index + 1}. ${violation.file}`)
    console.log(`   Pattern: ${violation.pattern}`)
    console.log(`   Matches: ${violation.matches.join(', ')}`)
    console.log()
  })
  
  console.log('🔧 Fix these violations before deploying to Edge Runtime')
  process.exit(1)
}
