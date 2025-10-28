import { NextRequest, NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/firebase/admin';

/**
 * Process lineup locks for fixtures past their deadline
 * Manually triggered by committee from dashboard
 * No cron jobs needed - checks fixture deadlines directly
 */
export async function POST(request: NextRequest) {
  try {
    const now = new Date();
    const body = await request.json();
    const { season_id, round_number } = body;

    // Get fixtures with passed deadlines
    let fixturesQuery = db.collection('fixtures')
      .where('lineup_deadline', '<=', now.toISOString());

    if (season_id) {
      fixturesQuery = fixturesQuery.where('season_id', '==', season_id);
    }
    if (round_number) {
      fixturesQuery = fixturesQuery.where('round_number', '==', parseInt(round_number));
    }

    const fixturesSnapshot = await fixturesQuery.get();

    if (fixturesSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'No fixtures with passed deadlines',
        processed: 0
      });
    }

    let processedCount = 0;
    const results: any[] = [];

    for (const fixtureDoc of fixturesSnapshot.docs) {
      const fixture = fixtureDoc.data();
      const { id: fixture_id, home_team_id, away_team_id, season_id: fixtureSeason } = { id: fixtureDoc.id, ...fixture };

      try {
        // Lock home team lineup if exists and not already locked
        const homeLineupId = `lineup_${fixture_id}_${home_team_id}`;
        const homeLineupRef = db.collection('lineups').doc(homeLineupId);
        const homeLineupDoc = await homeLineupRef.get();

        if (homeLineupDoc.exists) {
          const homeLineup = homeLineupDoc.data();
          if (!homeLineup?.is_locked) {
            await homeLineupRef.update({
              is_locked: true,
              locked_at: now.toISOString(),
              locked_by: 'system',
              locked_by_name: 'Auto-lock (Deadline)',
              updated_at: now.toISOString()
            });
            results.push({ team_id: home_team_id, status: 'locked' });
            processedCount++;
          }
        } else {
          // No lineup submitted - create locked empty lineup
          await homeLineupRef.set({
            fixture_id,
            team_id: home_team_id,
            season_id: fixtureSeason || '',
            starters: [],
            substitutes: [],
            is_locked: true,
            locked_at: now.toISOString(),
            locked_by: 'system',
            locked_by_name: 'Auto-lock (Deadline - No Submission)',
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
            submitted_by: null,
            submitted_by_name: null
          });
          results.push({ team_id: home_team_id, status: 'locked_empty' });
          processedCount++;
        }

        // Lock away team lineup if exists and not already locked
        const awayLineupId = `lineup_${fixture_id}_${away_team_id}`;
        const awayLineupRef = db.collection('lineups').doc(awayLineupId);
        const awayLineupDoc = await awayLineupRef.get();

        if (awayLineupDoc.exists) {
          const awayLineup = awayLineupDoc.data();
          if (!awayLineup?.is_locked) {
            await awayLineupRef.update({
              is_locked: true,
              locked_at: now.toISOString(),
              locked_by: 'system',
              locked_by_name: 'Auto-lock (Deadline)',
              updated_at: now.toISOString()
            });
            results.push({ team_id: away_team_id, status: 'locked' });
            processedCount++;
          }
        } else {
          // No lineup submitted - create locked empty lineup
          await awayLineupRef.set({
            fixture_id,
            team_id: away_team_id,
            season_id: fixtureSeason || '',
            starters: [],
            substitutes: [],
            is_locked: true,
            locked_at: now.toISOString(),
            locked_by: 'system',
            locked_by_name: 'Auto-lock (Deadline - No Submission)',
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
            submitted_by: null,
            submitted_by_name: null
          });
          results.push({ team_id: away_team_id, status: 'locked_empty' });
          processedCount++;
        }

      } catch (err: any) {
        console.error(`Error processing lock for fixture ${fixture_id}:`, err);
        results.push({ 
          fixture_id, 
          status: 'error', 
          error: err.message 
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${processedCount} lineup locks`,
      processed: processedCount,
      results
    });
  } catch (error: any) {
    console.error('Error processing lineup locks:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process locks' },
      { status: 500 }
    );
  }
}
