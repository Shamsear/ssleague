import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ No DATABASE_URL found');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function fixTeamIdMismatch() {
  console.log('🔧 Fixing team ID mismatches between Firebase and Neon...\n');

  try {
    // Find all teams in Neon
    const neonTeams = await sql`
      SELECT id, name, firebase_uid, season_id
      FROM teams
      ORDER BY created_at
    `;

    console.log(`📊 Found ${neonTeams.length} teams in Neon\n`);

    for (const team of neonTeams) {
      console.log(`\n🔍 Checking team: ${team.id}`);
      console.log(`   Firebase UID: ${team.firebase_uid}`);
      console.log(`   Name: ${team.name}`);
      
      // Check if this team has any bids or players
      const bidsCount = await sql`
        SELECT COUNT(*) as count FROM bids WHERE team_id = ${team.id}
      `;
      
      const playersCount = await sql`
        SELECT COUNT(*) as count FROM team_players WHERE team_id = ${team.id}
      `;
      
      const bids = Number(bidsCount[0].count);
      const players = Number(playersCount[0].count);
      
      console.log(`   Bids: ${bids}`);
      console.log(`   Players: ${players}`);
      
      if (bids === 0 && players === 0) {
        console.log(`   ⚠️  Team has no bids or players - safe to delete`);
        console.log(`   💡 This team will be recreated with correct ID from Firebase on next login`);
        
        // Delete the team
        await sql`DELETE FROM teams WHERE id = ${team.id}`;
        console.log(`   ✅ Deleted team ${team.id}`);
      } else {
        console.log(`   ⚠️  Team has ${bids} bids and ${players} players - keeping it`);
        console.log(`   💡 Manual intervention needed if ID mismatch exists`);
      }
    }

    console.log('\n\n✅ Team ID mismatch fix completed!\n');
    console.log('💡 Teams will be recreated with correct IDs from Firebase when users log in next.');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixTeamIdMismatch().then(() => {
  console.log('\nDone!');
  process.exit(0);
});
