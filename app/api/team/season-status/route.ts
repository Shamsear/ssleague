import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { getAuthToken } from '@/lib/auth/token-helper';
import { adminAuth } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    // Get token from Authorization header or cookie
    const token = await getAuthToken(request);
    
    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized - Please login',
      }, { status: 401 });
    }

    // Verify Firebase ID token
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      console.error('Token verification error:', error);
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;

    // First, check if user is registered for any season
    console.log('Checking registration for userId:', userId);
    
    const teamSeasonsQuery = query(
      collection(db, 'team_seasons'),
      where('team_id', '==', userId),
      where('status', '==', 'registered'),
      limit(1)
    );
    const teamSeasonsSnapshot = await getDocs(teamSeasonsQuery);
    
    console.log('Team seasons found:', teamSeasonsSnapshot.size);
    if (!teamSeasonsSnapshot.empty) {
      console.log('Team season data:', teamSeasonsSnapshot.docs[0].data());
    }

    if (teamSeasonsSnapshot.empty) {
      // Check if there's an active season available for registration
      const activeSeasonsQuery = query(
        collection(db, 'seasons'),
        where('is_active', '==', true),
        limit(1)
      );
      const activeSeasonsSnapshot = await getDocs(activeSeasonsQuery);

      if (!activeSeasonsSnapshot.empty) {
        const seasonDoc = activeSeasonsSnapshot.docs[0];
        return NextResponse.json({
          success: false,
          data: {
            hasActiveSeason: true,
            isRegistered: false,
            seasonName: seasonDoc.data().name,
            seasonId: seasonDoc.id,
          },
        });
      }

      return NextResponse.json({
        success: false,
        data: {
          hasActiveSeason: false,
          isRegistered: false,
        },
      });
    }

    // User is registered for a season - get that season's details
    const teamSeasonDoc = teamSeasonsSnapshot.docs[0];
    const teamSeasonData = teamSeasonDoc.data();
    const seasonId = teamSeasonData.season_id;
    
    const seasonDoc = await getDoc(doc(db, 'seasons', seasonId));
    if (!seasonDoc.exists()) {
      return NextResponse.json({
        success: false,
        data: {
          hasActiveSeason: false,
          isRegistered: false,
        },
      });
    }
    
    const seasonData = seasonDoc.data();

    // Team is registered for this season
    return NextResponse.json({
      success: true,
      data: {
        hasActiveSeason: true,
        isRegistered: true,
        seasonName: seasonData.name,
        seasonId: seasonId,
      },
    });

  } catch (error) {
    console.error('Error checking season status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check season status',
    }, { status: 500 });
  }
}
