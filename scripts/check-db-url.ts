import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

console.log('Environment variables check:\n');
console.log('NEON_AUCTION_DB_URL:', process.env.NEON_AUCTION_DB_URL ? 'SET ✅' : 'NOT SET ❌');
console.log('NEON_DATABASE_URL:', process.env.NEON_DATABASE_URL ? 'SET ✅' : 'NOT SET ❌');
console.log('NEON_TOURNAMENT_DB_URL:', process.env.NEON_TOURNAMENT_DB_URL ? 'SET ✅' : 'NOT SET ❌');

console.log('\nActual values (first 50 chars):');
if (process.env.NEON_AUCTION_DB_URL) {
  console.log('NEON_AUCTION_DB_URL:', process.env.NEON_AUCTION_DB_URL.substring(0, 80) + '...');
}
if (process.env.NEON_DATABASE_URL) {
  console.log('NEON_DATABASE_URL:', process.env.NEON_DATABASE_URL.substring(0, 80) + '...');
}
if (process.env.NEON_TOURNAMENT_DB_URL) {
  console.log('NEON_TOURNAMENT_DB_URL:', process.env.NEON_TOURNAMENT_DB_URL.substring(0, 80) + '...');
}
