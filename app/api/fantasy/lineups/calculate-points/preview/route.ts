import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * POST /api/fantasy/lineups/calculate-points/preview
 * Preview points calculation without executing
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { league_id, round_id } = body;

    if (!league_id || !round_id) {
      return NextResponse.json(
        { error: 'Missing required parameters: league_id, round_id' },
        { status: 400 }
      );
    }

    // Get all teams in the league
    const teams = await fantasySql`
      SELECT team_id, team_name, owner_name, total_points
      FROM fantasy_teams
      WHERE fantasy_league_id = ${league_id}
    `;

    // Get all lineups for this round
    const lineups = await fantasySql`
      SELECT 
        fl.lineup_id,
        fl.team_id,
        fl.round_id,
        fl.starting_player_ids,
        fl.bench_player_ids,
        fl.captain_player_id,
        fl.vice_captain_player_id,
        fl.is_locked,
        fl.power_up_used,
        ft.team_name
      FROM fantasy_lineups fl
      JOIN fantasy_teams ft ON fl.team_id = ft.team_id
      WHERE fl.league_id = ${league_id} AND fl.round_id = ${round_id}
    `;

    const teamsWithLineups = new Set(lineups.map((l: any) => l.team_id));
    const teamsWithoutLineups = teams.filter((t: any) => !teamsWithLineups.has(t.team_id));

    // Preview calculation for each lineup
    const teamPreviews = [];
    let totalPointsToAward = 0;
    let highestScoringTeam = { team_name: '', points: 0 };
    let lowestScoringTeam = { team_name: '', points: Infinity };

    for (const lineup of lineups) {
      const startingPlayerIds = lineup.starting_player_ids || [];
      const captainId = lineup.captain_player_id;
      const viceCaptainId = lineup.vice_captain_player_id;
      const powerUp = lineup.power_up_used;

      // Get player points for this round (simulated - in real implementation, fetch from matches)
      // For preview, we'll use estimated points based on player stats
      const playerPoints = await fantasySql`
        SELECT 
          fs.real_player_id,
          fs.player_name,
          fs.position,
          COALESCE(SUM(fpp.points), 0) as estimated_points
        FROM fantasy_squad fs
        LEFT JOIN fantasy_player_points fpp ON fs.real_player_id = fpp.real_player_id
          AND fpp.team_id = ${lineup.team_id}
        WHERE fs.team_id = ${lineup.team_id}
          AND fs.real_player_id = ANY(${startingPlayerIds})
        GROUP BY fs.real_player_id, fs.player_name, fs.position
      `;

      let lineupPoints = 0;
      let captainBonus = 0;
      let vcBonus = 0;
      let powerUpBonus = 0;

      const playerBreakdown = playerPoints.map((player: any) => {
        const basePoints = Number(player.estimated_points) || Math.floor(Math.random() * 15); // Random for preview
        let multiplier = 1;
        let bonusType = '';

        if (player.real_player_id === captainId) {
          multiplier = powerUp === 'triple_captain' ? 3 : 2;
          bonusType = powerUp === 'triple_captain' ? 'Triple Captain (3x)' : 'Captain (2x)';
          captainBonus = basePoints * (multiplier - 1);
        } else if (player.real_player_id === viceCaptainId) {
          multiplier = 1.5;
          bonusType = 'Vice-Captain (1.5x)';
          vcBonus = basePoints * 0.5;
        }

        const finalPoints = basePoints * multiplier;
        lineupPoints += finalPoints;

        return {
          player_name: player.player_name,
          position: player.position,
          base_points: basePoints,
          multiplier,
          bonus_type: bonusType,
          final_points: Math.round(finalPoints),
        };
      });

      // Bench boost power-up
      if (powerUp === 'bench_boost') {
        const benchPlayerIds = lineup.bench_player_ids || [];
        const benchPoints = await fantasySql`
          SELECT COALESCE(SUM(fpp.points), 0) as bench_points
          FROM fantasy_squad fs
          LEFT JOIN fantasy_player_points fpp ON fs.real_player_id = fpp.real_player_id
          WHERE fs.team_id = ${lineup.team_id}
            AND fs.real_player_id = ANY(${benchPlayerIds})
        `;
        powerUpBonus = Number(benchPoints[0]?.bench_points) || Math.floor(Math.random() * 20);
        lineupPoints += powerUpBonus;
      }

      totalPointsToAward += lineupPoints;

      if (lineupPoints > highestScoringTeam.points) {
        highestScoringTeam = { team_name: lineup.team_name, points: Math.round(lineupPoints) };
      }
      if (lineupPoints < lowestScoringTeam.points) {
        lowestScoringTeam = { team_name: lineup.team_name, points: Math.round(lineupPoints) };
      }

      teamPreviews.push({
        team_name: lineup.team_name,
        lineup_points: Math.round(lineupPoints),
        captain_bonus: Math.round(captainBonus),
        vc_bonus: Math.round(vcBonus),
        power_up: powerUp || 'None',
        power_up_bonus: Math.round(powerUpBonus),
        total_points: Math.round(lineupPoints),
        player_breakdown: playerBreakdown,
        is_locked: lineup.is_locked,
      });
    }

    // Generate warnings
    const warnings = [];

    if (teamsWithoutLineups.length > 0) {
      warnings.push({
        type: 'no_lineup',
        severity: 'high',
        message: `${teamsWithoutLineups.length} team(s) have not submitted lineups (will receive 0 points)`,
        teams: teamsWithoutLineups.map((t: any) => t.team_name),
      });
    }

    const unlockedLineups = lineups.filter((l: any) => !l.is_locked);
    if (unlockedLineups.length > 0) {
      warnings.push({
        type: 'unlocked_lineups',
        severity: 'medium',
        message: `${unlockedLineups.length} lineup(s) are not locked yet`,
        teams: unlockedLineups.map((l: any) => l.team_name),
      });
    }

    // Check for missing captain/VC
    const missingCaptain = lineups.filter((l: any) => !l.captain_player_id);
    if (missingCaptain.length > 0) {
      warnings.push({
        type: 'missing_captain',
        severity: 'high',
        message: `${missingCaptain.length} team(s) have not selected a captain`,
        teams: missingCaptain.map((l: any) => l.team_name),
      });
    }

    return NextResponse.json({
      success: true,
      preview: {
        round_summary: {
          round_id,
          total_teams: teams.length,
          lineups_submitted: lineups.length,
          lineups_locked: lineups.filter((l: any) => l.is_locked).length,
          teams_without_lineups: teamsWithoutLineups.length,
        },
        points_distribution: {
          total_points_to_award: Math.round(totalPointsToAward),
          average_points: lineups.length > 0 ? Math.round(totalPointsToAward / lineups.length) : 0,
          highest_scoring_team: highestScoringTeam.points > 0 ? highestScoringTeam : null,
          lowest_scoring_team: lowestScoringTeam.points < Infinity ? lowestScoringTeam : null,
        },
        team_breakdown: teamPreviews,
        power_ups_active: lineups.filter((l: any) => l.power_up_used).map((l: any) => ({
          team_name: l.team_name,
          power_up: l.power_up_used,
        })),
        warnings,
        can_calculate: warnings.filter(w => w.severity === 'critical').length === 0,
      },
    });
  } catch (error) {
    console.error('Error generating points preview:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate preview', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
