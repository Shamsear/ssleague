import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    // Get Firebase ID token from cookie
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - No token' },
        { status: 401 }
      );
    }

    // Verify Firebase ID token
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (err) {
      console.error('Token verification error:', err);
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Check if user is committee admin
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();
    
    if (!userData || userData.role !== 'committee_admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Committee admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      seasonId,
      startSeason,
      endSeason,
      players,
    } = body;

    // Validate required fields
    if (!seasonId || !startSeason || !endSeason || !players || !Array.isArray(players)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (players.length === 0) {
      return NextResponse.json(
        { error: 'No players to assign' },
        { status: 400 }
      );
    }

    // First, fetch team names for all unique team IDs
    const uniqueTeamIds = [...new Set(players.map(p => p.teamId))];
    const teamNames = new Map<string, string>();
    
    for (const teamId of uniqueTeamIds) {
      // Try to get team name from team_seasons document
      const teamSeasonDocId = `${teamId}_${startSeason}`;
      const teamSeasonDoc = await adminDb.collection('team_seasons').doc(teamSeasonDocId).get();
      
      if (teamSeasonDoc.exists) {
        const teamData = teamSeasonDoc.data();
        teamNames.set(teamId, teamData?.team_name || teamData?.username || 'Unknown Team');
      } else {
        teamNames.set(teamId, 'Unknown Team');
      }
    }

    // Process all players in batch - update both season documents for each player
    const batch = adminDb.batch();
    const updateResults: any[] = [];

    for (const player of players) {
      if (!player.id || !player.teamId || !player.playerName) {
        return NextResponse.json(
          { error: `Invalid player data: missing id, teamId, or playerName` },
          { status: 400 }
        );
      }

      // Get the existing realplayer document to extract player_id
      const existingPlayerDoc = await adminDb.collection('realplayer').doc(player.id).get();
      
      if (!existingPlayerDoc.exists) {
        console.warn(`Player document ${player.id} not found, skipping...`);
        continue;
      }

      const existingData = existingPlayerDoc.data();
      const playerId = existingData?.player_id || player.id;
      
      // Generate contract_id if it doesn't exist
      const contractId = existingData?.contract_id || `contract_${playerId}_${startSeason}_${Date.now()}`;

      // Document IDs for both seasons (format: playerId_seasonId)
      const currentSeasonDocId = `${playerId}_${startSeason}`;
      const nextSeasonDocId = `${playerId}_${endSeason}`;
      
      console.log(`Processing player: ${player.playerName}`);
      console.log(`  - player.id: ${player.id}`);
      console.log(`  - playerId: ${playerId}`);
      console.log(`  - currentSeasonDocId: ${currentSeasonDocId}`);
      console.log(`  - nextSeasonDocId: ${nextSeasonDocId}`);
      console.log(`  - startSeason: ${startSeason}, endSeason: ${endSeason}`);

      // Check if both season documents exist
      const [currentSeasonDoc, nextSeasonDoc] = await Promise.all([
        adminDb.collection('realplayer').doc(currentSeasonDocId).get(),
        adminDb.collection('realplayer').doc(nextSeasonDocId).get()
      ]);

      // Prepare update data
      const teamName = teamNames.get(player.teamId) || 'Unknown Team';
      const updateData = {
        team_id: player.teamId,
        team_name: teamName,
        auction_value: player.auctionValue,
        salary_per_match: player.salaryPerMatch,
        contract_start_season: startSeason,
        contract_end_season: endSeason,
        contract_id: contractId,
        contract_length: 2,
        updated_at: FieldValue.serverTimestamp(),
      };

      // Update CURRENT season document if it exists
      if (currentSeasonDoc.exists) {
        const currentSeasonRef = adminDb.collection('realplayer').doc(currentSeasonDocId);
        batch.update(currentSeasonRef, updateData);
      } else {
        console.warn(`Current season document ${currentSeasonDocId} not found`);
      }

      // Update or CREATE NEXT season document
      const nextSeasonRef = adminDb.collection('realplayer').doc(nextSeasonDocId);
      if (nextSeasonDoc.exists) {
        // Update existing next season document
        batch.update(nextSeasonRef, updateData);
      } else {
        // Create next season document if it doesn't exist
        const currentData = currentSeasonDoc.data();
        batch.set(nextSeasonRef, {
          ...updateData,
          season_id: endSeason,
          player_id: playerId,
          player_name: player.playerName,
          name: player.playerName,
          is_auto_registered: true,
          star_rating: currentData?.star_rating || existingData?.star_rating || 0,
          category_name: currentData?.category_name || existingData?.category_name || '',
          category_id: currentData?.category_id || existingData?.category_id || null,
          registration_date: FieldValue.serverTimestamp(),
          created_at: FieldValue.serverTimestamp(),
        });
        console.log(`Created next season document ${nextSeasonDocId}`);
      }

      updateResults.push({
        playerId: playerId,
        playerName: player.playerName,
        teamId: player.teamId,
        contractId: contractId,
        currentSeasonUpdated: currentSeasonDoc.exists,
        nextSeasonUpdated: nextSeasonDoc.exists,
      });
    }

    // Commit the batch
    await batch.commit();

    // Update team_seasons documents with player counts and spending
    // Group players by team
    const teamPlayerMap = new Map<string, { count: number; totalSpent: number }>();
    
    for (const player of players) {
      if (!teamPlayerMap.has(player.teamId)) {
        teamPlayerMap.set(player.teamId, { count: 0, totalSpent: 0 });
      }
      const teamData = teamPlayerMap.get(player.teamId)!;
      teamData.count++;
      teamData.totalSpent += player.auctionValue || 0;
    }

    // Update each team's team_seasons document for CURRENT season only
    // Next season team_seasons will be created at the end of current season
    for (const [teamId, data] of teamPlayerMap.entries()) {
      const currentSeasonDocId = `${teamId}_${startSeason}`;

      // Update current season team_seasons
      const currentTeamSeasonRef = adminDb.collection('team_seasons').doc(currentSeasonDocId);
      const currentTeamSeasonDoc = await currentTeamSeasonRef.get();
      
      if (currentTeamSeasonDoc.exists) {
        const currentTeamData = currentTeamSeasonDoc.data();
        await currentTeamSeasonRef.update({
          players_count: data.count,
          real_player_spent: data.totalSpent,
          real_player_budget: (currentTeamData?.real_player_starting_balance || 5000) - data.totalSpent,
          updated_at: FieldValue.serverTimestamp(),
        });
        console.log(`Updated team_seasons ${currentSeasonDocId}: ${data.count} players, $${data.totalSpent} spent`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully assigned ${players.length} players and updated team budgets`,
      results: updateResults,
    });
  } catch (error) {
    console.error('Error in bulk player assignment:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to assign players' },
      { status: 500 }
    );
  }
}
