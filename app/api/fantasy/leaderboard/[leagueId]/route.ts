import { NextRequest, NextResponse } from 'next/server';
import { getFantasyDb } from '@/lib/neon/fantasy-config';
import { adminDb } from '@/lib/firebase/admin';

/**
 * GET /api/fantasy/leaderboard/[leagueId]
 * Get fantasy league leaderboard with team rankings from PostgreSQL
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  try {
    const { leagueId } = await params;

    if (!leagueId) {
      return NextResponse.json(
        { error: 'League ID is required' },
        { status: 400 }
      );
    }

    const fantasySql = getFantasyDb();

    // Get fantasy league
    const leagues = await fantasySql`
      SELECT id, league_id, league_name, season_id, is_active
      FROM fantasy_leagues
      WHERE league_id = ${leagueId}
    `;

    if (leagues.length === 0) {
      return NextResponse.json(
        { error: 'Fantasy league not found' },
        { status: 404 }
      );
    }

    const league = leagues[0];

    // Get leaderboard with team stats
    const leaderboard = await fantasySql`
      SELECT 
        ft.team_id as fantasy_team_id,
        ft.team_name,
        ft.owner_name,
        ft.total_points,
        ft.rank,
        ft.supported_team_id,
        COUNT(DISTINCT fs.real_player_id) as player_count,
        COALESCE(
          (
            SELECT SUM(fpp.total_points)
            FROM fantasy_player_points fpp
            WHERE fpp.team_id = ft.team_id
              AND fpp.round_number = (
                SELECT MAX(round_number)
                FROM fantasy_player_points
                WHERE team_id = ft.team_id
              )
          ),
          0
        ) as last_round_points
      FROM fantasy_teams ft
      LEFT JOIN fantasy_squad fs ON ft.team_id = fs.team_id
      WHERE ft.league_id = ${leagueId}
      GROUP BY ft.team_id, ft.team_name, ft.owner_name, ft.total_points, ft.rank, ft.supported_team_id
      ORDER BY ft.rank ASC NULLS LAST, ft.total_points DESC
    `;

    // Get fantasy team logos from Firebase using fantasy team_id
    const fantasyTeamIds = leaderboard
      .map(entry => entry.fantasy_team_id)
      .filter(id => id != null && id !== '');
    
    console.log('[Leaderboard API] Fetching logos for fantasy team IDs:', fantasyTeamIds);
    
    let teamLogos: Record<string, string> = {};
    if (fantasyTeamIds.length > 0) {
      // Fetch fantasy teams by document ID (fantasy team_id)
      const teamPromises = fantasyTeamIds.map(teamId => 
        adminDb.collection('teams').doc(teamId).get()
      );
      
      const teamDocs = await Promise.all(teamPromises);
      
      teamDocs.forEach((doc, index) => {
        const fantasyTeamId = fantasyTeamIds[index];
        if (doc.exists) {
          const teamData = doc.data();
          // Check multiple possible logo field names
          const logoUrl = teamData?.logo_url || teamData?.logoUrl || teamData?.team_logo || null;
          
          if (logoUrl) {
            teamLogos[fantasyTeamId] = logoUrl;
            console.log(`[Leaderboard API] Found logo for fantasy team ${fantasyTeamId}:`, logoUrl);
          } else {
            console.log(`[Leaderboard API] No logo found for fantasy team ${fantasyTeamId}`);
          }
        } else {
          console.log(`[Leaderboard API] Fantasy team document not found: ${fantasyTeamId}`);
        }
      });
    }
    
    console.log('[Leaderboard API] Fantasy team logos map:', teamLogos);

    // Debug: Log team mappings
    console.log('[Leaderboard API] Team mappings:');
    leaderboard.forEach(entry => {
      console.log(`  ${entry.team_name}: fantasy_team_id=${entry.fantasy_team_id}, logo=${teamLogos[entry.fantasy_team_id] || 'NOT FOUND'}`);
    });

    return NextResponse.json({
      success: true,
      league: {
        id: league.id,
        league_id: league.league_id,
        name: league.league_name,
        season_id: league.season_id,
        status: league.is_active ? 'active' : 'inactive',
      },
      leaderboard: leaderboard.map(entry => ({
        id: entry.fantasy_team_id,
        rank: entry.rank || 999,
        fantasy_team_id: entry.fantasy_team_id,
        team_name: entry.team_name,
        owner_name: entry.owner_name,
        total_points: Number(entry.total_points) || 0,
        player_count: Number(entry.player_count) || 0,
        last_round_points: Number(entry.last_round_points) || 0,
        team_logo: teamLogos[entry.fantasy_team_id] || null,
        supported_team_id: entry.supported_team_id, // Include for debugging
      })),
      total_teams: leaderboard.length,
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
