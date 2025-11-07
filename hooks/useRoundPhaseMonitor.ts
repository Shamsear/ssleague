/**
 * Hook for monitoring round phase changes in real-time
 * Automatically updates match phases without page refresh
 */

import { useCallback, useEffect, useState } from 'react';
import { listenToSeasonRoundUpdates } from '@/lib/realtime/listeners';
import { getISTNow } from '@/lib/utils/timezone';

type Phase = 'home_fixture' | 'fixture_entry' | 'result_entry' | 'closed';

interface PhaseInfo {
  phase: Phase;
  phase_label: string;
  next_deadline?: Date;
  next_deadline_label?: string;
}

interface UseRoundPhaseMonitorOptions {
  seasonId: string;
  enabled?: boolean;
  onPhaseChange?: (roundNumber: number, newPhase: Phase) => void;
}

/**
 * Monitor round phases with WebSocket for live updates
 * Checks deadlines every minute and listens for admin-triggered phase changes
 */
export function useRoundPhaseMonitor({
  seasonId,
  enabled = true,
  onPhaseChange,
}: UseRoundPhaseMonitorOptions) {
  const [lastCheck, setLastCheck] = useState(Date.now());
  const [isConnected, setIsConnected] = useState(false);

  // Subscribe to season-level phase updates via Firebase Realtime DB
  useEffect(() => {
    if (!enabled || !seasonId) return;

    setIsConnected(true);
    const unsubscribe = listenToSeasonRoundUpdates(seasonId, (message: any) => {
      console.log('[Phase Monitor] Received update:', message);

      switch (message.type) {
        case 'phase_change':
          // Admin manually changed phase or automatic phase transition
          const { round_number, new_phase, tournament_id } = message;
          console.log(`📅 Phase changed for Round ${round_number}: ${new_phase}`);
          onPhaseChange?.(round_number, new_phase);
          
          // Trigger a re-check
          setLastCheck(Date.now());
          break;

        case 'deadline_update':
          // Deadline was updated by admin
          console.log('⏰ Deadline updated, rechecking phases');
          setLastCheck(Date.now());
          break;

        case 'round_started':
        case 'round_completed':
        case 'round_finalized':
          // Round status changed
          console.log(`📢 Round status changed: ${message.type}`);
          setLastCheck(Date.now());
          break;
      }
    });

    return () => {
      unsubscribe();
      setIsConnected(false);
    };
  }, [seasonId, enabled, onPhaseChange]);

  // Check phases every minute for deadline transitions
  useEffect(() => {
    if (!enabled) return;

    const checkInterval = setInterval(() => {
      console.log('⏰ Checking for phase transitions...');
      setLastCheck(Date.now());
    }, 60000); // Check every minute

    return () => clearInterval(checkInterval);
  }, [enabled]);

  return {
    isConnected,
    lastCheck, // Components can use this to trigger re-calculation
  };
}

/**
 * Calculate current phase based on deadlines
 */
export function calculatePhase(deadlines: {
  home_deadline?: Date;
  away_deadline?: Date;
  result_deadline?: Date;
}): PhaseInfo {
  const now = getISTNow();

  if (deadlines.home_deadline && now < deadlines.home_deadline) {
    return {
      phase: 'home_fixture',
      phase_label: 'Home Fixture Setup',
      next_deadline: deadlines.home_deadline,
      next_deadline_label: 'Home deadline',
    };
  } else if (deadlines.away_deadline && now < deadlines.away_deadline) {
    return {
      phase: 'fixture_entry',
      phase_label: 'Fixture Entry',
      next_deadline: deadlines.away_deadline,
      next_deadline_label: 'Away deadline',
    };
  } else if (deadlines.result_deadline && now < deadlines.result_deadline) {
    return {
      phase: 'result_entry',
      phase_label: 'Result Entry',
      next_deadline: deadlines.result_deadline,
      next_deadline_label: 'Result deadline',
    };
  } else {
    return {
      phase: 'closed',
      phase_label: 'Closed',
    };
  }
}
