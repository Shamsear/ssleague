import { neon } from '@neondatabase/serverless';

// Get Neon connection string from environment variable
const connectionString = process.env.NEON_DATABASE_URL;

if (!connectionString) {
  console.error(
    '❌ NEON_DATABASE_URL environment variable is not set. ' +
    'Please add it to your .env.local file.'
  );
}

// Create SQL query function (use empty string as fallback to prevent build errors)
export const sql = neon(connectionString || '');

// Helper function to test connection
export async function testNeonConnection() {
  try {
    const result = await sql`SELECT NOW()`;
    console.log('✅ Neon connection successful:', result);
    return true;
  } catch (error) {
    console.error('❌ Neon connection failed:', error);
    return false;
  }
}
