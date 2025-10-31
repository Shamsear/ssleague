import { getTournamentDb } from './neon/tournament-config';

interface TrophyAwardResult {
  success: boolean;
  trophiesAwarded: number;
  awards: {
    team_id: string;
    team_name: string;
    trophy_type: string;
    trophy_name: string;
    position: number;
  }[];
  error?: string;
}

/**
 * Auto-award league trophies based on final standings
 * Called when a season is marked as complete
 * 
 * Awards:
 * - Position 1: "League Winner"
 * - Position 2: "Runner Up"
 * 
 * @param seasonId - Season ID (e.g., "SSPSLS01")
 * @param awardTopN - Number of positions to award (default: 2)
 * @returns Result with awarded trophies
 */
export async function awardSeasonTrophies(
  seasonId: string,
  awardTopN: number = 2
): Promise<TrophyAwardResult> {
  try {
    const sql = getTournamentDb();
    
    console.log(`🏆 Starting trophy auto-award for season ${seasonId}...`);
    
    // 1. Get final standings from teamstats (ordered by position)
    const standings = await sql`
      SELECT 
        team_id,
        team_name,
        position,
        points,
        wins,
        goal_difference
      FROM teamstats
      WHERE season_id = ${seasonId}
        AND position IS NOT NULL
      ORDER BY position ASC
      LIMIT ${awardTopN}
    `;
    
    if (standings.length === 0) {
      return {
        success: false,
        trophiesAwarded: 0,
        awards: [],
        error: 'No teams found with positions in standings'
      };
    }
    
    const awards = [];
    let trophiesAwarded = 0;
    
    // 2. Award trophies based on position
    for (const team of standings) {
      let trophyType = '';
      let trophyName = '';
      let trophyPosition = '';
      
      if (team.position === 1) {
        trophyType = 'league';
        trophyName = 'League';
        trophyPosition = 'Winner';
      } else if (team.position === 2) {
        trophyType = 'runner_up';
        trophyName = 'League';
        trophyPosition = 'Runner Up';
      } else if (team.position === 3) {
        trophyType = 'third_place';
        trophyName = 'League';
        trophyPosition = 'Third Place';
      } else {
        // For positions beyond top 3, generic naming
        trophyType = 'special';
        trophyName = 'League';
        trophyPosition = `${team.position}${getOrdinalSuffix(team.position)} Place`;
      }
      
      // 3. Insert trophy (skip if already exists)
      const result = await sql`
        INSERT INTO team_trophies (
          team_id,
          team_name,
          season_id,
          trophy_type,
          trophy_name,
          trophy_position,
          position,
          awarded_by,
          notes
        )
        VALUES (
          ${team.team_id},
          ${team.team_name},
          ${seasonId},
          ${trophyType},
          ${trophyName},
          ${trophyPosition},
          ${team.position},
          'system',
          'Auto-awarded based on final league standings'
        )
        ON CONFLICT (team_id, season_id, trophy_name, trophy_position) DO NOTHING
        RETURNING id
      `;
      
      if (result.length > 0) {
        trophiesAwarded++;
        awards.push({
          team_id: team.team_id,
          team_name: team.team_name,
          trophy_type: trophyType,
          trophy_name: `${trophyName} ${trophyPosition}`,
          position: team.position
        });
        console.log(`  ✅ Awarded "${trophyName} ${trophyPosition}" to ${team.team_name} (Position ${team.position})`);
      } else {
        console.log(`  ℹ️  Trophy "${trophyName} ${trophyPosition}" already exists for ${team.team_name}`);
      }
    }
    
    console.log(`🏆 Trophy auto-award complete: ${trophiesAwarded} new trophies awarded`);
    
    return {
      success: true,
      trophiesAwarded,
      awards
    };
    
  } catch (error: any) {
    console.error('❌ Error awarding season trophies:', error);
    return {
      success: false,
      trophiesAwarded: 0,
      awards: [],
      error: error.message || 'Failed to award trophies'
    };
  }
}

/**
 * Get preview of trophies that would be awarded
 * Does NOT insert into database
 * 
 * @param seasonId - Season ID
 * @param awardTopN - Number of positions to preview
 * @returns Preview of awards that would be created
 */
export async function previewSeasonTrophies(
  seasonId: string,
  awardTopN: number = 2
): Promise<{
  success: boolean;
  preview: {
    team_id: string;
    team_name: string;
    position: number;
    trophy_name: string;
    trophy_type: string;
    alreadyAwarded: boolean;
  }[];
  error?: string;
}> {
  try {
    const sql = getTournamentDb();
    
    // 1. Get final standings
    const standings = await sql`
      SELECT 
        team_id,
        team_name,
        position,
        points,
        goal_difference
      FROM teamstats
      WHERE season_id = ${seasonId}
        AND position IS NOT NULL
      ORDER BY position ASC
      LIMIT ${awardTopN}
    `;
    
    if (standings.length === 0) {
      return {
        success: false,
        preview: [],
        error: 'No teams with positions found'
      };
    }
    
    // 2. Check which trophies already exist
    const existingTrophies = await sql`
      SELECT team_id, trophy_name
      FROM team_trophies
      WHERE season_id = ${seasonId}
        AND trophy_type IN ('league', 'runner_up', 'third_place')
    `;
    
    const existingMap = new Map<string, Set<string>>();
    for (const trophy of existingTrophies) {
      if (!existingMap.has(trophy.team_id)) {
        existingMap.set(trophy.team_id, new Set());
      }
      existingMap.get(trophy.team_id)!.add(trophy.trophy_name);
    }
    
    // 3. Build preview
    const preview = standings.map((team: any) => {
      let trophyType = '';
      let trophyName = '';
      
      if (team.position === 1) {
        trophyType = 'league';
        trophyName = 'League Winner';
      } else if (team.position === 2) {
        trophyType = 'runner_up';
        trophyName = 'Runner Up';
      } else if (team.position === 3) {
        trophyType = 'third_place';
        trophyName = 'Third Place';
      } else {
        trophyType = 'special';
        trophyName = `${team.position}${getOrdinalSuffix(team.position)} Place`;
      }
      
      const alreadyAwarded = existingMap.get(team.team_id)?.has(trophyName) || false;
      
      return {
        team_id: team.team_id,
        team_name: team.team_name,
        position: team.position,
        trophy_name: trophyName,
        trophy_type: trophyType,
        alreadyAwarded
      };
    });
    
    return {
      success: true,
      preview
    };
    
  } catch (error: any) {
    console.error('Error previewing trophies:', error);
    return {
      success: false,
      preview: [],
      error: error.message
    };
  }
}

/**
 * Helper function to get ordinal suffix (1st, 2nd, 3rd, etc.)
 */
function getOrdinalSuffix(num: number): string {
  const j = num % 10;
  const k = num % 100;
  
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}

/**
 * Delete a trophy (for manual corrections)
 * 
 * @param trophyId - Trophy ID to delete
 * @returns Success status
 */
export async function deleteTrophy(trophyId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const sql = getTournamentDb();
    
    await sql`
      DELETE FROM team_trophies
      WHERE id = ${trophyId}
    `;
    
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Manually add a trophy (for cups, special awards, etc.)
 * 
 * @param trophy - Trophy details
 * @returns Success status with trophy ID
 */
export async function addManualTrophy(trophy: {
  team_id: string;
  team_name: string;
  season_id: string;
  trophy_type: string;
  trophy_name: string;
  trophy_position?: string;
  position?: number;
  notes?: string;
}): Promise<{ success: boolean; trophyId?: number; error?: string }> {
  try {
    const sql = getTournamentDb();
    
    const result = await sql`
      INSERT INTO team_trophies (
        team_id,
        team_name,
        season_id,
        trophy_type,
        trophy_name,
        trophy_position,
        position,
        awarded_by,
        notes
      )
      VALUES (
        ${trophy.team_id},
        ${trophy.team_name},
        ${trophy.season_id},
        ${trophy.trophy_type},
        ${trophy.trophy_name},
        ${trophy.trophy_position || null},
        ${trophy.position || null},
        'manual',
        ${trophy.notes || 'Manually awarded by committee'}
      )
      ON CONFLICT (team_id, season_id, trophy_name, trophy_position) DO NOTHING
      RETURNING id
    `;
    
    if (result.length === 0) {
      return {
        success: false,
        error: 'Trophy already exists for this team and season'
      };
    }
    
    return {
      success: true,
      trophyId: result[0].id
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}
