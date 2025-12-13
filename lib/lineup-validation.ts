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
 */
export async function isLineupEditable(
  fixtureId: string
): Promise<{ editable: boolean; reason?: string; deadline?: string; roundStart?: string; homeDeadline?: string; awayDeadline?: string }> {
  const sql = getTournamentDb();

  // Get fixture and round deadline info
  const result = await sql`
    SELECT 
      f.round_number,
      f.season_id,
      f.tournament_id,
      f.leg,
      f.status as fixture_status,
      rd.scheduled_date,
      rd.round_start_time,
      rd.home_fixture_deadline_time,
      rd.status as round_status
    FROM fixtures f
    LEFT JOIN round_deadlines rd ON 
      f.round_number = rd.round_number 
      AND f.season_id = rd.season_id
      AND f.leg = rd.leg
    WHERE f.id = ${fixtureId}
    LIMIT 1
  `;

  if (result.length === 0) {
    return { editable: false, reason: 'Fixture not found' };
  }

  const fixture = result[0];

  // Check if fixture has been generated (status changed from 'scheduled')
  if (fixture.fixture_status && fixture.fixture_status !== 'scheduled') {
    return { 
      editable: false, 
      reason: 'Lineup locked - fixture has been generated'
    };
  }

  // Check if round has started and calculate deadlines
  if (fixture.scheduled_date) {
    const now = new Date();
    
    // Use round_start_time (actual time round began/restarted)
    // This represents the true round start, which may differ from scheduled time
    const roundStartTimeStr = fixture.round_start_time || fixture.home_fixture_deadline_time || '14:00';
    
    // Convert scheduled_date to YYYY-MM-DD string if it's a Date object
    let scheduledDateStr: string;
    if (fixture.scheduled_date instanceof Date) {
      // Extract just the date part in YYYY-MM-DD format
      const year = fixture.scheduled_date.getFullYear();
      const month = String(fixture.scheduled_date.getMonth() + 1).padStart(2, '0');
      const day = String(fixture.scheduled_date.getDate()).padStart(2, '0');
      scheduledDateStr = `${year}-${month}-${day}`;
    } else {
      // It's already a string, use as-is
      scheduledDateStr = String(fixture.scheduled_date).split('T')[0]; // Extract date part if timestamp
    }
    
    console.log('🔍 Date construction inputs:', {
      scheduled_date: fixture.scheduled_date,
      scheduled_date_type: typeof fixture.scheduled_date,
      scheduledDateStr,
      round_start_time: fixture.round_start_time,
      home_fixture_deadline_time: fixture.home_fixture_deadline_time,
      roundStartTimeStr,
      dateString: `${scheduledDateStr}T${roundStartTimeStr}:00+05:30`
    });
    
    // Combine date with round start time (using IST timezone)
    const roundStart = new Date(`${scheduledDateStr}T${roundStartTimeStr}:00+05:30`);
    
    console.log('🔍 Date construction result:', {
      roundStart,
      isValid: !isNaN(roundStart.getTime()),
      timestamp: roundStart.getTime()
    });
    
    // Lineup deadline = round start time (no grace period)
    const lineupDeadline = new Date(roundStart.getTime());

    console.log('🕐 Lineup Deadline Check:', {
      scheduled_date: fixture.scheduled_date,
      home_fixture_deadline_time: fixture.home_fixture_deadline_time,
      round_start_time: fixture.round_start_time,
      actualRoundStartTimeStr: roundStartTimeStr,
      roundStart: roundStart.toISOString(),
      roundStartLocal: roundStart.toLocaleString(),
      roundStartIST: roundStart.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      lineupDeadline: lineupDeadline.toISOString(),
      lineupDeadlineLocal: lineupDeadline.toLocaleString(),
      lineupDeadlineIST: lineupDeadline.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      now: now.toISOString(),
      nowLocal: now.toLocaleString(),
      nowIST: now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      isPassed: now > lineupDeadline,
      minutesRemaining: Math.floor((lineupDeadline.getTime() - now.getTime()) / 60000)
    });

    // Check if deadline has passed
    if (now > lineupDeadline) {
      return { 
        editable: false, 
        reason: 'Lineup deadline has passed (round start time)', 
        deadline: lineupDeadline.toISOString(),
        roundStart: roundStart.toISOString()
      };
    }

    return { 
      editable: true,
      deadline: lineupDeadline.toISOString(),
      roundStart: roundStart.toISOString()
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
