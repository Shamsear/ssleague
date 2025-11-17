import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
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
    const { FieldValue } = await import('firebase-admin/firestore');
    
    await adminDb.collection('teams').doc(teamId).set({
      id: teamId,
      team_name: teamName || username,
      owner_name: username,
      uid: uid,
      userId: uid,
      owner_uid: uid,
      userEmail: email,
      email: email,
      role: 'team',
      is_active: true,
      seasons: [],
      current_season_id: '',
      performance_history: {},
      hasUserAccount: true,
      is_historical: false,
      total_seasons_participated: 0,
      fantasy_participating: false,
      fantasy_joined_at: null,
      manager_name: '',
      created_at: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`✅ Team document created: ${teamId}`);

    // CRITICAL: Update user document with teamId so season registration can find the team
    try {
      await adminDb.collection('users').doc(uid).update({
        teamId: teamId,
        updated_at: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`✅ User document updated with teamId: ${teamId}`);
    } catch (userUpdateError) {
      console.error('Error updating user document with teamId:', userUpdateError);
      // This is critical but we'll log and continue
    }

    // Set custom claims for the user (enables role-based auth without DB reads)
    try {
      const user = await adminAuth.getUser(uid);
      const currentClaims = user.customClaims || {};
      
      await adminAuth.setCustomUserClaims(uid, {
        ...currentClaims,
        role: 'team',
      });
      
      console.log(`✅ Custom claims set for user ${uid}: role=team`);
    } catch (claimsError) {
      console.error('Error setting custom claims:', claimsError);
      // Don't fail the request if claims fail - can be set later
    }

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
