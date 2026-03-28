import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-helper';
import { fantasySql } from '@/lib/neon/fantasy-config';

interface LineupSubmission {
  team_id: string;
  league_id: string;
  round_id: string;
  round_number: number;
  starting_players: string[]; // 5 player IDs
  captain_id: string;
  vice_captain_id: string;
  bench_players: string[]; // 2 player IDs
  lock_deadline: string;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const auth = await verifyAuth([], request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json(
        { 
          success: false,
          error: auth.error || 'Unauthorized' 
        },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const body: LineupSubmission = await request.json();
    const {
      team_id,
      league_id,
      round_id,
      round_number,
      starting_players,
      captain_id,
      vice_captain_id,
      bench_players,
      lock_deadline
    } = body;

    // 3. Validate required fields
    if (!team_id || !league_id || !round_id || !round_number) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 4. Verify team ownership
    const [team] = await fantasySql`
      SELECT team_id, owner_uid, league_id
      FROM fantasy_teams
      WHERE team_id = ${team_id}
    `;

    if (!team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    if (team.owner_uid !== auth.userId) {
      return NextResponse.json(
        { error: 'Forbidden: Not your team' },
        { status: 403 }
      );
    }

    if (team.league_id !== league_id) {
      return NextResponse.json(
        { error: 'Forbidden: Team not in this league' },
        { status: 403 }
      );
    }

    // 5. Validate lineup structure
    const validationErrors = validateLineup(
      starting_players,
      captain_id,
      vice_captain_id,
      bench_players
    );

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationErrors },
        { status: 400 }
      );
    }

    // 6. Get team's squad
    const squad = await fantasySql`
      SELECT real_player_id
      FROM fantasy_squad
      WHERE team_id = ${team_id}
    `;

    const squadPlayerIds = squad.map((p: any) => p.real_player_id);

    // 7. Validate all players are in squad
    const allPlayers = [...starting_players, ...bench_players];
    const invalidPlayers = allPlayers.filter(
      (playerId) => !squadPlayerIds.includes(playerId)
    );

    if (invalidPlayers.length > 0) {
      return NextResponse.json(
        {
          error: 'Invalid players',
          details: `Players not in squad: ${invalidPlayers.join(', ')}`
        },
        { status: 400 }
      );
    }

    // 8. Check lock deadline
    const deadline = new Date(lock_deadline);
    const now = new Date();

    if (now >= deadline) {
      return NextResponse.json(
        { error: 'Lineup deadline has passed' },
        { status: 400 }
      );
    }

    // 9. Generate lineup ID
    const lineup_id = `lineup_${team_id}_${round_id}_${Date.now()}`;

    // 10. Upsert lineup (insert or update if exists)
    await fantasySql`
      INSERT INTO fantasy_lineups (
        lineup_id,
        league_id,
        team_id,
        round_id,
        round_number,
        starting_players,
        captain_id,
        vice_captain_id,
        bench_players,
        is_locked,
        lock_deadline,
        created_at,
        updated_at
      )
      VALUES (
        ${lineup_id},
        ${league_id},
        ${team_id},
        ${round_id},
        ${round_number},
        ${JSON.stringify(starting_players)},
        ${captain_id},
        ${vice_captain_id},
        ${JSON.stringify(bench_players)},
        false,
        ${lock_deadline},
        NOW(),
        NOW()
      )
      ON CONFLICT (league_id, team_id, round_id)
      DO UPDATE SET
        starting_players = ${JSON.stringify(starting_players)},
        captain_id = ${captain_id},
        vice_captain_id = ${vice_captain_id},
        bench_players = ${JSON.stringify(bench_players)},
        updated_at = NOW()
      WHERE fantasy_lineups.is_locked = false
      RETURNING lineup_id, is_locked, lock_deadline
    `;

    // 11. Calculate hours until lock
    const hoursUntilLock = Math.max(
      0,
      (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)
    );

    // 12. Return success response
    return NextResponse.json({
      success: true,
      lineup_id,
      message: 'Lineup submitted successfully',
      lock_deadline: lock_deadline,
      hours_until_lock: Math.round(hoursUntilLock * 10) / 10,
      is_locked: false
    });

  } catch (error: any) {
    console.error('Error submitting lineup:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Validate lineup structure
 */
function validateLineup(
  starting_players: string[],
  captain_id: string,
  vice_captain_id: string,
  bench_players: string[]
): string[] {
  const errors: string[] = [];

  // Check starting players count
  if (!starting_players || starting_players.length !== 5) {
    errors.push('Must select exactly 5 starting players');
  }

  // Check bench players count
  if (!bench_players || bench_players.length !== 2) {
    errors.push('Must have exactly 2 bench players');
  }

  // Check captain is provided
  if (!captain_id) {
    errors.push('Captain must be selected');
  }

  // Check vice-captain is provided
  if (!vice_captain_id) {
    errors.push('Vice-captain must be selected');
  }

  // Check no duplicates
  const allPlayers = [...(starting_players || []), ...(bench_players || [])];
  const uniquePlayers = new Set(allPlayers);
  if (uniquePlayers.size !== allPlayers.length) {
    errors.push('Cannot select same player multiple times');
  }

  // Check captain is in starting lineup
  if (captain_id && starting_players && !starting_players.includes(captain_id)) {
    errors.push('Captain must be in starting lineup');
  }

  // Check vice-captain is in starting lineup
  if (vice_captain_id && starting_players && !starting_players.includes(vice_captain_id)) {
    errors.push('Vice-captain must be in starting lineup');
  }

  // Check captain != vice-captain
  if (captain_id && vice_captain_id && captain_id === vice_captain_id) {
    errors.push('Captain and vice-captain must be different players');
  }

  return errors;
}
