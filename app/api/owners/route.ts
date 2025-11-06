import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { formatId, ID_PREFIXES, ID_PADDING } from '@/lib/id-utils';

/**
 * POST /api/owners - Create a new owner
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      teamId,
      name,
      email,
      registeredEmail,
      phone,
      dateOfBirth,
      place,
      nationality,
      bio,
      instagramHandle,
      twitterHandle,
      photoUrl,
      photoFileId,
      registeredUserId,
    } = body;

    // Validation
    if (!teamId || !name || !email || !phone) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: teamId, name, email, phone' },
        { status: 400 }
      );
    }

    if (!photoUrl) {
      return NextResponse.json(
        { success: false, message: 'Photo is required' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();

    // Check if owner already exists for this team
    const existingOwner = await sql`
      SELECT owner_id FROM owners
      WHERE team_id = ${teamId}
      LIMIT 1
    `;

    if (existingOwner.length > 0) {
      return NextResponse.json(
        { success: false, message: 'Owner already registered for this team' },
        { status: 400 }
      );
    }

    // Generate owner ID
    const latestOwner = await sql`
      SELECT owner_id FROM owners
      ORDER BY id DESC
      LIMIT 1
    `;

    let nextCounter = 1;
    if (latestOwner.length > 0) {
      const lastId = latestOwner[0].owner_id;
      const numericPart = lastId.replace(/\D/g, '');
      if (numericPart) {
        const lastCounter = parseInt(numericPart, 10);
        if (!isNaN(lastCounter)) {
          nextCounter = lastCounter + 1;
        }
      }
    }

    const ownerId = formatId(ID_PREFIXES.OWNER, nextCounter, ID_PADDING.OWNER);

    // Insert owner - handle null values properly
    const dobValue = dateOfBirth || null;
    const placeValue = place || null;
    const nationalityValue = nationality || null;
    const bioValue = bio || null;
    const instagramValue = instagramHandle || null;
    const twitterValue = twitterHandle || null;
    const photoFileIdValue = photoFileId || null;
    const registeredUserIdValue = registeredUserId || null;

    const result = await sql`
      INSERT INTO owners (
        owner_id,
        team_id,
        name,
        email,
        registered_email,
        phone,
        date_of_birth,
        place,
        nationality,
        bio,
        instagram_handle,
        twitter_handle,
        photo_url,
        photo_file_id,
        is_active,
        registered_user_id,
        created_by
      ) VALUES (
        ${ownerId},
        ${teamId},
        ${name},
        ${email},
        ${registeredEmail || email},
        ${phone},
        ${dobValue},
        ${placeValue},
        ${nationalityValue},
        ${bioValue},
        ${instagramValue},
        ${twitterValue},
        ${photoUrl},
        ${photoFileIdValue},
        true,
        ${registeredUserIdValue},
        ${registeredUserIdValue}
      )
      RETURNING *
    `;

    return NextResponse.json({
      success: true,
      message: 'Owner registered successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating owner:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to create owner' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/owners?teamId=xxx - Get owner for a team
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    if (!teamId) {
      return NextResponse.json(
        { success: false, message: 'teamId is required' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();

    // Get owner for team
    const owners = await sql`
      SELECT * FROM owners
      WHERE team_id = ${teamId}
      AND is_active = true
      LIMIT 1
    `;

    return NextResponse.json({
      success: true,
      data: owners.length > 0 ? owners[0] : null,
    });
  } catch (error: any) {
    console.error('Error fetching owners:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch owners' },
      { status: 500 }
    );
  }
}
