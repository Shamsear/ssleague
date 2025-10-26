import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

/**
 * GET /api/fantasy/players/[playerId]/stats?league_id=xxx
 * Get detailed fantasy stats for a specific player
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { playerId: string } }
) {
  try {
    const { playerId } = params;
    const searchParams = request.nextUrl.searchParams;
    const league_id = searchParams.get('league_id');

    if (!playerId) {
      return NextResponse.json(
        { error: 'Player ID is required' },
        { status: 400 }
      );
    }

    if (!league_id) {
      return NextResponse.json(
        { error: 'league_id query parameter is required' },
        { status: 400 }
      );
    }

    // Get fantasy league to get season_id
    const leagueDoc = await adminDb
      .collection('fantasy_leagues')
      .doc(league_id)
      .get();

    if (!leagueDoc.exists) {
      return NextResponse.json(
        { error: 'Fantasy league not found' },
        { status: 404 }
      );
    }

    const leagueData = leagueDoc.data();

    // Get player info
    const playerSnap = await adminDb
      .collection('realplayer')
      .where('player_id', '==', playerId)
      .where('season_id', '==', leagueData.season_id)
      .limit(1)
      .get();

    if (playerSnap.empty) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      );
    }

    const playerData = playerSnap.docs[0].data();

    // Check if player is drafted
    const draftSnap = await adminDb
      .collection('fantasy_drafts')
      .where('fantasy_league_id', '==', league_id)
      .where('real_player_id', '==', playerId)
      .limit(1)
      .get();

    let draftInfo = null;
    let fantasyTeamName = null;

    if (!draftSnap.empty) {
      const draft = draftSnap.docs[0].data();
      draftInfo = {
        fantasy_team_id: draft.fantasy_team_id,
        draft_order: draft.draft_order,
        draft_price: draft.draft_price,
      };

      // Get fantasy team name
      const teamDoc = await adminDb
        .collection('fantasy_teams')
        .doc(draft.fantasy_team_id)
        .get();
      
      if (teamDoc.exists) {
        fantasyTeamName = teamDoc.data().team_name;
      }
    }

    // Get all fantasy points for this player
    const pointsSnap = await adminDb
      .collection('fantasy_player_points')
      .where('fantasy_league_id', '==', league_id)
      .where('real_player_id', '==', playerId)
      .orderBy('round_number', 'asc')
      .get();

    const matchHistory = pointsSnap.docs.map(doc => {
      const data = doc.data();
      return {
        round_number: data.round_number,
        fixture_id: data.fixture_id,
        goals_scored: data.goals_scored,
        goals_conceded: data.goals_conceded,
        result: data.result,
        is_motm: data.is_motm,
        is_clean_sheet: data.is_clean_sheet,
        points_breakdown: data.points_breakdown,
        total_points: data.total_points,
      };
    });

    // Calculate aggregated stats
    const totalPoints = matchHistory.reduce((sum, m) => sum + m.total_points, 0);
    const matchesPlayed = matchHistory.length;
    const averagePoints = matchesPlayed > 0 ? totalPoints / matchesPlayed : 0;
    const totalGoals = matchHistory.reduce((sum, m) => sum + m.goals_scored, 0);
    const totalConceded = matchHistory.reduce((sum, m) => sum + m.goals_conceded, 0);
    const motmCount = matchHistory.filter(m => m.is_motm).length;
    const cleanSheets = matchHistory.filter(m => m.is_clean_sheet).length;
    const wins = matchHistory.filter(m => m.result === 'win').length;
    const draws = matchHistory.filter(m => m.result === 'draw').length;
    const losses = matchHistory.filter(m => m.result === 'loss').length;

    return NextResponse.json({
      success: true,
      player: {
        real_player_id: playerData.player_id,
        player_name: playerData.name,
        star_rating: playerData.star_rating || 3,
        points: playerData.points || 100,
        category: playerData.category_name || 'Classic',
      },
      draft_info: draftInfo,
      fantasy_team_name: fantasyTeamName,
      is_available: !draftInfo,
      fantasy_stats: {
        total_points: totalPoints,
        matches_played: matchesPlayed,
        average_points: Math.round(averagePoints * 10) / 10,
        total_goals: totalGoals,
        total_conceded: totalConceded,
        motm_count: motmCount,
        clean_sheets: cleanSheets,
        wins: wins,
        draws: draws,
        losses: losses,
      },
      match_history: matchHistory,
    });
  } catch (error) {
    console.error('Error fetching player stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch player stats' },
      { status: 500 }
    );
  }
}
