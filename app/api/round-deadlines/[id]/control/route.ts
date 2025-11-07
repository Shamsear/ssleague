import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { sendNotificationToSeason } from '@/lib/notifications/send-notification';

/**
 * PATCH - Control round (restart/pause/resume)
 * 
 * Actions:
 * - restart: Updates round_start_time to NEW time (for lineup deadline calculation)
 * - pause: Sets status to 'paused', does NOT change round_start_time
 * - resume: Sets status back to 'in_progress', does NOT change round_start_time
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sql = getTournamentDb();
    const body = await request.json();
    
    const { 
      action, // 'restart', 'pause', 'resume'
      new_start_time // Required for 'restart', format: "HH:MM" (e.g., "16:00")
    } = body;

    if (!action || !['restart', 'pause', 'resume'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be: restart, pause, or resume' },
        { status: 400 }
      );
    }

    // Parse the ID (format: tournament_id_round_number_leg)
    const [tournamentId, roundNumberStr, leg] = id.split('_');
    const roundNumber = parseInt(roundNumberStr);

    console.log(`🎮 Round Control Action: ${action}`, {
      tournamentId,
      roundNumber,
      leg,
      new_start_time
    });

    if (action === 'restart') {
      // RESTART: Update round_start_time to current IST time
      // Calculate current time in IST (UTC + 5:30)
      const now = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
      const istTime = new Date(now.getTime() + istOffset);
      const hours = istTime.getUTCHours().toString().padStart(2, '0');
      const minutes = istTime.getUTCMinutes().toString().padStart(2, '0');
      const currentISTTime = `${hours}:${minutes}`;
      
      // Use provided time if valid, otherwise use current IST time
      let restartTime = currentISTTime;
      if (new_start_time) {
        if (!/^\d{2}:\d{2}$/.test(new_start_time)) {
          return NextResponse.json(
            { error: 'new_start_time must be in format HH:MM' },
            { status: 400 }
          );
        }
        restartTime = new_start_time;
      }

      console.log('🕐 Restarting round:', {
        providedTime: new_start_time,
        currentIST: currentISTTime,
        usingTime: restartTime
      });

      await sql`
        UPDATE round_deadlines
        SET 
          round_start_time = ${restartTime},
          status = 'active',
          updated_at = NOW()
        WHERE tournament_id = ${tournamentId}
          AND round_number = ${roundNumber}
          AND leg = ${leg}
      `;

      console.log(`✅ Round restarted with new start time: ${restartTime} IST`);

      // Send notification for restart
      try {
        const roundInfo = await sql`
          SELECT rd.season_id, t.name as tournament_name
          FROM round_deadlines rd
          JOIN tournaments t ON rd.tournament_id = t.id
          WHERE rd.tournament_id = ${tournamentId}
            AND rd.round_number = ${roundNumber}
            AND rd.leg = ${leg}
          LIMIT 1
        `;

        if (roundInfo.length > 0) {
          await sendNotificationToSeason(
            {
              title: `🔄 ${roundInfo[0].tournament_name} - Round ${roundNumber} Restarted`,
              body: `Round ${roundNumber} (${leg}) has been restarted at ${restartTime} IST. Lineup deadlines updated!`,
              url: `/dashboard/tournaments/${tournamentId}`,
              icon: '/logo.png',
              data: {
                type: 'round_restarted',
                tournament_id: tournamentId,
                round_number: roundNumber,
                leg,
                restart_time: restartTime
              }
            },
            roundInfo[0].season_id
          );
        }
      } catch (notifError) {
        console.error('Failed to send restart notification:', notifError);
      }

      return NextResponse.json({
        success: true,
        message: `Round ${roundNumber} (${leg}) restarted at ${restartTime} IST`,
        action: 'restart',
        new_start_time: restartTime,
        current_ist_time: currentISTTime,
        note: 'Lineup deadline recalculated based on restart time (IST)'
      });
    }

    if (action === 'pause') {
      // PAUSE: Just change status, keep round_start_time unchanged
      await sql`
        UPDATE round_deadlines
        SET 
          status = 'paused',
          updated_at = NOW()
        WHERE tournament_id = ${tournamentId}
          AND round_number = ${roundNumber}
          AND leg = ${leg}
      `;

      console.log(`⏸️ Round paused (round_start_time unchanged)`);

      // Send notification for pause
      try {
        const roundInfo = await sql`
          SELECT rd.season_id, t.name as tournament_name
          FROM round_deadlines rd
          JOIN tournaments t ON rd.tournament_id = t.id
          WHERE rd.tournament_id = ${tournamentId}
            AND rd.round_number = ${roundNumber}
            AND rd.leg = ${leg}
          LIMIT 1
        `;

        if (roundInfo.length > 0) {
          await sendNotificationToSeason(
            {
              title: `⏸️ ${roundInfo[0].tournament_name} - Round ${roundNumber} Paused`,
              body: `Round ${roundNumber} (${leg}) has been paused. Wait for further updates.`,
              url: `/dashboard/tournaments/${tournamentId}`,
              icon: '/logo.png',
              data: {
                type: 'round_paused',
                tournament_id: tournamentId,
                round_number: roundNumber,
                leg
              }
            },
            roundInfo[0].season_id
          );
        }
      } catch (notifError) {
        console.error('Failed to send pause notification:', notifError);
      }

      return NextResponse.json({
        success: true,
        message: `Round ${roundNumber} (${leg}) paused`,
        action: 'pause',
        note: 'Lineup deadline unchanged - based on original start time'
      });
    }

    if (action === 'resume') {
      // RESUME: Just change status back, keep round_start_time unchanged
      await sql`
        UPDATE round_deadlines
        SET 
          status = 'active',
          updated_at = NOW()
        WHERE tournament_id = ${tournamentId}
          AND round_number = ${roundNumber}
          AND leg = ${leg}
      `;

      console.log(`▶️ Round resumed (round_start_time unchanged)`);

      // Send notification for resume
      try {
        const roundInfo = await sql`
          SELECT rd.season_id, t.name as tournament_name
          FROM round_deadlines rd
          JOIN tournaments t ON rd.tournament_id = t.id
          WHERE rd.tournament_id = ${tournamentId}
            AND rd.round_number = ${roundNumber}
            AND rd.leg = ${leg}
          LIMIT 1
        `;

        if (roundInfo.length > 0) {
          await sendNotificationToSeason(
            {
              title: `▶️ ${roundInfo[0].tournament_name} - Round ${roundNumber} Resumed`,
              body: `Round ${roundNumber} (${leg}) has resumed. Continue submitting lineups!`,
              url: `/dashboard/tournaments/${tournamentId}`,
              icon: '/logo.png',
              data: {
                type: 'round_resumed',
                tournament_id: tournamentId,
                round_number: roundNumber,
                leg
              }
            },
            roundInfo[0].season_id
          );
        }
      } catch (notifError) {
        console.error('Failed to send resume notification:', notifError);
      }

      return NextResponse.json({
        success: true,
        message: `Round ${roundNumber} (${leg}) resumed`,
        action: 'resume',
        note: 'Lineup deadline unchanged - based on original start time'
      });
    }

  } catch (error: any) {
    console.error('❌ Error controlling round:', error);
    return NextResponse.json(
      { error: 'Failed to control round', details: error.message },
      { status: 500 }
    );
  }
}
