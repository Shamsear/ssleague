// Run this with: node debug-rounds.js
// This helps debug why active rounds aren't showing

const neon = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon.neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

async function debugRounds() {
  console.log('🔍 Checking active rounds...\n');
  
  try {
    // Check all rounds
    const allRounds = await sql`
      SELECT 
        id,
        season_id,
        position,
        status,
        end_time,
        created_at,
        EXTRACT(EPOCH FROM (end_time - NOW())) as seconds_remaining
      FROM rounds
      ORDER BY created_at DESC
      LIMIT 5
    `;
    
    console.log('📋 Recent Rounds:');
    console.table(allRounds.map(r => ({
      id: r.id.substring(0, 8) + '...',
      season_id: r.season_id,
      position: r.position,
      status: r.status,
      seconds_remaining: Math.floor(r.seconds_remaining || 0),
      expired: r.seconds_remaining <= 0 ? '❌ YES' : '✅ NO'
    })));
    
    // Check active rounds only
    const activeRounds = await sql`
      SELECT 
        id,
        season_id,
        position,
        status,
        end_time,
        EXTRACT(EPOCH FROM (end_time - NOW())) as seconds_remaining
      FROM rounds
      WHERE status = 'active'
    `;
    
    console.log('\n🟢 Active Rounds:', activeRounds.length);
    if (activeRounds.length > 0) {
      console.table(activeRounds.map(r => ({
        id: r.id.substring(0, 8) + '...',
        season_id: r.season_id,
        position: r.position,
        seconds_remaining: Math.floor(r.seconds_remaining || 0),
        expired: r.seconds_remaining <= 0 ? '❌ YES' : '✅ NO'
      })));
    }
    
    // Check what the API would return
    const seasonId = 'cDbQCLfNuTyEoIuiSIh7'; // From your data
    const apiResult = await sql`
      SELECT 
        r.*,
        COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'active') as total_bids,
        COUNT(DISTINCT b.team_id) FILTER (WHERE b.status = 'active') as teams_bid,
        EXTRACT(EPOCH FROM (end_time - NOW())) as seconds_remaining
      FROM rounds r
      LEFT JOIN bids b ON r.id = b.round_id
      WHERE r.season_id = ${seasonId}
      AND r.status = 'active'
      GROUP BY r.id
      ORDER BY r.created_at DESC
    `;
    
    console.log(`\n🔌 API Query Result for season "${seasonId}":`, apiResult.length);
    if (apiResult.length > 0) {
      console.table(apiResult.map(r => ({
        id: r.id.substring(0, 8) + '...',
        position: r.position,
        total_bids: r.total_bids,
        teams_bid: r.teams_bid,
        seconds_remaining: Math.floor(r.seconds_remaining || 0),
        expired: r.seconds_remaining <= 0 ? '❌ YES' : '✅ NO'
      })));
    } else {
      console.log('⚠️  No active rounds returned by API query!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugRounds();
