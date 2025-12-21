import { NextRequest, NextResponse } from 'next/server';
import { getFantasyDb } from '@/lib/neon/fantasy-config';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * GET /api/fantasy/leagues/[leagueId]
 * Get fantasy league details with teams and scoring rules from PostgreSQL
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  try {
    const { leagueId } = await params;

    if (!leagueId) {
      return NextResponse.json(
        { error: 'League ID is required' },
        { status: 400 }
      );
    }

    const sql = getFantasyDb();

    console.log('Fetching fantasy league for:', leagueId);

    // Get fantasy league by league_id or season_id (could be passed as season_id)
    // League IDs should be in format SSPSLFLS{number}
    const leagues = await sql`
      SELECT 
        id,
        league_id,
        league_name,
        season_id,
        season_name,
        budget_per_team,
        max_squad_size,
        max_transfers_per_window,
        points_cost_per_transfer,
        is_active,
        created_at,
        updated_at
      FROM fantasy_leagues
      WHERE league_id = ${leagueId}
         OR season_id = ${leagueId}
      LIMIT 1
    `;

    console.log('Found leagues:', leagues.length);

    // If league not found, try to auto-create it from season data
    if (leagues.length === 0) {
      console.log('League not found, attempting auto-creation...');
      
      try {
        const tournamentSql = getTournamentDb();
        
        // Get season info from tournaments (leagueId is season_id like SSPSLS16)
        const tournaments = await tournamentSql`
          SELECT DISTINCT season_id
          FROM tournaments
          WHERE season_id = ${leagueId}
          LIMIT 1
        `;

        if (tournaments.length === 0) {
          console.error('Season not found in tournaments:', leagueId);
          return NextResponse.json(
            { 
              error: 'Season not found',
              message: `Season ${leagueId} does not exist. Please create the tournament/season first before creating a fantasy league.`,
              details: 'A tournament must be created for this season before the fantasy league can be initialized.'
            },
            { status: 404 }
          );
        }

        const seasonId = leagueId;
        const seasonNumber = seasonId.replace('SSPSLS', '');
        const seasonName = `Season ${seasonNumber}`;
        const newLeagueId = `SSPSLFLS${seasonNumber}`;

        console.log('Creating league:', newLeagueId, 'for season:', seasonId);

        // Default star rating prices (3-10 stars)
        const defaultStarPrices = [
          { stars: 3, price: 5 },
          { stars: 4, price: 7 },
          { stars: 5, price: 10 },
          { stars: 6, price: 13 },
          { stars: 7, price: 16 },
          { stars: 8, price: 20 },
          { stars: 9, price: 25 },
          { stars: 10, price: 30 },
        ];

        // Create the league
        const newLeague = await sql`
          INSERT INTO fantasy_leagues (
            league_id,
            season_id,
            season_name,
            league_name,
            budget_per_team,
            max_squad_size,
            max_transfers_per_window,
            points_cost_per_transfer,
            star_rating_prices,
            is_active
          ) VALUES (
            ${newLeagueId},
            ${seasonId},
            ${seasonName},
            ${seasonName + ' Fantasy League'},
            100.00,
            15,
            2,
            4,
            ${JSON.stringify(defaultStarPrices)},
            true
          )
          RETURNING *
        `;

        if (newLeague.length === 0) {
          console.error('Failed to insert league');
          return NextResponse.json(
            { error: 'Failed to auto-create fantasy league' },
            { status: 500 }
          );
        }

        console.log('League created, now creating scoring rules...');

        // Create default scoring rules for the new league
        const defaultRules = [
          { rule_type: 'goals_scored', rule_name: 'Goal Scored', points_value: 5, description: 'Points for scoring a goal' },
          { rule_type: 'goals_conceded', rule_name: 'Goal Conceded', points_value: -1, description: 'Points deducted for conceding a goal' },
          { rule_type: 'win', rule_name: 'Match Win', points_value: 3, description: 'Points for winning a match' },
          { rule_type: 'draw', rule_name: 'Match Draw', points_value: 1, description: 'Points for drawing a match' },
          { rule_type: 'loss', rule_name: 'Match Loss', points_value: 0, description: 'Points for losing a match' },
          { rule_type: 'clean_sheet', rule_name: 'Clean Sheet', points_value: 4, description: 'Bonus for not conceding any goals' },
          { rule_type: 'motm', rule_name: 'Man of the Match', points_value: 5, description: 'Bonus for being Man of the Match' },
          { rule_type: 'fine_goals', rule_name: 'Fine Goal', points_value: -2, description: 'Penalty for fine goals' },
          { rule_type: 'substitution_penalty', rule_name: 'Substitution', points_value: -1, description: 'Penalty for substitutions' },
        ];

        for (const rule of defaultRules) {
          const ruleId = `${newLeagueId}-${rule.rule_type}`;
          try {
            await sql`
              INSERT INTO fantasy_scoring_rules (
                rule_id,
                league_id,
                rule_type,
                rule_name,
                points_value,
                description,
                is_active
              ) VALUES (
                ${ruleId},
                ${newLeagueId},
                ${rule.rule_type},
                ${rule.rule_name},
                ${rule.points_value},
                ${rule.description},
                true
              )
            `;
          } catch (ruleError) {
            console.error('Error creating scoring rule:', rule.rule_type, ruleError);
          }
        }

        console.log(`✅ Auto-created fantasy league: ${newLeagueId} with ${defaultRules.length} scoring rules`);

        // Use the newly created league
        leagues.push(newLeague[0]);
      } catch (creationError) {
        console.error('Error during league auto-creation:', creationError);
        return NextResponse.json(
          { 
            error: 'Failed to auto-create fantasy league',
            details: creationError instanceof Error ? creationError.message : 'Unknown error'
          },
          { status: 500 }
        );
      }
    }

    const league = leagues[0];

    // Get fantasy teams with player counts
    const teams = await sql`
      SELECT 
        ft.team_id,
        ft.team_name,
        ft.owner_name,
        ft.total_points,
        ft.rank,
        ft.draft_submitted,
        ft.supported_team_id,
        ft.supported_team_name,
        COALESCE(ft.passive_points, 0) as passive_points,
        COALESCE(ft.budget_remaining, 0) as budget_remaining,
        COUNT(DISTINCT fs.real_player_id) as player_count
      FROM fantasy_teams ft
      LEFT JOIN fantasy_squad fs ON ft.team_id = fs.team_id
      WHERE ft.league_id = ${league.league_id}
      GROUP BY ft.team_id, ft.team_name, ft.owner_name, ft.total_points, ft.rank, ft.draft_submitted, ft.supported_team_id, ft.supported_team_name, ft.passive_points, ft.budget_remaining
      ORDER BY ft.rank ASC NULLS LAST, ft.total_points DESC
    `;

    // Get scoring rules (if table exists)
    let scoringRules = [];
    try {
      scoringRules = await sql`
        SELECT 
          id,
          rule_type,
          points_value,
          is_active,
          created_at
        FROM fantasy_scoring_rules
        WHERE league_id = ${league.league_id}
          AND is_active = true
        ORDER BY rule_type ASC
      `;
    } catch (error) {
      console.log('Scoring rules table does not exist yet, returning empty array');
    }

    return NextResponse.json({
      success: true,
      league: {
        id: league.id,
        league_id: league.league_id,
        name: league.league_name,
        season_id: league.season_id,
        season_name: league.season_name,
        status: league.is_active ? 'active' : 'inactive',
        budget_per_team: Number(league.budget_per_team) || 0,
        max_squad_size: league.max_squad_size,
        max_transfers_per_window: league.max_transfers_per_window,
        points_cost_per_transfer: league.points_cost_per_transfer,
        created_at: league.created_at,
        updated_at: league.updated_at,
      },
      teams: teams.map(team => ({
        id: team.team_id,
        team_name: team.team_name,
        owner_name: team.owner_name,
        total_points: Number(team.total_points) || 0,
        rank: team.rank || null,
        player_count: Number(team.player_count) || 0,
        draft_submitted: team.draft_submitted || false,
        supported_team_id: team.supported_team_id || null,
        supported_team_name: team.supported_team_name || null,
        passive_points: Number(team.passive_points) || 0,
        budget_remaining: Number(team.budget_remaining) || 0,
      })),
      scoring_rules: scoringRules.map(rule => ({
        id: rule.id,
        rule_type: rule.rule_type,
        points_value: Number(rule.points_value) || 0,
        is_active: rule.is_active,
        created_at: rule.created_at,
      })),
      total_teams: teams.length,
    });
  } catch (error) {
    console.error('Error fetching fantasy league:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch fantasy league',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
