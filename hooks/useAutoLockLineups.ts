import { useEffect, useRef } from 'react';

/**
 * Hook to automatically lock lineups when deadlines pass
 * Triggers on component mount - no cron jobs needed
 * 
 * The API endpoint will calculate the deadline from round_deadlines
 */
export function useAutoLockLineups(fixtureId?: string, _deprecated?: string) {
  const hasChecked = useRef(false);

  useEffect(() => {
    if (!fixtureId || hasChecked.current) return;

    const checkAndLock = async () => {
      try {
        // Trigger auto-lock check for this specific fixture
        // The API will determine if the deadline has passed
        const response = await fetch('/api/lineups/auto-lock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fixture_id: fixtureId })
        });
        
        const data = await response.json();
        if (data.locked) {
          console.log('🔒 Lineups auto-locked:', data);
        }
      } catch (err) {
        console.error('Auto-lock check failed:', err);
      }
    };

    checkAndLock();
    hasChecked.current = true;
  }, [fixtureId]);
}
