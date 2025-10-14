import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { FieldValue } from 'firebase-admin/firestore';

// Types for the import data
interface ImportTeamData {
  team_name: string;
  owner_name: string;
}

interface ImportPlayerData {
  name: string;
  team: string;
  category: string;
  goals_scored: number;
  goals_per_game: number;
  goals_conceded: number;
  conceded_per_game: number;
  net_goals: number;
  cleansheets: number;
  points: number;
  win: number;
  draw: number;
  loss: number;
  total_matches: number;
  total_points: number;
}

interface ImportSeasonData {
  seasonInfo: {
    name: string;
    shortName: string;
    fileName: string;
    fileSize: number;
    fileType: string;
  };
  teams: ImportTeamData[];
  players: ImportPlayerData[];
}

interface ImportProgress {
  importId: string;
  status: 'initializing' | 'importing_season' | 'importing_teams' | 'importing_players' | 'completed' | 'failed';
  progress: number;
  currentTask: string;
  totalItems: number;
  processedItems: number;
  startTime: Date;
  endTime?: Date;
  error?: string;
  seasonId?: string;
}

// Store import progress in memory (in production, use Redis or database)
const importProgressStore = new Map<string, ImportProgress>();

// Helper function to update import progress
async function updateProgress(importId: string, updates: Partial<ImportProgress>) {
  const current = importProgressStore.get(importId);
  if (current) {
    const updated = { ...current, ...updates };
    importProgressStore.set(importId, updated);
    
    // In production, you'd also update this in a database/Redis
    // await updateProgressInDB(importId, updated);
    
    return updated;
  }
  return null;
}

// Helper function to create season document
async function createSeason(seasonData: ImportSeasonData['seasonInfo']): Promise<string> {
  const seasonDoc = {
    name: seasonData.name,
    short_name: seasonData.shortName,
    status: 'completed',
    is_historical: true,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
    import_metadata: {
      source_file: seasonData.fileName,
      file_size: seasonData.fileSize,
      file_type: seasonData.fileType,
      import_date: FieldValue.serverTimestamp()
    }
  };

  const docRef = await adminDb.collection('seasons').add(seasonDoc);
  return docRef.id;
}

// Helper function to import teams and create them as database entities with login credentials
async function importTeams(seasonId: string, teams: ImportTeamData[], importId: string): Promise<Map<string, string>> {
  let batch = adminDb.batch();
  const teamMap = new Map<string, string>(); // team_name -> teamId mapping
  
  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    
    // First, check if a team with this name already exists
    const existingTeamQuery = await adminDb.collection('teams')
      .where('team_name', '==', team.team_name)
      .limit(1)
      .get();
    
    let teamId: string;
    let isExistingTeam = false;
    
    if (!existingTeamQuery.empty) {
      // Team exists, use existing team ID and update it
      const existingTeamDoc = existingTeamQuery.docs[0];
      teamId = existingTeamDoc.id;
      isExistingTeam = true;
      teamMap.set(team.team_name, teamId);
      
      console.log(`Found existing team: ${team.team_name} (${teamId})`);
      
      // Update existing team with new season
      const existingData = existingTeamDoc.data();
      const updatedSeasons = existingData.seasons ? [...existingData.seasons, seasonId] : [seasonId];
      
      const teamRef = adminDb.collection('teams').doc(teamId);
      batch.update(teamRef, {
        seasons: updatedSeasons,
        current_season_id: seasonId,
        total_seasons_participated: updatedSeasons.length,
        [`performance_history.${seasonId}`]: {
          season_name: '', // Will be filled later
          players_count: 0, // Will be updated when players are imported
          season_stats: {
            total_goals: 0,
            total_points: 0,
            matches_played: 0
          }
        },
        updated_at: FieldValue.serverTimestamp()
      });
      
    } else {
      // Team doesn't exist, create new team
      teamId = uuidv4();
      teamMap.set(team.team_name, teamId);
      
      console.log(`Creating new team: ${team.team_name} (${teamId})`);
      
      // Create Firebase Auth user and Firestore user document for the team
      try {
        const username = team.owner_name || team.team_name;
        const email = `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@historical.team`;
        const password = team.team_name.length >= 6 ? team.team_name : `${team.team_name}123`; // Ensure password is at least 6 characters
        
        // Create Firebase Auth user
        const userRecord = await admin.auth().createUser({
          email: email,
          password: password,
          displayName: username
        });
        
        console.log(`✅ Created Firebase Auth user for ${team.team_name}: ${userRecord.uid}`);
        
        // Create user document in Firestore
        const userDoc = {
          uid: userRecord.uid,
          email: email,
          username: username,
          role: 'team',
          isActive: true,
          isApproved: true, // Auto-approve historical teams
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          
          // Team-specific data
          teamName: team.team_name,
          teamId: teamId,
          teamLogo: '',
          players: [],
          
          // Mark as historical
          isHistorical: true,
          source: 'historical_import'
        };
        
        const userRef = adminDb.collection('users').doc(userRecord.uid);
        batch.set(userRef, userDoc);
        
        console.log(`✅ Created user document for ${team.team_name}`);
        
        // Create team document with reference to user
        const teamDoc = {
          id: teamId,
          team_name: team.team_name,
          owner_name: team.owner_name,
          
          // Link to Firebase Auth user
          userId: userRecord.uid,
          userEmail: email,
          hasUserAccount: true,
          
          // Season relationship
          seasons: [seasonId],       // Array to track which seasons this team participated in
          current_season_id: seasonId,
          
          // Team metadata
          is_active: true,
          is_historical: true,
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
          
          // Performance tracking (will be updated as more seasons are added)
          total_seasons_participated: 1,
          performance_history: {
            [seasonId]: {
              season_name: '', // Will be filled later
              players_count: 0, // Will be updated when players are imported
              season_stats: {
                total_goals: 0,
                total_points: 0,
                matches_played: 0
              }
            }
          }
        };
        
        const teamRef = adminDb.collection('teams').doc(teamId);
        batch.set(teamRef, teamDoc);
        
      } catch (userError: any) {
        console.error(`❌ Error creating user for team ${team.team_name}:`, userError);
        
        // If user creation fails, still create the team document without user reference
        const teamDoc = {
          id: teamId,
          team_name: team.team_name,
          owner_name: team.owner_name,
          
          // Mark as missing user account
          hasUserAccount: false,
          userCreationError: userError.message,
          
          // Season relationship
          seasons: [seasonId],
          current_season_id: seasonId,
          
          // Team metadata
          is_active: true,
          is_historical: true,
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
          
          // Performance tracking
          total_seasons_participated: 1,
          performance_history: {
            [seasonId]: {
              season_name: '',
              players_count: 0,
              season_stats: {
                total_goals: 0,
                total_points: 0,
                matches_played: 0
              }
            }
          }
        };
        
        const teamRef = adminDb.collection('teams').doc(teamId);
        batch.set(teamRef, teamDoc);
      }
    }
    
    // Update progress
    await updateProgress(importId, {
      processedItems: i + 1,
      progress: ((i + 1) / teams.length) * 100,
      currentTask: `Creating team entity: ${team.team_name}`
    });
    
    // Commit batch every 200 documents to avoid Firestore limits
    if ((i + 1) % 200 === 0) {
      await batch.commit();
      // Start new batch for remaining items
      batch = adminDb.batch();
    }
  }
  
  await batch.commit();
  return teamMap;
}

// Generate custom player ID (sspslpsl0001, sspslpsl0002, etc.)
async function generateNewPlayerId(): Promise<string> {
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
}

// Helper function to get existing player by name or create new ID
async function getOrCreatePlayerByName(name: string): Promise<{ playerId: string; isNew: boolean }> {
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
}

// Helper function to import players and link them to teams and seasons
async function importPlayers(seasonId: string, players: ImportPlayerData[], teams: ImportTeamData[], teamMap: Map<string, string>, importId: string): Promise<string[]> {
  let batch = adminDb.batch();
  const playerIds: string[] = [];
  
  // Create a map of team names to calculate team statistics
  const teamStatsMap = new Map<string, {
    playerCount: number;
    totalGoals: number;
    totalPoints: number;
    totalMatches: number;
  }>();
  
  // Initialize team stats map
  teams.forEach(team => {
    teamStatsMap.set(team.team_name.toLowerCase(), {
      playerCount: 0,
      totalGoals: 0,
      totalPoints: 0,
      totalMatches: 0
    });
  });
  
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    
    // Get existing player by name or create new one
    const { playerId, isNew: isNewPlayer } = await getOrCreatePlayerByName(player.name);
    playerIds.push(playerId);
    
    // Get current player permanent data if exists
    let currentPlayerData: any = {};
    
    if (!isNewPlayer) {
      const playerDoc = await adminDb.collection('realplayers').doc(playerId).get();
      if (playerDoc.exists) {
        currentPlayerData = playerDoc.data() || {};
      }
    }
    
    // Create new stats object in the realplayers format with ALL statistics fields
    const matchesPlayed = player.total_matches || 0;
    const goalsScored = player.goals_scored || 0;
    const goalsConceded = player.goals_conceded || 0;
    const matchesWon = player.win || 0;
    const matchesDrawn = player.draw || 0;
    const matchesLost = player.loss || 0;
    const cleanSheets = player.cleansheets || 0;
    const totalPoints = player.total_points || player.points || 0;
    
    const newStats = {
      // Match statistics
      matches_played: matchesPlayed,
      matches_won: matchesWon,
      matches_lost: matchesLost,
      matches_drawn: matchesDrawn,
      
      // Goal statistics
      goals_scored: goalsScored,
      goals_per_game: matchesPlayed > 0 ? parseFloat((goalsScored / matchesPlayed).toFixed(2)) : 0,
      goals_conceded: goalsConceded,
      conceded_per_game: matchesPlayed > 0 ? parseFloat((goalsConceded / matchesPlayed).toFixed(2)) : 0,
      net_goals: goalsScored - goalsConceded,
      
      // Other statistics
      assists: 0, // Default to 0 for new season
      clean_sheets: cleanSheets,
      
      // Points and ratings
      points: totalPoints,
      total_points: totalPoints,
      win_rate: matchesPlayed > 0 ? parseFloat(((matchesWon / matchesPlayed) * 100).toFixed(2)) : 0,
      average_rating: 0, // Default to 0 for new season
      
      // Current season tracking
      current_season_matches: matchesPlayed,
      current_season_wins: matchesWon
    };
    
    // 1. Create/Update permanent player document in realplayers collection
    const permanentPlayerDoc: any = {
      player_id: playerId,
      name: player.name,
      
      // Basic permanent info (keep existing or set defaults)
      display_name: currentPlayerData?.display_name || player.name,
      email: currentPlayerData?.email || '',
      phone: currentPlayerData?.phone || '',
      role: currentPlayerData?.role || 'player',
      psn_id: currentPlayerData?.psn_id || '',
      xbox_id: currentPlayerData?.xbox_id || '',
      steam_id: currentPlayerData?.steam_id || '',
      is_registered: currentPlayerData?.is_registered || false,
      is_active: true,
      is_available: currentPlayerData?.is_available !== false,
      notes: currentPlayerData?.notes || '',
      
      // Metadata
      updated_at: FieldValue.serverTimestamp()
    };
    
    if (isNewPlayer) {
      permanentPlayerDoc.created_at = FieldValue.serverTimestamp();
      permanentPlayerDoc.joined_date = FieldValue.serverTimestamp();
    }
    
    // Save to realplayers collection
    const playerRef = adminDb.collection('realplayers').doc(playerId);
    batch.set(playerRef, permanentPlayerDoc, { merge: true });
    
    // 2. Create/Update season-specific stats document in realplayerstats collection
    // Check if stats document exists for this player-season combination
    const existingStatsQuery = await adminDb.collection('realplayerstats')
      .where('player_id', '==', playerId)
      .where('season_id', '==', seasonId)
      .limit(1)
      .get();
    
    let statsDocId: string;
    if (!existingStatsQuery.empty) {
      statsDocId = existingStatsQuery.docs[0].id;
      console.log(`  📝 Updating stats for ${player.name} in season ${seasonId}`);
    } else {
      statsDocId = adminDb.collection('realplayerstats').doc().id;
      console.log(`  🆕 Creating stats for ${player.name} in season ${seasonId}`);
    }
    
    const statsDoc = {
      player_id: playerId,
      player_name: player.name,
      season_id: seasonId,
      team: player.team,
      team_id: teamMap.get(player.team) || null,
      category: player.category, // Season-specific
      stats: newStats,
      created_at: existingStatsQuery.empty ? FieldValue.serverTimestamp() : existingStatsQuery.docs[0].data().created_at,
      updated_at: FieldValue.serverTimestamp()
    };
    
    const statsRef = adminDb.collection('realplayerstats').doc(statsDocId);
    batch.set(statsRef, statsDoc, { merge: true });
    
    // Update team statistics
    const teamStats = teamStatsMap.get(player.team.toLowerCase());
    if (teamStats) {
      teamStats.playerCount++;
      teamStats.totalGoals += player.goals_scored;
      teamStats.totalPoints += player.total_points;
      teamStats.totalMatches = Math.max(teamStats.totalMatches, player.total_matches);
    }
    
    // Update progress
    await updateProgress(importId, {
      processedItems: i + 1,
      progress: ((i + 1) / players.length) * 100,
      currentTask: `Creating player: ${player.name} (${player.team})`
    });
    
    // Commit batch every 400 documents to avoid Firestore limits
    if ((i + 1) % 400 === 0) {
      await batch.commit();
      // Start new batch for remaining items
      batch = adminDb.batch();
    }
  }
  
  await batch.commit();
  
  // Now update team performance statistics
  await updateTeamPerformanceStats(seasonId, teamStatsMap, teams, teamMap);
  
  return playerIds;
}

// Helper function to update team performance statistics
async function updateTeamPerformanceStats(
  seasonId: string, 
  teamStatsMap: Map<string, { playerCount: number; totalGoals: number; totalPoints: number; totalMatches: number }>,
  teams: ImportTeamData[],
  teamMap: Map<string, string>
) {
  const batch = adminDb.batch();
  
  // Get season document to get season name
  const seasonDoc = await adminDb.collection('seasons').doc(seasonId).get();
  const seasonName = seasonDoc.exists ? seasonDoc.data()?.name : 'Unknown Season';
  
  for (const team of teams) {
    const teamStats = teamStatsMap.get(team.team_name.toLowerCase());
    const teamId = teamMap.get(team.team_name);
    
    if (!teamStats || !teamId) continue;
    
    // Update the specific team document using the team ID
    const teamRef = adminDb.collection('teams').doc(teamId);
    
    const teamUpdateData = {
      [`performance_history.${seasonId}.season_name`]: seasonName,
      [`performance_history.${seasonId}.players_count`]: teamStats.playerCount,
      [`performance_history.${seasonId}.season_stats.total_goals`]: teamStats.totalGoals,
      [`performance_history.${seasonId}.season_stats.total_points`]: teamStats.totalPoints,
      [`performance_history.${seasonId}.season_stats.matches_played`]: teamStats.totalMatches,
      updated_at: FieldValue.serverTimestamp()
    };
    
    batch.update(teamRef, teamUpdateData);
  }
  
  // Commit the batch updates
  if (teams.length > 0) {
    try {
      await batch.commit();
    } catch (error) {
      console.warn('Team stats update completed with some issues:', error);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const importData: ImportSeasonData = await request.json();
    const importId = uuidv4();
    
    // Calculate total items to process
    const totalItems = importData.teams.length + importData.players.length;
    
    // Initialize progress tracking
    const initialProgress: ImportProgress = {
      importId,
      status: 'initializing',
      progress: 0,
      currentTask: 'Initializing import process...',
      totalItems,
      processedItems: 0,
      startTime: new Date()
    };
    
    importProgressStore.set(importId, initialProgress);
    
    // Start the import process asynchronously
    processImport(importId, importData).catch(error => {
      console.error('Import failed:', error);
      updateProgress(importId, {
        status: 'failed',
        error: error.message,
        endTime: new Date()
      });
    });
    
    return NextResponse.json({
      success: true,
      importId,
      message: 'Import started successfully'
    });
    
  } catch (error: any) {
    console.error('Error starting import:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

async function processImport(importId: string, importData: ImportSeasonData) {
  try {
    // Step 1: Create season
    await updateProgress(importId, {
      status: 'importing_season',
      currentTask: 'Creating season record...',
      progress: 5
    });
    
    const seasonId = await createSeason(importData.seasonInfo);
    
    await updateProgress(importId, {
      seasonId,
      progress: 10
    });
    
    // Step 2: Import teams and get team mapping
    let teamMap = new Map<string, string>();
    if (importData.teams.length > 0) {
      await updateProgress(importId, {
        status: 'importing_teams',
        currentTask: 'Creating team entities with login credentials...',
        processedItems: 0
      });
      
      teamMap = await importTeams(seasonId, importData.teams, importId);
    }
    
    // Step 3: Import players and link them to teams
    if (importData.players.length > 0) {
      await updateProgress(importId, {
        status: 'importing_players',
        currentTask: 'Creating players and linking to teams...',
        processedItems: 0
      });
      
      await importPlayers(seasonId, importData.players, importData.teams, teamMap, importId);
    }
    
    // Step 4: Complete
    await updateProgress(importId, {
      status: 'completed',
      progress: 100,
      currentTask: `Import completed! Created ${importData.teams.length} team entities with login credentials and ${importData.players.length} players with comprehensive stats.`,
      processedItems: importData.teams.length + importData.players.length,
      endTime: new Date()
    });
    
  } catch (error: any) {
    await updateProgress(importId, {
      status: 'failed',
      error: error.message,
      endTime: new Date()
    });
    throw error;
  }
}

// GET endpoint to check import progress
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const importId = searchParams.get('importId');
    
    if (!importId) {
      return NextResponse.json(
        { success: false, error: 'Import ID is required' },
        { status: 400 }
      );
    }
    
    const progress = importProgressStore.get(importId);
    
    if (!progress) {
      return NextResponse.json(
        { success: false, error: 'Import not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      progress
    });
    
  } catch (error: any) {
    console.error('Error fetching import progress:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}