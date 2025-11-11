/**
 * Check Player Stats for Season 12 in Neon
 */

const { neon } = require('@neondatabase/serverless');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const tournamentSql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function checkPlayerSeasonStats() {
  console.log('🔍 Checking player stats in Neon...\n');
  
  const playerId = 'sspslpsl0036';
  
  try {
    // Get all stats for this player
    const stats = await tournamentSql`
      SELECT 
        player_id,
        player_name,
        season_id,
        tournament_id,
        team,
        matches_played,
        goals_scored
      FROM realplayerstats 
      WHERE player_id = ${playerId}
      ORDER BY tournament_id
    `;
    
    console.log(`Found ${stats.length} stat records for player ${playerId}:\n`);
    
    stats.forEach(stat => {
      console.log(`Season ID: ${stat.season_id || 'NULL'}`);
      console.log(`  Tournament ID: ${stat.tournament_id}`);
      console.log(`  Team: ${stat.team}`);
      console.log(`  Matches: ${stat.matches_played}, Goals: ${stat.goals_scored}`);
      console.log('');
    });
    
    // Check if Season 12 exists
    const season12Stats = stats.filter(s => 
      s.season_id && (s.season_id.includes('12') || s.tournament_id.includes('12'))
    );
    
    if (season12Stats.length > 0) {
      console.log('✅ Found Season 12 stats:');
      season12Stats.forEach(stat => {
        console.log(`  Season ID: ${stat.season_id}`);
        console.log(`  Tournament ID: ${stat.tournament_id}`);
      });
    } else {
      console.log('❌ No Season 12 stats found');
      console.log('\n💡 Season IDs found:');
      const uniqueSeasonIds = [...new Set(stats.map(s => s.season_id).filter(Boolean))];
      uniqueSeasonIds.forEach(id => console.log(`  - ${id}`));
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkPlayerSeasonStats();
