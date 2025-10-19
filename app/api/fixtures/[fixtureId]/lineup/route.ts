import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';

interface LineupPlayer {
  player_id: string;
  player_name: string;
  position: number;
  is_substitute: boolean;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { fixtureId: string } }
) {
  try {
    const { fixtureId } = params;
    
    // Verify authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Get request body
    const body = await request.json();
    const { players } = body as { players: LineupPlayer[] };

    // Validate lineup
    if (!players || players.length !== 6) {
      return NextResponse.json(
        { success: false, error: 'Lineup must have exactly 6 players' },
        { status: 400 }
      );
    }

    const substituteCount = players.filter(p => p.is_substitute).length;
    if (substituteCount !== 1) {
      return NextResponse.json(
        { success: false, error: 'Lineup must have exactly 1 substitute' },
        { status: 400 }
      );
    }

    // Get fixture from Neon
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.NEON_DATABASE_URL!);
    
    const fixtures = await sql`
      SELECT * FROM fixtures WHERE id = ${fixtureId} LIMIT 1
    `;

    if (fixtures.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Fixture not found' },
        { status: 404 }
      );
    }

    const fixture = fixtures[0];

    // Get team_id from team_seasons
    const teamSeasonsQuery = await adminDb
      .collection('team_seasons')
      .where('user_id', '==', userId)
      .where('season_id', '==', fixture.season_id)
      .where('status', '==', 'registered')
      .limit(1)
      .get();

    if (teamSeasonsQuery.empty) {
      return NextResponse.json(
        { success: false, error: 'Team not registered for this season' },
        { status: 403 }
      );
    }

    const teamId = teamSeasonsQuery.docs[0].data().team_id;
    const isHomeTeam = fixture.home_team_id === teamId;
    const isAwayTeam = fixture.away_team_id === teamId;

    if (!isHomeTeam && !isAwayTeam) {
      return NextResponse.json(
        { success: false, error: 'Not authorized for this fixture' },
        { status: 403 }
      );
    }

    // Get round deadlines from Neon to determine phase
    const seasonId = fixture.season_id;
    const roundNumber = fixture.round_number;
    const leg = fixture.leg || 'first';

    const roundDeadlines = await sql`
      SELECT * FROM round_deadlines 
      WHERE season_id = ${seasonId}
        AND round_number = ${roundNumber}
        AND leg = ${leg}
      LIMIT 1
    `;

    if (roundDeadlines.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Round configuration not found' },
        { status: 404 }
      );
    }

    const roundData = roundDeadlines[0];
    const now = new Date();

    // Calculate deadlines
    const scheduledDate = roundData.scheduled_date;
    if (!scheduledDate) {
      return NextResponse.json(
        { success: false, error: 'Round not scheduled yet' },
        { status: 400 }
      );
    }

    const baseDate = new Date(scheduledDate);
    const [homeHour, homeMin] = (roundData.home_fixture_deadline_time || '17:00').split(':').map(Number);
    const [awayHour, awayMin] = (roundData.away_fixture_deadline_time || '17:00').split(':').map(Number);

    const homeDeadline = new Date(baseDate);
    homeDeadline.setHours(homeHour, homeMin, 0, 0);

    const awayDeadline = new Date(baseDate);
    awayDeadline.setHours(awayHour, awayMin, 0, 0);

    // Determine current phase
    const isHomePhase = now < homeDeadline;
    const isAwayPhase = now >= homeDeadline && now < awayDeadline;
    const isLocked = now >= awayDeadline;

    if (isLocked) {
      return NextResponse.json(
        { success: false, error: 'Fixture lineup is locked. Deadline passed.' },
        { status: 403 }
      );
    }

    // Check permissions based on phase
    const homeSubmitted = !!fixture.home_lineup_submitted_at;
    const awaySubmitted = !!fixture.away_lineup_submitted_at;

    if (isHomePhase) {
      // HOME PHASE: Only home team can submit
      if (!isHomeTeam) {
        return NextResponse.json(
          { success: false, error: 'Only home team can submit during home fixture phase' },
          { status: 403 }
        );
      }
    } else if (isAwayPhase) {
      // AWAY PHASE: First to submit gets exclusive rights
      if (isHomeTeam) {
        // Home team trying to submit/edit
        if (!homeSubmitted) {
          // Home didn't submit yet
          if (awaySubmitted) {
            // Away already submitted first
            return NextResponse.json(
              { success: false, error: 'Away team submitted first. You cannot edit now.' },
              { status: 403 }
            );
          }
          // Home can submit now
        }
        // Home already submitted, can continue editing
      } else {
        // Away team trying to submit/edit
        if (!awaySubmitted) {
          // Away didn't submit yet
          if (homeSubmitted) {
            // Home already submitted first
            return NextResponse.json(
              { success: false, error: 'Home team submitted first. You cannot edit now.' },
              { status: 403 }
            );
          }
          // Away can submit now
        }
        // Away already submitted, can continue editing
      }
    }

    // Save lineup
    const lineupData = {
      players: players,
      locked: false,
      submitted_by: userId,
      submitted_at: FieldValue.serverTimestamp(),
    };

    const updateData: any = {};
    if (isHomeTeam) {
      updateData.home_lineup = lineupData;
      if (!homeSubmitted) {
        updateData.home_lineup_submitted_at = FieldValue.serverTimestamp();
      }
    } else {
      updateData.away_lineup = lineupData;
      if (!awaySubmitted) {
        updateData.away_lineup_submitted_at = FieldValue.serverTimestamp();
      }
    }

    updateData.updated_at = FieldValue.serverTimestamp();

    await fixtureRef.update(updateData);

    return NextResponse.json({
      success: true,
      message: 'Lineup saved successfully',
    });
  } catch (error: any) {
    console.error('Error saving lineup:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save lineup' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { fixtureId: string } }
) {
  try {
    const { fixtureId } = params;

    // Verify authentication
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await adminAuth.verifyIdToken(token);

    // Get fixture with lineup data
    const fixtureRef = adminDb.collection('fixtures').doc(fixtureId);
    const fixtureDoc = await fixtureRef.get();

    if (!fixtureDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Fixture not found' },
        { status: 404 }
      );
    }

    const fixture = fixtureDoc.data()!;

    return NextResponse.json({
      success: true,
      data: {
        home_lineup: fixture.home_lineup || null,
        away_lineup: fixture.away_lineup || null,
        home_lineup_submitted_at: fixture.home_lineup_submitted_at || null,
        away_lineup_submitted_at: fixture.away_lineup_submitted_at || null,
      },
    });
  } catch (error: any) {
    console.error('Error fetching lineup:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch lineup' },
      { status: 500 }
    );
  }
}
