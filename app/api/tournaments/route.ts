import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { generateSeasonCreatedNews, generateSeasonActiveNews } from '@/lib/news/season-events';

// GET - List all tournaments or filter by season
export async function GET(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const searchParams = request.nextUrl.searchParams;
    const seasonId = searchParams.get('season_id');
    const status = searchParams.get('status');

    let tournaments;

    if (seasonId) {
      // Get tournaments for specific season
      if (status) {
        tournaments = await sql`
          SELECT * FROM tournaments
          WHERE season_id = ${seasonId} AND status = ${status}
          ORDER BY display_order ASC, created_at ASC
        `;
      } else {
        tournaments = await sql`
          SELECT * FROM tournaments
          WHERE season_id = ${seasonId}
          ORDER BY display_order ASC, created_at ASC
        `;
      }
    } else if (status) {
      // Get all tournaments by status
      tournaments = await sql`
        SELECT * FROM tournaments
        WHERE status = ${status}
        ORDER BY created_at DESC
      `;
    } else {
      // Get all tournaments
      tournaments = await sql`
        SELECT * FROM tournaments
        ORDER BY created_at DESC
      `;
    }

    return NextResponse.json({ success: true, tournaments });
  } catch (error) {
    console.error('Error fetching tournaments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tournaments' },
      { status: 500 }
    );
  }
}

// POST - Create a new tournament
export async function POST(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const body = await request.json();
    const {
      season_id,
      tournament_type,
      tournament_name,
      tournament_code,
      status,
      start_date,
      end_date,
      description,
      is_primary,
      display_order,
      include_in_fantasy,
      include_in_awards,
      // Format settings
      has_league_stage,
      has_group_stage,
      group_assignment_mode,
      number_of_groups,
      teams_per_group,
      teams_advancing_per_group,
      // Knockout stage settings
      has_knockout_stage,
      playoff_teams,
      direct_semifinal_teams,
      qualification_threshold,
      is_pure_knockout,
      // Tournament settings
      squad_size,
      tournament_system,
      home_deadline_time,
      away_deadline_time,
      result_day_offset,
      result_deadline_time,
    } = body;

    if (!season_id || !tournament_type || !tournament_name) {
      return NextResponse.json(
        { success: false, error: 'season_id, tournament_type, and tournament_name are required' },
        { status: 400 }
      );
    }

    // Generate tournament ID following SSPSL[SEASON][TYPE] convention
    // Extract season number from season_id (e.g., "SSPSLS16" -> "S16")
    const seasonMatch = season_id.match(/S(\d+)/);
    const seasonNumber = seasonMatch ? `S${seasonMatch[1]}` : season_id;
    
    // Map tournament types to codes
    const typeCodeMap: Record<string, string> = {
      'league': 'L',
      'cup': 'C',
      'ucl': 'CH',
      'uel': 'EL',
      'super_cup': 'SC',
      'league_cup': 'LC',
    };
    
    const typeCode = typeCodeMap[tournament_type.toLowerCase()] || tournament_type.toUpperCase();
    const tournamentId = `SSPSL${seasonNumber}${typeCode}`;
    
    // Use generated ID as tournament_code if not provided
    const finalTournamentCode = tournament_code || tournamentId;

    // Insert tournament
    const result = await sql`
      INSERT INTO tournaments (
        id,
        season_id,
        tournament_type,
        tournament_name,
        tournament_code,
        status,
        start_date,
        end_date,
        description,
        is_primary,
        display_order,
        include_in_fantasy,
        include_in_awards,
        has_league_stage,
        has_group_stage,
        group_assignment_mode,
        number_of_groups,
        teams_per_group,
        teams_advancing_per_group,
        has_knockout_stage,
        playoff_teams,
        direct_semifinal_teams,
        qualification_threshold,
        is_pure_knockout,
        created_at,
        updated_at
      ) VALUES (
        ${tournamentId},
        ${season_id},
        ${tournament_type},
        ${tournament_name},
        ${finalTournamentCode},
        ${status || 'upcoming'},
        ${start_date || null},
        ${end_date || null},
        ${description || null},
        ${is_primary ?? false},
        ${display_order ?? 0},
        ${include_in_fantasy ?? true},
        ${include_in_awards ?? true},
        ${has_league_stage ?? true},
        ${has_group_stage ?? false},
        ${group_assignment_mode || 'auto'},
        ${number_of_groups ?? 4},
        ${teams_per_group ?? 4},
        ${teams_advancing_per_group ?? 2},
        ${has_knockout_stage ?? false},
        ${playoff_teams ?? 4},
        ${direct_semifinal_teams ?? 2},
        ${qualification_threshold ?? 75},
        ${is_pure_knockout ?? false},
        NOW(),
        NOW()
      )
      ON CONFLICT (season_id, tournament_type) DO UPDATE SET
        tournament_name = EXCLUDED.tournament_name,
        tournament_code = EXCLUDED.tournament_code,
        status = EXCLUDED.status,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        description = EXCLUDED.description,
        is_primary = EXCLUDED.is_primary,
        display_order = EXCLUDED.display_order,
        include_in_fantasy = EXCLUDED.include_in_fantasy,
        include_in_awards = EXCLUDED.include_in_awards,
        has_group_stage = EXCLUDED.has_group_stage,
        group_assignment_mode = EXCLUDED.group_assignment_mode,
        number_of_groups = EXCLUDED.number_of_groups,
        teams_per_group = EXCLUDED.teams_per_group,
        teams_advancing_per_group = EXCLUDED.teams_advancing_per_group,
        has_knockout_stage = EXCLUDED.has_knockout_stage,
        playoff_teams = EXCLUDED.playoff_teams,
        direct_semifinal_teams = EXCLUDED.direct_semifinal_teams,
        qualification_threshold = EXCLUDED.qualification_threshold,
        is_pure_knockout = EXCLUDED.is_pure_knockout,
        updated_at = NOW()
      RETURNING *
    `;

    // Create tournament_settings record
    await sql`
      INSERT INTO tournament_settings (
        tournament_id,
        season_id,
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
        created_at,
        updated_at
      ) VALUES (
        ${tournamentId},
        ${season_id},
        ${squad_size ?? 11},
        ${tournament_system || 'match_round'},
        ${home_deadline_time || '17:00'},
        ${away_deadline_time || '17:00'},
        ${result_day_offset ?? 2},
        ${result_deadline_time || '00:30'},
        ${has_knockout_stage ?? false},
        ${playoff_teams ?? 4},
        ${direct_semifinal_teams ?? 2},
        ${qualification_threshold ?? 75},
        NOW(),
        NOW()
      )
      ON CONFLICT (tournament_id) DO UPDATE SET
        season_id = EXCLUDED.season_id,
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
        updated_at = NOW()
    `;

    // Auto-generate news for season creation
    const tournament = result[0];
    const seasonName = season_id.replace('SSPSLS', 'Season ');
    
    // Generate news asynchronously (non-blocking)
    if (tournament.is_primary) {
      // Only generate news for primary tournaments (usually the league)
      generateSeasonCreatedNews(season_id, seasonName).catch(error => {
        console.error('Failed to generate season creation news:', error);
      });
    }

    return NextResponse.json({
      success: true,
      tournament: tournament,
      message: 'Tournament created successfully',
    });
  } catch (error) {
    console.error('Error creating tournament:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create tournament' },
      { status: 500 }
    );
  }
}
