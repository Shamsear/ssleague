const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function recalculateFantasySquadPoints() {
  const sql = neon(process.env.FANTASY_DATABASE_URL || process.env.DATABASE_URL);

  try {
    console.log('🔄 Recalculating fantasy_squad player total_points...\n');

    // Get all players in fantasy squads
    const squadPlayers = await sql`
      SELECT 
        fs.squad_id,
        fs.team_id,
        fs.real_player_id,
        fs.player_name,
        fs.total_points as old_total_points
      FROM fantasy_squad fs
      ORDER BY fs.team_id, fs.player_name
    `;

    console.log(`Found ${squadPlayers.length} players in fantasy squads\n`);

    const updates = [];
    let updatedCount = 0;

    for (const player of squadPlayers) {
      // Calculate total points from fantasy_player_points
      const pointsResult = await sql`
        SELECT COALESCE(SUM(total_points), 0) as calculated_total
        FROM fantasy_player_points
        WHERE team_id = ${player.team_id}
          AND real_player_id = ${player.real_player_id}
      `;

      const calculatedTotal = Number(pointsResult[0].calculated_total);
      const oldTotal = Number(player.old_total_points) || 0;

      // Update the player's total_points in fantasy_squad
      await sql`
        UPDATE fantasy_squad
        SET total_points = ${calculatedTotal}
        WHERE squad_id = ${player.squad_id}
      `;

      const difference = calculatedTotal - oldTotal;
      
      if (difference !== 0) {
        updatedCount++;
        const status = difference > 0 ? '↑' : '↓';
        console.log(`${status} ${player.player_name}: ${oldTotal} → ${calculatedTotal} (${difference >= 0 ? '+' : ''}${difference})`);
        
        updates.push({
          player: player.player_name,
          old: oldTotal,
          new: calculatedTotal,
          diff: difference
        });
      }
    }

    console.log('\n📊 Summary:');
    console.log(`Total players processed: ${squadPlayers.length}`);
    console.log(`Players with changes: ${updatedCount}`);
    console.log(`Total points added: ${updates.reduce((sum, u) => sum + (u.diff > 0 ? u.diff : 0), 0)}`);
    console.log(`Total points removed: ${updates.reduce((sum, u) => sum + (u.diff < 0 ? Math.abs(u.diff) : 0), 0)}`);

    // Show top 10 players by points
    console.log('\n🏆 Top 10 Players by Points:');
    const topPlayers = await sql`
      SELECT 
        fs.player_name,
        fs.total_points,
        ft.team_name,
        fs.is_captain,
        fs.is_vice_captain
      FROM fantasy_squad fs
      JOIN fantasy_teams ft ON fs.team_id = ft.team_id
      ORDER BY fs.total_points DESC
      LIMIT 10
    `;
    console.table(topPlayers);

    console.log('\n✅ Recalculation complete!');

  } catch (error) {
    console.error('❌ Error recalculating points:', error);
    process.exit(1);
  }
}

recalculateFantasySquadPoints();
