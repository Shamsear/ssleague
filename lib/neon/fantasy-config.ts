import { neon } from '@neondatabase/serverless';

// Fantasy League Neon Database connection
const connectionString = process.env.FANTASY_DATABASE_URL || 'postgresql://neondb_owner:npg_K1IGoDtlkPA3@ep-silent-sun-a1hf5mn7-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

if (!connectionString) {
  console.error(
    '❌ FANTASY_DATABASE_URL environment variable is not set. ' +
    'Please add it to your .env.local file.'
  );
}

// Create SQL query function for fantasy database with increased timeout
// Neon free tier has cold starts that can take 5-15 seconds
export const fantasySql = neon(connectionString, {
  fetchConnectionTimeout: 30000, // 30 seconds (increased from default 10s)
  connectionTimeout: 30000,
  fetchOptions: {
    cache: 'no-store',
  },
});

// Export as getFantasyDb for consistency with other database configs
export function getFantasyDb() {
  return fantasySql;
}

// Tournament DB is just an alias for fantasy DB (same database)
export function getTournamentDb() {
  return fantasySql;
}

// Helper function to test fantasy database connection
export async function testFantasyConnection() {
  try {
    const result = await fantasySql`SELECT NOW()`;
    console.log('✅ Fantasy database connection successful:', result);
    return true;
  } catch (error) {
    console.error('❌ Fantasy database connection failed:', error);
    return false;
  }
}
