import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const leagueId = searchParams.get('league_id');

    if (!leagueId) {
      return NextResponse.json(
        { error: 'league_id is required' },
        { status: 400 }
      );
    }

    const sql = neon(process.env.FANTASY_DATABASE_URL!);

    // Fetch active scoring rules for the league
    const rules = await sql`
      SELECT 
        rule_id,
        rule_type,
        rule_name,
        points_value,
        applies_to,
        description
      FROM fantasy_scoring_rules
      WHERE league_id = ${leagueId}
        AND is_active = true
      ORDER BY rule_type, rule_name
    `;

    return NextResponse.json({ rules });
  } catch (error: any) {
    console.error('Error fetching scoring rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scoring rules', details: error.message },
      { status: 500 }
    );
  }
}
