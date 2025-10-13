import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> }
) {
  try {
    // Get userId from request body (sent by client after authentication)
    const body = await request.json();
    const { action, userId } = body;

    if (!userId) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized - No user ID provided',
      }, { status: 401 });
    }

    const { seasonId } = await params;

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

    // Check if team has already made a decision for this season
    const teamSeasonId = `${userId}_${seasonId}`;
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

    const startingBalance = seasonData.starting_balance || 15000;

    if (action === 'join') {
      const batch = adminDb.batch();
      
      // First, check if team already exists in teams collection
      const teamName = userData.teamName || userData.username || 'Team';
      const existingTeamQuery = await adminDb.collection('teams')
        .where('team_name', '==', teamName)
        .limit(1)
        .get();
      
      let teamDocId: string;
      
      if (!existingTeamQuery.empty) {
        // Team exists, update it with new season
        const existingTeamDoc = existingTeamQuery.docs[0];
        teamDocId = existingTeamDoc.id;
        const existingData = existingTeamDoc.data();
        const updatedSeasons = existingData.seasons ? [...existingData.seasons, seasonId] : [seasonId];
        
        const teamRef = adminDb.collection('teams').doc(teamDocId);
        batch.update(teamRef, {
          seasons: updatedSeasons,
          current_season_id: seasonId,
          total_seasons_participated: updatedSeasons.length,
          [`performance_history.${seasonId}`]: {
            season_name: seasonData.name || 'Active Season',
            players_count: 0,
            season_stats: {
              total_goals: 0,
              total_points: 0,
              matches_played: 0
            }
          },
          updated_at: FieldValue.serverTimestamp()
        });
      } else {
        // Team doesn't exist, create new team
        teamDocId = userId; // Use userId as team document ID for active teams
        
        const teamDoc = {
          id: teamDocId,
          team_name: teamName,
          owner_name: userData.username || '',
          
          // Login credentials (link to user account)
          username: userData.username || '',
          user_id: userId,
          role: 'team',
          
          // Season relationship
          seasons: [seasonId],
          current_season_id: seasonId,
          
          // Team metadata
          is_active: true,
          is_historical: false,
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
          
          // Performance tracking
          total_seasons_participated: 1,
          performance_history: {
            [seasonId]: {
              season_name: seasonData.name || 'Active Season',
              players_count: 0,
              season_stats: {
                total_goals: 0,
                total_points: 0,
                matches_played: 0
              }
            }
          }
        };
        
        const teamRef = adminDb.collection('teams').doc(teamDocId);
        batch.set(teamRef, teamDoc);
      }
      
      // Create team_seasons record for joining (auction mechanics)
      const teamSeasonRef = adminDb.collection('team_seasons').doc(teamSeasonId);
      batch.set(teamSeasonRef, {
        team_id: teamDocId, // Reference to the team document
        season_id: seasonId,
        team_name: teamName,
        username: userData.username || '',
        owner_name: userData.username || '',
        team_email: userData.email,
        team_logo: userData.teamLogo || '',
        status: 'registered',
        budget: startingBalance,
        starting_balance: startingBalance,
        total_spent: 0,
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
      });
      
      // Commit both operations
      await batch.commit();

      // Update season participant count (separate operation)
      await adminDb.collection('seasons').doc(seasonId).update({
        participant_count: FieldValue.increment(1),
        updated_at: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        success: true,
        message: `Successfully joined ${seasonData.name}!`,
        data: {
          season_id: seasonId,
          season_name: seasonData.name,
          starting_balance: startingBalance,
          status: 'registered',
        },
      });
    } else if (action === 'decline') {
      // Create team_seasons record for declining
      await adminDb.collection('team_seasons').doc(teamSeasonId).set({
        team_id: userId,
        season_id: seasonId,
        team_name: userData.teamName || userData.username || 'Team',
        username: userData.username || '',
        owner_name: userData.username || '',
        team_email: userData.email,
        team_logo: userData.teamLogo || '',
        status: 'declined',
        budget: 0,
        starting_balance: 0,
        total_spent: 0,
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
      });

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
