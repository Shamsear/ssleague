import { getTournamentDb } from '@/lib/neon/tournament-config';

export interface LineupValidationResult {
  isValid: boolean;
  errors: string[];
  classicPlayerCount: number;
}

export interface LineupData {
  starting_xi: string[];
  substitutes: string[];
}

/**
 * Validate lineup meets all requirements
 */
export async function validateLineup(
  lineup: LineupData,
  seasonId: string,
  teamId: string,
  tournamentId?: string
): Promise<LineupValidationResult> {
  const errors: string[] = [];
  const sql = getTournamentDb();

  console.log('🔍 validateLineup - Input:', {
    starting_xi_count: lineup.starting_xi?.length,
    substitutes_count: lineup.substitutes?.length,
    starting_xi: lineup.starting_xi,
    substitutes: lineup.substitutes,
    seasonId,
    teamId
  });

  // 1. Check starting XI count
  if (!lineup.starting_xi || lineup.starting_xi.length !== 5) {
    const error = 'Starting XI must have exactly 5 players';
    console.error('❌', error, '- Got:', lineup.starting_xi?.length);
    errors.push(error);
  }

  // 2. Check substitutes count (0 to 2 allowed)
  if (lineup.substitutes && lineup.substitutes.length > 2) {
    const error = 'Cannot have more than 2 substitute players';
    console.error('❌', error, '- Got:', lineup.substitutes?.length);
    errors.push(error);
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      classicPlayerCount: 0,
    };
  }

  // 3. Check for duplicate players
  const allPlayers = [...lineup.starting_xi, ...lineup.substitutes];
  const uniquePlayers = new Set(allPlayers);
  
  if (uniquePlayers.size !== allPlayers.length) {
    errors.push('Duplicate players found in lineup');
  }

  // 4. Check if all players belong to the team and are registered for season
  console.log('🔍 Checking player eligibility:', { allPlayers, seasonId, teamId });
  const playerChecks = await sql`
    SELECT player_id, category
    FROM player_seasons
    WHERE player_id = ANY(${allPlayers})
    AND season_id = ${seasonId}
    AND team_id = ${teamId}
  `;
  console.log('🔍 Player checks result:', playerChecks);
  console.log('🔍 Unique category values found:', [...new Set(playerChecks.map((p: any) => p.category))]);

  if (playerChecks.length !== allPlayers.length) {
    const error = 'Some players are not eligible for this team/season';
    console.error('❌', error, '- Expected:', allPlayers.length, 'Found:', playerChecks.length);
    console.error('Missing players:', allPlayers.filter(p => !playerChecks.find((pc: any) => pc.player_id === p)));
    errors.push(error);
  }

  // 5. Validate category requirements from tournament settings
  const startingXIChecks = playerChecks.filter(
    (p: any) => lineup.starting_xi.includes(p.player_id)
  );
  
  console.log('🔍 Starting XI player categories:', {
    total_players_checked: playerChecks.length,
    starting_xi_players: startingXIChecks.length,
    starting_xi_categories: startingXIChecks.map((p: any) => ({ id: p.player_id, category: p.category }))
  });

  // Get category counts
  // Map category names to category IDs for validation
  const categoryNameToId: Record<string, string> = {
    'Classic': 'cat_classic',
    'Legend': 'cat_legend',
    'Rising Star': 'cat_rising_star',
    'Veteran': 'cat_veteran'
  };
  
  const categoryCounts: Record<string, number> = {};
  startingXIChecks.forEach((p: any) => {
    const categoryName = p.category || 'Unknown';
    // Try to get the category ID from the mapping, otherwise use the value as-is
    const categoryId = categoryNameToId[categoryName] || categoryName;
    categoryCounts[categoryId] = (categoryCounts[categoryId] || 0) + 1;
  });

  console.log('🔍 Category counts in starting XI:', categoryCounts);

  // 6. Check tournament settings for category requirements
  if (tournamentId) {
    try {
      const settingsResult = await sql`
        SELECT enable_category_requirements, lineup_category_requirements
        FROM tournament_settings
        WHERE tournament_id = ${tournamentId}
        LIMIT 1
      `;

      if (settingsResult.length > 0) {
        const enableRequirements = settingsResult[0].enable_category_requirements;
        const categoryRequirements = settingsResult[0].lineup_category_requirements;
        
        console.log('🔍 Tournament category settings:', {
          enable_category_requirements: enableRequirements,
          categoryRequirements
        });

        // Only validate if category requirements are enabled
        if (enableRequirements && categoryRequirements && Object.keys(categoryRequirements).length > 0) {
          console.log('🔍 Category requirements ENABLED - validating...');
          
          // Validate each category requirement
          for (const [categoryId, minCount] of Object.entries(categoryRequirements)) {
            const actualCount = categoryCounts[categoryId] || 0;
            console.log(`🔍 Checking category requirement:`, {
              categoryId,
              minCount,
              actualCount,
              categoryCounts,
              hasCategory: categoryId in categoryCounts
            });
            if (actualCount < minCount) {
              errors.push(`Starting XI must have at least ${minCount} player(s) from ${categoryId} category (currently has ${actualCount})`);
            }
          }
        } else {
          console.log('✅ Category requirements DISABLED - skipping validation');
        }
      }
    } catch (error) {
      console.error('Error checking tournament category requirements:', error);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    classicPlayerCount: categoryCounts['Classic'] || categoryCounts['classic'] || 0,
  };
}

/**
 * Check if lineup can still be edited (deadline not passed)
 * Updated to support:
 * 1. Home team can edit until home deadline
 * 2. Both teams can edit during fixture_entry phase (after home deadline, before away deadline, if no matchups)
 */
export async function isLineupEditable(
  fixtureId: string,
  teamId?: string
): Promise<{ editable: boolean; reason?: string; deadline?: string; roundStart?: string; homeDeadline?: string; awayDeadline?: string }> {
  const sql = getTournamentDb();

  // Get fixture and round deadline info
  const result = await sql`
    SELECT 
      f.round_number,
      f.season_id,
      f.tournament_id,
      f.leg,
      f.home_team_id,
      f.away_team_id,
      f.status as fixture_status,
      rd.scheduled_date,
      rd.round_start_time,
      rd.home_fixture_deadline_time,
      rd.away_fixture_deadline_time,
      rd.status as round_status
    FROM fixtures f
    LEFT JOIN round_deadlines rd ON 
      f.round_number = rd.round_number 
      AND f.season_id = rd.season_id
      AND f.tournament_id = rd.tournament_id
      AND f.leg = rd.leg
    WHERE f.id = ${fixtureId}
    LIMIT 1
  `;

  if (result.length === 0) {
    return { editable: false, reason: 'Fixture not found' };
  }

  const fixture = result[0];

  // Don't block based on fixture_status alone - check actual deadlines
  // Only block if fixture is actually completed/finalized
  if (fixture.fixture_status && (fixture.fixture_status === 'completed' || fixture.fixture_status === 'finalized')) {
    return { 
      editable: false, 
      reason: 'Lineup locked - fixture has been completed'
    };
  }

  // Check if round has started and calculate deadlines
  if (fixture.scheduled_date) {
    const now = new Date();
    
    // Convert scheduled_date to YYYY-MM-DD string if it's a Date object
    let scheduledDateStr: string;
    if (fixture.scheduled_date instanceof Date) {
      const year = fixture.scheduled_date.getFullYear();
      const month = String(fixture.scheduled_date.getMonth() + 1).padStart(2, '0');
      const day = String(fixture.scheduled_date.getDate()).padStart(2, '0');
      scheduledDateStr = `${year}-${month}-${day}`;
    } else {
      scheduledDateStr = String(fixture.scheduled_date).split('T')[0];
    }
    
    // Use the same time parsing as fixture page
    const homeTime = fixture.home_fixture_deadline_time || '17:00';
    const awayTime = fixture.away_fixture_deadline_time || '17:00';
    
    // Parse times (HH:MM format)
    const [homeHour, homeMin] = homeTime.split(':').map(Number);
    const [awayHour, awayMin] = awayTime.split(':').map(Number);
    
    // Create deadlines in UTC by converting from IST (UTC+5:30)
    const homeDeadline = new Date(scheduledDateStr);
    homeDeadline.setUTCHours(homeHour - 5, homeMin - 30, 0, 0);
    
    const awayDeadline = new Date(scheduledDateStr);
    awayDeadline.setUTCHours(awayHour - 5, awayMin - 30, 0, 0);
    
    // Round start time (for display purposes)
    const roundStartTimeStr = fixture.round_start_time || fixture.home_fixture_deadline_time || '14:00';
    const [startHour, startMin] = roundStartTimeStr.split(':').map(Number);
    const roundStart = new Date(scheduledDateStr);
    roundStart.setUTCHours(startHour - 5, startMin - 30, 0, 0);
    
    // Check if matchups exist
    const matchupsResult = await sql`
      SELECT COUNT(*) as count
      FROM matchups
      WHERE fixture_id = ${fixtureId}
    `;
    const matchupsExist = matchupsResult[0].count > 0;
    
    // Determine if user is home team
    const isHomeTeam = teamId === fixture.home_team_id;
    
    // Determine current phase based on round status and deadlines
    let currentPhase: 'draft' | 'home_fixture' | 'fixture_entry' | 'result_entry' | 'closed' = 'closed';
    
    // If round_status is null or undefined, determine phase by deadlines only
    if (!fixture.round_status || fixture.round_status === 'pending' || fixture.round_status === 'scheduled') {
      // Round hasn't started yet OR no status set - check if we're before the first deadline
      if (now < homeDeadline) {
        currentPhase = 'draft';
      } else {
        // If we're past home deadline but round status is still pending, treat as draft
        currentPhase = 'draft';
      }
    } else if (fixture.round_status === 'in_progress' || fixture.round_status === 'started' || fixture.round_status === 'active') {
      if (now < homeDeadline) {
        currentPhase = 'home_fixture';
      } else if (now < awayDeadline) {
        currentPhase = 'fixture_entry';
      } else {
        currentPhase = 'result_entry';
      }
    } else if (fixture.round_status === 'completed' || fixture.round_status === 'finalized') {
      currentPhase = 'closed';
    } else {
      // Unknown status - determine by deadlines
      if (now < homeDeadline) {
        currentPhase = 'draft';
      } else if (now < awayDeadline) {
        currentPhase = 'fixture_entry';
      } else {
        currentPhase = 'result_entry';
      }
    }
    
    console.log('🕐 Lineup Editability Check:', {
      fixtureId,
      teamId,
      isHomeTeam,
      matchupsExist,
      currentPhase,
      round_status: fixture.round_status,
      now: now.toISOString(),
      homeDeadline: homeDeadline.toISOString(),
      awayDeadline: awayDeadline.toISOString(),
      roundStart: roundStart.toISOString()
    });
    
    // Determine editability based on phase and matchups (same logic as fixture page)
    let editable = false;
    let reason = '';
    let deadline = roundStart.toISOString();
    
    if (currentPhase === 'draft') {
      // Draft mode - can always edit
      editable = true;
      reason = 'Round not started yet - draft mode';
      deadline = homeDeadline.toISOString();
    } else if (matchupsExist) {
      // Matchups exist - only home team can edit before home deadline
      if (isHomeTeam && now < homeDeadline) {
        editable = true;
        reason = 'Home team can edit until home deadline (will delete matchups)';
        deadline = homeDeadline.toISOString();
      } else {
        editable = false;
        reason = 'Lineup locked - matchups have been created';
      }
    } else {
      // No matchups yet - check phase
      if (now < homeDeadline) {
        // Before home deadline - anyone can edit
        editable = true;
        reason = 'Before home deadline';
        deadline = homeDeadline.toISOString();
      } else if (now < awayDeadline) {
        // After home deadline, before away deadline - both teams can edit
        editable = true;
        reason = 'Fixture entry phase - both teams can edit';
        deadline = awayDeadline.toISOString();
      } else {
        // After away deadline
        editable = false;
        reason = 'Lineup deadline has passed';
      }
    }
    
    console.log('🔒 Editability Result:', {
      editable,
      reason,
      deadline,
      currentPhase
    });

    return { 
      editable,
      reason,
      deadline,
      roundStart: roundStart.toISOString(),
      homeDeadline: homeDeadline.toISOString(),
      awayDeadline: awayDeadline.toISOString()
    };
  }

  return { editable: true, reason: 'Round not scheduled yet' };
}

/**
 * Check if a team has submitted lineup for a fixture
 */
export async function hasSubmittedLineup(
  fixtureId: string,
  teamId: string
): Promise<boolean> {
  const sql = getTournamentDb();

  const result = await sql`
    SELECT id 
    FROM lineups
    WHERE fixture_id = ${fixtureId}
    AND team_id = ${teamId}
    LIMIT 1
  `;

  return result.length > 0;
}

/**
 * Get lineup status for a fixture (both teams)
 */
export async function getFixtureLineupStatus(fixtureId: string) {
  const sql = getTournamentDb();

  const fixture = await sql`
    SELECT 
      id,
      home_team_id,
      away_team_id,
      home_team_name,
      away_team_name,
      round_number,
      season_id
    FROM fixtures
    WHERE id = ${fixtureId}
    LIMIT 1
  `;

  if (fixture.length === 0) {
    return null;
  }

  const fix = fixture[0];

  // Check both team lineups
  const lineups = await sql`
    SELECT 
      team_id,
      is_valid,
      is_locked,
      warning_given,
      selected_by_opponent,
      submitted_at,
      classic_player_count
    FROM lineups
    WHERE fixture_id = ${fixtureId}
    AND team_id IN (${fix.home_team_id}, ${fix.away_team_id})
  `;

  const homeLineup = lineups.find((l: any) => l.team_id === fix.home_team_id);
  const awayLineup = lineups.find((l: any) => l.team_id === fix.away_team_id);

  return {
    fixture: fix,
    homeTeam: {
      id: fix.home_team_id,
      name: fix.home_team_name,
      hasLineup: !!homeLineup,
      lineupStatus: homeLineup || null,
    },
    awayTeam: {
      id: fix.away_team_id,
      name: fix.away_team_name,
      hasLineup: !!awayLineup,
      lineupStatus: awayLineup || null,
    },
  };
}

/**
 * Validate substitution
 */
export async function validateSubstitution(
  lineupId: string,
  playerOut: string,
  playerIn: string
): Promise<{ valid: boolean; error?: string }> {
  const sql = getTournamentDb();

  // Get lineup
  const lineup = await sql`
    SELECT 
      starting_xi,
      substitutes,
      is_locked
    FROM lineups
    WHERE id = ${lineupId}
    LIMIT 1
  `;

  if (lineup.length === 0) {
    return { valid: false, error: 'Lineup not found' };
  }

  const lineupData = lineup[0];
  const startingXI = lineupData.starting_xi as string[];
  const subs = lineupData.substitutes as string[];

  // Check if player_out is in starting XI
  if (!startingXI.includes(playerOut)) {
    return { valid: false, error: 'Player to substitute out is not in starting XI' };
  }

  // Check if player_in is in substitutes
  if (!subs.includes(playerIn)) {
    return { valid: false, error: 'Player to substitute in is not in substitutes' };
  }

  return { valid: true };
}

/**
 * Generate lineup ID
 */
export function generateLineupId(fixtureId: string, teamId: string): string {
  return `lineup_${fixtureId}_${teamId}`;
}
