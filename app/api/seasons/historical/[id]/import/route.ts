import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { FieldValue } from 'firebase-admin/firestore';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import * as XLSX from 'xlsx';

interface ImportStats {
  teams: { updated: number; unchanged: number; errors: string[] };
  players: { updated: number; unchanged: number; errors: string[] };
  awards: { updated: number; unchanged: number; errors: string[] };
  matches: { updated: number; unchanged: number; errors: string[] };
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
      console.log(`  Found existing player: ${name} with ID: ${playerId}`);
      return { playerId, isNew: false };
    }
    
    // No existing player found, generate new ID
    const playerId = await generateNewPlayerId();
    console.log(`  Will create new player: ${name} with ID: ${playerId}`);
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: seasonId } = await params;
    console.log(`Importing Excel data for historical season ID: ${seasonId}`);

    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Check user role from Firestore user document
    console.log(`Checking user role for UID: ${decodedToken.uid}`);
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists) {
      console.log('User document not found in Firestore');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const userData = userDoc.data();
    console.log(`User role: ${userData?.role}`);
    if (userData?.role !== 'super_admin') {
      console.log(`Access denied. Required: super_admin, Current: ${userData?.role}`);
      return NextResponse.json({ error: 'Forbidden: Super admin access required' }, { status: 403 });
    }
    
    console.log('Super admin access confirmed');

    // Check content type to determine if this is a file upload or JSON preview import
    const contentType = request.headers.get('content-type') || '';
    console.log('Content-Type:', contentType);
    
    let teamsToImport: any[] = [];
    let playersToImport: any[] = [];
    
    if (contentType.includes('application/json')) {
      // Import from preview data (JSON)
      console.log('Importing from preview data (JSON)');
      const jsonData = await request.json();
      teamsToImport = jsonData.teams || [];
      playersToImport = jsonData.players || [];
      
      console.log(`  - Teams to import: ${teamsToImport.length}`);
      console.log(`  - Players to import: ${playersToImport.length}`);
    } else {
      // Import from Excel file upload
      console.log('Importing from Excel file');
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

    // CLEANUP PHASE: Delete existing season stats from NEON before importing
    console.log('  Starting cleanup phase for season stats in NEON...');
    
    const sql = getTournamentDb();
    
    // Delete all player stats for this season from NEON
    const deletedPlayerStats = await sql`
      DELETE FROM realplayerstats
      WHERE season_id = ${seasonId}
    `;
    
    console.log(`  Deleted ${deletedPlayerStats.length} player stats records from NEON`);
    
    // Delete all team stats for this season from NEON
    const deletedTeamStats = await sql`
      DELETE FROM teamstats
      WHERE season_id = ${seasonId}
    `;
    
    console.log(`  Deleted ${deletedTeamStats.length} team stats records from NEON`);
    
    // Delete all player awards for this season from NEON
    const deletedAwards = await sql`
      DELETE FROM player_awards
      WHERE season_id = ${seasonId}
    `;
    
    console.log(`  Deleted ${deletedAwards.length} player awards records from NEON`);
    console.log('  Cleanup phase completed');
    console.log('  Starting fresh import...\n');

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
      // Use linked_team_id if available, otherwise fallback to id
      const teamIds = teamsToImport.map(t => t.linked_team_id || t.id).filter(Boolean);
      
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
          // Use linked_team_id if available (from preview), otherwise skip
          const teamId = row.linked_team_id || row.id;
          
          if (!teamId) {
            console.log(`  ⚠️  Skipping team "${row.team_name || row.team}" - no linked team ID`);
            continue;
          }

          // OPTIMIZED: Use cached team data
          const currentData = teamsCache.get(teamId);
          if (!currentData) {
            stats.teams.errors.push(`Team with ID ${teamId} not found`);
            continue;
          }

          // Write team stats to NEON teamstats table
          const teamStatsDocId = `${teamId}_${seasonId}`;
          const teamName = row.team_name || currentData?.team_name || '';
          const ownerName = row.owner_name || currentData?.owner_name || '';
          const rank = parseInt(row.rank) || 0;
          const points = parseInt(row.p || row.points) || 0;
          const matchesPlayed = parseInt(row.mp || row.matches_played) || 0;
          const wins = parseInt(row.w || row.wins) || 0;
          const draws = parseInt(row.d || row.draws) || 0;
          const losses = parseInt(row.l || row.losses) || 0;
          const goalsFor = parseInt(row.f || row.goals_for) || 0;
          const goalsAgainst = parseInt(row.a || row.goals_against) || 0;
          const goalDifference = parseInt(row.gd || row.goal_difference) || 0;
          
          // Parse team trophies/cups (cup_1, cup_2, etc.)
          const teamTrophiesArr: any[] = [];
          Object.keys(row).forEach((key) => {
            const lowerKey = key.toLowerCase();
            const value = (row as any)[key];
            if (!value || value === '') return;
            if (lowerKey.includes('cup')) {
              teamTrophiesArr.push({ type: 'cup', name: value });
            }
          });
          const teamTrophiesJsonStr = JSON.stringify(teamTrophiesArr);
          
          // Write to NEON
          await sql`
            INSERT INTO teamstats (
              id, team_id, season_id, team_name,
              points, matches_played, wins, draws, losses,
              goals_for, goals_against, goal_difference, position, trophies,
              created_at, updated_at
            )
            VALUES (
              ${teamStatsDocId}, ${teamId}, ${seasonId}, ${teamName},
              ${points}, ${matchesPlayed}, ${wins}, ${draws}, ${losses},
              ${goalsFor}, ${goalsAgainst}, ${goalDifference}, ${rank || null},
              ${teamTrophiesJsonStr}::jsonb,
              NOW(), NOW()
            )
            ON CONFLICT (id) DO UPDATE
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
              trophies = EXCLUDED.trophies,
              updated_at = NOW()
          `;
          stats.teams.updated++;
          console.log(`  ✅ Updated teamstats in NEON for: ${teamName}`);
        
        } catch (error: any) {
          const teamIdentifier = row.linked_team_id || row.id || row.team_name || 'unknown';
          stats.teams.errors.push(`Error updating team ${teamIdentifier}: ${error.message}`);
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

          // Normalize player name and team to Title Case
          const normalizedPlayerName = toTitleCase(row.name);
          const normalizedPlayerTeam = toTitleCase(row.team || '');
          console.log(`  Processing player: "${row.name}" → "${normalizedPlayerName}" (Team: "${row.team}" → "${normalizedPlayerTeam}")`);

          // OPTIMIZED: Use cached player data instead of querying
          const playerNameLower = normalizedPlayerName.toLowerCase();
          let playerId: string;
          let isNewPlayer: boolean;
          let currentPlayerData: any = {};
          
          const existingPlayer = playersByName.get(playerNameLower);
          if (existingPlayer) {
            playerId = existingPlayer.playerId;
            currentPlayerData = existingPlayer.data;
            isNewPlayer = false;
            console.log(`  ✅ Found existing player: ${normalizedPlayerName} with ID: ${playerId}`);
          } else {
            // Generate new player ID
            maxPlayerNumber++;
            playerId = `sspslpsl${maxPlayerNumber.toString().padStart(4, '0')}`;
            isNewPlayer = true;
            // Add to cache for potential duplicate names in same import
            playersByName.set(playerNameLower, { playerId, data: {} });
            console.log(`  🆕 Will create new player: ${normalizedPlayerName} with ID: ${playerId}`);
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
            
            // Player of the Match (POTM) - nullable
            potm: row.potm ? parseInt(row.potm) : (row.POTM ? parseInt(row.POTM) : null),
            
            // Current season tracking
            current_season_matches: matchesPlayed,
            current_season_wins: matchesWon
          };

          // 1. Update/Create permanent player document in realplayers collection
          const permanentPlayerData: any = {
            player_id: playerId,
            name: normalizedPlayerName,
            display_name: row.display_name || currentPlayerData?.display_name || normalizedPlayerName,
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
          // Use composite ID: player_id_seasonId for easy lookup
          const statsDocId = `${playerId}_${seasonId}`;
          console.log(`  🆕 Creating stats for ${normalizedPlayerName} in season ${seasonId}`);
          
          // Parse all trophies based on column heading (category_wise or individual_wise)
          const allAwards: Array<{ name: string; type: 'category' | 'individual' }> = [];
          
          // Check all possible column names for trophies
          Object.keys(row).forEach(key => {
            const lowerKey = key.toLowerCase();
            const value = row[key];
            
            if (value && typeof value === 'string' && value.trim()) {
              // Match: trophy columns and determine type from column name
              if (lowerKey.includes('trophy')) {
                const awardName = value.trim();
                
                // Determine type based on column heading
                let awardType: 'category' | 'individual' = 'individual';
                if (lowerKey.includes('category') || lowerKey.includes('cat')) {
                  awardType = 'category';
                } else if (lowerKey.includes('individual') || lowerKey.includes('ind')) {
                  awardType = 'individual';
                }
                
                allAwards.push({ name: awardName, type: awardType });
                console.log(`    🏆 Found trophy from column "${key}": ${awardName} (${awardType})`);
              }
            }
          });
          
          // Also handle if trophies come as arrays (from preview)
          if (Array.isArray(row.category_trophies)) {
            row.category_trophies.forEach((trophy: string) => {
              if (trophy && trophy.trim()) {
                allAwards.push({ name: trophy.trim(), type: 'category' });
                console.log(`    🏆 Found category trophy from array: ${trophy.trim()}`);
              }
            });
          }
          if (Array.isArray(row.individual_trophies)) {
            row.individual_trophies.forEach((trophy: string) => {
              if (trophy && trophy.trim()) {
                allAwards.push({ name: trophy.trim(), type: 'individual' });
                console.log(`    🏆 Found individual trophy from array: ${trophy.trim()}`);
              }
            });
          }
          
          console.log(`  📊 Total awards found for ${normalizedPlayerName}: ${allAwards.length}`);
          if (allAwards.length > 0) {
            console.log(`  🏆 Awards: ${allAwards.map(a => `${a.name} (${a.type})`).join(', ')}`);
          }
          
          // Normalize team name: if it's a previous name, use the current name
          let normalizedTeamName = row.team || row.team_name || '';
          let teamNameMatched = false;
          
          if (normalizedTeamName) {
            const teamNameLower = normalizedTeamName.trim().toLowerCase();
            
            // Check if this team name matches any current or previous team name
            for (const [teamId, teamData] of teamsCache.entries()) {
              const currentNameLower = teamData.team_name?.trim().toLowerCase();
              const previousNames = teamData.previous_names || teamData.name_history || [];
              
              // Check if it matches the current team name
              if (currentNameLower === teamNameLower) {
                teamNameMatched = true;
                normalizedTeamName = teamData.team_name; // Use exact casing from database
                break;
              }
              
              // Check if it matches any previous name
              const matchesPreviousName = previousNames.some((oldName: string) => 
                oldName && oldName.trim().toLowerCase() === teamNameLower
              );
              
              if (matchesPreviousName) {
                // Use the current team name instead
                console.log(`  🔄 Normalizing team name: "${normalizedTeamName}" → "${teamData.team_name}"`);
                normalizedTeamName = teamData.team_name;
                teamNameMatched = true;
                break;
              }
            }
            
            // If no match found, add a warning
            if (!teamNameMatched) {
              const warningMsg = `⚠️ Player "${normalizedPlayerName}" has team "${normalizedTeamName}" which does not match any current or previous team names`;
              console.warn(warningMsg);
              stats.players.errors.push(warningMsg);
            }
          }
          
          // Prepare stats data for Firestore (without trophies)
          const statsData: any = {
            player_id: playerId,
            player_name: normalizedPlayerName,
            season_id: seasonId,
            season_name: seasonName,
            team: normalizedTeamName,
            team_id: teamsCache.get(normalizedTeamName.toLowerCase())?.id || null,
            category: row.category || '', // Season-specific
            is_active: row.is_active !== false,
            is_available: row.is_available !== false,
            // Flatten stats at document level for easier querying
            ...updatedStats,
            created_at: FieldValue.serverTimestamp(),
            updated_at: FieldValue.serverTimestamp()
          };
          
          // Write to NEON realplayerstats table (without trophies)
          await sql`
            INSERT INTO realplayerstats (
              id, player_id, season_id, player_name,
              category, team, team_id,
              matches_played, matches_won, matches_drawn, matches_lost,
              goals_scored, goals_conceded, assists, wins, draws, losses,
              clean_sheets, motm_awards, points, star_rating,
              created_at, updated_at
            )
            VALUES (
              ${statsDocId}, ${playerId}, ${seasonId}, ${normalizedPlayerName},
              ${statsData.category || ''}, ${normalizedPlayerTeam}, ${statsData.team_id},
              ${statsData.matches_played || 0}, ${statsData.wins || statsData.matches_won || 0},
              ${statsData.draws || statsData.matches_drawn || 0}, ${statsData.losses || statsData.matches_lost || 0},
              ${statsData.goals_scored || 0}, ${statsData.goals_conceded || 0},
              ${statsData.assists || 0}, ${statsData.wins || statsData.matches_won || 0}, 
              ${statsData.draws || statsData.matches_drawn || 0}, ${statsData.losses || statsData.matches_lost || 0},
              ${statsData.clean_sheets || 0}, ${statsData.motm_awards || 0}, 
              ${statsData.points || 0}, ${statsData.star_rating || 3},
              NOW(), NOW()
            )
            ON CONFLICT (id) DO UPDATE
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
              star_rating = EXCLUDED.star_rating,
              updated_at = NOW()
          `;
          
          // Save awards to player_awards table with automatic type classification
          for (const award of allAwards) {
            try {
              await sql`
                INSERT INTO player_awards (
                  player_id, player_name, season_id, 
                  award_category, award_type,
                  player_category, created_at, updated_at
                )
                VALUES (
                  ${playerId}, ${normalizedPlayerName}, ${seasonId},
                  ${award.type}, ${award.name},
                  ${statsData.category || null}, NOW(), NOW()
                )
                ON CONFLICT (player_id, season_id, award_category, award_type) DO UPDATE
                SET
                  player_name = EXCLUDED.player_name,
                  player_category = EXCLUDED.player_category,
                  updated_at = NOW()
              `;
              stats.awards.updated++;
              console.log(`    🏆 Saved award: ${award.name} (${award.type})`);
            } catch (awardError: any) {
              console.error(`    ❌ Error saving award ${award.name}:`, awardError.message);
              stats.awards.errors.push(`Error saving award ${award.name} for ${normalizedPlayerName}: ${awardError.message}`);
            }
          }
          stats.players.updated++;
          console.log(`  ✅ Created player stats in NEON: ${statsData.player_name}`);
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
    console.log(`  - Player Awards: ${stats.awards.updated} awards saved to player_awards table`);
    console.log(`🏆 Summary:`);
    console.log(`   • ${stats.teams.updated} team stats records`);
    console.log(`   • ${stats.players.updated} player stats records`);
    console.log(`   • ${stats.awards.updated} player awards/trophies`);
    if (stats.awards.errors.length > 0) {
      console.log(`   ⚠️ ${stats.awards.errors.length} award errors`);
    }

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
          updated: stats.awards.updated,
          unchanged: stats.awards.unchanged,
          total: stats.awards.updated + stats.awards.unchanged,
          errors: stats.awards.errors
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