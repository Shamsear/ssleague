import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

async function addReservePhases() {
  console.log('🔄 Adding reserve phase columns to auction_settings...\n');

  try {
    // Add columns with IF NOT EXISTS to be safe
    await sql`
      ALTER TABLE auction_settings
      ADD COLUMN IF NOT EXISTS phase_1_end_round INTEGER DEFAULT 18
    `;
    console.log('✅ Added phase_1_end_round column');

    await sql`
      ALTER TABLE auction_settings
      ADD COLUMN IF NOT EXISTS phase_1_min_balance INTEGER DEFAULT 30
    `;
    console.log('✅ Added phase_1_min_balance column');

    await sql`
      ALTER TABLE auction_settings
      ADD COLUMN IF NOT EXISTS phase_2_end_round INTEGER DEFAULT 20
    `;
    console.log('✅ Added phase_2_end_round column');

    await sql`
      ALTER TABLE auction_settings
      ADD COLUMN IF NOT EXISTS phase_2_min_balance INTEGER DEFAULT 30
    `;
    console.log('✅ Added phase_2_min_balance column');

    await sql`
      ALTER TABLE auction_settings
      ADD COLUMN IF NOT EXISTS phase_3_min_balance INTEGER DEFAULT 10
    `;
    console.log('✅ Added phase_3_min_balance column');

    // Update existing records with default values
    const result = await sql`
      UPDATE auction_settings
      SET 
        phase_1_end_round = COALESCE(phase_1_end_round, 18),
        phase_1_min_balance = COALESCE(phase_1_min_balance, 30),
        phase_2_end_round = COALESCE(phase_2_end_round, 20),
        phase_2_min_balance = COALESCE(phase_2_min_balance, 30),
        phase_3_min_balance = COALESCE(phase_3_min_balance, 10)
      WHERE phase_1_end_round IS NULL 
         OR phase_1_min_balance IS NULL
         OR phase_2_end_round IS NULL
         OR phase_2_min_balance IS NULL
         OR phase_3_min_balance IS NULL
    `;
    console.log(`✅ Updated ${result.length} existing record(s) with default values\n`);

    // Verify
    const settings = await sql`SELECT * FROM auction_settings LIMIT 1`;
    if (settings.length > 0) {
      console.log('✅ Migration successful! Sample record:');
      console.log({
        phase_1_end_round: settings[0].phase_1_end_round,
        phase_1_min_balance: settings[0].phase_1_min_balance,
        phase_2_end_round: settings[0].phase_2_end_round,
        phase_2_min_balance: settings[0].phase_2_min_balance,
        phase_3_min_balance: settings[0].phase_3_min_balance,
      });
    }

    console.log('\n✅ Reserve phase migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

addReservePhases();
