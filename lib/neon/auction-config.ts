/**
 * Neon Database Configuration - Auction System
 * 
 * This database handles:
 * - Football players database (for auctions)
 * - Bidding system
 * - Auction rounds
 * - Tiebreakers
 */

import { neon } from '@neondatabase/serverless';

const connectionString = process.env.NEON_AUCTION_DB_URL || process.env.NEON_DATABASE_URL;

if (!connectionString) {
  console.error(
    '❌ NEON_AUCTION_DB_URL environment variable is not set. ' +
    'Please add it to your .env.local file.'
  );
}

// Create SQL query executor for auction database
export const auctionSql = connectionString ? neon(connectionString) : null;

// Type-safe check for auction database availability
export function isAuctionDbAvailable(): boolean {
  return auctionSql !== null;
}

// Get auction database or throw error
export function getAuctionDb() {
  if (!auctionSql) {
    throw new Error('Auction database not configured. Check NEON_AUCTION_DB_URL.');
  }
  return auctionSql;
}
