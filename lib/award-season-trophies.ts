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
 * Auto-award trophies for all tournaments in a season
 * Awards trophies based on tournament standings (league, group stage, knockout)
 * 
 * @param seasonId - Season ID (e.g., "SSPSLS01")
 * @param awardTopN - Number of positions to award for league tournaments (default: 2)
 * @returns Result with awarded trophies
 */
export async function awardSeasonTrophies(
  seasonId: string,
  awardTopN: number = 2
): Promise<TrophyAwardResult> {
  try {
    const sql = getTournamentDb();
    
    console.log(`🏆 Starting trophy auto-award for season ${seasonId}...`);
    
    // Get all tournaments in the season
    const tournaments = await sql`
      SELECT id, tournament_name, tournament_type, has_knockout_stage, is_pure_knockout, has_group_stage
      FROM tournaments
      WHERE season_id = ${seasonId}
      ORDER BY is_primary DESC, display_order ASC
    `;
    
    if (tournaments.length === 0) {
      return {
        success: false,
        trophiesAwarded: 0,
        awards: [],
        error: 'No tournaments found for this season'
      };
    }
    
    const awards = [];
    let trophiesAwarded = 0;
    
    // Process each tournament
    for (const tournament of tournaments) {
      console.log(`\n📋 Processing tournament: ${tournament.tournament_name}`);
      
      // Get completed fixtures for this tournament
      const fixtures = await sql`
        SELECT 
          home_team_id, home_team_name, away_team_id, away_team_name,
          home_score, away_score, knockout_round, group_name
        FROM fixtures
        WHERE tournament_id = ${tournament.id}
          AND status = 'completed'
          AND result IS NOT NULL
      `;
      
      if (fixtures.length === 0) {
        console.log(`  ⚠️  No completed fixtures found`);
        continue;
      }
      
      // Award based on tournament format
      if (tournament.is_pure_knockout || tournament.has_knockout_stage) {
        // Award knockout trophies (Winner and Runner-up from final)
        const knockoutAwards = await awardKnockoutTrophies(
          sql, seasonId, tournament, fixtures
        );
        awards.push(...knockoutAwards.awards);
        trophiesAwarded += knockoutAwards.count;
      } else if (tournament.has_group_stage) {
        // Award group stage winners
        const groupAwards = await awardGroupStageTrophies(
          sql, seasonId, tournament, fixtures
        );
        awards.push(...groupAwards.awards);
        trophiesAwarded += groupAwards.count;
      } else {
        // Award league trophies
        const leagueAwards = await awardLeagueTrophies(
          sql, seasonId, tournament, fixtures, awardTopN
        );
        awards.push(...leagueAwards.awards);
        trophiesAwarded += leagueAwards.count;
      }
    }
    
    console.log(`\n🏆 Trophy auto-award complete: ${trophiesAwarded} new trophies awarded`);
    
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
 * Award trophies for league-format tournaments
 */
async function awardLeagueTrophies(
  sql: any,
  seasonId: string,
  tournament: any,
  fixtures: any[],
  awardTopN: number
) {
  const standings = calculateStandings(fixtures);
  const topTeams = standings.slice(0, awardTopN);
  
  const awards = [];
  let count = 0;
  
  for (const team of topTeams) {
    let trophyType = '';
    let trophyPosition = '';
    
    if (team.position === 1) {
      trophyType = 'cup';
      trophyPosition = 'Winner';
    } else if (team.position === 2) {
      trophyType = 'runner_up';
      trophyPosition = 'Runner Up';
    } else if (team.position === 3) {
      trophyType = 'third_place';
      trophyPosition = 'Third Place';
    } else {
      trophyType = 'special';
      trophyPosition = `${team.position}${getOrdinalSuffix(team.position)} Place`;
    }
    
    const result = await sql`
      INSERT INTO team_trophies (
        team_id, team_name, season_id, trophy_type, trophy_name, trophy_position,
        position, awarded_by, notes
      )
      VALUES (
        ${team.team_id}, ${team.team_name}, ${seasonId}, ${trophyType},
        ${tournament.tournament_name}, ${trophyPosition}, ${team.position},
        'system', 'Auto-awarded based on tournament standings'
      )
      ON CONFLICT (team_id, season_id, trophy_name, trophy_position) DO NOTHING
      RETURNING id
    `;
    
    if (result.length > 0) {
      count++;
      awards.push({
        team_id: team.team_id,
        team_name: team.team_name,
        trophy_type: trophyType,
        trophy_name: `${tournament.tournament_name} ${trophyPosition}`,
        position: team.position
      });
      console.log(`  ✅ ${team.team_name} - ${tournament.tournament_name} ${trophyPosition}`);
    }
  }
  
  return { awards, count };
}

/**
 * Award trophies for knockout tournaments
 */
async function awardKnockoutTrophies(
  sql: any,
  seasonId: string,
  tournament: any,
  fixtures: any[]
) {
  const knockoutFixtures = fixtures.filter((f: any) => f.knockout_round);
  
  // Find the final (last round)
  const rounds = [...new Set(knockoutFixtures.map((f: any) => f.knockout_round))];
  const finalRound = rounds.sort().pop();
  
  if (!finalRound) {
    console.log(`  ⚠️  No final found`);
    return { awards: [], count: 0 };
  }
  
  const finalFixture = knockoutFixtures.find((f: any) => f.knockout_round === finalRound);
  
  if (!finalFixture) {
    return { awards: [], count: 0 };
  }
  
  const awards = [];
  let count = 0;
  
  // Determine winner and runner-up
  const winner = finalFixture.home_score > finalFixture.away_score
    ? { id: finalFixture.home_team_id, name: finalFixture.home_team_name }
    : { id: finalFixture.away_team_id, name: finalFixture.away_team_name };
  
  const runnerUp = finalFixture.home_score > finalFixture.away_score
    ? { id: finalFixture.away_team_id, name: finalFixture.away_team_name }
    : { id: finalFixture.home_team_id, name: finalFixture.home_team_name };
  
  // Award winner
  const winnerResult = await sql`
    INSERT INTO team_trophies (
      team_id, team_name, season_id, trophy_type, trophy_name, trophy_position,
      position, awarded_by, notes
    )
    VALUES (
      ${winner.id}, ${winner.name}, ${seasonId}, 'cup',
      ${tournament.tournament_name}, 'Winner', 1,
      'system', 'Auto-awarded based on knockout final'
    )
    ON CONFLICT (team_id, season_id, trophy_name, trophy_position) DO NOTHING
    RETURNING id
  `;
  
  if (winnerResult.length > 0) {
    count++;
    awards.push({
      team_id: winner.id,
      team_name: winner.name,
      trophy_type: 'cup',
      trophy_name: `${tournament.tournament_name} Winner`,
      position: 1
    });
    console.log(`  ✅ ${winner.name} - ${tournament.tournament_name} Winner`);
  }
  
  // Award runner-up
  const runnerUpResult = await sql`
    INSERT INTO team_trophies (
      team_id, team_name, season_id, trophy_type, trophy_name, trophy_position,
      position, awarded_by, notes
    )
    VALUES (
      ${runnerUp.id}, ${runnerUp.name}, ${seasonId}, 'runner_up',
      ${tournament.tournament_name}, 'Runner Up', 2,
      'system', 'Auto-awarded based on knockout final'
    )
    ON CONFLICT (team_id, season_id, trophy_name, trophy_position) DO NOTHING
    RETURNING id
  `;
  
  if (runnerUpResult.length > 0) {
    count++;
    awards.push({
      team_id: runnerUp.id,
      team_name: runnerUp.name,
      trophy_type: 'runner_up',
      trophy_name: `${tournament.tournament_name} Runner Up`,
      position: 2
    });
    console.log(`  ✅ ${runnerUp.name} - ${tournament.tournament_name} Runner Up`);
  }
  
  return { awards, count };
}

/**
 * Award trophies for group stage tournaments
 */
async function awardGroupStageTrophies(
  sql: any,
  seasonId: string,
  tournament: any,
  fixtures: any[]
) {
  const groupFixtures = fixtures.filter((f: any) => f.group_name);
  const groups: Record<string, any[]> = {};
  
  // Calculate standings per group
  groupFixtures.forEach((fixture: any) => {
    const groupName = fixture.group_name;
    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(fixture);
  });
  
  const awards = [];
  let count = 0;
  
  // Award winner of each group
  for (const [groupName, groupFixtures] of Object.entries(groups)) {
    const standings = calculateStandings(groupFixtures);
    if (standings.length === 0) continue;
    
    const winner = standings[0];
    
    const result = await sql`
      INSERT INTO team_trophies (
        team_id, team_name, season_id, trophy_type, trophy_name, trophy_position,
        position, awarded_by, notes
      )
      VALUES (
        ${winner.team_id}, ${winner.team_name}, ${seasonId}, 'special',
        ${tournament.tournament_name}, ${groupName + ' Winner'}, 1,
        'system', 'Auto-awarded as group stage winner'
      )
      ON CONFLICT (team_id, season_id, trophy_name, trophy_position) DO NOTHING
      RETURNING id
    `;
    
    if (result.length > 0) {
      count++;
      awards.push({
        team_id: winner.team_id,
        team_name: winner.team_name,
        trophy_type: 'special',
        trophy_name: `${tournament.tournament_name} ${groupName} Winner`,
        position: 1
      });
      console.log(`  ✅ ${winner.team_name} - ${groupName} Winner`);
    }
  }
  
  return { awards, count };
}

/**
 * Calculate standings from fixtures
 */
function calculateStandings(fixtures: any[]) {
  const teamStats: Record<string, any> = {};
  
  fixtures.forEach((fixture: any) => {
    const homeId = fixture.home_team_id;
    const awayId = fixture.away_team_id;
    const homeScore = fixture.home_score || 0;
    const awayScore = fixture.away_score || 0;
    
    if (!teamStats[homeId]) {
      teamStats[homeId] = {
        team_id: homeId,
        team_name: fixture.home_team_name,
        points: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_for: 0,
        goals_against: 0,
        goal_difference: 0
      };
    }
    if (!teamStats[awayId]) {
      teamStats[awayId] = {
        team_id: awayId,
        team_name: fixture.away_team_name,
        points: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_for: 0,
        goals_against: 0,
        goal_difference: 0
      };
    }
    
    teamStats[homeId].goals_for += homeScore;
    teamStats[homeId].goals_against += awayScore;
    teamStats[awayId].goals_for += awayScore;
    teamStats[awayId].goals_against += homeScore;
    
    if (homeScore > awayScore) {
      teamStats[homeId].wins++;
      teamStats[homeId].points += 3;
      teamStats[awayId].losses++;
    } else if (awayScore > homeScore) {
      teamStats[awayId].wins++;
      teamStats[awayId].points += 3;
      teamStats[homeId].losses++;
    } else {
      teamStats[homeId].draws++;
      teamStats[awayId].draws++;
      teamStats[homeId].points += 1;
      teamStats[awayId].points += 1;
    }
  });
  
  const standings = Object.values(teamStats).map((team: any) => ({
    ...team,
    goal_difference: team.goals_for - team.goals_against
  })).sort((a: any, b: any) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
    return b.goals_for - a.goals_for;
  });
  
  // Add positions
  standings.forEach((team, index) => {
    team.position = index + 1;
  });
  
  return standings;
}

/**
 * Get preview of trophies that would be awarded for all tournaments
 * Does NOT insert into database
 * 
 * @param seasonId - Season ID
 * @param awardTopN - Number of positions to preview for league tournaments
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
    tournament_name: string;
    alreadyAwarded: boolean;
  }[];
  error?: string;
}> {
  try {
    const sql = getTournamentDb();
    
    // Get all tournaments in the season
    const tournaments = await sql`
      SELECT id, tournament_name, tournament_type, has_knockout_stage, is_pure_knockout, has_group_stage
      FROM tournaments
      WHERE season_id = ${seasonId}
      ORDER BY is_primary DESC, display_order ASC
    `;
    
    if (tournaments.length === 0) {
      return {
        success: false,
        preview: [],
        error: 'No tournaments found for this season'
      };
    }
    
    // Get existing trophies
    const existingTrophies = await sql`
      SELECT team_id, trophy_name, trophy_position
      FROM team_trophies
      WHERE season_id = ${seasonId}
    `;
    
    const existingMap = new Map<string, Set<string>>();
    for (const trophy of existingTrophies) {
      const key = `${trophy.trophy_name}|${trophy.trophy_position}`;
      if (!existingMap.has(trophy.team_id)) {
        existingMap.set(trophy.team_id, new Set());
      }
      existingMap.get(trophy.team_id)!.add(key);
    }
    
    const preview = [];
    
    // Process each tournament
    for (const tournament of tournaments) {
      const fixtures = await sql`
        SELECT 
          home_team_id, home_team_name, away_team_id, away_team_name,
          home_score, away_score, knockout_round, group_name
        FROM fixtures
        WHERE tournament_id = ${tournament.id}
          AND status = 'completed'
          AND result IS NOT NULL
      `;
      
      if (fixtures.length === 0) continue;
      
      // Generate preview based on tournament format
      if (tournament.is_pure_knockout || tournament.has_knockout_stage) {
        const knockoutFixtures = fixtures.filter((f: any) => f.knockout_round);
        const rounds = [...new Set(knockoutFixtures.map((f: any) => f.knockout_round))];
        const finalRound = rounds.sort().pop();
        
        if (finalRound) {
          const finalFixture = knockoutFixtures.find((f: any) => f.knockout_round === finalRound);
          if (finalFixture) {
            const winner = finalFixture.home_score > finalFixture.away_score
              ? { id: finalFixture.home_team_id, name: finalFixture.home_team_name }
              : { id: finalFixture.away_team_id, name: finalFixture.away_team_name };
            
            const runnerUp = finalFixture.home_score > finalFixture.away_score
              ? { id: finalFixture.away_team_id, name: finalFixture.away_team_name }
              : { id: finalFixture.home_team_id, name: finalFixture.home_team_name };
            
            preview.push({
              team_id: winner.id,
              team_name: winner.name,
              position: 1,
              trophy_name: `${tournament.tournament_name} Winner`,
              trophy_type: 'cup',
              tournament_name: tournament.tournament_name,
              alreadyAwarded: existingMap.get(winner.id)?.has(`${tournament.tournament_name}|Winner`) || false
            });
            
            preview.push({
              team_id: runnerUp.id,
              team_name: runnerUp.name,
              position: 2,
              trophy_name: `${tournament.tournament_name} Runner Up`,
              trophy_type: 'runner_up',
              tournament_name: tournament.tournament_name,
              alreadyAwarded: existingMap.get(runnerUp.id)?.has(`${tournament.tournament_name}|Runner Up`) || false
            });
          }
        }
      } else {
        // League format
        const standings = calculateStandings(fixtures);
        const topTeams = standings.slice(0, awardTopN);
        
        for (const team of topTeams) {
          let trophyType = '';
          let trophyPosition = '';
          
          if (team.position === 1) {
            trophyType = 'cup';
            trophyPosition = 'Winner';
          } else if (team.position === 2) {
            trophyType = 'runner_up';
            trophyPosition = 'Runner Up';
          } else if (team.position === 3) {
            trophyType = 'third_place';
            trophyPosition = 'Third Place';
          } else {
            trophyType = 'special';
            trophyPosition = `${team.position}${getOrdinalSuffix(team.position)} Place`;
          }
          
          preview.push({
            team_id: team.team_id,
            team_name: team.team_name,
            position: team.position,
            trophy_name: `${tournament.tournament_name} ${trophyPosition}`,
            trophy_type: trophyType,
            tournament_name: tournament.tournament_name,
            alreadyAwarded: existingMap.get(team.team_id)?.has(`${tournament.tournament_name}|${trophyPosition}`) || false
          });
        }
      }
    }
    
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
