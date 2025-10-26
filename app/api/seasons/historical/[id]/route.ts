import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { FieldValue } from 'firebase-admin/firestore';

// Enable caching for historical data (1 hour)
export const revalidate = 3600;

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

    // Get pagination parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const loadAll = searchParams.get('loadAll') === 'true';

    console.log(`🔍 Fetching historical season data for ID: ${seasonId} (page: ${page}, pageSize: ${pageSize}, loadAll: ${loadAll})`);

    // Fetch season data
    console.log('📋 Fetching season document...');
    const seasonDoc = await adminDb.collection('seasons').doc(seasonId).get();
    
    if (!seasonDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Season not found' },
        { status: 404 }
      );
    }

    const seasonData = { id: seasonDoc.id, ...seasonDoc.data() } as any;
    
    if (!seasonData.is_historical) {
      return NextResponse.json(
        { success: false, error: 'This is not a historical season' },
        { status: 400 }
      );
    }

    console.log('✅ Season document loaded successfully');

    // Fetch teams - only permanent data
    console.log('👥 Fetching teams permanent data...');
    const teamsQuery = adminDb.collection('teams')
      .where('seasons', 'array-contains', seasonId)
      .where('is_historical', '==', true);
    const teamsSnapshot = await teamsQuery.get();
    const teamsData = teamsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Fetch team stats for this season from NEON
    console.log('📊 Fetching team stats data from NEON...');
    const sql = getTournamentDb();
    const teamStatsData = await sql`
      SELECT * FROM teamstats WHERE season_id = ${seasonId}
    `;
    
    console.log(`✅ Found ${teamStatsData.length} team stats records for this season`);
    
    // Merge permanent team data with season-specific stats
    const teamsWithStats = teamsData.map(team => {
      const seasonStats = teamStatsData.find(stats => stats.team_id === team.id);
      return {
        ...team,
        season_stats: seasonStats || null
      };
    });

    // Fetch season-specific stats from NEON realplayerstats table
    console.log('⚽ Fetching player stats data from NEON...');
    
    // Get total count first (for pagination)
    const countResult = await sql`
      SELECT COUNT(*) as count FROM realplayerstats WHERE season_id = ${seasonId}
    `;
    const totalPlayers = parseInt(countResult[0]?.count || '0');
    
    console.log(`📊 Total players in season: ${totalPlayers}`);
    
    // Apply pagination if not loading all
    let playerStatsData;
    if (!loadAll) {
      const offset = (page - 1) * pageSize;
      console.log(`📖 Loading page ${page} (${pageSize} players, offset ${offset})`);
      playerStatsData = await sql`
        SELECT * FROM realplayerstats 
        WHERE season_id = ${seasonId}
        ORDER BY player_name
        LIMIT ${pageSize} OFFSET ${offset}
      `;
    } else {
      console.log(`📚 Loading all ${totalPlayers} players`);
      playerStatsData = await sql`
        SELECT * FROM realplayerstats 
        WHERE season_id = ${seasonId}
        ORDER BY player_name
      `;
    }
    
    console.log(`📊 Loaded ${playerStatsData.length} player stats records for this page`);
    
    // Collect unique player IDs to fetch their permanent data
    const playerIds = playerStatsData.map((stats: any) => stats.player_id).filter(Boolean);
    const uniquePlayerIds = [...new Set(playerIds)];
    
    console.log(`👤 Fetching permanent data for ${uniquePlayerIds.length} unique players from realplayers...`);
    
    // Fetch permanent player data for all players in this season
    const playerDataMap = new Map();
    if (uniquePlayerIds.length > 0) {
      // OPTIMIZED: Use larger batch size (Firestore 'in' limit is 30)
      const batchSize = 30;
      
      // OPTIMIZATION 1: Use getAll for direct document fetches when possible
      // This is more efficient than 'where...in' queries
      if (uniquePlayerIds.length <= 30) {
        // Single batch - use getAll for maximum efficiency
        const docRefs = uniquePlayerIds.map(playerId => 
          adminDb.collection('realplayers').doc(playerId)
        );
        const playerDocs = await adminDb.getAll(...docRefs);
        
        playerDocs.forEach(doc => {
          if (doc.exists) {
            const data = doc.data();
            playerDataMap.set(doc.id, {
              id: doc.id,
              player_id: data?.player_id,
              name: data?.name,
              display_name: data?.display_name,
              // Only fetch essential fields to reduce read size
              psn_id: data?.psn_id,
              is_registered: data?.is_registered,
            });
          }
        });
        console.log(`✅ Fetched ${playerDocs.length} players in single getAll batch`);
      } else {
        // Multiple batches needed - use where...in queries
        const numBatches = Math.ceil(uniquePlayerIds.length / batchSize);
        console.log(`📦 Fetching ${uniquePlayerIds.length} players in ${numBatches} batches of ${batchSize}`);
        
        for (let i = 0; i < uniquePlayerIds.length; i += batchSize) {
          const batch = uniquePlayerIds.slice(i, i + batchSize);
          const playersQuery = adminDb.collection('realplayers')
            .where('player_id', 'in', batch);
          const playersSnapshot = await playersQuery.get();
          
          playersSnapshot.docs.forEach(doc => {
            const data = doc.data();
            playerDataMap.set(data.player_id, {
              id: doc.id,
              player_id: data.player_id,
              name: data.name,
              display_name: data.display_name,
              psn_id: data.psn_id,
              is_registered: data.is_registered,
            });
          });
        }
      }
    }
    
    console.log(`✅ Retrieved permanent data for ${playerDataMap.size} players`);
    
    // Merge permanent player data with season-specific stats from Neon
    const playersData = playerStatsData.map((statsData: any) => {
      const permanentData = playerDataMap.get(statsData.player_id) || {};
      
      return {
        id: statsData.id,
        player_id: statsData.player_id,
        // Permanent player info from realplayers (optimized - only essential fields)
        name: permanentData.name || statsData.player_name || statsData.name || 'Unknown Player',
        display_name: permanentData.display_name || statsData.display_name,
        psn_id: permanentData.psn_id || statsData.psn_id,
        is_registered: permanentData.is_registered || statsData.is_registered || false,
        // Note: Other fields (email, phone, role, xbox_id, steam_id, notes) are not needed for display
        // They can be fetched individually when viewing player detail page
        // Season-specific data from realplayerstats
        season_id: statsData.season_id,
        category: statsData.category,
        team: statsData.team,
        is_active: statsData.is_active,
        is_available: statsData.is_available,
        // Statistics - prefer flattened fields, fallback to nested stats object
        stats: {
          matches_played: statsData.matches_played || statsData.stats?.matches_played || 0,
          matches_won: statsData.matches_won || statsData.stats?.matches_won || 0,
          matches_lost: statsData.matches_lost || statsData.stats?.matches_lost || 0,
          matches_drawn: statsData.matches_drawn || statsData.stats?.matches_drawn || 0,
          goals_scored: statsData.goals_scored || statsData.stats?.goals_scored || 0,
          goals_per_game: statsData.goals_per_game || statsData.stats?.goals_per_game || 0,
          goals_conceded: statsData.goals_conceded || statsData.stats?.goals_conceded || 0,
          conceded_per_game: statsData.conceded_per_game || statsData.stats?.conceded_per_game || 0,
          net_goals: statsData.net_goals || statsData.stats?.net_goals || 0,
          assists: statsData.assists || statsData.stats?.assists || 0,
          clean_sheets: statsData.clean_sheets || statsData.stats?.clean_sheets || 0,
          points: statsData.points || statsData.stats?.points || 0,
          total_points: statsData.total_points || statsData.stats?.total_points || 0,
          potm: statsData.potm || statsData.stats?.potm || null,
          win_rate: statsData.win_rate || statsData.stats?.win_rate || 0,
          average_rating: statsData.average_rating || statsData.stats?.average_rating || 0,
          current_season_matches: statsData.current_season_matches || statsData.stats?.current_season_matches || 0,
          current_season_wins: statsData.current_season_wins || statsData.stats?.current_season_wins || 0,
        },
      };
    });
    
    console.log(`✅ Merged ${playersData.length} complete player records (permanent + season stats)`);
    if (playersData.length > 0) {
      console.log('🔍 Sample merged player data structure:', JSON.stringify({
        player_id: playersData[0].player_id,
        name: playersData[0].name,
        category: playersData[0].category,
        team: playersData[0].team,
        has_stats: !!playersData[0].stats,
      }, null, 2));
    }

    // Fetch awards (if they exist)
    console.log('🏆 Fetching awards data...');
    let awardsData: any[] = [];
    try {
      const awardsQuery = adminDb.collection('awards')
        .where('season_id', '==', seasonId)
        .where('is_historical', '==', true);
      const awardsSnapshot = await awardsQuery.get();
      awardsData = awardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (awardsError: any) {
      console.warn('Awards collection might not exist:', awardsError.message);
    }

    // Fetch matches (if they exist)
    console.log('⚽ Fetching matches data...');
    let matchesData: any[] = [];
    try {
      const matchesQuery = adminDb.collection('matches')
        .where('season_id', '==', seasonId)
        .where('is_historical', '==', true);
      const matchesSnapshot = await matchesQuery.get();
      matchesData = matchesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (matchesError: any) {
      console.warn('Matches collection might not exist:', matchesError.message);
    }

    console.log('✅ All data loaded successfully!');
    console.log(`  - Season: ${seasonData.name}`);
    console.log(`  - Teams: ${teamsWithStats.length}`);
    console.log(`  - Team Stats: ${teamStatsData.length}`);
    console.log(`  - Players: ${playersData.length}`);
    console.log(`  - Awards: ${awardsData.length}`);
    console.log(`  - Matches: ${matchesData.length}`);
    
    // Debug: Show sample team and player data structure
    if (teamsWithStats.length > 0) {
      console.log('🔍 Sample team data:', JSON.stringify({
        team_id: teamsWithStats[0].id,
        team_name: teamsWithStats[0].team_name,
        has_season_stats: !!teamsWithStats[0].season_stats,
        season_stats_sample: teamsWithStats[0].season_stats ? {
          rank: teamsWithStats[0].season_stats.rank,
          points: teamsWithStats[0].season_stats.points,
          matches_played: teamsWithStats[0].season_stats.matches_played
        } : null
      }, null, 2));
    }
    if (playersData.length > 0) {
      console.log('🔍 Sample player data:', JSON.stringify(playersData[0], null, 2));
    }

    // Calculate pagination info
    const totalPages = Math.ceil(totalPlayers / pageSize);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      success: true,
      data: {
        season: seasonData,
        teams: teamsWithStats,
        players: playersData,
        awards: awardsData,
        matches: matchesData
      },
      pagination: {
        currentPage: page,
        pageSize: pageSize,
        totalPlayers: totalPlayers,
        totalPages: totalPages,
        hasNextPage: hasNextPage,
        hasPrevPage: hasPrevPage,
        loadedAll: loadAll
      }
    });

  } catch (error: any) {
    console.error('❌ Error fetching historical season data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch season data',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// PATCH endpoint to update historical season metadata
export async function PATCH(
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

    console.log(`✏️ Updating historical season metadata for ID: ${seasonId}`);

    // Verify season exists and is historical
    const seasonDoc = await adminDb.collection('seasons').doc(seasonId).get();
    
    if (!seasonDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Season not found' },
        { status: 404 }
      );
    }

    const seasonData = seasonDoc.data();
    if (!seasonData?.is_historical) {
      return NextResponse.json(
        { success: false, error: 'This is not a historical season' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    
    // Define allowed fields for update
    const allowedFields = [
      'name',
      'short_name',
      'description',
      'season_start',
      'season_end',
      'champion_team_id',
      'champion_team_name',
      'runner_up_team_id',
      'runner_up_team_name',
      'top_scorer_player_id',
      'top_scorer_player_name',
      'top_scorer_goals',
      'best_goalkeeper_player_id',
      'best_goalkeeper_player_name',
      'best_goalkeeper_clean_sheets',
      'most_assists_player_id',
      'most_assists_player_name',
      'most_assists_count',
      'mvp_player_id',
      'mvp_player_name',
      'total_teams',
      'total_players',
      'total_matches',
      'notes'
    ];

    // Filter and prepare update data
    const updateData: any = {};
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Ensure at least one field is being updated
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields provided for update' },
        { status: 400 }
      );
    }

    // Add updated timestamp
    updateData.updated_at = new Date();

    console.log(`📝 Updating fields:`, Object.keys(updateData));

    // Update the season document
    await adminDb.collection('seasons').doc(seasonId).update(updateData);

    console.log(`✅ Successfully updated historical season: ${seasonId}`);

    // Fetch and return updated season data
    const updatedDoc = await adminDb.collection('seasons').doc(seasonId).get();
    const updatedData = { id: updatedDoc.id, ...updatedDoc.data() };

    return NextResponse.json({
      success: true,
      message: 'Season metadata updated successfully',
      data: updatedData
    });

  } catch (error: any) {
    console.error('❌ Error updating historical season:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update season',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete a historical season and all its associated data
 * Deletes:
 * - Season document
 * - Player stats (realplayerstats)
 * - Team stats (teamstats)
 * - Awards
 * - Removes season from teams' seasons array
 */
export async function DELETE(
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

    console.log(`🗑️ Deleting historical season: ${seasonId}`);

    // Verify season exists and is historical
    const seasonDoc = await adminDb.collection('seasons').doc(seasonId).get();
    
    if (!seasonDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Season not found' },
        { status: 404 }
      );
    }

    const seasonData = seasonDoc.data();
    if (!seasonData?.is_historical) {
      return NextResponse.json(
        { success: false, error: 'Can only delete historical seasons' },
        { status: 400 }
      );
    }

    console.log(`✅ Season verified as historical, proceeding with deletion`);

    // Delete stats from NEON instead of Firebase
    console.log('🗑️ Deleting stats from NEON...');
    const sql = getTournamentDb();
    
    const deletedPlayerStats = await sql`
      DELETE FROM realplayerstats
      WHERE season_id = ${seasonId}
      RETURNING id
    `;
    
    const deletedTeamStats = await sql`
      DELETE FROM teamstats
      WHERE season_id = ${seasonId}
      RETURNING id
    `;
    
    console.log(`✅ Deleted ${deletedPlayerStats.length} player stats from NEON`);
    console.log(`✅ Deleted ${deletedTeamStats.length} team stats from NEON`);
    
    // Get awards count from Firebase (awards stay in Firebase)
    const awardsSnapshot = await adminDb.collection('awards')
      .where('season_id', '==', seasonId)
      .get();
    
    console.log(`📊 Data to delete:`);
    console.log(`   - Player stats: ${deletedPlayerStats.length}`);
    console.log(`   - Team stats: ${deletedTeamStats.length}`);
    console.log(`   - Awards: ${awardsSnapshot.size}`);

    // Delete awards from Firebase (awards collection stays in Firebase)
    console.log(`🗑️ Deleting awards...`);
    
    const awardsBatch = adminDb.batch();
    awardsSnapshot.docs.forEach(doc => {
      awardsBatch.delete(doc.ref);
    });
    await awardsBatch.commit();
    console.log(`✅ Deleted ${awardsSnapshot.size} awards records`);

    // Step 4: Remove season from teams' seasons array
    console.log(`🗑️ Removing season from teams...`);
    const teamsSnapshot = await adminDb
      .collection('teams')
      .where('seasons', 'array-contains', seasonId)
      .get();
    
    const teamsBatch = adminDb.batch();
    teamsSnapshot.docs.forEach(doc => {
      teamsBatch.update(doc.ref, {
        seasons: FieldValue.arrayRemove(seasonId)
      });
    });
    await teamsBatch.commit();
    console.log(`✅ Removed season from ${teamsSnapshot.size} teams`);

    // Step 5: Delete the season document itself
    console.log(`🗑️ Deleting season document...`);
    await adminDb.collection('seasons').doc(seasonId).delete();
    console.log(`✅ Deleted season document`);

    console.log(`✅ Successfully deleted historical season: ${seasonId}`);

    return NextResponse.json({
      success: true,
      message: 'Historical season deleted successfully',
      deleted: {
        seasonId,
        playerStats: deletedPlayerStats.length,
        teamStats: deletedTeamStats.length,
        awards: awardsSnapshot.size,
        teamsUpdated: teamsSnapshot.size
      }
    });

  } catch (error: any) {
    console.error('❌ Error deleting historical season:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete season',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
