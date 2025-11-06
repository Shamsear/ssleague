import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * PUT /api/owners/[id] - Update an owner
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const {
      name,
      email,
      phone,
      dateOfBirth,
      place,
      nationality,
      bio,
      instagramHandle,
      twitterHandle,
      photoUrl,
      photoFileId,
    } = body;

    const ownerId = params.id;

    const sql = getTournamentDb();

    // Check if owner exists
    const existing = await sql`
      SELECT * FROM owners WHERE owner_id = ${ownerId} LIMIT 1
    `;

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Owner not found' },
        { status: 404 }
      );
    }

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (email !== undefined) {
      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramCount++}`);
      values.push(phone);
    }
    if (dateOfBirth !== undefined) {
      updates.push(`date_of_birth = $${paramCount++}`);
      values.push(dateOfBirth || null);
    }
    if (place !== undefined) {
      updates.push(`place = $${paramCount++}`);
      values.push(place || null);
    }
    if (nationality !== undefined) {
      updates.push(`nationality = $${paramCount++}`);
      values.push(nationality || null);
    }
    if (bio !== undefined) {
      updates.push(`bio = $${paramCount++}`);
      values.push(bio || null);
    }
    if (instagramHandle !== undefined) {
      updates.push(`instagram_handle = $${paramCount++}`);
      values.push(instagramHandle || null);
    }
    if (twitterHandle !== undefined) {
      updates.push(`twitter_handle = $${paramCount++}`);
      values.push(twitterHandle || null);
    }
    if (photoUrl !== undefined) {
      updates.push(`photo_url = $${paramCount++}`);
      values.push(photoUrl);
    }
    if (photoFileId !== undefined) {
      updates.push(`photo_file_id = $${paramCount++}`);
      values.push(photoFileId || null);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No fields to update' },
        { status: 400 }
      );
    }

    // Add updated_at
    updates.push(`updated_at = NOW()`);
    values.push(ownerId);

    const result = await sql`
      UPDATE owners
      SET ${sql(updates.join(', '))}
      WHERE owner_id = ${ownerId}
      RETURNING *
    `;

    return NextResponse.json({
      success: true,
      message: 'Owner updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating owner:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update owner' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/owners/[id] - Get a specific owner
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ownerId = params.id;
    const sql = getTournamentDb();

    const result = await sql`
      SELECT * FROM owners WHERE owner_id = ${ownerId} LIMIT 1
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Owner not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error fetching owner:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch owner' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/owners/[id] - Delete an owner
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ownerId = params.id;
    const sql = getTournamentDb();

    // Check if owner exists
    const existing = await sql`
      SELECT * FROM owners WHERE owner_id = ${ownerId} LIMIT 1
    `;

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Owner not found' },
        { status: 404 }
      );
    }

    // Delete from ImageKit if photo_file_id exists
    if (existing[0].photo_file_id) {
      try {
        const { deleteImage } = await import('@/lib/imagekit/upload');
        await deleteImage(existing[0].photo_file_id);
      } catch (err) {
        console.error('Error deleting photo from ImageKit:', err);
        // Continue with database deletion even if ImageKit deletion fails
      }
    }

    // Delete owner
    await sql`DELETE FROM owners WHERE owner_id = ${ownerId}`;

    return NextResponse.json({
      success: true,
      message: 'Owner deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting owner:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to delete owner' },
      { status: 500 }
    );
  }
}
