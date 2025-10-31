import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

async function fixTournamentId() {
  console.log('🔧 Making tournament_id nullable for historical imports...\n');
  
  try {
    // Make tournament_id nullable in realplayerstats
    await sql`ALTER TABLE realplayerstats ALTER COLUMN tournament_id DROP NOT NULL`;
    console.log('✅ realplayerstats.tournament_id is now nullable');
    
    // Make tournament_id nullable in teamstats
    await sql`ALTER TABLE teamstats ALTER COLUMN tournament_id DROP NOT NULL`;
    console.log('✅ teamstats.tournament_id is now nullable');
    
    console.log('\n✅ Done! You can now import historical seasons.');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

fixTournamentId();
