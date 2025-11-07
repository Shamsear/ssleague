/**
 * Neon Database Configuration - Tournament System
 * 
 * This database handles:
 * - Fixtures and matches
 * - Player statistics
 * - Team statistics
 * - Leaderboards
 * - Match days
 * - Tournament settings
 */

import { neon } from '@neondatabase/serverless';

const connectionString = process.env.NEON_TOURNAMENT_DB_URL;

if (!connectionString) {
  console.error(
    '❌ NEON_TOURNAMENT_DB_URL environment variable is not set. ' +
    'Please add it to your .env.local file.'
  );
}

// Create SQL query executor for tournament database with increased timeout
// Neon free tier has cold starts that can take 5-15 seconds
export const tournamentSql = connectionString ? neon(connectionString, {
  fetchConnectionTimeout: 30000, // 30 seconds (increased from default 10s)
  connectionTimeout: 30000,
  fetchOptions: {
    cache: 'no-store', // Prevent caching issues
  },
}) : null;

// Type-safe check for tournament database availability
export function isTournamentDbAvailable(): boolean {
  return tournamentSql !== null;
}

// Get tournament database or throw error
export function getTournamentDb() {
  if (!tournamentSql) {
    throw new Error('Tournament database not configured. Check NEON_TOURNAMENT_DB_URL.');
  }
  return tournamentSql;
}
