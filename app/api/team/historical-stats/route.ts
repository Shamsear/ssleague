import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';

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

    // Get user details to get team info
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const teamName = userData?.teamName;

    if (!teamName) {
      return NextResponse.json(
        { success: false, error: 'Team name not found' },
        { status: 404 }
      );
    }

    // Fetch team stats across all seasons
    const teamStatsSnapshot = await adminDb
      .collection('teamstats')
      .where('team_name', '==', teamName)
      .get();

    const teamStats = teamStatsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Fetch player stats for this team across all seasons
    const playerStatsSnapshot = await adminDb
      .collection('realplayerstats')
      .where('team', '==', teamName)
      .get();

    const playerStats = playerStatsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Calculate aggregated statistics
    const totalSeasons = teamStats.length;
    const totalMatches = teamStats.reduce((sum, stat) => sum + (stat.matches_played || 0), 0);
    const totalWins = teamStats.reduce((sum, stat) => sum + (stat.wins || 0), 0);
    const totalDraws = teamStats.reduce((sum, stat) => sum + (stat.draws || 0), 0);
    const totalLosses = teamStats.reduce((sum, stat) => sum + (stat.losses || 0), 0);
    const totalGoalsScored = teamStats.reduce((sum, stat) => sum + (stat.goals_for || 0), 0);
    const totalGoalsConceded = teamStats.reduce((sum, stat) => sum + (stat.goals_against || 0), 0);
    const totalPoints = teamStats.reduce((sum, stat) => sum + (stat.points || 0), 0);

    // Count unique players
    const uniquePlayers = new Set(playerStats.map(p => p.player_name));
    const totalPlayers = uniquePlayers.size;

    // Count trophies/achievements
    const championships = teamStats.filter(stat => stat.rank === 1).length;
    const runnerUps = teamStats.filter(stat => stat.rank === 2).length;
    const cups = teamStats.reduce((sum, stat) => {
      if (stat.cup_achievement && stat.cup_achievement !== '') {
        return sum + 1;
      }
      return sum;
    }, 0);

    // Get current season details
    const { searchParams } = new URL(request.url);
    const currentSeasonId = searchParams.get('season_id');

    let currentSeasonInfo = null;
    if (currentSeasonId) {
      // Get team_season info for current season
      const teamSeasonSnapshot = await adminDb
        .collection('team_seasons')
        .where('team_id', '==', userId)
        .where('season_id', '==', currentSeasonId)
        .limit(1)
        .get();

      if (!teamSeasonSnapshot.empty) {
        const teamSeasonData = teamSeasonSnapshot.docs[0].data();

        // Get season details
        const seasonDoc = await adminDb.collection('seasons').doc(currentSeasonId).get();
        const seasonData = seasonDoc.data();

        // Count registered players for this season (from auction or manual registration)
        const playersSnapshot = await adminDb
          .collection('players')
          .where('team_id', '==', userId)
          .where('season_id', '==', currentSeasonId)
          .get();

        const registeredPlayers = playersSnapshot.size;

        currentSeasonInfo = {
          seasonId: currentSeasonId,
          seasonName: seasonData?.name || 'Current Season',
          status: teamSeasonData.status,
          registeredAt: teamSeasonData.registered_at,
          balance: teamSeasonData.balance || 0,
          registeredPlayers: registeredPlayers,
          isRegistered: teamSeasonData.status === 'registered',
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        teamName: teamName,
        summary: {
          totalSeasons,
          totalMatches,
          totalWins,
          totalDraws,
          totalLosses,
          totalGoalsScored,
          totalGoalsConceded,
          totalPoints,
          totalPlayers,
          championships,
          runnerUps,
          cups,
          winRate: totalMatches > 0 ? ((totalWins / totalMatches) * 100).toFixed(1) : '0',
        },
        teamStats: teamStats,
        playerStats: playerStats,
        currentSeason: currentSeasonInfo,
      },
    });
  } catch (error: any) {
    console.error('Error fetching team historical stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch team stats',
      },
      { status: 500 }
    );
  }
}
