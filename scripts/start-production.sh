#!/bin/bash
set -e

echo "🚀 Starting Optia BFF Production Deployment..."

# Function to check if database is ready
wait_for_db() {
    echo "⏳ Waiting for PostgreSQL to be ready..."
    until npx prisma db execute --stdin <<< "SELECT 1;" 2>/dev/null; do
        echo "PostgreSQL is unavailable - sleeping"
        sleep 2
    done
    echo "✅ PostgreSQL is ready!"
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
    
    required_vars=(
        "DATABASE_URL"
        "NODE_ENV"
        "WP_BASE_URL"
        "WOOCOMMERCE_CONSUMER_KEY"
        "WOOCOMMERCE_CONSUMER_SECRET"
        "JWT_SECRET"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            echo "❌ Error: Required environment variable $var is not set"
            exit 1
        fi
    done
    
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
