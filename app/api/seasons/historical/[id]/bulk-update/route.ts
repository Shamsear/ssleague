import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

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

    // Verify authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Check if user is super admin
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();
    
    if (!userData || userData.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Forbidden: Super admin access required' },
        { status: 403 }
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

        // Update teamstats if season_stats are provided
        if (team.season_stats && seasonId) {
          // Create a composite ID for teamstats: teamId_seasonId
          const teamStatsId = `${team.id}_${seasonId}`;
          const teamStatsRef = adminDb.collection('teamstats').doc(teamStatsId);
          
          const statsUpdateData: any = {
            team_id: team.id,
            season_id: seasonId,
            team_name: team.team_name,
            owner_name: team.owner_name,
            updated_at: new Date()
          };

          // Add all season stats fields - map from Excel column names to database field names
          if (team.season_stats.rank !== undefined) statsUpdateData.rank = team.season_stats.rank;
          if (team.season_stats.p !== undefined) statsUpdateData.points = team.season_stats.p;
          if (team.season_stats.mp !== undefined) statsUpdateData.matches_played = team.season_stats.mp;
          if (team.season_stats.w !== undefined) statsUpdateData.wins = team.season_stats.w;
          if (team.season_stats.d !== undefined) statsUpdateData.draws = team.season_stats.d;
          if (team.season_stats.l !== undefined) statsUpdateData.losses = team.season_stats.l;
          if (team.season_stats.f !== undefined) statsUpdateData.goals_for = team.season_stats.f;
          if (team.season_stats.a !== undefined) statsUpdateData.goals_against = team.season_stats.a;
          if (team.season_stats.gd !== undefined) statsUpdateData.goal_difference = team.season_stats.gd;
          if (team.season_stats.percentage !== undefined) statsUpdateData.win_percentage = team.season_stats.percentage;
          if (team.season_stats.cup !== undefined) statsUpdateData.cup_achievement = team.season_stats.cup;
          
          // Add players_count if available
          if (team.season_stats.players_count !== undefined) statsUpdateData.players_count = team.season_stats.players_count;

          // Use set with merge to create or update
          batch.set(teamStatsRef, statsUpdateData, { merge: true });
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
