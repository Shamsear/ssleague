import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const teamName = searchParams.get('teamName');

    if (!teamId && !teamName) {
      return NextResponse.json(
        { success: false, error: 'Either teamId or teamName is required' },
        { status: 400 }
      );
    }

    let teamData = null;

    if (teamId) {
      // Get team by ID
      const teamsRef = collection(db, 'teams');
      const q = query(teamsRef, where('id', '==', teamId));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        teamData = querySnapshot.docs[0].data();
      }
    } else if (teamName) {
      // Get team by name
      const teamsRef = collection(db, 'teams');
      const q = query(teamsRef, where('team_name', '==', teamName));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        teamData = querySnapshot.docs[0].data();
      }
    }

    if (!teamData) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      );
    }

    // Get players for this team across all seasons
    const playersRef = collection(db, 'real_players');
    const playersQuery = query(playersRef, where('team_name', '==', teamData.team_name));
    const playersSnapshot = await getDocs(playersQuery);

    const playersBySeasons = new Map();
    const playersList = [];

    playersSnapshot.docs.forEach(playerDoc => {
      const playerData = playerDoc.data();
      playersList.push(playerData);
      
      // Group players by seasons
      const seasonId = playerData.season_id;
      if (!playersBySeasons.has(seasonId)) {
        playersBySeasons.set(seasonId, []);
      }
      playersBySeasons.get(seasonId).push(playerData);
    });

    // Get season names for each season the team participated in
    const seasonDetails = {};
    for (const seasonId of teamData.seasons || []) {
      try {
        const seasonDoc = await getDoc(doc(db, 'seasons', seasonId));
        if (seasonDoc.exists()) {
          seasonDetails[seasonId] = {
            name: seasonDoc.data().name,
            short_name: seasonDoc.data().short_name,
            status: seasonDoc.data().status,
            created_at: seasonDoc.data().created_at?.toDate?.() || null
          };
        }
      } catch (error) {
        console.warn(`Failed to get season details for ${seasonId}:`, error);
        seasonDetails[seasonId] = { name: 'Unknown Season', short_name: 'Unknown' };
      }
    }

    // Calculate aggregated statistics across all seasons
    const aggregatedStats = {
      total_players: playersList.length,
      total_goals: 0,
      total_points: 0,
      total_matches: 0,
      total_wins: 0,
      total_draws: 0,
      total_losses: 0,
      total_cleansheets: 0,
      seasons_participated: teamData.total_seasons_participated || teamData.seasons?.length || 0
    };

    playersList.forEach(player => {
      aggregatedStats.total_goals += player.career_stats?.total_goals_scored || 0;
      aggregatedStats.total_points += player.career_stats?.total_points || 0;
      aggregatedStats.total_matches = Math.max(aggregatedStats.total_matches, player.career_stats?.total_matches || 0);
      aggregatedStats.total_wins += player.career_stats?.total_wins || 0;
      aggregatedStats.total_draws += player.career_stats?.total_draws || 0;
      aggregatedStats.total_losses += player.career_stats?.total_losses || 0;
      aggregatedStats.total_cleansheets += player.career_stats?.total_cleansheets || 0;
    });

    return NextResponse.json({
      success: true,
      team: {
        id: teamData.id,
        team_name: teamData.team_name,
        owner_name: teamData.owner_name,
        username: teamData.username,
        is_active: teamData.is_active,
        created_at: teamData.created_at?.toDate?.() || null
      },
      performance: {
        aggregated_stats: aggregatedStats,
        performance_history: teamData.performance_history || {},
        season_details: seasonDetails,
        players_by_season: Object.fromEntries(playersBySeasons),
        all_players: playersList
      }
    });

  } catch (error: any) {
    console.error('Error fetching team performance:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch team performance data' },
      { status: 500 }
    );
  }
}

// POST endpoint to get performance data for multiple teams
export async function POST(request: NextRequest) {
  try {
    const { teamIds, teamNames, seasonId } = await request.json();

    if ((!teamIds || teamIds.length === 0) && (!teamNames || teamNames.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'Either teamIds or teamNames array is required' },
        { status: 400 }
      );
    }

    const teamsRef = collection(db, 'teams');
    let q;

    if (teamIds && teamIds.length > 0) {
      q = query(teamsRef, where('id', 'in', teamIds));
    } else {
      q = query(teamsRef, where('team_name', 'in', teamNames));
    }

    const querySnapshot = await getDocs(q);
    const teamsPerformance = [];

    for (const teamDoc of querySnapshot.docs) {
      const teamData = teamDoc.data();
      
      // Get players for this specific team and season (if specified)
      const playersRef = collection(db, 'real_players');
      let playersQuery;
      
      if (seasonId) {
        playersQuery = query(
          playersRef, 
          where('team_name', '==', teamData.team_name),
          where('season_id', '==', seasonId)
        );
      } else {
        playersQuery = query(playersRef, where('team_name', '==', teamData.team_name));
      }
      
      const playersSnapshot = await getDocs(playersQuery);
      const players = playersSnapshot.docs.map(doc => doc.data());

      teamsPerformance.push({
        team: {
          id: teamData.id,
          team_name: teamData.team_name,
          owner_name: teamData.owner_name,
          username: teamData.username
        },
        players_count: players.length,
        players: players,
        performance_history: seasonId ? 
          { [seasonId]: teamData.performance_history?.[seasonId] || null } : 
          teamData.performance_history || {}
      });
    }

    return NextResponse.json({
      success: true,
      teams_performance: teamsPerformance
    });

  } catch (error: any) {
    console.error('Error fetching multiple teams performance:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch teams performance data' },
      { status: 500 }
    );
  }
}