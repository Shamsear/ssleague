import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { id: tournamentId } = await params;
    
    // Get optional round filter from query params
    const { searchParams } = new URL(request.url);
    const upToRound = searchParams.get('upToRound') ? parseInt(searchParams.get('upToRound')!) : null;

    // Get tournament info to determine format
    const tournaments = await sql`
      SELECT 
        tournament_name,
        has_league_stage,
        has_group_stage,
        has_knockout_stage,
        is_pure_knockout,
        teams_advancing_per_group,
        season_id
      FROM tournaments
      WHERE id = ${tournamentId}
    `;

    if (tournaments.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      );
    }

    const tournament = tournaments[0];

    // Fetch season name from Firebase
    let seasonName = null;
    if (tournament.season_id) {
      try {
        const { db } = await import('@/lib/firebase/config');
        const { doc, getDoc } = await import('firebase/firestore');
        
        const seasonDoc = await getDoc(doc(db, 'seasons', tournament.season_id));
        if (seasonDoc.exists()) {
          const seasonData = seasonDoc.data();
          seasonName = seasonData.season_name || seasonData.name || `Season ${seasonData.season_number || ''}`;
        }
      } catch (error) {
        console.error('Error fetching season from Firebase:', error);
      }
    }

    // Get all completed fixtures for this tournament from Neon
    // If upToRound is specified, filter by round_number
    let fixtures;
    if (upToRound !== null) {
      fixtures = await sql`
        SELECT 
          id,
          home_team_id,
          home_team_name,
          away_team_id,
          away_team_name,
          home_score,
          away_score,
          status,
          result,
          group_name,
          knockout_round,
          round_number
        FROM fixtures
        WHERE tournament_id = ${tournamentId}
          AND status = 'completed'
          AND result IS NOT NULL
          AND round_number <= ${upToRound}
      `;
    } else {
      fixtures = await sql`
        SELECT 
          id,
          home_team_id,
          home_team_name,
          away_team_id,
          away_team_name,
          home_score,
          away_score,
          status,
          result,
          group_name,
          knockout_round,
          round_number
        FROM fixtures
        WHERE tournament_id = ${tournamentId}
          AND status = 'completed'
          AND result IS NOT NULL
      `;
    }

    // Handle different tournament formats
    if (tournament.has_group_stage) {
      // Group Stage format - calculate standings per group
      const groupStandings = calculateGroupStandings(fixtures, tournament.teams_advancing_per_group || 2);
      
      return NextResponse.json({
        success: true,
        tournament_name: tournament.tournament_name,
        season_name: seasonName,
        format: 'group_stage',
        has_knockout: tournament.has_knockout_stage,
        groupStandings,
        knockoutFixtures: tournament.has_knockout_stage ? getKnockoutFixtures(fixtures) : null,
      });
    } else if (tournament.is_pure_knockout) {
      // Pure Knockout format
      return NextResponse.json({
        success: true,
        tournament_name: tournament.tournament_name,
        season_name: seasonName,
        format: 'knockout',
        knockoutFixtures: getKnockoutFixtures(fixtures),
      });
    } else {
      // League format (or League + Knockout)
      const leagueFixtures = fixtures.filter(f => !f.knockout_round);
      const standings = await calculateLeagueStandings(leagueFixtures, sql);
      
      // Get playoff teams from tournament settings
      const tournamentSettings = await sql`
        SELECT playoff_teams
        FROM tournaments
        WHERE id = ${tournamentId}
      `;
      const playoffSpots = tournamentSettings[0]?.playoff_teams || 4;
      
      return NextResponse.json({
        success: true,
        tournament_name: tournament.tournament_name,
        season_name: seasonName,
        format: 'league',
        has_knockout: tournament.has_knockout_stage,
        playoff_spots: playoffSpots,
        standings,
        knockoutFixtures: tournament.has_knockout_stage ? getKnockoutFixtures(fixtures) : null,
      });
    }
  } catch (error: any) {
    console.error('Error fetching tournament standings:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch tournament standings',
      },
      { status: 500 }
    );
  }
}

async function calculateLeagueStandings(fixtures: any[], sql: any) {
  const teamStats: Record<string, any> = {};

  fixtures.forEach((fixture) => {
    const homeTeamId = fixture.home_team_id;
    const awayTeamId = fixture.away_team_id;
    const homeScore = fixture.home_score || 0;
    const awayScore = fixture.away_score || 0;

    // Initialize team stats if not exists
    if (!teamStats[homeTeamId]) {
      teamStats[homeTeamId] = {
        team_id: homeTeamId,
        team_name: fixture.home_team_name,
        team_logo: null,
        matches_played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_for: 0,
        goals_against: 0,
        goal_difference: 0,
        points: 0,
      };
    }
    if (!teamStats[awayTeamId]) {
      teamStats[awayTeamId] = {
        team_id: awayTeamId,
        team_name: fixture.away_team_name,
        team_logo: null,
        matches_played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_for: 0,
        goals_against: 0,
        goal_difference: 0,
        points: 0,
      };
    }

    // Update stats
    teamStats[homeTeamId].matches_played++;
    teamStats[awayTeamId].matches_played++;
    teamStats[homeTeamId].goals_for += homeScore;
    teamStats[homeTeamId].goals_against += awayScore;
    teamStats[awayTeamId].goals_for += awayScore;
    teamStats[awayTeamId].goals_against += homeScore;

    // Determine result and update points
    if (homeScore > awayScore) {
      teamStats[homeTeamId].wins++;
      teamStats[homeTeamId].points += 3;
      teamStats[awayTeamId].losses++;
    } else if (awayScore > homeScore) {
      teamStats[awayTeamId].wins++;
      teamStats[awayTeamId].points += 3;
      teamStats[homeTeamId].losses++;
    } else {
      teamStats[homeTeamId].draws++;
      teamStats[awayTeamId].draws++;
      teamStats[homeTeamId].points += 1;
      teamStats[awayTeamId].points += 1;
    }
  });

  // Fetch team logos from Firebase
  const teamIds = Object.keys(teamStats);
  if (teamIds.length > 0) {
    try {
      const { db } = await import('@/lib/firebase/config');
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      
      const teamsRef = collection(db, 'teams');
      const teamsSnapshot = await getDocs(teamsRef);
      
      teamsSnapshot.forEach((doc) => {
        const teamData = doc.data();
        const teamId = doc.id;
        
        if (teamStats[teamId]) {
          teamStats[teamId].team_logo = teamData.logo_url || teamData.team_logo || teamData.logoUrl || null;
        }
      });
    } catch (error) {
      console.error('Error fetching team logos:', error);
    }
  }

  // Calculate goal difference and sort
  const standings = Object.values(teamStats).map((team: any) => ({
    ...team,
    goal_difference: team.goals_for - team.goals_against,
  })).sort((a: any, b: any) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
    return b.goals_for - a.goals_for;
  });

  return standings;
}

function calculateGroupStandings(fixtures: any[], teamsAdvancing: number) {
  const groups: Record<string, any> = {};

  // Filter only group stage fixtures
  const groupFixtures = fixtures.filter(f => f.group_name);

  groupFixtures.forEach((fixture) => {
    const groupName = fixture.group_name;
    if (!groups[groupName]) {
      groups[groupName] = {};
    }

    const homeTeamId = fixture.home_team_id;
    const awayTeamId = fixture.away_team_id;
    const homeScore = fixture.home_score || 0;
    const awayScore = fixture.away_score || 0;

    // Initialize team stats if not exists
    if (!groups[groupName][homeTeamId]) {
      groups[groupName][homeTeamId] = {
        team_id: homeTeamId,
        team_name: fixture.home_team_name,
        group: groupName,
        matches_played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_for: 0,
        goals_against: 0,
        goal_difference: 0,
        points: 0,
        position: 0,
        qualifies: false,
      };
    }
    if (!groups[groupName][awayTeamId]) {
      groups[groupName][awayTeamId] = {
        team_id: awayTeamId,
        team_name: fixture.away_team_name,
        group: groupName,
        matches_played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_for: 0,
        goals_against: 0,
        goal_difference: 0,
        points: 0,
        position: 0,
        qualifies: false,
      };
    }

    // Update stats
    const homeTeam = groups[groupName][homeTeamId];
    const awayTeam = groups[groupName][awayTeamId];

    homeTeam.matches_played++;
    awayTeam.matches_played++;
    homeTeam.goals_for += homeScore;
    homeTeam.goals_against += awayScore;
    awayTeam.goals_for += awayScore;
    awayTeam.goals_against += homeScore;

    if (homeScore > awayScore) {
      homeTeam.wins++;
      homeTeam.points += 3;
      awayTeam.losses++;
    } else if (awayScore > homeScore) {
      awayTeam.wins++;
      awayTeam.points += 3;
      homeTeam.losses++;
    } else {
      homeTeam.draws++;
      awayTeam.draws++;
      homeTeam.points += 1;
      awayTeam.points += 1;
    }
  });

  // Sort each group and determine qualification
  const sortedGroups: Record<string, any[]> = {};

  Object.keys(groups).forEach((groupName) => {
    const teams = Object.values(groups[groupName]).map((team: any) => ({
      ...team,
      goal_difference: team.goals_for - team.goals_against,
    })).sort((a: any, b: any) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
      return b.goals_for - a.goals_for;
    });

    // Assign positions and qualification status
    teams.forEach((team, index) => {
      team.position = index + 1;
      team.qualifies = index < teamsAdvancing;
    });

    sortedGroups[groupName] = teams;
  });

  return sortedGroups;
}

function getKnockoutFixtures(fixtures: any[]) {
  const knockoutFixtures = fixtures.filter(f => f.knockout_round);
  
  // Get all knockout fixtures (including pending ones)
  const allKnockoutFixtures = knockoutFixtures.map(f => ({
    id: f.id,
    round: f.knockout_round,
    home_team: f.home_team_name,
    away_team: f.away_team_name,
    home_score: f.home_score,
    away_score: f.away_score,
    status: f.status,
    result: f.result,
  }));

  // Group by round
  const rounds: Record<string, any[]> = {};
  allKnockoutFixtures.forEach(fixture => {
    if (!rounds[fixture.round]) {
      rounds[fixture.round] = [];
    }
    rounds[fixture.round].push(fixture);
  });

  return rounds;
}
