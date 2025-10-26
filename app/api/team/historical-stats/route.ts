import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { getTournamentDb } from '@/lib/neon/tournament-config';

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

    // ✅ Fetch team stats from NEON across all seasons (optimized - only needed columns)
    const sql = getTournamentDb();
    const teamStats = await sql`
      SELECT 
        id, team_id, team_name, season_id, 
        matches_played, wins, draws, losses,
        goals_for, goals_against, goal_difference,
        points, position
      FROM teamstats
      WHERE team_name = ${teamName}
      ORDER BY season_id DESC
    `;

    // ✅ Fetch player stats from NEON for this team across all seasons (optimized - only needed columns)
    const playerStats = await sql`
      SELECT 
        id, player_id, player_name, season_id,
        team, team_id, category,
        matches_played, goals_scored, wins, draws, losses,
        clean_sheets, points
      FROM realplayerstats
      WHERE team = ${teamName}
      ORDER BY season_id DESC, player_name
    `;

    // Calculate aggregated statistics
    const totalSeasons = teamStats.length;
    const totalMatches = teamStats.reduce((sum: number, stat: any) => sum + (stat.matches_played || 0), 0);
    const totalWins = teamStats.reduce((sum: number, stat: any) => sum + (stat.wins || 0), 0);
    const totalDraws = teamStats.reduce((sum: number, stat: any) => sum + (stat.draws || 0), 0);
    const totalLosses = teamStats.reduce((sum: number, stat: any) => sum + (stat.losses || 0), 0);
    const totalGoalsScored = teamStats.reduce((sum: number, stat: any) => sum + (stat.goals_for || 0), 0);
    const totalGoalsConceded = teamStats.reduce((sum: number, stat: any) => sum + (stat.goals_against || 0), 0);
    const totalPoints = teamStats.reduce((sum: number, stat: any) => sum + (stat.points || 0), 0);

    // Count unique players
    const uniquePlayers = new Set(playerStats.map((p: any) => p.player_name));
    const totalPlayers = uniquePlayers.size;

    // Count trophies/achievements (position 1 = champion)
    const championships = teamStats.filter((stat: any) => stat.position === 1).length;
    const runnerUps = teamStats.filter((stat: any) => stat.position === 2).length;
    const cups = 0; // Cup data not in current schema

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
