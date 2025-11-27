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
    const search = searchParams.get('search') || '';
    const position = searchParams.get('position') || '';
    const positionGroup = searchParams.get('position_group') || '';
    const playingStyle = searchParams.get('playing_style') || '';
    const starredOnly = searchParams.get('starred_only') === 'true';
    
    // Get Neon team_id from Firebase token (if authenticated)
    let teamId: string | null = null;
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get('token')?.value;
      if (token) {
        try {
          const firebaseUid = getFirebaseUidFromToken(token);
          
          if (firebaseUid) {
            teamId = getCachedTeamId(firebaseUid);
            
            if (!teamId) {
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
          console.log('Token decode skipped:', decodeError);
        }
      }
    } catch (authError) {
      console.log('Auth check skipped for database request:', authError);
    }
    
    // Build query with filters - use conditional queries
    let players, countResult;
    
    const hasSearch = search.length > 0;
    const hasPosition = position.length > 0;
    const hasPositionGroup = positionGroup.length > 0;
    const hasPlayingStyle = playingStyle.length > 0;
    const hasStarred = starredOnly && teamId;
    
    // Build queries based on filter combinations
    if (hasSearch && hasPosition && hasPlayingStyle) {
      players = await sql`
        SELECT 
          fp.id, fp.player_id, fp.name, fp.position, fp.position_group, fp.playing_style,
          fp.overall_rating, fp.speed, fp.acceleration, fp.ball_control, fp.dribbling,
          fp.low_pass, fp.lofted_pass, fp.finishing, fp.team_id, fp.team_name,
          CASE WHEN sp.id IS NOT NULL THEN true ELSE false END as is_starred
        FROM footballplayers fp
        LEFT JOIN starred_players sp ON fp.id = sp.player_id AND sp.team_id = ${teamId}
        WHERE fp.name ILIKE ${`%${search}%`} AND fp.position = ${position} AND fp.playing_style = ${playingStyle}
        ORDER BY fp.overall_rating DESC NULLS LAST, fp.name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM footballplayers fp
        WHERE fp.name ILIKE ${`%${search}%`} AND fp.position = ${position} AND fp.playing_style = ${playingStyle}
      `;
    } else if (hasSearch && hasPosition) {
      players = await sql`
        SELECT 
          fp.id, fp.player_id, fp.name, fp.position, fp.position_group, fp.playing_style,
          fp.overall_rating, fp.speed, fp.acceleration, fp.ball_control, fp.dribbling,
          fp.low_pass, fp.lofted_pass, fp.finishing, fp.team_id, fp.team_name,
          CASE WHEN sp.id IS NOT NULL THEN true ELSE false END as is_starred
        FROM footballplayers fp
        LEFT JOIN starred_players sp ON fp.id = sp.player_id AND sp.team_id = ${teamId}
        WHERE fp.name ILIKE ${`%${search}%`} AND fp.position = ${position}
        ORDER BY fp.overall_rating DESC NULLS LAST, fp.name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM footballplayers fp
        WHERE fp.name ILIKE ${`%${search}%`} AND fp.position = ${position}
      `;
    } else if (hasSearch && hasPositionGroup) {
      players = await sql`
        SELECT 
          fp.id, fp.player_id, fp.name, fp.position, fp.position_group, fp.playing_style,
          fp.overall_rating, fp.speed, fp.acceleration, fp.ball_control, fp.dribbling,
          fp.low_pass, fp.lofted_pass, fp.finishing, fp.team_id, fp.team_name,
          CASE WHEN sp.id IS NOT NULL THEN true ELSE false END as is_starred
        FROM footballplayers fp
        LEFT JOIN starred_players sp ON fp.id = sp.player_id AND sp.team_id = ${teamId}
        WHERE fp.name ILIKE ${`%${search}%`} AND fp.position_group = ${positionGroup}
        ORDER BY fp.overall_rating DESC NULLS LAST, fp.name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM footballplayers fp
        WHERE fp.name ILIKE ${`%${search}%`} AND fp.position_group = ${positionGroup}
      `;
    } else if (hasSearch && hasPlayingStyle) {
      players = await sql`
        SELECT 
          fp.id, fp.player_id, fp.name, fp.position, fp.position_group, fp.playing_style,
          fp.overall_rating, fp.speed, fp.acceleration, fp.ball_control, fp.dribbling,
          fp.low_pass, fp.lofted_pass, fp.finishing, fp.team_id, fp.team_name,
          CASE WHEN sp.id IS NOT NULL THEN true ELSE false END as is_starred
        FROM footballplayers fp
        LEFT JOIN starred_players sp ON fp.id = sp.player_id AND sp.team_id = ${teamId}
        WHERE fp.name ILIKE ${`%${search}%`} AND fp.playing_style = ${playingStyle}
        ORDER BY fp.overall_rating DESC NULLS LAST, fp.name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM footballplayers fp
        WHERE fp.name ILIKE ${`%${search}%`} AND fp.playing_style = ${playingStyle}
      `;
    } else if (hasSearch) {
      players = await sql`
        SELECT 
          fp.id, fp.player_id, fp.name, fp.position, fp.position_group, fp.playing_style,
          fp.overall_rating, fp.speed, fp.acceleration, fp.ball_control, fp.dribbling,
          fp.low_pass, fp.lofted_pass, fp.finishing, fp.team_id, fp.team_name,
          CASE WHEN sp.id IS NOT NULL THEN true ELSE false END as is_starred
        FROM footballplayers fp
        LEFT JOIN starred_players sp ON fp.id = sp.player_id AND sp.team_id = ${teamId}
        WHERE fp.name ILIKE ${`%${search}%`}
        ORDER BY fp.overall_rating DESC NULLS LAST, fp.name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM footballplayers fp
        WHERE fp.name ILIKE ${`%${search}%`}
      `;
    } else if (hasPosition && hasPlayingStyle) {
      players = await sql`
        SELECT 
          fp.id, fp.player_id, fp.name, fp.position, fp.position_group, fp.playing_style,
          fp.overall_rating, fp.speed, fp.acceleration, fp.ball_control, fp.dribbling,
          fp.low_pass, fp.lofted_pass, fp.finishing, fp.team_id, fp.team_name,
          CASE WHEN sp.id IS NOT NULL THEN true ELSE false END as is_starred
        FROM footballplayers fp
        LEFT JOIN starred_players sp ON fp.id = sp.player_id AND sp.team_id = ${teamId}
        WHERE fp.position = ${position} AND fp.playing_style = ${playingStyle}
        ORDER BY fp.overall_rating DESC NULLS LAST, fp.name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM footballplayers fp
        WHERE fp.position = ${position} AND fp.playing_style = ${playingStyle}
      `;
    } else if (hasPositionGroup && hasPlayingStyle) {
      players = await sql`
        SELECT 
          fp.id, fp.player_id, fp.name, fp.position, fp.position_group, fp.playing_style,
          fp.overall_rating, fp.speed, fp.acceleration, fp.ball_control, fp.dribbling,
          fp.low_pass, fp.lofted_pass, fp.finishing, fp.team_id, fp.team_name,
          CASE WHEN sp.id IS NOT NULL THEN true ELSE false END as is_starred
        FROM footballplayers fp
        LEFT JOIN starred_players sp ON fp.id = sp.player_id AND sp.team_id = ${teamId}
        WHERE fp.position_group = ${positionGroup} AND fp.playing_style = ${playingStyle}
        ORDER BY fp.overall_rating DESC NULLS LAST, fp.name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM footballplayers fp
        WHERE fp.position_group = ${positionGroup} AND fp.playing_style = ${playingStyle}
      `;
    } else if (hasPosition) {
      players = await sql`
        SELECT 
          fp.id, fp.player_id, fp.name, fp.position, fp.position_group, fp.playing_style,
          fp.overall_rating, fp.speed, fp.acceleration, fp.ball_control, fp.dribbling,
          fp.low_pass, fp.lofted_pass, fp.finishing, fp.team_id, fp.team_name,
          CASE WHEN sp.id IS NOT NULL THEN true ELSE false END as is_starred
        FROM footballplayers fp
        LEFT JOIN starred_players sp ON fp.id = sp.player_id AND sp.team_id = ${teamId}
        WHERE fp.position = ${position}
        ORDER BY fp.overall_rating DESC NULLS LAST, fp.name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM footballplayers fp
        WHERE fp.position = ${position}
      `;
    } else if (hasPositionGroup) {
      players = await sql`
        SELECT 
          fp.id, fp.player_id, fp.name, fp.position, fp.position_group, fp.playing_style,
          fp.overall_rating, fp.speed, fp.acceleration, fp.ball_control, fp.dribbling,
          fp.low_pass, fp.lofted_pass, fp.finishing, fp.team_id, fp.team_name,
          CASE WHEN sp.id IS NOT NULL THEN true ELSE false END as is_starred
        FROM footballplayers fp
        LEFT JOIN starred_players sp ON fp.id = sp.player_id AND sp.team_id = ${teamId}
        WHERE fp.position_group = ${positionGroup}
        ORDER BY fp.overall_rating DESC NULLS LAST, fp.name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM footballplayers fp
        WHERE fp.position_group = ${positionGroup}
      `;
    } else if (hasPlayingStyle) {
      players = await sql`
        SELECT 
          fp.id, fp.player_id, fp.name, fp.position, fp.position_group, fp.playing_style,
          fp.overall_rating, fp.speed, fp.acceleration, fp.ball_control, fp.dribbling,
          fp.low_pass, fp.lofted_pass, fp.finishing, fp.team_id, fp.team_name,
          CASE WHEN sp.id IS NOT NULL THEN true ELSE false END as is_starred
        FROM footballplayers fp
        LEFT JOIN starred_players sp ON fp.id = sp.player_id AND sp.team_id = ${teamId}
        WHERE fp.playing_style = ${playingStyle}
        ORDER BY fp.overall_rating DESC NULLS LAST, fp.name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM footballplayers fp
        WHERE fp.playing_style = ${playingStyle}
      `;
    } else if (hasStarred) {
      players = await sql`
        SELECT 
          fp.id, fp.player_id, fp.name, fp.position, fp.position_group, fp.playing_style,
          fp.overall_rating, fp.speed, fp.acceleration, fp.ball_control, fp.dribbling,
          fp.low_pass, fp.lofted_pass, fp.finishing, fp.team_id, fp.team_name,
          CASE WHEN sp.id IS NOT NULL THEN true ELSE false END as is_starred
        FROM footballplayers fp
        LEFT JOIN starred_players sp ON fp.id = sp.player_id AND sp.team_id = ${teamId}
        WHERE sp.id IS NOT NULL
        ORDER BY fp.overall_rating DESC NULLS LAST, fp.name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM footballplayers fp
        LEFT JOIN starred_players sp ON fp.id = sp.player_id AND sp.team_id = ${teamId}
        WHERE sp.id IS NOT NULL
      `;
    } else {
      // No filters
      players = await sql`
        SELECT 
          fp.id, fp.player_id, fp.name, fp.position, fp.position_group, fp.playing_style,
          fp.overall_rating, fp.speed, fp.acceleration, fp.ball_control, fp.dribbling,
          fp.low_pass, fp.lofted_pass, fp.finishing, fp.team_id, fp.team_name,
          CASE WHEN sp.id IS NOT NULL THEN true ELSE false END as is_starred
        FROM footballplayers fp
        LEFT JOIN starred_players sp ON fp.id = sp.player_id AND sp.team_id = ${teamId}
        ORDER BY fp.overall_rating DESC NULLS LAST, fp.name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT COUNT(*) as total FROM footballplayers
      `;
    }
    
    const total = parseInt(countResult[0]?.total || '0');
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
