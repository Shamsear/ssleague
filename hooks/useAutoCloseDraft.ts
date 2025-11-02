import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook to automatically open/close draft based on time windows
 * - Opens draft when draft_opens_at time is reached
 * - Closes draft when draft_closes_at time is reached
 * - Uses setTimeout to trigger exactly at the deadline
 * - Automatically refreshes page when status changes
 */
export function useAutoCloseDraft(leagueId?: string, opensAt?: string, closesAt?: string, onStatusChange?: () => void) {
  const openTimerRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const checkDraftStatus = useCallback(async () => {
    if (!leagueId) return;

    console.log('\n🔎 Calling auto-close API for league:', leagueId);

    try {
      // Trigger auto-open/close check for this league
      const response = await fetch('/api/fantasy/draft/auto-close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ league_id: leagueId })
      });
      
      const result = await response.json();
      console.log('📦 API Response:', result);
      
      if (result.opened || result.closed) {
        console.log('🔄 Draft status auto-updated:', result.message);
        // Always call callback if provided, otherwise do nothing (WebSocket will handle it)
        if (onStatusChange) {
          onStatusChange();
        }
      } else {
        console.log('ℹ️ No status change:', result.message);
      }
    } catch (err) {
      console.error('❌ Auto draft status check failed:', err);
    }
  }, [leagueId, onStatusChange]);

  useEffect(() => {
    if (!leagueId) return;

    const now = new Date().getTime();

    console.log('\n⏳ Setting up draft timers:', {
      league_id: leagueId,
      current_time: new Date(now).toISOString(),
      opens_at: opensAt,
      closes_at: closesAt,
    });

    // Schedule auto-open if opensAt is in the future
    if (opensAt) {
      const openTime = new Date(opensAt).getTime();
      const timeUntilOpen = openTime - now;
      
      console.log('🔓 Open time check:', {
        open_time: new Date(openTime).toISOString(),
        time_until_open_ms: timeUntilOpen,
        time_until_open_seconds: Math.round(timeUntilOpen / 1000),
        will_set_timer: timeUntilOpen > 0,
      });
      
      if (timeUntilOpen > 0) {
        console.log(`⏰ Draft will auto-open in ${Math.round(timeUntilOpen / 1000)} seconds`);
        openTimerRef.current = setTimeout(() => {
          console.log('\n⏰ Draft opening time reached, checking status...');
          checkDraftStatus();
        }, timeUntilOpen);
      } else {
        console.log('⚠️ Open time has already passed, checking immediately...');
      }
    }

    // Schedule auto-close if closesAt is in the future
    if (closesAt) {
      const closeTime = new Date(closesAt).getTime();
      const timeUntilClose = closeTime - now;
      
      console.log('🔒 Close time check:', {
        close_time: new Date(closeTime).toISOString(),
        time_until_close_ms: timeUntilClose,
        time_until_close_seconds: Math.round(timeUntilClose / 1000),
        will_set_timer: timeUntilClose > 0,
      });
      
      if (timeUntilClose > 0) {
        console.log(`⏰ Draft will auto-close in ${Math.round(timeUntilClose / 1000)} seconds`);
        closeTimerRef.current = setTimeout(() => {
          console.log('\n⏰ Draft closing time reached, checking status...');
          checkDraftStatus();
        }, timeUntilClose);
      } else {
        console.log('⚠️ Close time has already passed, checking immediately...');
      }
    }

    // Initial check for past deadlines
    console.log('\n🔍 Running initial status check...');
    checkDraftStatus();

    // Cleanup
    return () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [leagueId, opensAt, closesAt, checkDraftStatus]);
}
