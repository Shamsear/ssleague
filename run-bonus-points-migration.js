require('dotenv').config({ path: '.env.local' })
const { neon } = require('@neondatabase/serverless')
const fs = require('fs')
const { Pool } = require('pg')

// Use FANTASY_DATABASE_URL for fantasy-specific tables
const pool = new Pool({
  connectionString: process.env.FANTASY_DATABASE_URL || process.env.DATABASE_URL
})

async function runMigration() {
  try {
    console.log('🔄 Running bonus points table migration on FANTASY database...')
    console.log(`📍 Database: ${process.env.FANTASY_DATABASE_URL ? 'FANTASY_DATABASE_URL' : 'DATABASE_URL (fallback)'}`)
    
    const migration = fs.readFileSync('migrations/create_bonus_points_table.sql', 'utf8')
    
    // Execute migration
    await pool.query(migration)
    
    console.log('✅ Bonus points table created successfully in fantasy database!')
    console.log('\n📋 Table structure:')
    console.log('  - id (SERIAL PRIMARY KEY)')
    console.log('  - target_type (player/team)')
    console.log('  - target_id (real_player_id or fantasy team_id)')
    console.log('  - points (INTEGER)')
    console.log('  - reason (VARCHAR)')
    console.log('  - league_id (VARCHAR) - Fantasy league ID')
    console.log('  - awarded_by (VARCHAR)')
    console.log('  - awarded_at (TIMESTAMP)')
    console.log('\n✨ Ready to award bonus points in fantasy leagues!')
    await pool.end()
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    await pool.end()
    process.exit(1)
  }
}

runMigration()
