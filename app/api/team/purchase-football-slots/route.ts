import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, updateDoc, runTransaction, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auctionSql as sql } from '@/lib/neon/auction-config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { team_id, season_id, slots_to_purchase } = body;

    if (!team_id || !season_id || !slots_to_purchase) {
      return NextResponse.json(
        { success: false, error: 'team_id, season_id, and slots_to_purchase are required' },
        { status: 400 }
      );
    }

    if (slots_to_purchase < 1) {
      return NextResponse.json(
        { success: false, error: 'Must purchase at least 1 slot' },
        { status: 400 }
      );
    }

    // Get season settings
    const seasonRef = doc(db, 'seasons', season_id);
    const seasonDoc = await getDoc(seasonRef);

    if (!seasonDoc.exists()) {
      return NextResponse.json(
        { success: false, error: 'Season not found' },
        { status: 404 }
      );
    }

    const seasonData = seasonDoc.data();
    const maxPurchasable = seasonData.football_max_purchasable_slots || 3;
    const slotPrice = seasonData.football_slot_price || 10;
    const purchaseEnabled = seasonData.football_slot_purchase_enabled !== false;

    if (!purchaseEnabled) {
      return NextResponse.json(
        { success: false, error: 'Slot purchases are currently disabled' },
        { status: 403 }
      );
    }

    // Get team_season document
    const teamSeasonRef = doc(db, 'team_seasons', `${team_id}_${season_id}`);
    const teamSeasonDoc = await getDoc(teamSeasonRef);

    if (!teamSeasonDoc.exists()) {
      return NextResponse.json(
        { success: false, error: 'Team season not found' },
        { status: 404 }
      );
    }

    const teamSeasonData = teamSeasonDoc.data();
    const currentPurchased = teamSeasonData.football_purchased_slots || 0;
    const currentBudget = teamSeasonData.football_budget || 0;

    // Check if team can purchase more slots
    if (currentPurchased + slots_to_purchase > maxPurchasable) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot purchase ${slots_to_purchase} slots. Maximum purchasable is ${maxPurchasable}, you already have ${currentPurchased}.` 
        },
        { status: 400 }
      );
    }

    // Calculate cost
    const totalCost = slots_to_purchase * slotPrice;

    // Check if team has enough budget
    if (currentBudget < totalCost) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Insufficient budget. Need ₡${totalCost}, but only have ₡${currentBudget}` 
        },
        { status: 400 }
      );
    }

    // Perform transaction in Firebase
    await runTransaction(db, async (transaction) => {
      // Re-read team_season to ensure consistency
      const freshTeamSeasonDoc = await transaction.get(teamSeasonRef);
      if (!freshTeamSeasonDoc.exists()) {
        throw new Error('Team season not found');
      }

      const freshData = freshTeamSeasonDoc.data();
      const freshBudget = freshData.football_budget || 0;
      const freshPurchased = freshData.football_purchased_slots || 0;
      const baseSlots = freshData.football_base_slots || seasonData.football_base_slots || 25;

      // Double-check budget
      if (freshBudget < totalCost) {
        throw new Error('Insufficient budget');
      }

      // Update team_season
      const newPurchased = freshPurchased + slots_to_purchase;
      const newTotalSlots = baseSlots + newPurchased;
      const newBudget = freshBudget - totalCost;

      transaction.update(teamSeasonRef, {
        football_purchased_slots: newPurchased,
        football_total_slots: newTotalSlots,
        football_budget: newBudget
      });

      // Create transaction record
      const transactionRef = doc(collection(db, 'transactions'));
      transaction.set(transactionRef, {
        team_id,
        season_id,
        type: 'slot_purchase',
        amount: -totalCost,
        currency: 'ecoin',
        description: `Purchased ${slots_to_purchase} football player slot${slots_to_purchase > 1 ? 's' : ''}`,
        slots_purchased: slots_to_purchase,
        price_per_slot: slotPrice,
        created_at: serverTimestamp(),
        status: 'completed'
      });
    });

    // Update Neon database
    try {
      await sql`
        UPDATE teams 
        SET 
          football_purchased_slots = football_purchased_slots + ${slots_to_purchase},
          football_total_slots = football_total_slots + ${slots_to_purchase}
        WHERE id = ${team_id}
      `;

      // Insert purchase history
      await sql`
        INSERT INTO football_slot_purchases (
          team_id, season_id, slots_purchased, price_per_slot, total_cost, notes
        ) VALUES (
          ${team_id}, ${season_id}, ${slots_to_purchase}, ${slotPrice}, ${totalCost},
          ${'Purchased via team dashboard'}
        )
      `;
    } catch (neonError) {
      console.error('Error updating Neon database:', neonError);
      // Don't fail the request if Neon update fails, Firebase is source of truth
    }

    return NextResponse.json({
      success: true,
      message: `Successfully purchased ${slots_to_purchase} slot${slots_to_purchase > 1 ? 's' : ''} for ₡${totalCost}`,
      data: {
        slots_purchased: slots_to_purchase,
        total_cost: totalCost,
        new_total_slots: (teamSeasonData.football_base_slots || 25) + (currentPurchased + slots_to_purchase),
        remaining_budget: currentBudget - totalCost
      }
    });
  } catch (error: any) {
    console.error('Error purchasing slots:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
