require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function migrateContractDuration() {
  console.log('\n🔧 Adding contract_duration field to auction_settings...\n');
  
  const auctionSql = neon(process.env.NEON_AUCTION_DB_URL || process.env.NEON_DATABASE_URL);
  
  try {
    // Step 1: Check if column exists
    console.log('1️⃣ Checking if contract_duration column exists...');
    const columnCheck = await auctionSql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'auction_settings' 
      AND column_name = 'contract_duration'
    `;
    
    if (columnCheck.length > 0) {
      console.log('   ✅ Column already exists');
    } else {
      console.log('   ➕ Column does not exist, adding...');
      
      // Step 2: Add the column with default value
      await auctionSql`
        ALTER TABLE auction_settings 
        ADD COLUMN contract_duration INTEGER DEFAULT 2
      `;
      
      console.log('   ✅ Column added successfully');
    }
    
    // Step 3: Update existing records that might have NULL
    console.log('\n2️⃣ Updating existing records with default value...');
    const updateResult = await auctionSql`
      UPDATE auction_settings 
      SET contract_duration = 2 
      WHERE contract_duration IS NULL
    `;
    
    console.log(`   ✅ Updated ${updateResult.count || 0} records`);
    
    // Step 4: Verify
    console.log('\n3️⃣ Verifying changes...');
    const settings = await auctionSql`
      SELECT * 
      FROM auction_settings 
      ORDER BY id
    `;
    
    console.log(`   ✅ Found ${settings.length} auction_settings records`);
    if (settings.length > 0) {
      console.log('   Columns:', Object.keys(settings[0]).join(', '));
      settings.forEach(s => {
        console.log(`      - Season ${s.season_id}: contract_duration = ${s.contract_duration || 'NULL'}`);
      });
    } else {
      console.log('   ℹ️  Table is empty (this is normal for new installations)');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration complete!');
    console.log('📝 All auction_settings now have contract_duration field');
    console.log('   Default value: 2 seasons\n');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nDetails:', error);
    process.exit(1);
  }
}

migrateContractDuration();
