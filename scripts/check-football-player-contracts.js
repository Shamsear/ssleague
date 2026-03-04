const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function checkFootballPlayerContracts() {
  const teamId = 'SSPSLT0016';
  
  console.log(`\n🔍 Checking football player contracts for team: ${teamId}\n`);
  
  try {
    const auctionSql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);
    
    // First, check the schema of footballplayers table
    console.log('📋 Checking footballplayers table schema...');
    const schemaQuery = await auctionSql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'footballplayers'
      ORDER BY ordinal_position
    `;
    
    console.log('\nColumns in footballplayers table:');
    schemaQuery.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });
    
    // Check if there are contract-related columns
    const hasContractColumns = schemaQuery.some(col => 
      col.column_name.includes('contract') || 
      col.column_name.includes('season')
    );
    
    if (hasContractColumns) {
      console.log('\n✅ Found contract/season related columns');
    }
    
    // Check team_players for season 16
    console.log('\n📋 Checking team_players for SSPSLS16...');
    const s16Players = await auctionSql`
      SELECT 
        tp.player_id,
        tp.season_id,
        tp.purchase_price,
        tp.round_id,
        fp.name,
        fp.position,
        fp.contract_length,
        fp.contract_start_season,
        fp.contract_end_season
      FROM team_players tp
      LEFT JOIN footballplayers fp ON tp.player_id = fp.id AND tp.season_id = fp.season_id
      WHERE tp.team_id = ${teamId}
        AND tp.season_id = 'SSPSLS16'
      LIMIT 5
    `;
    
    console.log(`\nFound ${s16Players.length} players (showing first 5):`);
    s16Players.forEach((p, i) => {
      console.log(`\n  ${i + 1}. ${p.name || 'Unknown'} (${p.position || 'N/A'})`);
      console.log(`     Player ID: ${p.player_id}`);
      console.log(`     Season: ${p.season_id}`);
      console.log(`     Price: ${p.purchase_price}`);
      console.log(`     Contract Length: ${p.contract_length || 'N/A'}`);
      console.log(`     Contract Start: ${p.contract_start_season || 'N/A'}`);
      console.log(`     Contract End: ${p.contract_end_season || 'N/A'}`);
    });
    
    // Check if any players have contract info
    const playersWithContracts = s16Players.filter(p => p.contract_length || p.contract_end_season);
    if (playersWithContracts.length > 0) {
      console.log(`\n✅ ${playersWithContracts.length} players have contract information`);
    } else {
      console.log(`\n⚠️  No players have contract information in the footballplayers table`);
    }
    
    // Check footballplayers table directly for this team
    console.log('\n📋 Checking footballplayers table directly...');
    const directQuery = await auctionSql`
      SELECT 
        id,
        player_id,
        name,
        position,
        season_id,
        team_id,
        contract_length,
        contract_start_season,
        contract_end_season
      FROM footballplayers
      WHERE team_id = ${teamId}
      ORDER BY season_id, name
      LIMIT 10
    `;
    
    console.log(`\nFound ${directQuery.length} records (showing first 10):`);
    const bySeason = {};
    directQuery.forEach(p => {
      if (!bySeason[p.season_id]) bySeason[p.season_id] = [];
      bySeason[p.season_id].push(p);
    });
    
    Object.entries(bySeason).forEach(([season, players]) => {
      console.log(`\n  Season ${season}: ${players.length} players`);
      players.slice(0, 2).forEach(p => {
        console.log(`    - ${p.name} (Contract: ${p.contract_length || 'N/A'})`);
      });
    });
    
    // Check if there are S17 entries
    const s17Count = await auctionSql`
      SELECT COUNT(*) as count
      FROM footballplayers
      WHERE team_id = ${teamId}
        AND season_id = 'SSPSLS17'
    `;
    
    console.log(`\n🔍 Season 17 check:`);
    console.log(`  Players in SSPSLS17: ${s17Count[0].count}`);
    
    if (s17Count[0].count === 0) {
      console.log(`\n⚠️  ISSUE: No football players exist for this team in SSPSLS17`);
      console.log(`  💡 Solution: Need to copy/extend contracts from SSPSLS16 to SSPSLS17`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

checkFootballPlayerContracts();
