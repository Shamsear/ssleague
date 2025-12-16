require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function fixPsychozScore() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);
  
  console.log('🔧 Fixing Psychoz fixture score...\n');
  
  // The correct score should be 6-11 (8 match goals + 3 penalty = 11)
  const correctHomeScore = 6;
  const correctAwayScore = 11;
  const correctResult = 'away_win';
  
  await sql`
    UPDATE fixtures
    SET
      home_score = ${correctHomeScore},
      away_score = ${correctAwayScore},
      result = ${correctResult},
      updated_at = NOW()
    WHERE home_team_name = 'Los Galacticos'
      AND away_team_name = 'Psychoz'
      AND season_id = 'SSPSLS16'
  `;
  
  console.log('✅ Fixed Los Galacticos vs Psychoz');
  console.log(`   Corrected score: ${correctHomeScore}-${correctAwayScore}`);
  console.log(`   (8 match goals + 3 penalty goals = 11 total for Psychoz)`);
}

fixPsychozScore()
  .then(() => {
    console.log('\n✅ Done! Now run recalculate-s16-teamstats.js');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
