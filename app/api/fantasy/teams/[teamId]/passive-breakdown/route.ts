import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * GET /api/fantasy/teams/[teamId]/passive-breakdown
 * Get passive points breakdown by round for a fantasy team
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;

    console.log('🔍 [Passive Breakdown] Request for teamId:', teamId);

    if (!teamId) {
      return NextResponse.json(
        { error: 'Missing team ID' },
        { status: 400 }
      );
    }

    // Get team info
    const teamInfo = await fantasySql`
      SELECT 
        team_id,
        team_name,
        owner_name,
        supported_team_id,
        supported_team_name,
        passive_points,
        league_id
      FROM fantasy_teams
      WHERE team_id = ${teamId}
      LIMIT 1
    `;

    if (teamInfo.length === 0) {
      console.log('❌ [Passive Breakdown] Team not found:', teamId);
      return NextResponse.json(
        { error: 'Fantasy team not found' },
        { status: 404 }
      );
    }

    const team = teamInfo[0];
    console.log('✅ [Passive Breakdown] Team found:', {
      team_id: team.team_id,
      team_name: team.team_name,
      supported_team_id: team.supported_team_id,
      supported_team_name: team.supported_team_name,
      passive_points: team.passive_points,
      league_id: team.league_id
    });

    // Get passive points breakdown by round
    const bonusBreakdown = await fantasySql`
      SELECT 
        fixture_id,
        round_number,
        real_team_id,
        real_team_name,
        bonus_breakdown,
        total_bonus,
        calculated_at
      FROM fantasy_team_bonus_points
      WHERE team_id = ${teamId}
      ORDER BY round_number DESC, calculated_at DESC
    `;

    // Get admin bonus points for this team
    console.log('🔍 [Passive Breakdown] Querying admin bonuses for:', {
      target_type: 'team',
      target_id: team.supported_team_id,
      league_id: team.league_id
    });

    const adminBonuses = await fantasySql`
      SELECT 
        id,
        points,
        reason,
        awarded_by,
        awarded_at
      FROM bonus_points
      WHERE target_type = 'team'
        AND target_id = ${team.supported_team_id}
        AND league_id = ${team.league_id}
      ORDER BY awarded_at DESC
    `;

    const totalAdminBonus = adminBonuses.reduce((sum: number, b: any) => sum + (b.points || 0), 0);
    
    console.log('📊 [Passive Breakdown] Admin bonuses found:', {
      count: adminBonuses.length,
      total: totalAdminBonus,
      bonuses: adminBonuses.map(b => ({ reason: b.reason, points: b.points }))
    });

    console.log('📊 [Passive Breakdown] Passive rounds found:', bonusBreakdown.length);
    console.log('📊 [Passive Breakdown] Summary:', {
      passive_points_from_db: team.passive_points,
      passive_rounds_total: bonusBreakdown.reduce((sum: number, b: any) => sum + (b.total_bonus || 0), 0),
      admin_bonus_total: totalAdminBonus,
      should_match: team.passive_points === (bonusBreakdown.reduce((sum: number, b: any) => sum + (b.total_bonus || 0), 0))
    });

    // Calculate statistics
    const stats = {
      total_rounds: bonusBreakdown.length,
      total_passive_points: team.passive_points || 0,
      total_admin_bonus: totalAdminBonus,
      average_per_round: bonusBreakdown.length > 0 
        ? (bonusBreakdown.reduce((sum: number, b: any) => sum + (b.total_bonus || 0), 0) / bonusBreakdown.length).toFixed(1)
        : '0.0',
      best_round: bonusBreakdown.length > 0
        ? Math.max(...bonusBreakdown.map((b: any) => b.total_bonus || 0))
        : 0,
      rounds_with_bonus: bonusBreakdown.filter((b: any) => b.total_bonus > 0).length,
    };

    return NextResponse.json({
      team: {
        team_id: team.team_id,
        team_name: team.team_name,
        owner_name: team.owner_name,
        supported_team_id: team.supported_team_id,
        supported_team_name: team.supported_team_name,
        passive_points: team.passive_points,
        league_id: team.league_id,
      },
      stats,
      admin_bonuses: adminBonuses.map((bonus: any) => ({
        id: bonus.id,
        points: bonus.points,
        reason: bonus.reason,
        awarded_at: bonus.awarded_at,
      })),
      rounds: bonusBreakdown.map((bonus: any) => {
        // Parse bonus_breakdown if it's a string
        let breakdown = bonus.bonus_breakdown;
        if (typeof breakdown === 'string') {
          try {
            breakdown = JSON.parse(breakdown);
          } catch (e) {
            breakdown = {};
          }
        }
        
        return {
          fixture_id: bonus.fixture_id,
          round_number: bonus.round_number,
          real_team_id: bonus.real_team_id,
          real_team_name: bonus.real_team_name,
          bonus_breakdown: breakdown || {},
          total_bonus: bonus.total_bonus,
          calculated_at: bonus.calculated_at,
        };
      }),
    });
  } catch (error) {
    console.error('Error fetching passive points breakdown:', error);
    return NextResponse.json(
      { error: 'Failed to fetch passive points breakdown', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
