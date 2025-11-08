import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL!);

async function checkFCMTokens() {
  const result = await sql`
    SELECT 
      COUNT(*) as total_tokens,
      COUNT(DISTINCT user_id) as unique_users,
      COUNT(CASE WHEN is_active = true THEN 1 END) as active_tokens
    FROM fcm_tokens
  `;
  
  console.log('FCM Tokens:', result[0]);
  
  const users = await sql`
    SELECT user_id, COUNT(*) as token_count
    FROM fcm_tokens
    WHERE is_active = true
    GROUP BY user_id
  `;
  
  console.log('\nUsers with active tokens:', users);
}

checkFCMTokens().then(() => process.exit(0));
