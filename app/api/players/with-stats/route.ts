import { NextRequest, NextResponse } from 'next/server';
import { adminDb as firebaseDb } from '@/lib/firebase/admin';
import { tournamentSql as sql } from '@/lib/neon/tournament-config';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    console.log('[Players API] Starting fetch...');
    
    // Fetch all players from Firebase realplayers collection (limit to prevent timeout)
    const playersSnapshot = await firebaseDb
      .collection('realplayers')
      .orderBy('name')
      .limit(500)
      .get();

    console.log(`[Players API] Found ${playersSnapshot.size} players in Firebase`);

    if (playersSnapshot.empty) {
      console.log('[Players API] No players found in Firebase');
      return NextResponse.json({
        success: true,
        players: []
      });
    }

    // Collect all player IDs
    const playerIds: string[] = [];
    const playerDataMap = new Map();

    playersSnapshot.docs.forEach(playerDoc => {
      const playerData = playerDoc.data();
      const playerId = playerData.player_id || playerDoc.id;
      playerIds.push(playerId);
      playerDataMap.set(playerId, {
        id: playerDoc.id,
        ...playerData
      });
    });

    // Batch fetch all stats - combine from realplayerstats (seasons 1-15) and player_seasons (season 16+)
    console.log('[Players API] Fetching stats from Neon...');
    let allStats = [];
    try {
      // Fetch from realplayerstats (seasons 1-15) - no rating
      const oldStats = await sql`
        SELECT 
          player_id,
          COALESCE(SUM(matches_played), 0) as matches_played,
          COALESCE(SUM(goals_scored), 0) as goals_scored,
          COALESCE(SUM(clean_sheets), 0) as clean_sheets,
          COALESCE(SUM(points), 0) as total_points
        FROM realplayerstats
        GROUP BY player_id
      `;
      console.log(`[Players API] Found old stats for ${oldStats.length} players`);

      // Fetch from player_seasons (season 16+) - has rating (star_rating)
      const newStats = await sql`
        SELECT 
          player_id,
          COALESCE(SUM(matches_played), 0) as matches_played,
          COALESCE(SUM(goals_scored), 0) as goals_scored,
          COALESCE(SUM(clean_sheets), 0) as clean_sheets,
          COALESCE(AVG(NULLIF(star_rating, 0)), 0) as average_rating,
          COALESCE(SUM(points), 0) as total_points
        FROM player_seasons
        GROUP BY player_id
      `;
      console.log(`[Players API] Found new stats for ${newStats.length} players`);

      // Combine stats from both tables
      const statsMap = new Map();
      
      // Add old stats (no rating)
      oldStats.forEach(stat => {
        statsMap.set(stat.player_id, {
          player_id: stat.player_id,
          matches_played: parseInt(stat.matches_played) || 0,
          goals_scored: parseInt(stat.goals_scored) || 0,
          clean_sheets: parseInt(stat.clean_sheets) || 0,
          average_rating: 0, // realplayerstats doesn't have rating
          total_points: parseInt(stat.total_points) || 0
        });
      });

      // Add or merge new stats (with rating)
      newStats.forEach(stat => {
        const existing = statsMap.get(stat.player_id);
        if (existing) {
          existing.matches_played += parseInt(stat.matches_played) || 0;
          existing.goals_scored += parseInt(stat.goals_scored) || 0;
          existing.clean_sheets += parseInt(stat.clean_sheets) || 0;
          existing.total_points += parseInt(stat.total_points) || 0;
          existing.average_rating = parseFloat(stat.average_rating) || 0; // Use rating from new stats
        } else {
          statsMap.set(stat.player_id, {
            player_id: stat.player_id,
            matches_played: parseInt(stat.matches_played) || 0,
            goals_scored: parseInt(stat.goals_scored) || 0,
            clean_sheets: parseInt(stat.clean_sheets) || 0,
            average_rating: parseFloat(stat.average_rating) || 0,
            total_points: parseInt(stat.total_points) || 0
          });
        }
      });

      allStats = Array.from(statsMap.values());
      console.log(`[Players API] Combined stats for ${allStats.length} players`);
    } catch (statsError) {
      console.log('[Players API] Could not fetch stats:', statsError.message);
      allStats = [];
    }

    // Create stats lookup map from combined stats
    const statsLookupMap = new Map();
    allStats.forEach(stat => {
      statsLookupMap.set(stat.player_id, stat);
    });

    // Batch fetch current season info (without teams join since teams are in Firebase)
    let seasonInfo = [];
    try {
      seasonInfo = await sql`
        SELECT DISTINCT ON (player_id) 
          player_id,
          category,
          team_id
        FROM player_seasons
        WHERE is_active = true
        ORDER BY player_id, created_at DESC
      `;
      console.log(`[Players API] Found season info for ${seasonInfo.length} players`);
    } catch (seasonError) {
      console.log('[Players API] Could not fetch season info, continuing without it');
      seasonInfo = [];
    }

    // Fetch team names from Firebase for players with team_id
    const teamIds = [...new Set(seasonInfo.map(s => s.team_id).filter(Boolean))];
    const teamsMap = new Map();
    if (teamIds.length > 0) {
      console.log(`[Players API] Fetching ${teamIds.length} teams from Firebase...`);
      const teamsSnapshot = await firebaseDb
        .collection('teams')
        .where('__name__', 'in', teamIds.slice(0, 30)) // Firestore 'in' limit is 30
        .get();
      teamsSnapshot.docs.forEach(doc => {
        teamsMap.set(doc.id, doc.data().name);
      });
    }

    // Create season info lookup map
    const seasonMap = new Map();
    seasonInfo.forEach(info => {
      seasonMap.set(info.player_id, {
        ...info,
        team_name: teamsMap.get(info.team_id) || null
      });
    });

    // Combine all data
    const playersWithStats = playerIds.map(playerId => {
      const playerData = playerDataMap.get(playerId);
      const stats = statsLookupMap.get(playerId);
      const season = seasonMap.get(playerId);

      return {
        id: playerData.id,
        player_id: playerId,
        name: playerData.name,
        display_name: playerData.display_name || playerData.name,
        category: season?.category || playerData.category || null,
        team: playerData.team,
        team_name: season?.team_name || playerData.team || null,
        photo_url: playerData.photo_url || null,
        current_season_id: playerData.current_season_id || null,
        matches_played: parseInt(stats?.matches_played) || 0,
        goals_scored: parseInt(stats?.goals_scored) || 0,
        clean_sheets: parseInt(stats?.clean_sheets) || 0,
        average_rating: parseFloat(stats?.average_rating) || 0,
        total_points: parseInt(stats?.total_points) || 0
      };
    });

    console.log(`[Players API] Returning ${playersWithStats.length} players with stats`);
    
    return NextResponse.json({
      success: true,
      players: playersWithStats,
      count: playersWithStats.length
    });
  } catch (error: any) {
    console.error('[Players API] Error:', error);
    console.error('[Players API] Error stack:', error.stack);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch players', details: error.stack },
      { status: 500 }
    );
  }
}
