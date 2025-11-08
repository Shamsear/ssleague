import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { neon } from '@neondatabase/serverless';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  
  if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }
}

const adminDb = admin.firestore();
const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

async function fixDuplicates() {
  console.log('🔧 Fixing duplicate player allocations...\n');

  const roundId = 'SSPSLFR00002'; // LWF round
  const seasonId = 'SSPSLS16';

  // Get all allocations for this round
  const allocations = await sql`
    SELECT team_id, player_id, purchase_price
    FROM team_players
    WHERE round_id = ${roundId}
    ORDER BY team_id, player_id
  `;

  console.log(`Found ${allocations.length} total allocations\n`);

  // Group by team
  const byTeam = new Map<string, any[]>();
  allocations.forEach(a => {
    if (!byTeam.has(a.team_id)) {
      byTeam.set(a.team_id, []);
    }
    byTeam.get(a.team_id)!.push(a);
  });

  // Find teams with duplicates
  const teamsWithDuplicates: string[] = [];
  byTeam.forEach((players, teamId) => {
    if (players.length > 1) {
      teamsWithDuplicates.push(teamId);
      console.log(`❌ ${teamId}: ${players.length} players (should be 1)`);
    }
  });

  if (teamsWithDuplicates.length === 0) {
    console.log('✅ No duplicates found!');
    return;
  }

  console.log(`\n🔄 Fixing ${teamsWithDuplicates.length} teams...\n`);

  for (const teamId of teamsWithDuplicates) {
    const players = byTeam.get(teamId)!;
    
    // Keep the first player, remove the rest
    const keepPlayer = players[0];
    const removePlayerIds = players.slice(1).map(p => p.player_id);
    
    console.log(`\nTeam ${teamId}:`);
    console.log(`  ✅ Keeping player ${keepPlayer.player_id} (£${keepPlayer.purchase_price})`);
    console.log(`  ❌ Removing ${removePlayerIds.length} duplicate players`);

    // Calculate refund amount
    const refundAmount = players.slice(1).reduce((sum, p) => sum + Number(p.purchase_price), 0);
    
    // 1. Delete extra players from team_players
    for (const playerId of removePlayerIds) {
      await sql`
        DELETE FROM team_players
        WHERE team_id = ${teamId}
        AND player_id = ${playerId}
        AND round_id = ${roundId}
      `;
      console.log(`     - Deleted player ${playerId}`);
    }

    // 2. Reset extra players in footballplayers table
    await sql`
      UPDATE footballplayers
      SET 
        is_sold = false,
        team_id = NULL,
        acquisition_value = NULL,
        season_id = NULL,
        round_id = NULL,
        status = 'available',
        contract_id = NULL,
        contract_start_season = NULL,
        contract_end_season = NULL,
        contract_length = NULL,
        updated_at = NOW()
      WHERE id = ANY(${removePlayerIds})
    `;

    // 3. Refund team budget (Firebase)
    try {
      const tsRef = adminDb.collection('team_seasons').doc(`${teamId}_${seasonId}`);
      const tsDoc = await tsRef.get();
      
      if (tsDoc.exists) {
        const data = tsDoc.data();
        const curr = data?.currency_system || 'single';
        const updates: any = {
          total_spent: Math.max(0, (data?.total_spent || 0) - refundAmount),
          players_count: (data?.players_count || players.length) - removePlayerIds.length,
          updated_at: new Date()
        };
        
        if (curr === 'dual') {
          updates.football_budget = (data?.football_budget || 0) + refundAmount;
          updates.football_spent = Math.max(0, (data?.football_spent || 0) - refundAmount);
        } else {
          updates.budget = (data?.budget || 0) + refundAmount;
        }
        
        await tsRef.update(updates);
        console.log(`     ✅ Refunded £${refundAmount} to Firebase`);
      }
    } catch (err) {
      console.error(`     ❌ Firebase refund failed:`, err);
    }

    // 4. Refund team budget (Neon)
    try {
      await sql`
        UPDATE teams
        SET 
          football_spent = GREATEST(0, football_spent - ${refundAmount}),
          football_budget = football_budget + ${refundAmount},
          football_players_count = GREATEST(0, football_players_count - ${removePlayerIds.length}),
          updated_at = NOW()
        WHERE id = ${teamId}
        AND season_id = ${seasonId}
      `;
      console.log(`     ✅ Refunded £${refundAmount} to Neon`);
    } catch (err) {
      console.error(`     ❌ Neon refund failed:`, err);
    }
  }

  // Verify
  console.log('\n🔍 Verifying fix...\n');
  const afterAllocations = await sql`
    SELECT team_id, COUNT(*) as count
    FROM team_players
    WHERE round_id = ${roundId}
    GROUP BY team_id
    ORDER BY team_id
  `;

  afterAllocations.forEach((a: any) => {
    const status = a.count === '1' ? '✅' : '❌';
    console.log(`  ${status} ${a.team_id}: ${a.count} player(s)`);
  });

  console.log('\n🎉 Duplicate fix complete!');
}

fixDuplicates().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
