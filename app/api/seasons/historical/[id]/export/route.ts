import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import * as XLSX from 'xlsx';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
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

    // Fetch all season data from NEON and Firebase
    console.log('🔍 Fetching data with queries:');
    console.log('  - Teams: seasons array-contains', sessionId);
    console.log('  - Team Stats: season_id ==', sessionId, '(from NEON)');
    console.log('  - Player Stats: season_id ==', sessionId, '(from NEON)');
    
    const sql = getTournamentDb();
    
    const [seasonDoc, teamsSnapshot, teamStatsData, playerStatsData] = await Promise.all([
      adminDb.collection('seasons').doc(sessionId).get(),
      adminDb.collection('teams').where('seasons', 'array-contains', sessionId).get(),
      sql`SELECT * FROM teamstats WHERE season_id = ${sessionId}`,
      sql`SELECT * FROM realplayerstats WHERE season_id = ${sessionId}`
    ]);

    if (!seasonDoc.exists) {
      return NextResponse.json({ error: 'Season not found' }, { status: 404 });
    }

    const season = { id: seasonDoc.id, ...seasonDoc.data() } as any;

    console.log(`📊 Fetched data counts:`);
    console.log(`  - Teams snapshot: ${teamsSnapshot.docs.length}`);
    console.log(`  - Team stats from NEON: ${teamStatsData.length}`);
    console.log(`  - Player stats from NEON: ${playerStatsData.length}`);
    
    // Collect unique player IDs to fetch their permanent data
    const playerIds = playerStatsData.map((stats: any) => stats.player_id).filter(Boolean);
    const uniquePlayerIds = [...new Set(playerIds)];
    
    console.log(`👤 Fetching permanent data for ${uniquePlayerIds.length} unique players...`);
    
    // OPTIMIZED: Fetch permanent player data in larger batches
    const playerDataMap = new Map();
    if (uniquePlayerIds.length > 0) {
      const batchSize = 30; // Increased from 10 to 30 (Firestore limit)
      
      // For export, we can use pagination to load all data efficiently
      if (uniquePlayerIds.length <= 100) {
        // Small dataset - batch with getAll or where...in
        const numBatches = Math.ceil(uniquePlayerIds.length / batchSize);
        console.log(`📦 Fetching ${uniquePlayerIds.length} players in ${numBatches} batches`);
        
        for (let i = 0; i < uniquePlayerIds.length; i += batchSize) {
          const batch = uniquePlayerIds.slice(i, i + batchSize);
          const playersQuery = adminDb.collection('realplayers').where('player_id', 'in', batch);
          const playersSnapshot = await playersQuery.get();
          playersSnapshot.docs.forEach(doc => {
            const data = doc.data();
            playerDataMap.set(data.player_id, data);
          });
        }
      } else {
        // Large dataset - use pagination for better performance
        console.log(`📚 Large dataset detected (${uniquePlayerIds.length} players), using optimized pagination...`);
        
        let lastDoc = null;
        const fetchBatchSize = 100; // Fetch 100 at a time for export
        let totalFetched = 0;
        
        while (totalFetched < uniquePlayerIds.length) {
          let query = adminDb.collection('realplayers')
            .where('player_id', 'in', uniquePlayerIds.slice(totalFetched, totalFetched + batchSize))
            .limit(fetchBatchSize);
          
          if (lastDoc) {
            query = query.startAfter(lastDoc);
          }
          
          const snapshot = await query.get();
          if (snapshot.empty) break;
          
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            playerDataMap.set(data.player_id, data);
          });
          
          lastDoc = snapshot.docs[snapshot.docs.length - 1];
          totalFetched += snapshot.docs.length;
          console.log(`  ✅ Fetched ${totalFetched} / ${uniquePlayerIds.length} players`);
        }
      }
    }
    
    console.log(`✅ Retrieved permanent data for ${playerDataMap.size} players`);
    
    // Fetch player awards from Neon for this season
    const awardsData = await sql`
      SELECT player_id, award_category, award_type, season_id
      FROM player_awards
      WHERE season_id = ${sessionId}
    `;
    console.log(`🏆 Player awards fetched: ${awardsData.length}`);
    
    // Group awards by player_id
    const playerAwardsMap = new Map<string, { category_trophies: string[], individual_trophies: string[] }>();
    awardsData.forEach((award: any) => {
      if (!playerAwardsMap.has(award.player_id)) {
        playerAwardsMap.set(award.player_id, { category_trophies: [], individual_trophies: [] });
      }
      const awards = playerAwardsMap.get(award.player_id)!;
      if (award.award_category === 'category') {
        awards.category_trophies.push(award.award_type);
      } else if (award.award_category === 'individual') {
        awards.individual_trophies.push(award.award_type);
      }
    });
    
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
    if (playerStatsData.length > 0) {
      const firstStats = playerStatsData[0];
      const permanentData = playerDataMap.get(firstStats.player_id);
      console.log('👁️ First player data (merged):', {
        id: firstStats.id,
        player_id: firstStats.player_id,
        name_from_permanent: permanentData?.name,
        category_from_stats: firstStats.category,
        team_from_stats: firstStats.team,
        season_id: firstStats.season_id
      });
    }

    // Create a map of team stats by team_id
    const teamStatsMap = new Map();
    teamStatsData.forEach((data: any) => {
      if (data.team_id) {
        teamStatsMap.set(data.team_id, data);
      }
    });
    
    console.log(`🎯 Team stats map size: ${teamStatsMap.size}`);
    
    // Process teams data - merge team info with stats from teamstats collection
    const teams = teamsSnapshot.docs.map(doc => {
      const teamData = doc.data();
      const teamStats = teamStatsMap.get(doc.id) || {};
      
      console.log(`Team: ${teamData.team_name}, Stats found:`, {
        rank: teamStats.rank,
        points: teamStats.points,
        wins: teamStats.wins
      });
      
      return {
        id: doc.id,
        team_name: teamData.team_name || '',
        team_code: teamData.team_code || '',
        owner_name: teamData.owner_name || '',
        owner_email: teamData.owner_email || '',
        // Team standings data from teamstats collection
        rank: teamStats.rank || 0,
        p: teamStats.points || 0,
        mp: teamStats.matches_played || 0,
        w: teamStats.wins || 0,
        d: teamStats.draws || 0,
        l: teamStats.losses || 0,
        f: teamStats.goals_for || 0,
        a: teamStats.goals_against || 0,
        gd: teamStats.goal_difference || 0,
        percentage: teamStats.win_percentage || 0,
        cup: teamStats.cup_achievement || ''
      };
    });
    
    console.log(`🎯 Processed teams: ${teams.length}`);

    // Process players data - merge permanent data with season stats from Neon
    const players = playerStatsData.map((statsData: any) => {
      const permanentData = playerDataMap.get(statsData.player_id) || {};
      const playerAwards = playerAwardsMap.get(statsData.player_id) || { category_trophies: [], individual_trophies: [] };
      
      return {
        player_id: statsData.player_id || statsData.id,
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
        potm: statsData.potm || statsData.stats?.potm || null, // Player of the Match (nullable)
        current_season_matches: statsData.current_season_matches || statsData.stats?.current_season_matches || 0,
        current_season_wins: statsData.current_season_wins || statsData.stats?.current_season_wins || 0,
        // Trophy arrays from player_awards table
        category_trophies: playerAwards.category_trophies,
        individual_trophies: playerAwards.individual_trophies
      };
    });

    // Create Excel workbook
    const workbook = XLSX.utils.book_new();

    // Teams Sheet (full structure with standings)
    const teamsSheetData = teams.map(team => ({
      rank: team.rank,
      team: team.team_name || '',
      owner_name: team.owner_name || '',
      p: team.p,
      mp: team.mp,
      w: team.w,
      d: team.d,
      l: team.l,
      f: team.f,
      a: team.a,
      gd: team.gd,
      percentage: team.percentage,
      cup: team.cup
    }));
    
    // Always create Teams sheet, even if empty
    const teamsSheet = teamsSheetData.length > 0 
      ? XLSX.utils.json_to_sheet(teamsSheetData)
      : XLSX.utils.aoa_to_sheet([['rank', 'team', 'owner_name', 'p', 'mp', 'w', 'd', 'l', 'f', 'a', 'gd', 'percentage', 'cup']]);
    
    // Set column widths
    teamsSheet['!cols'] = [
      { width: 8 },  // rank
      { width: 25 }, // team
      { width: 20 }, // owner_name
      { width: 8 },  // p
      { width: 8 },  // mp
      { width: 8 },  // w
      { width: 8 },  // d
      { width: 8 },  // l
      { width: 8 },  // f
      { width: 8 },  // a
      { width: 8 },  // gd
      { width: 10 }, // percentage
      { width: 15 }  // cup
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
      
      // Build the base player data
      const playerRow: any = {
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
        potm: player.potm || '', // Player of the Match (nullable)
        win: wins,
        draw: draws,
        loss: losses,
        total_matches: totalMatches,
        total_points: wins * 3 + draws * 1
      };
      
      // Always add at least 5 trophy columns for each type (for editing capability)
      // Fill existing trophies first, then add empty placeholders
      for (let i = 1; i <= 5; i++) {
        const catTrophy = player.category_trophies?.[i - 1] || '';
        playerRow[`Cat Trophy ${i}`] = catTrophy;
      }
      
      for (let i = 1; i <= 5; i++) {
        const indTrophy = player.individual_trophies?.[i - 1] || '';
        playerRow[`Ind Trophy ${i}`] = indTrophy;
      }
      
      // If player has MORE than 5 trophies, add additional columns
      if (player.category_trophies && player.category_trophies.length > 5) {
        for (let i = 6; i <= player.category_trophies.length; i++) {
          playerRow[`Cat Trophy ${i}`] = player.category_trophies[i - 1];
        }
      }
      
      if (player.individual_trophies && player.individual_trophies.length > 5) {
        for (let i = 6; i <= player.individual_trophies.length; i++) {
          playerRow[`Ind Trophy ${i}`] = player.individual_trophies[i - 1];
        }
      }
      
      return playerRow;
    });
    
    // Always create Players sheet, even if empty
    const playersSheet = playersSheetData.length > 0
      ? XLSX.utils.json_to_sheet(playersSheetData)
      : XLSX.utils.aoa_to_sheet([[
          'name', 'team', 'category', 'goals_scored', 'goals_per_game',
          'goals_conceded', 'conceded_per_game', 'net_goals', 'cleansheets',
          'points', 'potm', 'win', 'draw', 'loss', 'total_matches', 'total_points',
          'Cat Trophy 1', 'Cat Trophy 2', 'Cat Trophy 3', 'Cat Trophy 4', 'Cat Trophy 5',
          'Ind Trophy 1', 'Ind Trophy 2', 'Ind Trophy 3', 'Ind Trophy 4', 'Ind Trophy 5'
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