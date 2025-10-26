import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

/**
 * GET /api/fantasy/teams/[teamId]
 * Get fantasy team details with drafted players and points history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;

    if (!teamId) {
      return NextResponse.json(
        { error: 'Team ID is required' },
        { status: 400 }
      );
    }

    // Get fantasy team
    const teamDoc = await adminDb
      .collection('fantasy_teams')
      .doc(teamId)
      .get();

    if (!teamDoc.exists) {
      return NextResponse.json(
        { error: 'Fantasy team not found' },
        { status: 404 }
      );
    }

    const teamData = teamDoc.data();

    // Get drafted players
    const draftsSnap = await adminDb
      .collection('fantasy_drafts')
      .where('fantasy_team_id', '==', teamId)
      .orderBy('draft_order', 'asc')
      .get();

    const draftedPlayers = await Promise.all(
      draftsSnap.docs.map(async (doc) => {
        const draft = doc.data();
        
        // Get player's total points for this league
        const pointsSnap = await adminDb
          .collection('fantasy_player_points')
          .where('fantasy_team_id', '==', teamId)
          .where('real_player_id', '==', draft.real_player_id)
          .get();

        const totalPoints = pointsSnap.docs.reduce(
          (sum, doc) => sum + (doc.data().total_points || 0),
          0
        );

        const matchesPlayed = pointsSnap.size;
        const averagePoints = matchesPlayed > 0 ? totalPoints / matchesPlayed : 0;

        return {
          draft_id: doc.id,
          real_player_id: draft.real_player_id,
          player_name: draft.player_name,
          draft_order: draft.draft_order,
          draft_price: draft.draft_price,
          total_points: totalPoints,
          matches_played: matchesPlayed,
          average_points: Math.round(averagePoints * 10) / 10,
        };
      })
    );

    // Sort by total points (highest first)
    draftedPlayers.sort((a, b) => b.total_points - a.total_points);

    // Get recent points (last 5 rounds)
    const recentPointsSnap = await adminDb
      .collection('fantasy_player_points')
      .where('fantasy_team_id', '==', teamId)
      .orderBy('round_number', 'desc')
      .limit(50) // Get enough to show last few rounds
      .get();

    // Group by round
    const pointsByRound = new Map<number, { round: number; points: number }>();
    recentPointsSnap.docs.forEach(doc => {
      const data = doc.data();
      const existing = pointsByRound.get(data.round_number) || { round: data.round_number, points: 0 };
      existing.points += data.total_points || 0;
      pointsByRound.set(data.round_number, existing);
    });

    const recentRounds = Array.from(pointsByRound.values())
      .sort((a, b) => b.round - a.round)
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      team: {
        id: teamDoc.id,
        ...teamData,
      },
      players: draftedPlayers,
      recent_rounds: recentRounds,
      statistics: {
        total_players: draftedPlayers.length,
        total_points: teamData.total_points || 0,
        average_points_per_player: draftedPlayers.length > 0 
          ? Math.round((teamData.total_points || 0) / draftedPlayers.length * 10) / 10 
          : 0,
      }
    });
  } catch (error) {
    console.error('Error fetching fantasy team:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fantasy team' },
      { status: 500 }
    );
  }
}
