/**
 * Verify TM Asgardians S17 Document is Complete
 */

require('dotenv').config({ path: '.env.local' });

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });
  } else {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    admin.initializeApp({ projectId });
  }
}

const db = admin.firestore();

async function verifyComplete() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║      VERIFY TM ASGARDIANS S17 DOCUMENT                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    const doc = await db.collection('team_seasons')
      .doc('SSPSLT0005_SSPSLS17')
      .get();

    if (!doc.exists) {
      console.log('❌ Document not found!\n');
      return;
    }

    const data = doc.data();
    
    console.log('📋 DOCUMENT FIELDS\n');
    console.log(`Total fields: ${Object.keys(data).length}\n`);

    // Core fields
    console.log('🔑 CORE IDENTIFIERS:');
    console.log(`   team_id: ${data.team_id}`);
    console.log(`   team_name: ${data.team_name}`);
    console.log(`   season_id: ${data.season_id}`);
    console.log(`   status: ${data.status}\n`);

    // Contract fields
    console.log('📝 CONTRACT INFO:');
    console.log(`   contract_id: ${data.contract_id}`);
    console.log(`   contract_start_season: ${data.contract_start_season}`);
    console.log(`   contract_end_season: ${data.contract_end_season}`);
    console.log(`   contract_length: ${data.contract_length}\n`);

    // Budget fields
    console.log('💰 BUDGET INFO:');
    console.log(`   football_budget: ${data.football_budget} eCoin`);
    console.log(`   football_starting_balance: ${data.football_starting_balance} eCoin`);
    console.log(`   football_spent: ${data.football_spent} eCoin`);
    console.log(`   real_player_budget: ${data.real_player_budget} SSCoin`);
    console.log(`   real_player_starting_balance: ${data.real_player_starting_balance} SSCoin`);
    console.log(`   real_player_spent: ${data.real_player_spent} SSCoin`);
    console.log(`   total_spent: ${data.total_spent}\n`);

    // Count fields
    console.log('📊 COUNTS:');
    console.log(`   players_count: ${data.players_count}`);
    console.log(`   transfers_used: ${data.transfers_used}`);
    console.log(`   football_swap_count: ${data.football_swap_count}`);
    console.log(`   penalty_amount: ${data.penalty_amount}`);
    console.log(`   skipped_seasons: ${data.skipped_seasons}\n`);

    // Team info
    console.log('👥 TEAM INFO:');
    console.log(`   owner_name: ${data.owner_name}`);
    console.log(`   team_email: ${data.team_email}`);
    console.log(`   username: ${data.username}`);
    console.log(`   user_id: ${data.user_id}`);
    console.log(`   team_logo: ${data.team_logo ? 'Set' : 'Not set'}\n`);

    // System fields
    console.log('⚙️  SYSTEM:');
    console.log(`   currency_system: ${data.currency_system}`);
    console.log(`   is_auto_registered: ${data.is_auto_registered}`);
    console.log(`   last_played_season: ${data.last_played_season}`);
    console.log(`   last_salary_deduction: ${data.last_salary_deduction ? 'Set' : 'Not set'}\n`);

    // Position counts
    console.log('🎯 POSITION COUNTS:');
    if (data.position_counts) {
      const positions = Object.entries(data.position_counts)
        .filter(([_, count]) => count > 0)
        .map(([pos, count]) => `${pos}: ${count}`)
        .join(', ');
      console.log(`   ${positions || 'All positions: 0'}\n`);
    } else {
      console.log('   Not set\n');
    }

    // Timestamps
    console.log('🕐 TIMESTAMPS:');
    console.log(`   created_at: ${data.created_at ? new Date(data.created_at.toDate()).toLocaleString() : 'Not set'}`);
    console.log(`   updated_at: ${data.updated_at ? new Date(data.updated_at.toDate()).toLocaleString() : 'Not set'}`);
    console.log(`   joined_at: ${data.joined_at ? new Date(data.joined_at.toDate()).toLocaleString() : 'Not set'}\n`);

    // Check for missing critical fields
    const criticalFields = [
      'team_id', 'team_name', 'season_id', 'contract_id', 'contract_start_season',
      'contract_end_season', 'contract_length', 'football_budget', 'real_player_budget',
      'football_starting_balance', 'real_player_starting_balance', 'currency_system',
      'status', 'owner_name', 'position_counts'
    ];

    const missingFields = criticalFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      console.log('⚠️  MISSING CRITICAL FIELDS:');
      missingFields.forEach(field => console.log(`   - ${field}`));
      console.log('');
    } else {
      console.log('✅ All critical fields present!\n');
    }

  } catch (error) {
    console.error('\n❌ Error during verification:', error);
    throw error;
  }
}

verifyComplete()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
