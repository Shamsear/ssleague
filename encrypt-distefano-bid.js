const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

// Encryption key from environment
const ENCRYPTION_KEY = process.env.BID_ENCRYPTION_KEY;

// Encrypt function
function encrypt(text) {
  if (!ENCRYPTION_KEY) {
    throw new Error('BID_ENCRYPTION_KEY not found in environment');
  }
  
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  
  let encrypted = cipher.update(text.toString());
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

async function encryptDistefanoBid() {
  console.log('Encrypting Filippo Distefano bid...\n');
  console.log('='.repeat(80));
  
  // Find the bid
  const bids = await sql`
    SELECT b.id, b.amount, b.actual_bid_amount, f.name as player_name
    FROM bids b
    JOIN footballplayers f ON b.player_id = f.id
    WHERE f.name = 'Filippo Distefano'
    AND b.season_id = 'SSPSLS16'
  `;
  
  if (bids.length === 0) {
    console.log('❌ No bid found for Filippo Distefano');
    process.exit(1);
  }
  
  const bid = bids[0];
  
  console.log(`✅ Found bid: ${bid.player_name}`);
  console.log(`   Bid ID: ${bid.id}`);
  console.log(`   Current amount: ${bid.amount}`);
  console.log(`   Current actual_bid_amount: ${bid.actual_bid_amount}`);
  
  // Encrypt the amount (390)
  const encryptedData = encrypt(390);
  
  console.log(`\n✅ Encrypted bid data: ${encryptedData.substring(0, 50)}...`);
  
  // Update the bid
  try {
    await sql`
      UPDATE bids
      SET encrypted_bid_data = ${encryptedData},
          amount = NULL,
          updated_at = NOW()
      WHERE id = ${bid.id}
    `;
    
    console.log('\n✅ Bid updated successfully!');
    console.log('   - encrypted_bid_data: SET');
    console.log('   - amount: NULL (removed)');
    console.log('   - actual_bid_amount: 390 (kept for reference)');
    
  } catch (error) {
    console.error('\n❌ Error updating bid:', error);
    process.exit(1);
  }
  
  // Verify the update
  const updatedBid = await sql`
    SELECT id, amount, actual_bid_amount, encrypted_bid_data
    FROM bids
    WHERE id = ${bid.id}
  `;
  
  console.log('\n' + '='.repeat(80));
  console.log('\nVerification:');
  console.log(`   amount: ${updatedBid[0].amount}`);
  console.log(`   actual_bid_amount: ${updatedBid[0].actual_bid_amount}`);
  console.log(`   encrypted_bid_data: ${updatedBid[0].encrypted_bid_data ? 'SET' : 'NULL'}`);
  
  console.log('\n' + '='.repeat(80));
  console.log('\n✅ Encryption complete!');
  
  process.exit(0);
}

encryptDistefanoBid().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
