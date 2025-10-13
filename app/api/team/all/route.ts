import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { batchGetFirebaseFields } from '@/lib/firebase/batch';
import { getCached, setCached } from '@/lib/firebase/cache';

export async function GET(request: NextRequest) {
  try {
    // Get token cookie and verify authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
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

    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('season_id');

    if (!seasonId) {
      return NextResponse.json({
        success: false,
        error: 'Season ID is required',
      }, { status: 400 });
    }

    // OPTIMIZED: Get season details with cache
    let seasonData = getCached<any>('seasons', seasonId, 10 * 60 * 1000); // 10 min TTL
    if (!seasonData) {
      const seasonDoc = await adminDb.collection('seasons').doc(seasonId).get();
      if (!seasonDoc.exists) {
        return NextResponse.json({
          success: false,
          error: 'Season not found',
        }, { status: 404 });
      }
      seasonData = seasonDoc.data();
      setCached('seasons', seasonId, seasonData);
    }

    const seasonName = seasonData?.name || 'Current Season';

    // Get all teams registered for this season
    const teamSeasonsSnapshot = await adminDb
      .collection('team_seasons')
      .where('season_id', '==', seasonId)
      .where('status', '==', 'registered')
      .get();

    console.time('⚡ Batch fetch team details');
    
    // Step 1: Extract all team IDs
    const teamSeasonDocs = teamSeasonsSnapshot.docs;
    const teamIds = teamSeasonDocs.map(doc => doc.data().team_id).filter(Boolean);
    
    // Step 2: Batch fetch team details from users collection
    const teamsInfoMap = await batchGetFirebaseFields<{ teamName: string; logoUrl: string; logoURL: string; logo_url: string; balance: number }>(
      'users',
      teamIds,
      ['teamName', 'logoUrl', 'logoURL', 'logo_url', 'balance']
    );
    
    console.timeEnd('⚡ Batch fetch team details');
    
    console.time('⚡ Batch fetch all players');
    
    // Step 3: Batch fetch all players for all teams in one query
    const allPlayersSnapshot = await adminDb
      .collection('players')
      .where('season_id', '==', seasonId)
      .where('team_id', 'in', teamIds.slice(0, 10)) // Firebase 'in' query limit is 10
      .get();
    
    // If there are more than 10 teams, fetch additional batches
    const additionalPlayersBatches = [];
    for (let i = 10; i < teamIds.length; i += 10) {
      const batch = teamIds.slice(i, i + 10);
      additionalPlayersBatches.push(
        adminDb
          .collection('players')
          .where('season_id', '==', seasonId)
          .where('team_id', 'in', batch)
          .get()
      );
    }
    
    const additionalPlayersSnapshots = await Promise.all(additionalPlayersBatches);
    
    // Combine all player documents
    const allPlayerDocs = [
      ...allPlayersSnapshot.docs,
      ...additionalPlayersSnapshots.flatMap(snapshot => snapshot.docs)
    ];
    
    console.timeEnd('⚡ Batch fetch all players');
    
    // Step 4: Group players by team_id
    const playersByTeam = new Map<string, any[]>();
    allPlayerDocs.forEach(doc => {
      const player = doc.data();
      const teamId = player.team_id;
      if (!playersByTeam.has(teamId)) {
        playersByTeam.set(teamId, []);
      }
      playersByTeam.get(teamId)!.push(player);
    });
    
    // Step 5: Build teams data
    const teamsData = [];

    for (const teamSeasonDoc of teamSeasonDocs) {
      const teamSeasonData = teamSeasonDoc.data();
      const teamId = teamSeasonData.team_id;
      if (!teamId) continue;

      // Get team details from batch-fetched data
      const teamInfo = teamsInfoMap.get(teamId);
      if (!teamInfo) continue;

      // Get team's players from grouped data
      const teamPlayers = playersByTeam.get(teamId) || [];

      // Calculate statistics
      let totalValue = 0;
      let totalRating = 0;
      const positionBreakdown: { [key: string]: number } = {
        GK: 0,
        CB: 0,
        LB: 0,
        RB: 0,
        DMF: 0,
        CMF: 0,
        AMF: 0,
        LMF: 0,
        RMF: 0,
        LWF: 0,
        RWF: 0,
        SS: 0,
        CF: 0,
      };

      teamPlayers.forEach((player) => {
        // Sum acquisition values
        const acquisitionValue = player.acquisition_value || 0;
        totalValue += acquisitionValue;

        // Count positions
        const position = player.position || 'Unknown';
        if (position in positionBreakdown) {
          positionBreakdown[position]++;
        }

        // Sum ratings
        const rating = player.overall_rating || 0;
        totalRating += rating;
      });

      const totalPlayers = teamPlayers.length;
      const avgRating = totalPlayers > 0 ? totalRating / totalPlayers : 0;

      // Try different logo field names
      const logoUrl = teamInfo?.logoUrl || teamInfo?.logoURL || teamInfo?.logo_url || teamSeasonData?.team_logo || null;
      
      console.log(`Team ${teamId} logo:`, logoUrl, 'Available fields:', Object.keys(teamInfo || {}));
      
      teamsData.push({
        team: {
          id: teamId,
          name: teamInfo?.teamName || 'Unknown Team',
          logoUrl: logoUrl,
          balance: teamInfo?.balance || 0,
        },
        totalPlayers,
        totalValue,
        avgRating: Math.round(avgRating * 10) / 10,
        positionBreakdown,
      });
    }

    // Sort teams by total value (descending)
    teamsData.sort((a, b) => b.totalValue - a.totalValue);

    return NextResponse.json({
      success: true,
      data: {
        teams: teamsData,
        seasonName,
        seasonId,
      },
    });

  } catch (error: any) {
    console.error('Error fetching all teams:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch teams',
    }, { status: 500 });
  }
}
