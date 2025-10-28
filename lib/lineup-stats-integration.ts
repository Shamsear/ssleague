import { getTournamentDb } from '@/lib/neon/tournament-config';

const sql = getTournamentDb();

/**
 * Record player participation based on lineup when match results are submitted
 * Updates realplayerstats with participation_type and match_played
 */
export async function recordPlayerParticipation(fixtureId: string) {
  try {
    // Get both team lineups for this fixture
    const lineups = await sql`
      SELECT id, team_id, starting_xi, substitutes
      FROM lineups
      WHERE fixture_id = ${fixtureId}
    `;

    if (!lineups || lineups.length === 0) {
      console.log(`No lineups found for fixture ${fixtureId}`);
      return { success: true, message: 'No lineups to process' };
    }

    let processedCount = 0;

    for (const lineup of lineups) {
      const lineupId = lineup.id;
      const teamId = lineup.team_id;
      const startingXI = lineup.starting_xi || [];
      const substitutes = lineup.substitutes || [];

      // Get all substitutions for this lineup
      const substitutions = await sql`
        SELECT player_out, player_in
        FROM lineup_substitutions
        WHERE lineup_id = ${lineupId}
        ORDER BY made_at ASC
      `;

      // Track which players actually played
      const playedPlayers = new Set<string>(startingXI);
      const subbedOutPlayers = new Set<string>();
      const subbedInPlayers = new Set<string>();

      // Process substitutions
      for (const sub of substitutions) {
        subbedOutPlayers.add(sub.player_out);
        subbedInPlayers.add(sub.player_in);
        playedPlayers.delete(sub.player_out); // Remove subbed out player
        playedPlayers.add(sub.player_in); // Add subbed in player
      }

      // Update participation for starting XI
      for (const playerId of startingXI) {
        const participationType = subbedOutPlayers.has(playerId) ? 'subbed_out' : 'started';
        const matchPlayed = !subbedOutPlayers.has(playerId); // Only counts if not subbed out

        await sql`
          UPDATE realplayerstats
          SET 
            participation_type = ${participationType},
            match_played = ${matchPlayed},
            lineup_id = ${lineupId}
          WHERE fixture_id = ${fixtureId}
            AND player_id = ${playerId}
            AND team_id = ${teamId}
        `;
        processedCount++;
      }

      // Update participation for substitutes
      for (const playerId of substitutes) {
        const participationType = subbedInPlayers.has(playerId) ? 'subbed_in' : 'unused_sub';
        const matchPlayed = subbedInPlayers.has(playerId);

        await sql`
          UPDATE realplayerstats
          SET 
            participation_type = ${participationType},
            match_played = ${matchPlayed},
            lineup_id = ${lineupId}
          WHERE fixture_id = ${fixtureId}
            AND player_id = ${playerId}
            AND team_id = ${teamId}
        `;
        processedCount++;
      }
    }

    return {
      success: true,
      message: `Updated participation for ${processedCount} player stats`,
      processed: processedCount
    };
  } catch (error: any) {
    console.error('Error recording player participation:', error);
    return {
      success: false,
      error: error.message || 'Failed to record participation'
    };
  }
}

/**
 * Get participation stats for a fixture
 */
export async function getFixtureParticipation(fixtureId: string) {
  try {
    const stats = await sql`
      SELECT 
        team_id,
        participation_type,
        COUNT(*) as count
      FROM realplayerstats
      WHERE fixture_id = ${fixtureId}
        AND participation_type IS NOT NULL
      GROUP BY team_id, participation_type
      ORDER BY team_id, participation_type
    `;

    return {
      success: true,
      stats
    };
  } catch (error: any) {
    console.error('Error getting participation stats:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
