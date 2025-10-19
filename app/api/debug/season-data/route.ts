import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('season_id') || 'SSPSLS16';

    console.log(`\n🔍 DIAGNOSTIC: Checking data for season ${seasonId}\n`);

    // Check seasons collection
    const seasonDoc = await adminDb.collection('seasons').doc(seasonId).get();
    console.log(`Season exists: ${seasonDoc.exists}`);
    if (seasonDoc.exists) {
      console.log('Season data:', JSON.stringify(seasonDoc.data(), null, 2));
    }

    // Check ALL team_seasons (no filters)
    console.log('\n📊 Checking ALL team_seasons:');
    const allTeamSeasons = await adminDb.collection('team_seasons').get();
    console.log(`Total team_seasons documents: ${allTeamSeasons.size}`);
    
    allTeamSeasons.docs.forEach(doc => {
      const data = doc.data();
      console.log(`\n  Document ID: ${doc.id}`);
      console.log(`    season_id: ${data.season_id}`);
      console.log(`    team_name: ${data.team_name}`);
      console.log(`    status: ${data.status}`);
      console.log(`    team_id: ${data.team_id}`);
    });

    // Check team_seasons for this specific season
    console.log(`\n📊 Checking team_seasons for season ${seasonId}:`);
    const seasonTeams = await adminDb
      .collection('team_seasons')
      .where('season_id', '==', seasonId)
      .get();
    console.log(`Team_seasons for ${seasonId}: ${seasonTeams.size}`);
    
    const teamsData = seasonTeams.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Check registered status
    console.log(`\n📊 Checking registered teams for season ${seasonId}:`);
    const registeredTeams = await adminDb
      .collection('team_seasons')
      .where('season_id', '==', seasonId)
      .where('status', '==', 'registered')
      .get();
    console.log(`Registered teams: ${registeredTeams.size}`);

    const registeredTeamsData = registeredTeams.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Check ALL realplayers (no filters)
    console.log('\n👥 Checking ALL realplayers:');
    const allPlayers = await adminDb.collection('realplayers').get();
    console.log(`Total realplayers documents: ${allPlayers.size}`);
    
    const playersData = allPlayers.docs.slice(0, 10).map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        player_id: data.player_id,
        name: data.name,
        is_active: data.is_active,
        is_registered: data.is_registered,
        email: data.email
      };
    });
    console.log('First 10 players:', JSON.stringify(playersData, null, 2));

    // Check registered players
    const registeredPlayers = await adminDb
      .collection('realplayers')
      .where('is_registered', '==', true)
      .get();
    console.log(`\nRegistered players: ${registeredPlayers.size}`);

    // Check active players
    const activePlayers = await adminDb
      .collection('realplayers')
      .where('is_active', '==', true)
      .get();
    console.log(`Active players: ${activePlayers.size}`);

    return NextResponse.json({
      success: true,
      diagnostic: {
        seasonId: seasonId,
        seasonExists: seasonDoc.exists,
        seasonData: seasonDoc.exists ? seasonDoc.data() : null,
        stats: {
          totalTeamSeasons: allTeamSeasons.size,
          teamSeasonsForSeason: seasonTeams.size,
          registeredTeamsForSeason: registeredTeams.size,
          totalRealPlayers: allPlayers.size,
          registeredPlayers: registeredPlayers.size,
          activePlayers: activePlayers.size
        },
        teamsForSeason: teamsData,
        registeredTeams: registeredTeamsData,
        samplePlayers: playersData
      }
    });
  } catch (error: any) {
    console.error('Diagnostic error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
