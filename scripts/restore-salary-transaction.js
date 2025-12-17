/**
 * Script to restore accidentally deleted salary transactions
 * 
 * Usage: node scripts/restore-salary-transaction.js
 */

require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

async function restoreSalaryTransaction() {
  try {
    console.log('🔄 Restoring salary transaction...\n');

    // EDIT THESE VALUES TO MATCH YOUR DELETED TRANSACTION
    const transactionData = {
      team_id: 'SSPSLT0002',
      season_id: 'SSPSLS16',
      transaction_type: 'salary_payment',
      currency_type: 'real_player',
      amount: -0.28,
      balance_before: 129.85999999999996,
      balance_after: 129.57999999999996,
      description: 'Salary: Ajas',
      metadata: {
        fixture_id: 'SSPSLS16L_leg1_r2_m6',
        player_count: 1,
        salary_amount: 0.28,
        player_id: 'sspslpsl0062', // CHANGE THIS
        player_name: 'Ajas', // CHANGE THIS
      },
      created_at: admin.firestore.Timestamp.now(),
      updated_at: admin.firestore.Timestamp.now(),
    };

    // Add the transaction
    const docRef = await db.collection('transactions').add(transactionData);
    
    console.log('✅ Transaction restored with ID:', docRef.id);
    console.log('📋 Transaction data:', transactionData);
    
  } catch (error) {
    console.error('❌ Error restoring transaction:', error);
  }
}

restoreSalaryTransaction();
