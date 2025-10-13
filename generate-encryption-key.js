// Generate encryption key for bid encryption
const crypto = require('crypto');

const key = crypto.randomBytes(32).toString('hex');

console.log('='.repeat(70));
console.log('BID ENCRYPTION KEY GENERATED');
console.log('='.repeat(70));
console.log('');
console.log('Add this to your .env.local file:');
console.log('');
console.log(`BID_ENCRYPTION_KEY=${key}`);
console.log('');
console.log('⚠️  IMPORTANT:');
console.log('  - Keep this key SECRET and SECURE');
console.log('  - Never commit this key to version control');
console.log('  - If you lose this key, existing encrypted bids cannot be decrypted');
console.log('  - Use the same key across all environments for the same database');
console.log('');
console.log('='.repeat(70));
