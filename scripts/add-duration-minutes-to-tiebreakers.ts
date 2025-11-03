import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

async function addDurationMinutesColumn() {
  try {
    console.log('🔍 Checking tiebreakers table structure...');
    
    // Check if column exists
    const checkColumn = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tiebreakers' 
      AND column_name = 'duration_minutes'
    `;
    
    if (checkColumn.length > 0) {
      console.log('✅ Column duration_minutes already exists');
      return;
    }
    
    console.log('➕ Adding duration_minutes column...');
    
    // Add the column (nullable - NULL means no time limit)
    await sql`
      ALTER TABLE tiebreakers 
      ADD COLUMN duration_minutes INTEGER NULL
    `;
    
    console.log('✅ Column duration_minutes added successfully');
    
    // Add comment
    await sql`
      COMMENT ON COLUMN tiebreakers.duration_minutes IS 'Time limit for tiebreaker in minutes. NULL = no time limit (teams must submit)'
    `;
    
    console.log('✅ Column comment added');
    
    // Verify
    const verify = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'tiebreakers' 
      AND column_name = 'duration_minutes'
    `;
    
    console.log('\n📋 Column details:', verify[0]);
    console.log('\n🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

addDurationMinutesColumn();
