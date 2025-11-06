import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { generateId, ID_PREFIXES } from '@/lib/id-utils';

// POST - Create new manager
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      teamId,
      seasonId,
      playerId,
      isPlayer,
      name,
      email,
      phone,
      dateOfBirth,
      place,
      nationality,
      jerseyNumber,
      photoUrl,
      photoFileId,
      createdBy,
    } = body;

    // Validation
    if (!teamId || !seasonId || !name) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    const db = getTournamentDb();

    // Check if team already has a manager for this season
    const existingManager = await db.query(
      'SELECT * FROM managers WHERE team_id = $1 AND season_id = $2',
      [teamId, seasonId]
    );

    if (existingManager.rows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Team already has a manager registered for this season',
        },
        { status: 409 }
      );
    }

    // Generate unique manager ID
    const managerId = await generateId(ID_PREFIXES.MANAGER, db, 'managers', 'manager_id');

    // Get player details if playing manager
    let managerData: any = {
      manager_id: managerId,
      team_id: teamId,
      season_id: seasonId,
      name,
      is_player: isPlayer || false,
      player_id: playerId || null,
      photo_url: photoUrl || null,
      photo_file_id: photoFileId || null,
      created_by: createdBy || null,
    };

    // If playing manager, fetch additional details from real players
    if (isPlayer && playerId) {
      const playerResult = await db.query(
        `SELECT email, phone, date_of_birth, place, photo_url, photo_file_id 
         FROM real_players 
         WHERE player_id = $1`,
        [playerId]
      );

      if (playerResult.rows.length > 0) {
        const player = playerResult.rows[0];
        managerData.email = player.email;
        managerData.phone = player.phone;
        managerData.date_of_birth = player.date_of_birth;
        managerData.place = player.place;
        managerData.photo_url = player.photo_url;
        managerData.photo_file_id = player.photo_file_id;
      }
    } else {
      // Non-playing manager details
      managerData.email = email || null;
      managerData.phone = phone || null;
      managerData.date_of_birth = dateOfBirth || null;
      managerData.place = place || null;
      managerData.nationality = nationality || null;
      managerData.jersey_number = jerseyNumber || null;
    }

    // Insert manager
    const result = await db.query(
      `INSERT INTO managers (
        manager_id, team_id, season_id, name, photo_url, photo_file_id,
        player_id, is_player, email, phone, date_of_birth, place,
        nationality, jersey_number, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        managerData.manager_id,
        managerData.team_id,
        managerData.season_id,
        managerData.name,
        managerData.photo_url,
        managerData.photo_file_id,
        managerData.player_id,
        managerData.is_player,
        managerData.email,
        managerData.phone,
        managerData.date_of_birth,
        managerData.place,
        managerData.nationality,
        managerData.jersey_number,
        managerData.created_by,
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Manager registered successfully',
      data: result.rows[0],
    });
  } catch (error: any) {
    console.error('Error creating manager:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to create manager' },
      { status: 500 }
    );
  }
}

// GET - List managers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const seasonId = searchParams.get('seasonId');

    const db = getTournamentDb();

    let query = 'SELECT * FROM managers WHERE is_active = true';
    const params: string[] = [];

    if (teamId) {
      params.push(teamId);
      query += ` AND team_id = $${params.length}`;
    }

    if (seasonId) {
      params.push(seasonId);
      query += ` AND season_id = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);

    return NextResponse.json({
      success: true,
      data: result.rows,
    });
  } catch (error: any) {
    console.error('Error fetching managers:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch managers' },
      { status: 500 }
    );
  }
}
