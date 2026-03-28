require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkTables() {
  const sql = neon(process.env.FANTASY_DATABASE_URL);
  
  const engagementTables = [
    'fixture_difficulty_ratings',
    'fantasy_predictions',
    'fantasy_challenges',
    'fantasy_challenge_completions',
    'fantasy_power_ups',
    'fantasy_power_up_usage',
    'fantasy_h2h_fixtures',
    'fantasy_h2h_standings',
    'fantasy_chat_messages',
    'fantasy_achievements',
    'fantasy_team_achievements'
  ];
  
  console.log('Checking for engagement tables in FANTASY database:\n');
  
  for (const tableName of engagementTables) {
    const result = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = ${tableName}
      )
    `;
    
    const exists = result[0].exists;
    console.log(`${exists ? '✅' : '❌'} ${tableName}`);
  }
  
  // Check columns added to fantasy_players
  console.log('\nChecking columns added to fantasy_players:');
  const playerCols = ['form_status', 'form_streak', 'last_5_games_avg', 'form_multiplier', 'games_played', 'ownership_percentage'];
  
  for (const colName of playerCols) {
    const result = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'fantasy_players' 
        AND column_name = ${colName}
      )
    `;
    
    const exists = result[0].exists;
    console.log(`${exists ? '✅' : '❌'} ${colName}`);
  }
  
  // Check columns added to fantasy_teams
  console.log('\nChecking columns added to fantasy_teams:');
  const teamCols = ['auto_sub_enabled', 'bench_priority'];
  
  for (const colName of teamCols) {
    const result = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'fantasy_teams' 
        AND column_name = ${colName}
      )
    `;
    
    const exists = result[0].exists;
    console.log(`${exists ? '✅' : '❌'} ${colName}`);
  }
}

checkTables().catch(console.error);
