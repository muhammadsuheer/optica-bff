/**
 * Vercel Edge Runtime Compatible Migration Service
 * 
 * IMPORTANT: Migrations should be run manually in Supabase dashboard
 * or via Supabase CLI, not automatically in Edge Runtime.
 * 
 * This service provides utilities to check migration status only.
 */

import { supabaseClient } from './supabase'
import { logger } from '../observability/logger'

/**
 * Check if migrations table exists and is properly set up
 */
export async function checkMigrationStatus(): Promise<{
  migrationsTableExists: boolean
  appliedMigrations: string[]
  pendingMigrations: string[]
}> {
  try {
    // Check if migrations table exists
    const { data: tableCheck, error: tableError } = await (supabaseClient as any)
      .from('migrations')
      .select('id')
      .limit(1)

    if (tableError) {
      logger.warn('Migrations table does not exist - migrations need to be run manually')
      return {
        migrationsTableExists: false,
        appliedMigrations: [],
        pendingMigrations: ['000_create_migrations_table', '001_performance_indexes']
      }
    }

    // Get applied migrations
    const { data: appliedMigrations } = await (supabaseClient as any)
      .from('migrations')
      .select('id')
      .order('applied_at', { ascending: true })

    const appliedIds = appliedMigrations?.map(m => m.id) || []
    const allMigrations = ['000_create_migrations_table', '001_performance_indexes']
    const pendingMigrations = allMigrations.filter(id => !appliedIds.includes(id))

    return {
      migrationsTableExists: true,
      appliedMigrations: appliedIds,
      pendingMigrations
    }
  } catch (error) {
    logger.error('Failed to check migration status', error instanceof Error ? error : new Error('Unknown error'))
    return {
      migrationsTableExists: false,
      appliedMigrations: [],
      pendingMigrations: ['000_create_migrations_table', '001_performance_indexes']
    }
  }
}

/**
 * Log migration status for debugging
 */
export async function logMigrationStatus(): Promise<void> {
  const status = await checkMigrationStatus()
  
  if (!status.migrationsTableExists) {
    logger.warn('⚠️  MIGRATIONS REQUIRED: Run the following SQL in your Supabase dashboard:')
    logger.warn('1. Create migrations table (see migrations/000_create_migrations_table.sql)')
    logger.warn('2. Run performance indexes (see migrations/001_performance_indexes.sql)')
    return
  }

  if (status.pendingMigrations.length > 0) {
    logger.warn(`⚠️  PENDING MIGRATIONS: ${status.pendingMigrations.join(', ')}`)
    logger.warn('Run these migrations manually in your Supabase dashboard')
  } else {
    logger.info('✅ All migrations are up to date')
  }
}
