import { sql } from './config';

export interface FootballPlayer {
  id: string;
  player_id: string;
  name: string;
  position?: string;
  position_group?: string;
  
  // Team and Season
  team_id?: string;
  team_name?: string;
  season_id?: string;
  round_id?: string;
  
  // Auction
  is_auction_eligible?: boolean;
  is_sold?: boolean;
  acquisition_value?: number;
  
  // Basic Info
  nationality?: string;
  age?: number;
  club?: string;
  playing_style?: string;
  overall_rating?: number;
  
  // Offensive Attributes
  offensive_awareness?: number;
  ball_control?: number;
  dribbling?: number;
  tight_possession?: number;
  low_pass?: number;
  lofted_pass?: number;
  finishing?: number;
  heading?: number;
  set_piece_taking?: number;
  curl?: number;
  
  // Physical Attributes
  speed?: number;
  acceleration?: number;
  kicking_power?: number;
  jumping?: number;
  physical_contact?: number;
  balance?: number;
  stamina?: number;
  
  // Defensive Attributes
  defensive_awareness?: number;
  tackling?: number;
  aggression?: number;
  defensive_engagement?: number;
  
  // Goalkeeper Attributes
  gk_awareness?: number;
  gk_catching?: number;
  gk_parrying?: number;
  gk_reflexes?: number;
  gk_reach?: number;
  
  // Metadata
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Get all players with optional filters
 */
export async function getAllPlayers(filters?: {
  position?: string;
  team_id?: string;
  season_id?: string;
  is_auction_eligible?: boolean;
  is_sold?: boolean;
  limit?: number;
  offset?: number;
}): Promise<FootballPlayer[]> {
  try {
    console.log('🔍 getAllPlayers called with filters:', filters);
    
    // If no filters, return all players
    if (!filters || Object.keys(filters).filter(k => filters[k as keyof typeof filters] !== undefined).length === 0) {
      const result = await sql`SELECT * FROM footballplayers ORDER BY name ASC`;
      console.log(`✅ Fetched ${result.length} players from Neon`);
      return result as FootballPlayer[];
    }
    
    // For filtered queries, we need to use Pool for parameterized queries
    const { Pool } = await import('@neondatabase/serverless');
    const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });
    
    try {
      // Build WHERE conditions dynamically
      let query = 'SELECT * FROM footballplayers WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;
      
      if (filters?.position) {
        query += ` AND position = $${paramIndex++}`;
        params.push(filters.position);
      }
      if (filters?.team_id) {
        query += ` AND team_id = $${paramIndex++}`;
        params.push(filters.team_id);
      }
      if (filters?.season_id) {
        query += ` AND season_id = $${paramIndex++}`;
        params.push(filters.season_id);
      }
      if (filters?.is_auction_eligible !== undefined) {
        query += ` AND is_auction_eligible = $${paramIndex++}`;
        params.push(filters.is_auction_eligible);
      }
      if (filters?.is_sold !== undefined) {
        query += ` AND is_sold = $${paramIndex++}`;
        params.push(filters.is_sold);
      }
      
      query += ' ORDER BY name ASC';
      
      if (filters?.limit) {
        query += ` LIMIT $${paramIndex++}`;
        params.push(filters.limit);
      }
      if (filters?.offset) {
        query += ` OFFSET $${paramIndex++}`;
        params.push(filters.offset);
      }
      
      console.log('📝 Query:', query);
      console.log('📝 Params:', params);
      
      const result = await pool.query(query, params);
      console.log(`✅ Fetched ${result.rows.length} players from Neon`);
      return result.rows as FootballPlayer[];
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error('❌ Error in getAllPlayers:', error);
    throw error;
  }
}

/**
 * Get a single player by ID
 */
export async function getPlayerById(id: string): Promise<FootballPlayer | null> {
  const result = await sql`SELECT * FROM footballplayers WHERE id = ${id}`;
  return result.length > 0 ? result[0] as FootballPlayer : null;
}

/**
 * Get player by player_id (unique identifier)
 */
export async function getPlayerByPlayerId(playerId: string): Promise<FootballPlayer | null> {
  const result = await sql`SELECT * FROM footballplayers WHERE player_id = ${playerId}`;
  return result.length > 0 ? result[0] as FootballPlayer : null;
}

/**
 * Create a new player
 */
export async function createPlayer(player: Omit<FootballPlayer, 'created_at' | 'updated_at'>): Promise<FootballPlayer> {
  const result = await sql`
    INSERT INTO footballplayers (
      id, player_id, name, position, position_group, overall_rating,
      nationality, age, club, team_id, team_name, is_auction_eligible,
      is_sold, sold_price, season_id
    ) VALUES (
      ${player.id}, ${player.player_id}, ${player.name}, ${player.position || null},
      ${player.position_group || null}, ${player.overall_rating || null},
      ${player.nationality || null}, ${player.age || null}, ${player.club || null},
      ${player.team_id || null}, ${player.team_name || null}, ${player.is_auction_eligible || false},
      ${player.is_sold || false}, ${player.sold_price || null}, ${player.season_id || null}
    )
    RETURNING *
  `;
  return result[0] as FootballPlayer;
}

/**
 * Update a player
 */
export async function updatePlayer(id: string, updates: Partial<FootballPlayer>): Promise<FootballPlayer | null> {
  const setClauses: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  Object.entries(updates).forEach(([key, value]) => {
    if (key !== 'id' && key !== 'created_at' && key !== 'updated_at') {
      setClauses.push(`${key} = $${paramIndex++}`);
      params.push(value);
    }
  });

  if (setClauses.length === 0) {
    return getPlayerById(id);
  }

  params.push(id);
  const query = `
    UPDATE footballplayers 
    SET ${setClauses.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  const { Pool } = await import('@neondatabase/serverless');
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });
  try {
    const result = await pool.query(query, params);
    return result.rows.length > 0 ? result.rows[0] as FootballPlayer : null;
  } finally {
    await pool.end();
  }
}

/**
 * Update player auction eligibility
 */
export async function updatePlayerEligibility(id: string, isEligible: boolean): Promise<FootballPlayer | null> {
  const result = await sql`
    UPDATE footballplayers 
    SET is_auction_eligible = ${isEligible}
    WHERE id = ${id}
    RETURNING *
  `;
  return result.length > 0 ? result[0] as FootballPlayer : null;
}

/**
 * Bulk update player eligibility
 */
export async function bulkUpdateEligibility(playerIds: number[], isEligible: boolean): Promise<number> {
  if (playerIds.length === 0) return 0;
  
  const { Pool } = await import('@neondatabase/serverless');
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });
  
  try {
    const query = `
      UPDATE footballplayers 
      SET is_auction_eligible = $1
      WHERE id = ANY($2::int[])
    `;
    
    const result = await pool.query(query, [isEligible, playerIds]);
    return result.rowCount || 0;
  } finally {
    await pool.end();
  }
}

/**
 * Delete a player
 */
export async function deletePlayer(id: string): Promise<boolean> {
  const result = await sql`DELETE FROM footballplayers WHERE id = ${id}`;
  return result.length > 0;
}

/**
 * Delete all players
 */
export async function deleteAllPlayers(): Promise<number> {
  const result = await sql`DELETE FROM footballplayers`;
  return result.length;
}

/**
 * Get player count by position
 */
export async function getPlayerCountByPosition(): Promise<{ position: string; count: number }[]> {
  const result = await sql`
    SELECT position, COUNT(*) as count 
    FROM footballplayers 
    GROUP BY position 
    ORDER BY position
  `;
  return result.map((row: any) => ({
    position: row.position || 'Unknown',
    count: parseInt(row.count)
  }));
}

/**
 * Get total player count
 */
export async function getTotalPlayerCount(): Promise<number> {
  const result = await sql`SELECT COUNT(*) as count FROM footballplayers`;
  return parseInt(result[0].count);
}

/**
 * Search players by name
 */
export async function searchPlayers(searchTerm: string, limit: number = 50): Promise<FootballPlayer[]> {
  const result = await sql`
    SELECT * FROM footballplayers 
    WHERE name ILIKE ${'%' + searchTerm + '%'}
    OR player_id ILIKE ${'%' + searchTerm + '%'}
    ORDER BY name ASC
    LIMIT ${limit}
  `;
  return result as FootballPlayer[];
}

/**
 * Bulk import players
 */
export async function bulkImportPlayers(players: Omit<FootballPlayer, 'created_at' | 'updated_at'>[]): Promise<number> {
  if (players.length === 0) return 0;

  const { Pool } = await import('@neondatabase/serverless');
  const { randomUUID } = await import('crypto');
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });
  
  try {
    let insertedCount = 0;
    
    // Insert players in batches to avoid query size limits
    const batchSize = 100;
    for (let i = 0; i < players.length; i += batchSize) {
      const batch = players.slice(i, i + batchSize);
      
      // Build parameterized query for this batch
      const placeholders: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;
      
      batch.forEach(p => {
        // Count all the fields we're inserting (43 fields total)
        const fieldCount = 43;
        const paramsList = Array.from({ length: fieldCount }, (_, i) => `$${paramIndex++}`).join(', ');
        placeholders.push(`(${paramsList})`);
        
        // Generate ID if not provided
        const playerId = p.id || randomUUID();
        
        values.push(
          playerId,
          p.player_id,
          p.name,
          p.position || null,
          p.position_group || null,
          p.overall_rating || null,
          p.nationality || null,
          p.age || null,
          p.club || null,
          p.team_id || null,
          p.team_name || null,
          p.season_id || null,
          p.round_id || null,
          p.is_auction_eligible !== undefined ? p.is_auction_eligible : false,
          p.is_sold !== undefined ? p.is_sold : false,
          p.acquisition_value || null,
          p.playing_style || null,
          // Offensive attributes
          p.offensive_awareness || null,
          p.ball_control || null,
          p.dribbling || null,
          p.tight_possession || null,
          p.low_pass || null,
          p.lofted_pass || null,
          p.finishing || null,
          p.heading || null,
          p.set_piece_taking || null,
          p.curl || null,
          // Physical attributes
          p.speed || null,
          p.acceleration || null,
          p.kicking_power || null,
          p.jumping || null,
          p.physical_contact || null,
          p.balance || null,
          p.stamina || null,
          // Defensive attributes
          p.defensive_awareness || null,
          p.tackling || null,
          p.aggression || null,
          p.defensive_engagement || null,
          // Goalkeeper attributes
          p.gk_awareness || null,
          p.gk_catching || null,
          p.gk_parrying || null,
          p.gk_reflexes || null,
          p.gk_reach || null
        );
      });
      
      const query = `
        INSERT INTO footballplayers (
          id, player_id, name, position, position_group, overall_rating,
          nationality, age, club, team_id, team_name, season_id, round_id,
          is_auction_eligible, is_sold, acquisition_value, playing_style,
          offensive_awareness, ball_control, dribbling, tight_possession,
          low_pass, lofted_pass, finishing, heading, set_piece_taking, curl,
          speed, acceleration, kicking_power, jumping, physical_contact, balance, stamina,
          defensive_awareness, tackling, aggression, defensive_engagement,
          gk_awareness, gk_catching, gk_parrying, gk_reflexes, gk_reach
        ) VALUES ${placeholders.join(', ')}
        ON CONFLICT (player_id) DO UPDATE SET
          name = EXCLUDED.name,
          position = EXCLUDED.position,
          position_group = EXCLUDED.position_group,
          overall_rating = EXCLUDED.overall_rating,
          nationality = EXCLUDED.nationality,
          age = EXCLUDED.age,
          club = EXCLUDED.club,
          playing_style = EXCLUDED.playing_style,
          offensive_awareness = EXCLUDED.offensive_awareness,
          ball_control = EXCLUDED.ball_control,
          dribbling = EXCLUDED.dribbling,
          tight_possession = EXCLUDED.tight_possession,
          low_pass = EXCLUDED.low_pass,
          lofted_pass = EXCLUDED.lofted_pass,
          finishing = EXCLUDED.finishing,
          heading = EXCLUDED.heading,
          set_piece_taking = EXCLUDED.set_piece_taking,
          curl = EXCLUDED.curl,
          speed = EXCLUDED.speed,
          acceleration = EXCLUDED.acceleration,
          kicking_power = EXCLUDED.kicking_power,
          jumping = EXCLUDED.jumping,
          physical_contact = EXCLUDED.physical_contact,
          balance = EXCLUDED.balance,
          stamina = EXCLUDED.stamina,
          defensive_awareness = EXCLUDED.defensive_awareness,
          tackling = EXCLUDED.tackling,
          aggression = EXCLUDED.aggression,
          defensive_engagement = EXCLUDED.defensive_engagement,
          gk_awareness = EXCLUDED.gk_awareness,
          gk_catching = EXCLUDED.gk_catching,
          gk_parrying = EXCLUDED.gk_parrying,
          gk_reflexes = EXCLUDED.gk_reflexes,
          gk_reach = EXCLUDED.gk_reach
      `;
      
      const result = await pool.query(query, values);
      insertedCount += result.rowCount || 0;
    }
    
    console.log(`✅ Bulk imported ${insertedCount} players to Neon`);
    return insertedCount;
  } finally {
    await pool.end();
  }
}
