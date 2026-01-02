import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/auth-helper';
import { FieldValue } from 'firebase-admin/firestore';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { fantasySql } from '@/lib/neon/fantasy-config';
import { triggerNews } from '@/lib/news/trigger';

export async function POST(request: NextRequest) {
  try {
    // ✅ ZERO FIREBASE READS - Uses JWT claims only
    const auth = await verifyAuth(['committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body with error handling
    let body;
    try {
      const text = await request.text();
      if (!text || text.trim() === '') {
        return NextResponse.json(
          { error: 'Empty request body' },
          { status: 400 }
        );
      }
      body = JSON.parse(text);
    } catch (err) {
      console.error('Error parsing request body:', err);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    const {
      seasonId,
      startSeason,
      endSeason,
      players,
    } = body;

    // Validate required fields
    if (!seasonId || !startSeason || !endSeason || !players || !Array.isArray(players)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (players.length === 0) {
      return NextResponse.json(
        { error: 'No players to assign' },
        { status: 400 }
      );
    }

    // Check if this is a modern season (16+)
    const seasonNum = parseInt(seasonId.replace(/\D/g, '')) || 0;
    const isModernSeason = seasonNum >= 16;
    const sql = getTournamentDb();

    // First, fetch team names for all unique team IDs
    const uniqueTeamIds = [...new Set(players.map(p => p.teamId))];
    const teamNames = new Map<string, string>();

    for (const teamId of uniqueTeamIds) {
      let teamName = 'Unknown Team';

      // Try to get team name from team_seasons document
      // First try with the player's contract start season if available
      const player = players.find(p => p.teamId === teamId);
      const playerContractStart = player?.contractStartSeason || startSeason;

      // Extract base season (remove .5 if present) for Firebase lookup
      const basePlayerSeason = playerContractStart.replace('.5', '');
      const baseStartSeason = startSeason.replace('.5', '');

      // Try with player's contract season first (without .5)
      let teamSeasonDocId = `${teamId}_${basePlayerSeason}`;
      let teamSeasonDoc = await adminDb.collection('team_seasons').doc(teamSeasonDocId).get();

      // If not found and player contract is different from bulk, try bulk season (without .5)
      if (!teamSeasonDoc.exists && basePlayerSeason !== baseStartSeason) {
        teamSeasonDocId = `${teamId}_${baseStartSeason}`;
        teamSeasonDoc = await adminDb.collection('team_seasons').doc(teamSeasonDocId).get();
      }

      if (teamSeasonDoc.exists) {
        const teamData = teamSeasonDoc.data();
        teamName = teamData?.team_name || teamData?.username || teamData?.team_code || 'Unknown Team';
      } else {
        console.warn(`⚠️  Could not find team_seasons document for team ${teamId} (tried: ${teamSeasonDocId})`);
      }

      teamNames.set(teamId, teamName);
      console.log(`Team ${teamId}: ${teamName}`);
    }

    // STEP 1: For bulk assignment (multiple players or explicit clear request), 
    // unassign existing players first. For single player assignment (quick assign), 
    // just update the specific player
    const isBulkAssignment = players.length > 1 || body.clearExisting === true;

    if (isModernSeason && isBulkAssignment) {
      for (const teamId of uniqueTeamIds) {
        console.log(`[BULK] Unassigning all players from team ${teamId} in season ${startSeason}...`);

        // Clear team_id for all players currently assigned to this team
        await sql`
          UPDATE player_seasons
          SET team_id = NULL,
              team = NULL,
              auction_value = NULL,
              salary_per_match = NULL,
              contract_id = NULL,
              contract_start_season = NULL,
              contract_end_season = NULL,
              contract_length = NULL,
              status = 'available',
              updated_at = NOW()
          WHERE team_id = ${teamId}
            AND season_id = ${startSeason}
        `;

        // Also clear for next season
        await sql`
          UPDATE player_seasons
          SET team_id = NULL,
              team = NULL,
              auction_value = NULL,
              salary_per_match = NULL,
              contract_id = NULL,
              contract_start_season = NULL,
              contract_end_season = NULL,
              contract_length = NULL,
              status = 'available',
              updated_at = NOW()
          WHERE team_id = ${teamId}
            AND season_id = ${endSeason}
        `;

        console.log(`✅ [BULK] Cleared existing assignments for team ${teamId}`);
      }
    } else if (isModernSeason && !isBulkAssignment) {
      console.log(`[QUICK ASSIGN] Processing single player assignment without clearing team roster`);
    }

    // STEP 2: Process all players - update ALL season documents for each player
    const updateResults: any[] = [];

    // Helper function to get all seasons covered by a contract
    function getContractSeasons(contractStart: string, contractEnd: string): string[] {
      const seasons: string[] = [];

      // Extract season numbers and check for mid-season (.5)
      const startMatch = contractStart.match(/^(.+?)(\d+)(\.5)?$/);
      const endMatch = contractEnd.match(/^(.+?)(\d+)(\.5)?$/);

      if (!startMatch || !endMatch) {
        console.warn(`Invalid season format: ${contractStart} -> ${contractEnd}`);
        return [contractStart, contractEnd];
      }

      const prefix = startMatch[1];
      const startNum = parseInt(startMatch[2]);
      const endNum = parseInt(endMatch[2]);

      // Generate all seasons in the range
      for (let i = startNum; i <= endNum; i++) {
        seasons.push(`${prefix}${i}`);
      }

      return seasons;
    }

    if (isModernSeason) {
      // MODERN SEASON (16+): Update Neon database
      for (const player of players) {
        if (!player.id || !player.teamId || !player.playerName) {
          return NextResponse.json(
            { error: `Invalid player data: missing id, teamId, or playerName` },
            { status: 400 }
          );
        }

        const playerId = player.id;
        const teamName = teamNames.get(player.teamId) || 'Unknown Team';

        // Use individual player's contract if provided, otherwise use bulk contract
        const playerContractStart = player.contractStartSeason || startSeason;
        const playerContractEnd = player.contractEndSeason || endSeason;
        const contractId = `contract_${playerId}_${playerContractStart}_${Date.now()}`;

        console.log(`Processing player (Neon): ${player.playerName}, ID: ${playerId}, Contract: ${playerContractStart} → ${playerContractEnd}`);

        // Get ALL seasons covered by this contract
        const contractSeasons = getContractSeasons(playerContractStart, playerContractEnd);
        console.log(`  Contract covers ${contractSeasons.length} seasons:`, contractSeasons);

        // Get star rating from the first season (current season)
        const firstSeasonId = `${playerId}_${contractSeasons[0]}`;
        const currentData = await sql`
          SELECT star_rating FROM player_seasons
          WHERE id = ${firstSeasonId}
          LIMIT 1
        `;
        const starRating = currentData[0]?.star_rating || 0;

        // Calculate base points from star rating
        const STAR_RATING_BASE_POINTS: { [key: number]: number } = {
          3: 100, 4: 120, 5: 145, 6: 175, 7: 210,
          8: 250, 9: 300, 10: 375
        };
        const basePoints = STAR_RATING_BASE_POINTS[starRating] || 100;

        // Update or create entry for EACH season in the contract
        for (const seasonId of contractSeasons) {
          const seasonCompositeId = `${playerId}_${seasonId}`;

          // Check if season record exists
          const existing = await sql`
            SELECT id FROM player_seasons
            WHERE id = ${seasonCompositeId}
            LIMIT 1
          `;

          if (existing.length > 0) {
            // Update existing season entry
            await sql`
              UPDATE player_seasons
              SET team_id = ${player.teamId},
                  team = ${teamName},
                  auction_value = ${player.auctionValue},
                  salary_per_match = ${player.salaryPerMatch},
                  contract_id = ${contractId},
                  contract_start_season = ${playerContractStart},
                  contract_end_season = ${playerContractEnd},
                  contract_length = ${contractSeasons.length},
                  status = 'active',
                  updated_at = NOW()
              WHERE id = ${seasonCompositeId}
            `;
            console.log(`  ✅ Updated existing entry for season ${seasonId}`);
          } else {
            // Create new record for this season (auto-registration)
            await sql`
              INSERT INTO player_seasons (
                id, season_id, player_id, player_name,
                team_id, team,
                auction_value, salary_per_match,
                star_rating, category, points,
                matches_played, goals_scored, assists, wins, draws, losses,
                clean_sheets, motm_awards,
                contract_id, contract_start_season, contract_end_season, contract_length,
                status, is_auto_registered, registration_date, created_at, updated_at
              ) VALUES (
                ${seasonCompositeId}, ${seasonId}, ${playerId}, ${player.playerName},
                ${player.teamId}, ${teamName},
                ${player.auctionValue}, ${player.salaryPerMatch},
                ${starRating}, null, ${basePoints},
                0, 0, 0, 0, 0, 0, 0, 0,
                ${contractId}, ${playerContractStart}, ${playerContractEnd}, ${contractSeasons.length},
                'active', true, NOW(), NOW(), NOW()
              )
            `;
            console.log(`  ✅ Created new entry for season ${seasonId} (auto-registered)`);
          }
        }

        // Auto-add to fantasy league if exists
        try {
          const fantasyLeagues = await fantasySql`
            SELECT league_id, star_rating_prices
            FROM fantasy_leagues
            WHERE season_id = ${startSeason}
            LIMIT 1
          `;

          if (fantasyLeagues.length > 0) {
            const league = fantasyLeagues[0];
            const starRating = currentData?.[0]?.star_rating || 5;

            let draftPrice = 10;
            if (league.star_rating_prices) {
              const priceObj = league.star_rating_prices.find((p: any) => p.stars === starRating);
              if (priceObj) draftPrice = priceObj.price;
            }

            await fantasySql`
              INSERT INTO fantasy_players (
                player_id,
                league_id,
                player_name,
                real_team_id,
                real_team_name,
                position,
                star_rating,
                draft_price,
                is_available
              ) VALUES (
                ${playerId},
                ${league.league_id},
                ${player.playerName},
                ${player.teamId},
                ${teamName},
                'Unknown',
                ${starRating},
                ${draftPrice},
                true
              )
              ON CONFLICT (player_id, league_id) 
              DO UPDATE SET
                real_team_id = EXCLUDED.real_team_id,
                real_team_name = EXCLUDED.real_team_name,
                star_rating = EXCLUDED.star_rating,
                draft_price = EXCLUDED.draft_price,
                updated_at = CURRENT_TIMESTAMP
            `;

            console.log(`✅ Added ${player.playerName} to fantasy league`);
          }
        } catch (fantasyError) {
          console.error('Warning: Failed to add to fantasy:', fantasyError);
        }

        updateResults.push({
          playerId: playerId,
          playerName: player.playerName,
          teamId: player.teamId,
          contractId: contractId,
          database: 'Neon',
        });
      }
    } else {
      // HISTORICAL SEASON (1-15): Use Firebase batch
      const batch = adminDb.batch();

      for (const player of players) {
        if (!player.id || !player.teamId || !player.playerName) {
          return NextResponse.json(
            { error: `Invalid player data: missing id, teamId, or playerName` },
            { status: 400 }
          );
        }

        const existingPlayerDoc = await adminDb.collection('realplayer').doc(player.id).get();

        if (!existingPlayerDoc.exists) {
          console.warn(`Player document ${player.id} not found, skipping...`);
          continue;
        }

        const existingData = existingPlayerDoc.data();
        const playerId = existingData?.player_id || player.id;
        const contractId = existingData?.contract_id || `contract_${playerId}_${startSeason}_${Date.now()}`;

        const currentSeasonDocId = `${playerId}_${startSeason}`;
        const nextSeasonDocId = `${playerId}_${endSeason}`;

        const [currentSeasonDoc, nextSeasonDoc] = await Promise.all([
          adminDb.collection('realplayer').doc(currentSeasonDocId).get(),
          adminDb.collection('realplayer').doc(nextSeasonDocId).get()
        ]);

        const teamName = teamNames.get(player.teamId) || 'Unknown Team';
        const updateData = {
          team_id: player.teamId,
          team_name: teamName,
          auction_value: player.auctionValue,
          salary_per_match: player.salaryPerMatch,
          contract_start_season: startSeason,
          contract_end_season: endSeason,
          contract_id: contractId,
          contract_length: 2,
          updated_at: FieldValue.serverTimestamp(),
        };

        if (currentSeasonDoc.exists) {
          const currentSeasonRef = adminDb.collection('realplayer').doc(currentSeasonDocId);
          batch.update(currentSeasonRef, updateData);
        }

        const nextSeasonRef = adminDb.collection('realplayer').doc(nextSeasonDocId);
        if (nextSeasonDoc.exists) {
          batch.update(nextSeasonRef, updateData);
        } else {
          const currentData = currentSeasonDoc.data();
          batch.set(nextSeasonRef, {
            ...updateData,
            season_id: endSeason,
            player_id: playerId,
            player_name: player.playerName,
            name: player.playerName,
            is_auto_registered: true,
            star_rating: currentData?.star_rating || existingData?.star_rating || 0,
            category_name: currentData?.category_name || existingData?.category_name || '',
            category_id: currentData?.category_id || existingData?.category_id || null,
            registration_date: FieldValue.serverTimestamp(),
            created_at: FieldValue.serverTimestamp(),
          });
        }

        updateResults.push({
          playerId: playerId,
          playerName: player.playerName,
          teamId: player.teamId,
          contractId: contractId,
          database: 'Firebase',
        });
      }

      await batch.commit();
    }

    // Update team_seasons documents with player counts and spending
    // For bulk assignments, we cleared everything first so just count these players
    // For quick assign, we need to get current totals from database
    const teamPlayerMap = new Map<string, { count: number; totalSpent: number }>();

    if (isBulkAssignment) {
      // Bulk assignment - count only the players being assigned (team was cleared first)
      for (const player of players) {
        if (!teamPlayerMap.has(player.teamId)) {
          teamPlayerMap.set(player.teamId, { count: 0, totalSpent: 0 });
        }
        const teamData = teamPlayerMap.get(player.teamId)!;
        teamData.count++;
        teamData.totalSpent += player.auctionValue || 0;
      }
    } else {
      // Quick assign - need to calculate totals including existing players
      for (const teamId of uniqueTeamIds) {
        if (isModernSeason) {
          // Get all players currently assigned to this team from database
          // Use base season (without .5) for Neon query
          const baseStartSeason = startSeason.replace('.5', '');
          const currentPlayers = await sql`
            SELECT auction_value FROM player_seasons
            WHERE team_id = ${teamId}
              AND season_id = ${baseStartSeason}
              AND auction_value IS NOT NULL
          `;

          const currentCount = currentPlayers.length;
          const currentSpent = currentPlayers.reduce((sum: number, p: any) => sum + (p.auction_value || 0), 0);

          console.log(`📊 Quick assign - Team ${teamId}: ${currentCount} players, $${currentSpent} spent (season: ${baseStartSeason})`);

          teamPlayerMap.set(teamId, {
            count: currentCount,
            totalSpent: currentSpent
          });
        } else {
          // For historical seasons, calculate from Firebase documents
          // This is more complex, but for now we'll use the original logic
          // since historical seasons don't have the clearing issue
          for (const player of players) {
            if (!teamPlayerMap.has(player.teamId)) {
              teamPlayerMap.set(player.teamId, { count: 0, totalSpent: 0 });
            }
            const teamData = teamPlayerMap.get(player.teamId)!;
            teamData.count++;
            teamData.totalSpent += player.auctionValue || 0;
          }
        }
      }
    }

    // Update each team's team_seasons document for CURRENT season only
    // Next season team_seasons will be created at the end of current season
    for (const [teamId, data] of teamPlayerMap.entries()) {
      // Use base season (without .5) for Firebase document ID
      const baseStartSeason = startSeason.replace('.5', '');
      const currentSeasonDocId = `${teamId}_${baseStartSeason}`;

      // Update current season team_seasons
      const currentTeamSeasonRef = adminDb.collection('team_seasons').doc(currentSeasonDocId);
      const currentTeamSeasonDoc = await currentTeamSeasonRef.get();

      if (currentTeamSeasonDoc.exists) {
        const currentTeamData = currentTeamSeasonDoc.data();
        const currencySystem = currentTeamData?.currency_system || 'single';

        // Handle both single and dual currency systems
        const updateData: any = {
          players_count: data.count,
          updated_at: FieldValue.serverTimestamp(),
        };

        if (currencySystem === 'dual') {
          // Dual currency system - update real player budget fields
          if (isBulkAssignment) {
            // Bulk assignment - recalculate from scratch
            const startingBalance = currentTeamData?.initial_real_player_budget ||
              currentTeamData?.real_player_budget_initial ||
              currentTeamData?.real_player_starting_balance ||
              1000;
            const newBalance = startingBalance - data.totalSpent;

            updateData.real_player_spent = data.totalSpent;
            updateData.real_player_budget = newBalance;

            console.log(`💰 [BULK] Recalculating Firebase budget for ${teamId}: spent=${data.totalSpent}, balance=${newBalance} (starting=${startingBalance})`);
          } else {
            // Quick assign - incremental update
            const currentBudget = currentTeamData?.real_player_budget || 0;
            const currentSpent = currentTeamData?.real_player_spent || 0;
            const playerCost = players[0].auctionValue; // Single player in quick assign

            updateData.real_player_spent = currentSpent + playerCost;
            updateData.real_player_budget = currentBudget - playerCost;

            console.log(`💰 [QUICK] Incremental Firebase budget for ${teamId}: +${playerCost} spent (${currentSpent} → ${updateData.real_player_spent}), -${playerCost} budget (${currentBudget} → ${updateData.real_player_budget})`);
          }
        } else {
          // Single currency system - update main budget fields
          if (isBulkAssignment) {
            // Bulk assignment - recalculate from scratch
            const startingBalance = currentTeamData?.initial_budget ||
              currentTeamData?.budget_initial ||
              10000;
            const newBalance = startingBalance - data.totalSpent;

            updateData.total_spent = data.totalSpent;
            updateData.budget = newBalance;

            console.log(`💰 [BULK] Recalculating Firebase budget for ${teamId}: spent=${data.totalSpent}, balance=${newBalance} (starting=${startingBalance})`);
          } else {
            // Quick assign - incremental update
            const currentBudget = currentTeamData?.budget || 0;
            const currentSpent = currentTeamData?.total_spent || 0;
            const playerCost = players[0].auctionValue; // Single player in quick assign

            updateData.total_spent = currentSpent + playerCost;
            updateData.budget = currentBudget - playerCost;

            console.log(`💰 [QUICK] Incremental Firebase budget for ${teamId}: +${playerCost} spent (${currentSpent} → ${updateData.total_spent}), -${playerCost} budget (${currentBudget} → ${updateData.budget})`);
          }
        }

        await currentTeamSeasonRef.update(updateData);
        console.log(`✅ Updated team_seasons ${currentSeasonDocId} (${currencySystem}): ${data.count} players, $${data.totalSpent} spent`);

        // Delete old real_player_fee transactions for this team
        const oldTransactionsQuery = await adminDb
          .collection('transactions')
          .where('team_id', '==', teamId)
          .where('season_id', '==', startSeason)
          .where('transaction_type', '==', 'real_player_fee')
          .get();

        const deleteBatch = adminDb.batch();
        oldTransactionsQuery.docs.forEach(doc => {
          deleteBatch.delete(doc.ref);
        });

        if (!oldTransactionsQuery.empty) {
          await deleteBatch.commit();
          console.log(`✅ Deleted ${oldTransactionsQuery.size} old player transactions for team ${teamId}`);
        }

        // Create transaction records for each player assigned to this team
        const teamPlayers = players.filter(p => p.teamId === teamId);
        const transactionBatch = adminDb.batch();

        // Get player's star ratings from Neon database
        const playerStarRatings = new Map<string, number>();
        for (const player of teamPlayers) {
          try {
            const playerSeasonId = `${player.id}_${startSeason}`;
            const playerData = await sql`
              SELECT star_rating FROM player_seasons
              WHERE id = ${playerSeasonId}
              LIMIT 1
            `;
            if (playerData.length > 0) {
              playerStarRatings.set(player.id, playerData[0].star_rating || 0);
            }
          } catch (err) {
            console.warn(`Could not fetch star rating for player ${player.id}`);
          }
        }

        // Calculate progressive balance for each transaction
        let runningBalance = currentTeamData?.real_player_starting_balance || 0;

        for (const player of teamPlayers) {
          const starRating = playerStarRatings.get(player.id) || 0;
          runningBalance -= (player.auctionValue || 0);

          const transactionRef = adminDb.collection('transactions').doc();
          transactionBatch.set(transactionRef, {
            team_id: teamId,
            season_id: startSeason,
            transaction_type: 'real_player_fee',
            currency_type: 'real_player',
            amount: -(player.auctionValue || 0),
            balance_after: runningBalance, // Progressive balance after this player
            reason: `Assigned real player: ${player.playerName || 'Unknown'} (${starRating}⭐)`,
            metadata: {
              player_id: player.id || '',
              player_name: player.playerName || '',
              star_rating: starRating,
              auction_value: player.auctionValue || 0,
              salary_per_match: player.salaryPerMatch || 0,
              contract_start: startSeason || '',
              contract_end: endSeason || '',
            },
            created_at: FieldValue.serverTimestamp(),
            updated_at: FieldValue.serverTimestamp(),
          });
        }

        await transactionBatch.commit();
        console.log(`✅ Created ${teamPlayers.length} transaction records for team ${teamId}`);
      }
    }

    // Trigger news for each team getting players assigned
    try {
      // Get season name
      const seasonDoc = await adminDb.collection('seasons').doc(seasonId).get();
      const seasonName = seasonDoc.exists ? seasonDoc.data()?.name : undefined;

      // Generate news for each team that got players
      for (const [teamId, data] of teamPlayerMap.entries()) {
        const teamName = teamNames.get(teamId) || 'Unknown Team';
        const teamPlayers = players.filter(p => p.teamId === teamId);

        // Get team's current budget info (use base season for Firebase)
        const baseStartSeason = startSeason.replace('.5', '');
        const currentSeasonDocId = `${teamId}_${baseStartSeason}`;
        const currentTeamSeasonDoc = await adminDb.collection('team_seasons').doc(currentSeasonDocId).get();
        const currentTeamData = currentTeamSeasonDoc.exists ? currentTeamSeasonDoc.data() : null;
        const remainingBudget = currentTeamData?.real_player_budget || 0;
        const startingBudget = currentTeamData?.real_player_starting_balance || 0;

        // Fetch star ratings from database for news
        const playerDetailsWithStars = await Promise.all(teamPlayers.map(async (p) => {
          let starRating = 0;
          try {
            const playerSeasonId = `${p.id}_${startSeason}`;
            const playerData = await sql`
              SELECT star_rating FROM player_seasons
              WHERE id = ${playerSeasonId}
              LIMIT 1
            `;
            if (playerData.length > 0) {
              starRating = playerData[0].star_rating || 0;
            }
          } catch (err) {
            console.warn(`Could not fetch star rating for player ${p.id} in news`);
          }

          return {
            name: p.playerName || 'Unknown',
            star_rating: starRating,
            auction_value: p.auctionValue || 0,
            salary_per_match: p.salaryPerMatch || 0,
          };
        }));

        const playerDetails = playerDetailsWithStars;

        // Helper function to sanitize strings for JSON context
        const sanitizeForContext = (str: string) => {
          return str
            .replace(/[\r\n\t]/g, ' ')  // Replace newlines/tabs with spaces
            .replace(/["\\']/g, '')     // Remove quotes and backslashes
            .replace(/[^\x20-\x7E]/g, '')  // Remove non-printable ASCII
            .trim();
        };

        // Check if roster is complete (e.g., 5+ players typically means complete)
        const isRosterComplete = data.count >= 5;

        if (isRosterComplete) {
          // Trigger "roster complete" news with detailed info
          const playerList = playerDetails
            .map(p => `${sanitizeForContext(p.name)} (${p.star_rating} stars, $${p.auction_value})`)
            .join(', ');

          await triggerNews('team_roster_complete', {
            season_id: seasonId,
            season_name: seasonName,
            team_id: teamId,
            team_name: sanitizeForContext(teamName),
            player_count: data.count,
            total_spent: data.totalSpent,
            starting_budget: startingBudget,
            remaining_budget: remainingBudget,
            players: playerDetails,
            context: `${sanitizeForContext(teamName)} has completed their roster with ${data.count} SS Members for a total of $${data.totalSpent}. Starting budget was $${startingBudget}, remaining budget is $${remainingBudget}. Players: ${playerList}.`,
          });
        } else {
          // Trigger "players assigned" news with detailed info
          const playerList = playerDetails
            .map(p => `${sanitizeForContext(p.name)} (${p.star_rating} stars, $${p.auction_value})`)
            .join(', ');

          await triggerNews('team_players_assigned', {
            season_id: seasonId,
            season_name: seasonName,
            team_id: teamId,
            team_name: sanitizeForContext(teamName),
            player_count: data.count,
            total_spent: data.totalSpent,
            starting_budget: startingBudget,
            remaining_budget: remainingBudget,
            players: playerDetails,
            context: `${sanitizeForContext(teamName)} has assigned ${data.count} SS Member(s) for a total of $${data.totalSpent}. Starting budget was $${startingBudget}, remaining budget is $${remainingBudget}. Players: ${playerList}.`,
          });
        }
      }

      console.log(`✅ Generated news for ${teamPlayerMap.size} teams`);
    } catch (newsError) {
      console.error('Failed to generate team roster news:', newsError);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully assigned ${players.length} players and updated team budgets`,
      results: updateResults,
    });
  } catch (error) {
    console.error('Error in bulk player assignment:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to assign players' },
      { status: 500 }
    );
  }
}
