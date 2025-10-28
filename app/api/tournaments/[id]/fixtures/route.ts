import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { adminDb } from '@/lib/firebase/admin';

// POST - Generate fixtures for a tournament
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { id: tournamentId } = await params;
    const body = await request.json();
    const { is_two_legged } = body;

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

    // Get tournament details
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

    // Generate round-robin fixtures
    const fixtures = generateRoundRobinFixtures(
      tournamentId,
      tournamentData.season_id,
      teams,
      is_two_legged ?? true
    );

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
  isTwoLegged: boolean
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

  // Generate first leg
  for (let round = 0; round < numRounds; round++) {
    let matchNumber = 0;

    for (let match = 0; match < matchesPerRound; match++) {
      let home: number, away: number;

      if (match === 0) {
        home = 0;
        away = round + 1;
      } else {
        home = (round + match) % (numTeams - 1) + 1;
        away = (round + (numTeams - 1) - match) % (numTeams - 1) + 1;
      }

      // Skip bye teams
      if (teamList[home].id === 'bye' || teamList[away].id === 'bye') {
        continue;
      }

      matchNumber++;
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
      });
    }
  }

  // Generate second leg if needed
  if (isTwoLegged) {
    const firstLegCount = fixtures.length;
    const roundsInFirstLeg = numRounds;

    for (let round = 0; round < numRounds; round++) {
      let matchNumber = 0;

      for (let match = 0; match < matchesPerRound; match++) {
        let home: number, away: number;

        if (match === 0) {
          home = 0;
          away = round + 1;
        } else {
          home = (round + match) % (numTeams - 1) + 1;
          away = (round + (numTeams - 1) - match) % (numTeams - 1) + 1;
        }

        // Skip bye teams
        if (teamList[home].id === 'bye' || teamList[away].id === 'bye') {
          continue;
        }

        matchNumber++;
        const fixtureId = `${tournamentId}_leg2_r${round + roundsInFirstLeg + 1}_m${matchNumber}`;

        // Swap home and away for second leg
        fixtures.push({
          id: fixtureId,
          tournament_id: tournamentId,
          season_id: seasonId,
          round_number: round + roundsInFirstLeg + 1,
          match_number: matchNumber,
          home_team_id: teamList[away].id, // Swapped
          away_team_id: teamList[home].id, // Swapped
          home_team_name: teamList[away].team_name,
          away_team_name: teamList[home].team_name,
          status: 'scheduled',
          leg: 'second',
        });
      }
    }
  }

  return fixtures;
}
