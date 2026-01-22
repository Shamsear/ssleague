import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { adminDb } from '@/lib/firebase/admin';
import { sendNotificationToSeason } from '@/lib/notifications/send-notification';

// POST - Generate fixtures for a tournament
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { id: tournamentId } = await params;
    const body = await request.json();
    const { is_two_legged, matchup_mode = 'manual' } = body;

    // Get teams already assigned to this tournament from teamstats
    const assignedTeams = await sql`
      SELECT DISTINCT team_id, team_name
      FROM teamstats
      WHERE tournament_id = ${tournamentId}
      ORDER BY team_name ASC
    `;

    if (assignedTeams.length < 2) {
      return NextResponse.json(
        { success: false, error: 'At least 2 teams must be assigned to this tournament first. Please use the Teams tab to assign teams.' },
        { status: 400 }
      );
    }

    const team_ids = assignedTeams.map(t => t.team_id);

    // Get tournament details with format settings
    const tournament = await sql`
      SELECT t.*, ts.tournament_system
      FROM tournaments t
      LEFT JOIN tournament_settings ts ON t.id = ts.tournament_id
      WHERE t.id = ${tournamentId}
      LIMIT 1
    `;

    if (tournament.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      );
    }

    const tournamentData = tournament[0];

    // Validate tournament has at least one stage enabled
    if (!tournamentData.has_league_stage && !tournamentData.has_group_stage && !tournamentData.has_knockout_stage) {
      return NextResponse.json(
        { success: false, error: 'Tournament must have at least one stage enabled (League, Group, or Knockout)' },
        { status: 400 }
      );
    }

    // Check if fixtures already exist
    const existingFixtures = await sql`
      SELECT COUNT(*) as count
      FROM fixtures
      WHERE tournament_id = ${tournamentId}
    `;

    if (existingFixtures[0].count > 0) {
      return NextResponse.json(
        { success: false, error: 'Fixtures already exist for this tournament. Delete them first.' },
        { status: 400 }
      );
    }

    // Get team details from Firebase
    const teamsData = [];
    for (const teamId of team_ids) {
      const teamDoc = await adminDb.collection('teams').doc(teamId).get();
      if (!teamDoc.exists) {
        return NextResponse.json(
          { success: false, error: `Team ${teamId} not found` },
          { status: 400 }
        );
      }
      const teamData = teamDoc.data();
      teamsData.push({
        id: teamId,
        team_name: teamData?.team_name || 'Unknown Team'
      });
    }

    // Sort teams by name for consistent fixture generation
    const teams = teamsData.sort((a, b) => a.team_name.localeCompare(b.team_name));

    // Generate fixtures based on tournament format
    let fixtures: any[] = [];

    if (tournamentData.has_league_stage) {
      // League format: Round-robin
      console.log('Generating league fixtures (round-robin)...');
      fixtures = generateRoundRobinFixtures(
        tournamentId,
        tournamentData.season_id,
        teams,
        is_two_legged ?? true,
        matchup_mode
      );
    } else if (tournamentData.has_group_stage) {
      // Group format: Divide into groups, then round-robin within each group
      console.log('Generating group stage fixtures...');

      // Check if manual group assignment is required
      if (tournamentData.group_assignment_mode === 'manual') {
        // Fetch manual group assignments
        const groupAssignments = await sql`
          SELECT team_id, group_name
          FROM tournament_team_groups
          WHERE tournament_id = ${tournamentId}
        `;

        if (groupAssignments.length === 0) {
          return NextResponse.json(
            { success: false, error: 'Manual group assignment mode is enabled but no teams have been assigned to groups. Please assign teams to groups first.' },
            { status: 400 }
          );
        }

        // Map teams to their groups
        const teamGroupMap = new Map(groupAssignments.map(a => [a.team_id, a.group_name]));

        // Add group info to teams
        teams.forEach(team => {
          team.group = teamGroupMap.get(team.id) || null;
        });

        // Check if all teams are assigned
        if (teams.some(t => !t.group)) {
          return NextResponse.json(
            { success: false, error: 'Some teams are not assigned to any group. Please complete group assignments.' },
            { status: 400 }
          );
        }
      }

      fixtures = generateGroupStageFixtures(
        tournamentId,
        tournamentData.season_id,
        teams,
        tournamentData.number_of_groups || 4,
        is_two_legged ?? true,
        tournamentData.group_assignment_mode
      );
    } else if (tournamentData.is_pure_knockout) {
      // Pure knockout: Generate bracket
      console.log('Generating knockout bracket...');
      fixtures = generateKnockoutFixtures(
        tournamentId,
        tournamentData.season_id,
        teams,
        tournamentData.playoff_teams || teams.length
      );
    }

    if (fixtures.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fixtures generated. Check tournament format settings.' },
        { status: 400 }
      );
    }

    // Insert fixtures in batch
    for (const fixture of fixtures) {
      await sql`
        INSERT INTO fixtures (
          id,
          tournament_id,
          season_id,
          round_number,
          match_number,
          home_team_id,
          away_team_id,
          home_team_name,
          away_team_name,
          status,
          leg,
          matchup_mode,
          created_at,
          updated_at
        ) VALUES (
          ${fixture.id},
          ${fixture.tournament_id},
          ${fixture.season_id},
          ${fixture.round_number},
          ${fixture.match_number},
          ${fixture.home_team_id},
          ${fixture.away_team_id},
          ${fixture.home_team_name},
          ${fixture.away_team_name},
          ${fixture.status},
          ${fixture.leg},
          ${fixture.matchup_mode || 'manual'},
          NOW(),
          NOW()
        )
      `;
    }

    // Create round_deadlines for each round
    const uniqueRounds = [...new Set(fixtures.map(f => `${f.round_number}_${f.leg}`))];

    for (const roundKey of uniqueRounds) {
      const [roundNumber, leg] = roundKey.split('_');

      await sql`
        INSERT INTO round_deadlines (
          tournament_id,
          season_id,
          round_number,
          leg,
          status,
          created_at,
          updated_at
        ) VALUES (
          ${tournamentId},
          ${tournamentData.season_id},
          ${parseInt(roundNumber)},
          ${leg},
          'pending',
          NOW(),
          NOW()
        )
        ON CONFLICT (tournament_id, round_number, leg) DO NOTHING
      `;
    }

    // Teams are already assigned via the Teams tab, so no need to update here
    console.log(`✅ Generated fixtures for ${team_ids.length} teams in tournament ${tournamentId}`);

    // Send notification
    try {
      await sendNotificationToSeason(
        {
          title: `📅 ${tournamentData.name || 'Tournament'} Fixtures Generated`,
          body: `${fixtures.length} fixtures have been created. Check the schedule!`,
          url: `/dashboard/tournaments/${tournamentId}`,
          icon: '/logo.png',
          data: {
            type: 'tournament_fixtures_generated',
            tournament_id: tournamentId,
            fixtures_count: fixtures.length
          }
        },
        tournamentData.season_id
      );
    } catch (notifError) {
      console.error('Failed to send notification:', notifError);
    }

    return NextResponse.json({
      success: true,
      fixtures_count: fixtures.length,
      message: `Generated ${fixtures.length} fixtures for tournament`,
    });
  } catch (error) {
    console.error('Error generating fixtures:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate fixtures' },
      { status: 500 }
    );
  }
}

// GET - Get fixtures for a tournament
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { id: tournamentId } = await params;

    const fixtures = await sql`
      SELECT *
      FROM fixtures
      WHERE tournament_id = ${tournamentId}
      ORDER BY round_number ASC, match_number ASC
    `;

    return NextResponse.json({ success: true, fixtures });
  } catch (error) {
    console.error('Error fetching fixtures:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch fixtures' },
      { status: 500 }
    );
  }
}

// DELETE - Delete all fixtures for a tournament
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { id: tournamentId } = await params;

    // Delete round_deadlines first (foreign key constraint)
    await sql`
      DELETE FROM round_deadlines
      WHERE tournament_id = ${tournamentId}
    `;

    // Delete fixtures
    await sql`
      DELETE FROM fixtures
      WHERE tournament_id = ${tournamentId}
    `;

    return NextResponse.json({
      success: true,
      message: 'All fixtures deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting fixtures:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete fixtures' },
      { status: 500 }
    );
  }
}

// Helper function to generate round-robin fixtures
function generateRoundRobinFixtures(
  tournamentId: string,
  seasonId: string,
  teams: any[],
  isTwoLegged: boolean,
  matchupMode: string = 'manual'
) {
  const fixtures: any[] = [];
  const teamList = [...teams];

  // Add bye if odd number of teams
  if (teamList.length % 2 !== 0) {
    teamList.push({ id: 'bye', team_name: 'BYE' });
  }

  const numTeams = teamList.length;
  const numRounds = numTeams - 1;
  const matchesPerRound = numTeams / 2;

  // Track home/away balance for each team
  const homeAwayBalance: { [teamId: string]: number } = {};
  teamList.forEach(team => {
    if (team.id !== 'bye') {
      homeAwayBalance[team.id] = 0; // 0 is balanced, positive means more home games, negative means more away
    }
  });

  // Generate first leg with randomized home/away
  for (let round = 0; round < numRounds; round++) {
    let matchNumber = 0;

    for (let match = 0; match < matchesPerRound; match++) {
      let homeIdx: number, awayIdx: number;

      if (match === 0) {
        homeIdx = 0;
        awayIdx = round + 1;
      } else {
        homeIdx = (round + match) % (numTeams - 1) + 1;
        awayIdx = (round + (numTeams - 1) - match) % (numTeams - 1) + 1;
      }

      // Skip bye teams
      if (teamList[homeIdx].id === 'bye' || teamList[awayIdx].id === 'bye') {
        continue;
      }

      matchNumber++;

      // Decide home/away based on balance - team with fewer home games gets home advantage
      let home = homeIdx;
      let away = awayIdx;

      const team1Balance = homeAwayBalance[teamList[homeIdx].id];
      const team2Balance = homeAwayBalance[teamList[awayIdx].id];

      // If one team has significantly fewer home games, give them home advantage
      if (team2Balance < team1Balance - 1) {
        // Swap: team2 gets home
        home = awayIdx;
        away = homeIdx;
      } else if (team1Balance === team2Balance) {
        // If balanced, randomize
        if (Math.random() < 0.5) {
          home = awayIdx;
          away = homeIdx;
        }
      }
      // Otherwise keep original assignment (team1 home)

      // Update balance
      homeAwayBalance[teamList[home].id]++;
      homeAwayBalance[teamList[away].id]--;

      const fixtureId = `${tournamentId}_leg1_r${round + 1}_m${matchNumber}`;

      fixtures.push({
        id: fixtureId,
        tournament_id: tournamentId,
        season_id: seasonId,
        round_number: round + 1,
        match_number: matchNumber,
        home_team_id: teamList[home].id,
        away_team_id: teamList[away].id,
        home_team_name: teamList[home].team_name,
        away_team_name: teamList[away].team_name,
        status: 'scheduled',
        leg: 'first',
        matchup_mode: matchupMode,
      });
    }
  }

  // Generate second leg if needed - swap home/away from first leg
  if (isTwoLegged) {
    const firstLegFixtures = fixtures.filter(f => f.leg === 'first');
    const roundsInFirstLeg = numRounds;

    firstLegFixtures.forEach((firstLegFixture, index) => {
      const secondLegRound = firstLegFixture.round_number + roundsInFirstLeg;
      const fixtureId = `${tournamentId}_leg2_r${secondLegRound}_m${firstLegFixture.match_number}`;

      // Swap home and away teams from first leg
      fixtures.push({
        id: fixtureId,
        tournament_id: tournamentId,
        season_id: seasonId,
        round_number: secondLegRound,
        match_number: firstLegFixture.match_number,
        home_team_id: firstLegFixture.away_team_id, // Swapped
        away_team_id: firstLegFixture.home_team_id, // Swapped
        home_team_name: firstLegFixture.away_team_name,
        away_team_name: firstLegFixture.home_team_name,
        status: 'scheduled',
        leg: 'second',
        matchup_mode: matchupMode,
      });
    });
  }

  return fixtures;
}

// Helper function to generate group stage fixtures
function generateGroupStageFixtures(
  tournamentId: string,
  seasonId: string,
  teams: any[],
  numberOfGroups: number,
  isTwoLegged: boolean,
  groupAssignmentMode?: string
) {
  const fixtures: any[] = [];

  // Divide teams into groups based on mode
  const groups: any[][] = [];

  if (groupAssignmentMode === 'manual') {
    // Manual mode: teams already have .group property assigned
    // Group teams by their assigned group
    const groupMap = new Map<string, any[]>();

    teams.forEach(team => {
      const groupName = team.group;
      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, []);
      }
      groupMap.get(groupName)!.push(team);
    });

    // Convert map to array, sorted by group name
    const sortedGroupNames = Array.from(groupMap.keys()).sort();
    sortedGroupNames.forEach(groupName => {
      groups.push(groupMap.get(groupName)!);
    });
  } else {
    // Auto mode: distribute teams evenly
    const teamsPerGroup = Math.ceil(teams.length / numberOfGroups);
    for (let i = 0; i < numberOfGroups; i++) {
      const groupTeams = teams.slice(i * teamsPerGroup, (i + 1) * teamsPerGroup);
      if (groupTeams.length > 0) {
        groups.push(groupTeams);
      }
    }
  }

  // Generate fixtures for each group
  groups.forEach((groupTeams, groupIndex) => {
    const groupName = String.fromCharCode(65 + groupIndex); // A, B, C, D...
    const teamList = [...groupTeams];

    // Add bye if odd number of teams
    if (teamList.length % 2 !== 0) {
      teamList.push({ id: 'bye', team_name: 'BYE' });
    }

    const numTeams = teamList.length;
    const numRounds = numTeams - 1;
    const matchesPerRound = numTeams / 2;

    // Track home/away balance for each team in this group
    const homeAwayBalance: { [teamId: string]: number } = {};
    teamList.forEach(team => {
      if (team.id !== 'bye') {
        homeAwayBalance[team.id] = 0;
      }
    });

    // Generate first leg with randomized home/away
    for (let round = 0; round < numRounds; round++) {
      const roundNumber = round + 1; // Use same round numbers for all groups
      let matchNumber = 0;

      for (let match = 0; match < matchesPerRound; match++) {
        let homeIdx: number, awayIdx: number;

        if (match === 0) {
          homeIdx = 0;
          awayIdx = round + 1;
        } else {
          homeIdx = (round + match) % (numTeams - 1) + 1;
          awayIdx = (round + (numTeams - 1) - match) % (numTeams - 1) + 1;
        }

        // Skip bye teams
        if (teamList[homeIdx].id === 'bye' || teamList[awayIdx].id === 'bye') {
          continue;
        }

        matchNumber++;

        // Decide home/away based on balance
        let home = homeIdx;
        let away = awayIdx;

        const team1Balance = homeAwayBalance[teamList[homeIdx].id];
        const team2Balance = homeAwayBalance[teamList[awayIdx].id];

        if (team2Balance < team1Balance - 1) {
          home = awayIdx;
          away = homeIdx;
        } else if (team1Balance === team2Balance) {
          if (Math.random() < 0.5) {
            home = awayIdx;
            away = homeIdx;
          }
        }

        homeAwayBalance[teamList[home].id]++;
        homeAwayBalance[teamList[away].id]--;

        const fixtureId = `${tournamentId}_grp${groupName}_leg1_r${roundNumber}_m${matchNumber}`;

        fixtures.push({
          id: fixtureId,
          tournament_id: tournamentId,
          season_id: seasonId,
          round_number: roundNumber, // Same round number for all groups
          match_number: matchNumber,
          home_team_id: teamList[home].id,
          away_team_id: teamList[away].id,
          home_team_name: teamList[home].team_name,
          away_team_name: teamList[away].team_name,
          status: 'scheduled',
          leg: 'first',
          group_name: groupName,
        });
      }
    }

    // Generate second leg if needed - swap home/away from first leg
    if (isTwoLegged) {
      const groupFirstLegFixtures = fixtures.filter(f => f.leg === 'first' && f.group_name === groupName);
      const roundsInFirstLeg = numRounds;

      groupFirstLegFixtures.forEach((firstLegFixture) => {
        const secondLegRoundNumber = firstLegFixture.round_number + roundsInFirstLeg;
        const fixtureId = `${tournamentId}_grp${groupName}_leg2_r${secondLegRoundNumber}_m${firstLegFixture.match_number}`;

        // Swap home and away teams from first leg
        fixtures.push({
          id: fixtureId,
          tournament_id: tournamentId,
          season_id: seasonId,
          round_number: secondLegRoundNumber, // Parallel round numbers for second leg too
          match_number: firstLegFixture.match_number,
          home_team_id: firstLegFixture.away_team_id, // Swapped
          away_team_id: firstLegFixture.home_team_id, // Swapped
          home_team_name: firstLegFixture.away_team_name,
          away_team_name: firstLegFixture.home_team_name,
          status: 'scheduled',
          leg: 'second',
          group_name: groupName,
        });
      });
    }
  });

  return fixtures;
}

// Helper function to generate knockout bracket fixtures
function generateKnockoutFixtures(
  tournamentId: string,
  seasonId: string,
  teams: any[],
  playoffTeams: number
) {
  const fixtures: any[] = [];

  // Ensure playoff teams is a power of 2 (2, 4, 8, 16...)
  const validSizes = [2, 4, 8, 16, 32];
  const actualPlayoffTeams = validSizes.find(size => size >= Math.min(playoffTeams, teams.length)) || 2;

  // Take only the number of teams that fit the bracket
  const bracketTeams = teams.slice(0, actualPlayoffTeams);

  if (bracketTeams.length < 2) {
    return fixtures;
  }

  // Determine tournament structure
  const rounds: { [key: string]: string } = {
    '2': 'Final',
    '4': 'Semi-Final',
    '8': 'Quarter-Final',
    '16': 'Round of 16',
    '32': 'Round of 32',
  };

  let currentRound = 1;
  let teamsInRound = bracketTeams.length;

  // Generate fixtures for each knockout round
  while (teamsInRound >= 2) {
    const roundName = rounds[teamsInRound.toString()] || `Round ${currentRound}`;
    const matchesInRound = teamsInRound / 2;

    for (let matchNum = 1; matchNum <= matchesInRound; matchNum++) {
      const fixtureId = `${tournamentId}_ko_r${currentRound}_m${matchNum}`;

      // For the first round, assign actual teams. For later rounds, use TBD
      if (currentRound === 1) {
        const homeIdx = (matchNum - 1) * 2;
        const awayIdx = homeIdx + 1;

        fixtures.push({
          id: fixtureId,
          tournament_id: tournamentId,
          season_id: seasonId,
          round_number: currentRound,
          match_number: matchNum,
          home_team_id: bracketTeams[homeIdx].id,
          away_team_id: bracketTeams[awayIdx].id,
          home_team_name: bracketTeams[homeIdx].team_name,
          away_team_name: bracketTeams[awayIdx].team_name,
          status: 'scheduled',
          leg: 'knockout',
          knockout_round: roundName,
        });
      } else {
        // TBD teams for future rounds
        fixtures.push({
          id: fixtureId,
          tournament_id: tournamentId,
          season_id: seasonId,
          round_number: currentRound,
          match_number: matchNum,
          home_team_id: 'TBD',
          away_team_id: 'TBD',
          home_team_name: `Winner R${currentRound - 1}M${(matchNum - 1) * 2 + 1}`,
          away_team_name: `Winner R${currentRound - 1}M${(matchNum - 1) * 2 + 2}`,
          status: 'pending',
          leg: 'knockout',
          knockout_round: roundName,
        });
      }
    }

    teamsInRound = teamsInRound / 2;
    currentRound++;
  }

  return fixtures;
}
