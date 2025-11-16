import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTeamNames } from '@/lib/team-name-resolver';

/**
 * POST /api/teams/resolve-names
 * 
 * Resolves historical team names to current team names
 * 
 * Request body:
 * {
 *   "firebaseUids": ["uid1", "uid2", ...]
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "names": {
 *     "uid1": "Current Team Name 1",
 *     "uid2": "Current Team Name 2"
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firebaseUids } = body;

    if (!Array.isArray(firebaseUids)) {
      return NextResponse.json({
        success: false,
        error: 'firebaseUids must be an array'
      }, { status: 400 });
    }

    // Resolve all names at once
    const nameMap = await getCurrentTeamNames(firebaseUids);

    // Convert Map to object for JSON response
    const names: Record<string, string> = {};
    nameMap.forEach((name, uid) => {
      names[uid] = name;
    });

    return NextResponse.json({
      success: true,
      names
    });

  } catch (error: any) {
    console.error('Error resolving team names:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to resolve team names'
    }, { status: 500 });
  }
}

/**
 * GET /api/teams/resolve-names?uid=xxx
 * 
 * Resolves a single team name
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const uid = searchParams.get('uid');

    if (!uid) {
      return NextResponse.json({
        success: false,
        error: 'uid query parameter is required'
      }, { status: 400 });
    }

    const nameMap = await getCurrentTeamNames([uid]);
    const name = nameMap.get(uid) || 'Unknown Team';

    return NextResponse.json({
      success: true,
      name
    });

  } catch (error: any) {
    console.error('Error resolving team name:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to resolve team name'
    }, { status: 500 });
  }
}
