// Test JOIN step by step
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

async function testJoinStep() {
  try {
    const roundId = 'a17899a5-8b0a-4c9d-9c81-9935f3a787d3';
    
    console.log('Step 1: Bids only\n');
    const bidsOnly = await sql`
      SELECT b.id, b.team_id, b.player_id, b.amount, b.status
      FROM bids b
      WHERE b.round_id = ${roundId}
      AND b.status = 'active'
    `;
    console.log(`✅ Found ${bidsOnly.length} active bids`);
    if (bidsOnly.length > 0) {
      console.log(`  Sample: player_id=${bidsOnly[0].player_id}, team_id=${bidsOnly[0].team_id}\n`);
    }
    
    console.log('Step 2: Bids + Teams JOIN\n');
    const bidsWithTeams = await sql`
      SELECT b.id, b.team_id, t.name as team_name, b.player_id, b.amount
      FROM bids b
      JOIN teams t ON b.team_id = t.id
      WHERE b.round_id = ${roundId}
      AND b.status = 'active'
    `;
    console.log(`✅ Found ${bidsWithTeams.length} bids with teams`);
    if (bidsWithTeams.length > 0) {
      console.log(`  Sample: team_name=${bidsWithTeams[0].team_name}\n`);
    }
    
    console.log('Step 3: Bids + Teams + Players JOIN\n');
    const full = await sql`
      SELECT 
        b.id,
        b.team_id,
        t.name as team_name,
        b.player_id,
        p.name as player_name,
        b.amount
      FROM bids b
      JOIN teams t ON b.team_id = t.id
      JOIN footballplayers p ON b.player_id = p.id::text
      WHERE b.round_id = ${roundId}
      AND b.status = 'active'
    `;
    console.log(`✅ Found ${full.length} bids with full info`);
    if (full.length > 0) {
      console.log(`  Sample: player_name=${full[0].player_name}\n`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nDetails:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

testJoinStep();
