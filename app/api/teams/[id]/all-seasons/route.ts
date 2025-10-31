import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { adminDb } from '@/lib/firebase/admin';

const sql = process.env.NEON_TOURNAMENT_DB_URL ? neon(process.env.NEON_TOURNAMENT_DB_URL) : null;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: teamId } = await context.params;

    if (!sql) {
      return NextResponse.json({
        success: false,
        error: 'Database not configured'
      }, { status: 500 });
    }

    // Fetch team info from Firebase for logo
    let logoUrl = null;
    try {
      const teamDoc = await adminDb.collection('teams').doc(teamId).get();
      if (teamDoc.exists) {
        logoUrl = teamDoc.data()?.logo_url || null;
      }
    } catch (error) {
      console.error('Error fetching team from Firebase:', error);
    }

    // Fetch team name from Neon
    const teamInfo = await sql`
      SELECT team_name
      FROM teamstats
      WHERE team_id = ${teamId}
      LIMIT 1
    `;

    const teamName = teamInfo.length > 0 ? teamInfo[0].team_name : teamId;

    // Fetch all seasons for this team from Neon
    const seasonStats = await sql`
      SELECT 
        team_id,
        season_id,
        matches_played,
        wins,
        draws,
        losses,
        goals_for,
        goals_against,
        goal_difference,
        points,
        position
      FROM teamstats
      WHERE team_id = ${teamId}
      ORDER BY season_id DESC
    `;

    if (!seasonStats || seasonStats.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No team data found'
      }, { status: 404 });
    }

    const seasons: any[] = [];

    // Process each season
    for (const seasonData of seasonStats) {
      const seasonId = seasonData.season_id;

      // Fetch players for this team and season
      let players: any[] = [];
      try {
        const neonPlayers = await sql`
          SELECT 
            player_id,
            player_name,
            matches_played,
            goals_scored,
            assists,
            clean_sheets,
            points,
            category
          FROM realplayerstats
          WHERE team_id = ${teamId} AND season_id = ${seasonId}
          ORDER BY points DESC
        `;

        players = neonPlayers.map((player: any) => ({
          player_id: player.player_id,
          player_name: player.player_name,
          matches_played: player.matches_played || 0,
          goals: player.goals_scored || 0,
          assists: player.assists || 0,
          clean_sheets: player.clean_sheets || 0,
          points: player.points || 0,
          category: player.category
        }));
      } catch (error) {
        console.error('Error fetching players:', error);
      }

      // Fetch trophies for this team and season
      let trophies: any[] = [];
      try {
        const neonTrophies = await sql`
          SELECT 
            id,
            trophy_name,
            trophy_type,
            position,
            trophy_position,
            notes
          FROM team_trophies
          WHERE team_id = ${teamId} AND season_id = ${seasonId}
          ORDER BY id DESC
        `;

        trophies = neonTrophies.map((trophy: any) => ({
          id: trophy.id,
          trophy_name: trophy.trophy_name,
          trophy_type: trophy.trophy_type,
          position: trophy.position,
          trophy_position: trophy.trophy_position,
          notes: trophy.notes
        }));
      } catch (error) {
        console.error('Error fetching trophies:', error);
      }

      seasons.push({
        id: `${teamId}_${seasonId}`,
        team_id: teamId,
        team_name: teamName,
        team_code: teamId,
        season_id: seasonId,
        season_name: seasonId,
        logo_url: logoUrl,
        stats: {
          matches_played: seasonData.matches_played || 0,
          wins: seasonData.wins || 0,
          draws: seasonData.draws || 0,
          losses: seasonData.losses || 0,
          goals_for: seasonData.goals_for || 0,
          goals_against: seasonData.goals_against || 0,
          goal_difference: seasonData.goal_difference || 0,
          points: seasonData.points || 0,
          clean_sheets: 0,
          position: seasonData.position,
          form: null
        },
        players,
        trophies
      });
    }

    if (seasons.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No team data found'
      }, { status: 404 });
    }

    // Sort by most recent season first
    seasons.sort((a, b) => b.season_name.localeCompare(a.season_name));

    return NextResponse.json({
      success: true,
      seasons
    });
  } catch (error) {
    console.error('Error fetching team seasons:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch team data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
