import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

async function addPreventAutoPromotionColumn() {
  console.log('🔧 Adding prevent_auto_promotion column to player_seasons table...');
  
  try {
    // Add the prevent_auto_promotion column
    await sql`
      ALTER TABLE player_seasons 
      ADD COLUMN IF NOT EXISTS prevent_auto_promotion BOOLEAN DEFAULT false
    `;
    console.log('✅ Column prevent_auto_promotion added');
    
    // Create index for better query performance
    await sql`
      CREATE INDEX IF NOT EXISTS idx_player_seasons_prevent_auto_promotion 
      ON player_seasons(prevent_auto_promotion)
    `;
    console.log('✅ Index created on prevent_auto_promotion');
    
    // Verify the column exists
    const columns = await sql`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'player_seasons' 
        AND column_name = 'prevent_auto_promotion'
    `;
    
    if (columns.length > 0) {
      console.log('\n✅ Verification successful!');
      console.log('📊 Column details:');
      columns.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type}`);
        console.log(`     Default: ${col.column_default}`);
        console.log(`     Nullable: ${col.is_nullable}`);
      });
    } else {
      console.log('\n⚠️  Warning: Column verification failed');
    }
    
    console.log('\n✅ Migration complete!');
    console.log('\n📝 Usage:');
    console.log('   - Set prevent_auto_promotion = true to exclude a player from auto-promotion');
    console.log('   - Auto-promotion query will skip players where prevent_auto_promotion = true');
    
  } catch (error) {
    console.error('❌ Error adding column:', error);
    throw error;
  }
}

addPreventAutoPromotionColumn()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
