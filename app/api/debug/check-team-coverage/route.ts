import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { sql } from '@/lib/neon';

export async function GET(request: NextRequest) {
  try {
    // Get all unique team IDs from Firebase team_seasons
    const teamSeasonsRef = collection(db, 'team_seasons');
    const snapshot = await getDocs(teamSeasonsRef);
    
    const firebaseTeams = new Map<string, Set<string>>();
    snapshot.forEach(doc => {
      const data = doc.data();
      const teamId = data.team_id;
      const teamName = data.team_name;
      
      if (!firebaseTeams.has(teamId)) {
        firebaseTeams.set(teamId, new Set());
      }
      firebaseTeams.get(teamId)!.add(teamName);
    });

    // Get all teams from Neon
    const neonTeams = await sql(
      'SELECT team_uid, team_name, is_active FROM teams ORDER BY team_name'
    );

    const neonTeamIds = new Set(neonTeams.rows.map(t => t.team_uid));
    
    // Find teams in Firebase but not in Neon
    const missingTeams: any[] = [];
    firebaseTeams.forEach((names, teamId) => {
      if (!neonTeamIds.has(teamId)) {
        missingTeams.push({
          team_id: teamId,
          historical_names: Array.from(names),
          count: names.size
        });
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        totalFirebaseTeams: firebaseTeams.size,
        totalNeonTeams: neonTeams.rows.length,
        missingTeams,
        neonTeams: neonTeams.rows,
        summary: {
          teamsInBothSystems: firebaseTeams.size - missingTeams.length,
          teamsOnlyInFirebase: missingTeams.length,
          teamsOnlyInNeon: neonTeams.rows.length - (firebaseTeams.size - missingTeams.length)
        }
      }
    });
  } catch (error: any) {
    console.error('Error checking team coverage:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
