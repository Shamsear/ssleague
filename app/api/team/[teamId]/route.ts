import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { getCached, setCached } from '@/lib/firebase/cache';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: teamId } = await params;
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('season_id');

    if (!seasonId) {
      return NextResponse.json({
        success: false,
        error: 'Season ID is required',
      }, { status: 400 });
    }

    // Get team info from teams collection
    let teamInfo = getCached<any>('teams', teamId, 5 * 60 * 1000); // 5 min TTL
    if (!teamInfo) {
      const teamDoc = await adminDb.collection('teams').doc(teamId).get();
      if (!teamDoc.exists) {
        return NextResponse.json({
          success: false,
          error: 'Team not found',
        }, { status: 404 });
      }
      teamInfo = teamDoc.data();
      setCached('teams', teamId, teamInfo);
    }

    // Get team_season data
    const teamSeasonId = `${teamId}_${seasonId}`;
    const teamSeasonDoc = await adminDb
      .collection('team_seasons')
      .doc(teamSeasonId)
      .get();

    if (!teamSeasonDoc.exists) {
      return NextResponse.json({
        success: false,
        error: 'Team not registered for this season',
      }, { status: 404 });
    }

    const teamSeasonData = teamSeasonDoc.data();

    // Determine if this is a modern season (16+)
    const isModernSeason = (season: string) => {
      const seasonNum = parseInt(season.replace(/\D/g, '')) || 0;
      return seasonNum >= 16;
    };

    // Fetch football players
    const footballPlayersSnapshot = await adminDb
      .collection('footballplayers')
      .where('season_id', '==', seasonId)
      .where('team_id', '==', teamId)
      .get();

    const footballPlayers = footballPlayersSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || 'Unknown',
        position: data.primary_position || 'Unknown',
        rating: data.attributes?.overall || 0,
        category: data.category,
        value: data.value,
        is_real_player: false,
      };
    });

    // Fetch real players from Neon
    const sql = getTournamentDb();
    let realPlayersData;
    
    if (isModernSeason(seasonId)) {
      // Season 16+: Query player_seasons table
      realPlayersData = await sql`
        SELECT * FROM player_seasons 
        WHERE season_id = ${seasonId}
        AND team_id = ${teamId}
      `;
    } else {
      // Season 1-15: Query realplayerstats table
      realPlayersData = await sql`
        SELECT * FROM realplayerstats 
        WHERE season_id = ${seasonId}
        AND team_id = ${teamId}
      `;
    }

    const realPlayers = realPlayersData.map((player: any) => ({
      id: player.player_id || player.id, // Use player_id field (without season suffix) for linking
      name: player.player_name || 'Unknown',
      position: player.position || 'Unknown',
      rating: player.star_rating ? player.star_rating * 20 : 0, // Convert 1-5 stars to 20-100 scale
      category: 'Real Player',
      value: player.auction_value || 0,
      is_real_player: true,
    }));

    // Combine all players
    const allPlayers = [...footballPlayers, ...realPlayers];

    // Calculate statistics
    const totalPlayers = allPlayers.length;
    const totalValue = allPlayers.reduce((sum, p) => sum + (p.value || 0), 0);
    const avgRating = totalPlayers > 0 
      ? allPlayers.reduce((sum, p) => sum + p.rating, 0) / totalPlayers 
      : 0;

    // Position breakdown
    const positionBreakdown: { [key: string]: number } = {};
    const categoryBreakdown: { [key: string]: number } = {};

    allPlayers.forEach(player => {
      // Position count
      positionBreakdown[player.position] = (positionBreakdown[player.position] || 0) + 1;
      
      // Category count
      if (player.category) {
        categoryBreakdown[player.category] = (categoryBreakdown[player.category] || 0) + 1;
      }
    });

    // Try different logo field names
    const logoUrl = teamInfo?.logoUrl || teamInfo?.logoURL || teamInfo?.logo_url || teamSeasonData?.team_logo || null;

    return NextResponse.json({
      success: true,
      data: {
        team: {
          id: teamId,
          name: teamInfo?.team_name || teamSeasonData?.team_name || 'Unknown Team',
          logoUrl: logoUrl,
          balance: teamInfo?.balance || 0,
          // Dual currency (Season 16+)
          dollar_balance: teamSeasonData?.real_player_budget,
          euro_balance: teamSeasonData?.football_budget,
          dollar_spent: teamSeasonData?.real_player_spent,
          euro_spent: teamSeasonData?.football_spent,
          // Contract fields
          skipped_seasons: teamSeasonData?.skipped_seasons,
          penalty_amount: teamSeasonData?.penalty_amount,
          last_played_season: teamSeasonData?.last_played_season,
          contract_id: teamSeasonData?.contract_id,
          contract_start_season: teamSeasonData?.contract_start_season,
          contract_end_season: teamSeasonData?.contract_end_season,
          is_auto_registered: teamSeasonData?.is_auto_registered,
          owner_uid: teamInfo?.uid,
          owner_name: teamInfo?.displayName || teamInfo?.display_name,
          owner_email: teamInfo?.email,
        },
        players: allPlayers,
        totalPlayers,
        totalValue,
        avgRating: Math.round(avgRating * 10) / 10,
        positionBreakdown,
        categoryBreakdown,
      },
    });

  } catch (error: any) {
    console.error('Error fetching team details:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch team details',
    }, { status: 500 });
  }
}
