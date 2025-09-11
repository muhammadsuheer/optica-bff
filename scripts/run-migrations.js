/**
 * Migration Runner Script
 * This script helps you run migrations in the correct order
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Optia BFF Migration Runner');
console.log('================================\n');

// Read migration files
const migrationsDir = path.join(__dirname, '..', 'migrations');

console.log('📋 Migration files found:');
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
files.forEach((file, index) => {
  console.log(`   ${index + 1}. ${file}`);
});

console.log('\n📝 Instructions:');
console.log('1. Go to your Supabase Dashboard → SQL Editor');
console.log('2. Run the following SQL files in this exact order:\n');

// Display migration order
const migrationOrder = [
  'supabase-schema.sql',
  '000_create_migrations_table.sql', 
  '001_performance_indexes.sql'
];

migrationOrder.forEach((file, index) => {
  const filePath = path.join(migrationsDir, file);
  if (fs.existsSync(filePath)) {
    console.log(`Step ${index + 1}: ${file}`);
    console.log('   Copy the content below and paste in Supabase SQL Editor:');
    console.log('   ' + '='.repeat(50));
    
    const content = fs.readFileSync(filePath, 'utf8');
    console.log(content);
    console.log('   ' + '='.repeat(50));
    console.log('   Click "RUN" in Supabase\n');
  } else {
    console.log(`❌ Missing: ${file}`);
  }
});

console.log('✅ After running all migrations:');
console.log('   - Check your Supabase tables are created');
console.log('   - Verify indexes are created');
console.log('   - Test your API endpoints');
console.log('\n🎉 Ready to deploy!');
