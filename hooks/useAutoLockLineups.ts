import { useEffect, useRef } from 'react';

/**
 * Hook to automatically lock lineups when deadlines pass
 * Triggers on component mount - no cron jobs needed
 */
export function useAutoLockLineups(fixtureId?: string, deadline?: string) {
  const hasChecked = useRef(false);

  useEffect(() => {
    if (!deadline || hasChecked.current) return;

    const checkAndLock = async () => {
      const now = new Date();
      const deadlineDate = new Date(deadline);

      // Check if deadline has passed
      if (now > deadlineDate) {
        try {
          // Trigger auto-lock for this specific fixture
          await fetch('/api/lineups/auto-lock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fixture_id: fixtureId })
          });
        } catch (err) {
          console.error('Auto-lock check failed:', err);
        }
      }
    };

    checkAndLock();
    hasChecked.current = true;
  }, [fixtureId, deadline]);
}
