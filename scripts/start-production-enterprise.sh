#!/bin/bash
set -euo pipefail

echo "🏢 Enterprise Production Deployment - $(date)"

# Function to validate environment (no database connection)
validate_environment() {
    echo "🔍 Validating environment variables..."
    
    # Core required variables only
    required_vars=("DATABASE_URL" "NODE_ENV" "JWT_SECRET")
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            echo "❌ Error: Required environment variable $var is not set"
            exit 1
        fi
        echo "✅ $var is set"
    done
    
    echo "✅ Environment validation passed!"
}

# Function to start application (NO database checks)
start_application() {
    echo "🚀 Starting application..."
    
    # Generate Prisma client (safe operation)
    echo "🔧 Generating Prisma client..."
    npx prisma generate
    echo "✅ Prisma client generated!"
    
    # Start application directly - let it handle database connections
    echo "🚀 Starting Optia BFF API..."
    exec node dist/index.js
}

# Main execution
main() {
    echo "🏁 Starting enterprise deployment process..."
    
    # Step 1: Environment validation (no DB checks)
    validate_environment
    
    # Step 2: Start application immediately
    start_application
}

# Error handling
trap 'echo "❌ Deployment failed at line $LINENO"; exit 1' ERR

# Execute main function
main "$@"
