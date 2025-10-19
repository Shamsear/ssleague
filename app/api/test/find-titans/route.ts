import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    console.log('Searching for TITANS FC across collections...');
    
    const results: any = {
      teamSeasons: [],
      team_seasons: [],
    };
    
    // Check teamSeasons (camelCase)
    try {
      const teamSeasonsSnapshot = await adminDb
        .collection('teamSeasons')
        .where('team_name', '==', 'TITANS FC')
        .get();
      
      console.log(`Found ${teamSeasonsSnapshot.size} in teamSeasons`);
      
      teamSeasonsSnapshot.forEach(doc => {
        results.teamSeasons.push({
          docId: doc.id,
          ...doc.data(),
        });
      });
    } catch (err) {
      console.error('Error checking teamSeasons:', err);
    }
    
    // Check team_seasons (snake_case)
    try {
      const team_seasonsSnapshot = await adminDb
        .collection('team_seasons')
        .where('team_name', '==', 'TITANS FC')
        .get();
      
      console.log(`Found ${team_seasonsSnapshot.size} in team_seasons`);
      
      team_seasonsSnapshot.forEach(doc => {
        results.team_seasons.push({
          docId: doc.id,
          ...doc.data(),
        });
      });
    } catch (err) {
      console.error('Error checking team_seasons:', err);
    }
    
    // Also check all docs with season_id SSPSLS16
    const allCollections: any = {
      teamSeasons_bySeasonId: [],
      team_seasons_bySeasonId: [],
    };
    
    try {
      const bySeasonCamel = await adminDb
        .collection('teamSeasons')
        .where('season_id', '==', 'SSPSLS16')
        .get();
      
      bySeasonCamel.forEach(doc => {
        allCollections.teamSeasons_bySeasonId.push({
          docId: doc.id,
          team_name: doc.data().team_name,
          season_id: doc.data().season_id,
          currency_system: doc.data().currency_system,
        });
      });
    } catch (err) {
      console.error('Error:', err);
    }
    
    try {
      const bySeasonSnake = await adminDb
        .collection('team_seasons')
        .where('season_id', '==', 'SSPSLS16')
        .get();
      
      bySeasonSnake.forEach(doc => {
        allCollections.team_seasons_bySeasonId.push({
          docId: doc.id,
          team_name: doc.data().team_name,
          season_id: doc.data().season_id,
          currency_system: doc.data().currency_system,
        });
      });
    } catch (err) {
      console.error('Error:', err);
    }
    
    return NextResponse.json({
      success: true,
      results,
      bySeasonId: allCollections,
    });
    
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
