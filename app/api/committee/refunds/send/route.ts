import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(['committee_admin'], request);
    
    if (!auth.authenticated) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { teamId, refundType, amount, reason } = body;

    if (!teamId || !refundType || !amount || !reason) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    if (amount <= 0) {
      return NextResponse.json({ success: false, error: 'Amount must be positive' }, { status: 400 });
    }

    if (!['football', 'real_player'].includes(refundType)) {
      return NextResponse.json({ success: false, error: 'Invalid refund type' }, { status: 400 });
    }

    // Get active season
    const seasonsSnapshot = await adminDb.collection('seasons')
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (seasonsSnapshot.empty) {
      return NextResponse.json({ success: false, error: 'No active season found' }, { status: 404 });
    }

    const seasonDoc = seasonsSnapshot.docs[0];
    const seasonId = seasonDoc.id;

    // Get team_season
    const teamSeasonSnapshot = await adminDb.collection('team_seasons')
      .where('team_id', '==', teamId)
      .where('season_id', '==', seasonId)
      .limit(1)
      .get();

    if (teamSeasonSnapshot.empty) {
      return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 });
    }

    const teamSeasonDoc = teamSeasonSnapshot.docs[0];
    const teamSeasonData = teamSeasonDoc.data();
    const teamName = teamSeasonData.team_name || 'Unknown';

    console.log(`\n💸 [Refund] Processing ${refundType} refund for ${teamName}`);
    console.log(`Amount: £${amount}`);
    console.log(`Reason: ${reason}`);

    // Determine which fields to update
    const budgetField = refundType === 'football' ? 'football_budget' : 'real_player_budget';
    const spentField = refundType === 'football' ? 'football_spent' : 'real_player_spent';

    const currentBudget = teamSeasonData[budgetField] || 0;
    const currentSpent = teamSeasonData[spentField] || 0;

    const newBudget = currentBudget + amount;
    const newSpent = Math.max(0, currentSpent - amount); // Don't go negative

    console.log(`Budget: £${currentBudget} → £${newBudget}`);
    console.log(`Spent: £${currentSpent} → £${newSpent}`);

    // Update Firebase team_seasons
    await teamSeasonDoc.ref.update({
      [budgetField]: newBudget,
      [spentField]: newSpent
    });

    console.log('✅ Firebase team_seasons updated');

    // Update Neon teams (only for football refunds)
    if (refundType === 'football') {
      await sql`
        UPDATE teams
        SET 
          football_budget = football_budget + ${amount},
          football_spent = GREATEST(0, football_spent - ${amount}),
          updated_at = NOW()
        WHERE id = ${teamId}
        AND season_id = ${seasonId}
      `;
      console.log('✅ Neon teams updated');
    }

    // Create transaction in Firebase
    const transactionRef = adminDb.collection('transactions').doc();
    await transactionRef.set({
      team_id: teamId,
      team_name: teamName,
      season_id: seasonId,
      type: 'refund',
      category: refundType === 'football' ? 'football_refund' : 'real_player_refund',
      amount: amount,
      description: `Refund: ${reason}`,
      reason: reason,
      created_at: FieldValue.serverTimestamp(),
      created_by: 'committee_admin',
      budget_field: budgetField,
      spent_field: spentField,
      previous_budget: currentBudget,
      new_budget: newBudget,
      previous_spent: currentSpent,
      new_spent: newSpent
    });

    console.log('✅ Firebase transaction created');

    console.log('✅ Refund completed successfully\n');

    return NextResponse.json({
      success: true,
      teamName,
      refundType,
      amount,
      newBudget,
      newSpent
    });

  } catch (error: any) {
    console.error('❌ Error sending refund:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send refund' },
      { status: 500 }
    );
  }
}
