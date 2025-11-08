import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { sendNotificationToSeason } from '@/lib/notifications/send-notification';

async function testNotification() {
  console.log('📣 Testing finalization notification...\n');

  const result = await sendNotificationToSeason(
    {
      title: '🏁 TEST: Round Finalized!',
      body: 'SS bidding round has been completed. 9 players allocated. Check results now!',
      url: '/dashboard/team',
      icon: '/logo.png',
      data: {
        type: 'round_finalized',
        roundId: 'TEST_ROUND',
        position: 'SS',
        allocationsCount: '9'
      }
    },
    'SSPSLS16'
  );

  console.log('Result:', result);
  console.log(`\n✅ Sent to ${result.sentCount} devices`);
  console.log(`❌ Failed for ${result.failedCount} devices`);
}

testNotification().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
