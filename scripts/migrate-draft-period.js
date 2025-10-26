const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

// Load environment variables
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
    console.log('🚀 Running draft period control migration...');
    
    // Add columns to fantasy_leagues
    await sql`
      ALTER TABLE fantasy_leagues 
      ADD COLUMN IF NOT EXISTS draft_status VARCHAR(20) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS draft_opens_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS draft_closes_at TIMESTAMP
    `;
    
    console.log('✅ Columns added successfully!');
    
    // Add check constraint
    await sql`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'fantasy_leagues_draft_status_check'
        ) THEN
          ALTER TABLE fantasy_leagues 
          ADD CONSTRAINT fantasy_leagues_draft_status_check 
          CHECK (draft_status IN ('pending', 'active', 'closed'));
        END IF;
      END $$
    `;
    
    console.log('✅ Constraint added successfully!');
    
    // Create index
    await sql`
      CREATE INDEX IF NOT EXISTS idx_fantasy_leagues_draft_status 
      ON fantasy_leagues(draft_status)
    `;
    
    console.log('✅ Index created successfully!');
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
