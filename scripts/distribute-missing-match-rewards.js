/**
 * Distribute missing match rewards for completed fixtures
 * This script finds all completed fixtures that don't have match reward transactions
 * and distributes the rewards based on tournament configuration
 */

const admin = require('firebase-admin');
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
if (!admin.apps.length) {
  if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    console.log('✅ Firebase Admin initialized\n');
  } else {
    admin.initializeApp();
    console.log('✅ Firebase Admin initialized with default credentials\n');
  }
}

const db = admin.firestore();
const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function distributeRewards() {
  try {
    const seasonId = process.argv[2] || 'SSPSLS16';
    
    console.log(`🎁 Distributing missing match rewards for season ${seasonId}\n`);
    
    // Get all completed fixtures for this season
    const fixtures = await sql`
      SELECT id, home_team_id, away_team_id, tournament_id, round_number, leg, result, home_score, away_score
      FROM fixtures
      WHERE season_id = ${seasonId}
      AND status = 'completed'
      AND result IS NOT NULL
      ORDER BY round_number ASC
    `;
    
    console.log(`Found ${fixtures.length} completed fixtures\n`);
    
    // Get existing reward transactions
    const existingRewardsSnapshot = await db.collection('transactions')
      .where('transaction_type', '==', 'match_reward')
      .where('season_id', '==', seasonId)
      .get();
    
    const fixturesWithRewards = new Set();
    existingRewardsSnapshot.docs.forEach(doc => {
      const metadata = doc.data().metadata || {};
      if (metadata.fixture_id) {
        fixturesWithRewards.add(metadata.fixture_id);
      }
    });
    
    console.log(`${fixturesWithRewards.size} fixtures already have rewards\n`);
    
    // Get tournament rewards configuration from Firebase
    const tournamentsSnapshot = await db.collection('tournaments').get();
    
    const tournamentRewards = new Map();
    tournamentsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.rewards && data.rewards.match_results) {
        tournamentRewards.set(doc.id, data.rewards.match_results);
      }
    });
    
    let rewardsDistributed = 0;
    let skipped = 0;
    
    for (const fixture of fixtures) {
      // Skip if already has rewards
      if (fixturesWithRewards.has(fixture.id)) {
        skipped++;
        continue;
      }
      
      const rewards = tournamentRewards.get(fixture.tournament_id);
      if (!rewards) {
        console.log(`⏭️  Skipping ${fixture.id} - no rewards configured for tournament`);
        skipped++;
        continue;
      }
      
      console.log(`\n📋 Processing fixture: ${fixture.id}`);
      console.log(`   Round ${fixture.round_number}, Result: ${fixture.result}`);
      console.log(`   Score: ${fixture.home_score}-${fixture.away_score}`);
      
      // Determine rewards based on result
      let homeECoin = 0, homeSSCoin = 0, awayECoin = 0, awaySSCoin = 0;
      let homeResult = '', awayResult = '';
      
      if (fixture.result === 'home_win') {
        homeECoin = rewards.win_ecoin || 0;
        homeSSCoin = rewards.win_sscoin || 0;
        awayECoin = rewards.loss_ecoin || 0;
        awaySSCoin = rewards.loss_sscoin || 0;
        homeResult = 'Win';
        awayResult = 'Loss';
      } else if (fixture.result === 'away_win') {
        homeECoin = rewards.loss_ecoin || 0;
        homeSSCoin = rewards.loss_sscoin || 0;
        awayECoin = rewards.win_ecoin || 0;
        awaySSCoin = rewards.win_sscoin || 0;
        homeResult = 'Loss';
        awayResult = 'Win';
      } else if (fixture.result === 'draw') {
        homeECoin = rewards.draw_ecoin || 0;
        homeSSCoin = rewards.draw_sscoin || 0;
        awayECoin = rewards.draw_ecoin || 0;
        awaySSCoin = rewards.draw_sscoin || 0;
        homeResult = 'Draw';
        awayResult = 'Draw';
      }
      
      // Distribute to home team
      if (homeECoin > 0 || homeSSCoin > 0) {
        const teamSeasonDocId = `${fixture.home_team_id}_${seasonId}`;
        const teamSeasonRef = db.collection('team_seasons').doc(teamSeasonDocId);
        const teamSeasonDoc = await teamSeasonRef.get();
        
        if (teamSeasonDoc.exists) {
          const currentFootballBudget = teamSeasonDoc.data()?.football_budget || 0;
          const currentRealBudget = teamSeasonDoc.data()?.real_player_budget || 0;
          
          await teamSeasonRef.update({
            football_budget: currentFootballBudget + homeECoin,
            real_player_budget: currentRealBudget + homeSSCoin,
            updated_at: new Date()
          });
          
          await db.collection('transactions').add({
            team_id: fixture.home_team_id,
            season_id: seasonId,
            transaction_type: 'match_reward',
            currency_type: 'mixed',
            amount: homeECoin,
            amount_real: homeSSCoin,
            description: `Match Reward (${homeResult}) - Round ${fixture.round_number}${fixture.leg > 1 ? ' Leg ' + fixture.leg : ''} - Fixture: ${fixture.id}`,
            created_at: new Date(),
            updated_at: new Date(),
            metadata: {
              fixture_id: fixture.id,
              round_number: fixture.round_number,
              leg: fixture.leg,
              result: homeResult,
              ecoin: homeECoin,
              sscoin: homeSSCoin,
              retroactive: true
            }
          });
          
          console.log(`   ✅ Home team: +${homeECoin} eCoin, +${homeSSCoin} SSCoin`);
          rewardsDistributed++;
        }
      }
      
      // Distribute to away team
      if (awayECoin > 0 || awaySSCoin > 0) {
        const teamSeasonDocId = `${fixture.away_team_id}_${seasonId}`;
        const teamSeasonRef = db.collection('team_seasons').doc(teamSeasonDocId);
        const teamSeasonDoc = await teamSeasonRef.get();
        
        if (teamSeasonDoc.exists) {
          const currentFootballBudget = teamSeasonDoc.data()?.football_budget || 0;
          const currentRealBudget = teamSeasonDoc.data()?.real_player_budget || 0;
          
          await teamSeasonRef.update({
            football_budget: currentFootballBudget + awayECoin,
            real_player_budget: currentRealBudget + awaySSCoin,
            updated_at: new Date()
          });
          
          await db.collection('transactions').add({
            team_id: fixture.away_team_id,
            season_id: seasonId,
            transaction_type: 'match_reward',
            currency_type: 'mixed',
            amount: awayECoin,
            amount_real: awaySSCoin,
            description: `Match Reward (${awayResult}) - Round ${fixture.round_number}${fixture.leg > 1 ? ' Leg ' + fixture.leg : ''} - Fixture: ${fixture.id}`,
            created_at: new Date(),
            updated_at: new Date(),
            metadata: {
              fixture_id: fixture.id,
              round_number: fixture.round_number,
              leg: fixture.leg,
              result: awayResult,
              ecoin: awayECoin,
              sscoin: awaySSCoin,
              retroactive: true
            }
          });
          
          console.log(`   ✅ Away team: +${awayECoin} eCoin, +${awaySSCoin} SSCoin`);
          rewardsDistributed++;
        }
      }
    }
    
    console.log(`\n✅ COMPLETE!`);
    console.log(`   Rewards distributed: ${rewardsDistributed}`);
    console.log(`   Skipped: ${skipped}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

distributeRewards();
