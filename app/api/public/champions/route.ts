import { NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // Cache for 5 minutes

export async function GET() {
  try {
    const sql = getTournamentDb();
    
    // Get all league champions (teams that finished 1st) with count and stats from teamstats
    const champions = await sql`
      SELECT 
        tt.team_id,
        tt.team_name,
        COUNT(*) as championship_count,
        ARRAY_AGG(tt.season_id ORDER BY tt.season_id) as seasons_won,
        MAX(ts.points) as best_points,
        SUM(ts.wins) as total_wins,
        SUM(ts.goals_for) as total_goals
      FROM team_trophies tt
      LEFT JOIN teamstats ts ON tt.team_id = ts.team_id AND tt.season_id = ts.season_id
      WHERE tt.trophy_type = 'league' 
        AND (tt.trophy_position = 'Winners' OR tt.position = 1)
      GROUP BY tt.team_id, tt.team_name
      ORDER BY championship_count DESC, tt.team_name ASC
    `;

    // Get cup winners from team_trophies where trophy_name = 'CUP'
    const cupWinners = await sql`
      SELECT 
        team_id,
        team_name,
        COUNT(*) as cup_count,
        ARRAY_AGG(season_id ORDER BY season_id) as seasons
      FROM team_trophies
      WHERE trophy_name = 'CUP'
        AND trophy_position = 'Champions'
      GROUP BY team_id, team_name
      ORDER BY cup_count DESC, team_name ASC
    `;

    // Count total unique champions
    const totalChampionsCount = champions.length;

    return NextResponse.json({
      success: true,
      data: {
        champions,
        cupWinners,
        totalChampions: totalChampionsCount
      }
    });
  } catch (error: any) {
    console.error('Error fetching champions:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
