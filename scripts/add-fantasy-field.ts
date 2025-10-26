import { config } from 'dotenv';
import { getTournamentDb } from '../lib/neon/tournament-config';

// Load environment variables
config({ path: '.env.local' });

async function addFantasyField() {
  const sql = getTournamentDb();
  
  try {
    console.log('Adding include_in_fantasy column to tournaments table...');
    
    await sql`
      ALTER TABLE tournaments 
      ADD COLUMN IF NOT EXISTS include_in_fantasy BOOLEAN DEFAULT true
    `;
    
    console.log('✅ Column added successfully!');
    
    // Update existing tournaments to include in fantasy by default
    const result = await sql`
      UPDATE tournaments 
      SET include_in_fantasy = true 
      WHERE include_in_fantasy IS NULL
    `;
    
    console.log(`✅ Updated ${result.length} existing tournaments`);
    
    // Show current tournaments
    const tournaments = await sql`
      SELECT id, tournament_name, include_in_fantasy 
      FROM tournaments 
      ORDER BY created_at DESC
    `;
    
    console.log('\n📋 Current tournaments:');
    tournaments.forEach(t => {
      console.log(`  - ${t.tournament_name} (${t.id}): ${t.include_in_fantasy ? '✅ In Fantasy' : '❌ Not in Fantasy'}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addFantasyField();
