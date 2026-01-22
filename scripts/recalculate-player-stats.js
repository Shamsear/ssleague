/**
 * Recalculate Player Stats from Matchups
 * 
 * This script recalculates all player_seasons stats from matchup data
 * and updates the database with correct values.
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function recalculatePlayerStats() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

  const SEASON_ID = 'SSPSLS16'; // Only recalculate this season

  console.log(`🔄 Starting Player Stats Recalculation for Season: ${SEASON_ID}\n`);

  try {
    // Get all active player_seasons for SSPSLS16
    const playerSeasons = await sql`
      SELECT 
        player_id,
        season_id,
        team_id,
        player_name
      FROM player_seasons
      WHERE status = 'active'
        AND season_id = ${SEASON_ID}
      ORDER BY team_id, player_name
    `;

    console.log(`📊 Found ${playerSeasons.length} active player seasons to recalculate\n`);

    let updated = 0;
    let unchanged = 0;
    let errors = 0;

    for (const player of playerSeasons) {
      try {
        // Calculate stats from matchups
        const result = await sql`
          WITH home_matches AS (
            SELECT 
              m.home_player_id as player_id,
              m.season_id,
              COUNT(*) as matches,
              SUM(CASE WHEN m.home_goals > m.away_goals THEN 1 ELSE 0 END) as wins,
              SUM(CASE WHEN m.home_goals = m.away_goals THEN 1 ELSE 0 END) as draws,
              SUM(CASE WHEN m.home_goals < m.away_goals THEN 1 ELSE 0 END) as losses,
              SUM(COALESCE(m.home_goals, 0)) as goals_scored,
              SUM(COALESCE(m.away_goals, 0)) as goals_conceded,
              SUM(CASE WHEN COALESCE(m.away_goals, 0) = 0 THEN 1 ELSE 0 END) as clean_sheets
            FROM matchups m
            WHERE m.home_player_id = ${player.player_id}
              AND m.season_id = ${player.season_id}
              AND m.home_goals IS NOT NULL
              AND m.away_goals IS NOT NULL
              AND COALESCE(m.is_null, false) = false
            GROUP BY m.home_player_id, m.season_id
          ),
          away_matches AS (
            SELECT 
              m.away_player_id as player_id,
              m.season_id,
              COUNT(*) as matches,
              SUM(CASE WHEN m.away_goals > m.home_goals THEN 1 ELSE 0 END) as wins,
              SUM(CASE WHEN m.away_goals = m.home_goals THEN 1 ELSE 0 END) as draws,
              SUM(CASE WHEN m.away_goals < m.home_goals THEN 1 ELSE 0 END) as losses,
              SUM(COALESCE(m.away_goals, 0)) as goals_scored,
              SUM(COALESCE(m.home_goals, 0)) as goals_conceded,
              SUM(CASE WHEN COALESCE(m.home_goals, 0) = 0 THEN 1 ELSE 0 END) as clean_sheets
            FROM matchups m
            WHERE m.away_player_id = ${player.player_id}
              AND m.season_id = ${player.season_id}
              AND m.home_goals IS NOT NULL
              AND m.away_goals IS NOT NULL
              AND COALESCE(m.is_null, false) = false
            GROUP BY m.away_player_id, m.season_id
          ),
          motm_count AS (
            SELECT 
              f.motm_player_id as player_id,
              f.season_id,
              COUNT(*) as motm
            FROM fixtures f
            WHERE f.motm_player_id = ${player.player_id}
              AND f.season_id = ${player.season_id}
            GROUP BY f.motm_player_id, f.season_id
          )
          UPDATE player_seasons
          SET 
            matches_played = COALESCE((SELECT h.matches FROM home_matches h), 0) + 
                           COALESCE((SELECT a.matches FROM away_matches a), 0),
            wins = COALESCE((SELECT h.wins FROM home_matches h), 0) + 
                  COALESCE((SELECT a.wins FROM away_matches a), 0),
            draws = COALESCE((SELECT h.draws FROM home_matches h), 0) + 
                   COALESCE((SELECT a.draws FROM away_matches a), 0),
            losses = COALESCE((SELECT h.losses FROM home_matches h), 0) + 
                    COALESCE((SELECT a.losses FROM away_matches a), 0),
            goals_scored = COALESCE((SELECT h.goals_scored FROM home_matches h), 0) + 
                          COALESCE((SELECT a.goals_scored FROM away_matches a), 0),
            goals_conceded = COALESCE((SELECT h.goals_conceded FROM home_matches h), 0) + 
                            COALESCE((SELECT a.goals_conceded FROM away_matches a), 0),
            clean_sheets = COALESCE((SELECT h.clean_sheets FROM home_matches h), 0) + 
                          COALESCE((SELECT a.clean_sheets FROM away_matches a), 0),
            motm_awards = COALESCE((SELECT m.motm FROM motm_count m), 0),
            updated_at = NOW()
          WHERE player_id = ${player.player_id}
            AND season_id = ${player.season_id}
          RETURNING *
        `;

        if (result.length > 0) {
          updated++;
          if (updated % 10 === 0) {
            console.log(`   ✅ Updated ${updated}/${playerSeasons.length} players...`);
          }
        } else {
          unchanged++;
        }

      } catch (error) {
        errors++;
        console.error(`   ❌ Error updating ${player.player_name}:`, error.message);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('                    RECALCULATION COMPLETE                 ');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log(`✅ Successfully updated: ${updated} players`);
    console.log(`⚪ Unchanged:            ${unchanged} players`);
    console.log(`❌ Errors:               ${errors} players\n`);

    if (errors > 0) {
      console.log('⚠️  Some players had errors. Check the logs above for details.\n');
    }

  } catch (error) {
    console.error('❌ Error during recalculation:', error);
    throw error;
  }
}

// Run the recalculation
recalculatePlayerStats()
  .then(() => {
    console.log('✅ Recalculation completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Recalculation failed:', error);
    process.exit(1);
  });
