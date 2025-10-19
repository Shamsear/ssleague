import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    console.log('Checking teams registered to Season 16...');
    
    const snapshot = await adminDb
      .collection('teamSeasons')
      .where('season_id', '==', 'season_16')
      .get();
    
    console.log(`Total teams registered to season 16: ${snapshot.size}`);
    
    if (snapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'No teams found registered to season 16',
        totalTeams: 0,
        teams: [],
      });
    }
    
    const teams = [];
    let dualCurrencyCount = 0;
    let singleCurrencyCount = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const isDualCurrency = data.currency_system === 'dual';
      
      if (isDualCurrency) dualCurrencyCount++;
      else singleCurrencyCount++;
      
      // Get team name
      let teamName = 'Unknown';
      try {
        const userDoc = await adminDb.collection('users').doc(doc.id).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          teamName = userData?.teamName || userData?.username || 'Unknown';
        }
      } catch (err) {
        console.error('Error fetching team name:', err);
      }
      
      const teamInfo: any = {
        teamId: doc.id,
        teamName,
        seasonId: data.season_id,
        status: data.status || 'N/A',
        currencySystem: data.currency_system || 'single',
      };
      
      if (isDualCurrency) {
        teamInfo.footballBudget = data.football_budget || 0;
        teamInfo.footballSpent = data.football_spent || 0;
        teamInfo.footballRemaining = (data.football_budget || 0) - (data.football_spent || 0);
        teamInfo.realPlayerBudget = data.real_player_budget || 0;
        teamInfo.realPlayerSpent = data.real_player_spent || 0;
        teamInfo.realPlayerRemaining = (data.real_player_budget || 0) - (data.real_player_spent || 0);
        
        // Check for legacy fields
        if (data.balance !== undefined || data.total_spent !== undefined) {
          teamInfo.hasLegacyFields = true;
          teamInfo.legacyBalance = data.balance;
          teamInfo.legacyTotalSpent = data.total_spent;
        }
      } else {
        teamInfo.balance = data.balance || 0;
        teamInfo.totalSpent = data.total_spent || 0;
        teamInfo.remaining = data.balance || 0;
      }
      
      teams.push(teamInfo);
    }
    
    return NextResponse.json({
      success: true,
      totalTeams: snapshot.size,
      dualCurrencyCount,
      singleCurrencyCount,
      teams,
    });
    
  } catch (error: any) {
    console.error('Error checking season 16 teams:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
