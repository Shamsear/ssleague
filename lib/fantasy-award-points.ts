/**
 * Fantasy Award Points Integration
 * 
 * Maps player awards to fantasy scoring rules and adds points automatically
 */

import { getFantasyDb } from './neon/fantasy-config';

/**
 * Map award types to fantasy rule types
 * This allows committees to create fantasy rules that match award names
 */
export function mapAwardToRuleType(awardType: string): string {
  // Normalize award type to lowercase and remove spaces/special chars
  const normalized = awardType.toLowerCase().replace(/[^a-z0-9]/g, '_');
  
  // Common mappings
  const mappings: Record<string, string> = {
    'man_of_the_match': 'motm',
    'motm': 'motm',
    'player_of_the_day': 'player_of_day',
    'player_of_the_week': 'player_of_week',
    'player_of_the_month': 'player_of_month',
    'golden_boot': 'golden_boot',
    'best_attacker': 'best_attacker',
    'best_midfielder': 'best_midfielder',
    'best_defender': 'best_defender',
    'best_goalkeeper': 'best_goalkeeper',
    'most_assists': 'most_assists',
    'most_goals': 'most_goals',
    'best_player': 'best_player',
  };
  
  return mappings[normalized] || normalized;
}

/**
 * Add fantasy points for a player award
 * 
 * @param playerId - Real player ID
 * @param playerName - Player name
 * @param seasonId - Season ID
 * @param awardType - Type of award given
 * @param fixtureId - Optional fixture ID if award is match-specific
 * @param roundNumber - Optional round number
 * @returns Object with success status and points added
 */
export async function addFantasyPointsForAward(
  playerId: string,
  playerName: string,
  seasonId: string,
  awardType: string,
  fixtureId?: string,
  roundNumber?: number
): Promise<{ success: boolean; points: number; message: string }> {
  try {
    const sql = getFantasyDb();
    
    // Get fantasy league for this season
    const leagues = await sql`
      SELECT league_id, season_id
      FROM fantasy_leagues
      WHERE season_id = ${seasonId}
        AND is_active = true
      LIMIT 1
    `;
    
    if (leagues.length === 0) {
      console.log('No active fantasy league for season:', seasonId);
      return {
        success: false,
        points: 0,
        message: 'No active fantasy league found for this season'
      };
    }
    
    const leagueId = leagues[0].league_id;
    const ruleType = mapAwardToRuleType(awardType);
    
    // Check if there's a fantasy scoring rule for this award
    const rules = await sql`
      SELECT rule_id, points_value
      FROM fantasy_scoring_rules
      WHERE league_id = ${leagueId}
        AND rule_type = ${ruleType}
        AND is_active = true
      LIMIT 1
    `;
    
    if (rules.length === 0) {
      console.log(`No fantasy rule found for award type: ${awardType} (${ruleType})`);
      return {
        success: false,
        points: 0,
        message: `No fantasy scoring rule exists for "${awardType}"`
      };
    }
    
    const pointsValue = Number(rules[0].points_value);
    
    // Find all fantasy teams that have drafted this player
    const squads = await sql`
      SELECT team_id
      FROM fantasy_squad
      WHERE league_id = ${leagueId}
        AND real_player_id = ${playerId}
    `;
    
    if (squads.length === 0) {
      console.log(`Player ${playerName} not drafted by any fantasy team`);
      return {
        success: true,
        points: 0,
        message: `Player not drafted in fantasy league`
      };
    }
    
    console.log(`Adding ${pointsValue} fantasy points for ${playerName}'s "${awardType}" award to ${squads.length} team(s)`);
    
    // Add points for each team that owns this player
    let teamsUpdated = 0;
    for (const squad of squads) {
      const teamId = squad.team_id;
      
      // Check if points already recorded for this award
      const existing = await sql`
        SELECT id FROM fantasy_player_points
        WHERE team_id = ${teamId}
          AND real_player_id = ${playerId}
          AND league_id = ${leagueId}
          AND award_type = ${awardType}
          ${fixtureId ? sql`AND fixture_id = ${fixtureId}` : sql``}
        LIMIT 1
      `;
      
      if (existing.length > 0) {
        console.log(`Award points already recorded for team ${teamId}`);
        continue;
      }
      
      // Insert fantasy points record
      await sql`
        INSERT INTO fantasy_player_points (
          team_id,
          real_player_id,
          player_name,
          league_id,
          fixture_id,
          round_number,
          award_type,
          award_points,
          total_points,
          created_at
        ) VALUES (
          ${teamId},
          ${playerId},
          ${playerName},
          ${leagueId},
          ${fixtureId || null},
          ${roundNumber || null},
          ${awardType},
          ${pointsValue},
          ${pointsValue},
          NOW()
        )
      `;
      
      // Update fantasy team total points
      await sql`
        UPDATE fantasy_teams
        SET total_points = total_points + ${pointsValue},
            updated_at = NOW()
        WHERE team_id = ${teamId}
      `;
      
      teamsUpdated++;
    }
    
    return {
      success: true,
      points: pointsValue,
      message: `Added ${pointsValue} points to ${teamsUpdated} fantasy team(s)`
    };
  } catch (error) {
    console.error('Error adding fantasy points for award:', error);
    return {
      success: false,
      points: 0,
      message: error instanceof Error ? error.message : 'Failed to add fantasy points'
    };
  }
}
