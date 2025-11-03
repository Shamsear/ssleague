import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

export interface AuctionSettings {
  id: number;
  season_id: string;
  max_rounds: number;
  min_balance_per_round: number;
  contract_duration: number;
  max_squad_size: number;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch auction settings for a season
 * Throws error if settings don't exist
 */
export async function getAuctionSettings(seasonId: string): Promise<AuctionSettings> {
  const settings = await sql`
    SELECT * FROM auction_settings 
    WHERE season_id = ${seasonId} 
    LIMIT 1
  `;

  if (settings.length === 0) {
    throw new Error(
      `Auction settings not configured for season ${seasonId}. Please create auction settings first.`
    );
  }

  return settings[0] as AuctionSettings;
}

/**
 * Check if auction settings exist for a season
 */
export async function hasAuctionSettings(seasonId: string): Promise<boolean> {
  const settings = await sql`
    SELECT id FROM auction_settings 
    WHERE season_id = ${seasonId} 
    LIMIT 1
  `;

  return settings.length > 0;
}

/**
 * Validate that auction settings exist for a season
 * Returns settings if they exist, otherwise throws error with status code
 */
export async function validateAuctionSettings(seasonId: string): Promise<{
  valid: boolean;
  settings?: AuctionSettings;
  error?: string;
  status?: number;
}> {
  try {
    const settings = await getAuctionSettings(seasonId);
    return {
      valid: true,
      settings,
    };
  } catch (error: any) {
    return {
      valid: false,
      error: error.message,
      status: 400,
    };
  }
}
