import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { tournamentSql as sql } from '@/lib/neon/tournament-config';

export async function GET(request: NextRequest) {
  try {
    console.log('[Teams API] Fetching all teams...');
    
    // Fetch all teams from Firebase
    const teamsSnapshot = await adminDb
      .collection('teams')
      .orderBy('team_name')
      .get();

    console.log(`[Teams API] Found ${teamsSnapshot.size} teams`);

    if (teamsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        teams: []
      });
    }

    // Get team IDs and map to user IDs
    const teamIds = teamsSnapshot.docs.map(doc => doc.id);
    const userIdToTeamIdMap = new Map();
    const userIds: string[] = [];
    
    teamsSnapshot.docs.forEach(doc => {
      const teamData = doc.data();
      const userId = teamData.userId || teamData.user_id || teamData.owner_id;
      if (userId) {
        userIds.push(userId);
        userIdToTeamIdMap.set(userId, doc.id);
      }
    });
    
    // Fetch logo URLs from teams collection first, fallback to users
    console.log('[Teams API] Fetching logo URLs...');
    const logoUrlMap = new Map();
    
    // First, get logos from teams collection
    teamsSnapshot.docs.forEach(doc => {
      const teamData = doc.data();
      if (teamData.logo_url) {
        logoUrlMap.set(doc.id, teamData.logo_url);
      }
    });
    
    // For teams without logos, fallback to users collection
    const teamsNeedingLogos = teamsSnapshot.docs
      .filter(doc => !logoUrlMap.has(doc.id))
      .map(doc => {
        const teamData = doc.data();
        const userId = teamData.userId || teamData.user_id || teamData.owner_id;
        return { teamId: doc.id, userId };
      })
      .filter(item => item.userId);
    
    if (teamsNeedingLogos.length > 0) {
      const userIdsForLogos = teamsNeedingLogos.map(item => item.userId);
      const usersSnapshot = await adminDb
        .collection('users')
        .where('__name__', 'in', userIdsForLogos)
        .get();
      
      const userLogoMap = new Map();
      usersSnapshot.docs.forEach(doc => {
        const userData = doc.data();
        if (userData.logoUrl) {
          userLogoMap.set(doc.id, userData.logoUrl);
        }
      });
      
      teamsNeedingLogos.forEach(({ teamId, userId }) => {
        const userLogo = userLogoMap.get(userId);
        if (userLogo) {
          logoUrlMap.set(teamId, userLogo);
        }
      });
    }
    
    console.log(`[Teams API] Found logo URLs for ${logoUrlMap.size} teams`);

    // Fetch aggregated stats from tournament DB for all teams
    console.log('[Teams API] Fetching stats from tournament DB...');
    let teamStats = [];
    try {
      teamStats = await sql`
        SELECT 
          team_id,
          SUM(matches_played) as total_matches,
          SUM(wins) as total_wins,
          SUM(draws) as total_draws,
          SUM(losses) as total_losses,
          SUM(goals_for) as total_goals_scored,
          SUM(goals_against) as total_goals_conceded,
          SUM(points) as total_points
        FROM teamstats
        WHERE team_id = ANY(${teamIds})
        GROUP BY team_id
      `;
      console.log(`[Teams API] Found stats for ${teamStats.length} teams`);
    } catch (statsError) {
      console.log('[Teams API] Could not fetch stats:', statsError.message);
      teamStats = [];
    }

    // Create stats lookup map
    const statsMap = new Map();
    teamStats.forEach(stat => {
      statsMap.set(stat.team_id, {
        matches_played: parseInt(stat.total_matches) || 0,
        wins: parseInt(stat.total_wins) || 0,
        draws: parseInt(stat.total_draws) || 0,
        losses: parseInt(stat.total_losses) || 0,
        goals_scored: parseInt(stat.total_goals_scored) || 0,
        goals_conceded: parseInt(stat.total_goals_conceded) || 0,
        points: parseInt(stat.total_points) || 0
      });
    });

    // Map teams data with stats and logo URLs
    const teams = teamsSnapshot.docs.map(doc => {
      const teamId = doc.id;
      const teamData = doc.data();
      const stats = statsMap.get(teamId) || {
        matches_played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_scored: 0,
        goals_conceded: 0,
        points: 0
      };

      return {
        id: teamId,
        team_id: teamId,
        team_name: teamData.team_name || teamData.name || 'Unknown Team',
        logo_url: logoUrlMap.get(teamId) || null,
        balance: teamData.balance || 0,
        created_at: teamData.created_at,
        ...stats
      };
    });

    return NextResponse.json({
      success: true,
      teams,
      count: teams.length
    });

  } catch (error: any) {
    console.error('[Teams API] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to fetch teams'
      },
      { status: 500 }
    );
  }
}
