require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

const testTeamId = 'SSPSLT0001'; // The team ID from the tiebreaker
const testSeasonId = '2025'; // Adjust if needed

(async () => {
  try {
    console.log('🔍 Testing tiebreaker query for team:', testTeamId, '\n');
    
    // Run the actual query from the dashboard API
    console.log('=== Running Dashboard Tiebreaker Query ===');
    const tiebreakersResult = await sql`
      SELECT 
        t.*,
        p.name as player_name,
        p.position,
        p.overall_rating,
        p.team_name as player_team,
        r.position as round_position,
        r.season_id,
        r.round_type,
        tt.old_bid_amount as team_old_bid,
        tt.new_bid_amount as team_new_bid,
        tt.submitted as team_submitted,
        tt.submitted_at as team_submitted_at
      FROM tiebreakers t
      INNER JOIN footballplayers p ON t.player_id = p.id
      LEFT JOIN rounds r ON t.round_id = r.id
      INNER JOIN team_tiebreakers tt ON t.id = tt.tiebreaker_id
      WHERE tt.team_id = ${testTeamId}
      AND t.status = 'active'
      AND t.season_id = ${testSeasonId}
      ORDER BY t.created_at DESC
    `;
    
    console.log(`Found ${tiebreakersResult.length} tiebreaker(s) for team ${testTeamId}:`);
    tiebreakersResult.forEach((t, i) => {
      console.log(`  ${i + 1}. Tiebreaker ID: ${t.id}`);
      console.log(`     Player: ${t.player_name} (${t.position})`);
      console.log(`     Round: ${t.round_id} (Type: ${t.round_type})`);
      console.log(`     Original Amount: ${t.original_amount}`);
      console.log(`     Team Old Bid: ${t.team_old_bid}`);
      console.log(`     Team New Bid: ${t.team_new_bid || 'NULL'}`);
      console.log(`     Submitted: ${t.team_submitted}`);
      console.log('');
    });
    
    if (tiebreakersResult.length === 0) {
      console.log('⚠️  No tiebreakers found! Checking individual conditions...\n');
      
      // Check if tiebreakers exist
      const allTiebreakers = await sql`SELECT id, status, season_id FROM tiebreakers WHERE status = 'active'`;
      console.log(`  Total active tiebreakers in DB: ${allTiebreakers.length}`);
      
      // Check if team_tiebreakers exist for this team
      const teamTiebreakersCheck = await sql`SELECT * FROM team_tiebreakers WHERE team_id = ${testTeamId}`;
      console.log(`  Total team_tiebreakers for team: ${teamTiebreakersCheck.length}`);
      
      // Check season_id match
      const seasonCheck = await sql`SELECT id, season_id FROM tiebreakers WHERE status = 'active' AND season_id = ${testSeasonId}`;
      console.log(`  Tiebreakers with season ${testSeasonId}: ${seasonCheck.length}`);
    }
    
  } catch(e) {
    console.error('❌ Error:', e.message);
    console.error(e);
  }
})();
