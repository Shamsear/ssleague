import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * GET /api/teams/[id]/real-players
 * Fetch all real players for a specific team across all seasons
 * Handles both modern (S16+) and historical (S15 and below) data
 * 
 * Query params:
 * - seasonId (optional): Filter by specific season
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: teamId } = await params;
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId');

    const sql = getTournamentDb();

    // Determine if we need to query modern or historical tables
    let modernPlayers: any[] = [];
    let historicalPlayers: any[] = [];

    if (seasonId) {
      // Extract season number to determine which table to query
      const seasonNum = parseInt(seasonId.match(/\d+/)?.[0] || '0');

      if (seasonNum >= 16) {
        // Season 16+: Query player_seasons table
        modernPlayers = await sql`
          SELECT 
            player_id,
            player_name,
            team_id,
            team as team_name,
            season_id,
            category,
            star_rating,
            matches_played,
            goals_scored,
            assists,
            wins,
            draws,
            losses,
            clean_sheets,
            motm_awards,
            points,
            registration_status,
            registration_date,
            contract_id,
            contract_start_season,
            contract_end_season
          FROM player_seasons
          WHERE team_id = ${teamId}
            AND season_id = ${seasonId}
          ORDER BY points DESC, player_name ASC
        `;
      } else {
        // Season 1-15: Query realplayerstats table
        // First, get the team name from teamstats for this season
        // This is needed because some historical data has NULL team_id but valid team names
        const teamInfo = await sql`
          SELECT team_name
          FROM teamstats
          WHERE team_id = ${teamId} AND season_id = ${seasonId}
          LIMIT 1
        `;

        const teamName = teamInfo.length > 0 ? teamInfo[0].team_name : null;
        // Query realplayerstats matching either team_id OR team name
        // This handles cases where team_id might be NULL but team name is present
        historicalPlayers = await sql`
          SELECT 
            player_id,
            player_name,
            team_id,
            team as team_name,
            season_id,
            category,
            star_rating,
            matches_played,
            goals_scored,
            assists,
            wins,
            draws,
            losses,
            clean_sheets,
            motm_awards,
            points
          FROM realplayerstats
          WHERE season_id = ${seasonId}
            AND (
              team_id = ${teamId}
              ${teamName ? sql`OR team = ${teamName}` : sql``}
            )
          ORDER BY points DESC, player_name ASC
        `;
      }
    } else {
      // Fetch from both tables for all seasons
      [modernPlayers, historicalPlayers] = await Promise.all([
        // Modern seasons (16+)
        sql`
          SELECT 
            player_id,
            player_name,
            team_id,
            team as team_name,
            season_id,
            category,
            star_rating,
            matches_played,
            goals_scored,
            assists,
            wins,
            draws,
            losses,
            clean_sheets,
            motm_awards,
            points,
            registration_status,
            registration_date,
            contract_id,
            contract_start_season,
            contract_end_season,
            'modern' as data_source
          FROM player_seasons
          WHERE team_id = ${teamId}
          ORDER BY season_id DESC, points DESC, player_name ASC
        `,
        // Historical seasons (1-15)
        // Use LEFT JOIN with teamstats to match by team name when team_id is NULL
        sql`
          SELECT DISTINCT
            rps.player_id,
            rps.player_name,
            rps.team_id,
            rps.team as team_name,
            rps.season_id,
            rps.category,
            rps.star_rating,
            rps.matches_played,
            rps.goals_scored,
            rps.assists,
            rps.wins,
            rps.draws,
            rps.losses,
            rps.clean_sheets,
            rps.motm_awards,
            rps.points,
            'historical' as data_source
          FROM realplayerstats rps
          LEFT JOIN teamstats ts ON rps.season_id = ts.season_id AND rps.team = ts.team_name
          WHERE rps.team_id = ${teamId} OR ts.team_id = ${teamId}
          ORDER BY rps.season_id DESC, rps.points DESC, rps.player_name ASC
        `
      ]);
    }

    // Combine results
    const allPlayers = [...modernPlayers, ...historicalPlayers];

    // Calculate statistics
    const totalPlayers = allPlayers.length;
    const totalGoals = allPlayers.reduce((sum, p) => sum + (p.goals_scored || 0), 0);
    const totalAssists = allPlayers.reduce((sum, p) => sum + (p.assists || 0), 0);
    const totalPoints = allPlayers.reduce((sum, p) => sum + (p.points || 0), 0);
    const totalMatches = allPlayers.reduce((sum, p) => sum + (p.matches_played || 0), 0);

    // Category breakdown
    const categoryBreakdown = allPlayers.reduce((acc, p) => {
      const cat = p.category || 'Unknown';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Season breakdown
    const seasonBreakdown = allPlayers.reduce((acc, p) => {
      const season = p.season_id || 'Unknown';
      if (!acc[season]) {
        acc[season] = {
          count: 0,
          goals: 0,
          assists: 0,
          points: 0
        };
      }
      acc[season].count++;
      acc[season].goals += p.goals_scored || 0;
      acc[season].assists += p.assists || 0;
      acc[season].points += p.points || 0;
      return acc;
    }, {} as Record<string, any>);

    return NextResponse.json({
      success: true,
      data: {
        players: allPlayers,
        count: totalPlayers,
        statistics: {
          total_players: totalPlayers,
          total_goals: totalGoals,
          total_assists: totalAssists,
          total_points: totalPoints,
          total_matches: totalMatches,
          avg_goals_per_player: totalPlayers > 0 ? (totalGoals / totalPlayers).toFixed(2) : 0,
          avg_points_per_player: totalPlayers > 0 ? (totalPoints / totalPlayers).toFixed(2) : 0,
          category_breakdown: categoryBreakdown,
          season_breakdown: seasonBreakdown,
        },
      },
      message: 'Real players fetched successfully'
    });

  } catch (error: any) {
    console.error('Error fetching team real players:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch team real players'
      },
      { status: 500 }
    );
  }
}
