import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: seasonId } = await params;
    
    // Get current season data
    const seasonRef = adminDb.collection('seasons').doc(seasonId);
    const seasonDoc = await seasonRef.get();
    
    if (!seasonDoc.exists) {
      return NextResponse.json(
        {
          success: false,
          error: 'Season not found',
        },
        { status: 404 }
      );
    }
    
    const seasonData = seasonDoc.data()!;
    const currentStatus = seasonData.is_player_registration_open || false;
    const newStatus = !currentStatus;
    
    // Update the status
    await seasonRef.update({
      is_player_registration_open: newStatus,
      updated_at: FieldValue.serverTimestamp(),
    });
    
    return NextResponse.json({
      success: true,
      message: `Player registration ${newStatus ? 'opened' : 'closed'} successfully`,
      season: {
        id: seasonId,
        name: seasonData.name,
        is_player_registration_open: newStatus,
      },
    });
    
  } catch (error: any) {
    console.error('Error toggling player registration:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

// GET to check current status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: seasonId } = await params;
    
    const seasonDoc = await adminDb.collection('seasons').doc(seasonId).get();
    
    if (!seasonDoc.exists) {
      return NextResponse.json(
        {
          success: false,
          error: 'Season not found',
        },
        { status: 404 }
      );
    }
    
    const seasonData = seasonDoc.data()!;
    
    return NextResponse.json({
      success: true,
      season: {
        id: seasonId,
        name: seasonData.name,
        is_player_registration_open: seasonData.is_player_registration_open || false,
      },
    });
    
  } catch (error: any) {
    console.error('Error checking player registration status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
