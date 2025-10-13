import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import * as XLSX from 'xlsx';
import { FieldValue } from 'firebase-admin/firestore';

interface ImportStats {
  teams: { updated: number; unchanged: number; errors: string[] };
  players: { updated: number; unchanged: number; errors: string[] };
  awards: { updated: number; unchanged: number; errors: string[] };
  matches: { updated: number; unchanged: number; errors: string[] };
}

// Helper function to get existing player by name or create new one
const getOrCreatePlayerByName = async (name: string): Promise<{ playerId: string; isNew: boolean }> => {
  try {
    // First, try to find existing player by name
    const existingPlayersQuery = await adminDb.collection('realplayers')
      .where('name', '==', name)
      .limit(1)
      .get();
    
    if (!existingPlayersQuery.empty) {
      const existingPlayer = existingPlayersQuery.docs[0];
      const playerId = existingPlayer.data().player_id;
      console.log(`  ✅ Found existing player: ${name} with ID: ${playerId}`);
      return { playerId, isNew: false };
    }
    
    // No existing player found, generate new ID
    const playerId = await generateNewPlayerId();
    console.log(`  🆕 Will create new player: ${name} with ID: ${playerId}`);
    return { playerId, isNew: true };
  } catch (error) {
    console.error('Error in getOrCreatePlayerByName:', error);
    throw error;
  }
};

// Generate custom player ID (sspslpsl0001, sspslpsl0002, etc.)
const generateNewPlayerId = async (): Promise<string> => {
  const prefix = 'sspslpsl';
  
  try {
    // Get all players to find the highest number
    const playersQuery = await adminDb.collection('realplayers').get();
    
    let maxNumber = 0;
    playersQuery.forEach((doc) => {
      const data = doc.data();
      if (data.player_id && data.player_id.startsWith(prefix)) {
        const numberPart = parseInt(data.player_id.substring(prefix.length));
        if (!isNaN(numberPart) && numberPart > maxNumber) {
          maxNumber = numberPart;
        }
      }
    });
    
    const nextNumber = maxNumber + 1;
    const paddedNumber = nextNumber.toString().padStart(4, '0');
    return `${prefix}${paddedNumber}`;
  } catch (error) {
    console.error('Error generating player ID:', error);
    // Fallback to random number if query fails
    const randomNumber = Math.floor(Math.random() * 10000);
    return `${prefix}${randomNumber.toString().padStart(4, '0')}`;
  }
};

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const seasonId = params.id;
    console.log(`📤 Importing Excel data for historical season ID: ${seasonId}`);

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

    // Check content type to determine if this is a file upload or JSON preview import
    const contentType = request.headers.get('content-type') || '';
    console.log('📝 Content-Type:', contentType);
    
    let teamsToImport: any[] = [];
    let playersToImport: any[] = [];
    
    if (contentType.includes('application/json')) {
      // Import from preview data (JSON)
      console.log('📊 Importing from preview data (JSON)');
      const jsonData = await request.json();
      teamsToImport = jsonData.teams || [];
      playersToImport = jsonData.players || [];
      
      console.log(`  - Teams to import: ${teamsToImport.length}`);
      console.log(`  - Players to import: ${playersToImport.length}`);
    } else {
      // Import from Excel file upload
      console.log('📊 Importing from Excel file');
      const formData = await request.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      }

      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        return NextResponse.json({ error: 'Invalid file format. Please upload an Excel file.' }, { status: 400 });
      }

      // Read Excel file
      const buffer = Buffer.from(await file.arrayBuffer());
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      
      // Extract teams data from Excel
      if (workbook.SheetNames.includes('Teams')) {
        const teamsSheet = workbook.Sheets['Teams'];
        teamsToImport = XLSX.utils.sheet_to_json(teamsSheet);
      }
      
      // Extract players data from Excel
      if (workbook.SheetNames.includes('Players')) {
        const playersSheet = workbook.Sheets['Players'];
        playersToImport = XLSX.utils.sheet_to_json(playersSheet);
      }
    }

    const stats: ImportStats = {
      teams: { updated: 0, unchanged: 0, errors: [] },
      players: { updated: 0, unchanged: 0, errors: [] },
      awards: { updated: 0, unchanged: 0, errors: [] },
      matches: { updated: 0, unchanged: 0, errors: [] }
    };

    // Verify season exists
    const seasonDoc = await adminDb.collection('seasons').doc(seasonId).get();
    if (!seasonDoc.exists) {
      return NextResponse.json({ error: 'Season not found' }, { status: 404 });
    }

    // CLEANUP PHASE: Delete existing season stats before importing
    console.log('🗑️  Starting cleanup phase for season stats...');
    
    // Get all player stats records for this season
    const existingStatsQuery = await adminDb.collection('realplayerstats')
      .where('season_id', '==', seasonId)
      .get();
    
    const statsDocsToDelete: string[] = [];
    
    existingStatsQuery.forEach(doc => {
      statsDocsToDelete.push(doc.id);
    });
    
    console.log(`  Found ${statsDocsToDelete.length} player stats records to delete`);
    
    // Delete all realplayerstats records for this season
    if (statsDocsToDelete.length > 0) {
      const deleteBatch = adminDb.batch();
      statsDocsToDelete.forEach(docId => {
        deleteBatch.delete(adminDb.collection('realplayerstats').doc(docId));
      });
      await deleteBatch.commit();
      console.log(`  ✅ Deleted ${statsDocsToDelete.length} player stats records`);
    } else {
      console.log(`  ℹ️  No existing stats to delete (first import or empty season)`);
    }
    
    console.log('✅ Cleanup phase completed');
    console.log('📥 Starting fresh import...\n');

    // OPTIMIZATION: Fetch season name for denormalization
    const seasonData = seasonDoc.data();
    const seasonName = seasonData?.name || seasonData?.short_name || seasonId;
    console.log(`  Season name: ${seasonName}`);

    // OPTIMIZATION: Fetch all existing players once at the start
    console.log('\ud83d\udcca Pre-loading existing players...');
    const allPlayersSnapshot = await adminDb.collection('realplayers').get();
    const playersByName = new Map<string, { playerId: string; data: any }>();
    const existingPlayerIds = new Set<string>();
    let maxPlayerNumber = 0;
    
    allPlayersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.name) {
        playersByName.set(data.name.toLowerCase(), { playerId: data.player_id, data });
      }
      if (data.player_id) {
        existingPlayerIds.add(data.player_id);
        // Track max number for generating new IDs
        if (data.player_id.startsWith('sspslpsl')) {
          const num = parseInt(data.player_id.substring(8));
          if (!isNaN(num) && num > maxPlayerNumber) {
            maxPlayerNumber = num;
          }
        }
      }
    });
    
    console.log(`  Found ${playersByName.size} existing players`);
    console.log(`  Max player number: ${maxPlayerNumber}`);

    // OPTIMIZATION: Pre-load teams if needed
    const teamsCache = new Map<string, any>();
    if (teamsToImport.length > 0) {
      console.log('📊 Pre-loading teams...');
      const teamIds = teamsToImport.map(t => t.id).filter(Boolean);
      
      if (teamIds.length > 0) {
        // Batch read teams (Firestore allows up to 10 per batch, but we'll read individually in batch)
        const teamPromises = teamIds.map(id => adminDb.collection('teams').doc(id).get());
        const teamDocs = await Promise.all(teamPromises);
        
        teamDocs.forEach(doc => {
          if (doc.exists) {
            teamsCache.set(doc.id, doc.data());
          }
        });
        console.log(`  Loaded ${teamsCache.size} teams`);
      }
    }

    // Process Teams data
    if (teamsToImport.length > 0) {
      console.log(`📊 Processing ${teamsToImport.length} teams...`);

      for (const row of teamsToImport) {
        try {
          if (!row.id) continue;

          // OPTIMIZED: Use cached team data
          const currentData = teamsCache.get(row.id);
          if (!currentData) {
            stats.teams.errors.push(`Team with ID ${row.id} not found`);
            continue;
          }

          const updatedData: any = {
            team_name: row.team_name || currentData?.team_name || '',
            team_code: row.team_code || currentData?.team_code || '',
            owner_name: row.owner_name || currentData?.owner_name || '',
            owner_email: row.owner_email || currentData?.owner_email || '',
            updated_at: FieldValue.serverTimestamp()
          };

          // Check if data has changed
          const hasChanged = Object.keys(updatedData).some(key => {
            if (key === 'updated_at') return false;
            return updatedData[key] !== currentData?.[key];
          });

          if (hasChanged) {
            await adminDb.collection('teams').doc(row.id).update(updatedData);
            stats.teams.updated++;
            console.log(`  ✅ Updated team: ${updatedData.team_name}`);
          } else {
            stats.teams.unchanged++;
          }
        } catch (error: any) {
          stats.teams.errors.push(`Error updating team ${row.id}: ${error.message}`);
        }
      }
    }

    // Process Players data
    if (playersToImport.length > 0) {
      console.log(`📊 Processing ${playersToImport.length} players...`);

      for (const row of playersToImport) {
        try {
          if (!row.name) {
            stats.players.errors.push('Player name is required');
            continue;
          }

          // OPTIMIZED: Use cached player data instead of querying
          const playerNameLower = row.name.toLowerCase();
          let playerId: string;
          let isNewPlayer: boolean;
          let currentPlayerData: any = {};
          
          const existingPlayer = playersByName.get(playerNameLower);
          if (existingPlayer) {
            playerId = existingPlayer.playerId;
            currentPlayerData = existingPlayer.data;
            isNewPlayer = false;
            console.log(`  ✅ Found existing player: ${row.name} with ID: ${playerId}`);
          } else {
            // Generate new player ID
            maxPlayerNumber++;
            playerId = `sspslpsl${maxPlayerNumber.toString().padStart(4, '0')}`;
            isNewPlayer = true;
            // Add to cache for potential duplicate names in same import
            playersByName.set(playerNameLower, { playerId, data: {} });
            console.log(`  🆕 Will create new player: ${row.name} with ID: ${playerId}`);
          }

          // Map preview data format to import format
          // Preview format: win, draw, loss, total_matches, cleansheets, goals_scored, goals_per_game, etc.
          // Import format: matches_won, matches_drawn, matches_lost, matches_played, clean_sheets, etc.
          const matchesPlayed = parseInt(row.total_matches || row.matches_played) || 0;
          const matchesWon = parseInt(row.win || row.matches_won) || 0;
          const matchesDrawn = parseInt(row.draw || row.matches_drawn) || 0;
          const matchesLost = parseInt(row.loss || row.matches_lost) || 0;
          const goalsScored = parseInt(row.goals_scored) || 0;
          const goalsConceded = parseInt(row.goals_conceded) || 0;
          const cleanSheets = parseInt(row.cleansheets || row.clean_sheets) || 0;
          const totalPoints = parseInt(row.total_points || row.points) || 0;

          // Calculate derived statistics
          const goalsPerGame = matchesPlayed > 0 ? parseFloat((goalsScored / matchesPlayed).toFixed(2)) : 0;
          const concededPerGame = matchesPlayed > 0 ? parseFloat((goalsConceded / matchesPlayed).toFixed(2)) : 0;
          const netGoals = goalsScored - goalsConceded;

          // Prepare updated stats with ALL fields
          const updatedStats = {
            // Match statistics
            matches_played: matchesPlayed,
            matches_won: matchesWon,
            matches_lost: matchesLost,
            matches_drawn: matchesDrawn,
            
            // Goal statistics
            goals_scored: goalsScored,
            goals_per_game: goalsPerGame,
            goals_conceded: goalsConceded,
            conceded_per_game: concededPerGame,
            net_goals: netGoals,
            
            // Other statistics
            assists: parseInt(row.assists) || 0,
            clean_sheets: cleanSheets,
            
            // Points and ratings
            points: totalPoints,
            total_points: totalPoints,
            win_rate: matchesPlayed > 0 ? parseFloat(((matchesWon / matchesPlayed) * 100).toFixed(2)) : 0,
            average_rating: parseFloat(row.average_rating) || 0,
            
            // Current season tracking
            current_season_matches: matchesPlayed,
            current_season_wins: matchesWon
          };

          // 1. Update/Create permanent player document in realplayers collection
          const permanentPlayerData: any = {
            player_id: playerId,
            name: row.name || currentPlayerData?.name || '',
            display_name: row.display_name || currentPlayerData?.display_name || '',
            email: row.email || currentPlayerData?.email || '',
            phone: row.phone || currentPlayerData?.phone || '',
            role: row.role || currentPlayerData?.role || 'player',
            psn_id: row.psn_id || currentPlayerData?.psn_id || '',
            xbox_id: row.xbox_id || currentPlayerData?.xbox_id || '',
            steam_id: row.steam_id || currentPlayerData?.steam_id || '',
            is_registered: row.is_registered === true || currentPlayerData?.is_registered || false,
            is_active: row.is_active !== false,
            is_available: row.is_available !== false,
            notes: row.notes || currentPlayerData?.notes || '',
            updated_at: FieldValue.serverTimestamp()
          };

          if (isNewPlayer) {
            permanentPlayerData.created_at = FieldValue.serverTimestamp();
            permanentPlayerData.joined_date = FieldValue.serverTimestamp();
          }
          
          // Save to realplayers
          await adminDb.collection('realplayers').doc(playerId).set(permanentPlayerData, { merge: true });

          // 2. Create season-specific stats document in realplayerstats collection
          // OPTIMIZED: No need to query - we already deleted all stats in cleanup phase
          const statsDocId = adminDb.collection('realplayerstats').doc().id;
          console.log(`  🆕 Creating stats for ${row.name} in season ${seasonId}`);
          
          const statsData: any = {
            player_id: playerId,
            player_name: row.name || currentPlayerData?.name || '',
            season_id: seasonId,
            season_name: seasonName, // OPTIMIZED: Denormalized for faster reads
            category: row.category || '', // Season-specific
            team: row.team || row.team_name || '', // Season-specific
            team_id: row.team_id || null,
            is_active: row.is_active !== false,
            is_available: row.is_available !== false,
            // Flatten stats at document level for easier querying
            ...updatedStats,
            // Also keep nested for backward compatibility
            stats: updatedStats,
            created_at: FieldValue.serverTimestamp(),
            updated_at: FieldValue.serverTimestamp()
          };
          
          await adminDb.collection('realplayerstats').doc(statsDocId).set(statsData);
          stats.players.updated++;
          console.log(`  ✅ Created player stats: ${statsData.player_name}`);
        } catch (error: any) {
          stats.players.errors.push(`Error processing player ${row.name || row.player_id}: ${error.message}`);
        }
      }
    }

    // Update season's updated_at timestamp
    await adminDb.collection('seasons').doc(seasonId).update({
      updated_at: FieldValue.serverTimestamp()
    });

    console.log('✅ Import completed successfully');
    console.log(`  - Teams: ${stats.teams.updated} updated, ${stats.teams.unchanged} unchanged`);
    console.log(`  - Players: ${stats.players.updated} updated, ${stats.players.unchanged} unchanged`);

    return NextResponse.json({
      success: true,
      message: 'Import completed successfully',
      stats: {
        teams: {
          updated: stats.teams.updated,
          unchanged: stats.teams.unchanged,
          total: stats.teams.updated + stats.teams.unchanged,
          errors: stats.teams.errors
        },
        players: {
          updated: stats.players.updated,
          unchanged: stats.players.unchanged,
          total: stats.players.updated + stats.players.unchanged,
          errors: stats.players.errors
        },
        awards: {
          updated: 0,
          unchanged: 0,
          total: 0,
          errors: []
        },
        matches: {
          updated: 0,
          unchanged: 0,
          total: 0,
          errors: []
        }
      }
    });

  } catch (error: any) {
    console.error('❌ Error importing Excel data:', error);
    return NextResponse.json({
      error: 'Failed to import Excel data',
      details: error.message
    }, { status: 500 });
  }
}