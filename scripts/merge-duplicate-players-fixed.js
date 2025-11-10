require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const { neon } = require('@neondatabase/serverless');
const readline = require('readline');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();
console.log('✅ Firebase Admin initialized');

// Initialize Neon
const tournamentSql = neon(process.env.NEON_TOURNAMENT_DB_URL);
console.log('✅ Neon Tournament DB initialized');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// Normalize name for comparison
function normalizeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Calculate Levenshtein distance
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

// Find duplicate players
async function findDuplicates() {
  console.log('\n🔍 Scanning for duplicate players...\n');
  
  const playersSnapshot = await db.collection('realplayers').get();
  const players = [];
  
  playersSnapshot.forEach(doc => {
    const data = doc.data();
    players.push({
      id: doc.id,
      player_id: data.player_id,
      name: data.name,
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
  
  // Find exact matches
  const exactMatches = [];
  for (const [normalized, group] of nameGroups) {
    if (group.length > 1) {
      exactMatches.push({
        type: 'exact',
        normalizedName: normalized,
        players: group,
        count: group.length
      });
    }
  }
  
  // Find similar names (>85% similarity)
  const similarMatches = [];
  const processedPairs = new Set();
  
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const p1 = players[i];
      const p2 = players[j];
      
      // Skip if already in exact match group
      if (normalizeName(p1.name) === normalizeName(p2.name)) continue;
      
      const pairKey = [p1.player_id, p2.player_id].sort().join('-');
      if (processedPairs.has(pairKey)) continue;
      
      const maxLen = Math.max(p1.name.length, p2.name.length);
      const distance = levenshteinDistance(p1.name.toLowerCase(), p2.name.toLowerCase());
      const similarity = 1 - (distance / maxLen);
      
      if (similarity > 0.50) {
        processedPairs.add(pairKey);
        
        // Check if either player is already in a similar group
        let foundGroup = similarMatches.find(g => 
          g.players.some(p => p.player_id === p1.player_id || p.player_id === p2.player_id)
        );
        
        if (foundGroup) {
          // Add to existing group
          if (!foundGroup.players.some(p => p.player_id === p1.player_id)) {
            foundGroup.players.push({ ...p1, similarity });
            foundGroup.count++;
          }
          if (!foundGroup.players.some(p => p.player_id === p2.player_id)) {
            foundGroup.players.push({ ...p2, similarity });
            foundGroup.count++;
          }
        } else {
          // Create new group
          similarMatches.push({
            type: 'similar',
            players: [
              { ...p1, similarity },
              { ...p2, similarity }
            ],
            count: 2
          });
        }
      }
    }
  }
  
  console.log(`\n📊 Found ${exactMatches.length + similarMatches.length} duplicate groups:`);
  console.log(`   - ${exactMatches.length} exact matches (normalized names)`);
  console.log(`   - ${similarMatches.length} similar names (>50% similarity)`);
  
  return {
    exact: exactMatches,
    similar: similarMatches,
    total: exactMatches.length + similarMatches.length
  };
}

// Review duplicate group
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
  console.log('  [1,2,3] - Select specific players to merge (e.g., "9,10" to merge just #9 and #10)');
  console.log('  [s] - Skip this group (no changes)');
  console.log('  [q] - Quit script');
  
  const answer = await question('\nYour choice: ');
  
  if (answer.toLowerCase() === 'q') {
    return { action: 'quit' };
  }
  
  if (answer.toLowerCase() === 's') {
    return { action: 'skip' };
  }
  
  // Check if it's a comma-separated list (subset merge)
  if (answer.includes(',')) {
    const selectedIndices = answer.split(',').map(n => parseInt(n.trim()) - 1);
    const validIndices = selectedIndices.filter(i => i >= 0 && i < group.players.length);
    
    if (validIndices.length < 2) {
      console.log('❌ Need at least 2 players to merge. Skipping...');
      return { action: 'skip' };
    }
    
    const selectedPlayers = validIndices.map(i => group.players[i]);
    
    console.log('\n📋 Selected players to merge:');
    selectedPlayers.forEach((p, i) => {
      console.log(`  [${i + 1}] ${p.name} (${p.player_id})`);
    });
    
    const keepChoice = await question('\nWhich one to KEEP? [1-' + selectedPlayers.length + ']: ');
    const keepIndex = parseInt(keepChoice) - 1;
    
    if (keepIndex >= 0 && keepIndex < selectedPlayers.length) {
      const keepPlayer = selectedPlayers[keepIndex];
      const mergePlayers = selectedPlayers.filter((_, i) => i !== keepIndex);
      
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
  
  // Single number - merge all into selected one
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
    let neonStatsAggregated = 0;
    let neonStatsDeleted = 0;
    
    for (const mergePlayerId of mergePlayerIds) {
      // Check if keepPlayer already has stats for the same (season_id, tournament_id)
      const existing = await tournamentSql`
        SELECT season_id, tournament_id FROM realplayerstats
        WHERE player_id = ${keepPlayerId}
      `;
      const existingKeys = new Set(existing.map(r => `${r.season_id}_${r.tournament_id}`));
      
      // Get stats for merge player
      const mergeStats = await tournamentSql`
        SELECT * FROM realplayerstats
        WHERE player_id = ${mergePlayerId}
      `;
      
      for (const stat of mergeStats) {
        const key = `${stat.season_id}_${stat.tournament_id}`;
        
        if (existingKeys.has(key)) {
          // Aggregate: add stats to existing record
          await tournamentSql`
            UPDATE realplayerstats
            SET 
              matches_played = COALESCE(matches_played, 0) + COALESCE(${stat.matches_played}, 0),
              matches_won = COALESCE(matches_won, 0) + COALESCE(${stat.matches_won}, 0),
              matches_drawn = COALESCE(matches_drawn, 0) + COALESCE(${stat.matches_drawn}, 0),
              matches_lost = COALESCE(matches_lost, 0) + COALESCE(${stat.matches_lost}, 0),
              goals_scored = COALESCE(goals_scored, 0) + COALESCE(${stat.goals_scored}, 0),
              goals_conceded = COALESCE(goals_conceded, 0) + COALESCE(${stat.goals_conceded}, 0),
              assists = COALESCE(assists, 0) + COALESCE(${stat.assists}, 0),
              clean_sheets = COALESCE(clean_sheets, 0) + COALESCE(${stat.clean_sheets}, 0),
              wins = COALESCE(wins, 0) + COALESCE(${stat.wins}, 0),
              draws = COALESCE(draws, 0) + COALESCE(${stat.draws}, 0),
              losses = COALESCE(losses, 0) + COALESCE(${stat.losses}, 0),
              motm_awards = COALESCE(motm_awards, 0) + COALESCE(${stat.motm_awards}, 0),
              points = COALESCE(points, 0) + COALESCE(${stat.points}, 0),
              updated_at = NOW()
            WHERE player_id = ${keepPlayerId} 
              AND season_id = ${stat.season_id}
              AND tournament_id = ${stat.tournament_id}
          `;
          neonStatsAggregated++;
          
          // Delete the duplicate stat record
          await tournamentSql`
            DELETE FROM realplayerstats
            WHERE player_id = ${mergePlayerId} 
              AND season_id = ${stat.season_id}
              AND tournament_id = ${stat.tournament_id}
          `;
          neonStatsDeleted++;
        } else {
          // No conflict: just update player_id, player_name, and id
          const newId = `${keepPlayerId}_${stat.season_id}`;
          await tournamentSql`
            UPDATE realplayerstats
            SET 
              id = ${newId},
              player_id = ${keepPlayerId},
              player_name = ${keepPlayer.name},
              updated_at = NOW()
            WHERE player_id = ${mergePlayerId} 
              AND season_id = ${stat.season_id}
              AND tournament_id = ${stat.tournament_id}
          `;
        }
      }
    }
    console.log(`   ✅ Aggregated ${neonStatsAggregated} stats records (merged duplicates)`);
    console.log(`   ✅ Deleted ${neonStatsDeleted} duplicate stats records\n`);
    
    // 3. Update Neon player_awards table
    console.log('3️⃣ Updating Neon player_awards table...');
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
        console.log(`   ⚠️  Could not update player_awards (table might not exist)`);
      }
    }
    if (neonAwardsUpdateCount > 0) {
      console.log(`   ✅ Updated ${neonAwardsUpdateCount} player_awards records\n`);
    } else {
      console.log(`   ✅ No player_awards records to update\n`);
    }
    
    // 4. Delete duplicate player documents from Firebase
    console.log('4️⃣ Deleting duplicate player documents from Firebase...');
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
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Merged: ${mergedCount} group(s)`);
  console.log(`⏭️  Skipped: ${skippedCount} group(s)`);
  console.log('='.repeat(80) + '\n');
  
  rl.close();
  process.exit(0);
}

main();
