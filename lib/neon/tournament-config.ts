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

// Create SQL query executor for tournament database
export const tournamentSql = connectionString ? neon(connectionString) : null;

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
