import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { FieldValue } from 'firebase-admin/firestore';
import { getTournamentDb } from '@/lib/neon/tournament-config';

// Types for the import data
interface ImportTeamData {
  team_name: string;
  owner_name: string;
  linked_team_id?: string;
  // Team standings data from Excel
  rank?: number;
  p?: number; // Points
  mp?: number; // Matches Played
  w?: number; // Wins
  d?: number; // Draws
  l?: number; // Losses
  f?: number; // Goals For
  a?: number; // Goals Against
  gd?: number; // Goal Difference
  percentage?: number; // Win percentage
  cups?: string[]; // Multiple cup achievements
}

interface ImportPlayerData {
  name: string;
  team: string;
  category: string;
  goals_scored: number | null;
  goals_per_game: number | null;
  goals_conceded: number | null;
  conceded_per_game: number | null;
  net_goals: number | null;
  cleansheets: number | null;
  points: number | null;
  win: number;
  draw: number;
  loss: number;
  total_matches: number;
  total_points: number | null;
  // Optional fields
  average_rating?: number;
  potm?: number | null; // Player of the Match (nullable)
  category_trophies?: string[];  // Changed to array for unlimited trophies
  individual_trophies?: string[]; // Changed to array for unlimited trophies
}

interface ImportSeasonData {
  seasonInfo: {
    name?: string; // Optional, will be auto-generated from seasonNumber if not provided
    shortName?: string; // Optional, will be auto-generated from seasonNumber if not provided
    seasonNumber: number; // Season number for ID generation (e.g., 12 for SSPSLS12)
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

// Helper function to update import progress (now using Firestore)
async function updateProgress(importId: string, updates: Partial<ImportProgress>) {
  try {
    const progressRef = adminDb.collection('import_progress').doc(importId);
    const progressDoc = await progressRef.get();
    
    if (progressDoc.exists) {
      const current = progressDoc.data() as ImportProgress;
      const updated = { ...current, ...updates };
      await progressRef.set(updated, { merge: true });
      return updated;
    } else if (Object.keys(updates).length > 0) {
      // If document doesn't exist but we have updates, create it
      await progressRef.set(updates as ImportProgress);
      return updates as ImportProgress;
    }
    return null;
  } catch (error) {
    console.error('❌ Error updating progress:', error);
    return null;
  }
}

// Generate season ID (SSPSLS12 for season 12, etc.)
async function generateSeasonId(seasonData: ImportSeasonData['seasonInfo'], existingSeasonIds?: string[]): Promise<string> {
  const prefix = 'SSPSLS';
  
  // If season number is provided, use it
  if (seasonData.seasonNumber) {
    return `${prefix}${seasonData.seasonNumber}`;
  }
  
  // Otherwise, try to extract from season name
  const match = seasonData.name?.match(/\d+/);
  if (match) {
    return `${prefix}${match[0]}`;
  }
  
  // Fallback: find highest season number and increment
  // If existing IDs provided (optimization), use them
  if (existingSeasonIds) {
    let maxNumber = 0;
    existingSeasonIds.forEach((id) => {
      if (id.startsWith(prefix)) {
        const numberPart = parseInt(id.substring(prefix.length));
        if (!isNaN(numberPart) && numberPart > maxNumber) {
          maxNumber = numberPart;
        }
      }
    });
    return `${prefix}${maxNumber + 1}`;
  }
  
  // Fallback to querying (shouldn't happen with proper seasonNumber)
  const seasonsQuery = await adminDb.collection('seasons').get();
  let maxNumber = 0;
  
  seasonsQuery.forEach((doc) => {
    const id = doc.id;
    if (id.startsWith(prefix)) {
      const numberPart = parseInt(id.substring(prefix.length));
      if (!isNaN(numberPart) && numberPart > maxNumber) {
        maxNumber = numberPart;
      }
    }
  });
  
  return `${prefix}${maxNumber + 1}`;
}

// Helper function to create season document
async function createSeason(seasonData: ImportSeasonData['seasonInfo']): Promise<string> {
  console.log('🆔 Generating season ID...');
  const seasonId = await generateSeasonId(seasonData);
  console.log('✅ Generated season ID:', seasonId);
  
  console.log('📝 Preparing season document...');
  const seasonDoc = {
    season_number: seasonData.seasonNumber,
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
  console.log('Season document:', JSON.stringify(seasonDoc, null, 2));

  console.log('💾 Writing season to Firestore...');
  try {
    await adminDb.collection('seasons').doc(seasonId).set(seasonDoc);
    console.log(`✅ Created season with ID: ${seasonId} (Season ${seasonData.seasonNumber})`);
  } catch (error: any) {
    console.error('❌ Failed to write season to Firestore:', error);
    console.error('Error details:', error.message, error.stack);
    throw error;
  }
  
  return seasonId;
}

// Batch lookup structure to store existing entities
interface BatchLookupData {
  existingTeams: Map<string, { teamId: string; doc: any }>; // team_name -> team data
  existingPlayers: Map<string, { playerId: string; doc: any }>; // player name -> player data
  existingStats: Map<string, string>; // "playerId_seasonId" -> statsDocId
  allTeamIds: string[];
  allPlayerIds: string[];
  allSeasonIds: string[];
}

// Helper function to chunk array for Firestore 'in' queries (max 30 items)
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

// Smart detection: Check if this is a re-import by sampling first 10 players
async function detectReimport(
  playerNames: string[], 
  teamNames: string[]
): Promise<{ isReimport: boolean; matchRate: number; sampleSize: number }> {
  if (playerNames.length === 0 && teamNames.length === 0) {
    return { isReimport: false, matchRate: 0, sampleSize: 0 };
  }
  
  console.log('🔍 Smart detection: Checking if this is a re-import...');
  const startTime = Date.now();
  
  // Sample first 10 players (or fewer if less available)
  const sampleSize = Math.min(10, playerNames.length);
  const sampleNames = playerNames.slice(0, sampleSize);
  
  try {
    // Quick query to check how many of the sample exist
    const sampleQuery = await adminDb.collection('realplayers')
      .where('name', 'in', sampleNames)
      .get();
    
    const matchCount = sampleQuery.size;
    const matchRate = matchCount / sampleSize;
    const isReimport = matchRate >= 0.8; // 80% threshold
    
    const duration = Date.now() - startTime;
    console.log(`✅ Detection complete in ${duration}ms:`);
    console.log(`   - Sample size: ${sampleSize}`);
    console.log(`   - Matches found: ${matchCount}`);
    console.log(`   - Match rate: ${(matchRate * 100).toFixed(1)}%`);
    console.log(`   - Classification: ${isReimport ? 'RE-IMPORT' : 'NEW IMPORT'}`);
    
    return { isReimport, matchRate, sampleSize };
  } catch (error) {
    console.error('❌ Error in smart detection:', error);
    // On error, assume new import (safer default)
    return { isReimport: false, matchRate: 0, sampleSize };
  }
}

// Optimized loading for RE-IMPORTS (when most entities already exist)
async function batchLoadForReimport(
  seasonId: string,
  isNewSeason: boolean
): Promise<BatchLookupData> {
  console.log('📦 Batch loading for RE-IMPORT (optimized path)...');
  const startTime = Date.now();
  
  const result: BatchLookupData = {
    existingTeams: new Map(),
    existingPlayers: new Map(),
    existingStats: new Map(),
    allTeamIds: [],
    allPlayerIds: [],
    allSeasonIds: []
  };
  
  try {
    // For re-imports, we skip selective queries and just load IDs + stats
    // This assumes entities already exist (which detection confirmed)
    
    const queries: Promise<any>[] = [];
    
    // 1. Get player IDs only (for counter) - using select() for minimal data
    console.log('   Loading player IDs (select only)...');
    queries.push(
      adminDb.collection('realplayers')
        .select('player_id')
        .get()
    );
    
    // 2. Get ALL teams with full data (needed for linking)
    console.log('   Loading all teams (full data for linking)...');
    queries.push(
      adminDb.collection('teams')
        .get()
    );
    
    // 3. Get season IDs only
    console.log('   Loading season IDs...');
    queries.push(
      adminDb.collection('seasons')
        .select()
        .get()
    );
    
    // 4. Load stats if season exists
    if (!isNewSeason) {
      console.log(`   Loading stats for existing season ${seasonId}...`);
      queries.push(
        adminDb.collection('realplayerstats')
          .where('season_id', '==', seasonId)
          .get()
      );
    }
    
    // Execute all queries in parallel
    const results = await Promise.all(queries);
    
    let resultIndex = 0;
    
    // Process player IDs
    const playerIdsSnapshot = results[resultIndex++];
    playerIdsSnapshot.forEach((doc: any) => {
      const data = doc.data();
      if (data.player_id) {
        result.allPlayerIds.push(data.player_id);
      }
    });
    
    // Process teams - store full data for linking
    const teamsSnapshot = results[resultIndex++];
    teamsSnapshot.forEach((doc: any) => {
      result.allTeamIds.push(doc.id);
      const data = doc.data();
      // Store by team_id (doc.id) for lookup
      result.existingTeams.set(data.team_name?.toLowerCase() || '', {
        teamId: doc.id,
        doc: data
      });
    });
    
    // Process season IDs
    const seasonsSnapshot = results[resultIndex++];
    seasonsSnapshot.forEach((doc: any) => {
      result.allSeasonIds.push(doc.id);
    });
    
    // Process stats (if loaded)
    if (!isNewSeason && resultIndex < results.length) {
      const statsSnapshot = results[resultIndex++];
      statsSnapshot.forEach((doc: any) => {
        const data = doc.data();
        if (data.player_id && data.season_id) {
          const key = `${data.player_id}_${data.season_id}`;
          result.existingStats.set(key, doc.id);
        }
      });
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ Re-import batch load complete in ${duration}ms:`);
    console.log(`   - Player IDs: ${result.allPlayerIds.length}`);
    console.log(`   - Team IDs: ${result.allTeamIds.length}`);
    console.log(`   - Season IDs: ${result.allSeasonIds.length}`);
    console.log(`   - Stats: ${result.existingStats.size}`);
    console.log(`   - Note: Skipped selective queries (entities assumed to exist)`);
    
    return result;
  } catch (error) {
    console.error('❌ Error in re-import batch load:', error);
    throw error;
  }
}

// Batch load all existing entities to minimize Firebase reads
// Uses SELECTIVE LOADING - only queries entities that might match import data
async function batchLoadExistingEntities(
  teamNames: string[], 
  playerNames: string[], 
  seasonId: string,
  isNewSeason: boolean = false
): Promise<BatchLookupData> {
  console.log('🔍 Batch loading existing entities (SELECTIVE MODE)...');
  const startTime = Date.now();
  
  const result: BatchLookupData = {
    existingTeams: new Map(),
    existingPlayers: new Map(),
    existingStats: new Map(),
    allTeamIds: [],
    allPlayerIds: [],
    allSeasonIds: []
  };
  
  try {
    // Prepare queries
    const queries: Promise<any>[] = [];
    
    // 1. Query for SPECIFIC teams (selective loading)
    // Firestore 'in' operator supports max 30 items, so chunk if needed
    if (teamNames.length > 0) {
      const uniqueTeamNames = [...new Set(teamNames.filter(n => n).map(n => n.toLowerCase()))];
      const teamChunks = chunkArray(uniqueTeamNames, 30); // Max 30 per 'in' query
      
      console.log(`   Querying ${uniqueTeamNames.length} specific teams in ${teamChunks.length} chunk(s)`);
      
      teamChunks.forEach((chunk) => {
        queries.push(
          adminDb.collection('teams')
            .where('team_name', 'in', chunk.map(name => {
              // Try both lowercase and original case
              const originalName = teamNames.find(t => t && t.toLowerCase() === name);
              return originalName || name;
            }))
            .get()
        );
      });
    }
    
    // 2. Query for SPECIFIC players (selective loading)
    if (playerNames.length > 0) {
      const uniquePlayerNames = [...new Set(playerNames)];
      const playerChunks = chunkArray(uniquePlayerNames, 30);
      
      console.log(`   Querying ${uniquePlayerNames.length} specific players in ${playerChunks.length} chunk(s)`);
      
      playerChunks.forEach((chunk) => {
        queries.push(
          adminDb.collection('realplayers')
            .where('name', 'in', chunk)
            .get()
        );
      });
    }
    
    // 3. Get player IDs only (for counter) - using select() for minimal data
    queries.push(
      adminDb.collection('realplayers')
        .select('player_id')
        .get()
    );
    
    // 4. Get ALL teams for linking and counter (need full data for team linking)
    queries.push(
      adminDb.collection('teams')
        .get()
    );
    
    // 5. Get season IDs only
    queries.push(
      adminDb.collection('seasons')
        .select()
        .get()
    );
    
    // 6. Stats query - skip if it's a new season (won't have stats yet)
    if (!isNewSeason) {
      console.log(`   Querying stats for season ${seasonId}`);
      queries.push(
        adminDb.collection('realplayerstats')
          .where('season_id', '==', seasonId)
          .get()
      );
    } else {
      console.log(`   Skipping stats query (new season)`);
    }
    
    // Execute all queries in parallel
    const results = await Promise.all(queries);
    
    // Calculate result indices based on query structure
    const teamChunkCount = teamNames.length > 0 ? Math.ceil([...new Set(teamNames.filter(n => n).map(n => n.toLowerCase()))].length / 30) : 0;
    const playerChunkCount = playerNames.length > 0 ? Math.ceil([...new Set(playerNames.filter(n => n))].length / 30) : 0;
    
    let resultIndex = 0;
    
    // Process team query results (may be multiple chunks)
    for (let i = 0; i < teamChunkCount; i++) {
      const teamsSnapshot = results[resultIndex++];
      teamsSnapshot.forEach((doc: any) => {
        const data = doc.data();
        const teamName = data.team_name?.toLowerCase();
        if (teamName) {
          result.existingTeams.set(teamName, {
            teamId: doc.id,
            doc: data
          });
        }
      });
    }
    
    // Process player query results (may be multiple chunks)
    for (let i = 0; i < playerChunkCount; i++) {
      const playersSnapshot = results[resultIndex++];
      playersSnapshot.forEach((doc: any) => {
        const data = doc.data();
        const playerName = data.name?.toLowerCase();
        if (playerName && data.player_id) {
          result.existingPlayers.set(playerName, {
            playerId: data.player_id,
            doc: data
          });
        }
      });
    }
    
    // Process player IDs (for counter)
    const playerIdsSnapshot = results[resultIndex++];
    playerIdsSnapshot.forEach((doc: any) => {
      const data = doc.data();
      if (data.player_id) {
        result.allPlayerIds.push(data.player_id);
      }
    });
    
    // Process ALL teams (for counter and linking) - merge with existing teams
    const allTeamsSnapshot = results[resultIndex++];
    allTeamsSnapshot.forEach((doc: any) => {
      const data = doc.data();
      result.allTeamIds.push(doc.id);
      
      // Also add to existingTeams map if not already there (for linking by ID)
      const teamName = data.team_name?.toLowerCase();
      if (teamName && !result.existingTeams.has(teamName)) {
        result.existingTeams.set(teamName, {
          teamId: doc.id,
          doc: data
        });
      }
    });
    
    // Process season IDs
    const seasonsSnapshot = results[resultIndex++];
    seasonsSnapshot.forEach((doc: any) => {
      result.allSeasonIds.push(doc.id);
    });
    
    // Process stats (if query was executed)
    if (!isNewSeason && resultIndex < results.length) {
      const statsSnapshot = results[resultIndex++];
      statsSnapshot.forEach((doc: any) => {
        const data = doc.data();
        if (data.player_id && data.season_id) {
          const key = `${data.player_id}_${data.season_id}`;
          result.existingStats.set(key, doc.id);
        }
      });
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ Batch load complete in ${duration}ms:`);
    console.log(`   - Teams: ${result.existingTeams.size} existing, ${result.allTeamIds.length} total IDs`);
    console.log(`   - Players: ${result.existingPlayers.size} existing, ${result.allPlayerIds.length} total IDs`);
    console.log(`   - Stats: ${result.existingStats.size} existing for season`);
    console.log(`   - Seasons: ${result.allSeasonIds.length} total IDs`);
    
    return result;
  } catch (error) {
    console.error('❌ Error in batch load:', error);
    throw error;
  }
}

// Track the next team ID number to avoid race conditions
let nextTeamIdNumber: number | null = null;

// Generate team ID (SSPSLT0001, SSPSLT0002, etc.)
function initializeTeamIdCounter(allTeamIds: string[]): void {
  const prefix = 'SSPSLT';
  let maxNumber = 0;
  
  allTeamIds.forEach((id) => {
    if (id.startsWith(prefix)) {
      const numberPart = parseInt(id.substring(prefix.length));
      if (!isNaN(numberPart) && numberPart > maxNumber) {
        maxNumber = numberPart;
      }
    }
  });
  
  nextTeamIdNumber = maxNumber + 1;
  console.log(`🔢 Initialized team ID counter at: ${nextTeamIdNumber}`);
}

async function generateNewTeamId(): Promise<string> {
  const prefix = 'SSPSLT';
  
  try {
    // Counter should be initialized before calling this
    if (nextTeamIdNumber === null) {
      throw new Error('Team ID counter not initialized. Call initializeTeamIdCounter first.');
    }
    
    // Increment and use the counter
    const currentNumber = nextTeamIdNumber;
    nextTeamIdNumber++;
    
    const paddedNumber = currentNumber.toString().padStart(4, '0');
    const newId = `${prefix}${paddedNumber}`;
    console.log(`🆔 Generated team ID: ${newId}`);
    return newId;
  } catch (error) {
    console.error('Error generating team ID:', error);
    // Fallback to random number if query fails
    const randomNumber = Math.floor(Math.random() * 10000);
    return `${prefix}${randomNumber.toString().padStart(4, '0')}`;
  }
}

// Helper function to convert text to Title Case with special handling for abbreviations
// (e.g., "TEAM fc" -> "Team FC", "st james" -> "St James")
function toTitleCase(text: string): string {
  const abbreviations = ['FC', 'CF', 'ST', 'AC', 'SC', 'AFC', 'RFC', 'DC', 'BC', 'MC', 'EC'];
  
  return text
    .toLowerCase()
    .split(' ')
    .map(word => {
      const upperWord = word.toUpperCase();
      // Check if this word is a known abbreviation
      if (abbreviations.includes(upperWord)) {
        return upperWord;
      }
      // Otherwise, capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

// Helper function to import teams and create them as database entities with login credentials
async function importTeams(
  seasonId: string, 
  teams: ImportTeamData[], 
  importId: string, 
  batchLookup: BatchLookupData
): Promise<Map<string, string>> {
  let batch = adminDb.batch();
  const teamMap = new Map<string, string>(); // team_name -> teamId mapping
  
  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    
    // Normalize team name to Title Case (e.g., "TEAM fc" -> "Team Fc")
    const normalizedTeamName = toTitleCase(team.team_name);
    console.log(`Processing team: "${team.team_name}" → "${normalizedTeamName}"`);
    
    // Check if manually linked to existing team
    let existingTeam = null;
    if (team.linked_team_id) {
      // Use batch lookup instead of reading from Firebase
      // The linked team should already be in the batch lookup if it exists
      const linkedTeam = Array.from(batchLookup.existingTeams.values())
        .find(t => t.teamId === team.linked_team_id);
      
      if (linkedTeam) {
        existingTeam = linkedTeam;
        console.log(`🔗 Manually linked team: "${team.team_name}" → "${existingTeam.doc.team_name}" (${team.linked_team_id})`);
      } else {
        console.log(`⚠️ Warning: Linked team ID ${team.linked_team_id} not found in batch lookup for "${team.team_name}"`);
      }
    }
    
    // If not manually linked, check if team exists by name using batch lookup
    if (!existingTeam && team.team_name) {
      existingTeam = batchLookup.existingTeams.get(team.team_name.toLowerCase());
    }
    
    let teamId: string;
    let isExistingTeam = false;
    
    if (existingTeam) {
      // Team exists, use existing team ID and update it
      teamId = existingTeam.teamId;
      isExistingTeam = true;
      teamMap.set(normalizedTeamName, teamId);
      
      console.log(`Found existing team: ${normalizedTeamName} (${teamId})`);
      
      // Update existing team - only permanent data
      const existingData = existingTeam.doc;
      const updatedSeasons = existingData.seasons ? [...existingData.seasons, seasonId] : [seasonId];
      
      // Check if team name has changed
      const nameChanged = existingData.team_name !== normalizedTeamName;
      const updateData: any = {
        seasons: updatedSeasons,
        current_season_id: seasonId,
        total_seasons_participated: updatedSeasons.length,
        updated_at: FieldValue.serverTimestamp()
      };
      
      // If name changed, track it in name history and update current name
      if (nameChanged) {
        console.log(`   🔄 Team name changed: "${existingData.team_name}" → "${normalizedTeamName}"`);
        const nameHistory = existingData.name_history || [];
        if (!nameHistory.includes(existingData.team_name)) {
          nameHistory.push(existingData.team_name);
        }
        updateData.team_name = normalizedTeamName; // Update to new name
        updateData.name_history = nameHistory;
        updateData.previous_names = nameHistory; // Also store as previous_names for easier querying
      }
      
      const teamRef = adminDb.collection('teams').doc(teamId);
      batch.update(teamRef, updateData);
      
      // Create separate teamstats document for this season
      const teamStatsDocId = `${teamId}_${seasonId}`;
      const sql = getTournamentDb();
      
      // Helper function to parse trophy strings like "UCL CHAMPIONS" or "CUP RUNNERS UP"
      const parseTrophyName = (rawName: string): { name: string; position: string | null } => {
        const normalized = rawName.trim().toUpperCase();
        
        // Check for common position indicators
        if (normalized.endsWith('CHAMPIONS') || normalized.endsWith('CHAMPION')) {
          const trophyName = normalized.replace(/CHAMPIONS?$/, '').trim();
          return { name: trophyName, position: 'Champions' };
        }
        if (normalized.endsWith('RUNNERS UP') || normalized.endsWith('RUNNER UP')) {
          const trophyName = normalized.replace(/RUNNERS? UP$/, '').trim();
          return { name: trophyName, position: 'Runner Up' };
        }
        if (normalized.endsWith('WINNER') || normalized.endsWith('WINNERS')) {
          const trophyName = normalized.replace(/WINNERS?$/, '').trim();
          return { name: trophyName, position: 'Winner' };
        }
        if (normalized.endsWith('THIRD PLACE')) {
          const trophyName = normalized.replace(/THIRD PLACE$/, '').trim();
          return { name: trophyName, position: 'Third Place' };
        }
        
        // If no position indicator found, return name with null position
        return { name: rawName.trim(), position: null };
      };
      
      // Parse team trophies/cups from Excel (cup_1, cup_2, etc.)
      const teamTrophies: Array<{ type: string; name: string; position: string | null }> = [];
      Object.keys(team).forEach((key) => {
        const lowerKey = key.toLowerCase();
        const value = (team as any)[key];
        if (!value || value === '') return;
        if (lowerKey.includes('cup')) {
          // Check if value contains multiple trophies separated by comma
          const valueStr = String(value).trim();
          if (valueStr.includes(',')) {
            // Split by comma and process each trophy separately
            const trophyNames = valueStr.split(',').map(t => t.trim()).filter(t => t);
            trophyNames.forEach(trophyName => {
              const parsed = parseTrophyName(trophyName);
              if (parsed.name) {
                teamTrophies.push({ type: 'cup', name: parsed.name, position: parsed.position });
              }
            });
          } else {
            // Single trophy
            const parsed = parseTrophyName(valueStr);
            if (parsed.name) {
              teamTrophies.push({ type: 'cup', name: parsed.name, position: parsed.position });
            }
          }
        }
      });
      
      await sql`
        INSERT INTO teamstats (
          id, team_id, season_id, team_name, tournament_id,
          points, matches_played, wins, draws, losses,
          goals_for, goals_against, goal_difference, position,
          created_at, updated_at
        )
        VALUES (
          ${teamStatsDocId}, ${teamId}, ${seasonId}, ${normalizedTeamName}, 'historical',
          ${team.p || 0}, ${team.mp || 0}, ${team.w || 0}, 
          ${team.d || 0}, ${team.l || 0},
          ${team.f || 0}, ${team.a || 0}, ${team.gd || 0}, ${team.rank || team.position || null},
          NOW(), NOW()
        )
        ON CONFLICT (team_id, season_id) DO UPDATE
        SET
          team_name = EXCLUDED.team_name,
          points = EXCLUDED.points,
          matches_played = EXCLUDED.matches_played,
          wins = EXCLUDED.wins,
          draws = EXCLUDED.draws,
          losses = EXCLUDED.losses,
          goals_for = EXCLUDED.goals_for,
          goals_against = EXCLUDED.goals_against,
          goal_difference = EXCLUDED.goal_difference,
          position = EXCLUDED.position,
          updated_at = NOW()
      `;
      
      console.log(`✅ Updated teamstats in NEON for: ${normalizedTeamName}`);
      
      // ✅ Insert trophies into team_trophies table with separate name and position
      // 1. Add league position trophies
      const leaguePosition = team.rank || team.position;
      if (leaguePosition === 1) {
        await sql`
          INSERT INTO team_trophies (
            team_id, team_name, season_id, trophy_type, trophy_name, trophy_position, position, awarded_by
          )
          VALUES (
            ${teamId}, ${normalizedTeamName}, ${seasonId}, 'league', 'League', 'Winner', 1, 'system'
          )
          ON CONFLICT (team_id, season_id, trophy_name, trophy_position) DO NOTHING
        `;
      } else if (leaguePosition === 2) {
        await sql`
          INSERT INTO team_trophies (
            team_id, team_name, season_id, trophy_type, trophy_name, trophy_position, position, awarded_by
          )
          VALUES (
            ${teamId}, ${normalizedTeamName}, ${seasonId}, 'runner_up', 'League', 'Runner Up', 2, 'system'
          )
          ON CONFLICT (team_id, season_id, trophy_name, trophy_position) DO NOTHING
        `;
      }
      
      // 2. Add cup trophies from Excel with separate name and position
      for (const trophy of teamTrophies) {
        await sql`
          INSERT INTO team_trophies (
            team_id, team_name, season_id, trophy_type, trophy_name, trophy_position, awarded_by
          )
          VALUES (
            ${teamId}, ${normalizedTeamName}, ${seasonId}, 'cup', ${trophy.name}, ${trophy.position}, 'system'
          )
          ON CONFLICT (team_id, season_id, trophy_name, trophy_position) DO NOTHING
        `;
      }
      
      console.log(`✅ Inserted ${teamTrophies.length + (leaguePosition <= 2 ? 1 : 0)} trophies for ${normalizedTeamName}`);
      
    } else {
      // Team doesn't exist, create new team with custom ID
      teamId = await generateNewTeamId();
      teamMap.set(normalizedTeamName, teamId);
      
      console.log(`Creating new team: ${normalizedTeamName} (${teamId})`);
      
      // Create Firebase Auth user and Firestore user document for the team
      try {
        const username = normalizedTeamName.toLowerCase().replace(/\s+/g, ''); // Use team name as username (lowercase, no spaces)
        const email = `${(username || '').toLowerCase().replace(/[^a-z0-9]/g, '')}@historical.team`;
        const password = (normalizedTeamName.length >= 6 ? normalizedTeamName : `${normalizedTeamName}123`).toLowerCase(); // Ensure password is at least 6 characters and lowercase
        
        let userRecord;
        let userUid: string;
        
        // Check if user with this email already exists
        try {
          userRecord = await admin.auth().getUserByEmail(email);
          userUid = userRecord.uid;
          console.log(`✅ Found existing Firebase Auth user for ${normalizedTeamName}: ${userUid}`);
        } catch (getUserError: any) {
          // User doesn't exist, create new one
          if (getUserError.code === 'auth/user-not-found') {
            userRecord = await admin.auth().createUser({
              email: email,
              password: password,
              displayName: normalizedTeamName
            });
            userUid = userRecord.uid;
            console.log(`✅ Created Firebase Auth user for ${normalizedTeamName}: ${userUid}`);
          } else {
            throw getUserError;
          }
        }
        
        // Create/Update user document in Firestore
        const userDoc: any = {
          uid: userUid,
          email: email,
          username: username, // Critical for login
          role: 'team',
          isActive: true,
          isApproved: true, // Auto-approve historical teams
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(), // Always set for new imports
          
          // Team-specific data
          teamName: normalizedTeamName,
          teamId: teamId,
          logoUrl: '',
          players: [],
          
          // Mark as historical
          isHistorical: true,
          source: 'historical_import'
        }
        
        console.log(`👤 Creating user document:`);
        console.log(`   - Email: ${email}`);
        console.log(`   - Username: ${username}`);
        console.log(`   - UID: ${userUid}`);
        console.log(`   - Password: ${password}`);
        
        const userRef = adminDb.collection('users').doc(userUid);
        batch.set(userRef, userDoc, { merge: true });
        
        // CRITICAL: Create username entry in usernames collection for login
        const usernameRef = adminDb.collection('usernames').doc(username);
        const usernameDoc = {
          uid: userUid,
          createdAt: FieldValue.serverTimestamp()
        };
        batch.set(usernameRef, usernameDoc);
        
        console.log(`✅ User document queued for batch write: ${normalizedTeamName}`);
        console.log(`✅ Username entry queued: ${username} -> ${userUid}`);
        
        // Create team document with reference to user - only permanent data
        const teamDoc = {
          id: teamId,
          team_name: normalizedTeamName,
          owner_name: team.owner_name,
          
          // Link to Firebase Auth user
          userId: userUid,
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
          
          // Name tracking for teams that change names
          name_history: [], // Will store previous names
          previous_names: [], // Duplicate for easier querying
          
          // Performance tracking
          total_seasons_participated: 1
        };
        
        const teamRef = adminDb.collection('teams').doc(teamId);
        batch.set(teamRef, teamDoc);
        
        // Create team stats in NEON instead of Firebase
        const teamStatsDocId = `${teamId}_${seasonId}`;
        const sqlTeam = getTournamentDb();
        
        // Helper function to parse trophy strings like "UCL CHAMPIONS" or "CUP RUNNERS UP"
        const parseTrophyNameNew = (rawName: any): { name: string; position: string | null } => {
          // Convert to string and handle non-string values
          const nameStr = String(rawName || '').trim();
          if (!nameStr) return { name: '', position: null };
          
          const normalized = nameStr.toUpperCase();
          
          // Check for common position indicators
          if (normalized.endsWith('CHAMPIONS') || normalized.endsWith('CHAMPION')) {
            const trophyName = normalized.replace(/CHAMPIONS?$/, '').trim();
            return { name: trophyName, position: 'Champions' };
          }
          if (normalized.endsWith('RUNNERS UP') || normalized.endsWith('RUNNER UP')) {
            const trophyName = normalized.replace(/RUNNERS? UP$/, '').trim();
            return { name: trophyName, position: 'Runner Up' };
          }
          if (normalized.endsWith('WINNER') || normalized.endsWith('WINNERS')) {
            const trophyName = normalized.replace(/WINNERS?$/, '').trim();
            return { name: trophyName, position: 'Winner' };
          }
          if (normalized.endsWith('THIRD PLACE')) {
            const trophyName = normalized.replace(/THIRD PLACE$/, '').trim();
            return { name: trophyName, position: 'Third Place' };
          }
          
          // If no position indicator found, return name with null position
          return { name: nameStr, position: null };
        };
        
        // Parse team trophies/cups
        const teamTrophies2: Array<{ type: string; name: string; position: string | null }> = [];
        Object.keys(team).forEach((key) => {
          const lowerKey = key.toLowerCase();
          const value = (team as any)[key];
          if (!value || value === '') return;
          if (lowerKey.includes('cup')) {
            // Check if value contains multiple trophies separated by comma
            const valueStr = String(value).trim();
            if (valueStr.includes(',')) {
              // Split by comma and process each trophy separately
              const trophyNames = valueStr.split(',').map(t => t.trim()).filter(t => t);
              trophyNames.forEach(trophyName => {
                const parsed = parseTrophyNameNew(trophyName);
                if (parsed.name) {
                  teamTrophies2.push({ type: 'cup', name: parsed.name, position: parsed.position });
                }
              });
            } else {
              // Single trophy
              const parsed = parseTrophyNameNew(valueStr);
              if (parsed.name) {
                teamTrophies2.push({ type: 'cup', name: parsed.name, position: parsed.position });
              }
            }
          }
        });
        
        await sqlTeam`
          INSERT INTO teamstats (
            id, team_id, season_id, team_name, tournament_id,
            points, matches_played, wins, draws, losses,
            goals_for, goals_against, goal_difference, position,
            created_at, updated_at
          )
          VALUES (
            ${teamStatsDocId}, ${teamId}, ${seasonId}, ${normalizedTeamName}, 'historical',
            ${team.p || 0}, ${team.mp || 0}, ${team.w || 0}, 
            ${team.d || 0}, ${team.l || 0},
            ${team.f || 0}, ${team.a || 0}, ${team.gd || 0}, ${team.rank || team.position || null},
            NOW(), NOW()
          )
          ON CONFLICT (team_id, season_id) DO UPDATE
          SET
            team_name = EXCLUDED.team_name,
            points = EXCLUDED.points,
            matches_played = EXCLUDED.matches_played,
            wins = EXCLUDED.wins,
            draws = EXCLUDED.draws,
            losses = EXCLUDED.losses,
            goals_for = EXCLUDED.goals_for,
            goals_against = EXCLUDED.goals_against,
            goal_difference = EXCLUDED.goal_difference,
            position = EXCLUDED.position,
            updated_at = NOW()
        `;
        
        console.log(`✅ Created teamstats in NEON for new team: ${normalizedTeamName}`);
        
        // ✅ Insert trophies into team_trophies table with separate name and position
        // 1. Add league position trophies
        const positionNew = team.rank || team.position;
        if (positionNew === 1) {
          await sqlTeam`
            INSERT INTO team_trophies (
              team_id, team_name, season_id, trophy_type, trophy_name, trophy_position, position, awarded_by
            )
            VALUES (
              ${teamId}, ${normalizedTeamName}, ${seasonId}, 'league', 'League', 'Winner', 1, 'system'
            )
            ON CONFLICT (team_id, season_id, trophy_name, trophy_position) DO NOTHING
          `;
        } else if (positionNew === 2) {
          await sqlTeam`
            INSERT INTO team_trophies (
              team_id, team_name, season_id, trophy_type, trophy_name, trophy_position, position, awarded_by
            )
            VALUES (
              ${teamId}, ${normalizedTeamName}, ${seasonId}, 'runner_up', 'League', 'Runner Up', 2, 'system'
            )
            ON CONFLICT (team_id, season_id, trophy_name, trophy_position) DO NOTHING
          `;
        }
        
        // 2. Add cup trophies from Excel with separate name and position
        for (const trophy of teamTrophies2) {
          await sqlTeam`
            INSERT INTO team_trophies (
              team_id, team_name, season_id, trophy_type, trophy_name, trophy_position, awarded_by
            )
            VALUES (
              ${teamId}, ${normalizedTeamName}, ${seasonId}, 'cup', ${trophy.name}, ${trophy.position}, 'system'
            )
            ON CONFLICT (team_id, season_id, trophy_name, trophy_position) DO NOTHING
          `;
        }
        
        console.log(`✅ Inserted ${teamTrophies2.length + (positionNew <= 2 ? 1 : 0)} trophies for ${normalizedTeamName}`);
        
      } catch (userError: any) {
        console.error(`❌ Error creating user for team ${normalizedTeamName}:`, userError);
        
        // If user creation fails, still create the team document without user reference
        const teamDoc = {
          id: teamId,
          team_name: normalizedTeamName,
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
          total_seasons_participated: 1
        };
        
        const teamRef = adminDb.collection('teams').doc(teamId);
        batch.set(teamRef, teamDoc);
        
        // Create separate teamstats document for this season in NEON (error fallback)
        const teamStatsDocId = `${teamId}_${seasonId}`;
        const sql3 = getTournamentDb();
        
        await sql3`
          INSERT INTO teamstats (
            id, team_id, season_id, team_name, tournament_id,
            points, matches_played, wins, draws, losses,
            goals_for, goals_against, goal_difference, position,
            created_at, updated_at
          )
          VALUES (
            ${teamStatsDocId}, ${teamId}, ${seasonId}, ${normalizedTeamName}, 'historical',
            ${team.p || 0}, ${team.mp || 0}, ${team.w || 0}, 
            ${team.d || 0}, ${team.l || 0},
            ${team.f || 0}, ${team.a || 0}, ${team.gd || 0}, ${team.rank || team.position || null},
            NOW(), NOW()
          )
          ON CONFLICT (team_id, season_id) DO UPDATE
          SET
            team_name = EXCLUDED.team_name,
            points = EXCLUDED.points,
            matches_played = EXCLUDED.matches_played,
            wins = EXCLUDED.wins,
            draws = EXCLUDED.draws,
            losses = EXCLUDED.losses,
            goals_for = EXCLUDED.goals_for,
            goals_against = EXCLUDED.goals_against,
            goal_difference = EXCLUDED.goal_difference,
            position = EXCLUDED.position,
            updated_at = NOW()
        `;
        
        console.log(`✅ Created teamstats in NEON (fallback): ${normalizedTeamName}`);
      }
    }
    
    // Update progress
    await updateProgress(importId, {
      processedItems: i + 1,
      progress: ((i + 1) / teams.length) * 100,
      currentTask: `Creating team entity: ${normalizedTeamName}`
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

// Track the next player ID number to avoid race conditions
let nextPlayerIdNumber: number | null = null;

// Initialize player ID counter from batch loaded IDs
function initializePlayerIdCounter(allPlayerIds: string[]): void {
  const prefix = 'sspslpsl';
  let maxNumber = 0;
  
  allPlayerIds.forEach((playerId) => {
    if (playerId.startsWith(prefix)) {
      const numberPart = parseInt(playerId.substring(prefix.length));
      if (!isNaN(numberPart) && numberPart > maxNumber) {
        maxNumber = numberPart;
      }
    }
  });
  
  nextPlayerIdNumber = maxNumber + 1;
  console.log(`🔢 Initialized player ID counter at: ${nextPlayerIdNumber}`);
}

// Generate custom player ID (sspslpsl0001, sspslpsl0002, etc.)
function generateNewPlayerId(): string {
  const prefix = 'sspslpsl';
  
  try {
    // Counter should be initialized before calling this
    if (nextPlayerIdNumber === null) {
      throw new Error('Player ID counter not initialized. Call initializePlayerIdCounter first.');
    }
    
    // Increment and use the counter
    const currentNumber = nextPlayerIdNumber;
    nextPlayerIdNumber++;
    
    const paddedNumber = currentNumber.toString().padStart(4, '0');
    const newId = `${prefix}${paddedNumber}`;
    console.log(`🆔 Generated player ID: ${newId}`);
    return newId;
  } catch (error) {
    console.error('Error generating player ID:', error);
    // Fallback to random number if query fails
    const randomNumber = Math.floor(Math.random() * 10000);
    return `${prefix}${randomNumber.toString().padStart(4, '0')}`;
  }
}

// Helper function to get existing player by name or create new ID
// Now uses a cache to prevent ID collisions within the same import batch
const playerIdCache = new Map<string, { playerId: string; isNew: boolean; playerDoc: any }>();

function getOrCreatePlayerByName(name: string, batchLookup: BatchLookupData): { playerId: string; isNew: boolean; playerDoc: any } {
  try {
    // Check cache first (for players processed in this import batch)
    if (playerIdCache.has(name)) {
      const cachedData = playerIdCache.get(name)!;
      console.log(`  💾 Using cached player ID: ${name} -> ${cachedData.playerId}`);
      return cachedData;
    }
    
    // Check batch lookup for existing player (no Firebase read!)
    const existingPlayer = name ? batchLookup.existingPlayers.get(name.toLowerCase()) : null;
    
    if (existingPlayer) {
      console.log(`  ✅ Found existing player: ${name} with ID: ${existingPlayer.playerId}`);
      const result = { playerId: existingPlayer.playerId, isNew: false, playerDoc: existingPlayer.doc };
      // Cache the result
      playerIdCache.set(name, result);
      return result;
    }
    
    // No existing player found, generate new ID
    const playerId = generateNewPlayerId();
    console.log(`  🆕 Will create new player: ${name} with ID: ${playerId}`);
    const result = { playerId, isNew: true, playerDoc: null };
    // Cache the newly generated ID
    playerIdCache.set(name, result);
    return result;
  } catch (error) {
    console.error('Error in getOrCreatePlayerByName:', error);
    throw error;
  }
}

// Helper function to import players and link them to teams and seasons
async function importPlayers(
  seasonId: string, 
  players: ImportPlayerData[], 
  teams: ImportTeamData[], 
  teamMap: Map<string, string>, 
  importId: string, 
  batchLookup: BatchLookupData
): Promise<string[]> {
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
    if (team.team_name) {
      teamStatsMap.set(team.team_name.toLowerCase(), {
        playerCount: 0,
        totalGoals: 0,
        totalPoints: 0,
        totalMatches: 0
      });
    }
  });
  
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    
    // Normalize player name to Title Case
    const normalizedPlayerName = toTitleCase(player.name);
    const normalizedPlayerTeam = toTitleCase(player.team);
    console.log(`Processing player: "${player.name}" → "${normalizedPlayerName}" (Team: "${player.team}" → "${normalizedPlayerTeam}")`);
    
    // Get existing player by name or create new one (using batch lookup - no Firebase read!)
    const { playerId, isNew: isNewPlayer, playerDoc } = getOrCreatePlayerByName(normalizedPlayerName, batchLookup);
    playerIds.push(playerId);
    
    // Use existing player data from batch lookup (no Firebase read!)
    const currentPlayerData: any = playerDoc || {};
    
    // Create new stats object in the realplayers format with ALL statistics fields
    const matchesPlayed = player.total_matches || 0;
    const goalsScored = player.goals_scored || 0;
    const goalsConceded = player.goals_conceded || 0;
    const matchesWon = player.win || 0;
    const matchesDrawn = player.draw || 0;
    const matchesLost = player.loss || 0;
    const cleanSheets = player.cleansheets || 0;
    const totalPoints = player.total_points || player.points || 0;
    const potm = player.potm ?? null; // Player of the Match (nullable)
    
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
      clean_sheets: cleanSheets,
      potm: potm, // Player of the Match (nullable)
      
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
    
    // Update name to normalized version
    permanentPlayerDoc.name = normalizedPlayerName;
    permanentPlayerDoc.display_name = currentPlayerData?.display_name || normalizedPlayerName;
    
    // Save to realplayers collection
    const playerRef = adminDb.collection('realplayers').doc(playerId);
    batch.set(playerRef, permanentPlayerDoc, { merge: true });
    
    // 2. Create/Update season-specific stats document in realplayerstats collection
    // Use composite ID: player_id_seasonId for easy lookup
    const statsDocId = `${playerId}_${seasonId}`;
    const existingStatsDocId = batchLookup.existingStats.get(statsDocId);
    
    let isNewStats = false;
    
    if (existingStatsDocId) {
      console.log(`  📋 Updating stats for ${player.name} in season ${seasonId}`);
    } else {
      isNewStats = true;
      console.log(`  🆕 Creating stats for ${player.name} in season ${seasonId}`);
    }
    
    // Write player stats to NEON instead of Firebase
    const sqlPlayer = getTournamentDb();
    const teamIdForPlayer = teamMap.get(normalizedPlayerTeam) || null;
    
    // Parse trophies from Excel data (handles numbered columns like category_wise_trophy_1, category_wise_trophy_2, etc.)
    const playerAwards: Array<{ award_name: string; award_position: string | null; type: 'category' | 'individual' }> = [];
    
    // Helper function to parse trophy/award name and extract position
    const parseAwardName = (rawName: any): { name: string; position: string | null } => {
      // Convert to string and handle non-string values
      const nameStr = String(rawName || '').trim();
      if (!nameStr) return { name: '', position: null };
      
      const normalized = nameStr.toUpperCase();
      
      // Check for position indicators
      if (normalized.endsWith('RUNNER UP') || normalized.endsWith('RUNNER-UP')) {
        const awardName = normalized.replace(/RUNNER[\s-]*UP$/, '').trim();
        return { name: awardName, position: 'Runner-up' };
      }
      if (normalized.endsWith('WINNER') || normalized.endsWith('WINNERS')) {
        const awardName = normalized.replace(/WINNERS?$/, '').trim();
        return { name: awardName, position: 'Winner' };
      }
      if (normalized.endsWith('THIRD PLACE') || normalized.endsWith('3RD PLACE')) {
        const awardName = normalized.replace(/(THIRD|3RD)\s+PLACE$/, '').trim();
        return { name: awardName, position: 'Third Place' };
      }
      
      // If no position indicator found, return name with null position
      return { name: nameStr, position: null };
    };
    
    // First, check if trophies come as arrays from preview (category_trophies, individual_trophies)
    if (Array.isArray((player as any).category_trophies)) {
      (player as any).category_trophies.forEach((trophy: string) => {
        if (trophy && trophy.trim()) {
          const parsed = parseAwardName(trophy);
          if (parsed.name) {
            playerAwards.push({ award_name: parsed.name, award_position: parsed.position, type: 'category' });
          }
        }
      });
    }
    
    if (Array.isArray((player as any).individual_trophies)) {
      (player as any).individual_trophies.forEach((trophy: string) => {
        if (trophy && trophy.trim()) {
          const parsed = parseAwardName(trophy);
          if (parsed.name) {
            playerAwards.push({ award_name: parsed.name, award_position: parsed.position, type: 'individual' });
          }
        }
      });
    }
    
    // Also scan all player properties for trophy columns (for direct Excel imports)
    Object.keys(player).forEach((key) => {
      const lowerKey = key.toLowerCase();
      const value = (player as any)[key];
      
      // Skip if already processed as arrays
      if (lowerKey === 'category_trophies' || lowerKey === 'individual_trophies') return;
      
      // Skip empty values
      if (!value || value === '') return;
      
      const parsed = parseAwardName(value);
      
      // Only add if award name is not empty
      if (parsed.name) {
        // Check for category trophies (Cat Trophy, category_wise_trophy_1, etc.)
        if ((lowerKey.includes('category') || lowerKey.includes('cat')) && lowerKey.includes('trophy')) {
          playerAwards.push({ award_name: parsed.name, award_position: parsed.position, type: 'category' });
          console.log(`    🏆 Found category trophy from column "${key}": ${parsed.name}`);
        }
        // Check for individual trophies (Ind Trophy, individual_wise_trophy_1, etc.)
        else if ((lowerKey.includes('individual') || lowerKey.includes('ind')) && lowerKey.includes('trophy')) {
          playerAwards.push({ award_name: parsed.name, award_position: parsed.position, type: 'individual' });
          console.log(`    🏆 Found individual trophy from column "${key}": ${parsed.name}`);
        }
      }
    });
    
    console.log(`  🏆 Total awards found for ${normalizedPlayerName}: ${playerAwards.length}`);
    if (playerAwards.length > 0) {
      console.log(`  🏆 Awards: ${playerAwards.map(a => `${a.award_name} (${a.type})`).join(', ')}`);
    }
    
    // For backward compatibility, still store in trophies JSONB (but we'll use player_awards table as primary)
    const trophiesJson = JSON.stringify(playerAwards.map(a => ({ type: a.type, name: a.award_name })));
    
    await sqlPlayer`
      INSERT INTO realplayerstats (
        id, player_id, season_id, player_name, tournament_id,
        category, team, team_id,
        matches_played, matches_won, matches_drawn, matches_lost,
        goals_scored, goals_conceded, assists, wins, draws, losses,
        clean_sheets, motm_awards, points, star_rating, trophies,
        created_at, updated_at
      )
      VALUES (
        ${statsDocId}, ${playerId}, ${seasonId}, ${normalizedPlayerName}, 'historical',
        ${player.category || ''}, ${normalizedPlayerTeam}, ${teamIdForPlayer},
        ${newStats.matches_played || 0}, ${newStats.matches_won || 0}, 
        ${newStats.matches_drawn || 0}, ${newStats.matches_lost || 0},
        ${newStats.goals_scored || 0}, ${newStats.goals_conceded || 0},
        ${(player as any).assists || 0}, 
        ${newStats.matches_won || 0}, ${newStats.matches_drawn || 0}, ${newStats.matches_lost || 0},
        ${newStats.clean_sheets || 0}, ${newStats.potm || 0},
        ${newStats.total_points || 0}, 3, ${trophiesJson}::jsonb,
        NOW(), NOW()
      )
      ON CONFLICT (player_id, season_id) DO UPDATE
      SET
        player_name = EXCLUDED.player_name,
        category = EXCLUDED.category,
        team = EXCLUDED.team,
        team_id = EXCLUDED.team_id,
        matches_played = EXCLUDED.matches_played,
        matches_won = EXCLUDED.matches_won,
        matches_drawn = EXCLUDED.matches_drawn,
        matches_lost = EXCLUDED.matches_lost,
        goals_scored = EXCLUDED.goals_scored,
        goals_conceded = EXCLUDED.goals_conceded,
        assists = EXCLUDED.assists,
        wins = EXCLUDED.wins,
        draws = EXCLUDED.draws,
        losses = EXCLUDED.losses,
        clean_sheets = EXCLUDED.clean_sheets,
        motm_awards = EXCLUDED.motm_awards,
        points = EXCLUDED.points,
        trophies = EXCLUDED.trophies,
        updated_at = NOW()
    `;
    
    console.log(`✅ Created/Updated player stats in NEON: ${normalizedPlayerName}`);
    
    // ✅ Insert player awards into player_awards table with separate name and position
    for (const award of playerAwards) {
      try {
        // Determine player_category: use player's position category
        const playerCategory = player.category || null;
        
        await sqlPlayer`
          INSERT INTO player_awards (
            player_id, player_name, season_id, 
            award_category, award_type, award_position,
            player_category, created_at, updated_at
          )
          VALUES (
            ${playerId}, ${normalizedPlayerName}, ${seasonId},
            ${award.type}, ${award.award_name}, ${award.award_position},
            ${playerCategory}, NOW(), NOW()
          )
          ON CONFLICT (player_id, season_id, award_category, award_type, award_position) 
          DO UPDATE SET
            player_name = EXCLUDED.player_name,
            player_category = EXCLUDED.player_category,
            updated_at = NOW()
        `;
      } catch (awardError) {
        console.error(`⚠️  Error inserting award for ${normalizedPlayerName}:`, awardError);
        // Continue with other awards even if one fails
      }
    }
    
    if (playerAwards.length > 0) {
      console.log(`✅ Inserted ${playerAwards.length} awards for ${normalizedPlayerName}`);
    }
    
    // Update team statistics
    const teamStats = normalizedPlayerTeam ? teamStatsMap.get(normalizedPlayerTeam.toLowerCase()) : null;
    if (teamStats) {
      teamStats.playerCount++;
      teamStats.totalGoals += player.goals_scored || 0;
      teamStats.totalPoints += player.total_points || 0;
      teamStats.totalMatches = Math.max(teamStats.totalMatches, player.total_matches || 0);
    }
    
    // Update progress
    await updateProgress(importId, {
      processedItems: i + 1,
      progress: ((i + 1) / players.length) * 100,
      currentTask: `Creating player: ${normalizedPlayerName} (${normalizedPlayerTeam})`
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
  
  for (const team of teams) {
    const teamStats = team.team_name ? teamStatsMap.get(team.team_name.toLowerCase()) : null;
    const teamId = team.team_name ? teamMap.get(team.team_name) : null;
    
    if (!teamStats || !teamId) continue;
    
    // Update the teamstats document with player count
    const teamStatsDocId = `${teamId}_${seasonId}`;
    const teamStatsRef = adminDb.collection('teamstats').doc(teamStatsDocId);
    
    const teamStatsUpdateData = {
      players_count: teamStats.playerCount,
      updated_at: FieldValue.serverTimestamp()
    };
    
    batch.update(teamStatsRef, teamStatsUpdateData);
  }
  
  // Commit the batch updates
  if (teams.length > 0) {
    try {
      await batch.commit();
      console.log(`✅ Updated ${teams.length} teamstats documents with player counts`);
    } catch (error) {
      console.warn('Team stats update completed with some issues:', error);
    }
  }
}

export async function POST(request: NextRequest) {
  console.log('\n' + '='.repeat(80));
  console.log('📥 POST /api/seasons/historical/import - New import request received');
  console.log('='.repeat(80));
  
  try {
    console.log('📖 Reading request body...');
    const importData: ImportSeasonData = await request.json();
    console.log('✅ Request body parsed successfully');
    console.log('Import data summary:', {
      teams: importData.teams?.length || 0,
      players: importData.players?.length || 0,
      seasonNumber: importData.seasonInfo?.seasonNumber,
      fileName: importData.seasonInfo?.fileName
    });
    
    const importId = uuidv4();
    console.log('🆔 Generated import ID:', importId);
    
    // Calculate total items to process
    const totalItems = importData.teams.length + importData.players.length;
    console.log('📊 Total items to import:', totalItems);
    
    // Initialize progress tracking in Firestore
    const initialProgress: ImportProgress = {
      importId,
      status: 'initializing',
      progress: 0,
      currentTask: 'Initializing import process...',
      totalItems,
      processedItems: 0,
      startTime: new Date()
    };
    
    await adminDb.collection('import_progress').doc(importId).set(initialProgress);
    console.log('💾 Initial progress stored in Firestore');
    console.log('Import ID:', importId);
    
    // Start the import process asynchronously
    console.log('🚀 Starting async processImport function...');
    processImport(importId, importData).catch(error => {
      console.error('❌ Import failed with error:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      updateProgress(importId, {
        status: 'failed',
        error: error.message || 'Unknown error occurred',
        endTime: new Date()
      });
    });
    
    console.log('✅ Import API response sent (process running in background)');
    return NextResponse.json({
      success: true,
      importId,
      message: 'Import started successfully'
    });
    
  } catch (error: any) {
    console.error('❌ Error starting import:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

async function processImport(importId: string, importData: ImportSeasonData) {
  console.log('🚀 Starting import process:', importId);
  console.log('📊 Import data:', { 
    teamsCount: importData.teams.length, 
    playersCount: importData.players.length,
    seasonNumber: importData.seasonInfo.seasonNumber,
    fileName: importData.seasonInfo.fileName
  });
  
  try {
    // Clear player ID cache and reset counters at the start of each import
    playerIdCache.clear();
    nextPlayerIdNumber = null; // Reset player counter
    nextTeamIdNumber = null; // Reset team counter
    console.log('🗑️ Player ID cache cleared and counters reset');
    
    // Step 1: Create season
    console.log('📅 Step 1: Creating season...');
    console.log('Season info:', JSON.stringify(importData.seasonInfo, null, 2));
    
    await updateProgress(importId, {
      status: 'importing_season',
      currentTask: 'Creating season record...',
      progress: 5
    });
    console.log('✅ Progress updated to: importing_season (5%)');
    
    console.log('🔧 Calling createSeason function...');
    const seasonId = await createSeason(importData.seasonInfo);
    console.log('✅ Season created successfully:', seasonId);
    
    await updateProgress(importId, {
      seasonId,
      progress: 10
    });
    
    // Step 2: Check if season already exists to optimize stats loading
    const existingSeasonDoc = await adminDb.collection('seasons').doc(seasonId).get();
    const isNewSeason = !existingSeasonDoc.exists;
    console.log(`🆕 Season ${seasonId} is ${isNewSeason ? 'NEW' : 'EXISTING'}`);
    
    // Step 3: Smart detection - Is this a re-import?
    console.log('🧠 Step 3: Running smart detection...');
    await updateProgress(importId, {
      currentTask: 'Detecting import type (new vs re-import)...',
      progress: 12
    });
    
    const teamNames = importData.teams.map(t => t.team_name);
    const playerNames = importData.players.map(p => p.name);
    const detection = await detectReimport(playerNames, teamNames);
    
    await updateProgress(importId, {
      currentTask: detection.isReimport 
        ? `Re-import detected (${(detection.matchRate * 100).toFixed(0)}% match) - using optimized path`
        : `New import detected (${(detection.matchRate * 100).toFixed(0)}% match) - using selective loading`,
      progress: 15
    });
    
    // Step 4: Choose optimal loading strategy based on detection
    let batchLookup: BatchLookupData;
    
    if (detection.isReimport) {
      // RE-IMPORT PATH: Skip selective queries, just load IDs + stats
      console.log('🔄 Using RE-IMPORT optimization (skipping selective queries)...');
      batchLookup = await batchLoadForReimport(seasonId, isNewSeason);
    } else {
      // NEW IMPORT PATH: Use selective loading
      console.log('🆕 Using SELECTIVE LOADING (querying specific entities)...');
      batchLookup = await batchLoadExistingEntities(teamNames, playerNames, seasonId, isNewSeason);
    }
    
    // Initialize ID counters from batch loaded data
    initializeTeamIdCounter(batchLookup.allTeamIds);
    initializePlayerIdCounter(batchLookup.allPlayerIds);
    
    await updateProgress(importId, {
      progress: 20
    });
    
    // Step 4: Import teams and get team mapping
    let teamMap = new Map<string, string>();
    if (importData.teams.length > 0) {
      await updateProgress(importId, {
        status: 'importing_teams',
        currentTask: 'Creating team entities with login credentials...',
        processedItems: 0
      });
      
      teamMap = await importTeams(seasonId, importData.teams, importId, batchLookup);
    }
    
    // Step 5: Import players and link them to teams
    if (importData.players.length > 0) {
      await updateProgress(importId, {
        status: 'importing_players',
        currentTask: 'Creating players and linking to teams...',
        processedItems: 0
      });
      
      await importPlayers(seasonId, importData.players, importData.teams, teamMap, importId, batchLookup);
    }
    
    // Step 6: Complete
    await updateProgress(importId, {
      status: 'completed',
      progress: 100,
      currentTask: `Import completed! Created ${importData.teams.length} team entities with login credentials and ${importData.players.length} players with comprehensive stats.`,
      processedItems: importData.teams.length + importData.players.length,
      endTime: new Date()
    });
    
    // Clear cache and reset counters after successful import
    playerIdCache.clear();
    nextPlayerIdNumber = null;
    nextTeamIdNumber = null;
    
  } catch (error: any) {
    await updateProgress(importId, {
      status: 'failed',
      error: error.message,
      endTime: new Date()
    });
    // Clear cache and reset counters on error as well
    playerIdCache.clear();
    nextPlayerIdNumber = null;
    nextTeamIdNumber = null;
    throw error;
  }
}

// GET endpoint to check import progress
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const importId = searchParams.get('importId');
    
    if (!importId) {
      console.log('⚠️ GET progress - No import ID provided');
      return NextResponse.json(
        { success: false, error: 'Import ID is required' },
        { status: 400 }
      );
    }
    
    // Read progress from Firestore
    const progressDoc = await adminDb.collection('import_progress').doc(importId).get();
    
    if (!progressDoc.exists) {
      console.log(`⚠️ GET progress - Import ID ${importId} not found in Firestore`);
      return NextResponse.json(
        { success: false, error: 'Import not found' },
        { status: 404 }
      );
    }
    
    const progress = progressDoc.data() as ImportProgress;
    
    // Only log periodically to avoid spam (every 10th request or on status change)
    const shouldLog = Math.random() < 0.1 || progress.status !== 'initializing';
    if (shouldLog) {
      console.log(`🔍 GET progress for ${importId}:`, {
        status: progress.status,
        progress: progress.progress,
        currentTask: progress.currentTask,
        processedItems: `${progress.processedItems}/${progress.totalItems}`
      });
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