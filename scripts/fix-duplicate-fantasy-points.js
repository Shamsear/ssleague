/**
 * Fix Duplicate Fantasy Player Points
 * Removes duplicate records and recalculates totals
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function fixDuplicateFantasyPoints() {
  const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);

  console.log('🔧 Fixing Duplicate Fantasy Player Points...\n');

  try {
    // Find all duplicates
    const duplicates = await fantasyDb`
      SELECT 
        team_id,
        real_player_id,
        fixture_id,
        COUNT(*) as count,
        MIN(id) as keep_id
      FROM fantasy_player_points
      GROUP BY team_id, real_player_id, fixture_id
      HAVING COUNT(*) > 1
    `;

    console.log(`Found ${duplicates.length} sets of duplicates\n`);

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!');
      return;
    }

    let totalDeleted = 0;

    for (const dup of duplicates) {
      console.log(`Fixing: Team ${dup.team_id}, Player ${dup.real_player_id}, Fixture ${dup.fixture_id}`);
      console.log(`  Found ${dup.count} records, keeping ID ${dup.keep_id}`);

      // Delete all except the one we want to keep
      const deleted = await fantasyDb`
        DELETE FROM fantasy_player_points
        WHERE team_id = ${dup.team_id}
          AND real_player_id = ${dup.real_player_id}
          AND fixture_id = ${dup.fixture_id}
          AND id != ${dup.keep_id}
      `;

      const deletedCount = dup.count - 1;
      totalDeleted += deletedCount;
      console.log(`  ✓ Deleted ${deletedCount} duplicate(s)\n`);
    }

    console.log(`\n📊 Total duplicates removed: ${totalDeleted}\n`);

    // Now recalculate squad totals
    console.log('🔄 Recalculating squad player totals...\n');

    const squadPlayers = await fantasyDb`
      SELECT squad_id, team_id, real_player_id, player_name
      FROM fantasy_squad
    `;

    let updatedCount = 0;

    for (const player of squadPlayers) {
      const pointsResult = await fantasyDb`
        SELECT COALESCE(SUM(total_points), 0) as calculated_total
        FROM fantasy_player_points
        WHERE team_id = ${player.team_id}
          AND real_player_id = ${player.real_player_id}
      `;

      const newTotal = Number(pointsResult[0].calculated_total);

      await fantasyDb`
        UPDATE fantasy_squad
        SET total_points = ${newTotal}
        WHERE squad_id = ${player.squad_id}
      `;

      updatedCount++;
    }

    console.log(`✅ Updated ${updatedCount} squad player totals\n`);

    // Recalculate team totals
    console.log('🔄 Recalculating team totals...\n');

    const teams = await fantasyDb`
      SELECT team_id, team_name
      FROM fantasy_teams
    `;

    for (const team of teams) {
      const pointsResult = await fantasyDb`
        SELECT COALESCE(SUM(total_points), 0) as player_points
        FROM fantasy_player_points
        WHERE team_id = ${team.team_id}
      `;

      const teamInfo = await fantasyDb`
        SELECT COALESCE(passive_points, 0) as passive_points
        FROM fantasy_teams
        WHERE team_id = ${team.team_id}
      `;

      const playerPoints = Number(pointsResult[0].player_points);
      const passivePoints = Number(teamInfo[0].passive_points);
      const totalPoints = playerPoints + passivePoints;

      await fantasyDb`
        UPDATE fantasy_teams
        SET 
          player_points = ${playerPoints},
          total_points = ${totalPoints},
          updated_at = NOW()
        WHERE team_id = ${team.team_id}
      `;

      console.log(`  ${team.team_name}: ${totalPoints} pts (Player: ${playerPoints}, Passive: ${passivePoints})`);
    }

    // Recalculate ranks
    console.log('\n🏆 Recalculating ranks...\n');

    const leagues = await fantasyDb`
      SELECT DISTINCT league_id FROM fantasy_teams
    `;

    for (const league of leagues) {
      await fantasyDb`
        WITH ranked_teams AS (
          SELECT 
            team_id,
            ROW_NUMBER() OVER (ORDER BY total_points DESC, team_name ASC) as new_rank
          FROM fantasy_teams
          WHERE league_id = ${league.league_id}
        )
        UPDATE fantasy_teams ft
        SET rank = rt.new_rank
        FROM ranked_teams rt
        WHERE ft.team_id = rt.team_id
      `;
    }

    console.log('✅ Ranks updated\n');

    // Show final standings
    console.log('🏆 Final Standings:\n');
    const topTeams = await fantasyDb`
      SELECT rank, team_name, total_points, player_points, passive_points
      FROM fantasy_teams
      ORDER BY rank ASC
      LIMIT 10
    `;

    topTeams.forEach(team => {
      console.log(`  ${team.rank}. ${team.team_name}: ${team.total_points} pts (Player: ${team.player_points}, Passive: ${team.passive_points})`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

fixDuplicateFantasyPoints()
  .then(() => {
    console.log('\n✅ Fix complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fix failed:', error);
    process.exit(1);
  });
