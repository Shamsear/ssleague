import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * PUT /api/fantasy/scoring-rules/[ruleId]
 * Update a scoring rule (committee only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const { ruleId } = await params;
    const body = await request.json();
    const { points_value, description, is_active } = body;

    if (!ruleId) {
      return NextResponse.json(
        { error: 'Rule ID is required' },
        { status: 400 }
      );
    }

    // Get current rule
    const ruleDoc = await adminDb
      .collection('fantasy_scoring_rules')
      .doc(ruleId)
      .get();

    if (!ruleDoc.exists) {
      return NextResponse.json(
        { error: 'Scoring rule not found' },
        { status: 404 }
      );
    }

    // Update rule
    const updateData: any = {
      updated_at: FieldValue.serverTimestamp(),
    };

    if (points_value !== undefined) {
      updateData.points_value = points_value;
    }
    if (description !== undefined) {
      updateData.description = description;
    }
    if (is_active !== undefined) {
      updateData.is_active = is_active;
    }

    await adminDb
      .collection('fantasy_scoring_rules')
      .doc(ruleId)
      .update(updateData);

    return NextResponse.json({
      success: true,
      message: 'Scoring rule updated successfully',
      rule_id: ruleId,
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
 * GET /api/fantasy/scoring-rules/[ruleId]
 * Get a specific scoring rule
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const { ruleId } = await params;

    if (!ruleId) {
      return NextResponse.json(
        { error: 'Rule ID is required' },
        { status: 400 }
      );
    }

    const ruleDoc = await adminDb
      .collection('fantasy_scoring_rules')
      .doc(ruleId)
      .get();

    if (!ruleDoc.exists) {
      return NextResponse.json(
        { error: 'Scoring rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      rule: {
        id: ruleDoc.id,
        ...ruleDoc.data(),
      },
    });
  } catch (error) {
    console.error('Error fetching scoring rule:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scoring rule' },
      { status: 500 }
    );
  }
}
