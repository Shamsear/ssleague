/**
 * Interactive Duplicate Player Merger
 * 
 * This script helps identify and merge duplicate players that were created
 * during historical imports due to name variations.
 * 
 * Usage:
 * 1. node scripts/merge-duplicate-players.js
 * 2. Review suggested duplicates
 * 3. Choose which players to merge
 * 4. Script updates all references and deletes duplicates
 */

const admin = require('firebase-admin');
const readline = require('readline');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Firebase Admin
if (!admin.apps.length) {
  if (process.env.FIREBASE_ADMIN_PROJECT_ID && 
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL && 
      process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });
    console.log('✅ Firebase Admin initialized');
  } else {
    console.error('❌ Error: Firebase Admin credentials not found!');
    console.error('Make sure .env.local contains:');
    console.error('  - FIREBASE_ADMIN_PROJECT_ID');
    console.error('  - FIREBASE_ADMIN_CLIENT_EMAIL');
    console.error('  - FIREBASE_ADMIN_PRIVATE_KEY');
    process.exit(1);
  }
}

const db = admin.firestore();

// Initialize Neon - Tournament Database (where realplayerstats is stored)
const tournamentSql = process.env.NEON_TOURNAMENT_DB_URL ? neon(process.env.NEON_TOURNAMENT_DB_URL) : null;
if (!tournamentSql) {
  console.error('❌ Error: NEON_TOURNAMENT_DB_URL not found!');
  console.error('Player stats in Neon cannot be updated without this.');
  process.exit(1);
}
console.log('✅ Neon Tournament DB initialized');

// Readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper to ask questions
const question = (query) => {
  return new Promise(resolve => rl.question(query, resolve));
};

// Normalize name for comparison (removes spaces, special chars, lowercase)
function normalizeName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '') // Remove spaces
    .replace(/[^a-z0-9]/g, ''); // Remove special characters
}

// Calculate string similarity (0-1)
function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  if (longer.length === 0) return 1.0;
  
  const editDist = levenshteinDistance(longer, shorter);
  return (longer.length - editDist) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
}

// Find potential duplicate groups
async function findDuplicates() {
  console.log('\n🔍 Scanning for duplicate players...\n');
  
  // Load all players from Firebase
  const playersSnapshot = await db.collection('realplayers').get();
  const players = [];
  
  playersSnapshot.forEach(doc => {
    const data = doc.data();
    players.push({
      id: doc.id,
      player_id: data.player_id || doc.id,
      name: data.name || data.display_name || 'Unknown',
      display_name: data.display_name,
      email: data.email,
      phone: data.phone,
      created_at: data.created_at
    });
  });
  
  console.log(`📊 Found ${players.length} total players\n`);
  
  // Group by normalized name
  const nameGroups = new Map();
  
  players.forEach(player => {
    const normalized = normalizeName(player.name);
    if (!nameGroups.has(normalized)) {
      nameGroups.set(normalized, []);
    }
    nameGroups.get(normalized).push(player);
  });
  
  // Find groups with duplicates
  const duplicateGroups = [];
  
  nameGroups.forEach((group, normalizedName) => {
    if (group.length > 1) {
      // Calculate similarities within group
      const withSimilarity = group.map(player => ({
        ...player,
        normalized: normalizedName
      }));
      
      duplicateGroups.push({
        normalizedName,
        players: withSimilarity,
        count: group.length
      });
    }
  });
  
  // Also check for similar names (not exact normalized matches)
  const similarGroups = [];
  const processedPairs = new Set();
  
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const p1 = players[i];
      const p2 = players[j];
      
      // Skip if already in a duplicate group
      const inDuplicateGroup = duplicateGroups.some(group => 
        group.players.some(p => p.id === p1.id || p.id === p2.id)
      );
      if (inDuplicateGroup) continue;
      
      // Skip if already processed
      const pairKey = [p1.id, p2.id].sort().join('-');
      if (processedPairs.has(pairKey)) continue;
      
      const similarity = calculateSimilarity(
        p1.name.toLowerCase(),
        p2.name.toLowerCase()
      );
      
      // High similarity threshold (85%)
      if (similarity >= 0.85) {
        processedPairs.add(pairKey);
        
        // Find or create similar group
        let existingGroup = similarGroups.find(g => 
          g.players.some(p => p.id === p1.id || p.id === p2.id)
        );
        
        if (existingGroup) {
          if (!existingGroup.players.some(p => p.id === p1.id)) {
            existingGroup.players.push({ ...p1, similarity });
          }
          if (!existingGroup.players.some(p => p.id === p2.id)) {
            existingGroup.players.push({ ...p2, similarity });
          }
        } else {
          similarGroups.push({
            normalizedName: `similar_${normalizeName(p1.name)}`,
            players: [
              { ...p1, similarity },
              { ...p2, similarity }
            ],
            count: 2,
            type: 'similar'
          });
        }
      }
    }
  }
  
  return {
    exact: duplicateGroups,
    similar: similarGroups,
    total: duplicateGroups.length + similarGroups.length
  };
}

// Display duplicate group and ask for action
async function reviewDuplicateGroup(group, index, total) {
  console.log('\n' + '='.repeat(80));
  console.log(`📋 Duplicate Group ${index + 1} of ${total}`);
  console.log('='.repeat(80));
  console.log(`Type: ${group.type === 'similar' ? '🔄 Similar Names' : '✅ Exact Match (normalized)'}`);
  console.log(`Players in group: ${group.count}\n`);
  
  // Display all players in group
  group.players.forEach((player, i) => {
    console.log(`[${i + 1}] ${player.name}`);
    console.log(`    ID: ${player.player_id}`);
    console.log(`    Firebase Doc ID: ${player.id}`);
    if (player.display_name && player.display_name !== player.name) {
      console.log(`    Display Name: ${player.display_name}`);
    }
    if (player.email) console.log(`    Email: ${player.email}`);
    if (player.phone) console.log(`    Phone: ${player.phone}`);
    if (player.similarity) {
      console.log(`    Similarity: ${(player.similarity * 100).toFixed(1)}%`);
    }
    console.log(`    Created: ${player.created_at?._seconds ? new Date(player.created_at._seconds * 1000).toLocaleString() : 'Unknown'}`);
    console.log('');
  });
  
  console.log('\nOptions:');
  console.log('  [1-' + group.count + '] - Select player to KEEP (others will be merged into this one)');
  console.log('  [s] - Skip this group (no changes)');
  console.log('  [q] - Quit script');
  
  const answer = await question('\nYour choice: ');
  
  if (answer.toLowerCase() === 'q') {
    return { action: 'quit' };
  }
  
  if (answer.toLowerCase() === 's') {
    return { action: 'skip' };
  }
  
  const selectedIndex = parseInt(answer) - 1;
  if (selectedIndex >= 0 && selectedIndex < group.players.length) {
    const keepPlayer = group.players[selectedIndex];
    const mergePlayers = group.players.filter((_, i) => i !== selectedIndex);
    
    console.log(`\n✅ Will KEEP: ${keepPlayer.name} (${keepPlayer.player_id})`);
    console.log(`❌ Will MERGE & DELETE: ${mergePlayers.map(p => `${p.name} (${p.player_id})`).join(', ')}`);
    
    const confirm = await question('\nConfirm? (yes/no): ');
    if (confirm.toLowerCase() === 'yes' || confirm.toLowerCase() === 'y') {
      return { 
        action: 'merge',
        keepPlayer,
        mergePlayers
      };
    }
  }
  
  console.log('❌ Invalid choice or cancelled. Skipping...');
  return { action: 'skip' };
}

// Merge duplicate players
async function mergePlayers(keepPlayer, mergePlayers) {
  console.log('\n🔄 Starting merge process...\n');
  
  const keepPlayerId = keepPlayer.player_id;
  const mergePlayerIds = mergePlayers.map(p => p.player_id);
  
  try {
    // 1. Update Firebase realplayerstats - point to keepPlayer
    console.log('1️⃣ Updating Firebase player stats references...');
    const statsSnapshot = await db.collection('realplayerstats')
      .where('player_id', 'in', mergePlayerIds)
      .get();
    
    const batch1 = db.batch();
    statsSnapshot.forEach(doc => {
      batch1.update(doc.ref, {
        player_id: keepPlayerId,
        player_name: keepPlayer.name,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    await batch1.commit();
    console.log(`   ✅ Updated ${statsSnapshot.size} Firebase stats records\n`);
    
    // 2. Merge Neon realplayerstats table (aggregate stats if needed)
    console.log('2️⃣ Merging Neon realplayerstats table...');
    let neonStatsUpdateCount = 0;
    let neonStatsAggregatedCount = 0;
    
    for (const mergePlayerId of mergePlayerIds) {
      // Check if keepPlayer already has stats for the same tournament_id
      const existing = await tournamentSql`
        SELECT tournament_id FROM realplayerstats
        WHERE player_id = ${keepPlayerId}
      `;
      const existingTournamentIds = new Set(existing.map(r => r.tournament_id));
      
      // Get stats for merge player
      const mergeStats = await tournamentSql`
        SELECT * FROM realplayerstats
        WHERE player_id = ${mergePlayerId}
      `;
      
      for (const stat of mergeStats) {
        if (existingTournamentIds.has(stat.tournament_id)) {
          // Aggregate: add stats to existing record
          await tournamentSql`
            UPDATE realplayerstats
            SET 
              matches_played = matches_played + ${stat.matches_played || 0},
              goals = goals + ${stat.goals || 0},
              assists = assists + ${stat.assists || 0},
              clean_sheets = clean_sheets + ${stat.clean_sheets || 0},
              yellow_cards = yellow_cards + ${stat.yellow_cards || 0},
              red_cards = red_cards + ${stat.red_cards || 0},
              updated_at = NOW()
            WHERE player_id = ${keepPlayerId} AND tournament_id = ${stat.tournament_id}
          `;
          neonStatsAggregatedCount++;
          
          // Delete the duplicate stat record
          await tournamentSql`
            DELETE FROM realplayerstats
            WHERE player_id = ${mergePlayerId} AND tournament_id = ${stat.tournament_id}
          `;
        } else {
          // No conflict: just update player_id
          await tournamentSql`
            UPDATE realplayerstats
            SET 
              player_id = ${keepPlayerId},
              player_name = ${keepPlayer.name},
              updated_at = NOW()
            WHERE player_id = ${mergePlayerId} AND tournament_id = ${stat.tournament_id}
          `;
          neonStatsUpdateCount++;
        }
      }
    }
    console.log(`   ✅ Updated ${neonStatsUpdateCount} stats records`);
    console.log(`   ✅ Aggregated ${neonStatsAggregatedCount} stats records (merged duplicates)\n`);
    
    // 2b. Update Neon player_awards table
    console.log('2️⃣b Updating Neon player_awards table...');
    let neonAwardsUpdateCount = 0;
    
    for (const mergePlayerId of mergePlayerIds) {
      try {
        const result = await tournamentSql`
          UPDATE player_awards
          SET 
            player_id = ${keepPlayerId},
            player_name = ${keepPlayer.name},
            updated_at = NOW()
          WHERE player_id = ${mergePlayerId}
        `;
        neonAwardsUpdateCount += result.count || 0;
      } catch (err) {
        // Table might not exist or be empty, that's okay
        console.log(`   ⚠️  Could not update player_awards (table might not exist)`);
      }
    }
    if (neonAwardsUpdateCount > 0) {
      console.log(`   ✅ Updated ${neonAwardsUpdateCount} player_awards records\n`);
    } else {
      console.log(`   ✅ No player_awards records to update\n`);
    }
    
    // 3. Delete duplicate player documents from Firebase
    console.log('3️⃣ Deleting duplicate player documents from Firebase...');
    const batch2 = db.batch();
    mergePlayers.forEach(player => {
      const docRef = db.collection('realplayers').doc(player.id);
      batch2.delete(docRef);
    });
    await batch2.commit();
    console.log(`   ✅ Deleted ${mergePlayers.length} duplicate player(s)\n`);
    
    console.log('✅ Merge complete!\n');
    return true;
  } catch (error) {
    console.error('❌ Error during merge:', error);
    return false;
  }
}

// Main execution
async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🔧 DUPLICATE PLAYER MERGER');
  console.log('='.repeat(80));
  console.log('\nThis script will help you identify and merge duplicate players.');
  console.log('You will review each duplicate group and choose which player to keep.\n');
  
  const proceed = await question('Continue? (yes/no): ');
  if (proceed.toLowerCase() !== 'yes' && proceed.toLowerCase() !== 'y') {
    console.log('❌ Cancelled.');
    rl.close();
    process.exit(0);
  }
  
  // Find duplicates
  const { exact, similar, total } = await findDuplicates();
  
  if (total === 0) {
    console.log('\n✅ No duplicate players found! Database is clean.\n');
    rl.close();
    process.exit(0);
  }
  
  console.log(`\n📊 Found ${total} duplicate groups:`);
  console.log(`   - ${exact.length} exact matches (normalized names)`);
  console.log(`   - ${similar.length} similar names (>85% similarity)`);
  
  const allGroups = [...exact, ...similar];
  let mergedCount = 0;
  let skippedCount = 0;
  
  // Review each group
  for (let i = 0; i < allGroups.length; i++) {
    const group = allGroups[i];
    const result = await reviewDuplicateGroup(group, i, total);
    
    if (result.action === 'quit') {
      console.log('\n👋 Exiting...\n');
      break;
    }
    
    if (result.action === 'skip') {
      skippedCount++;
      continue;
    }
    
    if (result.action === 'merge') {
      const success = await mergePlayers(result.keepPlayer, result.mergePlayers);
      if (success) {
        mergedCount++;
      }
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 MERGE SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total duplicate groups: ${total}`);
  console.log(`Merged: ${mergedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log('='.repeat(80) + '\n');
  
  rl.close();
  process.exit(0);
}

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error);
  rl.close();
  process.exit(1);
});
