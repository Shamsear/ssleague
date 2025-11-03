import { neon } from '@neondatabase/serverless';
import { formatId, ID_PREFIXES, ID_PADDING } from './id-utils';

// Re-export all client-safe utilities
export * from './id-utils';

const sql = neon(process.env.NEON_DATABASE_URL!);

/**
 * Get the next counter value from the database for a given entity type
 */
async function getNextCounter(tableName: string, idColumn: string = 'id'): Promise<number> {
  try {
    // Get the max counter from existing IDs
    // Using unsafe query since we need dynamic table names
    // This is safe because tableName is hardcoded in our calls
    const query = `SELECT ${idColumn} FROM ${tableName} ORDER BY created_at DESC LIMIT 1`;
    const result = await sql.unsafe(query);
    
    if (!result || result.length === 0) {
      console.log(`🆕 No existing ${tableName} found, starting from 1`);
      return 1; // First ID
    }
    
    // Check if result has the expected column
    const row = result[0];
    if (!row || typeof row !== 'object') {
      console.log(`⚠️ Invalid result structure for ${tableName}, starting from 1`);
      return 1;
    }
    
    const lastId = row[idColumn] as string;
    
    if (!lastId || typeof lastId !== 'string') {
      console.log(`⚠️ No valid ID found in ${tableName}, starting from 1`);
      return 1;
    }
    
    // Extract numeric part from the ID
    const numericPart = lastId.replace(/\D/g, '');
    if (!numericPart) {
      console.log(`⚠️ No numeric part in ID ${lastId}, starting from 1`);
      return 1;
    }
    
    const lastCounter = parseInt(numericPart, 10);
    
    if (isNaN(lastCounter)) {
      console.log(`⚠️ Could not parse counter from ${lastId}, starting from 1`);
      return 1;
    }
    
    console.log(`✅ Found last ${tableName} ID: ${lastId}, next counter: ${lastCounter + 1}`);
    return lastCounter + 1;
  } catch (error) {
    // If table doesn't exist or is empty, start from 1
    console.error(`❌ Error getting counter for ${tableName}:`, error);
    return 1;
  }
}

/**
 * Generate a new Round ID
 */
export async function generateRoundId(): Promise<string> {
  const counter = await getNextCounter('rounds');
  return formatId(ID_PREFIXES.ROUND, counter, ID_PADDING.ROUND);
}

/**
 * Generate a new Team ID
 */
export async function generateTeamId(): Promise<string> {
  const counter = await getNextCounter('teams');
  return formatId(ID_PREFIXES.TEAM, counter, ID_PADDING.TEAM);
}

/**
 * Generate a new Tiebreaker ID
 */
export async function generateTiebreakerId(): Promise<string> {
  try {
    const result = await sql`
      SELECT id FROM tiebreakers 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    
    if (!result || result.length === 0) {
      console.log('🆕 No existing tiebreakers found, starting from 1');
      return formatId(ID_PREFIXES.TIEBREAKER, 1, ID_PADDING.TIEBREAKER);
    }
    
    const lastId = result[0].id as string;
    const numericPart = lastId.replace(/\D/g, '');
    const lastCounter = parseInt(numericPart, 10) || 0;
    
    console.log(`✅ Found last tiebreaker ID: ${lastId}, next counter: ${lastCounter + 1}`);
    return formatId(ID_PREFIXES.TIEBREAKER, lastCounter + 1, ID_PADDING.TIEBREAKER);
  } catch (error) {
    console.error('❌ Error getting tiebreaker counter:', error);
    return formatId(ID_PREFIXES.TIEBREAKER, 1, ID_PADDING.TIEBREAKER);
  }
}

/**
 * Generate a new Bulk Round ID
 */
export async function generateBulkRoundId(): Promise<string> {
  try {
    // Get the max counter from rounds with round_type = 'bulk'
    const result = await sql`
      SELECT id FROM rounds 
      WHERE round_type = 'bulk'
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    
    if (!result || result.length === 0) {
      console.log('🆕 No existing bulk rounds found, starting from 1');
      return formatId(ID_PREFIXES.BULK_ROUND, 1, ID_PADDING.BULK_ROUND);
    }
    
    const lastId = result[0].id as string;
    const numericPart = lastId.replace(/\D/g, '');
    const lastCounter = parseInt(numericPart, 10) || 0;
    
    console.log(`✅ Found last bulk round ID: ${lastId}, next counter: ${lastCounter + 1}`);
    return formatId(ID_PREFIXES.BULK_ROUND, lastCounter + 1, ID_PADDING.BULK_ROUND);
  } catch (error) {
    console.error('❌ Error getting bulk round counter:', error);
    return formatId(ID_PREFIXES.BULK_ROUND, 1, ID_PADDING.BULK_ROUND);
  }
}

/**
 * Generate a new Bulk Tiebreaker ID
 */
export async function generateBulkTiebreakerId(): Promise<string> {
  const counter = await getNextCounter('bulk_tiebreakers');
  return formatId(ID_PREFIXES.BULK_TIEBREAKER, counter, ID_PADDING.BULK_TIEBREAKER);
}
