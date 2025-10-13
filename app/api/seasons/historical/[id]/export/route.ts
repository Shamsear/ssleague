import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import * as XLSX from 'xlsx';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;
    console.log(`📤 Exporting historical season data for ID: ${sessionId}`);

    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    // Check user role from Firestore user document
    console.log(`Checking user role for UID: ${decodedToken.uid}`);
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists) {
      console.log('❌ User document not found in Firestore');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const userData = userDoc.data();
    console.log(`User role: ${userData?.role}`);
    if (userData?.role !== 'super_admin') {
      console.log(`❌ Access denied. Required: super_admin, Current: ${userData?.role}`);
      return NextResponse.json({ error: 'Forbidden: Super admin access required' }, { status: 403 });
    }
    
    console.log('✅ Super admin access confirmed');

    // NEW ARCHITECTURE: Fetch all season data from both collections
    console.log('🔍 Fetching data with queries:');
    console.log('  - Teams: seasons array-contains', sessionId, 'AND is_historical == true');
    console.log('  - Player Stats: season_id ==', sessionId, '(from realplayerstats)');
    
    const [seasonDoc, teamsSnapshot, playerStatsSnapshot] = await Promise.all([
      adminDb.collection('seasons').doc(sessionId).get(),
      adminDb.collection('teams').where('seasons', 'array-contains', sessionId).where('is_historical', '==', true).get(),
      adminDb.collection('realplayerstats').where('season_id', '==', sessionId).get()
    ]);

    if (!seasonDoc.exists) {
      return NextResponse.json({ error: 'Season not found' }, { status: 404 });
    }

    const season = { id: seasonDoc.id, ...seasonDoc.data() };

    console.log(`📊 Fetched data counts:`);
    console.log(`  - Teams snapshot: ${teamsSnapshot.docs.length}`);
    console.log(`  - Player stats snapshot: ${playerStatsSnapshot.docs.length}`);
    
    // Collect unique player IDs to fetch their permanent data
    const playerIds = playerStatsSnapshot.docs.map(doc => doc.data().player_id).filter(Boolean);
    const uniquePlayerIds = [...new Set(playerIds)];
    
    console.log(`👤 Fetching permanent data for ${uniquePlayerIds.length} unique players...`);
    
    // Fetch permanent player data (batch if needed)
    const playerDataMap = new Map();
    if (uniquePlayerIds.length > 0) {
      const batchSize = 10;
      for (let i = 0; i < uniquePlayerIds.length; i += batchSize) {
        const batch = uniquePlayerIds.slice(i, i + batchSize);
        const playersQuery = adminDb.collection('realplayers').where('player_id', 'in', batch);
        const playersSnapshot = await playersQuery.get();
        playersSnapshot.docs.forEach(doc => {
          const data = doc.data();
          playerDataMap.set(data.player_id, data);
        });
      }
    }
    
    console.log(`✅ Retrieved permanent data for ${playerDataMap.size} players`);
    
    // Debug: Log first team if exists
    if (teamsSnapshot.docs.length > 0) {
      const firstTeam = teamsSnapshot.docs[0].data();
      console.log('👁️ First team data:', {
        id: teamsSnapshot.docs[0].id,
        seasons: firstTeam.seasons,
        is_historical: firstTeam.is_historical,
        team_name: firstTeam.team_name
      });
    }
    
    // Debug: Log first player if exists
    if (playerStatsSnapshot.docs.length > 0) {
      const firstStats = playerStatsSnapshot.docs[0].data();
      const permanentData = playerDataMap.get(firstStats.player_id);
      console.log('👁️ First player data (merged):', {
        id: playerStatsSnapshot.docs[0].id,
        player_id: firstStats.player_id,
        name_from_permanent: permanentData?.name,
        category_from_stats: firstStats.category,
        team_from_stats: firstStats.team,
        season_id: firstStats.season_id
      });
    }

    // Process teams data
    const teams = teamsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        team_name: data.team_name || '',
        team_code: data.team_code || '',
        owner_name: data.owner_name || '',
        owner_email: data.owner_email || '',
        seasons: data.seasons || [],
        is_historical: data.is_historical || false
      };
    });
    
    console.log(`🎯 Processed teams: ${teams.length}`);

    // Process players data - merge permanent data with season stats
    const players = playerStatsSnapshot.docs.map(doc => {
      const statsData = doc.data();
      const permanentData = playerDataMap.get(statsData.player_id) || {};
      
      return {
        player_id: statsData.player_id || doc.id,
        // Permanent player info from realplayers
        name: permanentData.name || statsData.name || '',
        display_name: permanentData.display_name || '',
        email: permanentData.email || '',
        phone: permanentData.phone || '',
        role: permanentData.role || 'player',
        psn_id: permanentData.psn_id || '',
        xbox_id: permanentData.xbox_id || '',
        steam_id: permanentData.steam_id || '',
        is_registered: permanentData.is_registered || false,
        notes: permanentData.notes || '',
        // Season-specific data from realplayerstats
        category: statsData.category || '',
        team_name: statsData.team || '',
        season_id: statsData.season_id || sessionId,
        is_active: statsData.is_active !== false,
        is_available: statsData.is_available !== false,
        // Statistics - prefer flattened fields, fallback to nested stats object
        matches_played: statsData.matches_played || statsData.stats?.matches_played || 0,
        matches_won: statsData.matches_won || statsData.stats?.matches_won || 0,
        matches_lost: statsData.matches_lost || statsData.stats?.matches_lost || 0,
        matches_drawn: statsData.matches_drawn || statsData.stats?.matches_drawn || 0,
        goals_scored: statsData.goals_scored || statsData.stats?.goals_scored || 0,
        assists: statsData.assists || statsData.stats?.assists || 0,
        clean_sheets: statsData.clean_sheets || statsData.stats?.clean_sheets || 0,
        win_rate: statsData.win_rate || statsData.stats?.win_rate || 0,
        average_rating: statsData.average_rating || statsData.stats?.average_rating || 0,
        current_season_matches: statsData.current_season_matches || statsData.stats?.current_season_matches || 0,
        current_season_wins: statsData.current_season_wins || statsData.stats?.current_season_wins || 0
      };
    });

    // Create Excel workbook
    const workbook = XLSX.utils.book_new();

    // Teams Sheet (same structure as template)
    const teamsSheetData = teams.map(team => ({
      team_name: team.team_name || '',
      owner_name: team.owner_name || ''
    }));
    
    // Always create Teams sheet, even if empty
    const teamsSheet = teamsSheetData.length > 0 
      ? XLSX.utils.json_to_sheet(teamsSheetData)
      : XLSX.utils.aoa_to_sheet([['team_name', 'owner_name']]);
    
    // Set column widths
    teamsSheet['!cols'] = [
      { width: 25 }, // team_name
      { width: 20 }  // owner_name
    ];
    
    XLSX.utils.book_append_sheet(workbook, teamsSheet, 'Teams');

    // Players Sheet (compatible with preview system)
    const playersSheetData = players.map(player => {
      const totalMatches = player.matches_played || 0;
      const goalsScored = player.goals_scored || 0;
      const wins = player.matches_won || 0;
      const draws = player.matches_drawn || 0;
      const losses = player.matches_lost || 0;
      const cleansheets = player.clean_sheets || 0;
      
      return {
        name: player.name || '',
        team: player.team_name || '',
        category: player.category || '',
        goals_scored: goalsScored,
        goals_per_game: totalMatches > 0 ? (goalsScored / totalMatches).toFixed(2) : 0,
        goals_conceded: 0, // Default value - would need to be calculated from match data
        conceded_per_game: 0, // Default value
        net_goals: goalsScored, // Simplified calculation
        cleansheets: cleansheets,
        points: wins * 3 + draws * 1, // Standard points calculation
        win: wins,
        draw: draws,
        loss: losses,
        total_matches: totalMatches,
        total_points: wins * 3 + draws * 1
      };
    });
    
    // Always create Players sheet, even if empty
    const playersSheet = playersSheetData.length > 0
      ? XLSX.utils.json_to_sheet(playersSheetData)
      : XLSX.utils.aoa_to_sheet([[
          'name', 'team', 'category', 'goals_scored', 'goals_per_game',
          'goals_conceded', 'conceded_per_game', 'net_goals', 'cleansheets',
          'points', 'win', 'draw', 'loss', 'total_matches', 'total_points'
        ]]);
    
    // Set column widths (same as template)
    playersSheet['!cols'] = [
      { width: 25 }, // name
      { width: 25 }, // team
      { width: 15 }, // category
      { width: 12 }, // goals_scored
      { width: 12 }, // goals_per_game
      { width: 12 }, // goals_conceded
      { width: 12 }, // conceded_per_game
      { width: 12 }, // net_goals
      { width: 12 }, // cleansheets
      { width: 10 }, // points
      { width: 10 }, // win
      { width: 10 }, // draw
      { width: 10 }, // loss
      { width: 15 }, // total_matches
      { width: 12 }  // total_points
    ];
    
    XLSX.utils.book_append_sheet(workbook, playersSheet, 'Players');

    // Generate Excel buffer
    const buffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx',
      compression: true
    });

    // Create filename
    const filename = `historical_season_${season.short_name || season.name || sessionId}_${new Date().toISOString().split('T')[0]}.xlsx`;
    const hasData = teamsSheetData.length > 0 || playersSheetData.length > 0;

    console.log(`✅ Excel export generated: ${filename}`);
    console.log(`  - Type: ${hasData ? 'Data Export' : 'Empty Template'}`);
    console.log(`  - Teams: ${teamsSheetData.length}`);
    console.log(`  - Players: ${playersSheetData.length}`);
    console.log(`  - Structure: Teams and Players sheets`);

    // Return Excel file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString()
      }
    });

  } catch (error: any) {
    console.error('❌ Error exporting season data:', error);
    return NextResponse.json({ 
      error: 'Failed to export season data',
      details: error.message 
    }, { status: 500 });
  }
}