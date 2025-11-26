import { useEffect, useRef, useState } from 'react';
import { fetchWithTokenRefresh, refreshAuthToken } from '@/lib/token-refresh';

interface UseAutoFinalizeOptions {
  roundId: string;
  endTime: string | null;
  finalizationMode?: 'auto' | 'manual';
  enabled?: boolean;
  onFinalizationStart?: () => void;
  onFinalizationComplete?: () => void;
  onFinalizationError?: (error: string) => void;
}

/**
 * Auto-finalize hook - triggers finalization API when round timer reaches zero
 * No cron jobs, no lazy evaluation - client-side timer triggers the API
 */
export function useAutoFinalize({
  roundId,
  endTime,
  finalizationMode = 'auto',
  enabled = true,
  onFinalizationStart,
  onFinalizationComplete,
  onFinalizationError,
}: UseAutoFinalizeOptions) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);
  const timerRef = useRef<NodeJS.Timeout>();

  // Calculate time remaining
  useEffect(() => {
    if (!enabled || !endTime || hasTriggered) return;

    const calculateTimeRemaining = () => {
      const end = new Date(endTime).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((end - now) / 1000));
      setTimeRemaining(remaining);
      return remaining;
    };

    // Initial calculation
    const remaining = calculateTimeRemaining();

    // Set up interval to update every second
    timerRef.current = setInterval(() => {
      const newRemaining = calculateTimeRemaining();
      
      // When timer reaches zero, trigger finalization
      if (newRemaining === 0 && !hasTriggered && !isFinalizing) {
        triggerFinalization();
      }
    }, 1000);

    // Cleanup
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [endTime, enabled, hasTriggered, isFinalizing]);

  const triggerFinalization = async () => {
    if (hasTriggered || isFinalizing) return;

    setIsFinalizing(true);
    setHasTriggered(true);

    onFinalizationStart?.();

    try {
      // Check finalization mode
      if (finalizationMode === 'manual') {
        // Manual finalization - just mark as expired and let committee handle it
        console.log('⏰ Time reached! Round has manual finalization - marking as expired:', roundId);
        
        await fetch(`/api/rounds/${roundId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'expired' }),
        });
        
        console.log('✅ Round marked as expired. Committee can now preview and finalize manually.');
        onFinalizationComplete?.(); // Refresh to show expired status
        return;
      }

      // Auto finalization mode - trigger finalization API
      console.log('⏰ Time reached! Auto-triggering finalization for round:', roundId);
      
      // Proactively refresh token to avoid 401 errors
      console.log('🔄 Refreshing auth token before finalization...');
      await refreshAuthToken();
      
      // Use fetchWithTokenRefresh to include authentication
      const response = await fetchWithTokenRefresh(`/api/admin/rounds/${roundId}/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Auto-finalization completed successfully');
        onFinalizationComplete?.();
      } else if (data.tieDetected) {
        // Tiebreaker detected - round status already changed to 'finalizing' by the API
        console.log('⚠️ Tie detected during finalization. Tiebreaker created:', data.tiebreakerId);
        console.log('Teams must submit new bids to resolve the tie.');
        onFinalizationComplete?.(); // Refresh the page to show updated status
      } else {
        console.error('❌ Auto-finalization failed:', data.error || data.message);
        // Even if finalization fails, mark the round as expired
        try {
          await fetch(`/api/rounds/${roundId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'expired' }),
          });
          console.log('⏰ Round marked as expired due to finalization failure');
          onFinalizationComplete?.(); // Refresh to show expired status
        } catch (err) {
          console.error('Failed to mark round as expired:', err);
        }
        onFinalizationError?.(data.error || data.message || 'Finalization failed');
      }
    } catch (error) {
      console.error('❌ Auto-finalization error:', error);
      // Mark round as expired if finalization crashes
      try {
        await fetch(`/api/rounds/${roundId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'expired' }),
        });
        console.log('⏰ Round marked as expired due to error');
        onFinalizationComplete?.(); // Refresh to show expired status
      } catch (err) {
        console.error('Failed to mark round as expired:', err);
      }
      onFinalizationError?.(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsFinalizing(false);
    }
  };

  return {
    timeRemaining,
    isFinalizing,
    hasTriggered,
  };
}
