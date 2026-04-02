import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { id: teamId } = await params;
    
    // Get optional filters from query params
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId');
    const tournamentId = searchParams.get('tournamentId');

    // Fetch team info from Firebase
    let teamInfo = null;
    try {
      const { db } = await import('@/lib/firebase/config');
      const { doc, getDoc } = await import('firebase/firestore');
      
      const teamDoc = await getDoc(doc(db, 'teams', teamId));
      if (teamDoc.exists()) {
        const teamData = teamDoc.data();
        teamInfo = {
          team_id: teamId,
          team_name: teamData.team_name || teamData.name,
          team_logo: teamData.logo_url || teamData.team_logo || teamData.logoUrl || null,
          captain_name: teamData.captain_name,
          created_at: teamData.created_at,
        };
      }
    } catch (error) {
      console.error('Error fetching team from Firebase:', error);
    }

    if (!teamInfo) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      );
    }

    // Calculate overall statistics across all tournaments and seasons
    const overallStats = await calculateOverallStats(sql, teamId, seasonId);

    // Get tournament-wise statistics
    const tournamentStats = await getTournamentWiseStats(sql, teamId, seasonId, tournamentId);

    // Get season-wise summary
    const seasonSummary = await getSeasonSummary(sql, teamId, seasonId);

    return NextResponse.json({
      success: true,
      team: teamInfo,
      overall: overallStats,
      tournaments: tournamentStats,
      seasons: seasonSummary,
    });
  } catch (error: any) {
    console.error('Error fetching team statistics:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch team statistics',
      },
      { status: 500 }
    );
  }
}

async function calculateOverallStats(sql: any, teamId: string, seasonId: string | null) {
  // Get all fixtures where this team participated
  let fixtures;
  if (seasonId) {
    fixtures = await sql`
      SELECT 
        home_team_id,
        away_team_id,
        home_score,
        away_score,
        status
      FROM fixtures
      WHERE (home_team_id = ${teamId} OR away_team_id = ${teamId})
        AND status = 'completed'
        AND home_score IS NOT NULL
        AND away_score IS NOT NULL
        AND season_id = ${seasonId}
    `;
  } else {
    fixtures = await sql`
      SELECT 
        home_team_id,
        away_team_id,
        home_score,
        away_score,
        status
      FROM fixtures
      WHERE (home_team_id = ${teamId} OR away_team_id = ${teamId})
        AND status = 'completed'
        AND home_score IS NOT NULL
        AND away_score IS NOT NULL
    `;
  }

  const stats = {
    matches_played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals_for: 0,
    goals_against: 0,
    goal_difference: 0,
    points: 0,
    clean_sheets: 0,
    win_percentage: 0,
  };

  fixtures.forEach((fixture: any) => {
    const isHome = fixture.home_team_id === teamId;
    const teamScore = isHome ? fixture.home_score : fixture.away_score;
    const opponentScore = isHome ? fixture.away_score : fixture.home_score;

    stats.matches_played++;
    stats.goals_for += teamScore || 0;
    stats.goals_against += opponentScore || 0;

    if (opponentScore === 0) {
      stats.clean_sheets++;
    }

    if (teamScore > opponentScore) {
      stats.wins++;
      stats.points += 3;
    } else if (teamScore === opponentScore) {
      stats.draws++;
      stats.points += 1;
    } else {
      stats.losses++;
    }
  });

  stats.goal_difference = stats.goals_for - stats.goals_against;
  stats.win_percentage = stats.matches_played > 0 
    ? Math.round((stats.wins / stats.matches_played) * 100) 
    : 0;

  return stats;
}

async function getTournamentWiseStats(
  sql: any, 
  teamId: string, 
  seasonId: string | null,
  tournamentId: string | null
) {
  // Get all tournaments this team participated in
  let tournaments;
  if (seasonId && tournamentId) {
    tournaments = await sql`
      SELECT DISTINCT 
        t.id,
        t.tournament_name,
        t.season_id,
        t.has_league_stage,
        t.has_group_stage,
        t.has_knockout_stage,
        t.is_pure_knockout
      FROM tournaments t
      INNER JOIN fixtures f ON f.tournament_id = t.id
      WHERE (f.home_team_id = ${teamId} OR f.away_team_id = ${teamId})
        AND t.season_id = ${seasonId}
        AND t.id = ${tournamentId}
      ORDER BY t.tournament_name
    `;
  } else if (seasonId) {
    tournaments = await sql`
      SELECT DISTINCT 
        t.id,
        t.tournament_name,
        t.season_id,
        t.has_league_stage,
        t.has_group_stage,
        t.has_knockout_stage,
        t.is_pure_knockout
      FROM tournaments t
      INNER JOIN fixtures f ON f.tournament_id = t.id
      WHERE (f.home_team_id = ${teamId} OR f.away_team_id = ${teamId})
        AND t.season_id = ${seasonId}
      ORDER BY t.tournament_name
    `;
  } else {
    tournaments = await sql`
      SELECT DISTINCT 
        t.id,
        t.tournament_name,
        t.season_id,
        t.has_league_stage,
        t.has_group_stage,
        t.has_knockout_stage,
        t.is_pure_knockout
      FROM tournaments t
      INNER JOIN fixtures f ON f.tournament_id = t.id
      WHERE (f.home_team_id = ${teamId} OR f.away_team_id = ${teamId})
      ORDER BY t.tournament_name
    `;
  }

  // Fetch season names from Firebase
  const seasonNames: Record<string, string> = {};
  const uniqueSeasonIds = [...new Set(tournaments.map((t: any) => t.season_id))];
  
  if (uniqueSeasonIds.length > 0) {
    try {
      const { db } = await import('@/lib/firebase/config');
      const { doc, getDoc } = await import('firebase/firestore');
      
      for (const sId of uniqueSeasonIds) {
        const seasonDoc = await getDoc(doc(db, 'seasons', sId));
        if (seasonDoc.exists()) {
          const seasonData = seasonDoc.data();
          seasonNames[sId] = seasonData.season_name || seasonData.name || `Season ${seasonData.season_number || ''}`;
        }
      }
    } catch (error) {
      console.error('Error fetching seasons from Firebase:', error);
    }
  }

  const tournamentStats = [];

  for (const tournament of tournaments) {
    // Get fixtures for this tournament
    const fixtures = await sql`
      SELECT 
        home_team_id,
        away_team_id,
        home_score,
        away_score,
        status,
        knockout_round,
        group_name
      FROM fixtures
      WHERE tournament_id = ${tournament.id}
        AND (home_team_id = ${teamId} OR away_team_id = ${teamId})
        AND status = 'completed'
        AND home_score IS NOT NULL
        AND away_score IS NOT NULL
    `;

    const stats = {
      tournament_id: tournament.id,
      tournament_name: tournament.tournament_name,
      season_id: tournament.season_id,
      season_name: seasonNames[tournament.season_id] || 'Unknown Season',
      format: tournament.is_pure_knockout ? 'knockout' : 
              tournament.has_group_stage ? 'group_stage' : 'league',
      has_knockout: tournament.has_knockout_stage,
      matches_played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goals_for: 0,
      goals_against: 0,
      goal_difference: 0,
      points: 0,
      clean_sheets: 0,
      league_position: null as number | null,
      group_name: null as string | null,
      group_position: null as number | null,
      knockout_stage_reached: null as string | null,
    };

    fixtures.forEach((fixture: any) => {
      const isHome = fixture.home_team_id === teamId;
      const teamScore = isHome ? fixture.home_score : fixture.away_score;
      const opponentScore = isHome ? fixture.away_score : fixture.home_score;

      stats.matches_played++;
      stats.goals_for += teamScore || 0;
      stats.goals_against += opponentScore || 0;

      if (opponentScore === 0) {
        stats.clean_sheets++;
      }

      if (teamScore > opponentScore) {
        stats.wins++;
        stats.points += 3;
      } else if (teamScore === opponentScore) {
        stats.draws++;
        stats.points += 1;
      } else {
        stats.losses++;
      }

      // Track knockout progress
      if (fixture.knockout_round) {
        if (!stats.knockout_stage_reached || 
            getRoundPriority(fixture.knockout_round) > getRoundPriority(stats.knockout_stage_reached)) {
          stats.knockout_stage_reached = fixture.knockout_round;
        }
      }

      // Track group name
      if (fixture.group_name && !stats.group_name) {
        stats.group_name = fixture.group_name;
      }
    });

    stats.goal_difference = stats.goals_for - stats.goals_against;

    // Get league position if applicable
    if (tournament.has_league_stage && !tournament.has_group_stage) {
      const standings = await sql`
        SELECT 
          team_id,
          ROW_NUMBER() OVER (ORDER BY points DESC, goal_difference DESC, goals_for DESC) as position
        FROM (
          SELECT 
            CASE 
              WHEN home_team_id = ${teamId} THEN home_team_id
              WHEN away_team_id = ${teamId} THEN away_team_id
              ELSE home_team_id
            END as team_id,
            SUM(CASE 
              WHEN home_team_id = ${teamId} AND home_score > away_score THEN 3
              WHEN away_team_id = ${teamId} AND away_score > home_score THEN 3
              WHEN home_score = away_score THEN 1
              ELSE 0
            END) as points,
            SUM(CASE 
              WHEN home_team_id = ${teamId} THEN home_score
              WHEN away_team_id = ${teamId} THEN away_score
              ELSE 0
            END) - SUM(CASE 
              WHEN home_team_id = ${teamId} THEN away_score
              WHEN away_team_id = ${teamId} THEN home_score
              ELSE 0
            END) as goal_difference,
            SUM(CASE 
              WHEN home_team_id = ${teamId} THEN home_score
              WHEN away_team_id = ${teamId} THEN away_score
              ELSE 0
            END) as goals_for
          FROM fixtures
          WHERE tournament_id = ${tournament.id}
            AND status = 'completed'
            AND home_score IS NOT NULL
            AND away_score IS NOT NULL
            AND knockout_round IS NULL
          GROUP BY team_id
        ) team_stats
        WHERE team_id = ${teamId}
      `;

      if (standings.length > 0) {
        stats.league_position = standings[0].position;
      }
    }

    // Get group position if applicable
    if (tournament.has_group_stage && stats.group_name) {
      const groupStandings = await sql`
        SELECT 
          team_id,
          ROW_NUMBER() OVER (ORDER BY points DESC, goal_difference DESC, goals_for DESC) as position
        FROM (
          SELECT 
            CASE 
              WHEN home_team_id = ${teamId} THEN home_team_id
              WHEN away_team_id = ${teamId} THEN away_team_id
              ELSE home_team_id
            END as team_id,
            SUM(CASE 
              WHEN home_team_id = ${teamId} AND home_score > away_score THEN 3
              WHEN away_team_id = ${teamId} AND away_score > home_score THEN 3
              WHEN home_score = away_score THEN 1
              ELSE 0
            END) as points,
            SUM(CASE 
              WHEN home_team_id = ${teamId} THEN home_score
              WHEN away_team_id = ${teamId} THEN away_score
              ELSE 0
            END) - SUM(CASE 
              WHEN home_team_id = ${teamId} THEN away_score
              WHEN away_team_id = ${teamId} THEN home_score
              ELSE 0
            END) as goal_difference,
            SUM(CASE 
              WHEN home_team_id = ${teamId} THEN home_score
              WHEN away_team_id = ${teamId} THEN away_score
              ELSE 0
            END) as goals_for
          FROM fixtures
          WHERE tournament_id = ${tournament.id}
            AND status = 'completed'
            AND home_score IS NOT NULL
            AND away_score IS NOT NULL
            AND group_name = ${stats.group_name}
          GROUP BY team_id
        ) team_stats
        WHERE team_id = ${teamId}
      `;

      if (groupStandings.length > 0) {
        stats.group_position = groupStandings[0].position;
      }
    }

    tournamentStats.push(stats);
  }

  return tournamentStats;
}

async function getSeasonSummary(sql: any, teamId: string, seasonId: string | null) {
  // Get season-wise aggregated stats
  let seasons;
  if (seasonId) {
    seasons = await sql`
      SELECT DISTINCT season_id
      FROM fixtures
      WHERE (home_team_id = ${teamId} OR away_team_id = ${teamId})
        AND status = 'completed'
        AND home_score IS NOT NULL
        AND away_score IS NOT NULL
        AND season_id = ${seasonId}
    `;
  } else {
    seasons = await sql`
      SELECT DISTINCT season_id
      FROM fixtures
      WHERE (home_team_id = ${teamId} OR away_team_id = ${teamId})
        AND status = 'completed'
        AND home_score IS NOT NULL
        AND away_score IS NOT NULL
      ORDER BY season_id DESC
    `;
  }

  // Fetch season names from Firebase
  const seasonSummaries = [];
  
  for (const season of seasons) {
    let seasonName = 'Unknown Season';
    try {
      const { db } = await import('@/lib/firebase/config');
      const { doc, getDoc } = await import('firebase/firestore');
      
      const seasonDoc = await getDoc(doc(db, 'seasons', season.season_id));
      if (seasonDoc.exists()) {
        const seasonData = seasonDoc.data();
        seasonName = seasonData.season_name || seasonData.name || `Season ${seasonData.season_number || ''}`;
      }
    } catch (error) {
      console.error('Error fetching season from Firebase:', error);
    }

    // Calculate stats for this season
    const fixtures = await sql`
      SELECT 
        home_team_id,
        away_team_id,
        home_score,
        away_score,
        status
      FROM fixtures
      WHERE (home_team_id = ${teamId} OR away_team_id = ${teamId})
        AND status = 'completed'
        AND home_score IS NOT NULL
        AND away_score IS NOT NULL
        AND season_id = ${season.season_id}
    `;

    const stats = {
      season_id: season.season_id,
      season_name: seasonName,
      tournaments_played: 0,
      matches_played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goals_for: 0,
      goals_against: 0,
      goal_difference: 0,
      points: 0,
      clean_sheets: 0,
    };

    fixtures.forEach((fixture: any) => {
      const isHome = fixture.home_team_id === teamId;
      const teamScore = isHome ? fixture.home_score : fixture.away_score;
      const opponentScore = isHome ? fixture.away_score : fixture.home_score;

      stats.matches_played++;
      stats.goals_for += teamScore || 0;
      stats.goals_against += opponentScore || 0;

      if (opponentScore === 0) {
        stats.clean_sheets++;
      }

      if (teamScore > opponentScore) {
        stats.wins++;
        stats.points += 3;
      } else if (teamScore === opponentScore) {
        stats.draws++;
        stats.points += 1;
      } else {
        stats.losses++;
      }
    });

    stats.goal_difference = stats.goals_for - stats.goals_against;

    // Count tournaments in this season
    const tournaments = await sql`
      SELECT COUNT(DISTINCT tournament_id) as count
      FROM fixtures
      WHERE (home_team_id = ${teamId} OR away_team_id = ${teamId})
        AND season_id = ${season.season_id}
    `;
    stats.tournaments_played = tournaments[0]?.count || 0;

    seasonSummaries.push(stats);
  }

  return seasonSummaries;
}

function getRoundPriority(round: string): number {
  const priorities: Record<string, number> = {
    'Final': 6,
    'Semi-Final': 5,
    'Quarter-Final': 4,
    'Round of 16': 3,
    'Round of 32': 2,
  };
  return priorities[round] || 1;
}
