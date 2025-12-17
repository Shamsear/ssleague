require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
const { neon } = require('@neondatabase/serverless');

// Use TOURNAMENT database URL for fixtures
const tournamentSql = neon(process.env.NEON_TOURNAMENT_DB_URL);
// Use AUCTION database URL for teams
const auctionSql = neon(process.env.NEON_AUCTION_DB_URL || process.env.NEON_DATABASE_URL);

// Initialize Firebase Admin
if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('FIREBASE_ADMIN_PRIVATE_KEY is not set');
  }
  
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  });
  console.log('✅ Firebase Admin initialized\n');
}

const db = admin.firestore();

async function distributeRewards() {
  try {
    const seasonId = process.argv[2] || 'SSPSLS16';
    console.log(`🎁 Distributing missing match rewards for season ${seasonId}\n`);

    // Get all completed fixtures from Tournament DB (Neon)
    const fixtures = await tournamentSql`
      SELECT 
        id,
        home_team_id,
        away_team_id,
        tournament_id,
        round_number,
        leg,
        result,
        status,
        season_id,
        home_team_name,
        away_team_name
      FROM fixtures
      WHERE season_id = ${seasonId}
        AND status = 'completed'
        AND result IS NOT NULL
      ORDER BY round_number, id
    `;

    console.log(`Found ${fixtures.length} completed fixtures\n`);

    if (fixtures.length === 0) {
      console.log('No completed fixtures found');
      return;
    }

    // Check which fixtures already have rewards in Firebase
    const transactionsSnapshot = await db.collection('transactions')
      .where('transaction_type', '==', 'match_reward')
      .get();
    
    const fixturesWithRewards = new Set();
    transactionsSnapshot.forEach(doc => {
      const description = doc.data().description || '';
      const match = description.match(/Fixture: ([A-Z0-9]+)/);
      if (match) {
        fixturesWithRewards.add(match[1]);
      }
    });

    console.log(`${fixturesWithRewards.size} fixtures already have rewards\n`);

    const fixturesNeedingRewards = fixtures.filter(f => !fixturesWithRewards.has(f.id));
    
    console.log(`${fixturesNeedingRewards.length} fixtures need rewards distributed\n`);

    if (fixturesNeedingRewards.length === 0) {
      console.log('✅ All fixtures already have rewards!');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const fixture of fixturesNeedingRewards) {
      try {
        console.log(`\n📊 Processing: ${fixture.home_team_name} vs ${fixture.away_team_name} (Round ${fixture.round_number}${fixture.leg > 1 ? ' Leg ' + fixture.leg : ''})`);
        console.log(`   Fixture ID: ${fixture.id}`);
        console.log(`   Result: ${fixture.result}`);

        // Get tournament rewards configuration
        const [tournament] = await tournamentSql`
          SELECT rewards
          FROM tournaments
          WHERE id = ${fixture.tournament_id}
          LIMIT 1
        `;

        if (!tournament || !tournament.rewards || !tournament.rewards.match_results) {
          console.log(`   ⚠️  No match rewards configured for tournament ${fixture.tournament_id}`);
          continue;
        }

        const matchRewards = tournament.rewards.match_results;

        // Determine rewards for each team
        let homeECoin = 0, homeSSCoin = 0, awayECoin = 0, awaySSCoin = 0;
        let homeResult = '', awayResult = '';

        if (fixture.result === 'home_win') {
          homeECoin = matchRewards.win_ecoin || 0;
          homeSSCoin = matchRewards.win_sscoin || 0;
          awayECoin = matchRewards.loss_ecoin || 0;
          awaySSCoin = matchRewards.loss_sscoin || 0;
          homeResult = 'Win';
          awayResult = 'Loss';
        } else if (fixture.result === 'away_win') {
          homeECoin = matchRewards.loss_ecoin || 0;
          homeSSCoin = matchRewards.loss_sscoin || 0;
          awayECoin = matchRewards.win_ecoin || 0;
          awaySSCoin = matchRewards.win_sscoin || 0;
          homeResult = 'Loss';
          awayResult = 'Win';
        } else {
          homeECoin = matchRewards.draw_ecoin || 0;
          homeSSCoin = matchRewards.draw_sscoin || 0;
          awayECoin = matchRewards.draw_ecoin || 0;
          awaySSCoin = matchRewards.draw_sscoin || 0;
          homeResult = 'Draw';
          awayResult = 'Draw';
        }

        console.log(`   Rewards: Home (${homeResult}): ${homeECoin} eCoin, ${homeSSCoin} SSCoin | Away (${awayResult}): ${awayECoin} eCoin, ${awaySSCoin} SSCoin`);

        // Distribute rewards to home team
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

            // Also update Neon auction database teams table (football_budget only)
            try {
              await auctionSql`
                UPDATE teams
                SET 
                  football_budget = COALESCE(football_budget, 0) + ${homeECoin},
                  updated_at = NOW()
                WHERE id = ${fixture.home_team_id}
              `;
              console.log(`   ✅ Updated Neon teams table for home team: +${homeECoin} eCoin`);
            } catch (neonError) {
              console.log(`   ⚠️  Failed to update Neon teams table:`, neonError.message);
            }

            // Record transaction
            await db.collection('transactions').add({
              team_id: fixture.home_team_id,
              season_id: seasonId,
              transaction_type: 'match_reward',
              currency_type: 'mixed',
              amount: homeECoin,
              amount_real: homeSSCoin,
              description: `Match Reward (${homeResult}) - Round ${fixture.round_number}${fixture.leg > 1 ? ' Leg ' + fixture.leg : ''} - Fixture: ${fixture.id} [Retroactive]`,
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

            console.log(`   ✅ Home team (${fixture.home_team_name}): +${homeECoin} eCoin, +${homeSSCoin} SSCoin`);
          } else {
            console.log(`   ⚠️  Home team_season document not found: ${teamSeasonDocId}`);
          }
        }

        // Distribute rewards to away team
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

            // Also update Neon auction database teams table (football_budget only)
            try {
              await auctionSql`
                UPDATE teams
                SET 
                  football_budget = COALESCE(football_budget, 0) + ${awayECoin},
                  updated_at = NOW()
                WHERE id = ${fixture.away_team_id}
              `;
              console.log(`   ✅ Updated Neon teams table for away team: +${awayECoin} eCoin`);
            } catch (neonError) {
              console.log(`   ⚠️  Failed to update Neon teams table:`, neonError.message);
            }

            // Record transaction
            await db.collection('transactions').add({
              team_id: fixture.away_team_id,
              season_id: seasonId,
              transaction_type: 'match_reward',
              currency_type: 'mixed',
              amount: awayECoin,
              amount_real: awaySSCoin,
              description: `Match Reward (${awayResult}) - Round ${fixture.round_number}${fixture.leg > 1 ? ' Leg ' + fixture.leg : ''} - Fixture: ${fixture.id} [Retroactive]`,
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

            console.log(`   ✅ Away team (${fixture.away_team_name}): +${awayECoin} eCoin, +${awaySSCoin} SSCoin`);
          } else {
            console.log(`   ⚠️  Away team_season document not found: ${teamSeasonDocId}`);
          }
        }

        successCount++;
      } catch (error) {
        console.error(`   ❌ Error processing fixture ${fixture.id}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n${'═'.repeat(80)}`);
    console.log(`\n✅ Distribution complete!`);
    console.log(`   Success: ${successCount} fixtures`);
    console.log(`   Errors: ${errorCount} fixtures`);
    console.log(`   Total processed: ${successCount + errorCount} fixtures`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

distributeRewards()
  .then(() => {
    console.log('\n✅ Script complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
