require('dotenv').config({ path: '.env.local' })
const { Pool } = require('pg')
const fs = require('fs')

const pool = new Pool({
  connectionString: process.env.FANTASY_DATABASE_URL || process.env.DATABASE_URL
})

async function runMigration() {
  try {
    console.log('🔄 Adding is_starting column to fantasy_squad table...')
    console.log(`📍 Database: ${process.env.FANTASY_DATABASE_URL ? 'FANTASY_DATABASE_URL' : 'DATABASE_URL (fallback)'}`)
    
    const migration = fs.readFileSync('migrations/add_is_starting_to_fantasy_squad.sql', 'utf8')
    
    await pool.query(migration)
    
    console.log('✅ Column added successfully!')
    console.log('\n📋 Changes:')
    console.log('  - Added is_starting BOOLEAN column')
    console.log('  - Default value: true (all players start as starters)')
    console.log('  - Updated existing records')
    console.log('  - Added performance index')
    console.log('\n✨ Teams can now select their starting 5 and subs!')
    
    await pool.end()
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    await pool.end()
    process.exit(1)
  }
}

runMigration()
