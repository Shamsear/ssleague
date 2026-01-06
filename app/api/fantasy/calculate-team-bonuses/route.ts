import { NextRequest, NextResponse } from 'next/server';
import { getFantasyDb } from '@/lib/neon/fantasy-config';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * POST /api/fantasy/calculate-team-bonuses
 * Calculate and award team affiliation bonuses based on real team performance
 * Uses scoring rules from fantasy_scoring_rules table where applies_to = 'team'
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fixture_id, season_id, round_number } = body;

    if (!fixture_id || !season_id || round_number === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: fixture_id, season_id, round_number' },
        { status: 400 }
      );
    }

    const fantasySql = getFantasyDb();
    const tournamentSql = getTournamentDb();

    // Get fantasy league for this season
    const leagues = await fantasySql`
      SELECT id, league_id, is_active
      FROM fantasy_leagues
      WHERE season_id = ${season_id}
        AND is_active = true
      LIMIT 1
    `;

    if (leagues.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No fantasy league exists for this season',
        bonuses_awarded: 0,
      });
    }

    const fantasy_league_id = leagues[0].league_id;

    // Get team-specific scoring rules
    const teamRules = await fantasySql`
      SELECT rule_type, points_value
      FROM fantasy_scoring_rules
      WHERE league_id = ${fantasy_league_id}
        AND applies_to = 'team'
        AND is_active = true
    `;

    const teamScoringRules = new Map<string, number>();
    teamRules.forEach(rule => {
      teamScoringRules.set(rule.rule_type, rule.points_value);
    });

    if (teamScoringRules.size === 0) {
      console.log('⏭️  No team scoring rules found, skipping team bonuses');
      return NextResponse.json({
        success: true,
        message: 'No team scoring rules configured',
        bonuses_awarded: 0,
      });
    }

    // Get fixture data including home/away teams
    const fixtures = await tournamentSql`
      SELECT 
        home_team_id,
        away_team_id
      FROM fixtures
      WHERE id = ${fixture_id}
      LIMIT 1
    `;

    if (fixtures.length === 0) {
      return NextResponse.json({ error: 'Fixture not found' }, { status: 404 });
    }

    const fixture = fixtures[0];

    // Get matchup results to calculate team scores
    const matchups = await tournamentSql`
      SELECT home_goals, away_goals
      FROM matchups
      WHERE fixture_id = ${fixture_id}
    `;

    if (matchups.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No matchups found for fixture',
        bonuses_awarded: 0,
      });
    }

    // Calculate aggregate scores
    let homeTeamGoals = 0;
    let awayTeamGoals = 0;

    for (const matchup of matchups) {
      homeTeamGoals += matchup.home_goals || 0;
      awayTeamGoals += matchup.away_goals || 0;
    }

    const bonusesAwarded: any[] = [];

    // Award bonuses for home team
    await awardTeamBonus({
      fantasy_league_id,
      real_team_id: fixture.home_team_id,
      fixture_id,
      round_number,
      goals_scored: homeTeamGoals,
      goals_conceded: awayTeamGoals,
      teamScoringRules,
      fantasySql,
      tournamentSql,
      bonusesAwarded,
    });

    // Award bonuses for away team
    await awardTeamBonus({
      fantasy_league_id,
      real_team_id: fixture.away_team_id,
      fixture_id,
      round_number,
      goals_scored: awayTeamGoals,
      goals_conceded: homeTeamGoals,
      teamScoringRules,
      fantasySql,
      tournamentSql,
      bonusesAwarded,
    });

    return NextResponse.json({
      success: true,
      message: `Calculated team bonuses for ${bonusesAwarded.length} fantasy team(s)`,
      bonuses_awarded: bonusesAwarded,
    });
  } catch (error) {
    console.error('Error calculating team bonuses:', error);
    return NextResponse.json(
      { error: 'Failed to calculate team bonuses' },
      { status: 500 }
    );
  }
}

/**
 * Award team affiliation bonuses to fantasy teams based on scoring rules
 */
async function awardTeamBonus(params: {
  fantasy_league_id: string;
  real_team_id: string;
  fixture_id: string;
  round_number: number;
  goals_scored: number;
  goals_conceded: number;
  teamScoringRules: Map<string, number>;
  fantasySql: any;
  tournamentSql: any;
  bonusesAwarded: any[];
}) {
  const {
    fantasy_league_id,
    real_team_id,
    fixture_id,
    round_number,
    goals_scored,
    goals_conceded,
    teamScoringRules,
    fantasySql,
    tournamentSql,
    bonusesAwarded,
  } = params;

  // TEAM CHANGE SUPPORT: Check if any teams changed their supported team after round 13
  const TEAM_CHANGE_AFTER_ROUND = 13;

  // Get team changes for this league
  const teamChanges = await fantasySql`
    SELECT 
      team_id,
      old_supported_team_id,
      old_supported_team_name,
      new_supported_team_id,
      new_supported_team_name
    FROM supported_team_changes
    WHERE league_id = ${fantasy_league_id}
  `;

  const teamChangeMap = new Map();
  teamChanges.forEach((change: any) => {
    teamChangeMap.set(change.team_id, {
      oldTeamId: change.old_supported_team_id,
      oldTeamName: change.old_supported_team_name,
      newTeamId: change.new_supported_team_id,
      newTeamName: change.new_supported_team_name
    });
  });

  // Get ALL fantasy teams first
  const allFantasyTeams = await fantasySql`
    SELECT team_id, team_name, supported_team_id, supported_team_name
    FROM fantasy_teams
    WHERE league_id = ${fantasy_league_id}
      AND supported_team_id IS NOT NULL
  `;

  // Filter teams based on round number and team changes
  // Match: SSPSLT0015 (fixture) against SSPSLT0015_SSPSLS16 (fantasy team)
  const fantasyTeams = allFantasyTeams.filter((team: any) => {
    const teamChange = teamChangeMap.get(team.team_id);

    if (!teamChange) {
      // Team never changed, use current supported team
      return team.supported_team_id === real_team_id ||
        team.supported_team_id.startsWith(`${real_team_id}_`);
    }

    // Team changed after round 13
    if (round_number <= TEAM_CHANGE_AFTER_ROUND) {
      // For rounds 1-13, use OLD supported team
      return teamChange.oldTeamId === real_team_id ||
        teamChange.oldTeamId.startsWith(`${real_team_id}_`);
    } else {
      // For rounds 14+, use NEW supported team
      return teamChange.newTeamId === real_team_id ||
        teamChange.newTeamId.startsWith(`${real_team_id}_`) ||
        team.supported_team_id === real_team_id ||
        team.supported_team_id.startsWith(`${real_team_id}_`);
    }
  });

  if (fantasyTeams.length === 0) {
    console.log(`⏭️  No fantasy teams found for real team ${real_team_id}`);
    return;
  }

  // Calculate bonuses based on configured rules
  const won = goals_scored > goals_conceded;
  const draw = goals_scored === goals_conceded;
  const lost = goals_scored < goals_conceded;
  const clean_sheet = goals_conceded === 0;
  const goal_margin = Math.abs(goals_scored - goals_conceded);

  const bonus_breakdown: any = {};
  let total_bonus = 0;

  // Apply ALL configured scoring rules dynamically
  teamScoringRules.forEach((points, ruleType) => {
    let applies = false;

    // Check each rule type
    switch (ruleType) {
      // Result-based rules
      case 'win':
        applies = won;
        break;
      case 'draw':
        applies = draw;
        break;
      case 'loss':
        applies = lost;
        break;

      // Defense-based rules
      case 'clean_sheet':
        applies = clean_sheet;
        break;
      case 'concedes_4_plus_goals':
        applies = goals_conceded >= 4;
        break;
      case 'concedes_6_plus_goals':
        applies = goals_conceded >= 6;
        break;
      case 'concedes_8_plus_goals':
        applies = goals_conceded >= 8;
        break;
      case 'concedes_10_plus_goals':
        applies = goals_conceded >= 10;
        break;
      case 'concedes_15_plus_goals':
        applies = goals_conceded >= 15;
        break;

      // Attack-based rules
      case 'scored_4_plus_goals':
      case 'high_scoring':
        applies = goals_scored >= 4;
        break;
      case 'scored_6_plus_goals':
        applies = goals_scored >= 6;
        break;
      case 'scored_8_plus_goals':
        applies = goals_scored >= 8;
        break;
      case 'scored_10_plus_goals':
        applies = goals_scored >= 10;
        break;
      case 'scored_15_plus_goals':
        applies = goals_scored >= 15;
        break;

      // Margin-based rules
      case 'big_win':
        applies = won && goal_margin >= 3;
        break;
      case 'huge_win':
        applies = won && goal_margin >= 5;
        break;
      case 'narrow_win':
        applies = won && goal_margin === 1;
        break;

      // Combined rules
      case 'shutout_win':
        applies = won && clean_sheet;
        break;

      default:
        // Unknown rule type - log warning but don't fail
        console.log(`⚠️  Unknown team rule type: ${ruleType}`);
        applies = false;
    }

    if (applies) {
      bonus_breakdown[ruleType] = points;
      total_bonus += points;
    }
  });

  // Log the result even if no bonus (or negative)
  if (total_bonus === 0) {
    console.log(`⏭️  No net bonus for team ${real_team_id} (total: ${total_bonus})`);
    return;
  }

  // Note: We still award negative bonuses (penalties) if configured
  console.log(`🎁 Team ${real_team_id} earned ${total_bonus > 0 ? '+' : ''}${total_bonus} points`);

  // Award bonuses to each fantasy team
  for (const fantasyTeam of fantasyTeams) {
    // Check if bonus already awarded
    const existing = await fantasySql`
      SELECT id FROM fantasy_team_bonus_points
      WHERE league_id = ${fantasy_league_id}
        AND team_id = ${fantasyTeam.team_id}
        AND fixture_id = ${fixture_id}
      LIMIT 1
    `;

    if (existing.length > 0) {
      console.log(`✓ Bonus already awarded to ${fantasyTeam.team_name} for fixture ${fixture_id}`);
      continue;
    }

    // Determine which team name to use for the record
    const teamChange = teamChangeMap.get(fantasyTeam.team_id);
    let realTeamName = fantasyTeam.supported_team_name;

    if (teamChange && round_number <= TEAM_CHANGE_AFTER_ROUND) {
      // For rounds 1-13, use the OLD team name
      realTeamName = teamChange.oldTeamName;
    }

    // Record bonus in fantasy_team_bonus_points
    await fantasySql`
      INSERT INTO fantasy_team_bonus_points (
        league_id,
        team_id,
        real_team_id,
        real_team_name,
        fixture_id,
        round_number,
        bonus_breakdown,
        total_bonus,
        calculated_at
      ) VALUES (
        ${fantasy_league_id},
        ${fantasyTeam.team_id},
        ${real_team_id},
        ${realTeamName},
        ${fixture_id},
        ${round_number},
        ${JSON.stringify(bonus_breakdown)},
        ${total_bonus},
        NOW()
      )
    `;

    // Update fantasy team points
    await fantasySql`
      UPDATE fantasy_teams
      SET
        passive_points = passive_points + ${total_bonus},
        total_points = total_points + ${total_bonus},
        updated_at = NOW()
      WHERE team_id = ${fantasyTeam.team_id}
    `;

    console.log(`🎁 Awarded ${total_bonus} bonus points to ${fantasyTeam.team_name} (affiliated with ${realTeamName})`);
    Object.entries(bonus_breakdown).forEach(([key, value]) => {
      if ((value as number) !== 0) {
        console.log(`   - ${key}: ${(value as number) > 0 ? '+' : ''}${value} pts`);
      }
    });

    bonusesAwarded.push({
      fantasy_team_id: fantasyTeam.team_id,
      fantasy_team_name: fantasyTeam.team_name,
      real_team_name: fantasyTeam.supported_team_name,
      total_bonus,
      breakdown: bonus_breakdown,
    });
  }
}
