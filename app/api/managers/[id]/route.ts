import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import ImageKit from 'imagekit';

const imagekit = new ImageKit({
  publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY!,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
  urlEndpoint: process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT!,
});

// GET - Get single manager by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const db = getTournamentDb();
    const result = await db.query(
      'SELECT * FROM managers WHERE manager_id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Manager not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    console.error('Error fetching manager:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch manager' },
      { status: 500 }
    );
  }
}

// PUT - Update manager
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const {
      name,
      email,
      phone,
      dateOfBirth,
      place,
      nationality,
      jerseyNumber,
      photoUrl,
      photoFileId,
      isActive,
    } = body;

    const db = getTournamentDb();

    // Check if manager exists
    const existing = await db.query(
      'SELECT * FROM managers WHERE manager_id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Manager not found' },
        { status: 404 }
      );
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount}`);
      values.push(name);
      paramCount++;
    }

    if (email !== undefined) {
      updates.push(`email = $${paramCount}`);
      values.push(email);
      paramCount++;
    }

    if (phone !== undefined) {
      updates.push(`phone = $${paramCount}`);
      values.push(phone);
      paramCount++;
    }

    if (dateOfBirth !== undefined) {
      updates.push(`date_of_birth = $${paramCount}`);
      values.push(dateOfBirth);
      paramCount++;
    }

    if (place !== undefined) {
      updates.push(`place = $${paramCount}`);
      values.push(place);
      paramCount++;
    }

    if (nationality !== undefined) {
      updates.push(`nationality = $${paramCount}`);
      values.push(nationality);
      paramCount++;
    }

    if (jerseyNumber !== undefined) {
      updates.push(`jersey_number = $${paramCount}`);
      values.push(jerseyNumber);
      paramCount++;
    }

    if (photoUrl !== undefined) {
      updates.push(`photo_url = $${paramCount}`);
      values.push(photoUrl);
      paramCount++;
    }

    if (photoFileId !== undefined) {
      updates.push(`photo_file_id = $${paramCount}`);
      values.push(photoFileId);
      paramCount++;
    }

    if (isActive !== undefined) {
      updates.push(`is_active = $${paramCount}`);
      values.push(isActive);
      paramCount++;
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No fields to update' },
        { status: 400 }
      );
    }

    // Add updated_at
    updates.push(`updated_at = NOW()`);

    // Add manager_id for WHERE clause
    values.push(id);

    const query = `
      UPDATE managers 
      SET ${updates.join(', ')}
      WHERE manager_id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);

    return NextResponse.json({
      success: true,
      message: 'Manager updated successfully',
      data: result.rows[0],
    });
  } catch (error: any) {
    console.error('Error updating manager:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update manager' },
      { status: 500 }
    );
  }
}

// DELETE - Delete manager
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const db = getTournamentDb();

    // Get manager details before deleting
    const managerResult = await db.query(
      'SELECT * FROM managers WHERE manager_id = $1',
      [id]
    );

    if (managerResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Manager not found' },
        { status: 404 }
      );
    }

    const manager = managerResult.rows[0];

    // Delete from database
    await db.query('DELETE FROM managers WHERE manager_id = $1', [id]);

    // Delete photo from ImageKit if it exists and manager is not a player
    if (manager.photo_file_id && !manager.is_player) {
      try {
        await imagekit.deleteFile(manager.photo_file_id);
      } catch (imagekitError) {
        console.error('Error deleting image from ImageKit:', imagekitError);
        // Don't fail the request if ImageKit deletion fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Manager deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting manager:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to delete manager' },
      { status: 500 }
    );
  }
}
