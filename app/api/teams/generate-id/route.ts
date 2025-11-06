import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { formatId, ID_PREFIXES, ID_PADDING } from '@/lib/id-utils';

/**
 * Generate a new team ID by checking Firestore teams collection
 * POST /api/teams/generate-id
 */
export async function POST() {
  try {
    // Query the teams collection to get the latest team ID
    const teamsRef = collection(db, 'teams');
    const q = query(teamsRef, orderBy('createdAt', 'desc'), limit(1));
    const snapshot = await getDocs(q);
    
    let nextCounter = 1;
    
    if (!snapshot.empty) {
      const lastDoc = snapshot.docs[0];
      const lastId = lastDoc.id; // Document ID is the team ID
      
      // Extract numeric part from ID (e.g., "SSPSLT0013" -> 13)
      const numericPart = lastId.replace(/\D/g, '');
      if (numericPart) {
        const lastCounter = parseInt(numericPart, 10);
        if (!isNaN(lastCounter)) {
          nextCounter = lastCounter + 1;
        }
      }
    }
    
    const teamId = formatId(ID_PREFIXES.TEAM, nextCounter, ID_PADDING.TEAM);
    console.log(`✅ Generated new team ID: ${teamId}`);
    
    return NextResponse.json({
      success: true,
      teamId,
    });
  } catch (error: any) {
    console.error('Error generating team ID:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate team ID',
      },
      { status: 500 }
    );
  }
}
