import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * GET /api/fantasy/scoring-rules?league_id=xxx
 * Get all scoring rules for a league
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const league_id = searchParams.get('league_id');

    if (!league_id) {
      return NextResponse.json(
        { error: 'league_id is required' },
        { status: 400 }
      );
    }

    const rules = await fantasySql`
      SELECT * FROM scoring_rules
      WHERE league_id = ${league_id}
      ORDER BY rule_type ASC, created_at ASC
    `;

    return NextResponse.json({
      success: true,
      rules: rules.map((rule: any) => ({
        rule_id: rule.rule_id,
        rule_name: rule.rule_name,
        rule_type: rule.rule_type,
        description: rule.description,
        points_value: Number(rule.points_value),
        applies_to: rule.applies_to,
        is_active: rule.is_active,
      })),
    });
  } catch (error) {
    console.error('Error fetching scoring rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scoring rules' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fantasy/scoring-rules
 * Create a new scoring rule
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { league_id, rule_name, rule_type, description, points_value, applies_to } = body;

    if (!league_id || !rule_name || !rule_type || points_value === undefined) {
      return NextResponse.json(
        { error: 'league_id, rule_name, rule_type, and points_value are required' },
        { status: 400 }
      );
    }

    const result = await fantasySql`
      INSERT INTO scoring_rules (
        league_id, rule_name, rule_type, description, points_value, applies_to
      ) VALUES (
        ${league_id}, ${rule_name}, ${rule_type}, ${description || null}, 
        ${points_value}, ${applies_to || 'player'}
      )
      RETURNING *
    `;

    console.log(`✅ Scoring rule created: ${rule_name} (${points_value} pts)`);

    return NextResponse.json({
      success: true,
      message: 'Scoring rule created successfully',
      rule: {
        rule_id: result[0].rule_id,
        rule_name: result[0].rule_name,
        rule_type: result[0].rule_type,
        points_value: Number(result[0].points_value),
      },
    });
  } catch (error) {
    console.error('Error creating scoring rule:', error);
    return NextResponse.json(
      { error: 'Failed to create scoring rule' },
      { status: 500 }
    );
  }
}
