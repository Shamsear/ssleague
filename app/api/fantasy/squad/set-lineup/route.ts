import { NextRequest, NextResponse } from 'next/server'
import { fantasySql } from '@/lib/neon/fantasy-config'

/**
 * POST /api/fantasy/squad/set-lineup
 * Set starting lineup (5 players), captain, and vice-captain
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, starting_player_ids, captain_player_id, vice_captain_player_id } = body

    if (!user_id) {
      return NextResponse.json(
        { error: 'Missing required parameter: user_id' },
        { status: 400 }
      )
    }

    if (!starting_player_ids || !Array.isArray(starting_player_ids)) {
      return NextResponse.json(
        { error: 'starting_player_ids must be an array' },
        { status: 400 }
      )
    }

    if (starting_player_ids.length !== 5) {
      return NextResponse.json(
        { error: 'You must select exactly 5 starting players' },
        { status: 400 }
      )
    }

    // Get user's fantasy team
    const fantasyTeams = await fantasySql`
      SELECT team_id, league_id FROM fantasy_teams
      WHERE owner_uid = ${user_id} AND is_enabled = true
      LIMIT 1
    `

    if (fantasyTeams.length === 0) {
      return NextResponse.json(
        { error: 'No fantasy team found for this user' },
        { status: 404 }
      )
    }

    const team_id = fantasyTeams[0].team_id

    // Validate that all starting players are in the squad
    const squadPlayers = await fantasySql`
      SELECT real_player_id FROM fantasy_squad
      WHERE team_id = ${team_id}
    `

    const squadPlayerIds = squadPlayers.map(p => p.real_player_id)
    
    for (const playerId of starting_player_ids) {
      if (!squadPlayerIds.includes(playerId)) {
        return NextResponse.json(
          { error: `Player ${playerId} is not in your squad` },
          { status: 400 }
        )
      }
    }

    // Validate captain is in starting lineup
    if (captain_player_id && !starting_player_ids.includes(captain_player_id)) {
      return NextResponse.json(
        { error: 'Captain must be in the starting lineup' },
        { status: 400 }
      )
    }

    // Validate vice-captain is in starting lineup
    if (vice_captain_player_id && !starting_player_ids.includes(vice_captain_player_id)) {
      return NextResponse.json(
        { error: 'Vice-captain must be in the starting lineup' },
        { status: 400 }
      )
    }

    // Validate captain and vice-captain are different
    if (captain_player_id && vice_captain_player_id && captain_player_id === vice_captain_player_id) {
      return NextResponse.json(
        { error: 'Captain and vice-captain must be different players' },
        { status: 400 }
      )
    }

    // Set all players as non-starting first
    await fantasySql`
      UPDATE fantasy_squad
      SET is_starting = false, is_captain = false, is_vice_captain = false
      WHERE team_id = ${team_id}
    `

    // Set starting players
    for (const playerId of starting_player_ids) {
      await fantasySql`
        UPDATE fantasy_squad
        SET is_starting = true
        WHERE team_id = ${team_id} AND real_player_id = ${playerId}
      `
    }

    // Set captain
    if (captain_player_id) {
      await fantasySql`
        UPDATE fantasy_squad
        SET is_captain = true
        WHERE team_id = ${team_id} AND real_player_id = ${captain_player_id}
      `
    }

    // Set vice-captain
    if (vice_captain_player_id) {
      await fantasySql`
        UPDATE fantasy_squad
        SET is_vice_captain = true
        WHERE team_id = ${team_id} AND real_player_id = ${vice_captain_player_id}
      `
    }

    console.log(`✅ Lineup set for team ${team_id}: ${starting_player_ids.length} starters`)

    return NextResponse.json({
      success: true,
      message: 'Lineup updated successfully',
      starting_count: starting_player_ids.length,
      captain_player_id,
      vice_captain_player_id
    })
  } catch (error) {
    console.error('Error setting lineup:', error)
    return NextResponse.json(
      { error: 'Failed to set lineup', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
