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
        const teamData = teamDoc.data();
        logoUrl = teamData?.logo_url || null;

        // Fallback to users collection if no logo in teams
        if (!logoUrl && teamData?.user_id) {
          try {
            const userDoc = await adminDb.collection('users').doc(teamData.user_id).get();
            if (userDoc.exists) {
              logoUrl = userDoc.data()?.logoUrl || null;
            }
          } catch (userError) {
            console.error('Error fetching user for logo fallback:', userError);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching team from Firebase:', error);
    }

    // Fetch active seasons from Firebase to know which seasons have actually started
    const firebaseSeasons = await adminDb.collection('seasons').get();
    const activeSeasonIds = new Set();
    const seasonStatuses: Record<string, { is_active: boolean; status: string }> = {};

    firebaseSeasons.docs.forEach(doc => {
      const data = doc.data();
      seasonStatuses[doc.id] = {
        is_active: data.is_active === true,
        status: data.status
      };

      // Check if season has actually started
      let hasStarted = false;
      if (data.start_date) {
        const startDate = data.start_date.toDate ? data.start_date.toDate() : new Date(data.start_date);
        const now = new Date();
        hasStarted = startDate <= now;
      } else {
        // If no start_date, check status (backward compatibility)
        hasStarted = data.status === 'completed' || data.status === 'active';
      }

      // Include seasons that have started (based on start_date or status)
      if (hasStarted) {
        activeSeasonIds.add(doc.id);
      }
    });

    // Fetch all seasons for this team from Neon
    // NOTE: team_name is fetched per season to get historical team names
    // (e.g., "Hooligans" for S11, "Skill 555" for S12+)
    // Aggregate across all tournaments per season
    const seasonStats = await sql`
      SELECT 
        team_id,
        MAX(team_name) as team_name,
        season_id,
        SUM(matches_played) as matches_played,
        SUM(wins) as wins,
        SUM(draws) as draws,
        SUM(losses) as losses,
        SUM(goals_for) as goals_for,
        SUM(goals_against) as goals_against,
        SUM(goal_difference) as goal_difference,
        SUM(points) as points,
        MAX(position) as position
      FROM teamstats
      WHERE team_id = ${teamId}
      GROUP BY team_id, season_id
      ORDER BY season_id DESC
    `;

    if (!seasonStats || seasonStats.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No team data found'
      }, { status: 404 });
    }

    const seasons: any[] = [];

    // Process each season (only those that have started)
    for (const seasonData of seasonStats) {
      const seasonId = seasonData.season_id;

      // Skip seasons that haven't started yet (future contract seasons)
      if (!activeSeasonIds.has(seasonId)) {
        console.log(`Skipping future season ${seasonId} for team ${teamId}`);
        continue;
      }

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
        team_name: seasonData.team_name || teamId,
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
