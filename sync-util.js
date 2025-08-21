#!/usr/bin/env node

/**
 * Simple Sync Utility - Replaces the deleted scripts folder functionality
 * Usage: node sync-util.js [command] [options]
 * 
 * Commands:
 *   status     - Get sync status
 *   initial    - Run initial sync
 *   products   - Sync products only
 *   categories - Sync categories only
 *   orders     - Sync orders only
 *   customers  - Sync customers only
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function makeRequest(endpoint, method = 'GET', body = null) {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : null,
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error(`❌ Error: ${data.message || 'Request failed'}`);
      process.exit(1);
    }

    return data;
  } catch (error) {
    console.error(`❌ Network error: ${error.message}`);
    console.error('Make sure the server is running on', BASE_URL);
    process.exit(1);
  }
}

async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  // Parse options
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (args[i].startsWith('--')) {
      const key = args[i].replace('--', '');
      const value = args[i + 1];
      options[key] = isNaN(value) ? value : Number(value);
    }
  }

  console.log(`🚀 Running sync command: ${command}`);
  console.log(`📡 Server: ${BASE_URL}`);

  switch (command) {
    case 'status':
      const status = await makeRequest('/sync/status');
      console.log('📊 Sync Status:', JSON.stringify(status, null, 2));
      break;

    case 'initial':
      console.log('🔄 Starting initial sync...');
      const initialResult = await makeRequest('/sync/initial', 'POST', options);
      console.log('✅ Initial sync started:', initialResult.message);
      break;

    case 'products':
      console.log('🛍️ Syncing products...');
      const productsResult = await makeRequest('/sync/products', 'POST', options);
      console.log('✅ Products sync completed:', productsResult.message);
      break;

    case 'categories':
      console.log('📂 Syncing categories...');
      const categoriesResult = await makeRequest('/sync/categories', 'POST', options);
      console.log('✅ Categories sync completed:', categoriesResult.message);
      break;

    case 'orders':
      console.log('📦 Syncing orders...');
      const ordersResult = await makeRequest('/sync/orders', 'POST', options);
      console.log('✅ Orders sync completed:', ordersResult.message);
      break;

    case 'customers':
      console.log('👥 Syncing customers...');
      const customersResult = await makeRequest('/sync/customers', 'POST', options);
      console.log('✅ Customers sync completed:', customersResult.message);
      break;

    default:
      console.log(`
🔧 Sync Utility Usage:

Commands:
  node sync-util.js status                    - Get sync status
  node sync-util.js initial [options]         - Run initial sync
  node sync-util.js products [options]        - Sync products only
  node sync-util.js categories [options]      - Sync categories only
  node sync-util.js orders [options]          - Sync orders only
  node sync-util.js customers [options]       - Sync customers only

Options:
  --batchSize 50                              - Set batch size
  --parallelBatches 3                         - Set parallel batches
  --force true                                - Force sync (ignore checkpoints)
  --includeCustomFields false                 - Exclude custom fields

Examples:
  node sync-util.js initial --batchSize 100
  node sync-util.js products --force true
  node sync-util.js orders --since 2024-01-01

Note: Make sure your server is running on ${BASE_URL}
      `);
      break;
  }
}

main().catch(console.error);
