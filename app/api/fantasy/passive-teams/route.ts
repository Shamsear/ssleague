import { NextRequest, NextResponse } from 'next/server'
import { fantasySql } from '@/lib/neon/fantasy-config'

/**
 * GET /api/fantasy/passive-teams?league_id=xxx
 * Get all passive teams (real football teams) that fantasy teams support in a league
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const leagueId = searchParams.get('league_id')

    if (!leagueId) {
      return NextResponse.json(
        { error: 'league_id is required' },
        { status: 400 }
      )
    }

    // Get all unique passive teams from fantasy_teams in this league
    const passiveTeams = await fantasySql`
      SELECT 
        supported_team_id as team_id,
        supported_team_name as team_name,
        COUNT(DISTINCT team_id) as fantasy_teams_count
      FROM fantasy_teams
      WHERE league_id = ${leagueId}
        AND supported_team_id IS NOT NULL
        AND supported_team_id != ''
        AND supported_team_name IS NOT NULL
        AND supported_team_name != ''
      GROUP BY supported_team_id, supported_team_name
      ORDER BY supported_team_name ASC
    `

    return NextResponse.json({
      success: true,
      teams: passiveTeams,
      total: passiveTeams.length
    })
  } catch (error: any) {
    console.error('Error fetching passive teams:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
