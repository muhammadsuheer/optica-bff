#!/bin/bash
set -e

echo "🚀 Starting Optia BFF Production Deployment..."

# Function to check if database is ready
wait_for_db() {
    echo "⏳ Waiting for PostgreSQL to be ready..."
    
    # Extract connection details from DATABASE_URL for debugging
    echo "🔍 Testing database connection..."
    
    # Use a simple Prisma command that works with connection strings
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        echo "📡 Connection attempt $attempt/$max_attempts..."
        
        # Try to connect using Prisma's introspection (works with any valid connection)
        if npx prisma db pull --print 2>/dev/null | head -1 >/dev/null 2>&1; then
            echo "✅ PostgreSQL is ready!"
            return 0
        fi
        
        # If that fails, try a simpler approach
        if node -e "
            const { PrismaClient } = require('@prisma/client');
            const prisma = new PrismaClient();
            prisma.\$queryRaw\`SELECT 1\`.then(() => {
                console.log('DB Connected');
                process.exit(0);
            }).catch((e) => {
                console.error('DB Error:', e.message);
                process.exit(1);
            });
        " 2>/dev/null; then
            echo "✅ PostgreSQL is ready!"
            return 0
        fi
        
        echo "❌ PostgreSQL is unavailable - attempt $attempt/$max_attempts (sleeping 3s)"
        sleep 3
        attempt=$((attempt + 1))
    done
    
    echo "💥 Failed to connect to PostgreSQL after $max_attempts attempts"
    echo "🔍 DATABASE_URL format: ${DATABASE_URL:0:20}..." 
    echo "📝 Please check your DATABASE_URL connection string"
    exit 1
}

# Function to run migrations safely
run_migrations() {
    echo "🔄 Running database migrations..."
    
    # Check if database is completely empty (first deployment)
    if npx prisma db execute --stdin <<< "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | grep -q "0"; then
        echo "📦 Empty database detected - running initial migration..."
        npx prisma migrate deploy
    else
        echo "🔄 Existing database detected - running migration updates..."
        npx prisma migrate deploy
    fi
    
    echo "✅ Migrations completed!"
}

# Function to generate Prisma client
generate_client() {
    echo "🔧 Generating Prisma client..."
    npx prisma generate
    echo "✅ Prisma client generated!"
}

# Function to validate environment
validate_env() {
    echo "🔍 Validating environment variables..."
    
    # Core required variables
    required_vars=(
        "DATABASE_URL"
        "NODE_ENV"
        "JWT_SECRET"
    )
    
    # Optional WordPress/WooCommerce variables
    optional_vars=(
        "WP_BASE_URL"
        "WOO_CONSUMER_KEY"
        "WOO_CONSUMER_SECRET"
        "WP_GRAPHQL_ENDPOINT"
    )
    
    # Check required variables
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            echo "❌ Error: Required environment variable $var is not set"
            exit 1
        fi
        echo "✅ $var is set"
    done
    
    # Check optional variables and enable degraded mode if missing
    missing_optional=0
    for var in "${optional_vars[@]}"; do
        if [ -z "${!var}" ]; then
            echo "⚠️  Optional variable $var is not set"
            missing_optional=1
        else
            echo "✅ $var is set"
        fi
    done
    
    if [ $missing_optional -eq 1 ]; then
        echo "⚠️  Some WordPress/WooCommerce variables are missing - enabling degraded mode"
        export INTEGRATION_WP_DISABLED=1
    else
        echo "✅ All WordPress/WooCommerce variables are set"
        export INTEGRATION_WP_DISABLED=0
    fi
    
    echo "✅ Environment validation passed!"
}

# Main execution
main() {
    echo "🏁 Starting production deployment process..."
    
    # Validate environment
    validate_env
    
    # Wait for database
    wait_for_db
    
    # Generate Prisma client
    generate_client
    
    # Run migrations
    run_migrations
    
    # Start the application
    echo "🚀 Starting Optia BFF API..."
    exec node dist/index.js
}

# Error handling
handle_error() {
    echo "❌ Deployment failed at line $1"
    exit 1
}

trap 'handle_error $LINENO' ERR

# Run main function
main "$@"
