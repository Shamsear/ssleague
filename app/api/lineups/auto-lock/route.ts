import { NextRequest, NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/firebase/admin';

/**
 * Auto-lock lineups for a specific fixture if deadline has passed
 * Called automatically when pages load - no cron needed
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fixture_id } = body;

    if (!fixture_id) {
      return NextResponse.json(
        { success: false, error: 'fixture_id is required' },
        { status: 400 }
      );
    }

    const now = new Date();

    // Get fixture
    const fixtureDoc = await db.collection('fixtures').doc(fixture_id).get();
    if (!fixtureDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Fixture not found' },
        { status: 404 }
      );
    }

    const fixture = fixtureDoc.data();
    const deadline = fixture?.lineup_deadline;

    // Check if deadline has passed
    if (!deadline || new Date(deadline) > now) {
      return NextResponse.json({
        success: true,
        message: 'Deadline not yet passed',
        locked: false
      });
    }

    // Lock home team lineup
    const homeLineupId = `lineup_${fixture_id}_${fixture?.home_team_id}`;
    const homeLineupRef = db.collection('lineups').doc(homeLineupId);
    const homeLineupDoc = await homeLineupRef.get();

    let homeLocked = false;
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
        homeLocked = true;
      }
    } else {
      // Check if team has exactly 5 players - auto-create lineup with all players
      const rosterResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/team/${fixture?.home_team_id}/roster?season_id=${fixture?.season_id}`);
      const rosterData = await rosterResponse.json();
      
      let starters: string[] = [];
      let subs: string[] = [];
      
      if (rosterData.success && rosterData.players) {
        const activePlayers = rosterData.players.filter((p: any) => p.is_active);
        if (activePlayers.length === 5) {
          // Team has exactly 5 players - auto-select all as starters
          starters = activePlayers.map((p: any) => p.player_id);
          console.log(`✅ Auto-created lineup for home team with 5 players: ${starters.join(', ')}`);
        }
      }
      
      // Create locked lineup (empty if not 5 players, auto-filled if exactly 5)
      await homeLineupRef.set({
        fixture_id,
        team_id: fixture?.home_team_id,
        season_id: fixture?.season_id || '',
        starters,
        substitutes: subs,
        is_locked: true,
        locked_at: now.toISOString(),
        locked_by: 'system',
        locked_by_name: starters.length === 5 ? 'Auto-lock (5 Players)' : 'Auto-lock (No Submission)',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        submitted_by: null,
        submitted_by_name: null
      });
      homeLocked = true;
    }

    // Lock away team lineup
    const awayLineupId = `lineup_${fixture_id}_${fixture?.away_team_id}`;
    const awayLineupRef = db.collection('lineups').doc(awayLineupId);
    const awayLineupDoc = await awayLineupRef.get();

    let awayLocked = false;
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
        awayLocked = true;
      }
    } else {
      // Check if team has exactly 5 players - auto-create lineup with all players
      const rosterResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/team/${fixture?.away_team_id}/roster?season_id=${fixture?.season_id}`);
      const rosterData = await rosterResponse.json();
      
      let starters: string[] = [];
      let subs: string[] = [];
      
      if (rosterData.success && rosterData.players) {
        const activePlayers = rosterData.players.filter((p: any) => p.is_active);
        if (activePlayers.length === 5) {
          // Team has exactly 5 players - auto-select all as starters
          starters = activePlayers.map((p: any) => p.player_id);
          console.log(`✅ Auto-created lineup for away team with 5 players: ${starters.join(', ')}`);
        }
      }
      
      // Create locked lineup (empty if not 5 players, auto-filled if exactly 5)
      await awayLineupRef.set({
        fixture_id,
        team_id: fixture?.away_team_id,
        season_id: fixture?.season_id || '',
        starters,
        substitutes: subs,
        is_locked: true,
        locked_at: now.toISOString(),
        locked_by: 'system',
        locked_by_name: starters.length === 5 ? 'Auto-lock (5 Players)' : 'Auto-lock (No Submission)',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        submitted_by: null,
        submitted_by_name: null
      });
      awayLocked = true;
    }

    return NextResponse.json({
      success: true,
      message: 'Auto-lock completed',
      locked: true,
      home_locked: homeLocked,
      away_locked: awayLocked
    });
  } catch (error: any) {
    console.error('Error auto-locking lineups:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to auto-lock' },
      { status: 500 }
    );
  }
}
