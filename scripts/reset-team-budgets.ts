/**
 * Reset Team Budgets Script
 * 
 * Resets all teams to:
 * - football_budget: £10,000
 * - football_spent: £0
 * 
 * Updates both:
 * 1. Firebase team_seasons collection
 * 2. Neon teams table
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { neon } from '@neondatabase/serverless';
import * as admin from 'firebase-admin';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

// Initialize Firebase Admin (Firestore only)
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
    console.log('Firebase Admin initialized with service account');
  } else if (projectId) {
    admin.initializeApp({
      projectId: projectId,
    });
    console.log(`Firebase Admin initialized with project ID: ${projectId}`);
  } else {
    admin.initializeApp();
    console.log('Firebase Admin initialized with default credentials');
  }
}

const adminDb = admin.firestore();

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

async function resetTeamBudgets() {
  console.log('🔄 Starting budget reset...\n');

  try {
    // ===== PART 1: Reset Neon Database =====
    console.log('📊 Resetting Neon database...');
    
    const neonResult = await sql`
      UPDATE teams
      SET 
        football_budget = 10000,
        football_spent = 0,
        updated_at = NOW()
      WHERE season_id IS NOT NULL
      RETURNING id, name, season_id
    `;

    console.log(`✅ Updated ${neonResult.length} teams in Neon database`);
    
    if (neonResult.length > 0) {
      console.log('\nNeon teams updated:');
      neonResult.forEach(team => {
        console.log(`   - ${team.name} (${team.id}) - Season: ${team.season_id}`);
      });
    }

    // ===== PART 2: Reset Firebase team_seasons =====
    console.log('\n🔥 Resetting Firebase team_seasons collection...');
    
    const teamSeasonsSnapshot = await adminDb.collection('team_seasons').get();
    
    if (teamSeasonsSnapshot.empty) {
      console.log('⚠️  No team_seasons found in Firebase');
    } else {
      let firebaseCount = 0;
      const batch = adminDb.batch();
      
      teamSeasonsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const updates: any = {
          football_budget: 10000,
          football_spent: 0,
          players_count: 0,
          total_spent: 0,
          position_counts: {
            GK: 0,
            CB: 0,
            LB: 0,
            RB: 0,
            DMF: 0,
            CMF: 0,
            LMF: 0,
            RMF: 0,
            AMF: 0,
            LWF: 0,
            RWF: 0,
            SS: 0,
            CF: 0
          },
          updated_at: new Date()
        };
        
        // Also update budget if single currency system
        if (data.currency_system === 'single') {
          updates.budget = 10000;
        }
        
        batch.update(doc.ref, updates);
        firebaseCount++;
      });
      
      await batch.commit();
      console.log(`✅ Updated ${firebaseCount} team_seasons in Firebase`);
      
      console.log('\nFirebase team_seasons updated:');
      teamSeasonsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log(`   - ${data.team_name || doc.id} (${data.currency_system || 'single'} currency)`);
      });
    }

    // ===== PART 3: Verification =====
    console.log('\n🔍 Verifying updates...');
    
    // Check Neon
    const neonCheck = await sql`
      SELECT 
        COUNT(*) as total_teams,
        SUM(CASE WHEN football_budget = 10000 THEN 1 ELSE 0 END) as correct_budget,
        SUM(CASE WHEN football_spent = 0 THEN 1 ELSE 0 END) as correct_spent
      FROM teams
      WHERE season_id IS NOT NULL
    `;
    
    const neonStats = neonCheck[0];
    console.log(`\nNeon Stats:`);
    console.log(`   Total teams: ${neonStats.total_teams}`);
    console.log(`   Correct budget (£10,000): ${neonStats.correct_budget}`);
    console.log(`   Correct spent (£0): ${neonStats.correct_spent}`);
    
    if (neonStats.total_teams === neonStats.correct_budget && 
        neonStats.total_teams === neonStats.correct_spent) {
      console.log('   ✅ All Neon teams have correct values!');
    } else {
      console.log('   ⚠️  Some Neon teams may have incorrect values');
    }
    
    // Check Firebase
    const firebaseCheckSnapshot = await adminDb.collection('team_seasons')
      .where('football_budget', '==', 10000)
      .get();
    
    console.log(`\nFirebase Stats:`);
    console.log(`   Teams with £10,000 budget: ${firebaseCheckSnapshot.size}`);
    console.log(`   Total team_seasons: ${teamSeasonsSnapshot.size}`);
    
    if (firebaseCheckSnapshot.size === teamSeasonsSnapshot.size) {
      console.log('   ✅ All Firebase teams have correct values!');
    } else {
      console.log('   ⚠️  Some Firebase teams may have incorrect values');
    }

    console.log('\n🎉 Budget reset complete!\n');
    console.log('Summary:');
    console.log(`   - Neon teams updated: ${neonResult.length}`);
    console.log(`   - Firebase team_seasons updated: ${teamSeasonsSnapshot.size}`);
    console.log(`   - New budget: £10,000`);
    console.log(`   - New spent: £0`);

  } catch (error) {
    console.error('❌ Error resetting budgets:', error);
    throw error;
  }
}

// Run the script
resetTeamBudgets()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
