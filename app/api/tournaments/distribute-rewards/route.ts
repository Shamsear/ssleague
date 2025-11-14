import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function POST(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const body = await request.json();
    const { tournament_id, season_id } = body;

    if (!tournament_id || !season_id) {
      return NextResponse.json(
        { success: false, error: 'tournament_id and season_id are required' },
        { status: 400 }
      );
    }

    const log: string[] = [];
    log.push(`Starting rewards distribution for tournament ${tournament_id}`);

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

    // Get team standings for this tournament
    const standings = await sql`
      SELECT 
        ts.id,
        ts.team_id,
        t.team_name,
        ts.position,
        ts.points,
        ts.wins,
        ts.draws,
        ts.losses
      FROM teamstats ts
      JOIN teams t ON ts.team_id = t.id
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

    // 1. Distribute League Position Rewards
    if (rewards.league_positions && rewards.league_positions.length > 0) {
      log.push(`\n--- League Position Rewards ---`);
      
      for (const posReward of rewards.league_positions) {
        const team = standings.find((t: any) => t.position === posReward.position);
        
        if (team && (posReward.ecoin > 0 || posReward.sscoin > 0)) {
          // Update team budget
          await sql`
            UPDATE teams
            SET 
              football_budget = COALESCE(football_budget, 0) + ${posReward.ecoin || 0},
              real_budget = COALESCE(real_budget, 0) + ${posReward.sscoin || 0},
              updated_at = NOW()
            WHERE id = ${team.team_id}
          `;

          // Record transaction
          await sql`
            INSERT INTO transactions (
              team_id,
              season_id,
              transaction_type,
              amount_football,
              amount_real,
              description,
              created_at
            ) VALUES (
              ${team.team_id},
              ${season_id},
              'position_reward',
              ${posReward.ecoin || 0},
              ${posReward.sscoin || 0},
              ${'Position ' + posReward.position + ' Reward - ' + tournament.tournament_name},
              NOW()
            )
          `;

          log.push(`✓ Position ${posReward.position} (${team.team_name}): +${posReward.ecoin} eCoin, +${posReward.sscoin} SSCoin`);
        }
      }
    }

    // 2. Distribute Knockout Stage Rewards (if applicable)
    // Note: This would require knockout results to be stored separately
    // For now, we'll log that this needs to be implemented manually based on knockout results
    if (rewards.knockout_stages && Object.keys(rewards.knockout_stages).length > 0) {
      log.push(`\n--- Knockout Stage Rewards ---`);
      log.push(`⚠️ Knockout rewards require manual mapping of teams to knockout positions`);
      log.push(`Configure knockout results separately and then distribute these rewards`);
    }

    // 3. Distribute Tournament Completion Bonus (to ALL teams)
    if (rewards.completion_bonus && (rewards.completion_bonus.ecoin > 0 || rewards.completion_bonus.sscoin > 0)) {
      log.push(`\n--- Tournament Completion Bonus ---`);
      
      for (const team of standings) {
        // Update team budget
        await sql`
          UPDATE teams
          SET 
            football_budget = COALESCE(football_budget, 0) + ${rewards.completion_bonus.ecoin || 0},
            real_budget = COALESCE(real_budget, 0) + ${rewards.completion_bonus.sscoin || 0},
            updated_at = NOW()
          WHERE id = ${team.team_id}
        `;

        // Record transaction
        await sql`
          INSERT INTO transactions (
            team_id,
            season_id,
            transaction_type,
            amount_football,
            amount_real,
            description,
            created_at
          ) VALUES (
            ${team.team_id},
            ${season_id},
            'completion_bonus',
            ${rewards.completion_bonus.ecoin || 0},
            ${rewards.completion_bonus.sscoin || 0},
            ${'Tournament Completion Bonus - ' + tournament.tournament_name},
            NOW()
          )
        `;

        log.push(`✓ ${team.team_name}: +${rewards.completion_bonus.ecoin} eCoin, +${rewards.completion_bonus.sscoin} SSCoin`);
      }
    }

    log.push(`\n🎉 Rewards distribution completed successfully!`);

    return NextResponse.json({
      success: true,
      message: 'Rewards distributed successfully',
      log
    });

  } catch (error: any) {
    console.error('Error distributing rewards:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to distribute rewards' },
      { status: 500 }
    );
  }
}
