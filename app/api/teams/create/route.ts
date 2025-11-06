import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { formatId, ID_PREFIXES, ID_PADDING } from '@/lib/id-utils';

/**
 * Create a team document in Firestore teams collection
 * POST /api/teams/create
 */
export async function POST(request: NextRequest) {
  try {
    const { uid, email, username, teamName } = await request.json();

    if (!uid || !email || !username) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate team ID from Firestore teams collection
    const teamsRef = collection(db, 'teams');
    const q = query(teamsRef, orderBy('createdAt', 'desc'), limit(1));
    const snapshot = await getDocs(q);
    
    let nextCounter = 1;
    
    if (!snapshot.empty) {
      const lastDoc = snapshot.docs[0];
      const lastId = lastDoc.id;
      
      const numericPart = lastId.replace(/\D/g, '');
      if (numericPart) {
        const lastCounter = parseInt(numericPart, 10);
        if (!isNaN(lastCounter)) {
          nextCounter = lastCounter + 1;
        }
      }
    }
    
    const teamId = formatId(ID_PREFIXES.TEAM, nextCounter, ID_PADDING.TEAM);
    console.log(`✅ Generated team ID: ${teamId} for ${username}`);

    // Create team document using Admin SDK
    await adminDb.collection('teams').doc(teamId).set({
      id: teamId,
      team_name: teamName || username,
      owner_name: username,
      owner_uid: uid,
      username: username,
      userEmail: email,
      role: 'team',
      is_active: true,
      is_approved: false,
      seasons: [],
      current_season_id: '',
      performance_history: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`✅ Team document created: ${teamId}`);

    return NextResponse.json({
      success: true,
      teamId,
    });
  } catch (error: any) {
    console.error('Error creating team document:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create team document',
      },
      { status: 500 }
    );
  }
}
