import { NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';
import { adminDb } from '@/lib/firebase/admin';

export async function POST() {
  try {
    console.log('🔧 Fixing fantasy team owner UIDs...\n');
    
    const teams = await fantasySql`
      SELECT id, team_id, real_team_name, owner_uid, owner_name 
      FROM fantasy_teams
      ORDER BY id ASC
    `;
    
    const results = [];
    
    for (const team of teams) {
      const teamResult: any = {
        team_name: team.real_team_name,
        team_id: team.team_id,
        old_uid: team.owner_uid || '(empty)',
        status: 'checking'
      };
      
      try {
        const teamDoc = await adminDb.collection('teams').doc(team.team_id).get();
        
        if (!teamDoc.exists) {
          teamResult.status = 'team_not_found';
          results.push(teamResult);
          continue;
        }
        
        const teamData = teamDoc.data()!;
        const correctUid = teamData.uid;
        
        if (!correctUid) {
          teamResult.status = 'no_uid_in_firebase';
          results.push(teamResult);
          continue;
        }
        
        if (correctUid !== team.owner_uid) {
          await fantasySql`
            UPDATE fantasy_teams
            SET owner_uid = ${correctUid},
                updated_at = NOW()
            WHERE id = ${team.id}
          `;
          
          teamResult.new_uid = correctUid;
          teamResult.status = 'updated';
        } else {
          teamResult.new_uid = correctUid;
          teamResult.status = 'already_correct';
        }
        
        results.push(teamResult);
        
      } catch (error) {
        teamResult.status = 'error';
        teamResult.error = error instanceof Error ? error.message : 'Unknown error';
        results.push(teamResult);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Owner UIDs fixed',
      results
    });
    
  } catch (error) {
    console.error('Error fixing owner UIDs:', error);
    return NextResponse.json(
      { error: 'Failed to fix owner UIDs', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
