import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase-admin/firestore';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const seasonId = params.id;
    
    if (!seasonId) {
      return NextResponse.json(
        { success: false, error: 'Season ID is required' },
        { status: 400 }
      );
    }

    console.log(`🔍 Fetching historical season data for ID: ${seasonId}`);

    // Fetch season data
    console.log('📋 Fetching season document...');
    const seasonDoc = await adminDb.collection('seasons').doc(seasonId).get();
    
    if (!seasonDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Season not found' },
        { status: 404 }
      );
    }

    const seasonData = { id: seasonDoc.id, ...seasonDoc.data() };
    
    if (!seasonData.is_historical) {
      return NextResponse.json(
        { success: false, error: 'This is not a historical season' },
        { status: 400 }
      );
    }

    console.log('✅ Season document loaded successfully');

    // Fetch teams using correct field structure
    console.log('👥 Fetching teams data...');
    const teamsQuery = adminDb.collection('teams')
      .where('seasons', 'array-contains', seasonId)
      .where('is_historical', '==', true);
    const teamsSnapshot = await teamsQuery.get();
    const teamsData = teamsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // NEW ARCHITECTURE: Fetch season-specific stats from realplayerstats collection
    console.log('⚽ Fetching player stats data from realplayerstats...');
    const playerStatsQuery = adminDb.collection('realplayerstats')
      .where('season_id', '==', seasonId);
    const playerStatsSnapshot = await playerStatsQuery.get();
    
    console.log(`📊 Found ${playerStatsSnapshot.docs.length} player stats records for this season`);
    
    // Collect unique player IDs to fetch their permanent data
    const playerIds = playerStatsSnapshot.docs.map(doc => doc.data().player_id).filter(Boolean);
    const uniquePlayerIds = [...new Set(playerIds)];
    
    console.log(`👤 Fetching permanent data for ${uniquePlayerIds.length} unique players from realplayers...`);
    
    // Fetch permanent player data for all players in this season
    const playerDataMap = new Map();
    if (uniquePlayerIds.length > 0) {
      // Firestore 'in' queries are limited to 10 items, so batch if needed
      const batchSize = 10;
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
            email: data.email,
            phone: data.phone,
            role: data.role,
            psn_id: data.psn_id,
            xbox_id: data.xbox_id,
            steam_id: data.steam_id,
            is_registered: data.is_registered,
            notes: data.notes,
          });
        });
      }
    }
    
    console.log(`✅ Retrieved permanent data for ${playerDataMap.size} players`);
    
    // Merge permanent player data with season-specific stats
    const playersData = playerStatsSnapshot.docs.map(statsDoc => {
      const statsData = statsDoc.data();
      const permanentData = playerDataMap.get(statsData.player_id) || {};
      
      return {
        id: statsDoc.id,
        player_id: statsData.player_id,
        // Permanent player info from realplayers
        name: permanentData.name || statsData.name || 'Unknown Player',
        display_name: permanentData.display_name,
        email: permanentData.email,
        phone: permanentData.phone,
        role: permanentData.role,
        psn_id: permanentData.psn_id,
        xbox_id: permanentData.xbox_id,
        steam_id: permanentData.steam_id,
        is_registered: permanentData.is_registered,
        notes: permanentData.notes,
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
    let awardsData = [];
    try {
      const awardsQuery = adminDb.collection('awards')
        .where('season_id', '==', seasonId)
        .where('is_historical', '==', true);
      const awardsSnapshot = await awardsQuery.get();
      awardsData = awardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (awardsError) {
      console.warn('Awards collection might not exist:', awardsError.message);
    }

    // Fetch matches (if they exist)
    console.log('⚽ Fetching matches data...');
    let matchesData = [];
    try {
      const matchesQuery = adminDb.collection('matches')
        .where('season_id', '==', seasonId)
        .where('is_historical', '==', true);
      const matchesSnapshot = await matchesQuery.get();
      matchesData = matchesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (matchesError) {
      console.warn('Matches collection might not exist:', matchesError.message);
    }

    console.log('✅ All data loaded successfully!');
    console.log(`  - Season: ${seasonData.name}`);
    console.log(`  - Teams: ${teamsData.length}`);
    console.log(`  - Players: ${playersData.length}`);
    console.log(`  - Awards: ${awardsData.length}`);
    console.log(`  - Matches: ${matchesData.length}`);
    
    // Debug: Show sample player data structure
    if (playersData.length > 0) {
      console.log('🔍 Sample player data:', JSON.stringify(playersData[0], null, 2));
    }

    return NextResponse.json({
      success: true,
      data: {
        season: seasonData,
        teams: teamsData,
        players: playersData,
        awards: awardsData,
        matches: matchesData
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