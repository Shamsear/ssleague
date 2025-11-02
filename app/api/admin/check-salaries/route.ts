import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

/**
 * Check salary deductions for a season
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const season_id = searchParams.get('season_id') || 'SSPSLS16';

    console.log(`\n💰 Checking Salary Deductions for Season ${season_id}\n`);

    // Get all salary payment transactions
    const transactionsSnapshot = await adminDb.collection('transactions')
      .where('season_id', '==', season_id)
      .where('transaction_type', '==', 'salary_payment')
      .where('currency_type', '==', 'real_player')
      .get();

    const transactions: any[] = [];
    const byTeam: { [key: string]: { total: number; count: number } } = {};

    transactionsSnapshot.forEach(doc => {
      const data = doc.data();
      const team_id = data.team_id;
      const amount = Math.abs(data.amount);

      transactions.push({
        id: doc.id,
        team_id,
        amount,
        balance_before: data.balance_before,
        balance_after: data.balance_after,
        fixture_id: data.metadata?.fixture_id,
        player_count: data.metadata?.player_count,
        created_at: data.created_at
      });

      if (!byTeam[team_id]) {
        byTeam[team_id] = { total: 0, count: 0 };
      }
      byTeam[team_id].total += amount;
      byTeam[team_id].count += 1;
    });

    // Get team balances
    const teamSeasonsSnapshot = await adminDb.collection('team_seasons')
      .where('season_id', '==', season_id)
      .get();

    const balances: any[] = [];
    teamSeasonsSnapshot.forEach(doc => {
      const data = doc.data();
      const team_id = data.team_id || doc.id.split('_')[0];
      balances.push({
        team_id,
        current_balance: data.real_player_budget || 0,
        starting_balance: data.real_player_starting_balance || 5000,
        spent: (data.real_player_starting_balance || 5000) - (data.real_player_budget || 0)
      });
    });

    return NextResponse.json({
      success: true,
      season_id,
      transactions: {
        count: transactions.length,
        by_team: byTeam,
        details: transactions
      },
      balances: balances.sort((a, b) => a.team_id.localeCompare(b.team_id))
    });

  } catch (error) {
    console.error('Error checking salaries:', error);
    return NextResponse.json(
      { error: 'Failed to check salaries' },
      { status: 500 }
    );
  }
}
