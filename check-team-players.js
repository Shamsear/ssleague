// Quick script to check team_players assignments
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

async function checkTeamPlayers() {
  try {
    console.log('Checking team_players table...\n');
    
    // Get all team_players records
    const teamPlayers = await sql`
      SELECT 
        tp.*,
        t.name as team_name,
        p.name as player_name,
        p.position
      FROM team_players tp
      LEFT JOIN teams t ON tp.team_id = t.id
      LEFT JOIN footballplayers p ON tp.player_id = p.id
      ORDER BY tp.acquired_at DESC
    `;
    
    console.log(`Total team_players records: ${teamPlayers.length}\n`);
    
    if (teamPlayers.length === 0) {
      console.log('⚠️  No players assigned to any team yet!\n');
    } else {
      console.log('✅ Players assigned to teams:\n');
      teamPlayers.forEach(tp => {
        console.log(`- ${tp.player_name || tp.player_id} (${tp.position || 'N/A'}) → ${tp.team_name || tp.team_id}`);
        console.log(`  Price: £${tp.purchase_price?.toLocaleString() || 'N/A'} | Acquired: ${tp.acquired_at}`);
        console.log('');
      });
    }
    
    // Check completed rounds
    console.log('\n---\nChecking completed rounds...\n');
    const completedRounds = await sql`
      SELECT id, position, status, created_at
      FROM rounds
      WHERE status = 'completed'
      ORDER BY created_at DESC
      LIMIT 5
    `;
    
    console.log(`Completed rounds: ${completedRounds.length}\n`);
    completedRounds.forEach(round => {
      console.log(`- Round ${round.id}: ${round.position} (${round.status})`);
    });
    
    // Check won bids
    console.log('\n---\nChecking won bids...\n');
    const wonBids = await sql`
      SELECT 
        b.id,
        b.team_id,
        t.name as team_name,
        b.player_id,
        p.name as player_name,
        b.amount,
        b.status,
        r.position as round_position
      FROM bids b
      LEFT JOIN teams t ON b.team_id = t.id
      LEFT JOIN footballplayers p ON b.player_id = p.id
      LEFT JOIN rounds r ON b.round_id = r.id
      WHERE b.status = 'won'
      ORDER BY b.updated_at DESC
      LIMIT 10
    `;
    
    console.log(`Won bids: ${wonBids.length}\n`);
    wonBids.forEach(bid => {
      console.log(`- ${bid.player_name || bid.player_id} → ${bid.team_name || bid.team_id}`);
      console.log(`  Round: ${bid.round_position} | Amount: £${bid.amount?.toLocaleString()}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

checkTeamPlayers();
