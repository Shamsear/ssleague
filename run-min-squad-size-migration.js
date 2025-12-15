require('dotenv').config({ path: '.env.local' })
const { Pool } = require('pg')
const fs = require('fs')

// Use FANTASY_DATABASE_URL for fantasy-specific tables
const pool = new Pool({
  connectionString: process.env.FANTASY_DATABASE_URL || process.env.DATABASE_URL
})

async function runMigration() {
  try {
    console.log('🔄 Adding min_squad_size column to fantasy_leagues table...')
    console.log(`📍 Database: ${process.env.FANTASY_DATABASE_URL ? 'FANTASY_DATABASE_URL' : 'DATABASE_URL (fallback)'}`)
    
    const migration = fs.readFileSync('migrations/add_min_squad_size_to_fantasy_leagues.sql', 'utf8')
    
    // Execute migration
    await pool.query(migration)
    
    console.log('✅ Column added successfully!')
    console.log('\n📋 Changes:')
    console.log('  - Added min_squad_size INTEGER column')
    console.log('  - Default value: 11')
    console.log('  - Updated existing records')
    console.log('\n✨ Draft settings page will now save and load min_squad_size!')
    
    await pool.end()
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    await pool.end()
    process.exit(1)
  }
}

runMigration()
