import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/auth-helper';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(['team', 'committee'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: playerId } = await params;
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('season_id');

    if (!seasonId) {
      return NextResponse.json({
        success: false,
        error: 'Season ID is required',
      }, { status: 400 });
    }

    // Determine if this is a modern season (16+)
    const isModernSeason = (season: string) => {
      const seasonNum = parseInt(season.replace(/\D/g, '')) || 0;
      return seasonNum >= 16;
    };

    const sql = getTournamentDb();
    let playerData;
    
    if (isModernSeason(seasonId)) {
      // Season 16+: Query player_seasons table
      const results = await sql`
        SELECT * FROM player_seasons
        WHERE id = ${playerId}
        AND season_id = ${seasonId}
      `;
      
      if (results.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Player not found',
        }, { status: 404 });
      }
      
      playerData = results[0];
    } else {
      // Season 1-15: Query realplayerstats table
      const results = await sql`
        SELECT * FROM realplayerstats 
        WHERE id = ${playerId}
        AND season_id = ${seasonId}
      `;
      
      if (results.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Player not found',
        }, { status: 404 });
      }
      
      playerData = results[0];
    }
    
    // Fetch team name from Firebase team_seasons
    let teamName = null;
    if (playerData.team_id) {
      try {
        const teamSeasonId = `${playerData.team_id}_${seasonId}`;
        const teamSeasonDoc = await adminDb
          .collection('team_seasons')
          .doc(teamSeasonId)
          .get();
        
        if (teamSeasonDoc.exists) {
          const teamSeasonData = teamSeasonDoc.data();
          teamName = teamSeasonData?.team_name;
        }
      } catch (error) {
        console.error('Error fetching team name:', error);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: playerData.id,
        player_name: playerData.player_name,
        team_id: playerData.team_id,
        team_name: teamName || playerData.team_name || playerData.team_id,
        auction_value: playerData.auction_value || 0,
        star_rating: playerData.star_rating || 0,
        category: playerData.category,
        contract_start_season: playerData.contract_start_season,
        contract_end_season: playerData.contract_end_season,
        salary_per_match: playerData.salary_per_match,
        season_id: playerData.season_id,
        // Season stats
        matches_played: playerData.matches_played || 0,
        goals_scored: playerData.goals_scored || 0,
        assists: playerData.assists || 0,
        wins: playerData.wins || 0,
        draws: playerData.draws || 0,
        losses: playerData.losses || 0,
        clean_sheets: playerData.clean_sheets || 0,
        motm_awards: playerData.motm_awards || 0,
        points: playerData.points || 0,
        // Awards
        awards: playerData.awards || [],
        potm_count: playerData.motm_awards || 0,
        pots_count: playerData.pots_count || 0,
      },
    });

  } catch (error: any) {
    console.error('Error fetching real player details:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch player details',
    }, { status: 500 });
  }
}
