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

  // Get fantasy teams affiliated with this real team
  const fantasyTeams = await fantasySql`
    SELECT team_id, team_name, supported_team_id, supported_team_name
    FROM fantasy_teams
    WHERE league_id = ${fantasy_league_id}
      AND supported_team_id = ${real_team_id}
  `;

  if (fantasyTeams.length === 0) {
    console.log(`⏭️  No fantasy teams found for real team ${real_team_id}`);
    return;
  }

  // Calculate bonuses based on configured rules
  const won = goals_scored > goals_conceded;
  const draw = goals_scored === goals_conceded;
  const lost = goals_scored < goals_conceded;
  const clean_sheet = goals_conceded === 0;
  const high_scoring = goals_scored >= 4;

  const bonus_breakdown: any = {};
  let total_bonus = 0;

  // Apply scoring rules that match the team's performance
  if (won && teamScoringRules.has('win')) {
    bonus_breakdown.win = teamScoringRules.get('win')!;
    total_bonus += bonus_breakdown.win;
  }
  if (draw && teamScoringRules.has('draw')) {
    bonus_breakdown.draw = teamScoringRules.get('draw')!;
    total_bonus += bonus_breakdown.draw;
  }
  if (lost && teamScoringRules.has('loss')) {
    bonus_breakdown.loss = teamScoringRules.get('loss')!;
    total_bonus += bonus_breakdown.loss;
  }
  if (clean_sheet && teamScoringRules.has('clean_sheet')) {
    bonus_breakdown.clean_sheet = teamScoringRules.get('clean_sheet')!;
    total_bonus += bonus_breakdown.clean_sheet;
  }
  if (high_scoring && teamScoringRules.has('high_scoring')) {
    bonus_breakdown.high_scoring = teamScoringRules.get('high_scoring')!;
    total_bonus += bonus_breakdown.high_scoring;
  }

  if (total_bonus === 0) {
    console.log(`⏭️  No bonuses for team ${real_team_id} (Loss)`);
    return;
  }

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
        ${fantasyTeam.supported_team_name},
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

    console.log(`🎁 Awarded ${total_bonus} bonus points to ${fantasyTeam.team_name} (affiliated with ${fantasyTeam.supported_team_name})`);
    Object.entries(bonus_breakdown).forEach(([key, value]) => {
      if (value !== 0) {
        console.log(`   - ${key}: ${value > 0 ? '+' : ''}${value} pts`);
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
