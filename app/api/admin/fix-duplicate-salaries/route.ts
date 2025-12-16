import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const debug = searchParams.get('debug') === 'true';

    // Find duplicate match reward transactions from Firebase
    // Get all transactions and filter in memory to avoid needing an index
    const transactionsRef = adminDb.collection('transactions');
    const snapshot = await transactionsRef.get();

    const allTransactions: any[] = [];
    const transactionTypes = new Set<string>();
    
    snapshot.forEach(doc => {
      const data = doc.data();
      transactionTypes.add(data.transaction_type || 'undefined');
      allTransactions.push({
        id: doc.id,
        ...data,
        created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at
      });
    });

    console.log('📊 Total transactions:', allTransactions.length);
    console.log('📊 Transaction types found:', Array.from(transactionTypes));

    // Filter for salary-related transactions (could be match_reward, salary, or other types)
    const transactions = allTransactions.filter(tx => {
      // Look for transactions that might be salary deductions
      const isSalaryRelated = 
        tx.transaction_type === 'match_reward' ||
        tx.transaction_type === 'salary' ||
        tx.transaction_type === 'match_salary' ||
        (tx.description && tx.description.toLowerCase().includes('salary')) ||
        (tx.description && tx.description.toLowerCase().includes('match'));
      
      return isSalaryRelated;
    });

    console.log('💰 Salary-related transactions:', transactions.length);

    // Sort by created_at in memory
    transactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // If debug mode, return all transactions
    if (debug) {
      return NextResponse.json({
        success: true,
        debug: true,
        total_transactions: transactions.length,
        transactions: transactions.slice(0, 50), // First 50 for debugging
        sample_keys: transactions.slice(0, 10).map(tx => ({
          id: tx.id,
          team_id: tx.team_id,
          description: tx.description,
          amount_football: tx.amount_football,
          amount_real: tx.amount_real,
          created_at: tx.created_at,
          key: `${tx.team_id}_${tx.description}_${tx.amount_football}_${tx.amount_real}`
        }))
      });
    }

    // Group by team_id and description to find duplicates
    const grouped: Record<string, any[]> = {};
    transactions.forEach(tx => {
      // Use amount or 0 if undefined, to properly group transactions
      const amountFootball = tx.amount_football ?? tx.amount ?? 0;
      const amountReal = tx.amount_real ?? 0;
      const key = `${tx.team_id}_${tx.description}_${amountFootball}_${amountReal}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(tx);
    });

    console.log('🔍 Grouped transactions:', Object.keys(grouped).length, 'unique keys');
    console.log('🔍 Groups with multiple transactions:', Object.values(grouped).filter(g => g.length > 1).length);

    // Find groups with duplicates (same day)
    const duplicates: any[] = [];
    Object.entries(grouped).forEach(([key, group]) => {
      if (group.length > 1) {
        console.log(`🔍 Found group with ${group.length} transactions:`, key);
        
        // Sort by created_at
        group.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        // Check if they're on the same day
        for (let i = 1; i < group.length; i++) {
          const date1 = new Date(group[i-1].created_at);
          const date2 = new Date(group[i].created_at);
          
          console.log(`  📅 Comparing: ${date1.toISOString()} vs ${date2.toISOString()}`);
          console.log(`  📅 Date strings: "${date1.toDateString()}" vs "${date2.toDateString()}"`);
          
          // Check if same day (same date, ignoring time)
          const sameDay = date1.toDateString() === date2.toDateString();
          
          const timeDiff = Math.abs(date2.getTime() - date1.getTime()) / 1000; // seconds
          const timeDiffMinutes = Math.round(timeDiff / 60);
          
          console.log(`  ⏱️  Time diff: ${timeDiffMinutes} minutes, Same day: ${sameDay}`);
          
          // Flag as duplicate if same day OR within 5 minutes
          if (sameDay || timeDiff < 300) {
            console.log(`  ✅ DUPLICATE FOUND!`);
            duplicates.push({
              original: group[i-1],
              duplicate: group[i],
              timeDiff: timeDiffMinutes,
              sameDay
            });
          } else {
            console.log(`  ❌ Not a duplicate (different day and > 5 min apart)`);
          }
        }
      }
    });

    console.log('🎯 Total duplicates found:', duplicates.length);

    return NextResponse.json({
      success: true,
      duplicates,
      total: duplicates.length
    });
  } catch (error) {
    console.error('Error finding duplicates:', error);
    return NextResponse.json(
      { error: 'Failed to find duplicates', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, duplicateId, duplicates } = body;

    if (action === 'reverse') {
      console.log('🔧 Starting reversal for duplicate:', duplicateId);
      
      // Get the duplicate transaction from Firebase
      const duplicateDoc = await adminDb.collection('transactions').doc(duplicateId).get();
      
      if (!duplicateDoc.exists) {
        console.log('❌ Transaction not found:', duplicateId);
        return NextResponse.json(
          { error: 'Transaction not found' },
          { status: 404 }
        );
      }

      const tx = duplicateDoc.data();
      console.log('📄 Duplicate transaction:', {
        id: duplicateId,
        team_id: tx!.team_id,
        description: tx!.description,
        amount: tx!.amount_football ?? tx!.amount,
        created_at: tx!.created_at
      });

      // DELETE the duplicate transaction instead of creating a reversal
      console.log('🗑️  Deleting duplicate transaction...');
      await adminDb.collection('transactions').doc(duplicateId).delete();
      console.log('✅ Duplicate deleted');

      // Recalculate real player balance from remaining transactions for this season
      console.log('💰 Recalculating real player balance for:', tx!.team_id, 'season:', tx!.season_id);
      const teamTransactions = await adminDb.collection('transactions')
        .where('team_id', '==', tx!.team_id)
        .where('season_id', '==', tx!.season_id)
        .get();

      let realTotal = 0;

      teamTransactions.forEach(doc => {
        const t = doc.data();
        const amt = t.amount ?? 0;
        realTotal += amt;
      });

      console.log('📊 New real player balance calculated:', realTotal);

      // Update team_seasons real_player_budget in Firebase
      console.log('💾 Updating team_seasons real_player_budget...');
      const teamSeasonId = `${tx!.team_id}_${tx!.season_id}`;
      await adminDb.collection('team_seasons').doc(teamSeasonId).update({
        real_player_budget: realTotal,
        updated_at: new Date()
      });
      console.log('✅ Team_seasons real_player_budget updated:', teamSeasonId);

      return NextResponse.json({
        success: true,
        message: 'Duplicate deleted and real_player_budget recalculated',
        deleted_transaction: {
          id: duplicateId,
          description: tx!.description,
          amount: tx!.amount ?? 0
        },
        new_balance: { realTotal }
      });
    } else if (action === 'reverse_all') {
      console.log('🔧 Starting bulk reversal for', duplicates.length, 'duplicates');
      const results = [];
      const deletedTransactions = [];

      for (const dup of duplicates) {
        console.log('🗑️  Processing duplicate:', dup.duplicate.id);
        const duplicateDoc = await adminDb.collection('transactions').doc(dup.duplicate.id).get();
        
        if (!duplicateDoc.exists) {
          console.log('⚠️  Transaction not found, skipping:', dup.duplicate.id);
          continue;
        }

        const tx = duplicateDoc.data();
        console.log('  📄 Deleting:', tx!.description, 'for team', tx!.team_id);

        // DELETE the duplicate transaction
        await adminDb.collection('transactions').doc(dup.duplicate.id).delete();
        
        deletedTransactions.push({
          id: dup.duplicate.id,
          team_id: tx!.team_id,
          season_id: tx!.season_id,
          description: tx!.description,
          amount: tx!.amount_football ?? tx!.amount
        });
        
        results.push({ team_id: tx!.team_id, deleted: true });
        console.log('  ✅ Deleted');
      }

      // Recalculate all affected team_seasons balances
      // Group by team_id and season_id
      const affectedTeamSeasons = new Map<string, { team_id: string; season_id: string }>();
      deletedTransactions.forEach(tx => {
        const key = `${tx.team_id}_${tx.season_id}`;
        if (!affectedTeamSeasons.has(key)) {
          affectedTeamSeasons.set(key, { team_id: tx.team_id, season_id: tx.season_id });
        }
      });
      
      console.log('💰 Recalculating budgets for', affectedTeamSeasons.size, 'team_seasons');
      
      const updatedTeams = [];
      for (const [teamSeasonId, { team_id, season_id }] of affectedTeamSeasons) {
        console.log('  📊 Recalculating:', teamSeasonId);
        const teamTransactions = await adminDb.collection('transactions')
          .where('team_id', '==', team_id)
          .where('season_id', '==', season_id)
          .get();

        let realTotal = 0;

        teamTransactions.forEach(doc => {
          const t = doc.data();
          const amt = t.amount ?? 0;
          realTotal += amt;
        });

        console.log('  💾 New real player balance:', realTotal);
        await adminDb.collection('team_seasons').doc(teamSeasonId).update({
          real_player_budget: realTotal,
          updated_at: new Date()
        });
        
        updatedTeams.push({
          team_season_id: teamSeasonId,
          team_id,
          season_id,
          new_balance: { realTotal }
        });
        console.log('  ✅ Updated team_seasons real_player_budget:', teamSeasonId);
      }

      console.log('🎉 Bulk reversal complete!');
      return NextResponse.json({
        success: true,
        message: `Deleted ${results.length} duplicates and recalculated ${affectedTeams.size} team balances`,
        deleted_transactions: deletedTransactions,
        updated_teams: updatedTeams
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error reversing duplicate:', error);
    return NextResponse.json(
      { error: 'Failed to reverse duplicate', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
