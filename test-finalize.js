// Test finalization directly
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

async function testFinalize() {
  try {
    const roundId = 'a17899a5-8b0a-4c9d-9c81-9935f3a787d3';
    
    console.log('Testing finalization steps...\n');
    
    // Test 1: Update bid status
    console.log('Step 1: Testing bid update...');
    const testBid = await sql`
      SELECT id FROM bids WHERE round_id = ${roundId} AND status = 'active' LIMIT 1
    `;
    
    if (testBid.length > 0) {
      console.log(`Found bid: ${testBid[0].id}`);
      
      try {
        await sql`
          UPDATE bids
          SET status = 'won',
              updated_at = NOW()
          WHERE id = ${testBid[0].id}
        `;
        console.log('✅ Bid update successful\n');
        
        // Revert
        await sql`
          UPDATE bids SET status = 'active' WHERE id = ${testBid[0].id}
        `;
      } catch (err) {
        console.error('❌ Bid update failed:', err.message);
      }
    }
    
    // Test 2: Insert into team_players
    console.log('Step 2: Testing team_players insert...');
    try {
      const testInsert = await sql`
        INSERT INTO team_players (
          team_id,
          player_id,
          purchase_price,
          acquired_at
        ) VALUES (
          'test_team_123',
          '2341',
          500,
          NOW()
        )
        RETURNING id
      `;
      console.log('✅ team_players insert successful:', testInsert[0].id);
      
      // Clean up
      await sql`DELETE FROM team_players WHERE id = ${testInsert[0].id}`;
      console.log('   (cleaned up test record)\n');
    } catch (err) {
      console.error('❌ team_players insert failed:', err.message);
      console.error('   Full error:', err);
    }
    
    // Test 3: Update player status
    console.log('Step 3: Testing player update...');
    try {
      await sql`
        UPDATE footballplayers
        SET status = 'sold'
        WHERE id = '2341'
      `;
      console.log('✅ Player update successful\n');
      
      // Revert
      await sql`
        UPDATE footballplayers SET status = 'available' WHERE id = '2341'
      `;
    } catch (err) {
      console.error('❌ Player update failed:', err.message);
      console.error('   Full error:', err);
    }
    
    // Test 4: Update round status
    console.log('Step 4: Testing round update...');
    try {
      await sql`
        UPDATE rounds
        SET updated_at = NOW()
        WHERE id = ${roundId}
      `;
      console.log('✅ Round update successful\n');
    } catch (err) {
      console.error('❌ Round update failed:', err.message);
    }
    
  } catch (error) {
    console.error('General error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

testFinalize();
