import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-helper';
import { sendNotification } from '@/lib/notifications/send-notification';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyAuth(['admin', 'committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { seasonId } = await request.json();

    if (!seasonId) {
      return NextResponse.json(
        { success: false, error: 'Season ID is required' },
        { status: 400 }
      );
    }

    // Get teams registered for this season
    const teamsResult = await sql`
      SELECT team_id
      FROM team_seasons
      WHERE season_id = ${seasonId}
        AND status = 'active'
      LIMIT 10
    `;

    if (teamsResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No teams found for this season' },
        { status: 404 }
      );
    }

    let winnerCount = 0;
    let loserCount = 0;

    // Send winner notification to first team, loser to rest
    for (let i = 0; i < teamsResult.length; i++) {
      const teamId = teamsResult[i].team_id;
      const isWinner = i === 0; // First team wins

      if (isWinner) {
        await sendNotification(
          {
            title: '🎉 Test: Player Won!',
            body: `Congratulations! You won Cristiano Ronaldo for $50,000 (Test notification)`,
            url: `/dashboard/team`,
            icon: '/logo.png',
            data: {
              type: 'test_round_result',
              roundId: 'TEST_ROUND',
              playerId: 'test_player',
              result: 'won'
            }
          },
          { teamId }
        );
        winnerCount++;
      } else {
        await sendNotification(
          {
            title: '❌ Test: Bid Lost',
            body: `You lost the bid for Cristiano Ronaldo. Better luck next time! (Test notification)`,
            url: `/dashboard/team`,
            icon: '/logo.png',
            data: {
              type: 'test_round_result',
              roundId: 'TEST_ROUND',
              playerId: 'test_player',
              result: 'lost'
            }
          },
          { teamId }
        );
        loserCount++;
      }
    }

    return NextResponse.json({
      success: true,
      winnerCount,
      loserCount,
      totalTeams: teamsResult.length,
      message: `Sent ${winnerCount} winner and ${loserCount} loser test notifications`
    });
  } catch (error: any) {
    console.error('Error sending test round finalize notifications:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
