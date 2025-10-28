import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { tournamentSql as sql } from '@/lib/neon/tournament-config';

// Cache for 5 minutes
export const revalidate = 300;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: teamId } = await params;
    console.log(`[Team Details API] Fetching complete details for team: ${teamId}`);

    // 1. Fetch team basic info from Firebase
    const teamDoc = await adminDb.collection('teams').doc(teamId).get();
    if (!teamDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      );
    }

    const teamData = teamDoc.data();
    const teamInfo = {
      id: teamDoc.id,
      team_id: teamDoc.id,
      team_name: teamData?.team_name || teamData?.name || 'Unknown Team',
      logo_url: teamData?.logoUrl || teamData?.logoURL || teamData?.logo_url || null,
      owner_name: teamData?.owner_name || null,
      balance: teamData?.balance || 0
    };

    // 2. Fetch ALL-TIME aggregated stats from teamstats
    const allTimeStats = await sql`
      SELECT 
        SUM(matches_played) as total_matches,
        SUM(wins) as total_wins,
        SUM(draws) as total_draws,
        SUM(losses) as total_losses,
        SUM(goals_for) as total_goals_scored,
        SUM(goals_against) as total_goals_conceded,
        SUM(points) as total_points
      FROM teamstats
      WHERE team_id = ${teamId}
    `;

    // 3. Fetch SEASON-BY-SEASON breakdown
    const seasonBreakdown = await sql`
      SELECT 
        season_id,
        tournament_id,
        team_name,
        matches_played,
        wins,
        draws,
        losses,
        goals_for,
        goals_against,
        goal_difference,
        points,
        position as rank
      FROM teamstats
      WHERE team_id = ${teamId}
      ORDER BY season_id DESC
    `;

    // 4. Fetch championships/achievements from Firebase seasons
    const seasonsSnapshot = await adminDb.collection('seasons').get();
    const achievements = seasonsSnapshot.docs
      .map(doc => {
        const data = doc.data();
        if (data.champion_team_id === teamId || data.champion_team_name === teamInfo.team_name) {
          return {
            season_id: doc.id,
            season_name: data.name || doc.id,
            achievement: 'Champion',
            type: 'champion'
          };
        }
        if (data.runner_up_team_id === teamId || data.runner_up_team_name === teamInfo.team_name) {
          return {
            season_id: doc.id,
            season_name: data.name || doc.id,
            achievement: 'Runner-up',
            type: 'runner_up'
          };
        }
        return null;
      })
      .filter(Boolean);

    // 5. Fetch ALL players ever associated with the team
    // From player_seasons (season 16+)
    const modernPlayers = await sql`
      SELECT DISTINCT
        player_id,
        player_name,
        category,
        season_id,
        MAX(star_rating) as star_rating,
        SUM(matches_played) as matches_played,
        SUM(goals_scored) as goals_scored,
        SUM(points) as points
      FROM player_seasons
      WHERE team_id = ${teamId}
      GROUP BY player_id, player_name, category, season_id
      ORDER BY season_id DESC, points DESC
    `;

    // From realplayerstats (season 1-15)
    const historicalPlayers = await sql`
      SELECT DISTINCT
        player_id,
        player_name,
        category,
        season_id,
        SUM(matches_played) as matches_played,
        SUM(goals_scored) as goals_scored,
        SUM(points) as points
      FROM realplayerstats
      WHERE team_id = ${teamId}
      GROUP BY player_id, player_name, category, season_id
      ORDER BY season_id DESC, points DESC
    `;

    // Combine and aggregate player stats
    const playerStatsMap = new Map();
    
    [...historicalPlayers, ...modernPlayers].forEach(player => {
      const existing = playerStatsMap.get(player.player_id);
      if (existing) {
        existing.total_matches += parseInt(player.matches_played) || 0;
        existing.total_goals += parseInt(player.goals_scored) || 0;
        existing.total_points += parseInt(player.points) || 0;
        existing.seasons.push(player.season_id);
      } else {
        playerStatsMap.set(player.player_id, {
          player_id: player.player_id,
          player_name: player.player_name,
          category: player.category,
          star_rating: player.star_rating || null,
          total_matches: parseInt(player.matches_played) || 0,
          total_goals: parseInt(player.goals_scored) || 0,
          total_points: parseInt(player.points) || 0,
          seasons: [player.season_id]
        });
      }
    });

    const allPlayers = Array.from(playerStatsMap.values())
      .sort((a, b) => b.total_points - a.total_points);

    // 6. Fetch recent fixtures (limit to last 20)
    const fixtures = await sql`
      SELECT 
        id,
        season_id,
        tournament_id,
        match_day,
        home_team_id,
        away_team_id,
        home_team_name,
        away_team_name,
        home_score,
        away_score,
        status
      FROM fixtures
      WHERE home_team_id = ${teamId} OR away_team_id = ${teamId}
      ORDER BY season_id DESC, match_day DESC
      LIMIT 20
    `;

    return NextResponse.json({
      success: true,
      data: {
        team: teamInfo,
        allTimeStats: {
          matches_played: parseInt(allTimeStats[0]?.total_matches) || 0,
          wins: parseInt(allTimeStats[0]?.total_wins) || 0,
          draws: parseInt(allTimeStats[0]?.total_draws) || 0,
          losses: parseInt(allTimeStats[0]?.total_losses) || 0,
          goals_scored: parseInt(allTimeStats[0]?.total_goals_scored) || 0,
          goals_conceded: parseInt(allTimeStats[0]?.total_goals_conceded) || 0,
          points: parseInt(allTimeStats[0]?.total_points) || 0
        },
        seasonBreakdown: seasonBreakdown.map(season => ({
          season_id: season.season_id,
          tournament_id: season.tournament_id,
          matches_played: parseInt(season.matches_played) || 0,
          wins: parseInt(season.wins) || 0,
          draws: parseInt(season.draws) || 0,
          losses: parseInt(season.losses) || 0,
          goals_scored: parseInt(season.goals_for) || 0,
          goals_conceded: parseInt(season.goals_against) || 0,
          goal_difference: parseInt(season.goal_difference) || 0,
          points: parseInt(season.points) || 0,
          rank: parseInt(season.rank) || null
        })),
        achievements,
        players: allPlayers,
        fixtures: fixtures.map(fixture => ({
          id: fixture.id,
          season_id: fixture.season_id,
          match_day: fixture.match_day,
          home_team_id: fixture.home_team_id,
          away_team_id: fixture.away_team_id,
          home_team_name: fixture.home_team_name,
          away_team_name: fixture.away_team_name,
          home_score: fixture.home_score,
          away_score: fixture.away_score,
          status: fixture.status,
          is_home: fixture.home_team_id === teamId
        }))
      }
    });

  } catch (error: any) {
    console.error('[Team Details API] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to fetch team details'
      },
      { status: 500 }
    );
  }
}
