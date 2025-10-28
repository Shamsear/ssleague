import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

// GET - Fetch tournament settings by tournament_id
export async function GET(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const searchParams = request.nextUrl.searchParams;
    let tournamentId = searchParams.get('tournament_id');
    const seasonId = searchParams.get('season_id');

    // Backward compatibility: If only seasonId provided, get primary tournament
    if (seasonId && !tournamentId) {
      const primaryTournament = await sql`
        SELECT id FROM tournaments 
        WHERE season_id = ${seasonId} AND is_primary = true
        LIMIT 1
      `;
      if (primaryTournament.length > 0) {
        tournamentId = primaryTournament[0].id;
      } else {
        tournamentId = `${seasonId}-LEAGUE`;
      }
    }

    if (!tournamentId) {
      return NextResponse.json(
        { error: 'tournament_id or season_id is required' },
        { status: 400 }
      );
    }

    const settings = await sql`
      SELECT * FROM tournament_settings
      WHERE tournament_id = ${tournamentId}
      LIMIT 1
    `;

    if (settings.length === 0) {
      return NextResponse.json({ settings: null });
    }

    return NextResponse.json({ settings: settings[0] });
  } catch (error) {
    console.error('Error fetching tournament settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tournament settings' },
      { status: 500 }
    );
  }
}

// POST - Create or update tournament settings
export async function POST(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const body = await request.json();
    const { 
      tournament_id,
      tournament_name,
      squad_size,
      tournament_system,
      home_deadline_time,
      away_deadline_time,
      result_day_offset,
      result_deadline_time,
      has_knockout_stage,
      playoff_teams,
      direct_semifinal_teams,
      qualification_threshold,
      is_two_legged,
      num_teams,
      awards_enabled,
      awards_config
    } = body;

    if (!tournament_id) {
      return NextResponse.json(
        { error: 'tournament_id is required' },
        { status: 400 }
      );
    }

    // Upsert (insert or update if exists)
    await sql`
      INSERT INTO tournament_settings (
        tournament_id,
        tournament_name,
        squad_size,
        tournament_system,
        home_deadline_time,
        away_deadline_time,
        result_day_offset,
        result_deadline_time,
        has_knockout_stage,
        playoff_teams,
        direct_semifinal_teams,
        qualification_threshold,
        is_two_legged,
        num_teams,
        awards_enabled,
        awards_config,
        created_at,
        updated_at
      ) VALUES (
        ${tournament_id},
        ${tournament_name || null},
        ${squad_size ?? null},
        ${tournament_system || 'match_round'},
        ${home_deadline_time || '17:00'},
        ${away_deadline_time || '17:00'},
        ${result_day_offset ?? 2},
        ${result_deadline_time || '00:30'},
        ${has_knockout_stage ?? false},
        ${playoff_teams ?? null},
        ${direct_semifinal_teams ?? null},
        ${qualification_threshold ?? null},
        ${is_two_legged !== undefined ? is_two_legged : true},
        ${num_teams || null},
        ${awards_enabled ?? true},
        ${JSON.stringify(awards_config || {})},
        NOW(),
        NOW()
      )
      ON CONFLICT (tournament_id) DO UPDATE SET
        tournament_name = EXCLUDED.tournament_name,
        squad_size = EXCLUDED.squad_size,
        tournament_system = EXCLUDED.tournament_system,
        home_deadline_time = EXCLUDED.home_deadline_time,
        away_deadline_time = EXCLUDED.away_deadline_time,
        result_day_offset = EXCLUDED.result_day_offset,
        result_deadline_time = EXCLUDED.result_deadline_time,
        has_knockout_stage = EXCLUDED.has_knockout_stage,
        playoff_teams = EXCLUDED.playoff_teams,
        direct_semifinal_teams = EXCLUDED.direct_semifinal_teams,
        qualification_threshold = EXCLUDED.qualification_threshold,
        is_two_legged = EXCLUDED.is_two_legged,
        num_teams = EXCLUDED.num_teams,
        awards_enabled = EXCLUDED.awards_enabled,
        awards_config = EXCLUDED.awards_config,
        updated_at = NOW()
    `;

    return NextResponse.json({ 
      success: true,
      message: 'Tournament settings saved successfully' 
    });
  } catch (error) {
    console.error('Error saving tournament settings:', error);
    return NextResponse.json(
      { error: 'Failed to save tournament settings' },
      { status: 500 }
    );
  }
}

// DELETE - Delete tournament settings
export async function DELETE(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const searchParams = request.nextUrl.searchParams;
    const tournamentId = searchParams.get('tournament_id');

    if (!tournamentId) {
      return NextResponse.json(
        { error: 'tournament_id is required' },
        { status: 400 }
      );
    }

    await sql`
      DELETE FROM tournament_settings
      WHERE tournament_id = ${tournamentId}
    `;

    return NextResponse.json({ 
      success: true,
      message: 'Tournament settings deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting tournament settings:', error);
    return NextResponse.json(
      { error: 'Failed to delete tournament settings' },
      { status: 500 }
    );
  }
}
