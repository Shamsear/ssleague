import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * PUT /api/fantasy/scoring-rules/[ruleId]
 * Update a scoring rule
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const { ruleId } = await params;
    const body = await request.json();
    const { rule_name, description, points_value, is_active, applies_to } = body;

    const result = await fantasySql`
      UPDATE scoring_rules
      SET 
        rule_name = COALESCE(${rule_name}, rule_name),
        description = COALESCE(${description}, description),
        points_value = COALESCE(${points_value}, points_value),
        is_active = COALESCE(${is_active}, is_active),
        applies_to = COALESCE(${applies_to}, applies_to),
        updated_at = CURRENT_TIMESTAMP
      WHERE rule_id = ${ruleId}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Scoring rule not found' },
        { status: 404 }
      );
    }

    console.log(`✅ Scoring rule updated: ${result[0].rule_name}`);

    return NextResponse.json({
      success: true,
      message: 'Scoring rule updated successfully',
      rule: {
        rule_id: result[0].rule_id,
        rule_name: result[0].rule_name,
        points_value: Number(result[0].points_value),
        is_active: result[0].is_active,
      },
    });
  } catch (error) {
    console.error('Error updating scoring rule:', error);
    return NextResponse.json(
      { error: 'Failed to update scoring rule' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/fantasy/scoring-rules/[ruleId]
 * Delete a scoring rule
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const { ruleId } = await params;

    const result = await fantasySql`
      DELETE FROM scoring_rules
      WHERE rule_id = ${ruleId}
      RETURNING rule_name
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Scoring rule not found' },
        { status: 404 }
      );
    }

    console.log(`✅ Scoring rule deleted: ${result[0].rule_name}`);

    return NextResponse.json({
      success: true,
      message: 'Scoring rule deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting scoring rule:', error);
    return NextResponse.json(
      { error: 'Failed to delete scoring rule' },
      { status: 500 }
    );
  }
}
