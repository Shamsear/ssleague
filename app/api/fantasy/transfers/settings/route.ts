import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * GET /api/fantasy/transfers/settings?fantasy_league_id=xxx
 * Get transfer settings for a league
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const league_id = searchParams.get('fantasy_league_id') || searchParams.get('league_id');

    if (!league_id) {
      return NextResponse.json(
        { error: 'Missing fantasy_league_id or league_id parameter' },
        { status: 400 }
      );
    }

    // Get league settings from PostgreSQL
    const leagues = await fantasySql`
      SELECT * FROM fantasy_leagues
      WHERE league_id = ${league_id}
      LIMIT 1
    `;

    if (leagues.length === 0) {
      return NextResponse.json(
        { error: 'League not found' },
        { status: 404 }
      );
    }

    const league = leagues[0];

    // Check if there's an active transfer window
    const windows = await fantasySql`
      SELECT * FROM transfer_windows
      WHERE league_id = ${league_id}
        AND is_active = true
      LIMIT 1
    `;

    const isWindowOpen = windows.length > 0;

    return NextResponse.json({
      settings: {
        max_transfers_per_window: Number(league.max_transfers_per_window),
        is_transfer_window_open: isWindowOpen,
        transfer_window_start: windows[0]?.opens_at,
        transfer_window_end: windows[0]?.closes_at,
        points_cost_per_transfer: Number(league.points_cost_per_transfer),
      },
    });
  } catch (error) {
    console.error('Error fetching transfer settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transfer settings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fantasy/transfers/settings
 * Create or update transfer settings
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      fantasy_league_id,
      free_transfers_per_matchday,
      cost_per_additional_transfer,
      cost_per_team_change,
      allow_player_transfers,
      allow_team_changes,
      transfer_window_opens_before_matchday_hours,
      transfer_deadline_before_matchday_hours,
    } = body;

    if (!fantasy_league_id) {
      return NextResponse.json(
        { error: 'Missing required field: fantasy_league_id' },
        { status: 400 }
      );
    }

    // Validate settings
    if (free_transfers_per_matchday !== undefined && free_transfers_per_matchday < 0) {
      return NextResponse.json(
        { error: 'free_transfers_per_matchday must be non-negative' },
        { status: 400 }
      );
    }

    if (cost_per_additional_transfer !== undefined && cost_per_additional_transfer < 0) {
      return NextResponse.json(
        { error: 'cost_per_additional_transfer must be non-negative' },
        { status: 400 }
      );
    }

    if (cost_per_team_change !== undefined && cost_per_team_change < 0) {
      return NextResponse.json(
        { error: 'cost_per_team_change must be non-negative' },
        { status: 400 }
      );
    }

    // Check if settings already exist
    const existingSnap = await adminDb
      .collection('fantasy_transfer_settings')
      .where('fantasy_league_id', '==', fantasy_league_id)
      .limit(1)
      .get();

    const settingsData = {
      fantasy_league_id,
      free_transfers_per_matchday: free_transfers_per_matchday ?? 2,
      cost_per_additional_transfer: cost_per_additional_transfer ?? 4,
      cost_per_team_change: cost_per_team_change ?? 8,
      allow_player_transfers: allow_player_transfers ?? true,
      allow_team_changes: allow_team_changes ?? true,
      transfer_window_opens_before_matchday_hours: transfer_window_opens_before_matchday_hours ?? 48,
      transfer_deadline_before_matchday_hours: transfer_deadline_before_matchday_hours ?? 2,
      updated_at: FieldValue.serverTimestamp(),
    };

    if (!existingSnap.empty) {
      // Update existing
      const settingsId = existingSnap.docs[0].id;
      await adminDb
        .collection('fantasy_transfer_settings')
        .doc(settingsId)
        .update(settingsData);

      return NextResponse.json({
        success: true,
        message: 'Transfer settings updated successfully',
        settings_id: settingsId,
        settings: settingsData,
      });
    } else {
      // Create new
      const settingsRef = adminDb.collection('fantasy_transfer_settings').doc();
      await settingsRef.set({
        id: settingsRef.id,
        ...settingsData,
        created_at: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        success: true,
        message: 'Transfer settings created successfully',
        settings_id: settingsRef.id,
        settings: settingsData,
      });
    }
  } catch (error) {
    console.error('Error saving transfer settings:', error);
    return NextResponse.json(
      { error: 'Failed to save transfer settings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
