import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { generateTeamId } from '@/lib/id-generator';

/**
 * Migration API to create missing team documents for teams that registered
 * but don't have a document in the teams collection
 */
export async function POST(request: NextRequest) {
  try {
    const { teamUserId, restore } = await request.json();

    // Special case: restore Classic Tens
    if (restore === 'classic-tens') {
      console.log(`🔄 Restoring Classic Tens team data...`);

      const classicTensData = {
        id: 'SSPSLT0001',
        team_name: 'Classic Tens',
        teamName: 'Classic Tens',
        owner_name: 'AKSHAY',
        userId: 'peqzXzrQDRTYLRtgbdWcOTE36c63',
        user_id: 'peqzXzrQDRTYLRtgbdWcOTE36c63',
        uid: 'peqzXzrQDRTYLRtgbdWcOTE36c63',
        userEmail: 'classictens@historical.team',
        email: 'classictens@historical.team',
        logoUrl: 'https://ik.imagekit.io/ssleague/team-logos/peqzXzrQDRTYLRtgbdWcOTE36c63_1762280148426_IMG_4225_0szUrWA065.jpeg',
        logo_url: 'https://ik.imagekit.io/ssleague/team-logos/peqzXzrQDRTYLRtgbdWcOTE36c63_1762280148426_IMG_4225_0szUrWA065.jpeg',
        teamLogo: 'https://ik.imagekit.io/ssleague/team-logos/peqzXzrQDRTYLRtgbdWcOTE36c63_1762280148426_IMG_4225_0szUrWA065.jpeg',
        current_season_id: 'SSPSLS15',
        seasons: ['SSPSLS15'],
        is_active: true,
        isActive: true,
        is_historical: true,
        hasUserAccount: true,
        name_history: [],
        previous_names: [],
        total_seasons_participated: 1,
        role: 'team',
        is_approved: true,
        isApproved: true,
        approvedAt: FieldValue.serverTimestamp(),
        approvedBy: 'system',
        committeeId: '',
        players: [],
        created_at: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        fantasy_participating: false,
        fantasy_joined_at: null,
        fantasy_league_id: null,
        fantasy_player_points: 0,
        fantasy_team_bonus_points: 0,
        fantasy_total_points: 0,
        manager_name: ''
      };

      await adminDb.collection('teams').doc('SSPSLT0001').set(classicTensData);
      
      return NextResponse.json({
        success: true,
        message: 'Successfully restored Classic Tens team data',
        data: {
          team_id: 'SSPSLT0001',
          team_name: 'Classic Tens',
          owner_name: 'AKSHAY',
        },
      });
    }

    if (!teamUserId) {
      return NextResponse.json({
        success: false,
        message: 'Team user ID is required',
      }, { status: 400 });
    }

    console.log(`🔄 Starting migration for team user ID: ${teamUserId}`);

    // Get user data
    const userDoc = await adminDb.collection('users').doc(teamUserId).get();
    if (!userDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'User not found',
      }, { status: 404 });
    }

    const userData = userDoc.data()!;
    const teamName = userData.teamName || userData.username || 'Team';

    // Check if team document already exists
    const existingTeamQuery = await adminDb.collection('teams')
      .where('team_name', '==', teamName)
      .limit(1)
      .get();

    if (!existingTeamQuery.empty) {
      return NextResponse.json({
        success: false,
        message: `Team document already exists for ${teamName}`,
      }, { status: 400 });
    }

    // Get team_seasons to find which seasons this team is registered for
    const teamSeasonsQuery = await adminDb.collection('team_seasons')
      .where('user_id', '==', teamUserId)
      .get();

    if (teamSeasonsQuery.empty) {
      return NextResponse.json({
        success: false,
        message: 'No team_seasons found for this user',
      }, { status: 404 });
    }

    // Collect season IDs
    const seasons: string[] = [];
    let currentSeasonId = '';
    teamSeasonsQuery.docs.forEach(doc => {
      const data = doc.data();
      if (data.season_id) {
        seasons.push(data.season_id);
        if (data.status === 'registered') {
          currentSeasonId = data.season_id;
        }
      }
    });

    // Use the first season as current if none marked as current
    if (!currentSeasonId && seasons.length > 0) {
      currentSeasonId = seasons[0];
    }

    // Create team document with all required fields
    const teamDocId = teamUserId; // Use userId as team document ID
    const teamDoc = {
      id: teamDocId,
      team_name: teamName,
      teamName: teamName,
      owner_name: userData.username || '',
      logo_url: userData.teamLogo || userData.logoUrl || null,
      teamLogo: userData.teamLogo || userData.logoUrl || null,
      
      // Login credentials (link to user account)
      username: userData.username || '',
      user_id: teamUserId,
      uid: teamUserId,
      role: 'team',
      
      // Email and contact info
      email: userData.email || '',
      
      // Season relationship
      seasons: seasons,
      current_season_id: currentSeasonId,
      
      // Team metadata
      is_active: true,
      isActive: true,
      is_historical: false,
      
      // Approval fields (auto-approved for registered teams)
      is_approved: true,
      isApproved: true,
      approvedAt: FieldValue.serverTimestamp(),
      approvedBy: 'migration', // Marked as migration-created
      
      // Committee association
      committeeId: '', // Empty for now
      
      // Players array (empty initially)
      players: [],
      
      // Timestamps
      created_at: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      
      // Total seasons participated
      total_seasons_participated: seasons.length,
      
      // Manager name (if available in user data)
      manager_name: userData.managerName || '',
      
      // Fantasy league participation (check from user or team_seasons)
      fantasy_participating: userData.fantasy_participating || false,
      fantasy_joined_at: userData.fantasy_participating ? FieldValue.serverTimestamp() : null,
      fantasy_league_id: null,
      fantasy_player_points: 0,
      fantasy_team_bonus_points: 0,
      fantasy_total_points: 0
    };

    // Create the team document
    await adminDb.collection('teams').doc(teamDocId).set(teamDoc);

    console.log(`✅ Created team document for ${teamName} (ID: ${teamDocId})`);

    return NextResponse.json({
      success: true,
      message: `Successfully created team document for ${teamName}`,
      data: {
        team_id: teamDocId,
        team_name: teamName,
        seasons: seasons,
        current_season_id: currentSeasonId,
      },
    });

  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error during migration',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * GET endpoint - Can check missing teams OR create a team if userId provided
 * Usage: 
 * - Check missing: http://localhost:3000/api/migrate/create-team-documents
 * - Create team: http://localhost:3000/api/migrate/create-team-documents?userId=IwxWQ51IN7WKpsSTjUg3bj2kdkp1
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // If userId provided, create the team document
    if (userId) {
      console.log(`🔄 Starting migration for team user ID: ${userId}`);

      // Get user data
      const userDoc = await adminDb.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        return NextResponse.json({
          success: false,
          message: 'User not found',
        }, { status: 404 });
      }

      const userData = userDoc.data()!;
      const teamName = userData.teamName || userData.username || 'Team';

      // Check if team document already exists
      const existingTeamQuery = await adminDb.collection('teams')
        .where('team_name', '==', teamName)
        .limit(1)
        .get();

      if (!existingTeamQuery.empty) {
        return NextResponse.json({
          success: false,
          message: `Team document already exists for ${teamName}`,
        }, { status: 400 });
      }

      // Try to get team_seasons to find which seasons this team is registered for (optional)
      const teamSeasonsQuery = await adminDb.collection('team_seasons')
        .where('user_id', '==', userId)
        .get();

      // Collect season IDs from team_seasons if they exist
      const seasons: string[] = [];
      let currentSeasonId = '';
      
      if (!teamSeasonsQuery.empty) {
        teamSeasonsQuery.docs.forEach(doc => {
          const data = doc.data();
          if (data.season_id) {
            seasons.push(data.season_id);
            if (data.status === 'registered') {
              currentSeasonId = data.season_id;
            }
          }
        });
      }

      // If no seasons found, use empty array (team exists but not registered for any season yet)
      if (!currentSeasonId && seasons.length > 0) {
        currentSeasonId = seasons[0];
      }

      // Get all existing team IDs from Firestore to find the next available ID
      const allTeamsSnapshot = await adminDb.collection('teams').get();
      const existingTeamIds = allTeamsSnapshot.docs
        .map(doc => doc.id)
        .filter(id => id.startsWith('SSPSLT'));
      
      // Extract numeric parts and find max
      let maxCounter = 0;
      existingTeamIds.forEach(id => {
        const numericPart = id.replace('SSPSLT', '');
        const counter = parseInt(numericPart, 10);
        if (!isNaN(counter) && counter > maxCounter) {
          maxCounter = counter;
        }
      });
      
      // Generate next team ID
      const teamDocId = `SSPSLT${String(maxCounter + 1).padStart(4, '0')}`;
      console.log(`📝 Generated team ID: ${teamDocId} for user: ${userId} (existing teams: ${existingTeamIds.length})`);
      
      // SAFETY CHECK: Verify this ID doesn't already exist
      const existingDoc = await adminDb.collection('teams').doc(teamDocId).get();
      if (existingDoc.exists) {
        return NextResponse.json({
          success: false,
          message: `Team document with ID ${teamDocId} already exists! Cannot overwrite.`,
          existing_team: existingDoc.data()?.team_name || existingDoc.data()?.teamName,
        }, { status: 400 });
      }
      
      // Also store the user ID mapping for reference
      const teamDoc = {
        id: teamDocId,
        team_name: teamName,
        teamName: teamName,
        owner_name: userData.username || '',
        logo_url: userData.teamLogo || userData.logoUrl || null,
        teamLogo: userData.teamLogo || userData.logoUrl || null,
        
        username: userData.username || '',
        user_id: userId,
        uid: userId,
        role: 'team',
        email: userData.email || '',
        
        seasons: seasons,
        current_season_id: currentSeasonId,
        
        is_active: true,
        isActive: true,
        is_historical: false,
        
        is_approved: true,
        isApproved: true,
        approvedAt: FieldValue.serverTimestamp(),
        approvedBy: 'migration',
        
        committeeId: '',
        players: [],
        
        created_at: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        
        total_seasons_participated: seasons.length,
        manager_name: userData.managerName || '',
        
        fantasy_participating: userData.fantasy_participating || false,
        fantasy_joined_at: userData.fantasy_participating ? FieldValue.serverTimestamp() : null,
        fantasy_league_id: null,
        fantasy_player_points: 0,
        fantasy_team_bonus_points: 0,
        fantasy_total_points: 0
      };

      await adminDb.collection('teams').doc(teamDocId).set(teamDoc);

      console.log(`✅ Created team document for ${teamName} (ID: ${teamDocId})`);

      return NextResponse.json({
        success: true,
        message: `Successfully created team document for ${teamName}`,
        data: {
          team_id: teamDocId,
          team_name: teamName,
          seasons: seasons,
          current_season_id: currentSeasonId,
        },
      });
    }

    // No userId provided - check for missing teams
    console.log('🔍 Checking for teams missing from teams collection...');

    const teamSeasonsQuery = await adminDb.collection('team_seasons')
      .where('status', '==', 'registered')
      .get();

    const missingTeams: Array<{
      userId: string;
      teamName: string;
      email: string;
      seasons: string[];
    }> = [];

    const teamsByUserId = new Map<string, {
      teamName: string;
      email: string;
      seasons: string[];
    }>();

    teamSeasonsQuery.docs.forEach(doc => {
      const data = doc.data();
      const userId = data.user_id || data.team_id;
      const teamName = data.team_name || 'Unknown';
      const email = data.team_email || '';
      const seasonId = data.season_id;

      if (teamsByUserId.has(userId)) {
        teamsByUserId.get(userId)!.seasons.push(seasonId);
      } else {
        teamsByUserId.set(userId, {
          teamName,
          email,
          seasons: [seasonId],
        });
      }
    });

    for (const [userId, teamData] of teamsByUserId) {
      // Check both user_id and uid fields, also check by document ID
      const teamQuery = await adminDb.collection('teams')
        .where('user_id', '==', userId)
        .limit(1)
        .get();
      
      const teamQueryByUid = await adminDb.collection('teams')
        .where('uid', '==', userId)
        .limit(1)
        .get();
      
      const teamDocById = await adminDb.collection('teams').doc(userId).get();

      if (teamQuery.empty && teamQueryByUid.empty && !teamDocById.exists) {
        missingTeams.push({
          userId,
          teamName: teamData.teamName,
          email: teamData.email,
          seasons: teamData.seasons,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Found ${missingTeams.length} teams missing from teams collection`,
      data: {
        missing_teams: missingTeams,
        total_missing: missingTeams.length,
        instructions: missingTeams.length > 0 
          ? `To create a team document, visit: http://localhost:3000/api/migrate/create-team-documents?userId=USER_ID`
          : 'All teams have documents in the teams collection',
      },
    });

  } catch (error) {
    console.error('Error in migration:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
