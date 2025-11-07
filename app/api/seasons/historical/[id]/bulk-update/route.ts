import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/auth-helper';
import { getTournamentDb } from '@/lib/neon/tournament-config';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Get season ID
    const params = await context.params;
    const seasonId = params.id;

    if (!seasonId) {
      return NextResponse.json(
        { error: 'Season ID is required' },
        { status: 400 }
      );
    }

    // Verify authentication (super admin only)
    const auth = await verifyAuth(['super_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: auth.error || 'Forbidden: Super admin access required' },
        { status: 401 }
      );
    }

    // Parse request body
    const { teams, players } = await request.json();

    if (!teams && !players) {
      return NextResponse.json(
        { error: 'No data provided to update' },
        { status: 400 }
      );
    }

    // Use Firestore batch for atomic updates
    const batch = adminDb.batch();
    let updateCount = 0;

    // Update teams and their stats
    if (teams && Array.isArray(teams)) {
      for (const team of teams) {
        if (!team.id) continue;
        
        // Update team basic info
        const teamRef = adminDb.collection('teams').doc(team.id);
        const teamUpdateData: any = {
          team_name: team.team_name,
          team_code: team.team_code,
          updated_at: new Date()
        };

        // Add optional fields if they exist
        if (team.owner_name !== undefined) teamUpdateData.owner_name = team.owner_name;
        if (team.owner_email !== undefined) teamUpdateData.owner_email = team.owner_email;
        if (team.initial_balance !== undefined) teamUpdateData.initial_balance = team.initial_balance;
        if (team.current_balance !== undefined) teamUpdateData.current_balance = team.current_balance;

        batch.update(teamRef, teamUpdateData);
        updateCount++;

        // Update teamstats in NEON if season_stats are provided
        if (team.season_stats && seasonId) {
          const sql = getTournamentDb();
          const teamStatsId = `${team.id}_${seasonId}`;
          
          // Extract stats fields
          const rank = team.season_stats.rank || 0;
          const points = team.season_stats.p || 0;
          const matchesPlayed = team.season_stats.mp || 0;
          const wins = team.season_stats.w || 0;
          const draws = team.season_stats.d || 0;
          const losses = team.season_stats.l || 0;
          const goalsFor = team.season_stats.f || 0;
          const goalsAgainst = team.season_stats.a || 0;
          const goalDifference = team.season_stats.gd || 0;
          
          // Update in NEON
          await sql`
            INSERT INTO teamstats (
              id, team_id, season_id, team_name,
              rank, points, matches_played, wins, draws, losses,
              goals_for, goals_against, goal_difference, position,
              created_at, updated_at
            )
            VALUES (
              ${teamStatsId}, ${team.id}, ${seasonId}, ${team.team_name},
              ${rank}, ${points}, ${matchesPlayed}, ${wins}, ${draws}, ${losses},
              ${goalsFor}, ${goalsAgainst}, ${goalDifference}, ${rank},
              NOW(), NOW()
            )
            ON CONFLICT (id) DO UPDATE
            SET
              team_name = EXCLUDED.team_name,
              rank = EXCLUDED.rank,
              points = EXCLUDED.points,
              matches_played = EXCLUDED.matches_played,
              wins = EXCLUDED.wins,
              draws = EXCLUDED.draws,
              losses = EXCLUDED.losses,
              goals_for = EXCLUDED.goals_for,
              goals_against = EXCLUDED.goals_against,
              goal_difference = EXCLUDED.goal_difference,
              position = EXCLUDED.position,
              updated_at = NOW()
          `;
          updateCount++;
        }
      }
    }

    // Update players
    if (players && Array.isArray(players)) {
      for (const player of players) {
        if (!player.id) continue;

        // First check if this is a realplayer or realplayerstats document
        const realPlayerRef = adminDb.collection('realplayers').doc(player.id);
        const realPlayerStatsRef = adminDb.collection('realplayerstats').doc(player.id);
        
        const realPlayerDoc = await realPlayerRef.get();
        const realPlayerStatsDoc = await realPlayerStatsRef.get();

        if (realPlayerDoc.exists) {
          // Update realplayers (permanent info)
          const updateData: any = {
            name: player.name,
            updated_at: new Date()
          };

          // Add optional permanent fields
          if (player.display_name !== undefined) updateData.display_name = player.display_name;
          if (player.email !== undefined) updateData.email = player.email;
          if (player.phone !== undefined) updateData.phone = player.phone;
          if (player.psn_id !== undefined) updateData.psn_id = player.psn_id;
          if (player.xbox_id !== undefined) updateData.xbox_id = player.xbox_id;
          if (player.steam_id !== undefined) updateData.steam_id = player.steam_id;

          batch.update(realPlayerRef, updateData);
          updateCount++;
        }

        if (realPlayerStatsDoc.exists) {
          // Update realplayerstats (season-specific info)
          const updateData: any = {
            updated_at: new Date()
          };

          // Add season-specific fields
          if (player.category !== undefined) updateData.category = player.category;
          if (player.team !== undefined) updateData.team = player.team;
          if (player.role !== undefined) updateData.role = player.role;
          if (player.notes !== undefined) updateData.notes = player.notes;

          // Update stats if provided
          if (player.stats) {
            updateData.stats = player.stats;
          }

          // Handle trophy arrays
          const categoryTrophies: string[] = [];
          const individualTrophies: string[] = [];

          // Add category trophies
          if (player.category_wise_trophy_1) categoryTrophies.push(player.category_wise_trophy_1);
          if (player.category_wise_trophy_2) categoryTrophies.push(player.category_wise_trophy_2);

          // Add individual trophies
          if (player.individual_wise_trophy_1) individualTrophies.push(player.individual_wise_trophy_1);
          if (player.individual_wise_trophy_2) individualTrophies.push(player.individual_wise_trophy_2);

          // Only update if we have trophies
          if (categoryTrophies.length > 0) {
            updateData.category_trophies = categoryTrophies;
          }
          if (individualTrophies.length > 0) {
            updateData.individual_trophies = individualTrophies;
          }

          batch.update(realPlayerStatsRef, updateData);
          updateCount++;
        }

        // If neither exists, it might be in a different collection
        // Check if it's in historicalplayers or similar
        if (!realPlayerDoc.exists && !realPlayerStatsDoc.exists) {
          // Try to update as a single document in a players collection
          const playerRef = adminDb.collection('players').doc(player.id);
          const playerDoc = await playerRef.get();
          
          if (playerDoc.exists) {
            const updateData: any = {
              name: player.name,
              category: player.category,
              team: player.team,
              updated_at: new Date()
            };

            if (player.stats) {
              updateData.stats = player.stats;
            }

            batch.update(playerRef, updateData);
            updateCount++;
          }
        }
      }
    }

    // Commit all updates
    await batch.commit();

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${updateCount} records`,
      updatedCount: updateCount
    });

  } catch (error: any) {
    console.error('Error in bulk update:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
