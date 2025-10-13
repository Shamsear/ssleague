// Quick test to check what the dashboard API returns
// Run: node test-dashboard-api.js

const neon = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon.neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

async function testDashboardAPI() {
  const seasonId = 'cDbQCLfNuTyEoIuiSIh7'; // From your database
  
  console.log('🔍 Testing Dashboard API Query...\n');
  console.log('Season ID:', seasonId);
  console.log('Current UTC Time:', new Date().toISOString());
  console.log('Current IST Time:', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
  console.log('\n' + '='.repeat(60) + '\n');
  
  try {
    const activeRoundsResult = await sql`
      SELECT 
        r.*,
        COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'active') as total_bids,
        COUNT(DISTINCT b.team_id) FILTER (WHERE b.status = 'active') as teams_bid,
        EXTRACT(EPOCH FROM (r.end_time - NOW())) as seconds_until_end
      FROM rounds r
      LEFT JOIN bids b ON r.id = b.round_id
      WHERE r.season_id = ${seasonId}
      AND r.status = 'active'
      GROUP BY r.id
      ORDER BY r.created_at DESC
    `;
    
    console.log(`✅ Found ${activeRoundsResult.length} active round(s)\n`);
    
    if (activeRoundsResult.length > 0) {
      activeRoundsResult.forEach((round, index) => {
        const endTimeUTC = new Date(round.end_time);
        const endTimeIST = endTimeUTC.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        const minutesRemaining = Math.floor(round.seconds_until_end / 60);
        
        console.log(`Round ${index + 1}:`);
        console.log('  ID:', round.id);
        console.log('  Position:', round.position);
        console.log('  Status:', round.status);
        console.log('  Max Bids:', round.max_bids_per_team);
        console.log('  Total Bids:', round.total_bids);
        console.log('  Teams Bid:', round.teams_bid);
        console.log('  End Time (UTC):', endTimeUTC.toISOString());
        console.log('  End Time (IST):', endTimeIST);
        console.log('  Time Remaining:', `${minutesRemaining} minutes`);
        console.log('');
      });
      
      console.log('✅ This data should appear in the team dashboard!');
      console.log('\nAPI Response shape:');
      console.log(JSON.stringify({
        success: true,
        data: {
          activeRounds: activeRoundsResult.map(r => ({
            id: r.id,
            season_id: r.season_id,
            position: r.position,
            status: r.status,
            end_time: r.end_time,
            max_bids_per_team: r.max_bids_per_team,
            total_bids: parseInt(r.total_bids || '0'),
            teams_bid: parseInt(r.teams_bid || '0'),
          }))
        }
      }, null, 2));
      
    } else {
      console.log('❌ No active rounds found!');
      console.log('\n🔍 Checking all rounds for this season...\n');
      
      const allSeasonRounds = await sql`
        SELECT id, season_id, position, status, end_time
        FROM rounds
        WHERE season_id = ${seasonId}
        ORDER BY created_at DESC
        LIMIT 5
      `;
      
      if (allSeasonRounds.length > 0) {
        console.table(allSeasonRounds);
      } else {
        console.log('❌ No rounds at all for season:', seasonId);
        console.log('\n📋 All rounds in database:');
        const allRounds = await sql`SELECT id, season_id, position, status FROM rounds LIMIT 10`;
        console.table(allRounds);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

testDashboardAPI();
