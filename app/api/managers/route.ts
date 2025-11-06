import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { formatId, ID_PREFIXES, ID_PADDING } from '@/lib/id-utils';

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

    const sql = getTournamentDb();

    // Check if team already has a manager for this season
    const existingManager = await sql`
      SELECT * FROM managers 
      WHERE team_id = ${teamId} 
      AND season_id = ${seasonId}
    `;

    if (existingManager.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Team already has a manager registered for this season',
        },
        { status: 409 }
      );
    }

    // Generate unique manager ID
    const latestManager = await sql`
      SELECT manager_id FROM managers
      ORDER BY id DESC
      LIMIT 1
    `;

    let nextCounter = 1;
    if (latestManager.length > 0) {
      const lastId = latestManager[0].manager_id;
      const numericPart = lastId.replace(/\D/g, '');
      if (numericPart) {
        const lastCounter = parseInt(numericPart, 10);
        if (!isNaN(lastCounter)) {
          nextCounter = lastCounter + 1;
        }
      }
    }

    const managerId = formatId(ID_PREFIXES.MANAGER, nextCounter, ID_PADDING.MANAGER);

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

    // If playing manager, details are already provided from form
    // Otherwise, set non-playing manager details
    if (!isPlayer) {
      managerData.email = email || null;
      managerData.phone = phone || null;
      managerData.date_of_birth = dateOfBirth || null;
      managerData.place = place || null;
      managerData.nationality = nationality || null;
      managerData.jersey_number = jerseyNumber || null;
    }

    // Insert manager
    const result = await sql`
      INSERT INTO managers (
        manager_id, team_id, season_id, name, photo_url, photo_file_id,
        player_id, is_player, email, phone, date_of_birth, place,
        nationality, jersey_number, created_by
      ) VALUES (
        ${managerData.manager_id},
        ${managerData.team_id},
        ${managerData.season_id},
        ${managerData.name},
        ${managerData.photo_url},
        ${managerData.photo_file_id},
        ${managerData.player_id},
        ${managerData.is_player},
        ${managerData.email},
        ${managerData.phone},
        ${managerData.date_of_birth},
        ${managerData.place},
        ${managerData.nationality},
        ${managerData.jersey_number},
        ${managerData.created_by}
      )
      RETURNING *
    `;

    return NextResponse.json({
      success: true,
      message: 'Manager registered successfully',
      data: result[0],
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

    const sql = getTournamentDb();

    let managers;
    if (teamId && seasonId) {
      managers = await sql`
        SELECT * FROM managers 
        WHERE is_active = true 
        AND team_id = ${teamId} 
        AND season_id = ${seasonId}
        ORDER BY created_at DESC
      `;
    } else if (teamId) {
      managers = await sql`
        SELECT * FROM managers 
        WHERE is_active = true 
        AND team_id = ${teamId}
        ORDER BY created_at DESC
      `;
    } else if (seasonId) {
      managers = await sql`
        SELECT * FROM managers 
        WHERE is_active = true 
        AND season_id = ${seasonId}
        ORDER BY created_at DESC
      `;
    } else {
      managers = await sql`
        SELECT * FROM managers 
        WHERE is_active = true
        ORDER BY created_at DESC
      `;
    }

    return NextResponse.json({
      success: true,
      data: managers,
    });
  } catch (error: any) {
    console.error('Error fetching managers:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch managers' },
      { status: 500 }
    );
  }
}
