import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { fantasySql } from '@/lib/neon/fantasy-config';

export async function POST(request: NextRequest) {
  try {
    // Get Firebase ID token from cookie or Authorization header
    const cookieStore = await cookies();
    let token = cookieStore.get('token')?.value;
    
    // Fallback to Authorization header
    if (!token) {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - No authentication token found' },
        { status: 401 }
      );
    }

    // Verify Firebase ID token
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token, true); // checkRevoked = true
    } catch (err: any) {
      console.error('Token verification error:', err);
      
      // Provide more detailed error
      if (err.code === 'auth/id-token-expired') {
        return NextResponse.json(
          { error: 'Token expired - Please refresh the page and try again' },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        { error: 'Invalid token - Please log in again', details: err.message },
        { status: 401 }
      );
    }

    // Check if user is committee admin
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();
    
    if (!userData || userData.role !== 'committee_admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Committee admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
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
      // Try to get team name from team_seasons document
      const teamSeasonDocId = `${teamId}_${startSeason}`;
      const teamSeasonDoc = await adminDb.collection('team_seasons').doc(teamSeasonDocId).get();
      
      if (teamSeasonDoc.exists) {
        const teamData = teamSeasonDoc.data();
        teamNames.set(teamId, teamData?.team_name || teamData?.username || 'Unknown Team');
      } else {
        teamNames.set(teamId, 'Unknown Team');
      }
    }

    // Process all players - update both season documents for each player
    const updateResults: any[] = [];

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
        const contractId = `contract_${playerId}_${startSeason}_${Date.now()}`;

        console.log(`Processing player (Neon): ${player.playerName}, ID: ${playerId}`);

        // Update CURRENT season in player_seasons table
        const currentSeasonCompositeId = `${playerId}_${startSeason}`;
        await sql`
          UPDATE player_seasons
          SET team_id = ${player.teamId},
              team = ${teamName},
              auction_value = ${player.auctionValue},
              salary_per_match = ${player.salaryPerMatch},
              contract_id = ${contractId},
              contract_start_season = ${startSeason},
              contract_end_season = ${endSeason},
              contract_length = 2,
              updated_at = NOW()
          WHERE id = ${currentSeasonCompositeId}
        `;

        // Create or update NEXT season in player_seasons table
        const nextSeasonCompositeId = `${playerId}_${endSeason}`;
        
        // Check if next season record exists
        const existingNext = await sql`
          SELECT * FROM player_seasons
          WHERE id = ${nextSeasonCompositeId}
          LIMIT 1
        `;

        if (existingNext.length > 0) {
          // Update existing
          await sql`
            UPDATE player_seasons
            SET team_id = ${player.teamId},
                team = ${teamName},
                auction_value = ${player.auctionValue},
                salary_per_match = ${player.salaryPerMatch},
                contract_id = ${contractId},
                contract_start_season = ${startSeason},
                contract_end_season = ${endSeason},
                contract_length = 2,
                updated_at = NOW()
            WHERE id = ${nextSeasonCompositeId}
          `;
        } else {
          // Create new record for next season
          // Get current season data for star_rating only
          const currentData = await sql`
            SELECT star_rating FROM player_seasons
            WHERE id = ${currentSeasonCompositeId}
            LIMIT 1
          `;

          const starRating = currentData[0]?.star_rating || 0;
          
          // Calculate base points from star rating
          const STAR_RATING_BASE_POINTS: { [key: number]: number } = {
            3: 100, 4: 120, 5: 145, 6: 175, 7: 210,
            8: 250, 9: 300, 10: 375
          };
          const basePoints = STAR_RATING_BASE_POINTS[starRating] || 100;

          await sql`
            INSERT INTO player_seasons (
              id, season_id, player_id, player_name,
              team_id, team,
              auction_value, salary_per_match,
              star_rating, category, points,
              matches_played, goals_scored, assists, wins, draws, losses,
              clean_sheets, motm_awards,
              contract_id, contract_start_season, contract_end_season, contract_length,
              is_auto_registered, registration_date, created_at, updated_at
            ) VALUES (
              ${nextSeasonCompositeId}, ${endSeason}, ${playerId}, ${player.playerName},
              ${player.teamId}, ${teamName},
              ${player.auctionValue}, ${player.salaryPerMatch},
              ${starRating}, null, ${basePoints},
              0, 0, 0, 0, 0, 0, 0, 0,
              ${contractId}, ${startSeason}, ${endSeason}, 2,
              true, NOW(), NOW(), NOW()
            )
          `;
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
    // Group players by team
    const teamPlayerMap = new Map<string, { count: number; totalSpent: number }>();
    
    for (const player of players) {
      if (!teamPlayerMap.has(player.teamId)) {
        teamPlayerMap.set(player.teamId, { count: 0, totalSpent: 0 });
      }
      const teamData = teamPlayerMap.get(player.teamId)!;
      teamData.count++;
      teamData.totalSpent += player.auctionValue || 0;
    }

    // Update each team's team_seasons document for CURRENT season only
    // Next season team_seasons will be created at the end of current season
    for (const [teamId, data] of teamPlayerMap.entries()) {
      const currentSeasonDocId = `${teamId}_${startSeason}`;

      // Update current season team_seasons
      const currentTeamSeasonRef = adminDb.collection('team_seasons').doc(currentSeasonDocId);
      const currentTeamSeasonDoc = await currentTeamSeasonRef.get();
      
      if (currentTeamSeasonDoc.exists) {
        const currentTeamData = currentTeamSeasonDoc.data();
        await currentTeamSeasonRef.update({
          players_count: data.count,
          real_player_spent: data.totalSpent,
          real_player_budget: (currentTeamData?.real_player_starting_balance || 5000) - data.totalSpent,
          updated_at: FieldValue.serverTimestamp(),
        });
        console.log(`Updated team_seasons ${currentSeasonDocId}: ${data.count} players, $${data.totalSpent} spent`);
      }
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
