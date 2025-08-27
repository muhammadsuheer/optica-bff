#!/bin/bash
set -euo pipefail

echo "🔄 Database Migration Script - $(date)"

# Function to wait for database
wait_for_database() {
    echo "⏳ Waiting for PostgreSQL to be ready..."
    
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        echo "📡 Connection attempt $attempt/$max_attempts..."
        
        if node -e "
            const { PrismaClient } = require('@prisma/client');
            const prisma = new PrismaClient();
            prisma.\$connect()
                .then(() => {
                    console.log('✅ Database connected');
                    return prisma.\$disconnect();
                })
                .then(() => process.exit(0))
                .catch((e) => {
                    console.error('❌ Database error:', e.message);
                    process.exit(1);
                });
        " 2>/dev/null; then
            echo "✅ PostgreSQL is ready!"
            return 0
        fi
        
        echo "❌ PostgreSQL unavailable - attempt $attempt/$max_attempts (sleeping 3s)"
        sleep 3
        ((attempt++))
    done
    
    echo "💥 Failed to connect to PostgreSQL after $max_attempts attempts"
    echo "🔍 DATABASE_URL: ${DATABASE_URL:0:30}..."
    exit 1
}

# Function to run migrations
run_migrations() {
    echo "🔄 Running database migrations..."
    
    if npx prisma migrate deploy; then
        echo "✅ Migrations completed successfully!"
    else
        echo "❌ Migration failed"
        exit 1
    fi
}

# Main execution
main() {
    echo "🏁 Starting database migration process..."
    
    # Wait for database
    wait_for_database
    
    # Run migrations
    run_migrations
    
    echo "✅ Database migration completed!"
}

# Error handling
trap 'echo "❌ Migration failed at line $LINENO"; exit 1' ERR

# Execute main function
main "$@"
