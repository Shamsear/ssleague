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

    // Get team IDs
    const teamIds = teamsSnapshot.docs.map(doc => doc.id);

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

    // Map teams data with stats
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
        logo_url: teamData.logoUrl || teamData.logoURL || teamData.logo_url || null,
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
