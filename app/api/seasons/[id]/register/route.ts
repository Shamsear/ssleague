import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { triggerNews } from '@/lib/news/trigger';
import { logInitialBalance } from '@/lib/transaction-logger';
import { getFantasyDb } from '@/lib/neon/fantasy-config';
import { sendNotification } from '@/lib/notifications/send-notification';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get userId from request body (sent by client after authentication)
    const body = await request.json();
    const { action, userId, managerName, joinFantasy } = body; // NEW: Added managerName and joinFantasy

    if (!userId) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized - No user ID provided',
      }, { status: 401 });
    }

    const { id: seasonId } = await params;

    if (!action || !['join', 'decline'].includes(action)) {
      return NextResponse.json({
        success: false,
        message: 'Invalid action. Must be "join" or "decline"',
      }, { status: 400 });
    }

    // Check if season exists
    const seasonDoc = await adminDb.collection('seasons').doc(seasonId).get();
    if (!seasonDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Season not found',
      }, { status: 404 });
    }

    const seasonData = seasonDoc.data()!;

    // Check if team/user exists
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Team not found',
      }, { status: 404 });
    }

    const userData = userDoc.data()!;

    // Get team name and team ID from user data
    const teamName = userData.teamName || userData.username || 'Team';
    const teamId = userData.teamId; // User document should have teamId field

    // Check if team document exists
    let teamDocId: string;
    let existingTeamQuery: any = { empty: true };

    if (teamId) {
      // Try to get team document by teamId from user data
      const teamDoc = await adminDb.collection('teams').doc(teamId).get();
      if (teamDoc.exists) {
        teamDocId = teamId;
        existingTeamQuery = { empty: false, docs: [teamDoc] };
        console.log(`✅ Found existing team: ${teamDocId} for user ${userId}`);
        console.log(`📋 Will create team_season document: ${teamDocId}_${seasonId}`);
      }
    }

    if (!teamId || existingTeamQuery.empty) {
      // Fallback: Try to find team by owner_uid
      const teamQuery = await adminDb.collection('teams')
        .where('owner_uid', '==', userId)
        .limit(1)
        .get();

      if (!teamQuery.empty) {
        teamDocId = teamQuery.docs[0].id;
        existingTeamQuery = teamQuery;
        console.log(`✅ Found existing team by owner_uid: ${teamDocId} for user ${userId}`);
        console.log(`📋 Will create team_season document: ${teamDocId}_${seasonId}`);
      } else {
        // No team document exists - this should NOT happen during season registration
        // Teams must be created during initial signup, not during season registration
        console.error(`❌ No team document found for user ${userId}`);
        return NextResponse.json({
          success: false,
          message: 'Team not found. Please complete team registration first.',
        }, { status: 404 });
      }
    }

    // Check if team has already made a decision for this season
    let teamSeasonId = `${teamDocId}_${seasonId}`;
    const existingTeamSeason = await adminDb.collection('team_seasons').doc(teamSeasonId).get();

    if (existingTeamSeason.exists) {
      const existingData = existingTeamSeason.data()!;
      const statusMessage = existingData.status === 'registered'
        ? 'You have already joined this season'
        : 'You have already declined this season';

      return NextResponse.json({
        success: false,
        message: statusMessage,
      }, { status: 400 });
    }

    // Determine if this is a dual-currency season based on season type
    const seasonNumber = parseInt(seasonId.replace(/\D/g, '')) || 0;
    const isDualCurrency = seasonData.type === 'multi';

    // Use season settings for budgets (with fallbacks)
    let footballBudget = isDualCurrency ? (seasonData.euro_budget || 10000) : 0;
    let realPlayerBudget = isDualCurrency ? (seasonData.dollar_budget || 5000) : 0;
    let startingBalance = seasonData.starting_balance || 15000;
    let skippedSeasons = 0;
    let penaltyAmount = 0;
    let lastPlayedSeason: any = null;

    // Find team's last played season
    if (!existingTeamQuery.empty) {
      const existingTeamData = existingTeamQuery.docs[0].data();
      const teamSeasons = existingTeamData.seasons || [];

      if (teamSeasons.length > 0) {
        // Get all previous team_seasons to find last played
        const teamSeasonsQuery = await adminDb.collection('team_seasons')
          .where('team_id', '==', teamDocId)
          .where('status', '==', 'registered')
          .get();

        let lastSeasonNumber = 0;
        teamSeasonsQuery.docs.forEach(doc => {
          const data = doc.data();
          const sNum = parseInt(data.season_id.replace(/\D/g, '')) || 0;
          if (sNum > lastSeasonNumber) {
            lastSeasonNumber = sNum;
            lastPlayedSeason = data;
          }
        });

        // Check if there's a gap (skipped seasons)
        if (lastSeasonNumber > 0 && seasonNumber > lastSeasonNumber + 1) {
          skippedSeasons = seasonNumber - lastSeasonNumber - 1;

          // Calculate penalty: €500 per skipped season (adjustable)
          const penaltyPerSeason = 500;
          penaltyAmount = skippedSeasons * penaltyPerSeason;

          console.log(`⚠️ Team ${teamName} skipped ${skippedSeasons} season(s). Penalty: €${penaltyAmount}`);

          // Use last season's ending budget (frozen budget)
          if (lastPlayedSeason.currency_system === 'dual') {
            footballBudget = (lastPlayedSeason.football_budget || 10000) - penaltyAmount;
            realPlayerBudget = lastPlayedSeason.real_player_budget || 5000;
          } else {
            startingBalance = (lastPlayedSeason.budget || 15000) - penaltyAmount;
          }

          console.log(`💰 Budget carried from Season ${lastSeasonNumber}: Football €${footballBudget}, Real $${realPlayerBudget}`);
        } else if (lastSeasonNumber === seasonNumber - 1) {
          // Sequential registration - budget will be set by season-end process
          // This means they completed their 2-season contract
          console.log(`✅ Team ${teamName} continuing from Season ${lastSeasonNumber} (sequential)`);

          // Use last season's budget (should have been updated by season-end process)
          if (lastPlayedSeason.currency_system === 'dual') {
            footballBudget = lastPlayedSeason.football_budget || 10000;
            realPlayerBudget = lastPlayedSeason.real_player_budget || 5000;
          } else {
            startingBalance = lastPlayedSeason.budget || 15000;
          }
        }
      }
    }

    if (action === 'join') {
      // Calculate next season ID for 2-season contract
      const seasonPrefix = seasonId.replace(/\d+$/, '');
      const nextSeasonId = `${seasonPrefix}${seasonNumber + 1}`;
      const nextTeamSeasonId = `${teamDocId}_${nextSeasonId}`;

      // Generate unique contract ID
      const contractId = `contract_${teamDocId}_${seasonId}_${Date.now()}`;

      console.log(`📝 Creating 2-season team contract for ${teamName}: ${seasonId} & ${nextSeasonId}`);

      const batch = adminDb.batch();

      // Team must exist at this point (we returned error above if not)
      // Update team with BOTH seasons
      const existingTeamDoc = existingTeamQuery.docs[0];
      const existingData = existingTeamDoc.data();
      const updatedSeasons = existingData.seasons
        ? [...existingData.seasons, seasonId, nextSeasonId]
        : [seasonId, nextSeasonId];

      const teamRef = adminDb.collection('teams').doc(teamDocId);
      batch.update(teamRef, {
        seasons: updatedSeasons,
        current_season_id: seasonId,
        total_seasons_participated: updatedSeasons.length,
        logo_url: userData.logoUrl || null,
        teamLogo: userData.logoUrl || null, // Update both fields
        email: userData.email || existingData.email || '',
        updated_at: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(), // Update both fields
        // Phase 1: Add manager name if provided
        ...(managerName && { manager_name: managerName }),
        // Phase 1: Update fantasy participation if opted in
        ...(joinFantasy && {
          fantasy_participating: true,
          fantasy_joined_at: FieldValue.serverTimestamp()
        })
      });

      // NOTE: teamstats entries will be created when teams are assigned to tournaments
      // Don't create them here since we need tournament_id for the new ID format (teamid_tournamentid)

      // Recalculate teamSeasonId in case teamDocId was updated
      teamSeasonId = `${teamDocId}_${seasonId}`;

      // Create team_seasons record for joining (auction mechanics)
      const teamSeasonRef = adminDb.collection('team_seasons').doc(teamSeasonId);

      const teamSeasonData: any = {
        team_id: teamDocId, // Reference to the team document
        user_id: userId, // For backwards compatibility with dashboard checks
        season_id: seasonId,
        team_name: teamName,
        username: userData.username || '',
        owner_name: userData.username || '',
        team_email: userData.email,
        team_logo: userData.logoUrl || '',
        status: 'registered',

        // Contract fields
        contract_id: contractId,
        contract_start_season: seasonId,
        contract_end_season: nextSeasonId,
        contract_length: 2,
        is_auto_registered: false, // This is the initial registration

        // Penalty tracking (if team skipped seasons)
        skipped_seasons: skippedSeasons,
        penalty_amount: penaltyAmount,
        last_played_season: lastPlayedSeason ? lastPlayedSeason.season_id : null,

        players_count: 0,
        position_counts: {
          GK: 0,
          CB: 0,
          LB: 0,
          RB: 0,
          DMF: 0,
          CMF: 0,
          AMF: 0,
          LMF: 0,
          RMF: 0,
          LWF: 0,
          RWF: 0,
          SS: 0,
          CF: 0,
        },
        joined_at: FieldValue.serverTimestamp(),
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      };

      // Add budget fields based on season type
      if (isDualCurrency) {
        // Dual currency system for Season 16+
        teamSeasonData.football_budget = footballBudget;
        teamSeasonData.football_starting_balance = footballBudget;
        teamSeasonData.football_spent = 0;
        teamSeasonData.real_player_budget = realPlayerBudget;
        teamSeasonData.real_player_starting_balance = realPlayerBudget;
        teamSeasonData.real_player_spent = 0;
        teamSeasonData.currency_system = 'dual'; // Flag for easy identification
      } else {
        // Legacy single budget system
        teamSeasonData.budget = startingBalance;
        teamSeasonData.starting_balance = startingBalance;
        teamSeasonData.total_spent = 0;
        teamSeasonData.currency_system = 'single'; // Flag for easy identification
      }

      batch.set(teamSeasonRef, teamSeasonData);

      // Log initial balance transactions
      if (isDualCurrency) {
        // Log football budget
        await logInitialBalance(
          teamDocId,
          seasonId,
          footballBudget,
          'football'
        );
        // Log real player budget
        await logInitialBalance(
          teamDocId,
          seasonId,
          realPlayerBudget,
          'real_player'
        );
      } else {
        // Log single budget
        await logInitialBalance(
          teamDocId,
          seasonId,
          startingBalance,
          'football' // For legacy single currency system
        );
      }

      // Create team_seasons record for NEXT season (auto-registered)
      const nextTeamSeasonRef = adminDb.collection('team_seasons').doc(nextTeamSeasonId);

      const nextTeamSeasonData: any = {
        team_id: teamDocId,
        user_id: userId,
        season_id: nextSeasonId,
        team_name: teamName,
        username: userData.username || '',
        owner_name: userData.username || '',
        team_email: userData.email,
        team_logo: userData.logoUrl || '',
        status: 'registered',

        // Contract fields
        contract_id: contractId,
        contract_start_season: seasonId,
        contract_end_season: nextSeasonId,
        contract_length: 2,
        is_auto_registered: true, // This is auto-created from contract

        players_count: 0,
        position_counts: {
          GK: 0,
          CB: 0,
          LB: 0,
          RB: 0,
          DMF: 0,
          CMF: 0,
          AMF: 0,
          LMF: 0,
          RMF: 0,
          LWF: 0,
          RWF: 0,
          SS: 0,
          CF: 0,
        },
        joined_at: FieldValue.serverTimestamp(),
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      };

      // Budget for next season will be calculated at the end of current season
      // based on remaining balance + bonuses/penalties
      // DO NOT set budget here - it will be set when Season 16 ends
      const isNextSeasonDual = (seasonNumber + 1) >= 16;
      if (isNextSeasonDual) {
        nextTeamSeasonData.football_budget = 0; // Will be set later
        nextTeamSeasonData.football_starting_balance = 0;
        nextTeamSeasonData.football_spent = 0;
        nextTeamSeasonData.real_player_budget = 0; // Will be set later
        nextTeamSeasonData.real_player_starting_balance = 0;
        nextTeamSeasonData.real_player_spent = 0;
        nextTeamSeasonData.currency_system = 'dual';
        nextTeamSeasonData.budget_pending = true; // Flag to indicate budget needs to be calculated
      } else {
        nextTeamSeasonData.budget = 0; // Will be set later
        nextTeamSeasonData.starting_balance = 0;
        nextTeamSeasonData.total_spent = 0;
        nextTeamSeasonData.currency_system = 'single';
        nextTeamSeasonData.budget_pending = true;
      }

      batch.set(nextTeamSeasonRef, nextTeamSeasonData);

      console.log(`✅ Created team contract ${contractId} for ${teamName}: ${teamSeasonId} & ${nextTeamSeasonId}`);

      // Commit all operations
      await batch.commit();

      // Update season participant count (separate operation)
      await adminDb.collection('seasons').doc(seasonId).update({
        participant_count: FieldValue.increment(1),
        updated_at: FieldValue.serverTimestamp(),
      });

      // Create fantasy team if user opted in
      if (joinFantasy) {
        try {
          const fantasySql = getFantasyDb();

          // Determine league ID (format: SSPSLFLS + season number)
          const seasonNumber = seasonId.replace('SSPSLS', '');
          const leagueId = `SSPSLFLS${seasonNumber}`;

          console.log(`🎮 Creating fantasy team for ${teamName} in league ${leagueId}`);

          // Get league budget
          const leagueResult = await fantasySql`
            SELECT budget_per_team FROM fantasy_leagues 
            WHERE league_id = ${leagueId}
            LIMIT 1
          `;
          const budgetPerTeam = leagueResult[0]?.budget_per_team || 100.00;

          // Create fantasy team entry with proper fields
          await fantasySql`
            INSERT INTO fantasy_teams (
              team_id,
              league_id,
              real_team_id,
              real_team_name,
              team_name,
              owner_uid,
              owner_name,
              budget_remaining,
              total_points,
              rank,
              is_enabled,
              created_at,
              updated_at
            ) VALUES (
              ${teamDocId},
              ${leagueId},
              ${teamDocId},
              ${teamName},
              ${teamName},
              ${userId},
              ${userData.username || teamName},
              ${budgetPerTeam},
              0,
              999,
              true,
              NOW(),
              NOW()
            )
            ON CONFLICT (team_id) DO UPDATE SET
              is_enabled = true,
              budget_remaining = ${budgetPerTeam},
              updated_at = NOW()
          `;

          console.log(`✅ Fantasy team created: ${teamDocId}`);
        } catch (fantasyError) {
          console.error('Failed to create fantasy team:', fantasyError);
          // Don't fail the registration if fantasy team creation fails
        }
      }

      // Trigger news for team registration
      try {
        // Get updated participant count
        const updatedSeasonDoc = await adminDb.collection('seasons').doc(seasonId).get();
        const updatedSeasonData = updatedSeasonDoc.data();
        const totalTeams = updatedSeasonData?.participant_count || 1;

        // Check if team is returning (has played before)
        const teamDoc = await adminDb.collection('teams').doc(teamDocId).get();
        const teamData = teamDoc.data();
        const isReturning = teamData?.seasons && teamData.seasons.length > 2; // More than just current 2-season contract
        const teamLogo = userData.logoUrl || teamData?.team_logo || null;

        await triggerNews('team_registered', {
          season_id: seasonId,
          team_name: teamName,
          total_teams: totalTeams,
          is_returning: isReturning,
          team_logo: teamLogo,
        });
      } catch (newsError) {
        console.error('Failed to generate team registration news:', newsError);
      }

      // Send FCM notification to the registered team
      try {
        await sendNotification(
          {
            title: '✅ Registration Complete!',
            body: `Welcome to ${seasonData.name}! Your 2-season contract is active. Start building your team!`,
            url: `/dashboard/team`,
            icon: '/logo.png',
            data: {
              type: 'season_registration',
              season_id: seasonId,
              next_season_id: nextSeasonId,
              contract_id: contractId,
              currency_system: isDualCurrency ? 'dual' : 'single',
              football_budget: footballBudget.toString(),
              real_player_budget: realPlayerBudget.toString(),
            }
          },
          teamDocId
        );
      } catch (notifError) {
        console.error('Failed to send registration notification:', notifError);
        // Don't fail the request
      }

      return NextResponse.json({
        success: true,
        message: `Successfully joined ${seasonData.name}! (2-Season Contract)`,
        data: {
          season_id: seasonId,
          next_season_id: nextSeasonId,
          season_name: seasonData.name,
          contract_id: contractId,
          contract_seasons: [seasonId, nextSeasonId],
          currency_system: isDualCurrency ? 'dual' : 'single',
          ...(isDualCurrency ? {
            football_budget: footballBudget,
            real_player_budget: realPlayerBudget,
          } : {
            starting_balance: startingBalance,
          }),
          status: 'registered',
        },
      });
    } else if (action === 'decline') {
      // Create team_seasons record for declining
      const declineData: any = {
        team_id: userId,
        user_id: userId, // For backwards compatibility
        season_id: seasonId,
        team_name: userData.teamName || userData.username || 'Team',
        username: userData.username || '',
        owner_name: userData.username || '',
        team_email: userData.email,
        team_logo: userData.logoUrl || '',
        status: 'declined',
        players_count: 0,
        position_counts: {
          GK: 0,
          CB: 0,
          LB: 0,
          RB: 0,
          DMF: 0,
          CMF: 0,
          AMF: 0,
          LMF: 0,
          RMF: 0,
          LWF: 0,
          RWF: 0,
          SS: 0,
          CF: 0,
        },
        declined_at: FieldValue.serverTimestamp(),
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      };

      // Add zero budgets based on season type
      if (isDualCurrency) {
        declineData.football_budget = 0;
        declineData.football_starting_balance = 0;
        declineData.football_spent = 0;
        declineData.real_player_budget = 0;
        declineData.real_player_starting_balance = 0;
        declineData.real_player_spent = 0;
        declineData.currency_system = 'dual';
      } else {
        declineData.budget = 0;
        declineData.starting_balance = 0;
        declineData.total_spent = 0;
        declineData.currency_system = 'single';
      }

      await adminDb.collection('team_seasons').doc(teamSeasonId).set(declineData);

      return NextResponse.json({
        success: true,
        message: `You have declined ${seasonData.name}. You can join future seasons.`,
        data: {
          season_id: seasonId,
          season_name: seasonData.name,
          status: 'declined',
        },
      });
    }

  } catch (error) {
    console.error('Error processing season registration:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error - Failed to process registration',
    }, { status: 500 });
  }
}
