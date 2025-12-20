import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { calculateRealPlayerSalary } from '@/lib/contracts';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { adminDb } from '@/lib/firebase/admin';
import { logSalaryPayment } from '@/lib/transaction-logger';

// Base points by star rating
const STAR_RATING_BASE_POINTS: { [key: number]: number } = {
  3: 100,
  4: 120,
  5: 145,
  6: 175,
  7: 210,
  8: 250,
  9: 300,
  10: 375, // average of 350-400
};

// Calculate star rating from points
function calculateStarRating(points: number): number {
  if (points >= 350) return 10;
  if (points >= 300) return 9;
  if (points >= 250) return 8;
  if (points >= 210) return 7;
  if (points >= 175) return 6;
  if (points >= 145) return 5;
  if (points >= 120) return 4;
  return 3;
}

// Recalculate categories for ALL players in a season based on league-wide ranking
// Top 50% by points = Legend, Bottom 50% = Classic
async function recalculateAllPlayerCategories(season_id: string) {
  try {
    // Get all realplayers for this specific season
    const allPlayersQuery = query(
      collection(db, 'realplayer'),
      where('season_id', '==', season_id)
    );
    const allPlayersSnap = await getDocs(allPlayersQuery);
    
    // Create array of players with their star ratings
    const players: Array<{ docId: string; playerId: string; starRating: number; points: number }> = [];
    
    allPlayersSnap.forEach(doc => {
      const data = doc.data();
      players.push({
        docId: doc.id,
        playerId: data.player_id,
        starRating: data.star_rating || 3,
        points: data.points || 100
      });
    });
    
    // Sort by points (most granular metric) - highest first
    // Star rating is derived from points, so points is the source of truth
    players.sort((a, b) => b.points - a.points);
    
    // Calculate top 50% threshold
    const legendThreshold = Math.ceil(players.length / 2);
    
    // Update categories for all players
    const updatePromises = players.map(async (player, index) => {
      const isLegend = index < legendThreshold;
      const category = isLegend 
        ? { id: 'legend', name: 'Legend' }
        : { id: 'classic', name: 'Classic' };
      
      // Update realplayer document
      const playerDoc = doc(db, 'realplayer', player.docId);
      await updateDoc(playerDoc, {
        category_id: category.id,
        category_name: category.name
      });
      
      return { playerId: player.playerId, category: category.name, rank: index + 1 };
    });
    
    await Promise.all(updatePromises);
    
    return { success: true, totalPlayers: players.length, legendCount: legendThreshold };
  } catch (error) {
    console.error('Error recalculating categories:', error);
    return { success: false, error: 'Failed to recalculate categories' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fixture_id, season_id, matchups, skip_salary_deduction } = body;

    if (!fixture_id || !season_id || !matchups || !Array.isArray(matchups)) {
      return NextResponse.json(
        { error: 'Invalid request data. Required: fixture_id, season_id, matchups[]' },
        { status: 400 }
      );
    }
    
    if (skip_salary_deduction) {
      console.log('⚠️  Skipping salary deduction (edit mode)');
    }

    console.log(`\n🎯 Processing fixture ${fixture_id} for season ${season_id}`);
    console.log(`📋 Total matchups to process: ${matchups.length}\n`);
    
    const updates: any[] = [];
    
    // Track salary deductions per player for detailed logging
    const playerSalaries: Array<{
      player_id: string;
      player_name: string;
      team_id: string;
      salary: number;
    }> = [];

    // Process each matchup
    for (const matchup of matchups) {
      const { home_player_id, away_player_id, home_goals, away_goals } = matchup;

      console.log(`\n--- Processing matchup: ${home_player_id} vs ${away_player_id} (${home_goals}-${away_goals}) ---`);

      // Skip if required fields are missing
      if (!home_player_id || !away_player_id || home_goals === null || home_goals === undefined || away_goals === null || away_goals === undefined) {
        console.warn('Skipping matchup with missing data:', { home_player_id, away_player_id, home_goals, away_goals });
        continue;
      }

      // Calculate goal difference
      const homeGD = home_goals - away_goals;
      const awayGD = away_goals - home_goals;

      // Cap at ±5 points per match
      const homePointsChange = Math.max(-5, Math.min(5, homeGD));
      const awayPointsChange = Math.max(-5, Math.min(5, awayGD));

      // Update home player - use ONLY Neon player_seasons
      const sql = getTournamentDb();
      const homeStatsId = `${home_player_id}_${season_id}`;
      
      // Get ALL player data from player_seasons
      const homeSeasonData = await sql`
        SELECT id, player_id, player_name, team_id, salary_per_match, star_rating, points
        FROM player_seasons
        WHERE id = ${homeStatsId}
        LIMIT 1
      `;
      
      console.log(`  📦 Home player in player_seasons: ${homeSeasonData.length > 0 ? 'FOUND' : 'NOT FOUND'} (id: ${home_player_id})`);

      if (homeSeasonData.length > 0) {
        const homePlayerData = homeSeasonData[0];
        const currentPoints = homePlayerData.points || STAR_RATING_BASE_POINTS[homePlayerData.star_rating || 3];
        const newPoints = currentPoints + homePointsChange;
        const newStarRating = calculateStarRating(newPoints);
        const oldStarRating = homePlayerData.star_rating || 3;

        // Deduct CURRENT salary for this match (before star rating changes)
        const currentSalary = parseFloat(homePlayerData.salary_per_match) || 0;
        const teamId = homePlayerData.team_id;
        
        console.log(`🔍 Home player ${homePlayerData.player_name}:`, {
          team_id: teamId || 'N/A',
          salary_per_match: currentSalary,
          old_points: currentPoints,
          new_points: newPoints,
          old_stars: oldStarRating,
          new_stars: newStarRating
        });
        
        if (!teamId) {
          console.log(`⚠️  ${homePlayerData.player_name} has no team_id`);
        } else if (currentSalary <= 0) {
          console.log(`⚠️  ${homePlayerData.player_name} has salary_per_match = ${currentSalary}`);
        } else {
          playerSalaries.push({
            player_id: home_player_id,
            player_name: homePlayerData.player_name,
            team_id: teamId,
            salary: currentSalary
          });
          console.log(`💰 Tracking salary for ${homePlayerData.player_name}: $${currentSalary} (team: ${teamId})`);
        }

        // Calculate new salary if star rating changed
        let newSalary = currentSalary;
        if (newStarRating !== oldStarRating) {
          // Get auction value to recalculate salary
          const auctionData = await sql`
            SELECT auction_value FROM player_seasons
            WHERE id = ${homeStatsId}
            LIMIT 1
          `;
          const auctionValue = auctionData[0]?.auction_value || 0;
          newSalary = calculateRealPlayerSalary(auctionValue, newStarRating);
          console.log(`   ⭐ Star rating changed! Recalculating salary: $${currentSalary.toFixed(2)} → $${newSalary.toFixed(2)}`);
        }

        // Update points, star rating, and salary in player_seasons
        await sql`
          UPDATE player_seasons
          SET
            points = ${newPoints},
            star_rating = ${newStarRating},
            salary_per_match = ${newSalary},
            updated_at = NOW()
          WHERE id = ${homeStatsId}
        `;
        
        // Also update Firebase realplayer for backward compatibility (if exists)
        try {
          const homePlayerQuery = query(
            collection(db, 'realplayer'),
            where('player_id', '==', home_player_id)
          );
          const homePlayerSnap = await getDocs(homePlayerQuery);
          if (!homePlayerSnap.empty) {
            await updateDoc(homePlayerSnap.docs[0].ref, {
              points: newPoints,
              star_rating: newStarRating,
            });
          }
        } catch (fbError) {
          console.warn('Firebase update failed (non-critical):', fbError);
        }

        updates.push({
          player_id: home_player_id,
          name: homePlayerData.player_name,
          old_points: currentPoints,
          new_points: newPoints,
          points_change: homePointsChange,
          old_stars: oldStarRating,
          new_stars: newStarRating,
          salary_updated: newStarRating !== oldStarRating
        });
      } else {
        console.log(`⚠️  Home player ${home_player_id} NOT found in player_seasons`);
      }

      // Update away player - use ONLY Neon player_seasons
      const awayStatsId = `${away_player_id}_${season_id}`;
      
      // Get ALL player data from player_seasons
      const awaySeasonData = await sql`
        SELECT id, player_id, player_name, team_id, salary_per_match, star_rating, points
        FROM player_seasons
        WHERE id = ${awayStatsId}
        LIMIT 1
      `;
      
      console.log(`  📦 Away player in player_seasons: ${awaySeasonData.length > 0 ? 'FOUND' : 'NOT FOUND'} (id: ${away_player_id})`);

      if (awaySeasonData.length > 0) {
        const awayPlayerData = awaySeasonData[0];
        const currentPoints = awayPlayerData.points || STAR_RATING_BASE_POINTS[awayPlayerData.star_rating || 3];
        const newPoints = currentPoints + awayPointsChange;
        const newStarRating = calculateStarRating(newPoints);
        const oldStarRating = awayPlayerData.star_rating || 3;

        // Deduct CURRENT salary for this match (before star rating changes)
        const currentSalary = parseFloat(awayPlayerData.salary_per_match) || 0;
        const teamId = awayPlayerData.team_id;
        
        console.log(`🔍 Away player ${awayPlayerData.player_name}:`, {
          team_id: teamId || 'N/A',
          salary_per_match: currentSalary,
          old_points: currentPoints,
          new_points: newPoints,
          old_stars: oldStarRating,
          new_stars: newStarRating
        });
        
        if (!teamId) {
          console.log(`⚠️  ${awayPlayerData.player_name} has no team_id`);
        } else if (currentSalary <= 0) {
          console.log(`⚠️  ${awayPlayerData.player_name} has salary_per_match = ${currentSalary}`);
        } else {
          playerSalaries.push({
            player_id: away_player_id,
            player_name: awayPlayerData.player_name,
            team_id: teamId,
            salary: currentSalary
          });
          console.log(`💰 Tracking salary for ${awayPlayerData.player_name}: $${currentSalary} (team: ${teamId})`);
        }

        // Calculate new salary if star rating changed
        let newSalary = currentSalary;
        if (newStarRating !== oldStarRating) {
          // Get auction value to recalculate salary
          const auctionData = await sql`
            SELECT auction_value FROM player_seasons
            WHERE id = ${awayStatsId}
            LIMIT 1
          `;
          const auctionValue = auctionData[0]?.auction_value || 0;
          newSalary = calculateRealPlayerSalary(auctionValue, newStarRating);
          console.log(`   ⭐ Star rating changed! Recalculating salary: $${currentSalary.toFixed(2)} → $${newSalary.toFixed(2)}`);
        }

        // Update points, star rating, and salary in player_seasons
        await sql`
          UPDATE player_seasons
          SET
            points = ${newPoints},
            star_rating = ${newStarRating},
            salary_per_match = ${newSalary},
            updated_at = NOW()
          WHERE id = ${awayStatsId}
        `;
        
        // Also update Firebase realplayer for backward compatibility (if exists)
        try {
          const awayPlayerQuery = query(
            collection(db, 'realplayer'),
            where('player_id', '==', away_player_id)
          );
          const awayPlayerSnap = await getDocs(awayPlayerQuery);
          if (!awayPlayerSnap.empty) {
            await updateDoc(awayPlayerSnap.docs[0].ref, {
              points: newPoints,
              star_rating: newStarRating,
            });
          }
        } catch (fbError) {
          console.warn('Firebase update failed (non-critical):', fbError);
        }

        updates.push({
          player_id: away_player_id,
          name: awayPlayerData.player_name,
          old_points: currentPoints,
          new_points: newPoints,
          points_change: awayPointsChange,
          old_stars: oldStarRating,
          new_stars: newStarRating,
          salary_updated: newStarRating !== oldStarRating
        });
      } else {
        console.log(`⚠️  Away player ${away_player_id} NOT found in player_seasons`);
      }
    }

    // DISABLED: Auto-recalculation of categories after match
    // Categories are now only updated when admin manually triggers it via the recalculate page
    // This keeps categories stable and prevents them from changing after every match
    // console.log(`Recalculating categories for all players in season ${season_id}...`);
    // const categoryResult = await recalculateAllPlayerCategories(season_id);
    
    // if (!categoryResult.success) {
    //   console.error('Failed to recalculate categories:', categoryResult.error);
    // } else {
    //   console.log(`Categories recalculated: ${categoryResult.legendCount} Legend / ${categoryResult.totalPlayers! - categoryResult.legendCount!} Classic`);
    // }

    // Process salary deductions per player for detailed audit trail
    const salaryDeductions: any[] = [];
    const salaryErrors: any[] = [];
    
    // Check if we should skip salary deduction
    let shouldSkipSalary = skip_salary_deduction;
    
    if (shouldSkipSalary) {
      console.log(`\n⏭️  SKIPPING salary deduction (result edit/revert)\n`);
    } else {
      console.log(`\n💰 SALARY DEDUCTION PHASE`);
      console.log(`📊 Players to process: ${playerSalaries.length}`);
      
      // Check if salary transactions already exist for this fixture
      console.log(`🔍 Checking for existing salary transactions for fixture ${fixture_id}...`);
      const existingTxnsSnapshot = await adminDb.collection('transactions')
        .where('transaction_type', 'in', ['salary', 'salary_payment'])
        .where('currency_type', '==', 'real_player')
        .limit(1000)
        .get();
      
      const hasExistingForFixture = existingTxnsSnapshot.docs.some(doc => {
        const metadata = doc.data().metadata || {};
        return metadata.fixture_id === fixture_id;
      });
      
      if (hasExistingForFixture) {
        console.log(`⚠️  Salary transactions already exist for fixture ${fixture_id}`);
        console.log(`⏭️  SKIPPING salary deduction to prevent duplicates\n`);
        // Set skip flag to true
        shouldSkipSalary = true;
      } else {
        console.log(`✅ No existing salary transactions found, proceeding with deductions`);
        
        // Group by team for balance updates
        const teamTotals = new Map<string, number>();
        playerSalaries.forEach(p => {
          teamTotals.set(p.team_id, (teamTotals.get(p.team_id) || 0) + p.salary);
        });
        
        console.log(`Teams affected: ${Array.from(teamTotals.keys()).join(', ')}`);
        console.log(``);
      }
    }
    
    if (!shouldSkipSalary && playerSalaries.length > 0) {
      // Process each player's salary individually
      for (const playerSalary of playerSalaries) {
        try {
        const { player_id, player_name, team_id, salary } = playerSalary;
        
        console.log(`\n👤 Processing: ${player_name} (${team_id})`);
        console.log(`   💵 Salary: $${salary.toFixed(2)}`);
        
        const teamSeasonDocId = `${team_id}_${season_id}`;
        const teamSeasonRef = adminDb.collection('team_seasons').doc(teamSeasonDocId);
        const teamSeasonDoc = await teamSeasonRef.get();
        
        if (!teamSeasonDoc.exists) {
          console.log(`   ❌ ERROR: Team season document not found!`);
          salaryErrors.push({
            player_id,
            player_name,
            team_id,
            error: 'Team season document not found'
          });
          continue;
        }
        
        const teamSeasonData = teamSeasonDoc.data();
        const currentBalance = teamSeasonData?.real_player_budget || 0;
        const currentSpent = teamSeasonData?.real_player_spent || 0;
        const newBalance = currentBalance - salary;
        const newSpent = currentSpent + salary;
        
        // Update balance and spent (allow negative balance)
        await teamSeasonRef.update({
          real_player_budget: newBalance,
          real_player_spent: newSpent,
          updated_at: new Date()
        });
        
        console.log(`   ✓ Balance: $${currentBalance.toFixed(2)} → $${newBalance.toFixed(2)}`);
        console.log(`   ✓ Spent: $${currentSpent.toFixed(2)} → $${newSpent.toFixed(2)}`);
        
        // Log individual salary payment transaction
        await logSalaryPayment(
          team_id,
          season_id,
          salary,
          currentBalance,
          'real_player',
          fixture_id,
          undefined, // match number
          1, // one player per transaction
          player_name, // player name for description
          player_id // player ID for metadata
        );
        
        console.log(`   ✓ Transaction logged`);
        
        salaryDeductions.push({
          player_id,
          player_name,
          team_id,
          salary,
          balanceBefore: currentBalance,
          balanceAfter: newBalance
        });
        
        console.log(`   ✅ SUCCESS`);
        } catch (error) {
          console.error(`   ❌ FAILED:`, error);
          salaryErrors.push({
            player_id: playerSalary.player_id,
            player_name: playerSalary.player_name,
            team_id: playerSalary.team_id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }
    
    if (!skip_salary_deduction) {
      console.log(`\n📊 SALARY DEDUCTION SUMMARY`);
      console.log(`   ✅ Successful: ${salaryDeductions.length} players`);
      console.log(`   ❌ Failed: ${salaryErrors.length} players`);
      if (salaryDeductions.length > 0) {
        const totalDeducted = salaryDeductions.reduce((sum, d) => sum + d.salary, 0);
        console.log(`   💵 Total deducted: $${totalDeducted.toFixed(2)}`);
        
        // Show breakdown by team
        const byTeam = new Map<string, number>();
        salaryDeductions.forEach(d => {
          byTeam.set(d.team_id, (byTeam.get(d.team_id) || 0) + d.salary);
        });
        console.log(`   🏢 Teams affected: ${byTeam.size}`);
        byTeam.forEach((total, team) => {
          console.log(`      ${team}: $${total.toFixed(2)}`);
        });
      }
      console.log(``);
    }
    

    return NextResponse.json({
      success: true,
      message: 'Player points and ratings updated successfully (categories not auto-updated)',
      updates,
      salaryDeductions,
      salaryErrors: salaryErrors.length > 0 ? salaryErrors : undefined
      // categoryUpdate: categoryResult
    });
  } catch (error) {
    console.error('Error updating player points:', error);
    return NextResponse.json(
      { error: 'Failed to update player points' },
      { status: 500 }
    );
  }
}
