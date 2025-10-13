import { NextResponse } from 'next/server';
import { sql } from '@/lib/neon/config';
import { adminAuth } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = (page - 1) * limit;
    
    // Get team_id from session (if authenticated)
    let teamId: string | null = null;
    try {
      const cookieStore = await cookies();
      const session = cookieStore.get('session')?.value;
      if (session) {
        const decodedClaims = await adminAuth.verifySessionCookie(session, true);
        teamId = decodedClaims.uid;
      }
    } catch (authError) {
      // If auth fails, continue without team_id (starred will be false for all)
      console.log('Auth check skipped for database request');
    }
    
    // Fetch players with pagination and starred status for current team
    const players = await sql`
      SELECT 
        fp.id,
        fp.player_id,
        fp.name,
        fp.position,
        fp.position_group,
        fp.playing_style,
        fp.overall_rating,
        fp.speed,
        fp.acceleration,
        fp.ball_control,
        fp.dribbling,
        fp.low_pass,
        fp.lofted_pass,
        fp.finishing,
        fp.team_id,
        fp.team_name,
        CASE 
          WHEN sp.id IS NOT NULL THEN true 
          ELSE false 
        END as is_starred
      FROM footballplayers fp
      LEFT JOIN starred_players sp ON fp.id = sp.player_id AND sp.team_id = ${teamId}
      ORDER BY fp.overall_rating DESC NULLS LAST, fp.name ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
    
    // Get total count for pagination
    const countResult = await sql`SELECT COUNT(*) as total FROM footballplayers`;
    const total = parseInt(countResult[0].total);
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: { 
        players,
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      },
      message: 'Players fetched successfully'
    });
  } catch (error: any) {
    console.error('Error fetching players:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch players'
      },
      { status: 500 }
    );
  }
}
