import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';
import { triggerNews } from '@/lib/news/trigger';
import { broadcastFantasyDraftUpdate } from '@/lib/realtime/broadcast';
import { sendNotification } from '@/lib/notifications/send-notification';

/**
 * POST /api/fantasy/draft/control
 * Committee endpoint to control draft periods
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { league_id, draft_status, draft_opens_at, draft_closes_at } = body;

    console.log('🔵 Received from client:', {
      draft_opens_at,
      draft_closes_at
    });

    // Ensure PostgreSQL session uses UTC timezone
    await fantasySql`SET timezone = 'UTC'`;

    if (!league_id || !draft_status) {
      return NextResponse.json(
        { error: 'league_id and draft_status are required' },
        { status: 400 }
      );
    }

    // Validate draft_status
    if (!['pending', 'active', 'closed'].includes(draft_status)) {
      return NextResponse.json(
        { error: 'draft_status must be pending, active, or closed' },
        { status: 400 }
      );
    }

    // Update draft settings
    // Use string literals with AT TIME ZONE 'UTC' to force UTC interpretation
    const opensQuery = draft_opens_at ? `'${draft_opens_at}'::timestamp AT TIME ZONE 'UTC'` : 'NULL';
    const closesQuery = draft_closes_at ? `'${draft_closes_at}'::timestamp AT TIME ZONE 'UTC'` : 'NULL';
    
    const result = await fantasySql`
      UPDATE fantasy_leagues
      SET 
        draft_status = ${draft_status},
        draft_opens_at = ${fantasySql.unsafe(opensQuery)},
        draft_closes_at = ${fantasySql.unsafe(closesQuery)},
        updated_at = CURRENT_TIMESTAMP
      WHERE league_id = ${league_id}
      RETURNING *
    `;

    console.log('🟢 Stored in database:', {
      draft_opens_at: result[0]?.draft_opens_at,
      draft_closes_at: result[0]?.draft_closes_at
    });

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Fantasy league not found' },
        { status: 404 }
      );
    }

    console.log(`✅ Draft status updated to ${draft_status} for league ${league_id}`);

    // Trigger news generation and push notifications for draft status changes
    try {
      const leagueData = result[0];
      
      if (draft_status === 'active') {
        // Trigger news
        await triggerNews('fantasy_opened', {
          season_id: leagueData.season_id,
          season_name: leagueData.season_name,
          league_name: leagueData.league_name,
          budget_per_team: leagueData.budget_per_team,
          max_squad_size: leagueData.max_squad_size,
        });
        console.log('📰 Fantasy draft opening news triggered');
        
        // Send push notification to all users
        await sendNotification(
          {
            title: '🎮 Fantasy Draft is Now Open!',
            body: `Start building your squad for ${leagueData.league_name}! Draft closes at ${draft_closes_at ? new Date(draft_closes_at).toLocaleString() : 'TBD'}`,
            icon: '/fantasy-icon.png',
            url: '/dashboard/fantasy/draft',
          },
          { allUsers: true }
        );
        console.log('📬 Fantasy draft opening notification sent');
      } else if (draft_status === 'closed') {
        // Trigger news
        await triggerNews('fantasy_draft_complete', {
          season_id: leagueData.season_id,
          season_name: leagueData.season_name,
          league_name: leagueData.league_name,
        });
        console.log('📰 Fantasy draft completion news triggered');
        
        // Send push notification to all users
        await sendNotification(
          {
            title: '🏁 Fantasy Draft Closed',
            body: `Draft period has ended for ${leagueData.league_name}. Check your squad and prepare for the season!`,
            icon: '/fantasy-icon.png',
            url: '/dashboard/fantasy',
          },
          { allUsers: true }
        );
        console.log('📬 Fantasy draft completion notification sent');
      }
    } catch (newsError) {
      console.error('Error triggering fantasy news/notifications (non-critical):', newsError);
    }

    // Broadcast to Firebase Realtime DB
    await broadcastFantasyDraftUpdate(league_id, {
      draft_status,
      draft_opens_at: draft_opens_at || null,
      draft_closes_at: draft_closes_at || null,
    });

    return NextResponse.json({
      success: true,
      message: 'Draft settings updated successfully',
      draft_status,
      draft_opens_at: draft_opens_at || null,
      draft_closes_at: draft_closes_at || null,
    });
  } catch (error) {
    console.error('Error updating draft control:', error);
    return NextResponse.json(
      { error: 'Failed to update draft settings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
