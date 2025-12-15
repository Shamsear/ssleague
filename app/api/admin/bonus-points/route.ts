import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth-helper'
import { fantasySql } from '@/lib/neon/fantasy-config'

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(['committee_admin', 'super_admin'], request)
    if (!authResult.authenticated) {
      return NextResponse.json({ success: false, error: authResult.error || 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const leagueId = searchParams.get('league_id')
    const targetType = searchParams.get('target_type') // 'player' or 'team'

    // Build query based on filters
    // Note: For fantasy leagues, target_id is real_player_id for players and fantasy team_id for teams
    let bonusPoints
    
    // For player names, get from fantasy_squad
    // For team names (passive teams), get from fantasy_teams.supported_team_name
    if (leagueId && targetType) {
      bonusPoints = await fantasySql`
        SELECT 
          bp.*,
          CASE 
            WHEN bp.target_type = 'player' THEN fs.player_name
            WHEN bp.target_type = 'team' THEN ft.supported_team_name
          END as target_name
        FROM bonus_points bp
        LEFT JOIN fantasy_squad fs ON bp.target_type = 'player' AND bp.target_id = fs.real_player_id AND bp.league_id = fs.league_id
        LEFT JOIN fantasy_teams ft ON bp.target_type = 'team' AND bp.target_id = ft.supported_team_id AND bp.league_id = ft.league_id
        WHERE bp.league_id = ${leagueId}
          AND bp.target_type = ${targetType}
        ORDER BY bp.awarded_at DESC
      `
    } else if (leagueId) {
      bonusPoints = await fantasySql`
        SELECT 
          bp.*,
          CASE 
            WHEN bp.target_type = 'player' THEN fs.player_name
            WHEN bp.target_type = 'team' THEN ft.supported_team_name
          END as target_name
        FROM bonus_points bp
        LEFT JOIN fantasy_squad fs ON bp.target_type = 'player' AND bp.target_id = fs.real_player_id AND bp.league_id = fs.league_id
        LEFT JOIN fantasy_teams ft ON bp.target_type = 'team' AND bp.target_id = ft.supported_team_id AND bp.league_id = ft.league_id
        WHERE bp.league_id = ${leagueId}
        ORDER BY bp.awarded_at DESC
      `
    } else if (targetType) {
      bonusPoints = await fantasySql`
        SELECT 
          bp.*,
          CASE 
            WHEN bp.target_type = 'player' THEN fs.player_name
            WHEN bp.target_type = 'team' THEN ft.supported_team_name
          END as target_name
        FROM bonus_points bp
        LEFT JOIN fantasy_squad fs ON bp.target_type = 'player' AND bp.target_id = fs.real_player_id
        LEFT JOIN fantasy_teams ft ON bp.target_type = 'team' AND bp.target_id = ft.supported_team_id
        WHERE bp.target_type = ${targetType}
        ORDER BY bp.awarded_at DESC
      `
    } else {
      bonusPoints = await fantasySql`
        SELECT 
          bp.*,
          CASE 
            WHEN bp.target_type = 'player' THEN fs.player_name
            WHEN bp.target_type = 'team' THEN ft.supported_team_name
          END as target_name
        FROM bonus_points bp
        LEFT JOIN fantasy_squad fs ON bp.target_type = 'player' AND bp.target_id = fs.real_player_id
        LEFT JOIN fantasy_teams ft ON bp.target_type = 'team' AND bp.target_id = ft.supported_team_id
        ORDER BY bp.awarded_at DESC
      `
    }

    return NextResponse.json({
      success: true,
      data: bonusPoints
    })
  } catch (error: any) {
    console.error('Error fetching bonus points:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(['committee_admin', 'super_admin'], request)
    if (!authResult.authenticated) {
      return NextResponse.json({ success: false, error: authResult.error || 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { targets, points, reason, league_id, target_type } = body

    // Validation
    if (!targets || !Array.isArray(targets) || targets.length === 0) {
      return NextResponse.json({ success: false, error: 'Targets array is required' }, { status: 400 })
    }

    if (!points || typeof points !== 'number') {
      return NextResponse.json({ success: false, error: 'Points must be a number' }, { status: 400 })
    }

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Reason is required' }, { status: 400 })
    }

    if (!league_id) {
      return NextResponse.json({ success: false, error: 'League ID is required' }, { status: 400 })
    }

    if (!target_type || !['player', 'team'].includes(target_type)) {
      return NextResponse.json({ success: false, error: 'Invalid target type' }, { status: 400 })
    }

    // Insert bonus points for each target
    const insertedRecords = []
    for (const targetId of targets) {
      const result = await fantasySql`
        INSERT INTO bonus_points (
          target_type,
          target_id,
          points,
          reason,
          league_id,
          awarded_by
        ) VALUES (
          ${target_type},
          ${targetId},
          ${points},
          ${reason},
          ${league_id},
          ${authResult.userId}
        )
        RETURNING *
      `
      insertedRecords.push(result[0])
    }

    return NextResponse.json({
      success: true,
      message: `Bonus points awarded to ${targets.length} ${target_type}(s)`,
      data: insertedRecords
    })
  } catch (error: any) {
    console.error('Error awarding bonus points:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await verifyAuth(['committee_admin', 'super_admin'], request)
    if (!authResult.authenticated) {
      return NextResponse.json({ success: false, error: authResult.error || 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'Bonus point ID is required' }, { status: 400 })
    }

    await fantasySql`DELETE FROM bonus_points WHERE id = ${id}`

    return NextResponse.json({
      success: true,
      message: 'Bonus point record deleted'
    })
  } catch (error: any) {
    console.error('Error deleting bonus point:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
