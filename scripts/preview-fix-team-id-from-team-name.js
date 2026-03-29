const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function previewTeamIdFix() {
  try {
    console.log('🔍 Checking realplayerstats table for missing team_id...\n');

    // Find all records in realplayerstats that are missing team_id but have team name
    const missingTeamId = await sql`
      SELECT 
        id,
        player_id,
        player_name,
        season_id,
        team,
        team_id,
        matches_played,
        points
      FROM realplayerstats
      WHERE (team_id IS NULL OR team_id = '')
        AND team IS NOT NULL 
        AND team != ''
      ORDER BY season_id DESC, player_name
    `;

    console.log(`📊 Found ${missingTeamId.length} records with missing team_id but have team name\n`);

    if (missingTeamId.length === 0) {
      console.log('✅ All records have team_id! No fixes needed.');
      return;
    }

    // Get all teams to create a lookup map
    console.log('🔎 Loading teams table for team_id lookup...\n');
    
    const teams = await sql`
      SELECT id, name, season_id
      FROM teams
      ORDER BY season_id, name
    `;

    console.log(`📋 Found ${teams.length} teams in teams table\n`);

    // Create a lookup map: season_id + team_name -> team_id
    const teamLookup = {};
    teams.forEach(team => {
      const key = `${team.season_id}|${team.name}`;
      teamLookup[key] = team.id;
    });

    // For each missing record, find the correct team_id
    const fixes = [];
    let foundCount = 0;
    let notFoundCount = 0;

    for (const record of missingTeamId) {
      const lookupKey = `${record.season_id}|${record.team}`;
      const correctTeamId = teamLookup[lookupKey];

      if (correctTeamId) {
        foundCount++;
        fixes.push({
          id: record.id,
          player_id: record.player_id,
          player_name: record.player_name,
          season_id: record.season_id,
          team_name: record.team,
          current_team_id: record.team_id || '(null)',
          correct_team_id: correctTeamId,
          matches_played: record.matches_played,
          points: record.points
        });
      } else {
        notFoundCount++;
        fixes.push({
          id: record.id,
          player_id: record.player_id,
          player_name: record.player_name,
          season_id: record.season_id,
          team_name: record.team,
          current_team_id: record.team_id || '(null)',
          correct_team_id: '❌ NOT FOUND',
          matches_played: record.matches_played,
          points: record.points
        });
      }
    }

    // Display summary
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                        SUMMARY                                ');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Total records missing team_id: ${missingTeamId.length}`);
    console.log(`Can be fixed (found in teams table): ${foundCount}`);
    console.log(`Cannot be fixed (team not in teams table): ${notFoundCount}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Display fixable records
    if (foundCount > 0) {
      console.log('✅ RECORDS THAT CAN BE FIXED:\n');
      console.log('─────────────────────────────────────────────────────────────────');
      
      fixes
        .filter(f => f.correct_team_id !== '❌ NOT FOUND')
        .forEach((fix, index) => {
          console.log(`${index + 1}. ${fix.player_name} (${fix.player_id})`);
          console.log(`   Season: ${fix.season_id}`);
          console.log(`   Team: ${fix.team_name}`);
          console.log(`   Current team_id: ${fix.current_team_id}`);
          console.log(`   Correct team_id: ${fix.correct_team_id}`);
          console.log(`   Stats: ${fix.matches_played} matches, ${fix.points} points`);
          console.log('─────────────────────────────────────────────────────────────────');
        });
    }

    // Display unfixable records
    if (notFoundCount > 0) {
      console.log('\n❌ RECORDS THAT CANNOT BE FIXED (team not in teams table):\n');
      console.log('─────────────────────────────────────────────────────────────────');
      
      fixes
        .filter(f => f.correct_team_id === '❌ NOT FOUND')
        .forEach((fix, index) => {
          console.log(`${index + 1}. ${fix.player_name} (${fix.player_id})`);
          console.log(`   Season: ${fix.season_id}`);
          console.log(`   Team: ${fix.team_name}`);
          console.log(`   Stats: ${fix.matches_played} matches, ${fix.points} points`);
          console.log('   ⚠️  Team not found in teams table for this season');
          console.log('─────────────────────────────────────────────────────────────────');
        });
    }

    // Show SQL preview for the fix
    if (foundCount > 0) {
      console.log('\n📝 SQL PREVIEW (what will be executed):\n');
      console.log('UPDATE realplayerstats');
      console.log('SET team_id = CASE');
      
      fixes
        .filter(f => f.correct_team_id !== '❌ NOT FOUND')
        .slice(0, 5) // Show first 5 as example
        .forEach(fix => {
          console.log(`  WHEN id = '${fix.id}' THEN '${fix.correct_team_id}'`);
        });
      
      if (foundCount > 5) {
        console.log(`  ... (${foundCount - 5} more cases)`);
      }
      
      console.log('END');
      console.log('WHERE id IN (\'' + fixes.filter(f => f.correct_team_id !== '❌ NOT FOUND').map(f => f.id).slice(0, 5).join('\', \'') + '\'' + (foundCount > 5 ? ', ...' : '') + ');');
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('                    PREVIEW COMPLETE                           ');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\n💡 To apply these fixes, run: node scripts/fix-realplayerstats-team-id.js');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

previewTeamIdFix();
