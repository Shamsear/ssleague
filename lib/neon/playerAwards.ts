import { getTournamentDb } from './tournament-config';

export interface PlayerAward {
  id?: number;
  player_id: string;
  player_name: string;
  season_id: string;
  award_category: string;  // e.g., "Golden Boot", "Best Defender"
  award_type: string;      // "category" or "individual"
  award_position?: string | null;
  player_category?: string | null;
  performance_stats?: Record<string, any> | null;
  awarded_by?: string | null;
  notes?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Create the player_awards table (run once during setup)
 */
export async function createPlayerAwardsTable() {
  try {
    const sql = getTournamentDb();
    
    // Create player_awards table
    await sql`
      CREATE TABLE IF NOT EXISTS player_awards (
        id SERIAL PRIMARY KEY,
        player_id VARCHAR(255) NOT NULL,
        player_name VARCHAR(255) NOT NULL,
        season_id VARCHAR(255) NOT NULL,
        award_category VARCHAR(255) NOT NULL,
        award_type VARCHAR(255) NOT NULL,
        award_position VARCHAR(100),
        player_category VARCHAR(255),
        performance_stats JSONB,
        awarded_by VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        CONSTRAINT unique_player_season_award UNIQUE (player_id, season_id, award_category)
      )
    `;
    
    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_player_awards_player_id ON player_awards(player_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_player_awards_season_id ON player_awards(season_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_player_awards_player_season ON player_awards(player_id, season_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_player_awards_category ON player_awards(award_category)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_player_awards_type ON player_awards(award_type)`;
    
    console.log('✅ player_awards table created successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Error creating player_awards table:', error);
    throw error;
  }
}

/**
 * Get all player awards, optionally filtered
 */
export async function getPlayerAwards(filters?: {
  player_id?: string;
  season_id?: string;
  award_category?: string;
  award_type?: string;
}): Promise<PlayerAward[]> {
  try {
    const sql = getTournamentDb();
    
    if (!filters || Object.keys(filters).length === 0) {
      const result = await sql`SELECT * FROM player_awards ORDER BY created_at DESC`;
      return result as PlayerAward[];
    }
    
    let conditions: string[] = [];
    let values: any[] = [];
    
    if (filters.player_id) {
      conditions.push(`player_id = $${values.length + 1}`);
      values.push(filters.player_id);
    }
    
    if (filters.season_id) {
      conditions.push(`season_id = $${values.length + 1}`);
      values.push(filters.season_id);
    }
    
    if (filters.award_category) {
      conditions.push(`award_category = $${values.length + 1}`);
      values.push(filters.award_category);
    }
    
    if (filters.award_type) {
      conditions.push(`award_type = $${values.length + 1}`);
      values.push(filters.award_type);
    }
    
    const query = `SELECT * FROM player_awards WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`;
    const result = await sql(query, values);
    return result as PlayerAward[];
  } catch (error) {
    console.error('Error fetching player awards:', error);
    throw error;
  }
}

/**
 * Get player awards by player ID and season
 */
export async function getPlayerAwardsByPlayerAndSeason(
  playerId: string,
  seasonId: string
): Promise<PlayerAward[]> {
  const sql = getTournamentDb();
  const result = await sql`
    SELECT * FROM player_awards
    WHERE player_id = ${playerId} AND season_id = ${seasonId}
    ORDER BY created_at DESC
  `;
  return result as PlayerAward[];
}

/**
 * Create a new player award
 */
export async function createPlayerAward(award: Omit<PlayerAward, 'id' | 'created_at' | 'updated_at'>): Promise<PlayerAward> {
  const sql = getTournamentDb();
  const result = await sql`
    INSERT INTO player_awards (
      player_id, player_name, season_id, award_category, award_type,
      award_position, player_category, performance_stats, awarded_by, notes
    ) VALUES (
      ${award.player_id}, ${award.player_name}, ${award.season_id}, 
      ${award.award_category}, ${award.award_type},
      ${award.award_position || null}, ${award.player_category || null},
      ${award.performance_stats ? JSON.stringify(award.performance_stats) : null},
      ${award.awarded_by || null}, ${award.notes || null}
    )
    RETURNING *
  `;
  return result[0] as PlayerAward;
}

/**
 * Update a player award
 */
export async function updatePlayerAward(id: number, updates: Partial<PlayerAward>): Promise<PlayerAward | null> {
  const sql = getTournamentDb();
  const setClauses: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;
  
  const allowedUpdates = ['award_category', 'award_type', 'award_position', 'player_category', 'performance_stats', 'awarded_by', 'notes'];
  
  Object.entries(updates).forEach(([key, value]) => {
    if (allowedUpdates.includes(key)) {
      setClauses.push(`${key} = $${paramIndex++}`);
      params.push(key === 'performance_stats' && value ? JSON.stringify(value) : value);
    }
  });
  
  if (setClauses.length === 0) {
    // No valid updates
    const result = await sql`SELECT * FROM player_awards WHERE id = ${id}`;
    return result[0] as PlayerAward || null;
  }
  
  setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
  params.push(id);
  
  const query = `
    UPDATE player_awards 
    SET ${setClauses.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;
  
  const result = await sql(query, params);
  return result[0] as PlayerAward || null;
}

/**
 * Delete a player award
 */
export async function deletePlayerAward(id: number): Promise<boolean> {
  const sql = getTournamentDb();
  const result = await sql`DELETE FROM player_awards WHERE id = ${id} RETURNING id`;
  return result.length > 0;
}

/**
 * Get awards count by player and season
 */
export async function getPlayerAwardsCount(playerId: string, seasonId: string): Promise<number> {
  const sql = getTournamentDb();
  const result = await sql`
    SELECT COUNT(*) as count
    FROM player_awards
    WHERE player_id = ${playerId} AND season_id = ${seasonId}
  `;
  return parseInt(result[0].count);
}

/**
 * Get all players with awards for a season
 */
export async function getPlayersWithAwardsForSeason(seasonId: string) {
  const sql = getTournamentDb();
  const result = await sql`
    SELECT 
      player_id,
      player_name,
      COUNT(*) as awards_count,
      STRING_AGG(award_category || ' (' || COALESCE(award_position, 'Winner') || ')', ', ' ORDER BY created_at) as awards_list
    FROM player_awards
    WHERE season_id = ${seasonId}
    GROUP BY player_id, player_name
    ORDER BY awards_count DESC, player_name
  `;
  return result;
}
