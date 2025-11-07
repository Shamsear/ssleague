import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/auth-helper';

export async function POST(request: NextRequest) {
  // ✅ ZERO FIREBASE READS - Uses JWT claims only
  const auth = await verifyAuth(['admin', 'committee_admin'], request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }
  try {
    console.log('🔧 Fixing fantasy team owner names...\n');
    
    const teams = await fantasySql`
      SELECT id, team_id, real_team_name, owner_uid, owner_name 
      FROM fantasy_teams
      WHERE owner_uid IS NOT NULL AND owner_uid != ''
      ORDER BY id ASC
    `;
    
    const results = [];
    
    for (const team of teams) {
      const result: any = {
        team_name: team.real_team_name,
        old_owner_name: team.owner_name
      };
      
      try {
        // Get user data from Firebase
        const userDoc = await adminDb.collection('users').doc(team.owner_uid).get();
        
        if (!userDoc.exists) {
          result.status = 'user_not_found';
          results.push(result);
          continue;
        }
        
        const userData = userDoc.data()!;
        
        // Get actual name: firstName + lastName, or firstName alone, or username
        const actualName = userData.firstName && userData.lastName 
          ? `${userData.firstName} ${userData.lastName}`.trim()
          : userData.firstName || userData.username || team.owner_name;
        
        result.new_owner_name = actualName;
        
        if (actualName !== team.owner_name) {
          await fantasySql`
            UPDATE fantasy_teams
            SET owner_name = ${actualName},
                updated_at = NOW()
            WHERE id = ${team.id}
          `;
          result.status = 'updated';
        } else {
          result.status = 'already_correct';
        }
        
        results.push(result);
        
      } catch (error) {
        result.status = 'error';
        result.error = error instanceof Error ? error.message : 'Unknown';
        results.push(result);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Owner names updated',
      results
    });
    
  } catch (error) {
    console.error('Error fixing owner names:', error);
    return NextResponse.json(
      { error: 'Failed to fix owner names' },
      { status: 500 }
    );
  }
}
