const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: '.env.local' });

async function runMigration() {
  const connectionString = process.env.FANTASY_DATABASE_URL || 'postgresql://neondb_owner:npg_K1IGoDtlkPA3@ep-silent-sun-a1hf5mn7-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
  
  if (!connectionString) {
    console.error('❌ FANTASY_DATABASE_URL not found');
    process.exit(1);
  }
  
  console.log('📡 Using fantasy database connection...');
  const sql = neon(connectionString);
  
  try {
    console.log('🚀 Running scoring rules table migration...');
    
    // Create scoring_rules table
    await sql`
      CREATE TABLE IF NOT EXISTS scoring_rules (
        rule_id SERIAL PRIMARY KEY,
        league_id VARCHAR(100) NOT NULL,
        rule_name VARCHAR(255) NOT NULL,
        rule_type VARCHAR(100) NOT NULL,
        description TEXT,
        points_value DECIMAL(10, 2) NOT NULL,
        applies_to VARCHAR(50) DEFAULT 'player',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_league FOREIGN KEY (league_id) REFERENCES fantasy_leagues(league_id) ON DELETE CASCADE
      )
    `;
    
    console.log('✅ Table created successfully!');
    
    // Create indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_scoring_rules_league ON scoring_rules(league_id)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_scoring_rules_active ON scoring_rules(league_id, is_active)
    `;
    
    console.log('✅ Indexes created successfully!');
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
