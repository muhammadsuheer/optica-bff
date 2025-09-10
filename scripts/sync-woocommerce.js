#!/usr/bin/env node
/**
 * One-time WooCommerce to Supabase sync script
 * Run this to populate your Supabase database with WordPress products
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const WP_BASE_URL = process.env.WP_BASE_URL
const WC_CONSUMER_KEY = process.env.WC_CONSUMER_KEY
const WC_CONSUMER_SECRET = process.env.WC_CONSUMER_SECRET

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !WP_BASE_URL || !WC_CONSUMER_KEY || !WC_CONSUMER_SECRET) {
  console.error('❌ Missing required environment variables')
  process.exit(1)
}

// Initialize Supabase client with service role
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// WooCommerce API credentials
const auth = Buffer.from(`${WC_CONSUMER_KEY}:${WC_CONSUMER_SECRET}`).toString('base64')

async function fetchWooCommerceProducts(page = 1, perPage = 100) {
  const url = `${WP_BASE_URL}/wp-json/wc/v3/products?page=${page}&per_page=${perPage}`
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`WooCommerce API error: ${response.status} ${response.statusText}`)
    }

    const products = await response.json()
    return products
  } catch (error) {
    console.error(`❌ Error fetching page ${page}:`, error.message)
    return []
  }
}

async function syncProducts() {
  console.log('🚀 Starting WooCommerce to Supabase sync...')
  
  let page = 1
  let totalSynced = 0
  let totalFailed = 0
  
  while (true) {
    console.log(`📦 Fetching page ${page}...`)
    const products = await fetchWooCommerceProducts(page, 100)
    
    if (products.length === 0) {
      console.log('✅ No more products to sync')
      break
    }
    
    console.log(`📥 Found ${products.length} products on page ${page}`)
    
    // Transform WooCommerce products to Supabase format
    const transformedProducts = products.map(product => ({
      wc_id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description || null,
      short_description: product.short_description || null,
      price: parseFloat(product.price) || 0,
      regular_price: parseFloat(product.regular_price) || 0,
      sale_price: product.sale_price ? parseFloat(product.sale_price) : null,
      status: product.status,
      featured: product.featured || false,
      stock_quantity: product.stock_quantity || null,
      stock_status: product.stock_status || 'instock',
      manage_stock: product.manage_stock || false,
      categories: product.categories || [],
      tags: product.tags || [],
      images: product.images || [],
      attributes: product.attributes || {},
      variations: product.variations || [],
      meta_data: product.meta_data || {},
      created_at: product.date_created || new Date().toISOString(),
      updated_at: product.date_modified || new Date().toISOString(),
      synced_at: new Date().toISOString()
    }))
    
    // Upsert to Supabase
    try {
      const { data, error } = await supabase
        .from('products')
        .upsert(transformedProducts, { 
          onConflict: 'wc_id',
          ignoreDuplicates: false 
        })
        .select()
      
      if (error) {
        console.error(`❌ Supabase error on page ${page}:`, error.message)
        totalFailed += products.length
      } else {
        console.log(`✅ Synced ${transformedProducts.length} products from page ${page}`)
        totalSynced += transformedProducts.length
      }
    } catch (error) {
      console.error(`❌ Error upserting page ${page}:`, error.message)
      totalFailed += products.length
    }
    
    page++
    
    // Safety break to prevent infinite loops
    if (page > 100) {
      console.log('⚠️  Reached page limit (100), stopping sync')
      break
    }
  }
  
  console.log('\n🎉 Sync completed!')
  console.log(`✅ Total synced: ${totalSynced}`)
  console.log(`❌ Total failed: ${totalFailed}`)
}

// Run the sync
syncProducts().catch(console.error)
