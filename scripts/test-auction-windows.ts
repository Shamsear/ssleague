import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.NEON_DATABASE_URL!);

async function testAuctionWindows() {
  console.log('🧪 Testing auction windows setup...\n');

  const seasonId = 'SSPSLS16';

  try {
    // 1. Create settings for season_start (main auction - 25 rounds)
    console.log('1️⃣  Creating season_start settings...');
    const seasonStartResult = await sql`
      INSERT INTO auction_settings (
        season_id, auction_window, max_rounds, min_balance_per_round,
        contract_duration, max_squad_size,
        phase_1_end_round, phase_1_min_balance,
        phase_2_end_round, phase_2_min_balance,
        phase_3_min_balance
      ) VALUES (
        ${seasonId}, 'season_start', 25, 30,
        2, 25,
        18, 30,
        20, 30,
        10
      )
      ON CONFLICT (season_id, auction_window) 
      DO UPDATE SET
        max_rounds = 25,
        phase_1_end_round = 18,
        phase_2_end_round = 20
      RETURNING id, auction_window, max_rounds
    `;
    console.log('✅ Season Start:', seasonStartResult[0]);

    // 2. Create settings for transfer_window (shorter - 10 rounds)
    console.log('\n2️⃣  Creating transfer_window settings...');
    const transferResult = await sql`
      INSERT INTO auction_settings (
        season_id, auction_window, max_rounds, min_balance_per_round,
        contract_duration, max_squad_size,
        phase_1_end_round, phase_1_min_balance,
        phase_2_end_round, phase_2_min_balance,
        phase_3_min_balance
      ) VALUES (
        ${seasonId}, 'transfer_window', 10, 20,
        2, 28,
        7, 20,
        9, 20,
        10
      )
      ON CONFLICT (season_id, auction_window)
      DO UPDATE SET
        max_rounds = 10,
        phase_1_end_round = 7,
        phase_2_end_round = 9
      RETURNING id, auction_window, max_rounds
    `;
    console.log('✅ Transfer Window:', transferResult[0]);

    // 3. Create settings for mid_season (even shorter - 5 rounds)
    console.log('\n3️⃣  Creating mid_season settings...');
    const midSeasonResult = await sql`
      INSERT INTO auction_settings (
        season_id, auction_window, max_rounds, min_balance_per_round,
        contract_duration, max_squad_size,
        phase_1_end_round, phase_1_min_balance,
        phase_2_end_round, phase_2_min_balance,
        phase_3_min_balance
      ) VALUES (
        ${seasonId}, 'mid_season', 5, 15,
        1, 30,
        3, 15,
        4, 15,
        10
      )
      ON CONFLICT (season_id, auction_window)
      DO UPDATE SET
        max_rounds = 5,
        phase_1_end_round = 3,
        phase_2_end_round = 4
      RETURNING id, auction_window, max_rounds
    `;
    console.log('✅ Mid-Season:', midSeasonResult[0]);

    // 4. List all settings
    console.log('\n4️⃣  All auction settings for season', seasonId);
    const allSettings = await sql`
      SELECT id, auction_window, max_rounds, phase_1_end_round, phase_2_end_round, max_squad_size
      FROM auction_settings
      WHERE season_id = ${seasonId}
      ORDER BY auction_window
    `;
    console.table(allSettings);

    console.log('\n✅ Test completed successfully!');
    console.log('\n📝 Next: Update round creation UI to select which auction_settings to use');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

testAuctionWindows().catch(console.error);
