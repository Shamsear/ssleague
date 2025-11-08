const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function fixBulkRound() {
  const sql = neon(process.env.NEON_AUCTION_DB_URL);
  
  try {
    // Delete the broken round
    console.log('🗑️  Deleting broken bulk round...');
    await sql`DELETE FROM rounds WHERE id = 'SSPSLFBR00001'`;
    console.log('✅ Deleted broken round');
    
    // Get auction settings
    const settings = await sql`SELECT id, season_id FROM auction_settings LIMIT 1`;
    if (settings.length === 0) {
      console.log('❌ No auction settings found');
      return;
    }
    
    const { id: auction_settings_id, season_id } = settings[0];
    console.log(`\n📋 Using auction settings: ${auction_settings_id}, season: ${season_id}`);
    
    // Get next round number
    const existingRounds = await sql`
      SELECT MAX(round_number) as max_round
      FROM rounds
      WHERE season_id = ${season_id}
    `;
    const nextRoundNumber = (existingRounds[0]?.max_round || 0) + 1;
    
    // Create new round
    const roundId = 'SSPSLFBR00002'; // New ID
    const base_price = 10;
    const duration_seconds = 300; // 5 minutes
    
    console.log(`\n🔄 Creating bulk round ${nextRoundNumber} with ID: ${roundId}...`);
    
    await sql`
      INSERT INTO rounds (
        id,
        season_id,
        auction_settings_id,
        round_number,
        round_type,
        base_price,
        status,
        duration_seconds,
        created_at
      ) VALUES (
        ${roundId},
        ${season_id},
        ${auction_settings_id},
        ${nextRoundNumber},
        'bulk',
        ${base_price},
        'draft',
        ${duration_seconds},
        NOW()
      )
    `;
    
    console.log('✅ Round created');
    
    // Get eligible players
    console.log('\n📊 Fetching eligible players...');
    const eligiblePlayers = await sql`
      SELECT 
        id as player_id,
        name,
        position,
        position_group,
        overall_rating
      FROM footballplayers
      WHERE (season_id = ${season_id} OR season_id IS NULL)
      AND is_auction_eligible = true
      AND is_sold = false
      ORDER BY overall_rating DESC, name ASC
    `;
    
    console.log(`✅ Found ${eligiblePlayers.length} eligible players`);
    
    if (eligiblePlayers.length === 0) {
      console.log('❌ No eligible players found!');
      return;
    }
    
    // Insert players in batches to avoid query size issues
    console.log('\n📝 Inserting players into round...');
    const batchSize = 100;
    let inserted = 0;
    
    for (let i = 0; i < eligiblePlayers.length; i += batchSize) {
      const batch = eligiblePlayers.slice(i, i + batchSize);
      
      for (const player of batch) {
        try {
          await sql`
            INSERT INTO round_players (
              round_id,
              season_id,
              player_id,
              player_name,
              position,
              position_group,
              base_price,
              status
            ) VALUES (
              ${roundId},
              ${season_id},
              ${player.player_id},
              ${player.name},
              ${player.position || ''},
              ${player.position_group || ''},
              ${base_price},
              'pending'
            )
          `;
          inserted++;
        } catch (err) {
          console.error(`Failed to insert player ${player.name}:`, err.message);
        }
      }
      
      console.log(`   Inserted ${Math.min(i + batchSize, eligiblePlayers.length)}/${eligiblePlayers.length} players...`);
    }
    
    console.log(`\n✅ Successfully inserted ${inserted} players into bulk round ${nextRoundNumber}`);
    console.log(`\n🎉 Bulk round created successfully!`);
    console.log(`   Round ID: ${roundId}`);
    console.log(`   Round Number: ${nextRoundNumber}`);
    console.log(`   Players: ${inserted}`);
    console.log(`   View at: /dashboard/committee/bulk-rounds/${roundId}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixBulkRound();
