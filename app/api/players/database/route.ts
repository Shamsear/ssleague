import { NextResponse } from 'next/server';
import { sql } from '@/lib/neon/config';
import { cookies } from 'next/headers';
import { getFirebaseUidFromToken } from '@/lib/jwt-decode';

// Simple in-memory cache for team_id lookups (expires after 5 minutes)
const teamIdCache = new Map<string, { teamId: string; expiresAt: number }>();

function getCachedTeamId(firebaseUid: string): string | null {
  const cached = teamIdCache.get(firebaseUid);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.teamId;
  }
  teamIdCache.delete(firebaseUid);
  return null;
}

function setCachedTeamId(firebaseUid: string, teamId: string) {
  teamIdCache.set(firebaseUid, {
    teamId,
    expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = (page - 1) * limit;
    
    // Get Neon team_id from Firebase token (if authenticated)
    // This endpoint works without auth, but starred status only shows for authenticated users
    let teamId: string | null = null;
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get('token')?.value;
      if (token) {
        // Decode JWT locally without verification to avoid Firebase API calls
        // This is safe for read-only starred status - no sensitive operations
        try {
          const firebaseUid = getFirebaseUidFromToken(token);
          
          if (firebaseUid) {
            // Check cache first
            teamId = getCachedTeamId(firebaseUid);
            
            if (!teamId) {
              // Cache miss - look up Neon team_id from Firebase UID
              const teamResult = await sql`
                SELECT id FROM teams WHERE firebase_uid = ${firebaseUid} LIMIT 1
              `;
              
              if (teamResult.length > 0) {
                teamId = teamResult[0].id;
                setCachedTeamId(firebaseUid, teamId);
              }
            }
          }
        } catch (decodeError) {
          // Token decode failed - continue without team_id
          console.log('Token decode skipped:', decodeError);
        }
      }
    } catch (authError) {
      // If auth fails, continue without team_id (starred will be false for all)
      console.log('Auth check skipped for database request:', authError);
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
