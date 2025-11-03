import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

async function resetStuckRound() {
  try {
    console.log('🔍 Checking for stuck rounds...');
    
    // Find rounds stuck in 'finalizing' status
    const stuckRounds = await sql`
      SELECT id, position, status, end_time, created_at
      FROM rounds
      WHERE status = 'finalizing'
      ORDER BY created_at DESC
    `;
    
    if (stuckRounds.length === 0) {
      console.log('✅ No stuck rounds found');
      return;
    }
    
    console.log(`\n⚠️  Found ${stuckRounds.length} stuck round(s):\n`);
    
    stuckRounds.forEach((round, index) => {
      console.log(`${index + 1}. Round ID: ${round.id}`);
      console.log(`   Position: ${round.position}`);
      console.log(`   Status: ${round.status}`);
      console.log(`   End Time: ${round.end_time}`);
      console.log('');
    });
    
    console.log('🔄 Resetting rounds back to active status...\n');
    
    for (const round of stuckRounds) {
      await sql`
        UPDATE rounds
        SET status = 'active',
            updated_at = NOW()
        WHERE id = ${round.id}
      `;
      
      console.log(`✅ Reset round ${round.position} (${round.id}) to active`);
    }
    
    console.log('\n🎉 All stuck rounds have been reset!');
    console.log('\n💡 You can now try finalizing them again manually or wait for auto-finalization.');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

resetStuckRound();
