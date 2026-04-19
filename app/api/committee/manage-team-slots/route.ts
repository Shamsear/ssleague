import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/committee/manage-team-slots
 * Committee admin can add or remove slots for teams
 * Updates both Neon and Firebase, creates transaction records
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { team_id, season_id, slots_change, deduct_payment = false, notes } = body;

    console.log('[Committee Manage Slots] ===== REQUEST START =====');
    console.log('[Committee Manage Slots] Request body:', body);
    console.log('[Committee Manage Slots] Team ID:', team_id);
    console.log('[Committee Manage Slots] Season ID:', season_id);
    console.log('[Committee Manage Slots] Slots change:', slots_change);
    console.log('[Committee Manage Slots] Deduct payment:', deduct_payment);

    if (!team_id || !season_id || slots_change === undefined) {
      return NextResponse.json(
        { success: false, error: 'team_id, season_id, and slots_change are required' },
        { status: 400 }
      );
    }

    if (slots_change === 0) {
      return NextResponse.json(
        { success: false, error: 'slots_change cannot be 0' },
        { status: 400 }
      );
    }

    // Initialize database connection
    const sql = neon(process.env.DATABASE_URL || process.env.NEON_AUCTION_DB_URL || process.env.NEON_DATABASE_URL!);

    // Get season settings
    const seasonRef = adminDb.collection('seasons').doc(season_id);
    const seasonDoc = await seasonRef.get();

    if (!seasonDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Season not found' },
        { status: 404 }
      );
    }

    const seasonData = seasonDoc.data()!;
    const slotPrice = seasonData.football_slot_price || 10;
    const maxPurchasable = seasonData.football_max_purchasable_slots || 3;

    console.log('[Committee Manage Slots] Season settings:', {
      slotPrice,
      maxPurchasable,
      seasonName: seasonData.name
    });

    // Get team_season data
    const teamSeasonRef = adminDb.collection('team_seasons').doc(`${team_id}_${season_id}`);
    const teamSeasonDoc = await teamSeasonRef.get();

    if (!teamSeasonDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Team season not found' },
        { status: 404 }
      );
    }

    const teamSeasonData = teamSeasonDoc.data()!;
    const currentPurchased = teamSeasonData.football_purchased_slots || 0;
    const baseSlots = teamSeasonData.football_base_slots || seasonData.max_football_players || 25;
    const currentBudget = teamSeasonData.football_budget || 0;

    console.log('[Committee Manage Slots] Current team_season data:', {
      currentPurchased,
      baseSlots,
      currentBudget,
      currentTotal: baseSlots + currentPurchased
    });

    // Calculate new values
    const newPurchased = currentPurchased + slots_change;
    const newTotalSlots = baseSlots + newPurchased;

    // Validation
    if (newPurchased < 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot have negative purchased slots' },
        { status: 400 }
      );
    }

    if (newPurchased > maxPurchasable) {
      return NextResponse.json(
        { success: false, error: `Cannot exceed maximum purchasable slots (${maxPurchasable})` },
        { status: 400 }
      );
    }

    // Check if removing slots would go below current player count
    if (slots_change < 0) {
      const teamData = await sql`
        SELECT football_players_count
        FROM teams
        WHERE id = ${team_id} AND season_id = ${season_id}
        LIMIT 1
      `;

      if (teamData.length > 0) {
        const currentPlayers = parseInt(teamData[0].football_players_count) || 0;
        if (newTotalSlots < currentPlayers) {
          return NextResponse.json(
            { 
              success: false, 
              error: `Cannot remove slots. Team has ${currentPlayers} players, would result in ${newTotalSlots} total slots.` 
            },
            { status: 400 }
          );
        }
      }
    }

    // Calculate cost (positive for adding, negative for removing)
    const totalCost = slots_change * slotPrice;
    const newBudget = deduct_payment ? currentBudget - totalCost : currentBudget;

    console.log('[Committee Manage Slots] Calculations:', {
      totalCost,
      newBudget,
      willDeductPayment: deduct_payment,
      budgetChange: deduct_payment ? -totalCost : 0
    });

    // Check budget if payment is required
    if (deduct_payment && slots_change > 0 && newBudget < 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Insufficient budget. Cost: ₡${totalCost}, Available: ₡${currentBudget}` 
        },
        { status: 400 }
      );
    }

    // Update Firebase team_season
    const firebaseUpdate: any = {
      football_purchased_slots: newPurchased,
      football_total_slots: newTotalSlots,
      updated_at: FieldValue.serverTimestamp(),
    };

    if (deduct_payment) {
      firebaseUpdate.football_budget = newBudget;
      // Update football_spent: increase when adding slots, decrease when removing
      firebaseUpdate.football_spent = FieldValue.increment(totalCost);
    }

    console.log('[Committee Manage Slots] Firebase update:', firebaseUpdate);

    await teamSeasonRef.update(firebaseUpdate);

    console.log('[Committee Manage Slots] ✅ Firebase team_season updated');

    // Create transaction record in Firebase if payment is involved
    if (deduct_payment) {
      console.log('[Committee Manage Slots] Creating Firebase transaction...');
      
      const transactionData = {
        team_id,
        season_id,
        type: slots_change > 0 ? 'slot_purchase' : 'slot_refund',
        amount: -totalCost, // Negative for deduction, positive for refund
        currency: 'ecoin',
        description: slots_change > 0 
          ? `Purchased ${slots_change} football player slot${slots_change > 1 ? 's' : ''}`
          : `Refund for ${Math.abs(slots_change)} football player slot${Math.abs(slots_change) > 1 ? 's' : ''}`,
        slots_purchased: slots_change,
        price_per_slot: slotPrice,
        created_by: 'committee_admin',
        notes: notes || 'Committee adjustment',
        created_at: FieldValue.serverTimestamp(),
      };
      
      console.log('[Committee Manage Slots] Transaction data:', transactionData);
      
      await adminDb.collection('transactions').add(transactionData);
      
      console.log('[Committee Manage Slots] ✅ Firebase transaction created');
    } else {
      console.log('[Committee Manage Slots] ⚠️ Skipping Firebase transaction (deduct_payment = false)');
    }

    // Update Neon teams table
    const neonUpdate: any = {
      football_purchased_slots: newPurchased,
      football_total_slots: newTotalSlots,
    };

    if (deduct_payment) {
      console.log('[Committee Manage Slots] Updating Neon with budget deduction...');
      console.log('[Committee Manage Slots] Neon update (with budget):', {
        team_id,
        season_id,
        newPurchased,
        newTotalSlots,
        budgetDeduction: totalCost
      });
      
      // Also update budget and spent in Neon
      await sql`
        UPDATE teams 
        SET 
          football_purchased_slots = ${newPurchased},
          football_total_slots = ${newTotalSlots},
          football_budget = football_budget - ${totalCost},
          football_spent = football_spent + ${totalCost}
        WHERE id = ${team_id} AND season_id = ${season_id}
      `;
      
      console.log('[Committee Manage Slots] ✅ Neon teams table updated (with budget and spent)');
    } else {
      console.log('[Committee Manage Slots] Updating Neon without budget deduction...');
      console.log('[Committee Manage Slots] Neon update (no budget):', {
        team_id,
        season_id,
        newPurchased,
        newTotalSlots
      });
      
      await sql`
        UPDATE teams 
        SET 
          football_purchased_slots = ${newPurchased},
          football_total_slots = ${newTotalSlots}
        WHERE id = ${team_id} AND season_id = ${season_id}
      `;
      
      console.log('[Committee Manage Slots] ✅ Neon teams table updated (no budget change)');
    }

    // Insert into football_slot_purchases history table
    console.log('[Committee Manage Slots] Inserting into football_slot_purchases history...');
    console.log('[Committee Manage Slots] History record:', {
      team_id,
      season_id,
      slots_purchased: slots_change,
      price_per_slot: slotPrice,
      total_cost: totalCost,
      notes: notes || (slots_change > 0 ? 'Committee added slots' : 'Committee removed slots')
    });
    
    await sql`
      INSERT INTO football_slot_purchases (
        team_id, season_id, slots_purchased, price_per_slot, total_cost, notes, purchased_by
      ) VALUES (
        ${team_id}, ${season_id}, ${slots_change}, ${slotPrice}, ${totalCost},
        ${notes || (slots_change > 0 ? 'Committee added slots' : 'Committee removed slots')},
        ${'committee_admin'}
      )
    `;

    console.log('[Committee Manage Slots] ✅ Purchase history inserted');

    const action = slots_change > 0 ? 'added' : 'removed';
    const absChange = Math.abs(slots_change);

    console.log('[Committee Manage Slots] ===== SUCCESS =====');
    console.log('[Committee Manage Slots] Summary:', {
      action,
      slots: absChange,
      newPurchased,
      newTotal: newTotalSlots,
      cost: deduct_payment ? totalCost : 0,
      newBudget: deduct_payment ? newBudget : currentBudget,
      transactionCreated: deduct_payment,
      budgetDeducted: deduct_payment
    });

    return NextResponse.json({
      success: true,
      message: `Successfully ${action} ${absChange} slot${absChange > 1 ? 's' : ''}${deduct_payment ? ` (₡${Math.abs(totalCost)} ${slots_change > 0 ? 'charged' : 'refunded'})` : ''}`,
      data: {
        slots_change,
        new_purchased_slots: newPurchased,
        new_total_slots: newTotalSlots,
        cost: deduct_payment ? totalCost : 0,
        new_budget: deduct_payment ? newBudget : currentBudget,
      },
    });
  } catch (error: any) {
    console.error('[Committee Manage Slots] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to manage team slots' },
      { status: 500 }
    );
  }
}
