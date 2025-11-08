import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

async function activateFCMTokens() {
  console.log('🔄 Activating all FCM tokens...\n');

  try {
    // Get current status
    const before = await sql`
      SELECT 
        COUNT(*) as total_tokens,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_before,
        COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_before
      FROM fcm_tokens
    `;
    
    console.log('Before activation:');
    console.log(`   Total tokens: ${before[0].total_tokens}`);
    console.log(`   Active: ${before[0].active_before}`);
    console.log(`   Inactive: ${before[0].inactive_before}\n`);

    // Activate all tokens
    const result = await sql`
      UPDATE fcm_tokens
      SET 
        is_active = true,
        updated_at = NOW()
      WHERE is_active = false
      RETURNING user_id, device_name, token
    `;
    
    console.log(`✅ Activated ${result.length} tokens\n`);
    
    if (result.length > 0) {
      console.log('Activated tokens:');
      result.forEach((token, idx) => {
        if (idx < 10) {
          console.log(`   - User: ${token.user_id} | Device: ${token.device_name || 'Unknown'}`);
        }
      });
      if (result.length > 10) {
        console.log(`   ... and ${result.length - 10} more`);
      }
    }

    // Verify
    const after = await sql`
      SELECT 
        COUNT(*) as total_tokens,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_after,
        COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_after,
        COUNT(DISTINCT user_id) as unique_users
      FROM fcm_tokens
    `;
    
    console.log('\nAfter activation:');
    console.log(`   Total tokens: ${after[0].total_tokens}`);
    console.log(`   Active: ${after[0].active_after}`);
    console.log(`   Inactive: ${after[0].inactive_after}`);
    console.log(`   Unique users: ${after[0].unique_users}`);
    
    if (after[0].active_after === after[0].total_tokens) {
      console.log('\n✅ All tokens are now active!');
    } else {
      console.log('\n⚠️  Some tokens are still inactive');
    }

    console.log('\n🎉 FCM token activation complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

activateFCMTokens().then(() => {
  console.log('\n✅ Script completed successfully');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Script failed:', error);
  process.exit(1);
});
