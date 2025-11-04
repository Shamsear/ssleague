import { NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // Cache for 5 minutes

export async function GET() {
  const sql = getTournamentDb();
  try {
    // Get all award winners grouped by award type with counts
    const awardWinners = await sql`
      SELECT 
        award_type,
        player_id,
        player_name,
        COUNT(*) as times_won,
        ARRAY_AGG(
          json_build_object(
            'season_id', season_id,
            'position', award_position,
            'category', player_category
          ) ORDER BY season_id
        ) as wins
      FROM player_awards
      WHERE award_position = 'Winner'
      GROUP BY award_type, player_id, player_name
      ORDER BY award_type, times_won DESC, player_name ASC
    `;

    // Group by award type
    const groupedByAward: Record<string, any[]> = {};
    
    awardWinners.forEach((winner: any) => {
      if (!groupedByAward[winner.award_type]) {
        groupedByAward[winner.award_type] = [];
      }
      groupedByAward[winner.award_type].push({
        player_id: winner.player_id,
        player_name: winner.player_name,
        times_won: parseInt(winner.times_won),
        wins: winner.wins,
        total_value: 0 // No value column in this table
      });
    });

    // Get award type statistics
    const awardStats = await sql`
      SELECT 
        award_type,
        COUNT(DISTINCT player_id) as unique_winners,
        COUNT(*) as total_awards_given,
        ARRAY_AGG(DISTINCT season_id ORDER BY season_id) as seasons
      FROM player_awards
      GROUP BY award_type
      ORDER BY total_awards_given DESC
    `;

    return NextResponse.json({
      success: true,
      data: {
        awardWinners: groupedByAward,
        awardStats
      }
    });
  } catch (error: any) {
    console.error('Error fetching award winners:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
