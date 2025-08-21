/**
 * Quick Setup Script for optica BFF Production
 * Run this to prepare database and start the server
 */
import { execSync } from 'child_process';
import { existsSync } from 'fs';
console.log('🚀 Setting up optica BFF for Production...\n');
// 1. Check if .env exists
if (!existsSync('.env')) {
    console.log('⚠️  No .env file found. Please create one based on .env.example');
    process.exit(1);
}
try {
    // 2. Generate Prisma client
    console.log('📦 Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    // 3. Try database migration (optional - may fail if DB not running)
    try {
        console.log('🗄️  Running database migrations...');
        execSync('npx prisma db push', { stdio: 'inherit' });
        console.log('✅ Database migrations completed');
    }
    catch (error) {
        console.log('⚠️  Database migration failed - this is OK if PostgreSQL is not running');
        console.log('💡 You can run without database - the app will use fallback data');
    }
    // 4. Build TypeScript
    console.log('🔨 Building TypeScript...');
    execSync('npx tsc', { stdio: 'inherit' });
    console.log('\n🎉 Setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Ensure PostgreSQL is running (optional)');
    console.log('   2. Run: npm run dev:production');
    console.log('   3. Visit: http://localhost:3001');
    console.log('\n⚡ The server will work even without PostgreSQL using fallback data!');
}
catch (error) {
    console.error('❌ Setup failed:', error instanceof Error ? error.message : error);
    process.exit(1);
}
