import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * GET /api/fantasy/h2h/fixtures
 * Get H2H fixtures for a league and optionally a specific round
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('league_id');
    const roundId = searchParams.get('round_id');

    if (!leagueId) {
      return NextResponse.json(
        { error: 'league_id is required' },
        { status: 400 }
      );
    }

    let fixtures;
    
    if (roundId) {
      // Get fixtures for specific round
      fixtures = await fantasySql`
        SELECT 
          f.fixture_id,
          f.round_id,
          f.team_a_id,
          f.team_b_id,
          f.team_a_score,
          f.team_b_score,
          f.status,
          f.created_at,
          ta.team_name as team_a_name,
          tb.team_name as team_b_name
        FROM fantasy_h2h_fixtures f
        LEFT JOIN fantasy_teams ta ON f.team_a_id = ta.team_id
        LEFT JOIN fantasy_teams tb ON f.team_b_id = tb.team_id
        WHERE f.league_id = ${leagueId}
          AND f.round_id = ${roundId}
        ORDER BY f.created_at ASC
      `;
    } else {
      // Get all fixtures for league
      fixtures = await fantasySql`
        SELECT 
          f.fixture_id,
          f.round_id,
          f.team_a_id,
          f.team_b_id,
          f.team_a_score,
          f.team_b_score,
          f.status,
          f.created_at,
          ta.team_name as team_a_name,
          tb.team_name as team_b_name
        FROM fantasy_h2h_fixtures f
        LEFT JOIN fantasy_teams ta ON f.team_a_id = ta.team_id
        LEFT JOIN fantasy_teams tb ON f.team_b_id = tb.team_id
        WHERE f.league_id = ${leagueId}
        ORDER BY f.round_id ASC, f.created_at ASC
      `;
    }

    return NextResponse.json({
      success: true,
      fixtures
    });

  } catch (error) {
    console.error('Error fetching H2H fixtures:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch H2H fixtures',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fantasy/h2h/fixtures
 * Generate H2H fixtures for a round (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { league_id, round_id } = body;

    if (!league_id || !round_id) {
      return NextResponse.json(
        { error: 'league_id and round_id are required' },
        { status: 400 }
      );
    }

    // Get all teams in the league
    const teams = await fantasySql`
      SELECT team_id, team_name
      FROM fantasy_teams
      WHERE league_id = ${league_id}
      ORDER BY RANDOM()
    `;

    if (teams.length < 2) {
      return NextResponse.json(
        { error: 'Need at least 2 teams to generate fixtures' },
        { status: 400 }
      );
    }

    // Check if fixtures already exist for this round
    const existing = await fantasySql`
      SELECT COUNT(*) as count
      FROM fantasy_h2h_fixtures
      WHERE league_id = ${league_id} AND round_id = ${round_id}
    `;

    if (existing[0].count > 0) {
      return NextResponse.json(
        { error: 'Fixtures already exist for this round' },
        { status: 400 }
      );
    }

    // Generate random pairings
    const fixtures = [];
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < shuffled.length; i += 2) {
      if (i + 1 < shuffled.length) {
        const fixtureId = `h2h_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        await fantasySql`
          INSERT INTO fantasy_h2h_fixtures (
            fixture_id, league_id, round_id,
            team_a_id, team_b_id, status
          ) VALUES (
            ${fixtureId}, ${league_id}, ${round_id},
            ${shuffled[i].team_id}, ${shuffled[i + 1].team_id}, 'pending'
          )
        `;

        fixtures.push({
          fixture_id: fixtureId,
          team_a: shuffled[i].team_name,
          team_b: shuffled[i + 1].team_name
        });
      }
    }

    // Handle odd number of teams (one team gets a bye)
    if (shuffled.length % 2 !== 0) {
      const byeTeam = shuffled[shuffled.length - 1];
      console.log(`Team ${byeTeam.team_name} gets a bye this round`);
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${fixtures.length} H2H fixtures`,
      fixtures
    });

  } catch (error) {
    console.error('Error generating H2H fixtures:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate H2H fixtures',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
