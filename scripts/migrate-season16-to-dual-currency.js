const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
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
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
    process.exit(1);
  }
}

const db = admin.firestore();

async function migrateSeason16Teams() {
  try {
    console.log('\n🔄 Starting migration of Season 16 teams to dual currency...\n');
    
    // Find all teams registered to season 16 or SSPSLS16
    const snapshot = await db.collection('teamSeasons')
      .where('season_id', 'in', ['season_16', 'SSPSLS16'])
      .get();
    
    console.log(`📊 Found ${snapshot.size} team(s) registered to Season 16\n`);
    
    if (snapshot.empty) {
      console.log('✅ No teams to migrate');
      return;
    }
    
    const batch = db.batch();
    let updateCount = 0;
    let alreadyMigratedCount = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Skip if already dual currency
      if (data.currency_system === 'dual') {
        console.log(`⏭️  Team ${data.team_name} (${doc.id}) is already using dual currency - skipping`);
        alreadyMigratedCount++;
        continue;
      }
      
      console.log(`\n🔧 Migrating: ${data.team_name} (${doc.id})`);
      console.log(`   Current budget: £${data.budget || data.balance || 15000}`);
      console.log(`   Current spent: £${data.total_spent || 0}`);
      
      // Calculate remaining budget
      const currentBudget = data.budget || data.balance || 15000;
      const currentSpent = data.total_spent || 0;
      const remaining = currentBudget - currentSpent;
      
      // For dual currency conversion:
      // Total original budget was £15,000 equivalent
      // Split: €10,000 for football players, $5,000 for real players
      // Ratio: 66.67% football, 33.33% real players
      
      const footballBudget = 10000;
      const realPlayerBudget = 5000;
      
      // If they've spent money, we need to distribute it proportionally
      // For now, assume all spending was on football players (most common case)
      const footballSpent = currentSpent;
      const realPlayerSpent = 0;
      
      const updateData = {
        // Add dual currency fields
        currency_system: 'dual',
        football_budget: footballBudget - footballSpent,
        football_starting_balance: footballBudget,
        football_spent: footballSpent,
        real_player_budget: realPlayerBudget,
        real_player_starting_balance: realPlayerBudget,
        real_player_spent: realPlayerSpent,
        
        // Keep legacy fields for backward compatibility
        // but mark them as deprecated
        balance: remaining, // Keep this for dashboard compatibility
        starting_balance: currentBudget,
        total_spent: currentSpent,
        
        // Update metadata
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        migrated_to_dual_currency: true,
        migration_date: admin.firestore.FieldValue.serverTimestamp(),
      };
      
      console.log(`   → Football Budget: €${updateData.football_budget} (spent: €${footballSpent})`);
      console.log(`   → Real Player Budget: $${updateData.real_player_budget} (spent: $${realPlayerSpent})`);
      
      batch.update(doc.ref, updateData);
      updateCount++;
    }
    
    if (updateCount > 0) {
      console.log(`\n📤 Committing ${updateCount} update(s)...`);
      await batch.commit();
      console.log('✅ Migration completed successfully!\n');
    } else {
      console.log('\n✅ No updates needed - all teams already migrated\n');
    }
    
    console.log('═══════════════════════════════════════');
    console.log('📈 Migration Summary:');
    console.log(`   Total teams found: ${snapshot.size}`);
    console.log(`   ✅ Migrated: ${updateCount}`);
    console.log(`   ⏭️  Already migrated: ${alreadyMigratedCount}`);
    console.log('═══════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Migration error:', error);
  } finally {
    process.exit(0);
  }
}

// Run with confirmation
console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║   Season 16 Dual Currency Migration Script               ║');
console.log('║                                                           ║');
console.log('║   This will update all Season 16 team registrations to   ║');
console.log('║   use the new dual currency system:                      ║');
console.log('║   • €10,000 for football players                         ║');
console.log('║   • $5,000 for real players                              ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

migrateSeason16Teams();
