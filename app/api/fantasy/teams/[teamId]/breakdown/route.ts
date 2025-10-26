import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

/**
 * GET /api/fantasy/teams/[teamId]/breakdown
 * Get detailed breakdown of fantasy team points (player points vs team bonuses)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;

    // Get fantasy team
    const fantasyTeamDoc = await adminDb
      .collection('fantasy_teams')
      .doc(teamId)
      .get();

    if (!fantasyTeamDoc.exists) {
      return NextResponse.json(
        { error: 'Fantasy team not found' },
        { status: 404 }
      );
    }

    const fantasyTeam = fantasyTeamDoc.data();

    // Get player points history
    const playerPointsSnap = await adminDb
      .collection('fantasy_player_points')
      .where('fantasy_team_id', '==', teamId)
      .orderBy('round_number', 'desc')
      .get();

    const playerPointsByRound = new Map<number, number>();
    playerPointsSnap.docs.forEach(doc => {
      const data = doc.data();
      const current = playerPointsByRound.get(data.round_number) || 0;
      playerPointsByRound.set(data.round_number, current + data.total_points);
    });

    // Get team bonus history
    const teamBonusSnap = await adminDb
      .collection('fantasy_team_bonus_points')
      .where('fantasy_team_id', '==', teamId)
      .orderBy('round_number', 'desc')
      .get();

    const teamBonusesByRound = new Map<number, number>();
    const teamBonusDetails: any[] = [];
    
    teamBonusSnap.docs.forEach(doc => {
      const data = doc.data();
      const current = teamBonusesByRound.get(data.round_number) || 0;
      teamBonusesByRound.set(data.round_number, current + data.total_bonus);
      
      teamBonusDetails.push({
        round: data.round_number,
        real_team_name: data.real_team_name,
        bonus: data.total_bonus,
        breakdown: data.bonus_breakdown,
        fixture_id: data.fixture_id,
      });
    });

    // Combine by round
    const allRounds = new Set([...playerPointsByRound.keys(), ...teamBonusesByRound.keys()]);
    const roundBreakdown = Array.from(allRounds)
      .sort((a, b) => a - b)
      .map(round => ({
        round,
        player_points: playerPointsByRound.get(round) || 0,
        team_bonus: teamBonusesByRound.get(round) || 0,
        total: (playerPointsByRound.get(round) || 0) + (teamBonusesByRound.get(round) || 0),
      }));

    return NextResponse.json({
      team: {
        id: fantasyTeam.id,
        team_name: fantasyTeam.team_name,
        player_points: fantasyTeam.player_points || 0,
        team_bonus_points: fantasyTeam.team_bonus_points || 0,
        total_points: fantasyTeam.total_points || 0,
        rank: fantasyTeam.rank || 0,
      },
      round_breakdown: roundBreakdown,
      team_bonuses_detail: teamBonusDetails,
    });
  } catch (error) {
    console.error('Error fetching team breakdown:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team breakdown', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
