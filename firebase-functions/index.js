/**
 * Firebase Cloud Functions for triggering Next.js cache revalidation
 * 
 * To deploy these functions:
 * 1. Install Firebase CLI: npm install -g firebase-tools
 * 2. Initialize functions: firebase init functions
 * 3. Copy this code to functions/index.js
 * 4. Set environment variables:
 *    firebase functions:config:set revalidate.secret="YOUR_SECRET" revalidate.url="https://your-domain.com/api/revalidate"
 * 5. Deploy: firebase deploy --only functions
 * 
 * Required environment variables:
 * - REVALIDATE_SECRET: Secret key for authentication
 * - REVALIDATE_URL: Your Next.js revalidation endpoint URL
 */

const functions = require('firebase-functions');
const fetch = require('node-fetch');

/**
 * Trigger revalidation via HTTP request to Next.js
 */
async function triggerRevalidation(type) {
  const revalidateUrl = process.env.REVALIDATE_URL || functions.config().revalidate?.url;
  const revalidateSecret = process.env.REVALIDATE_SECRET || functions.config().revalidate?.secret;
  
  if (!revalidateUrl || !revalidateSecret) {
    console.error('Revalidation URL or secret not configured');
    return;
  }
  
  try {
    const response = await fetch(revalidateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: revalidateSecret,
        type: type,
      }),
    });
    
    const result = await response.json();
    console.log(`Revalidation triggered for ${type}:`, result);
    return result;
  } catch (error) {
    console.error(`Failed to trigger revalidation for ${type}:`, error);
    throw error;
  }
}

/**
 * Triggered when a team document is created, updated, or deleted
 */
exports.onTeamChange = functions.firestore
  .document('team_seasons/{teamId}')
  .onWrite(async (change, context) => {
    console.log('Team document changed:', context.params.teamId);
    
    // Trigger revalidation for teams and stats
    await triggerRevalidation('all'); // Revalidate all since team changes affect stats too
    
    return null;
  });

/**
 * Triggered when a player document is created, updated, or deleted
 */
exports.onPlayerChange = functions.firestore
  .document('footballplayers/{playerId}')
  .onWrite(async (change, context) => {
    console.log('Player document changed:', context.params.playerId);
    
    // Trigger revalidation for players and stats
    await triggerRevalidation('all'); // Revalidate all since player changes affect stats too
    
    return null;
  });

/**
 * Triggered when a fixture/match is created, updated, or deleted
 */
exports.onFixtureChange = functions.firestore
  .document('fixtures/{fixtureId}')
  .onWrite(async (change, context) => {
    console.log('Fixture changed:', context.params.fixtureId);
    
    // Clear fixtures cache
    await triggerRevalidation('fixtures');
    
    // If result was updated, also clear stats
    const after = change.after.exists ? change.after.data() : null;
    const before = change.before.exists ? change.before.data() : null;
    
    if (after && (after.home_score !== before?.home_score || after.away_score !== before?.away_score)) {
      console.log('Match result updated, clearing stats cache');
      await triggerRevalidation('stats');
    }
    
    return null;
  });

/**
 * Triggered when match_days change
 */
exports.onMatchDayChange = functions.firestore
  .document('match_days/{matchDayId}')
  .onWrite(async (change, context) => {
    console.log('Match day changed:', context.params.matchDayId);
    await triggerRevalidation('match-data');
    return null;
  });

/**
 * Triggered when round_deadlines change
 */
exports.onRoundDeadlineChange = functions.firestore
  .document('round_deadlines/{roundId}')
  .onWrite(async (change, context) => {
    console.log('Round deadline changed:', context.params.roundId);
    await triggerRevalidation('match-data');
    return null;
  });

/**
 * Triggered when seasons change
 */
exports.onSeasonChange = functions.firestore
  .document('seasons/{seasonId}')
  .onWrite(async (change, context) => {
    console.log('Season changed:', context.params.seasonId);
    await triggerRevalidation('seasons');
    return null;
  });

/**
 * Scheduled function to periodically refresh cache
 * Runs every hour to ensure data stays fresh
 */
exports.scheduledCacheRefresh = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    console.log('Running scheduled cache refresh');
    
    await triggerRevalidation('all');
    
    console.log('Scheduled cache refresh completed');
    return null;
  });

/**
 * HTTP function for manual cache refresh
 * Can be called via: https://your-region-your-project.cloudfunctions.net/manualCacheRefresh
 */
exports.manualCacheRefresh = functions.https.onRequest(async (req, res) => {
  // Optional: Add authentication check here
  const authHeader = req.headers.authorization;
  const expectedAuth = process.env.MANUAL_REFRESH_SECRET || functions.config().revalidate?.manual_secret;
  
  if (expectedAuth && authHeader !== `Bearer ${expectedAuth}`) {
    res.status(401).send('Unauthorized');
    return;
  }
  
  try {
    const type = req.query.type || 'all';
    const result = await triggerRevalidation(type);
    res.json({
      success: true,
      message: 'Cache refresh triggered',
      result: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Batch update trigger - useful when bulk operations happen
 */
exports.onBatchUpdate = functions.firestore
  .document('batch_operations/{batchId}')
  .onCreate(async (snap, context) => {
    const batchData = snap.data();
    console.log('Batch operation completed:', batchData);
    
    // Wait a bit to ensure all Firestore writes are complete
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Trigger full revalidation
    await triggerRevalidation('all');
    
    return null;
  });
