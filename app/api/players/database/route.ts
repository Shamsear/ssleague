import { NextResponse } from 'next/server';
import { sql } from '@/lib/neon/config';
import { cookies } from 'next/headers';
import { getFirebaseUidFromToken } from '@/lib/jwt-decode';
import { adminDb } from '@/lib/firebase/admin';

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
    const teamIdFilter = searchParams.get('team_id') || '';
    const starredOnly = searchParams.get('starred_only') === 'true';
    const assignedOnly = searchParams.get('assigned_only') === 'true';

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

    // Build WHERE conditions dynamically
    const whereParts: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (search) {
      whereParts.push(`fp.name ILIKE $${paramIndex++}`);
      queryParams.push(`%${search}%`);
    }

    if (position) {
      whereParts.push(`fp.position = $${paramIndex++}`);
      queryParams.push(position);
    }

    if (positionGroup) {
      whereParts.push(`fp.position_group = $${paramIndex++}`);
      queryParams.push(positionGroup);
    }

    if (playingStyle) {
      whereParts.push(`fp.playing_style = $${paramIndex++}`);
      queryParams.push(playingStyle);
    }

    if (teamIdFilter) {
      if (teamIdFilter === 'free_agent') {
        whereParts.push('fp.team_id IS NULL');
      } else {
        whereParts.push(`fp.team_id = $${paramIndex++}`);
        queryParams.push(teamIdFilter);
      }
    }

    // Filter for only assigned players (have team_id)
    if (assignedOnly) {
      whereParts.push('fp.team_id IS NOT NULL');
    }

    if (starredOnly && teamId) {
      whereParts.push('sp.id IS NOT NULL');
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    // Add teamId for the JOIN
    const teamIdParam = paramIndex++;
    queryParams.push(teamId);

    // Add limit and offset
    const limitParam = paramIndex++;
    const offsetParam = paramIndex++;
    queryParams.push(limit, offset);

    // Build the query with proper $1, $2, etc. placeholders
    const queryText = `
      SELECT 
        fp.id, fp.player_id, fp.name, fp.position, fp.position_group, fp.playing_style,
        fp.overall_rating, fp.speed, fp.acceleration, fp.ball_control, fp.dribbling,
        fp.low_pass, fp.lofted_pass, fp.finishing, fp.team_id, fp.acquisition_value,
        CASE WHEN sp.id IS NOT NULL THEN true ELSE false END as is_starred
      FROM footballplayers fp
      LEFT JOIN starred_players sp ON fp.id = sp.player_id AND sp.team_id = $${teamIdParam}
      ${whereClause}
      ORDER BY fp.overall_rating DESC NULLS LAST, fp.name ASC
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    players = await sql.query(queryText, queryParams);

    // Fetch team names from auction DB for players that have team_id
    const uniqueTeamIds = [...new Set(players.map((p: any) => p.team_id).filter(Boolean))];
    const teamNamesMap = new Map<string, string>();

    if (uniqueTeamIds.length > 0) {
      try {
        // Fetch team names from Neon auction DB
        const teamsResult = await sql`
          SELECT id, name
          FROM teams
          WHERE id = ANY(${uniqueTeamIds})
        `;

        teamsResult.forEach((team: any) => {
          teamNamesMap.set(team.id, team.name || 'Unknown Team');
        });
      } catch (dbError) {
        console.error('Error fetching team names from auction DB:', dbError);
      }
    }

    // Add team_name to each player
    players = players.map((player: any) => ({
      ...player,
      team_name: player.team_id ? teamNamesMap.get(player.team_id) || null : null
    }));

    // Count query (reuse params without limit/offset)
    const countParams = queryParams.slice(0, -2);
    const countQueryText = `
      SELECT COUNT(*) as total 
      FROM footballplayers fp
      LEFT JOIN starred_players sp ON fp.id = sp.player_id AND sp.team_id = $${teamIdParam}
      ${whereClause}
    `;

    countResult = await sql.query(countQueryText, countParams);

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
