import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fromSeason = searchParams.get('from');
    const toSeason = searchParams.get('to');

    if (!fromSeason || !toSeason) {
      return NextResponse.json(
        { success: false, error: 'Both from and to seasons are required' },
        { status: 400 }
      );
    }

    if (fromSeason === toSeason) {
      return NextResponse.json(
        { success: false, error: 'Source and target seasons must be different' },
        { status: 400 }
      );
    }

    console.log(`📊 Generating carryover preview: ${fromSeason} → ${toSeason}`);

    const sql = getTournamentDb();

    // Fetch team_seasons data from Firebase for BOTH seasons
    console.log('Fetching team_seasons from Firebase...');
    const sourceTeamSeasonsSnapshot = await adminDb
      .collection('team_seasons')
      .where('season_id', '==', fromSeason)
      .get();
    
    const targetTeamSeasonsSnapshot = await adminDb
      .collection('team_seasons')
      .where('season_id', '==', toSeason)
      .get();
    
    // Create a map of target season data for quick lookup
    const targetTeamSeasonsMap = new Map();
    targetTeamSeasonsSnapshot.forEach(doc => {
      const data = doc.data();
      targetTeamSeasonsMap.set(data.team_id, data);
    });
    
    const teamCarryover = [];

    for (const teamSeasonDoc of sourceTeamSeasonsSnapshot.docs) {
      const sourceData = teamSeasonDoc.data();
      const targetData = targetTeamSeasonsMap.get(sourceData.team_id);
      
      // Source season (current/before)
      const sourceFootballBudget = sourceData.football_budget || 0;
      const sourceRealPlayerBudget = sourceData.real_player_budget || 0;
      const sourceTotalBalance = sourceFootballBudget + sourceRealPlayerBudget;
      
      // Target season (after) - if exists, show current values; if not, show what will be set
      const targetFootballBudget = targetData ? (targetData.football_budget || 0) : sourceFootballBudget;
      const targetRealPlayerBudget = targetData ? (targetData.real_player_budget || 0) : sourceRealPlayerBudget;
      const targetTotalBalance = targetFootballBudget + targetRealPlayerBudget;
      
      // Count players in both seasons
      const sourcePlayerCount = await sql`
        SELECT COUNT(*) as count
        FROM player_seasons
        WHERE team_id = ${sourceData.team_id} AND season_id = ${fromSeason}
      `;
      
      const targetPlayerCount = await sql`
        SELECT COUNT(*) as count
        FROM player_seasons
        WHERE team_id = ${sourceData.team_id} AND season_id = ${toSeason}
      `;

      teamCarryover.push({
        team_id: sourceData.team_id,
        team_name: sourceData.team_name,
        // Current state of TARGET season (before update)
        current_balance: targetTotalBalance,
        current_football_budget: targetFootballBudget,
        current_real_player_budget: targetRealPlayerBudget,
        current_player_count: parseInt(targetPlayerCount[0]?.count || '0'),
        // What will be set in TARGET season (after update) - from SOURCE season
        new_balance: sourceTotalBalance,
        new_football_budget: sourceFootballBudget,
        new_real_player_budget: sourceRealPlayerBudget,
        // Source season data (for reference in brackets)
        source_football_budget: sourceFootballBudget,
        source_real_player_budget: sourceRealPlayerBudget,
        source_total_balance: sourceTotalBalance,
        source_player_count: parseInt(sourcePlayerCount[0]?.count || '0')
      });
    }

    console.log(`✅ Found ${teamCarryover.length} teams`);

    // Fetch player stats from BOTH seasons
    console.log('Fetching player stats from Neon...');
    const sourcePlayers = await sql`
      SELECT 
        player_id,
        player_name,
        team_id,
        team,
        star_rating,
        points,
        auction_value,
        salary_per_match
      FROM player_seasons
      WHERE season_id = ${fromSeason}
      ORDER BY team, player_name
    `;
    
    const targetPlayers = await sql`
      SELECT 
        player_id,
        player_name,
        team_id,
        team,
        star_rating,
        points,
        base_points,
        auction_value,
        salary_per_match
      FROM player_seasons
      WHERE season_id = ${toSeason}
      ORDER BY team, player_name
    `;
    
    // Create a map of target season players for quick lookup
    const targetPlayersMap = new Map();
    targetPlayers.forEach(player => {
      targetPlayersMap.set(player.player_id, player);
    });

    console.log(`✅ Found ${sourcePlayers.length} players in source season`);
    console.log(`✅ Found ${targetPlayers.length} players in target season`);

    const playerCarryover = sourcePlayers.map((sourcePlayer: any) => {
      const targetPlayer = targetPlayersMap.get(sourcePlayer.player_id);
      const changes = [];
      
      // Show what will be carried over from source
      if (sourcePlayer.star_rating) {
        changes.push(`Stars: ${sourcePlayer.star_rating}`);
      }
      
      if (sourcePlayer.points > 0) {
        changes.push(`Points: ${sourcePlayer.points}`);
      }
      
      if (sourcePlayer.auction_value) {
        changes.push(`Value: ₹${sourcePlayer.auction_value}`);
      }

      return {
        player_id: sourcePlayer.player_id,
        player_name: sourcePlayer.player_name,
        team_name: sourcePlayer.team || 'Unknown',
        // Current state of TARGET season (before update)
        current_star_rating: targetPlayer?.star_rating || 0,
        current_points: targetPlayer?.points || 0,
        current_base_points: targetPlayer?.base_points || 0,
        current_auction_value: targetPlayer?.auction_value || 0,
        current_salary_per_match: targetPlayer?.salary_per_match || 0,
        // What will be set in TARGET season (after update) - from SOURCE season
        new_star_rating: sourcePlayer.star_rating || 0,
        new_points: sourcePlayer.points || 0,
        new_base_points: sourcePlayer.points || 0, // base_points = previous points
        new_auction_value: sourcePlayer.auction_value || 0,
        new_salary_per_match: sourcePlayer.salary_per_match || 0,
        // Source season data (for reference in brackets)
        source_star_rating: sourcePlayer.star_rating || 0,
        source_points: sourcePlayer.points || 0,
        source_base_points: sourcePlayer.points || 0, // base_points = previous points
        source_auction_value: sourcePlayer.auction_value || 0,
        source_salary_per_match: sourcePlayer.salary_per_match || 0,
        changes
      };
    });

    console.log('✅ Preview generated successfully');

    return NextResponse.json({
      success: true,
      teams: teamCarryover,
      players: playerCarryover,
      summary: {
        total_teams: teamCarryover.length,
        total_players: playerCarryover.length,
        players_with_stars: playerCarryover.filter((p: any) => p.current_star_rating > 0).length,
        players_with_points: playerCarryover.filter((p: any) => p.current_points > 0).length
      }
    });

  } catch (error: any) {
    console.error('❌ Error generating carryover preview:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    return NextResponse.json(
      { success: false, error: `Database error: ${error.message}. Please check your network connection and try again.` },
      { status: 500 }
    );
  }
}
