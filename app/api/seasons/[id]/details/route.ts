import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: seasonId } = await params;

    if (!seasonId) {
      return NextResponse.json(
        { success: false, error: 'Season ID is required' },
        { status: 400 }
      );
    }

    // Get season details
    const seasonDoc = await adminDb.collection('seasons').doc(seasonId).get();
    if (!seasonDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Season not found' },
        { status: 404 }
      );
    }

    const seasonData = seasonDoc.data();

    // Get all registered teams for this season
    const teamSeasonsSnapshot = await adminDb
      .collection('team_seasons')
      .where('season_id', '==', seasonId)
      .where('status', '==', 'registered')
      .get();

    const teams = teamSeasonsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        team_id: data.team_id,
        team_name: data.team_name,
        owner_name: data.owner_name,
        balance: data.budget || data.balance || 0,
        dollar_balance: data.real_player_budget,
        euro_balance: data.football_budget,
        logo_url: data.team_logo || null,
        registered_at: data.joined_at || data.created_at,
        players_count: data.players_count || 0,
      };
    });

    console.log(`✅ Found ${teams.length} registered teams for season ${seasonId}`);
    teams.forEach(t => console.log(`   - ${t.team_name}`));

    // Get all ACTIVE real players (available player pool for the league)
    const realPlayersSnapshot = await adminDb
      .collection('realplayers')
      .where('is_active', '==', true)
      .get();

    const allPlayers = realPlayersSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        player_id: data.player_id,
        name: data.name,
        display_name: data.display_name,
        email: data.email,
        psn_id: data.psn_id,
        xbox_id: data.xbox_id,
        steam_id: data.steam_id,
        is_registered: data.is_registered || false,
        is_available: data.is_available !== false,
      };
    });

    console.log(`✅ Found ${allPlayers.length} active players in the pool`);
    if (allPlayers.length > 0) {
      console.log(`   First 5: ${allPlayers.slice(0, 5).map(p => p.name).join(', ')}`);
    }

    // Get players who have stats in this season (players who actually played)
    const playerStatsSnapshot = await adminDb
      .collection('realplayerstats')
      .where('season_id', '==', seasonId)
      .get();

    const playersWithStats = new Set(
      playerStatsSnapshot.docs.map(doc => doc.data().player_id)
    );

    // Mark players who have played in this season
    const players = allPlayers.map(player => ({
      ...player,
      hasPlayedThisSeason: playersWithStats.has(player.player_id),
    }));

    return NextResponse.json({
      success: true,
      data: {
        season: {
          id: seasonId,
          name: seasonData?.name,
          short_name: seasonData?.short_name,
          is_active: seasonData?.is_active,
        },
        teams: teams,
        players: players,
      },
    });
  } catch (error: any) {
    console.error('Error fetching season details:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch season details',
      },
      { status: 500 }
    );
  }
}
