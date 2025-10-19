import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { isContractExpired, getContractEndSeason } from '@/lib/contracts';

export async function POST(request: NextRequest) {
  try {
    // Get Firebase ID token from cookie
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - No token' },
        { status: 401 }
      );
    }

    // Verify Firebase ID token
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (err) {
      console.error('Token verification error:', err);
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Check if user is committee admin
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();
    
    if (!userData || userData.role !== 'committee_admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Committee admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { seasonId } = body;

    if (!seasonId) {
      return NextResponse.json(
        { error: 'Missing seasonId' },
        { status: 400 }
      );
    }

    // Get season
    const seasonRef = adminDb.collection('seasons').doc(seasonId);
    const seasonDoc = await seasonRef.get();

    if (!seasonDoc.exists) {
      return NextResponse.json(
        { error: 'Season not found' },
        { status: 404 }
      );
    }

    const seasonData = seasonDoc.data();
    const currentSeasonName = seasonData?.name || '';

    // Get all teams in this season
    const teamsSnapshot = await adminDb
      .collection('teams')
      .where('season_id', '==', seasonId)
      .get();

    let teamsProcessed = 0;
    let realPlayersRemoved = 0;
    let footballPlayersRemoved = 0;
    const expiredPlayers: any[] = [];

    // Process each team
    const batch = adminDb.batch();

    for (const teamDoc of teamsSnapshot.docs) {
      const teamData = teamDoc.data();
      const teamName = teamData.team_name || teamDoc.id;

      // Process real players
      const realPlayers = teamData?.real_players || [];
      const activeRealPlayers = realPlayers.filter((player: any) => {
        const expired = isContractExpired(player.endSeason, currentSeasonName);
        if (expired) {
          realPlayersRemoved++;
          expiredPlayers.push({
            name: player.name,
            team: teamName,
            type: 'real',
            contract: `${player.startSeason}-${player.endSeason}`,
          });
        }
        return !expired;
      });

      // Process football players
      const footballPlayers = teamData?.football_players || [];
      const activeFootballPlayers = footballPlayers.filter((player: any) => {
        const expired = isContractExpired(player.endSeason, currentSeasonName);
        if (expired) {
          footballPlayersRemoved++;
          expiredPlayers.push({
            name: player.name,
            team: teamName,
            type: 'football',
            contract: `${player.startSeason}-${player.endSeason}`,
          });
        }
        return !expired;
      });

      // Update team if there were changes
      if (
        activeRealPlayers.length !== realPlayers.length ||
        activeFootballPlayers.length !== footballPlayers.length
      ) {
        batch.update(teamDoc.ref, {
          real_players: activeRealPlayers,
          real_players_count: activeRealPlayers.length,
          football_players: activeFootballPlayers,
          football_players_count: activeFootballPlayers.length,
          updated_at: new Date().toISOString(),
        });
        teamsProcessed++;
      }
    }

    // Commit all updates
    await batch.commit();

    return NextResponse.json({
      success: true,
      teamsProcessed,
      realPlayersRemoved,
      footballPlayersRemoved,
      expiredPlayers,
      message: `Expired contracts processed for ${teamsProcessed} teams`,
    });
  } catch (error) {
    console.error('Error expiring contracts:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to expire contracts' },
      { status: 500 }
    );
  }
}
