const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function testContractQuery() {
  const teamId = 'SSPSLT0016';
  
  console.log(`\n🧪 Testing contract-aware query for team: ${teamId}\n`);
  
  try {
    const auctionSql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);
    
    // Test for SSPSLS16
    console.log('📋 Testing for SSPSLS16...');
    const s16Results = await auctionSql`
      SELECT 
        tp.player_id,
        tp.purchase_price,
        fp.name,
        fp.position,
        fp.overall_rating,
        fp.team_name as club,
        fp.contract_start_season,
        fp.contract_end_season
      FROM team_players tp
      INNER JOIN footballplayers fp ON tp.player_id = fp.id AND tp.season_id = fp.season_id
      WHERE tp.team_id = ${teamId}
        AND fp.team_id = ${teamId}
        AND (
          fp.season_id = 'SSPSLS16'
          OR (
            fp.contract_start_season <= 'SSPSLS16'
            AND fp.contract_end_season >= 'SSPSLS16'
          )
        )
    `;
    
    console.log(`✅ Found ${s16Results.length} players for SSPSLS16`);
    if (s16Results.length > 0) {
      console.log(`   Sample: ${s16Results[0].name} (Contract: ${s16Results[0].contract_start_season} - ${s16Results[0].contract_end_season})`);
    }
    
    // Test for SSPSLS17
    console.log('\n📋 Testing for SSPSLS17...');
    const s17Results = await auctionSql`
      SELECT 
        tp.player_id,
        tp.purchase_price,
        fp.name,
        fp.position,
        fp.overall_rating,
        fp.team_name as club,
        fp.contract_start_season,
        fp.contract_end_season
      FROM team_players tp
      INNER JOIN footballplayers fp ON tp.player_id = fp.id AND tp.season_id = fp.season_id
      WHERE tp.team_id = ${teamId}
        AND fp.team_id = ${teamId}
        AND (
          fp.season_id = 'SSPSLS17'
          OR (
            fp.contract_start_season <= 'SSPSLS17'
            AND fp.contract_end_season >= 'SSPSLS17'
          )
        )
    `;
    
    console.log(`✅ Found ${s17Results.length} players for SSPSLS17`);
    if (s17Results.length > 0) {
      console.log('\n   First 5 players:');
      s17Results.slice(0, 5).forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name} (${p.position}) - Contract: ${p.contract_start_season} to ${p.contract_end_season}`);
      });
    } else {
      console.log('   ⚠️  No players found - query might need adjustment');
    }
    
    // Test for SSPSLS18 (should return 0)
    console.log('\n📋 Testing for SSPSLS18 (should be 0)...');
    const s18Results = await auctionSql`
      SELECT 
        tp.player_id,
        tp.purchase_price,
        fp.name,
        fp.position,
        fp.overall_rating,
        fp.team_name as club,
        fp.contract_start_season,
        fp.contract_end_season
      FROM team_players tp
      INNER JOIN footballplayers fp ON tp.player_id = fp.id AND tp.season_id = fp.season_id
      WHERE tp.team_id = ${teamId}
        AND fp.team_id = ${teamId}
        AND (
          fp.season_id = 'SSPSLS18'
          OR (
            fp.contract_start_season <= 'SSPSLS18'
            AND fp.contract_end_season >= 'SSPSLS18'
          )
        )
    `;
    
    console.log(`✅ Found ${s18Results.length} players for SSPSLS18 (expected: 0)`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

testContractQuery();
