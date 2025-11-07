import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/auth-helper';
import { getCached, setCached } from '@/lib/firebase/cache';
import { checkAndFinalizeExpiredRound } from '@/lib/lazy-finalize-round';
import { batchGetFirebaseFields } from '@/lib/firebase/batch';
import { decryptBidData } from '@/lib/encryption';
import { getTournamentDb } from '@/lib/neon/tournament-config';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

export async function GET(request: NextRequest) {
  // Add cache headers for client-side caching
  const headers = new Headers({
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300', // 1 min cache, 5 min stale
    'CDN-Cache-Control': 'public, s-maxage=60',
  });
  try {
    // ✅ ZERO FIREBASE READS - Uses JWT claims only
    const auth = await verifyAuth(['team'], request);
    if (!auth.authenticated) {
      return NextResponse.json({
        success: false,
        error: auth.error || 'Unauthorized',
      }, { status: 401 });
    }

    const userId = auth.userId!;

    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('season_id');
    const bustCache = searchParams.get('bust_cache') === 'true'; // Allow cache busting

    if (!seasonId) {
      return NextResponse.json({
        success: false,
        error: 'Season ID is required',
      }, { status: 400 });
    }

    // Fetch season settings for slot limits
    // ⚡ Smart caching: Use cache unless explicitly busted by WebSocket update
    let seasonData = bustCache ? null : getCached<any>('seasons', seasonId, 30 * 60 * 1000);
    if (!seasonData) {
      const seasonDoc = await adminDb.collection('seasons').doc(seasonId).get();
      if (seasonDoc.exists) {
        seasonData = seasonDoc.data();
        setCached('seasons', seasonId, seasonData);
      }
    }

    // Get user data from Firebase (still needed for team name/logo)
    // ⚡ Smart caching: Use cache unless explicitly busted
    let userData = bustCache ? null : getCached<any>('users', userId, 30 * 60 * 1000);
    if (!userData) {
      const userDoc = await adminDb.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        return NextResponse.json({
          success: false,
          error: 'User not found',
        }, { status: 404 });
      }
      userData = userDoc.data();
      setCached('users', userId, userData);
    }

    // Find team_season by querying with user_id or team_id + season_id
    // The document ID might be either userId_seasonId OR teamId_seasonId
    let teamSeasonData = null;
    let teamSeasonId = `${userId}_${seasonId}`;
    
    // ⚡ Smart caching: Shorter TTL for team_seasons (updates more frequently)
    teamSeasonData = bustCache ? null : getCached<any>('team_seasons', teamSeasonId, 5 * 60 * 1000); // 5 min TTL
    
    if (!teamSeasonData) {
      const teamSeasonDoc = await adminDb.collection('team_seasons').doc(teamSeasonId).get();
      
      if (teamSeasonDoc.exists) {
        teamSeasonData = teamSeasonDoc.data();
        setCached('team_seasons', teamSeasonId, teamSeasonData);
      } else {
        // Fallback: Query by user_id field (for teams where document ID uses team_id)
        console.log(`Document ${teamSeasonId} not found, querying by user_id field`);
        const teamSeasonQuery = await adminDb.collection('team_seasons')
          .where('user_id', '==', userId)
          .where('season_id', '==', seasonId)
          .where('status', '==', 'registered')
          .limit(1)
          .get();
        
        if (teamSeasonQuery.empty) {
          return NextResponse.json({
            success: false,
            error: 'Team not registered for this season',
          }, { status: 404 });
        }
        
        const doc = teamSeasonQuery.docs[0];
        teamSeasonData = doc.data();
        teamSeasonId = doc.id; // Use the actual document ID
        setCached('team_seasons', teamSeasonId, teamSeasonData);
        console.log(`Found team_season with ID: ${teamSeasonId}`);
      }
    }
    
    // Get team ID from database using Firebase UID FIRST
    let teamIdResult = await sql`
      SELECT id FROM teams WHERE firebase_uid = ${userId} LIMIT 1
    `;
    
    let dbTeamId = teamIdResult.length > 0 ? teamIdResult[0].id : null;
    
    if (dbTeamId) {
      console.log(`✅ Found team ID: ${dbTeamId} for user ${userId}`);
    } else {
      console.log(`⚠️ No team record found for user ${userId} - creating...`);
      
      // Get team_id from Firebase team_seasons
      dbTeamId = teamSeasonData?.team_id;
      
      if (dbTeamId) {
        // Create team in Neon with ID from Firebase
        const teamName = teamSeasonData?.team_name || userData?.teamName || 'Team';
        const footballBudget = teamSeasonData?.football_budget || 0;
        const footballSpent = teamSeasonData?.football_spent || 0;
        
        try {
          await sql`
            INSERT INTO teams (id, name, firebase_uid, season_id, football_budget, football_spent, created_at, updated_at)
            VALUES (${dbTeamId}, ${teamName}, ${userId}, ${seasonId}, ${footballBudget}, ${footballSpent}, NOW(), NOW())
          `;
          console.log(`✅ Created team: ${dbTeamId} (${teamName})`);
        } catch (insertError: any) {
          if (insertError.code === '23505') {
            // Duplicate - someone else created it, fetch it
            console.log(`⚠️ Duplicate team (race condition), fetching...`);
            teamIdResult = await sql`SELECT id FROM teams WHERE firebase_uid = ${userId} LIMIT 1`;
            dbTeamId = teamIdResult[0]?.id || dbTeamId;
          } else {
            console.error('Error creating team:', insertError);
          }
        }
      } else {
        console.warn(`⚠️ No team_id found in Firebase for user ${userId}`);
        dbTeamId = null;
      }
    }
    
    // Determine currency system (dual or single)
    const currencySystem = teamSeasonData?.currency_system || 'single';
    const isDualCurrency = currencySystem === 'dual';
    
    // Create teamData with CORRECT team ID from database
    const teamData: any = {
      id: dbTeamId || userId, // Use database team ID if exists, fallback to userId
      name: teamSeasonData?.team_name || userData?.teamName || 'Team',
      logo_url: teamSeasonData?.team_logo || userData?.logoUrl || null,
      currency_system: currencySystem,
    };
    
    // Add budget fields based on currency system
    if (isDualCurrency) {
      teamData.football_budget = teamSeasonData?.football_budget || 10000;
      teamData.real_player_budget = teamSeasonData?.real_player_budget || 5000;
      teamData.football_spent = teamSeasonData?.football_spent || 0;
      teamData.real_player_spent = teamSeasonData?.real_player_spent || 0;
      // Legacy balance field for backward compatibility
      teamData.balance = teamData.football_budget + teamData.real_player_budget;
    } else {
      teamData.balance = teamSeasonData?.budget || 15000;
      teamData.total_spent = teamSeasonData?.total_spent || 0;
    }
    
    // Add contract fields
    teamData.skipped_seasons = teamSeasonData?.skipped_seasons || 0;
    teamData.penalty_amount = teamSeasonData?.penalty_amount || 0;
    teamData.last_played_season = teamSeasonData?.last_played_season || null;
    teamData.contract_id = teamSeasonData?.contract_id || null;
    teamData.contract_start_season = teamSeasonData?.contract_start_season || null;
    teamData.contract_end_season = teamSeasonData?.contract_end_season || null;
    teamData.is_auto_registered = teamSeasonData?.is_auto_registered || false;

    // Fetch active rounds for this season from Neon
    console.log('🔍 Fetching active rounds for season:', seasonId);
    
    // First, get all active rounds to check for expiration
    const activeRoundsResult = await sql`
      SELECT 
        r.*,
        COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'active') as total_bids,
        COUNT(DISTINCT b.team_id) FILTER (WHERE b.status = 'active') as teams_bid,
        CASE 
          WHEN r.round_type = 'bulk' THEN (SELECT COUNT(*) FROM round_players WHERE round_id = r.id)
          ELSE 0
        END as player_count
      FROM rounds r
      LEFT JOIN bids b ON r.id = b.round_id
      WHERE r.season_id = ${seasonId}
      AND r.status = 'active'
      GROUP BY r.id
      ORDER BY r.created_at DESC
    `;
    console.log('✅ Found active rounds:', activeRoundsResult.length);
    if (activeRoundsResult.length > 0) {
      console.log('   Round details:', activeRoundsResult.map(r => ({ id: r.id, position: r.position, status: r.status })));
      
      // Auto-finalize any expired rounds (lazy finalization)
      for (const round of activeRoundsResult) {
        await checkAndFinalizeExpiredRound(round.id);
      }
    }
    
    // For each active round, fetch tiebreaker information
    const activeRounds = await Promise.all(activeRoundsResult.map(async (round) => {
      // Fetch tiebreakers for this round
      const roundTiebreakersResult = await sql`
        SELECT 
          t.*,
          p.name as player_name,
          p.position as player_position,
          p.overall_rating,
          p.team_name as player_team,
          (
            SELECT json_agg(json_build_object(
              'team_id', tt2.team_id,
              'old_bid', tt2.old_bid_amount,
              'new_bid', tt2.new_bid_amount,
              'submitted', tt2.submitted
            ))
            FROM team_tiebreakers tt2
            WHERE tt2.tiebreaker_id = t.id
          ) as teams_data
        FROM tiebreakers t
        INNER JOIN footballplayers p ON t.player_id = p.id
        WHERE t.round_id = ${round.id}
        AND t.status = 'active'
        ORDER BY t.created_at DESC
      `;
      
      // Collect all team IDs from all tiebreakers
      const allTeamIds = new Set<string>();
      roundTiebreakersResult.forEach(tb => {
        const teamsData = tb.teams_data || [];
        teamsData.forEach((t: any) => {
          if (t.team_id) allTeamIds.add(t.team_id);
        });
      });
      
      // Fetch team names from Firebase for all teams involved - OPTIMIZED with batch queries
      const teamNamesMap: Record<string, string> = {};
      if (allTeamIds.size > 0) {
        // Batch fetch team_seasons
        const teamSeasonIds = Array.from(allTeamIds).map(teamId => `${teamId}_${seasonId}`);
        const teamSeasonsMap = await batchGetFirebaseFields<{ team_name: string }>(
          'team_seasons',
          teamSeasonIds,
          ['team_name']
        );
        
        // Map team_season data to team IDs
        const teamsWithoutSeasonData: string[] = [];
        Array.from(allTeamIds).forEach(teamId => {
          const tsId = `${teamId}_${seasonId}`;
          const tsData = teamSeasonsMap.get(tsId);
          if (tsData?.team_name) {
            teamNamesMap[teamId] = tsData.team_name;
          } else {
            teamsWithoutSeasonData.push(teamId);
          }
        });
        
        // Fallback: Batch fetch from users collection for teams without season data
        if (teamsWithoutSeasonData.length > 0) {
          const usersMap = await batchGetFirebaseFields<{ teamName: string }>(
            'users',
            teamsWithoutSeasonData,
            ['teamName']
          );
          
          teamsWithoutSeasonData.forEach(teamId => {
            const userData = usersMap.get(teamId);
            teamNamesMap[teamId] = userData?.teamName || 'Unknown Team';
          });
        }
      }
      
      // Map tiebreakers and add team names
      const roundTiebreakers = roundTiebreakersResult.map(tb => {
        const teamsData = tb.teams_data || [];
        const teamsWithNames = teamsData.map((t: any) => ({
          ...t,
          team_name: teamNamesMap[t.team_id] || 'Unknown Team',
        }));
        
        return {
          id: tb.id,
          player_id: tb.player_id,
          player_name: tb.player_name,
          player_position: tb.player_position,
          overall_rating: tb.overall_rating,
          player_team: tb.player_team,
          original_amount: tb.original_amount,
          status: tb.status,
          winning_amount: tb.winning_amount,
          teams: teamsWithNames,
        };
      });
      
      // Use round_number from database if available, otherwise extract from ID
      const roundNumber = round.round_number || (() => {
        const roundNumberMatch = round.id.match(/\d+$/);
        return roundNumberMatch ? parseInt(roundNumberMatch[0], 10) : 0;
      })();
      
      console.log(`📍 Round ${round.id}: round_number from DB = ${round.round_number}, final = ${roundNumber}`);
      
      return {
        id: round.id,
        round_number: roundNumber,
        season_id: round.season_id,
        position: round.position,
        round_type: round.round_type,
        status: round.status,
        end_time: round.end_time,
        max_bids_per_team: round.max_bids_per_team,
        player_count: round.player_count || 0,
        total_bids: parseInt(round.total_bids || '0'),
        teams_bid: parseInt(round.teams_bid || '0'),
        created_at: round.created_at,
        tiebreakers: roundTiebreakers,
      };
    }));

    // dbTeamId already retrieved earlier and used in teamData.id
    
    // Fetch team's current bids from SQL/Neon (where they're actually stored)
    const activeRoundIds = activeRounds.map(r => r.id);
    let activeBids: any[] = [];
    
    if (activeRoundIds.length > 0 && dbTeamId) {
      const bidsResult = await sql`
        SELECT 
          b.id,
          b.team_id,
          b.player_id,
          b.round_id,
          b.amount,
          b.encrypted_bid_data,
          b.status,
          b.created_at,
          p.name as player_name,
          p.position as player_position,
          p.overall_rating,
          p.team_name as player_team
        FROM bids b
        INNER JOIN footballplayers p ON b.player_id = p.id
        WHERE b.team_id = ${dbTeamId}
        AND b.round_id = ANY(${activeRoundIds})
        AND b.status = 'active'
        ORDER BY b.created_at DESC
      `;
      
      activeBids = bidsResult.map(bid => {
        // Decrypt the bid amount if it's null (blind bidding)
        let decryptedAmount = bid.amount;
        if (bid.amount === null && bid.encrypted_bid_data) {
          try {
            const decrypted = decryptBidData(bid.encrypted_bid_data);
            decryptedAmount = decrypted.amount;
          } catch (err) {
            console.error('Failed to decrypt bid:', err);
            decryptedAmount = 0; // Fallback
          }
        }

        return {
          id: bid.id,
          team_id: bid.team_id,
          player_id: bid.player_id,
          round_id: bid.round_id,
          amount: decryptedAmount,
          status: bid.status,
          created_at: bid.created_at,
          player: {
            id: bid.player_id,
            name: bid.player_name,
            position: bid.player_position,
            overall_rating: bid.overall_rating,
            nfl_team: bid.player_team,
          },
        };
      });
    }
    
    console.log(`✅ Fetched ${activeBids.length} active bids from SQL for team ${dbTeamId || userId}`);

    // Fetch team's players from Neon (team_players table)
    const playersResult = dbTeamId ? await sql`
      SELECT 
        tp.id,
        tp.player_id,
        tp.team_id,
        tp.purchase_price,
        tp.acquired_at,
        fp.name,
        fp.position,
        fp.position_group,
        fp.team_name as nfl_team,
        fp.overall_rating,
        fp.player_id as football_player_id
      FROM team_players tp
      INNER JOIN footballplayers fp ON tp.player_id = fp.id
      WHERE tp.team_id = ${dbTeamId}
      ORDER BY tp.acquired_at DESC
    ` : [];
    
    const players = playersResult.map(player => ({
      id: player.id,
      name: player.name,
      position: player.position,
      position_group: player.position_group,
      nfl_team: player.nfl_team,
      overall_rating: player.overall_rating,
      acquisition_value: player.purchase_price,
      player_id: player.football_player_id || player.player_id,
    }));

    // Fetch tiebreakers from Neon (if any)
    // Include both regular tiebreakers (team_id matches) and bulk round tiebreakers (composite ID pattern)
    console.log(`🔍 Fetching tiebreakers for team ${dbTeamId}, season ${seasonId}`);
    
    // Debug: Check what's in the database
    if (dbTeamId) {
      const debugTiebreakers = await sql`SELECT id, round_id, player_id, status, season_id FROM tiebreakers WHERE season_id = ${seasonId}`;
      console.log(`   📊 Total tiebreakers in season: ${debugTiebreakers.length}`, debugTiebreakers);
      
      const debugTeamTiebreakers = await sql`SELECT id, tiebreaker_id, team_id, team_name, submitted FROM team_tiebreakers LIMIT 10`;
      console.log(`   📊 Team tiebreakers sample:`, debugTeamTiebreakers);
    }
    
    const tiebreakersResult = dbTeamId ? await sql`
      SELECT 
        t.*,
        p.name as player_name,
        p.position,
        p.overall_rating,
        p.team_name as player_team,
        r.position as round_position,
        r.season_id,
        r.round_type,
        tt.old_bid_amount as team_old_bid,
        tt.new_bid_amount as team_new_bid,
        tt.submitted as team_submitted,
        tt.submitted_at as team_submitted_at
      FROM tiebreakers t
      INNER JOIN footballplayers p ON t.player_id = p.id
      LEFT JOIN rounds r ON t.round_id = r.id
      INNER JOIN team_tiebreakers tt ON t.id = tt.tiebreaker_id
      WHERE (tt.team_id = ${dbTeamId} OR tt.id LIKE ${userId + '_%'})
      AND t.status = 'active'
      AND t.season_id = ${seasonId}
      ORDER BY t.created_at DESC
    ` : [];
    console.log(`✅ Found ${tiebreakersResult.length} tiebreaker(s) for team ${dbTeamId}`);
    if (tiebreakersResult.length > 0) {
      console.log('   Tiebreaker details:', tiebreakersResult.map(t => ({ id: t.id, player: t.player_name, status: t.status })));
    }
    
    const tiebreakers = tiebreakersResult.map(tiebreaker => ({
      id: tiebreaker.id,
      round_id: tiebreaker.round_id,
      round_type: tiebreaker.round_type,
      is_bulk: tiebreaker.round_type === 'bulk',
      player_id: tiebreaker.player_id,
      player: {
        id: tiebreaker.player_id,
        name: tiebreaker.player_name,
        position: tiebreaker.position,
        overall_rating: tiebreaker.overall_rating,
        nfl_team: tiebreaker.player_team,
      },
      original_amount: tiebreaker.original_amount,
      status: tiebreaker.status,
      old_bid: tiebreaker.team_old_bid,
      new_bid: tiebreaker.team_new_bid,
      submitted: tiebreaker.team_submitted,
    }));

    // Fetch bulk tiebreakers from SQL (if any)
    // Note: Query bulk_tiebreaker_teams to find active tiebreakers for this team
    const bulkTiebreakersResult = dbTeamId ? await sql`
      SELECT 
        bt.id,
        bt.bulk_round_id,
        bt.player_id,
        bt.base_price,
        bt.status,
        bt.current_highest_bid,
        p.name as player_name,
        p.position,
        p.overall_rating,
        p.team_name as player_team,
        btt.current_bid as team_current_bid,
        btt.status as team_status
      FROM bulk_tiebreakers bt
      INNER JOIN footballplayers p ON bt.player_id = p.id
      INNER JOIN bulk_tiebreaker_teams btt ON bt.id = btt.tiebreaker_id
      WHERE bt.season_id = ${seasonId}
      AND bt.status IN ('active', 'ongoing')
      AND btt.team_id = ${dbTeamId}
      AND btt.status = 'active'
      ORDER BY bt.created_at DESC
    ` : [];
    
    const bulkTiebreakers = bulkTiebreakersResult.map(bt => ({
      id: bt.id,
      bulk_round_id: bt.bulk_round_id,
      player_id: bt.player_id,
      player: {
        id: bt.player_id,
        name: bt.player_name,
        position: bt.position,
        overall_rating: bt.overall_rating,
        nfl_team: bt.player_team,
      },
      base_price: bt.base_price,
      current_highest_bid: bt.current_highest_bid,
      team_current_bid: bt.team_current_bid,
      status: bt.status,
      is_bulk: true,
    }));

    // Fetch bulk rounds (if any active)
    const bulkRoundsSnapshot = await adminDb
      .collection('bulk_rounds')
      .where('season_id', '==', seasonId)
      .where('status', '==', 'active')
      .get();
    const activeBulkRounds = bulkRoundsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Check if team has a fantasy team registered
    const fantasyTeamsSnapshot = await adminDb
      .collection('fantasy_teams')
      .where('user_id', '==', userId)
      .limit(1)
      .get();
    const hasFantasyTeam = !fantasyTeamsSnapshot.empty;

    // Fetch owner, manager, and real players from tournament database
    // NOTE: Tournament DB uses string team IDs (e.g., SSPSLT0020), not numeric IDs
    const tournamentSql = getTournamentDb();
    let ownerData = null;
    let managerData = null;
    let realPlayers: any[] = [];

    // Prefer Neon team ID (readable string like SSPSLT0020); fallback to Firebase team_seasons.team_id
    const stringTeamId = dbTeamId || teamSeasonData?.team_id || null;
    console.log(`🔍 Fetching owner/manager/players for team_id: ${stringTeamId} (Neon ID: ${dbTeamId}), season_id: ${seasonId}`);
    
    if (stringTeamId) {
      try {
        // Fetch owner (uses numeric Neon team_id)
        const ownerResult = await tournamentSql`
          SELECT * FROM owners 
          WHERE team_id = ${dbTeamId} 
          AND is_active = true 
          LIMIT 1
        `;
        ownerData = ownerResult[0] || null;
        console.log(`👤 Owner data found:`, ownerData ? `Yes (${ownerData.name})` : 'No');

        // Fetch manager (uses numeric Neon team_id)
        const managerResult = await tournamentSql`
          SELECT * FROM managers 
          WHERE team_id = ${dbTeamId} 
          AND season_id = ${seasonId} 
          AND is_active = true 
          LIMIT 1
        `;
        managerData = managerResult[0] || null;
        console.log(`⚽ Manager data found:`, managerData ? `Yes (${managerData.name})` : 'No');

        // Fetch real players assigned to this team from player_seasons (tournament DB)
        // Note: We avoid joining realplayers; use stored snapshot fields for reliability
        const realPlayersResult = await tournamentSql`
          SELECT 
            id,
            player_id,
            team_id,
            season_id,
            player_name,
            category,
            star_rating,
            points,
            registration_status
          FROM player_seasons
          WHERE team_id = ${stringTeamId}
          AND season_id = ${seasonId}
          AND registration_status = 'active'
          ORDER BY player_name ASC
        `;
        realPlayers = realPlayersResult.map(p => ({
          id: p.id,
          player_id: p.player_id,
          name: p.player_name,
          position: p.category,
          jersey_number: null,
          overall_rating: p.star_rating || 0,
          photo_url: null,
        }));
        console.log(`👥 Real players found:`, realPlayers.length);
      } catch (error) {
        console.error('❌ Error fetching owner/manager/players data:', error);
        // Don't fail the entire request if owner/manager/players fetch fails
      }
    } else {
      console.log('⚠️ No string team_id found in team_seasons data');
    }

    // Fetch round results from Neon (completed bids)
    const roundResultsQuery = dbTeamId ? await sql`
      SELECT 
        b.id,
        b.team_id,
        b.player_id,
        b.round_id,
        b.amount,
        b.encrypted_bid_data,
        b.status,
        b.created_at,
        b.updated_at,
        p.name as player_name,
        p.position as player_position,
        p.overall_rating,
        p.team_name as player_team,
        r.position as round_position,
        r.season_id
      FROM bids b
      INNER JOIN footballplayers p ON b.player_id = p.id
      INNER JOIN rounds r ON b.round_id = r.id
      WHERE b.team_id = ${dbTeamId}
      AND r.season_id = ${seasonId}
      AND b.status = 'won'
      ORDER BY b.updated_at DESC
      LIMIT 50
    ` : [];
    
    const roundResults = roundResultsQuery.map(result => {
      // Decrypt the bid amount if it's null (blind bidding)
      let decryptedAmount = result.amount;
      if (result.amount === null && result.encrypted_bid_data) {
        try {
          const decrypted = decryptBidData(result.encrypted_bid_data);
          decryptedAmount = decrypted.amount;
        } catch (err) {
          console.error('Failed to decrypt bid result:', err);
          decryptedAmount = 0; // Fallback
        }
      }
      
      return {
        id: result.id,
        team_id: result.team_id,
        player_id: result.player_id,
        round_id: result.round_id,
        won: result.status === 'won',
        bid_amount: decryptedAmount || 0,
        final_amount: decryptedAmount || 0, // In sealed bid, final amount = bid amount
        player: {
          id: result.player_id,
          name: result.player_name,
          position: result.player_position,
          overall_rating: result.overall_rating,
          nfl_team: result.player_team,
        },
        round: {
          id: result.round_id,
          season_id: result.season_id,
          position: result.round_position,
          status: 'completed',
        },
      };
    });

    // Calculate average rating from players (only stat we need to calculate)
    const avgRating = players.length > 0 
      ? players.reduce((sum, p) => sum + (p.overall_rating || 0), 0) / players.length 
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        team: teamData,
        owner: ownerData,
        manager: managerData,
        activeRounds,
        activeBids,
        players, // Football players for auction
        realPlayers, // Real players assigned to team (for manager selection)
        tiebreakers,
        bulkTiebreakers,
        activeBulkRounds,
        roundResults,
        seasonParticipation: teamSeasonData,
        hasFantasyTeam,
        seasonSettings: {
          euro_budget: seasonData?.euro_budget || 10000,
          dollar_budget: seasonData?.dollar_budget || 5000,
          min_real_players: seasonData?.min_real_players || 5,
          max_real_players: seasonData?.max_real_players || 7,
          max_football_players: seasonData?.max_football_players || 25,
        },
        stats: {
          playerCount: players.length, // Count actual football players from query, not from teamstats
          balance: teamSeasonData?.budget || 0,
          totalSpent: teamSeasonData?.total_spent || 0,
          avgRating: Math.round(avgRating * 10) / 10,
          activeBidsCount: activeBids.length,
          positionBreakdown: teamSeasonData?.position_counts || {},
        },
      },
    }, { headers });

  } catch (error) {
    console.error('Error fetching team dashboard data:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch dashboard data',
    }, { status: 500 });
  }
}
