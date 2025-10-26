import { fantasySql } from '../lib/neon/fantasy-config';
import { adminDb } from '../lib/firebase/admin';

async function populateFantasyPlayers() {
  try {
    const leagueId = 'SSPSLFLS16';
    const seasonId = 'SSPSLS16';

    console.log(`Populating fantasy_players for league ${leagueId}...\n`);

    // Get all players from Firestore for this season
    const playersSnapshot = await adminDb
      .collection('players')
      .where('season_id', '==', seasonId)
      .get();

    console.log(`Found ${playersSnapshot.size} players in Firestore for season ${seasonId}\n`);

    let insertedCount = 0;
    let skippedCount = 0;

    for (const doc of playersSnapshot.docs) {
      const playerData = doc.data();
      const playerId = doc.id;

      // Skip if player doesn't have required data
      if (!playerData.name) {
        console.log(`  ⚠️  Skipping ${playerId} - no name`);
        skippedCount++;
        continue;
      }

      try {
        await fantasySql`
          INSERT INTO fantasy_players (
            player_id,
            league_id,
            player_name,
            real_team_id,
            real_team_name,
            position,
            star_rating,
            draft_price,
            is_available
          ) VALUES (
            ${playerId},
            ${leagueId},
            ${playerData.name},
            ${playerData.team_id || ''},
            ${playerData.team_name || ''},
            ${playerData.position || 'Unknown'},
            ${playerData.star_rating || 5},
            ${playerData.star_rating ? (playerData.star_rating >= 3 && playerData.star_rating <= 10 ? 
              [5, 7, 10, 13, 16, 20, 25, 30][playerData.star_rating - 3] : 10) : 10},
            true
          )
          ON CONFLICT (player_id, league_id) DO NOTHING
        `;

        insertedCount++;
        if (insertedCount % 10 === 0) {
          console.log(`  Processed ${insertedCount} players...`);
        }
      } catch (error) {
        console.error(`  ❌ Error inserting ${playerData.name}:`, error);
      }
    }

    console.log(`\n✅ Completed!`);
    console.log(`   Inserted: ${insertedCount}`);
    console.log(`   Skipped: ${skippedCount}`);

    // Verify
    const count = await fantasySql`
      SELECT COUNT(*) as count
      FROM fantasy_players
      WHERE league_id = ${leagueId}
    `;

    console.log(`\n📊 Total fantasy players in database: ${count[0].count}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

populateFantasyPlayers();
