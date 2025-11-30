import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/auth-helper';
import { getCached, setCached } from '@/lib/firebase/cache';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const auth = await verifyAuth(['team', 'committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { teamId } = await params;
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

    // Fetch football players from Neon auction database
    const { neon } = await import('@neondatabase/serverless');
    const auctionSql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);
    
    const footballPlayersData = await auctionSql`
      SELECT 
        tp.player_id,
        tp.purchase_price,
        fp.name,
        fp.position,
        fp.overall_rating,
        fp.team_name as club
      FROM team_players tp
      INNER JOIN footballplayers fp ON tp.player_id = fp.id
      WHERE tp.team_id = ${teamId}
        AND tp.season_id = ${seasonId}
    `;

    const footballPlayers = footballPlayersData.map((player: any) => ({
      id: player.player_id,
      name: player.name || 'Unknown',
      position: player.position || 'Unknown',
      rating: player.overall_rating || 0,
      category: 'Football',
      value: player.purchase_price,
      is_real_player: false,
    }));

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
