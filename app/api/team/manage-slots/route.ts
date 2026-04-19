import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * POST /api/team/manage-slots
 * Team purchases additional slots (ADD ONLY - no removal)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(['team'], request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = auth.userId;

    const body = await request.json();
    const { slots_to_add, season_id } = body;

    if (!slots_to_add || slots_to_add <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid slots_to_add value' },
        { status: 400 }
      );
    }

    if (!season_id) {
      return NextResponse.json(
        { success: false, error: 'season_id is required' },
        { status: 400 }
      );
    }

    console.log(`[Team Manage Slots] User ${userId} requesting ${slots_to_add} slots for season ${season_id}`);

    // Get team_id from Neon teams table using firebase_uid
    const teamResult = await sql`
      SELECT id FROM teams
      WHERE firebase_uid = ${userId}
      AND season_id = ${season_id}
      LIMIT 1
    `;

    if (teamResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Team not found for this season' },
        { status: 404 }
      );
    }

    const teamId = teamResult[0].id;
    console.log(`[Team Manage Slots] Found team ID: ${teamId}`);

    // Get season settings from Firebase
    const seasonDoc = await adminDb.collection('seasons').doc(season_id).get();
    if (!seasonDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Season not found' },
        { status: 404 }
      );
    }

    const seasonData = seasonDoc.data();
    const slotPrice = seasonData?.football_slot_price || 10;
    const maxPurchasable = seasonData?.football_max_purchasable_slots || 3;
    const seasonName = seasonData?.name || `Season ${seasonData?.season_number || ''}`;

    // Get current team_season data
    const teamSeasonId = `${teamId}_${season_id}`;
    const teamSeasonRef = adminDb.collection('team_seasons').doc(teamSeasonId);
    const teamSeasonSnap = await teamSeasonRef.get();

    if (!teamSeasonSnap.exists) {
      return NextResponse.json(
        { success: false, error: 'Team season not found' },
        { status: 404 }
      );
    }

    const teamSeasonData = teamSeasonSnap.data();
    const currentPurchased = teamSeasonData?.football_purchased_slots || 0;
    const baseSlots = teamSeasonData?.football_base_slots || seasonData?.football_base_slots || 25;
    const currencySystem = teamSeasonData?.currency_system || 'single';
    const currentBudget = currencySystem === 'dual' 
      ? (teamSeasonData?.football_budget || 0)
      : (teamSeasonData?.budget || 0);

    // Check if exceeds max purchasable
    if (currentPurchased + slots_to_add > maxPurchasable) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot purchase ${slots_to_add} slots. Maximum is ${maxPurchasable}, you already have ${currentPurchased}.` 
        },
        { status: 400 }
      );
    }

    // Calculate cost
    const totalCost = slots_to_add * slotPrice;

    // Check if team has enough budget
    if (currentBudget < totalCost) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Insufficient balance. Required: £${totalCost}, Available: £${currentBudget}` 
        },
        { status: 400 }
      );
    }

    const newPurchased = currentPurchased + slots_to_add;
    const newTotalSlots = baseSlots + newPurchased;
    const newBudget = currentBudget - totalCost;

    console.log(`[Team Manage Slots] ===== BEFORE UPDATE =====`);
    console.log(`[Team Manage Slots] Current State:`, {
      teamId,
      currentPurchased,
      baseSlots,
      currentTotalSlots: baseSlots + currentPurchased,
      currentBudget,
      currentSpent: currencySystem === 'dual' ? (teamSeasonData?.football_spent || 0) : (teamSeasonData?.total_spent || 0)
    });
    
    console.log(`[Team Manage Slots] ===== CALCULATIONS =====`);
    console.log(`[Team Manage Slots] Purchase Details:`, {
      slots_to_add,
      slotPrice,
      totalCost,
      newPurchased,
      newTotalSlots,
      newBudget,
      budgetChange: -totalCost,
      spentIncrease: totalCost
    });

    // Update Firebase team_season
    const firebaseUpdate: any = {
      football_purchased_slots: newPurchased,
      football_total_slots: newTotalSlots,
      updated_at: FieldValue.serverTimestamp()
    };

    if (currencySystem === 'dual') {
      // Dual currency: Update football_budget and football_spent
      firebaseUpdate.football_budget = newBudget; // Should DECREASE
      firebaseUpdate.football_spent = (teamSeasonData?.football_spent || 0) + totalCost; // Should INCREASE
      
      console.log(`[Team Manage Slots] Currency: DUAL - Updating football_budget and football_spent`);
      console.log(`[Team Manage Slots] football_budget: ${currentBudget} → ${newBudget} (change: ${newBudget - currentBudget})`);
      console.log(`[Team Manage Slots] football_spent: ${teamSeasonData?.football_spent || 0} → ${(teamSeasonData?.football_spent || 0) + totalCost} (change: +${totalCost})`);
    } else {
      // Single currency: Update budget and total_spent
      firebaseUpdate.budget = newBudget; // Should DECREASE
      firebaseUpdate.total_spent = (teamSeasonData?.total_spent || 0) + totalCost; // Should INCREASE
      
      console.log(`[Team Manage Slots] Currency: SINGLE - Updating budget and total_spent`);
      console.log(`[Team Manage Slots] budget: ${currentBudget} → ${newBudget} (change: ${newBudget - currentBudget})`);
      console.log(`[Team Manage Slots] total_spent: ${teamSeasonData?.total_spent || 0} → ${(teamSeasonData?.total_spent || 0) + totalCost} (change: +${totalCost})`);
    }
    
    // Sanity check: Ensure budget is decreasing
    if (newBudget > currentBudget) {
      console.error(`[Team Manage Slots] ❌ CRITICAL ERROR: Budget would INCREASE! This should never happen!`);
      console.error(`[Team Manage Slots] Current: ${currentBudget}, New: ${newBudget}, Cost: ${totalCost}`);
      return NextResponse.json(
        { success: false, error: 'Internal error: Budget calculation failed' },
        { status: 500 }
      );
    }

    await teamSeasonRef.update(firebaseUpdate);
    console.log(`[Team Manage Slots] ===== FIREBASE UPDATE =====`);
    console.log(`[Team Manage Slots] ✅ Firebase team_season updated:`, firebaseUpdate);
    console.log(`[Team Manage Slots] Document: team_seasons/${teamSeasonId}`);
    
    // Verify the update by reading back and auto-correct if needed
    const verifySnap = await teamSeasonRef.get();
    if (verifySnap.exists) {
      const verifyData = verifySnap.data();
      const verifyBudget = currencySystem === 'dual' 
        ? verifyData?.football_budget 
        : verifyData?.budget;
      
      console.log(`[Team Manage Slots] ===== VERIFICATION =====`);
      console.log(`[Team Manage Slots] Read back from Firebase:`, {
        football_purchased_slots: verifyData?.football_purchased_slots,
        football_total_slots: verifyData?.football_total_slots,
        budget_field: currencySystem === 'dual' ? 'football_budget' : 'budget',
        budget_value: verifyBudget,
        expected_budget: newBudget,
        match: verifyBudget === newBudget ? '✅' : '❌'
      });
      
      // AUTO-CORRECTION: If budget doesn't match expected, fix it immediately
      if (verifyBudget !== newBudget) {
        console.error(`[Team Manage Slots] ❌ MISMATCH DETECTED: Budget is ${verifyBudget}, expected ${newBudget}`);
        console.log(`[Team Manage Slots] 🔧 AUTO-CORRECTING: Forcing budget to correct value...`);
        
        const correctionUpdate: any = {
          updated_at: FieldValue.serverTimestamp()
        };
        
        if (currencySystem === 'dual') {
          correctionUpdate.football_budget = newBudget;
        } else {
          correctionUpdate.budget = newBudget;
        }
        
        await teamSeasonRef.update(correctionUpdate);
        console.log(`[Team Manage Slots] ✅ AUTO-CORRECTION APPLIED: Budget forced to ${newBudget}`);
        
        // Verify correction
        const reVerifySnap = await teamSeasonRef.get();
        if (reVerifySnap.exists) {
          const reVerifyData = reVerifySnap.data();
          const reVerifyBudget = currencySystem === 'dual' 
            ? reVerifyData?.football_budget 
            : reVerifyData?.budget;
          
          console.log(`[Team Manage Slots] 🔍 RE-VERIFICATION: Budget is now ${reVerifyBudget} (expected ${newBudget})`);
          
          if (reVerifyBudget === newBudget) {
            console.log(`[Team Manage Slots] ✅ AUTO-CORRECTION SUCCESSFUL`);
          } else {
            console.error(`[Team Manage Slots] ❌ AUTO-CORRECTION FAILED: Still ${reVerifyBudget} instead of ${newBudget}`);
            console.error(`[Team Manage Slots] This indicates a Firebase listener or trigger is overriding the value`);
          }
        }
      } else {
        console.log(`[Team Manage Slots] ✅ Budget verification passed - no correction needed`);
      }
    }

    // Create transaction in Firebase
    const transactionRef = adminDb.collection('transactions').doc();
    await transactionRef.set({
      team_id: teamId,
      season_id: season_id,
      type: 'slot_purchase',
      amount: -totalCost,
      balance_after: newBudget,
      description: `Purchased ${slots_to_add} additional squad slot(s)`,
      currency_type: currencySystem === 'dual' ? 'football' : 'single',
      created_at: FieldValue.serverTimestamp(),
      metadata: {
        slots_purchased: slots_to_add,
        price_per_slot: slotPrice,
        total_cost: totalCost,
        new_purchased_slots: newPurchased,
        new_total_slots: newTotalSlots
      }
    });
    console.log(`[Team Manage Slots] ===== FIREBASE TRANSACTION =====`);
    console.log(`[Team Manage Slots] ✅ Firebase transaction created:`, {
      id: transactionRef.id,
      team_id: teamId,
      type: 'slot_purchase',
      amount: -totalCost,
      balance_after: newBudget,
      currency_type: currencySystem === 'dual' ? 'football' : 'single'
    });

    // Update Neon teams table
    console.log(`[Team Manage Slots] ===== NEON UPDATE =====`);
    console.log(`[Team Manage Slots] Updating teams table:`, {
      teamId,
      season_id,
      updates: {
        football_purchased_slots: `${currentPurchased} → ${newPurchased}`,
        football_total_slots: `${baseSlots + currentPurchased} → ${newTotalSlots}`,
        football_budget: `current - ${totalCost}`,
        football_spent: `current + ${totalCost}`
      }
    });
    
    const neonUpdateResult = await sql`
      UPDATE teams
      SET 
        football_purchased_slots = ${newPurchased},
        football_total_slots = ${newTotalSlots},
        football_budget = football_budget - ${totalCost},
        football_spent = football_spent + ${totalCost},
        updated_at = NOW()
      WHERE id = ${teamId}
      AND season_id = ${season_id}
      RETURNING 
        football_purchased_slots,
        football_total_slots,
        football_budget,
        football_spent
    `;
    
    if (neonUpdateResult.length > 0) {
      console.log(`[Team Manage Slots] ✅ Neon teams table updated successfully:`, {
        football_purchased_slots: neonUpdateResult[0].football_purchased_slots,
        football_total_slots: neonUpdateResult[0].football_total_slots,
        football_budget: neonUpdateResult[0].football_budget,
        football_spent: neonUpdateResult[0].football_spent
      });
    } else {
      console.warn(`[Team Manage Slots] ⚠️ Neon update returned no rows - team may not exist`);
    }

    // Insert into football_slot_purchases history
    await sql`
      INSERT INTO football_slot_purchases (
        team_id,
        season_id,
        slots_purchased,
        price_per_slot,
        total_cost,
        purchased_by,
        notes
      ) VALUES (
        ${teamId},
        ${season_id},
        ${slots_to_add},
        ${slotPrice},
        ${totalCost},
        ${teamId},
        ${`Team purchased ${slots_to_add} slot(s)`}
      )
    `;
    console.log(`[Team Manage Slots] ===== PURCHASE HISTORY =====`);
    console.log(`[Team Manage Slots] ✅ Purchase history inserted into football_slot_purchases:`, {
      team_id: teamId,
      season_id,
      slots_purchased: slots_to_add,
      price_per_slot: slotPrice,
      total_cost: totalCost
    });

    console.log(`[Team Manage Slots] ===== SUCCESS SUMMARY =====`);
    console.log(`[Team Manage Slots] All updates completed successfully:`, {
      firebase_team_season: '✅ Updated',
      firebase_transaction: '✅ Created',
      neon_teams: '✅ Updated',
      neon_purchase_history: '✅ Inserted',
      slots_added: slots_to_add,
      new_purchased_slots: newPurchased,
      new_total_slots: newTotalSlots,
      cost: totalCost,
      new_budget: newBudget
    });

    return NextResponse.json({
      success: true,
      message: `Successfully purchased ${slots_to_add} slot(s) for £${totalCost}`,
      data: {
        slots_added: slots_to_add,
        new_purchased_slots: newPurchased,
        new_total_slots: newTotalSlots,
        cost: totalCost,
        new_budget: newBudget,
        transaction_created: true,
        budget_deducted: true
      }
    });

  } catch (error: any) {
    console.error('[Team Manage Slots] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
