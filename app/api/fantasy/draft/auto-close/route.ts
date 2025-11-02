import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

// WebSocket broadcast function
declare global {
  var wsBroadcast: ((channel: string, data: any) => void) | undefined;
}

/**
 * POST /api/fantasy/draft/auto-close
 * Automatically open/close draft based on time windows
 * - Opens draft when draft_opens_at time is reached
 * - Closes draft when draft_closes_at time is reached
 * Similar to lineup auto-lock system
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { league_id } = body;

    if (!league_id) {
      return NextResponse.json(
        { error: 'league_id is required' },
        { status: 400 }
      );
    }

    // Get league settings
    const leagues = await fantasySql`
      SELECT * FROM fantasy_leagues
      WHERE league_id = ${league_id}
      LIMIT 1
    `;

    if (leagues.length === 0) {
      return NextResponse.json(
        { error: 'Fantasy league not found' },
        { status: 404 }
      );
    }

    const league = leagues[0];
    const now = new Date();

    console.log('\n🔍 Draft Auto-Check:', {
      league_id,
      current_status: league.draft_status,
      current_time_utc: now.toISOString(),
      opens_at_utc: league.draft_opens_at,
      closes_at_utc: league.draft_closes_at,
    });

    // Auto-open: Check if draft is pending/closed and opening time has passed
    if ((league.draft_status === 'pending' || league.draft_status === 'closed') && league.draft_opens_at) {
      const openingTime = new Date(league.draft_opens_at);
      console.log('\n⏰ Checking auto-open:', {
        opening_time: openingTime.toISOString(),
        current_time: now.toISOString(),
        should_open: now >= openingTime,
        time_diff_seconds: Math.round((openingTime.getTime() - now.getTime()) / 1000),
      });
      
      if (now >= openingTime) {
        await fantasySql`
          UPDATE fantasy_leagues
          SET 
            draft_status = 'active',
            updated_at = CURRENT_TIMESTAMP
          WHERE league_id = ${league_id}
        `;

        console.log(`✅ Draft auto-opened for league ${league_id} at ${now.toISOString()}`);

        // Broadcast to WebSocket clients
        if (global.wsBroadcast) {
          global.wsBroadcast(`league:${league_id}:draft`, {
            type: 'draft_status_update',
            data: {
              league_id,
              draft_status: 'active',
              auto_opened: true,
            },
          });
          console.log(`📢 Broadcast auto-open to league:${league_id}:draft`);
        }

        return NextResponse.json({
          success: true,
          message: 'Draft automatically opened',
          status: 'active',
          opened: true,
          opened_at: now.toISOString(),
        });
      }
    }

    // Auto-close: Check if draft is active and closing time has passed
    if (league.draft_status === 'active' && league.draft_closes_at) {
      const closingTime = new Date(league.draft_closes_at);
      console.log('\n⏰ Checking auto-close:', {
        closing_time: closingTime.toISOString(),
        current_time: now.toISOString(),
        should_close: now >= closingTime,
        time_diff_seconds: Math.round((closingTime.getTime() - now.getTime()) / 1000),
      });
      
      if (now >= closingTime) {
        await fantasySql`
          UPDATE fantasy_leagues
          SET 
            draft_status = 'closed',
            updated_at = CURRENT_TIMESTAMP
          WHERE league_id = ${league_id}
        `;

        console.log(`✅ Draft auto-closed for league ${league_id} at ${now.toISOString()}`);

        // Broadcast to WebSocket clients
        if (global.wsBroadcast) {
          global.wsBroadcast(`league:${league_id}:draft`, {
            type: 'draft_status_update',
            data: {
              league_id,
              draft_status: 'closed',
              auto_closed: true,
            },
          });
          console.log(`📢 Broadcast auto-close to league:${league_id}:draft`);
        }

        return NextResponse.json({
          success: true,
          message: 'Draft automatically closed',
          status: 'closed',
          closed: true,
          closed_at: now.toISOString(),
        });
      }
    }

    // No action needed
    console.log('\n✋ No action needed - conditions not met\n');
    return NextResponse.json({
      success: true,
      message: 'No automatic status change needed',
      status: league.draft_status,
      changed: false,
    });
  } catch (error) {
    console.error('Error in draft auto-open/close:', error);
    return NextResponse.json(
      { error: 'Failed to auto-open/close draft', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
