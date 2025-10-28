import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { validateSubstitution } from '@/lib/lineup-validation';

/**
 * POST - Make a substitution (swap starting player with substitute)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { id: lineupId } = await params;
    const body = await request.json();
    const {
      player_out,
      player_out_name,
      player_in,
      player_in_name,
      made_by,
      made_by_name,
      notes,
    } = body;

    if (!player_out || !player_in || !made_by) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate substitution
    const validation = await validateSubstitution(lineupId, player_out, player_in);
    
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Get current lineup
    const lineups = await sql`
      SELECT 
        starting_xi,
        substitutes,
        fixture_id,
        team_id,
        is_locked
      FROM lineups
      WHERE id = ${lineupId}
      LIMIT 1
    `;

    if (lineups.length === 0) {
      return NextResponse.json(
        { error: 'Lineup not found' },
        { status: 404 }
      );
    }

    const lineup = lineups[0];

    // Parse arrays
    let startingXI = lineup.starting_xi as string[];
    let subs = lineup.substitutes as string[];

    // Perform swap
    const outIndex = startingXI.indexOf(player_out);
    const inIndex = subs.indexOf(player_in);

    if (outIndex === -1 || inIndex === -1) {
      return NextResponse.json(
        { error: 'Invalid player IDs' },
        { status: 400 }
      );
    }

    // Swap players
    startingXI[outIndex] = player_in;
    subs[inIndex] = player_out;

    // Update lineup with new arrays
    await sql`
      UPDATE lineups SET
        starting_xi = ${JSON.stringify(startingXI)},
        substitutes = ${JSON.stringify(subs)},
        updated_at = NOW()
      WHERE id = ${lineupId}
    `;

    // Record substitution in history
    await sql`
      INSERT INTO lineup_substitutions (
        lineup_id,
        fixture_id,
        team_id,
        player_out,
        player_out_name,
        player_in,
        player_in_name,
        made_at,
        made_by,
        made_by_name,
        notes
      ) VALUES (
        ${lineupId},
        ${lineup.fixture_id},
        ${lineup.team_id},
        ${player_out},
        ${player_out_name || null},
        ${player_in},
        ${player_in_name || null},
        NOW(),
        ${made_by},
        ${made_by_name || null},
        ${notes || null}
      )
    `;

    return NextResponse.json({
      success: true,
      message: 'Substitution completed successfully',
      lineup: {
        starting_xi: startingXI,
        substitutes: subs,
      },
    });
  } catch (error: any) {
    console.error('Error making substitution:', error);
    return NextResponse.json(
      { error: 'Failed to make substitution', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET - Get substitution history for a lineup
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sql = getTournamentDb();
    const { id: lineupId } = await params;

    const substitutions = await sql`
      SELECT *
      FROM lineup_substitutions
      WHERE lineup_id = ${lineupId}
      ORDER BY made_at ASC
    `;

    return NextResponse.json({
      success: true,
      substitutions,
    });
  } catch (error: any) {
    console.error('Error fetching substitutions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch substitutions' },
      { status: 500 }
    );
  }
}
