import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tournamentId = params.id;

    // Get all fixtures for this tournament
    const fixturesSnapshot = await adminDb
      .collection('fixtures')
      .where('tournament_id', '==', tournamentId)
      .where('status', '==', 'completed')
      .get();

    // Calculate standings from fixtures
    const teamStats: Record<string, any> = {};

    fixturesSnapshot.docs.forEach((doc) => {
      const fixture = doc.data();
      const homeTeamId = fixture.home_team_id;
      const awayTeamId = fixture.away_team_id;
      const homeScore = fixture.home_score || 0;
      const awayScore = fixture.away_score || 0;

      // Initialize team stats if not exists
      if (!teamStats[homeTeamId]) {
        teamStats[homeTeamId] = {
          team_id: homeTeamId,
          team_name: fixture.home_team_name,
          matches_played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goals_for: 0,
          goals_against: 0,
          points: 0,
        };
      }
      if (!teamStats[awayTeamId]) {
        teamStats[awayTeamId] = {
          team_id: awayTeamId,
          team_name: fixture.away_team_name,
          matches_played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goals_for: 0,
          goals_against: 0,
          points: 0,
        };
      }

      // Update stats
      teamStats[homeTeamId].matches_played++;
      teamStats[awayTeamId].matches_played++;
      teamStats[homeTeamId].goals_for += homeScore;
      teamStats[homeTeamId].goals_against += awayScore;
      teamStats[awayTeamId].goals_for += awayScore;
      teamStats[awayTeamId].goals_against += homeScore;

      // Determine result and update points
      if (homeScore > awayScore) {
        // Home win
        teamStats[homeTeamId].wins++;
        teamStats[homeTeamId].points += 3;
        teamStats[awayTeamId].losses++;
      } else if (awayScore > homeScore) {
        // Away win
        teamStats[awayTeamId].wins++;
        teamStats[awayTeamId].points += 3;
        teamStats[homeTeamId].losses++;
      } else {
        // Draw
        teamStats[homeTeamId].draws++;
        teamStats[awayTeamId].draws++;
        teamStats[homeTeamId].points += 1;
        teamStats[awayTeamId].points += 1;
      }
    });

    // Convert to array and sort by points, then goal difference
    const standings = Object.values(teamStats).sort((a: any, b: any) => {
      const pointsDiff = b.points - a.points;
      if (pointsDiff !== 0) return pointsDiff;
      
      const gdA = a.goals_for - a.goals_against;
      const gdB = b.goals_for - b.goals_against;
      const gdDiff = gdB - gdA;
      if (gdDiff !== 0) return gdDiff;
      
      return b.goals_for - a.goals_for;
    });

    return NextResponse.json({
      success: true,
      standings,
    });
  } catch (error: any) {
    console.error('Error fetching tournament standings:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch tournament standings',
      },
      { status: 500 }
    );
  }
}
