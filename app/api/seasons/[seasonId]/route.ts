import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> }
) {
  try {
    const { seasonId } = await params;

    if (!seasonId) {
      return NextResponse.json(
        { success: false, message: 'Invalid season ID' },
        { status: 400 }
      );
    }

    // Fetch season document from Firestore
    const seasonDoc = await getDoc(doc(db, 'seasons', seasonId));

    if (!seasonDoc.exists()) {
      return NextResponse.json(
        { success: false, message: 'Season not found' },
        { status: 404 }
      );
    }

    const seasonData = seasonDoc.data();

    // Transform the season data for the response
    const responseData = {
      id: seasonDoc.id,
      name: seasonData.name,
      short_name: seasonData.short_name || '',
      is_active: seasonData.is_active || false,
      status: seasonData.status || 'upcoming',
      starting_balance: seasonData.starting_balance || 15000,
      created_at: seasonData.created_at,
      updated_at: seasonData.updated_at,
    };

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('Error fetching season:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
