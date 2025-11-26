'use client';

import { useAutoFinalize } from '@/hooks/useAutoFinalize';

interface Round {
  id: string;
  position: string;
  end_time: string;
  status: string;
  finalization_mode?: 'auto' | 'manual';
}

interface MultiRoundAutoFinalizeProps {
  rounds: Round[];
  onFinalizationComplete?: () => void;
}

/**
 * Component that handles auto-finalization for multiple rounds
 * Uses individual hooks for each round (up to a reasonable limit)
 */
export function MultiRoundAutoFinalize({ rounds, onFinalizationComplete }: MultiRoundAutoFinalizeProps) {
  const activeRounds = rounds.filter(r => r.status === 'active').slice(0, 10); // Limit to 10 active rounds

  // Hook for round 1
  useAutoFinalize({
    roundId: activeRounds[0]?.id || '',
    endTime: activeRounds[0]?.end_time || null,
    finalizationMode: activeRounds[0]?.finalization_mode || 'auto',
    enabled: !!activeRounds[0],
    onFinalizationComplete,
  });

  // Hook for round 2
  useAutoFinalize({
    roundId: activeRounds[1]?.id || '',
    endTime: activeRounds[1]?.end_time || null,
    finalizationMode: activeRounds[1]?.finalization_mode || 'auto',
    enabled: !!activeRounds[1],
    onFinalizationComplete,
  });

  // Hook for round 3
  useAutoFinalize({
    roundId: activeRounds[2]?.id || '',
    endTime: activeRounds[2]?.end_time || null,
    finalizationMode: activeRounds[2]?.finalization_mode || 'auto',
    enabled: !!activeRounds[2],
    onFinalizationComplete,
  });

  // Hook for round 4
  useAutoFinalize({
    roundId: activeRounds[3]?.id || '',
    endTime: activeRounds[3]?.end_time || null,
    finalizationMode: activeRounds[3]?.finalization_mode || 'auto',
    enabled: !!activeRounds[3],
    onFinalizationComplete,
  });

  // Hook for round 5
  useAutoFinalize({
    roundId: activeRounds[4]?.id || '',
    endTime: activeRounds[4]?.end_time || null,
    finalizationMode: activeRounds[4]?.finalization_mode || 'auto',
    enabled: !!activeRounds[4],
    onFinalizationComplete,
  });

  return null; // This component doesn't render anything
}
