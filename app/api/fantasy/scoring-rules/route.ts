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
      SELECT * FROM fantasy_scoring_rules
      WHERE league_id = ${league_id}
      ORDER BY rule_type ASC, created_at ASC
    `;

    return NextResponse.json({
      success: true,
      rules: rules.map((rule: any) => ({
        rule_id: rule.id || rule.rule_id,
        rule_name: rule.rule_name,
        rule_type: rule.rule_type,
        description: rule.description,
        points_value: Number(rule.points_value),
        applies_to: rule.applies_to || 'player',
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
    const { league_id, rule_name, rule_type, description, points_value, applies_to, is_bonus_rule, bonus_conditions } = body;

    if (!league_id || !rule_name || !rule_type || points_value === undefined) {
      return NextResponse.json(
        { error: 'league_id, rule_name, rule_type, and points_value are required' },
        { status: 400 }
      );
    }

    // Generate a unique rule_id
    const rule_id = `${league_id}_${rule_type}_${Date.now()}`;
    
    const result = await fantasySql`
      INSERT INTO fantasy_scoring_rules (
        rule_id, league_id, rule_type, rule_name, points_value, description, applies_to, is_active
      ) VALUES (
        ${rule_id}, ${league_id}, ${rule_type}, ${rule_name}, 
        ${points_value}, ${description || null}, ${applies_to || 'player'}, ${true}
      )
      RETURNING *
    `;
    
    console.log(`✅ Created scoring rule: ${rule_name} (${points_value} pts)`);

    return NextResponse.json({
      success: true,
      message: 'Scoring rule created successfully',
      rule: {
        rule_id: result[0].id || result[0].rule_id,
        rule_name: result[0].rule_name,
        rule_type: result[0].rule_type,
        points_value: Number(result[0].points_value),
        applies_to: result[0].applies_to,
        is_active: result[0].is_active,
      },
    });
  } catch (error: any) {
    console.error('Error creating scoring rule:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      constraint: error.constraint,
    });
    return NextResponse.json(
      { 
        error: 'Failed to create scoring rule',
        details: error.message || 'Unknown error',
        constraint: error.constraint,
      },
      { status: 500 }
    );
  }
}
