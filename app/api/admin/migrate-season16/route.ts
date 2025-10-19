import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    console.log('\n🔄 Starting migration of Season 16 teams to dual currency...\n');
    
    // Find all teams registered to season 16 or SSPSLS16
    const snapshot = await adminDb
      .collection('team_seasons')
      .where('season_id', 'in', ['season_16', 'SSPSLS16'])
      .get();
    
    console.log(`📊 Found ${snapshot.size} team(s) registered to Season 16`);
    
    if (snapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'No teams to migrate',
        updated: 0,
        alreadyMigrated: 0,
      });
    }
    
    const batch = adminDb.batch();
    let updateCount = 0;
    let alreadyMigratedCount = 0;
    const migrated: any[] = [];
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Skip if already dual currency
      if (data.currency_system === 'dual') {
        console.log(`⏭️  Team ${data.team_name} (${doc.id}) is already using dual currency - skipping`);
        alreadyMigratedCount++;
        continue;
      }
      
      console.log(`\n🔧 Migrating: ${data.team_name} (${doc.id})`);
      console.log(`   Current budget: £${data.budget || data.balance || 15000}`);
      console.log(`   Current spent: £${data.total_spent || 0}`);
      
      // Calculate remaining budget
      const currentBudget = data.budget || data.balance || 15000;
      const currentSpent = data.total_spent || 0;
      const remaining = currentBudget - currentSpent;
      
      // For dual currency conversion:
      // Total original budget was £15,000 equivalent
      // Split: €10,000 for football players, $5,000 for real players
      const footballBudget = 10000;
      const realPlayerBudget = 5000;
      
      // If they've spent money, assume all spending was on football players (most common case)
      const footballSpent = currentSpent;
      const realPlayerSpent = 0;
      
      const updateData = {
        // Add dual currency fields
        currency_system: 'dual',
        football_budget: footballBudget - footballSpent,
        football_starting_balance: footballBudget,
        football_spent: footballSpent,
        real_player_budget: realPlayerBudget,
        real_player_starting_balance: realPlayerBudget,
        real_player_spent: realPlayerSpent,
        
        // Keep legacy fields for backward compatibility
        balance: remaining,
        starting_balance: currentBudget,
        total_spent: currentSpent,
        
        // Update metadata
        updated_at: FieldValue.serverTimestamp(),
        migrated_to_dual_currency: true,
        migration_date: FieldValue.serverTimestamp(),
      };
      
      console.log(`   → Football Budget: €${updateData.football_budget} (spent: €${footballSpent})`);
      console.log(`   → Real Player Budget: $${updateData.real_player_budget} (spent: $${realPlayerSpent})`);
      
      batch.update(doc.ref, updateData);
      updateCount++;
      
      migrated.push({
        teamId: doc.id,
        teamName: data.team_name,
        oldBudget: currentBudget,
        oldSpent: currentSpent,
        newFootballBudget: updateData.football_budget,
        newRealPlayerBudget: updateData.real_player_budget,
      });
    }
    
    if (updateCount > 0) {
      console.log(`\n📤 Committing ${updateCount} update(s)...`);
      await batch.commit();
      console.log('✅ Migration completed successfully!');
    } else {
      console.log('\n✅ No updates needed - all teams already migrated');
    }
    
    return NextResponse.json({
      success: true,
      message: `Migration completed: ${updateCount} team(s) migrated, ${alreadyMigratedCount} already migrated`,
      totalTeams: snapshot.size,
      updated: updateCount,
      alreadyMigrated: alreadyMigratedCount,
      migratedTeams: migrated,
    });
    
  } catch (error: any) {
    console.error('❌ Migration error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
