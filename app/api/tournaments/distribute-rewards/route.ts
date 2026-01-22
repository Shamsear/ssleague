import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { getAuctionDb } from '@/lib/neon/auction-config';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const body = await request.json();
    const { tournament_id, season_id, reward_type, distributed_by } = body;

    if (!tournament_id || !season_id || !reward_type) {
      return NextResponse.json(
        { success: false, error: 'tournament_id, season_id, and reward_type are required' },
        { status: 400 }
      );
    }

    if (!['position', 'knockout', 'completion'].includes(reward_type)) {
      return NextResponse.json(
        { success: false, error: 'reward_type must be position, knockout, or completion' },
        { status: 400 }
      );
    }

    const log: string[] = [];
    log.push(`Starting ${reward_type} rewards distribution for tournament ${tournament_id}`);

    // Check if this reward type has already been distributed
    const existingRewards = await sql`
      SELECT COUNT(*) as count
      FROM tournament_rewards_distributed
      WHERE tournament_id = ${tournament_id}
        AND reward_type = ${reward_type}
    `;

    if (existingRewards[0]?.count > 0) {
      return NextResponse.json({
        success: false,
        error: `${reward_type.charAt(0).toUpperCase() + reward_type.slice(1)} rewards have already been distributed for this tournament`,
        log: [`❌ ${reward_type} rewards already distributed`]
      }, { status: 400 });
    }

    // Get tournament details with rewards configuration
    const [tournament] = await sql`
      SELECT * FROM tournaments WHERE id = ${tournament_id} LIMIT 1
    `;

    if (!tournament) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      );
    }

    if (!tournament.rewards) {
      return NextResponse.json(
        { success: false, error: 'No rewards configured for this tournament' },
        { status: 400 }
      );
    }

    const rewards = tournament.rewards;
    log.push(`Loaded tournament: ${tournament.tournament_name}`);

    // Get team standings for this tournament (from tournament DB)
    const standings = await sql`
      SELECT 
        ts.id,
        ts.team_id,
        ts.position,
        ts.points,
        ts.wins,
        ts.draws,
        ts.losses
      FROM teamstats ts
      WHERE ts.season_id = ${season_id}
        AND ts.tournament_id = ${tournament_id}
      ORDER BY ts.position ASC
    `;

    if (standings.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No team standings found for this tournament' },
        { status: 404 }
      );
    }

    log.push(`Found ${standings.length} teams in standings`);

    // Distribute based on reward type
    if (reward_type === 'position') {
      // Distribute League Position Rewards
      if (rewards.league_positions && rewards.league_positions.length > 0) {
        log.push(`\n--- League Position Rewards ---`);

        for (const posReward of rewards.league_positions) {
          const team = standings.find((t: any) => t.position === posReward.position);

          if (team && (posReward.ecoin > 0 || posReward.sscoin > 0)) {
            // Get team_season document from Firebase using Admin SDK
            const teamSeasonRef = adminDb.collection('team_seasons').doc(`${team.team_id}_${season_id}`);
            const teamSeasonDoc = await teamSeasonRef.get();

            if (!teamSeasonDoc.exists) {
              log.push(`⚠️ Team season not found for team ${team.team_id}`);
              continue;
            }

            const teamSeasonData = teamSeasonDoc.data();
            const teamName = teamSeasonData?.team_name || 'Unknown Team';

            // Update budgets in Firebase using Admin SDK
            await teamSeasonRef.update({
              football_budget: FieldValue.increment(posReward.ecoin || 0),
              real_player_budget: FieldValue.increment(posReward.sscoin || 0),
              updated_at: FieldValue.serverTimestamp()
            });

            // Also update auction DB teams table with football_budget
            if (posReward.ecoin > 0) {
              const auctionSql = getAuctionDb();
              await auctionSql`
                UPDATE teams
                SET football_budget = COALESCE(football_budget, 0) + ${posReward.ecoin},
                    updated_at = NOW()
                WHERE id = ${team.team_id}
                  AND season_id = ${season_id}
              `;
            }

            // Record transaction in Firebase using Admin SDK
            await adminDb.collection('transactions').add({
              team_id: team.team_id,
              season_id: season_id,
              transaction_type: 'position_reward',
              amount_football: posReward.ecoin || 0,
              amount_real: posReward.sscoin || 0,
              description: `Position ${posReward.position} Reward - ${tournament.tournament_name}`,
              created_at: FieldValue.serverTimestamp()
            });

            // Record in tracking table (tournament DB)
            await sql`
              INSERT INTO tournament_rewards_distributed (
                tournament_id,
                team_id,
                season_id,
                reward_type,
                reward_details,
                ecoin_amount,
                sscoin_amount,
                distributed_by,
                distributed_at
              ) VALUES (
                ${tournament_id},
                ${team.team_id},
                ${season_id},
                'position',
                ${JSON.stringify({ position: posReward.position })},
                ${posReward.ecoin || 0},
                ${posReward.sscoin || 0},
                ${distributed_by || 'system'},
                NOW()
              )
            `;

            log.push(`✓ Position ${posReward.position} (${teamName}): +${posReward.ecoin} eCoin, +${posReward.sscoin} SSCoin`);
          }
        }
      } else {
        log.push(`⚠️ No position rewards configured`);
      }
    } else if (reward_type === 'knockout') {
      // Distribute Knockout Stage Rewards
      if (rewards.knockout_stages && Object.keys(rewards.knockout_stages).length > 0) {
        log.push(`\n--- Knockout Stage Rewards ---`);
        log.push(`⚠️ Knockout rewards require manual mapping of teams to knockout positions`);
        log.push(`This feature needs knockout results to be stored separately`);
        log.push(`Please configure knockout results first, then distribute these rewards`);

        return NextResponse.json({
          success: false,
          error: 'Knockout rewards distribution requires knockout results to be configured first',
          log
        }, { status: 400 });
      } else {
        log.push(`⚠️ No knockout rewards configured`);
      }
    } else if (reward_type === 'completion') {
      // Distribute Tournament Completion Bonus (to ALL teams)
      if (rewards.completion_bonus && (rewards.completion_bonus.ecoin > 0 || rewards.completion_bonus.sscoin > 0)) {
        log.push(`\n--- Tournament Completion Bonus ---`);

        for (const team of standings) {
          // Get team_season document from Firebase using Admin SDK
          const teamSeasonRef = adminDb.collection('team_seasons').doc(`${team.team_id}_${season_id}`);
          const teamSeasonDoc = await teamSeasonRef.get();

          if (!teamSeasonDoc.exists) {
            log.push(`⚠️ Team season not found for team ${team.team_id}`);
            continue;
          }

          const teamSeasonData = teamSeasonDoc.data();
          const teamName = teamSeasonData?.team_name || 'Unknown Team';

          // Update budgets in Firebase using Admin SDK
          await teamSeasonRef.update({
            football_budget: FieldValue.increment(rewards.completion_bonus.ecoin || 0),
            real_player_budget: FieldValue.increment(rewards.completion_bonus.sscoin || 0),
            updated_at: FieldValue.serverTimestamp()
          });

          // Also update auction DB teams table with football_budget
          if (rewards.completion_bonus.ecoin > 0) {
            const auctionSql = getAuctionDb();
            await auctionSql`
              UPDATE teams
              SET football_budget = COALESCE(football_budget, 0) + ${rewards.completion_bonus.ecoin},
                  updated_at = NOW()
              WHERE id = ${team.team_id}
                AND season_id = ${season_id}
            `;
          }

          // Record transaction in Firebase using Admin SDK
          await adminDb.collection('transactions').add({
            team_id: team.team_id,
            season_id: season_id,
            transaction_type: 'completion_bonus',
            amount_football: rewards.completion_bonus.ecoin || 0,
            amount_real: rewards.completion_bonus.sscoin || 0,
            description: `Tournament Completion Bonus - ${tournament.tournament_name}`,
            created_at: FieldValue.serverTimestamp()
          });

          // Record in tracking table (tournament DB)
          await sql`
            INSERT INTO tournament_rewards_distributed (
              tournament_id,
              team_id,
              season_id,
              reward_type,
              reward_details,
              ecoin_amount,
              sscoin_amount,
              distributed_by,
              distributed_at
            ) VALUES (
              ${tournament_id},
              ${team.team_id},
              ${season_id},
              'completion',
              ${JSON.stringify({ bonus: true })},
              ${rewards.completion_bonus.ecoin || 0},
              ${rewards.completion_bonus.sscoin || 0},
              ${distributed_by || 'system'},
              NOW()
            )
          `;

          log.push(`✓ ${teamName}: +${rewards.completion_bonus.ecoin} eCoin, +${rewards.completion_bonus.sscoin} SSCoin`);
        }
      } else {
        log.push(`⚠️ No completion bonus configured`);
      }
    }

    log.push(`\n🎉 ${reward_type.charAt(0).toUpperCase() + reward_type.slice(1)} rewards distribution completed successfully!`);

    // Generate WhatsApp messages
    const whatsappMessages = {
      summary: '',
      individual: [] as string[]
    };

    // Get all distributed rewards with updated balances
    const distributedRewards = await sql`
      SELECT 
        trd.team_id,
        trd.ecoin_amount,
        trd.sscoin_amount,
        trd.reward_details
      FROM tournament_rewards_distributed trd
      WHERE trd.tournament_id = ${tournament_id}
        AND trd.reward_type = ${reward_type}
      ORDER BY trd.team_id
    `;

    // Fetch updated balances for all teams
    const teamBalances = await Promise.all(
      distributedRewards.map(async (reward: any) => {
        const teamSeasonRef = adminDb.collection('team_seasons').doc(`${reward.team_id}_${season_id}`);
        const teamSeasonDoc = await teamSeasonRef.get();

        if (teamSeasonDoc.exists) {
          const data = teamSeasonDoc.data();
          return {
            team_id: reward.team_id,
            team_name: data?.team_name || 'Unknown Team',
            old_ecoin: (data?.football_budget || 0) - reward.ecoin_amount,
            new_ecoin: data?.football_budget || 0,
            old_sscoin: (data?.real_player_budget || 0) - reward.sscoin_amount,
            new_sscoin: data?.real_player_budget || 0,
            ecoin_reward: reward.ecoin_amount,
            sscoin_reward: reward.sscoin_amount,
            reward_details: reward.reward_details
          };
        }
        return null;
      })
    );

    const validBalances = teamBalances.filter(b => b !== null);

    // Generate summary message
    const rewardTypeLabel = reward_type === 'position' ? 'Position Rewards' :
      reward_type === 'knockout' ? 'Knockout Rewards' :
        'Completion Bonus';

    whatsappMessages.summary = `🏆 *${tournament.tournament_name}*\n📊 *${rewardTypeLabel} Distributed*\n\n`;

    validBalances.forEach((team: any) => {
      const positionInfo = team.reward_details?.position ? ` (Position ${team.reward_details.position})` : '';
      whatsappMessages.summary += `✅ *${team.team_name}*${positionInfo}\n`;
      if (team.ecoin_reward > 0) {
        whatsappMessages.summary += `   💰 ECoin: ${team.old_ecoin.toLocaleString()} → ${team.new_ecoin.toLocaleString()} (+${team.ecoin_reward.toLocaleString()})\n`;
      }
      if (team.sscoin_reward > 0) {
        whatsappMessages.summary += `   💵 SSCoin: ${team.old_sscoin.toLocaleString()} → ${team.new_sscoin.toLocaleString()} (+${team.sscoin_reward.toLocaleString()})\n`;
      }
      whatsappMessages.summary += `\n`;
    });

    whatsappMessages.summary += `📅 Distributed: ${new Date().toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    })}`;

    // Generate individual team messages
    validBalances.forEach((team: any) => {
      const positionInfo = team.reward_details?.position ? ` - Position ${team.reward_details.position}` : '';
      let message = `🏆 *${tournament.tournament_name}*\n`;
      message += `👥 *${team.team_name}*\n`;
      message += `🎁 *${rewardTypeLabel}${positionInfo}*\n\n`;

      message += `💰 *Your Rewards:*\n`;
      if (team.ecoin_reward > 0) {
        message += `   ECoin: +${team.ecoin_reward.toLocaleString()}\n`;
      }
      if (team.sscoin_reward > 0) {
        message += `   SSCoin: +${team.sscoin_reward.toLocaleString()}\n`;
      }

      message += `\n📊 *Updated Balance:*\n`;
      if (team.ecoin_reward > 0) {
        message += `   💰 ECoin: ${team.old_ecoin.toLocaleString()} → *${team.new_ecoin.toLocaleString()}*\n`;
      }
      if (team.sscoin_reward > 0) {
        message += `   💵 SSCoin: ${team.old_sscoin.toLocaleString()} → *${team.new_sscoin.toLocaleString()}*\n`;
      }

      message += `\n✅ Rewards have been added to your account!`;

      whatsappMessages.individual.push(message);
    });

    return NextResponse.json({
      success: true,
      message: `${reward_type} rewards distributed successfully`,
      log,
      whatsapp_messages: whatsappMessages
    });

  } catch (error: any) {
    console.error('Error distributing rewards:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to distribute rewards' },
      { status: 500 }
    );
  }
}
