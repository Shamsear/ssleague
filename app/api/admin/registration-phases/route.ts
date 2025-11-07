import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { triggerNewsGeneration } from '@/lib/news/trigger';
import { sendNotificationToSeason } from '@/lib/notifications/send-notification';

/**
 * POST /api/admin/registration-phases
 * Manage registration phases: adjust confirmed slots, enable Phase 2, etc.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { season_id, action, confirmed_slots_limit } = body;

    if (!season_id || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: season_id and action' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();
    const seasonRef = adminDb.collection('seasons').doc(season_id);
    const seasonDoc = await seasonRef.get();

    if (!seasonDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Season not found' },
        { status: 404 }
      );
    }

    const seasonData = seasonDoc.data()!;

    // Handle different actions
    switch (action) {
      case 'set_confirmed_slots': {
        if (typeof confirmed_slots_limit !== 'number' || confirmed_slots_limit < 0) {
          return NextResponse.json(
            { success: false, error: 'Invalid confirmed_slots_limit' },
            { status: 400 }
          );
        }

        const currentFilled = seasonData.confirmed_slots_filled || 0;
        const currentLimit = seasonData.confirmed_slots_limit || 0;

        // Update the limit
        await seasonRef.update({
          confirmed_slots_limit,
          updated_at: new Date(),
        });

        // If increasing limit, auto-promote unconfirmed players
        let promoted = 0;
        if (confirmed_slots_limit > currentLimit) {
          const slotsToFill = Math.min(
            confirmed_slots_limit - currentFilled,
            confirmed_slots_limit - currentLimit
          );

          if (slotsToFill > 0) {
            // Get unconfirmed players sorted by registration_date
            const unconfirmedPlayers = await sql`
              SELECT id, player_id, player_name, registration_date
              FROM player_seasons
              WHERE season_id = ${season_id}
                AND registration_type = 'unconfirmed'
              ORDER BY registration_date ASC
              LIMIT ${slotsToFill}
            `;

            // Promote them to confirmed
            for (const player of unconfirmedPlayers) {
              await sql`
                UPDATE player_seasons
                SET registration_type = 'confirmed',
                    updated_at = NOW()
                WHERE id = ${player.id}
              `;
              promoted++;
            }

            // Update confirmed_slots_filled counter
            await seasonRef.update({
              confirmed_slots_filled: currentFilled + promoted,
            });
          }
        }

        return NextResponse.json({
          success: true,
          message: `Confirmed slots limit set to ${confirmed_slots_limit}. Promoted ${promoted} players.`,
          data: {
            new_limit: confirmed_slots_limit,
            promoted_count: promoted,
          },
        });
      }

      case 'enable_phase2': {
        // Enable unconfirmed registration (Phase 2)
        await seasonRef.update({
          registration_phase: 'unconfirmed',
          unconfirmed_registration_enabled: true,
          is_player_registration_open: true, // Re-open registration link for Phase 2
          updated_at: new Date(),
        });

        // Trigger news for phase change
        triggerNewsGeneration({
          event_type: 'registration_phase_change',
          category: 'registration',
          season_id: season_id,
          season_name: seasonData?.name || season_id,
          metadata: {
            phase_from: 'confirmed',
            phase_to: 'unconfirmed',
          },
        }).catch(err => console.error('News generation failed:', err));

        // Send FCM notification to all teams
        try {
          await sendNotificationToSeason(
            {
              title: '📢 Phase 2 Registration Open!',
              body: `Unconfirmed registration is now open for ${seasonData?.name || season_id}. Register now!`,
              url: `/seasons/${season_id}/register`,
              icon: '/logo.png',
              data: {
                type: 'registration_phase_2',
                season_id,
                phase: 'unconfirmed',
              }
            },
            season_id
          );
        } catch (notifError) {
          console.error('Failed to send phase 2 notification:', notifError);
        }

        return NextResponse.json({
          success: true,
          message: 'Phase 2 (Unconfirmed Registration) enabled successfully',
        });
      }

      case 'pause_registration': {
        // Pause all registration
        await seasonRef.update({
          registration_phase: 'paused',
          updated_at: new Date(),
        });

        return NextResponse.json({
          success: true,
          message: 'Registration paused successfully',
        });
      }

      case 'close_registration': {
        const previousPhase = seasonData.registration_phase || 'confirmed';
        
        // Close registration completely
        await seasonRef.update({
          registration_phase: 'closed',
          is_player_registration_open: false,
          updated_at: new Date(),
        });

        // Trigger news for phase change
        triggerNewsGeneration({
          event_type: 'registration_phase_change',
          category: 'registration',
          season_id: season_id,
          season_name: seasonData?.name || season_id,
          metadata: {
            phase_from: previousPhase,
            phase_to: 'closed',
          },
        }).catch(err => console.error('News generation failed:', err));

        // Send FCM notification to all teams
        try {
          await sendNotificationToSeason(
            {
              title: '🚫 Registration Closed',
              body: `Registration for ${seasonData?.name || season_id} is now closed. Get ready for the season!`,
              url: `/dashboard/team`,
              icon: '/logo.png',
              data: {
                type: 'registration_closed',
                season_id,
                phase: 'closed',
              }
            },
            season_id
          );
        } catch (notifError) {
          console.error('Failed to send registration closed notification:', notifError);
        }

        return NextResponse.json({
          success: true,
          message: 'Registration closed successfully',
        });
      }

      case 'reopen_confirmed': {
        // Reopen for confirmed registration (Phase 1)
        await seasonRef.update({
          registration_phase: 'confirmed',
          unconfirmed_registration_enabled: false,
          is_player_registration_open: true,
          updated_at: new Date(),
        });

        return NextResponse.json({
          success: true,
          message: 'Registration reopened for confirmed slots',
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Error managing registration phases:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to manage registration phases',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/registration-phases?season_id=XXX
 * Get registration phase status and statistics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const season_id = searchParams.get('season_id');

    if (!season_id) {
      return NextResponse.json(
        { success: false, error: 'Missing season_id parameter' },
        { status: 400 }
      );
    }

    const sql = getTournamentDb();
    const seasonDoc = await adminDb.collection('seasons').doc(season_id).get();

    if (!seasonDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Season not found' },
        { status: 404 }
      );
    }

    const seasonData = seasonDoc.data()!;

    // Get registration counts
    const confirmedCount = await sql`
      SELECT COUNT(*) as count
      FROM player_seasons
      WHERE season_id = ${season_id}
        AND registration_type = 'confirmed'
    `;

    const unconfirmedCount = await sql`
      SELECT COUNT(*) as count
      FROM player_seasons
      WHERE season_id = ${season_id}
        AND registration_type = 'unconfirmed'
    `;

    return NextResponse.json({
      success: true,
      data: {
        registration_phase: seasonData.registration_phase || 'confirmed',
        confirmed_slots_limit: seasonData.confirmed_slots_limit || 999,
        confirmed_slots_filled: confirmedCount[0]?.count || 0,
        unconfirmed_registration_enabled: seasonData.unconfirmed_registration_enabled || false,
        confirmed_registrations: Number(confirmedCount[0]?.count || 0),
        unconfirmed_registrations: Number(unconfirmedCount[0]?.count || 0),
        total_registrations: Number(confirmedCount[0]?.count || 0) + Number(unconfirmedCount[0]?.count || 0),
      },
    });
  } catch (error: any) {
    console.error('Error fetching registration phase status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch registration phase status',
      },
      { status: 500 }
    );
  }
}
