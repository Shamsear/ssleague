import { useEffect, useRef, useState } from 'react';

interface DeadlineMonitorProps {
  seasonId: string;
  roundNumber: number;
  leg?: string;
  awayDeadline: Date;
  enabled?: boolean;
}

/**
 * Hook to monitor lineup deadline and trigger auto-population when timer reaches 0
 * Similar to auction round timer behavior
 */
export function useLineupDeadlineMonitor({
  seasonId,
  roundNumber,
  leg = 'first',
  awayDeadline,
  enabled = true
}: DeadlineMonitorProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [hasTriggered, setHasTriggered] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled || !awayDeadline) return;

    const updateTimer = () => {
      const now = new Date();
      const remaining = awayDeadline.getTime() - now.getTime();
      
      setTimeRemaining(Math.max(0, remaining));

      // When timer reaches 0, trigger auto-population
      if (remaining <= 0 && !hasTriggered) {
        console.log('⏰ Lineup deadline reached! Triggering auto-population...');
        triggerAutoPopulation();
        setHasTriggered(true);
      }
    };

    // Update immediately
    updateTimer();

    // Then update every second
    intervalRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [seasonId, roundNumber, leg, awayDeadline, enabled, hasTriggered]);

  const triggerAutoPopulation = async () => {
    try {
      console.log(`🤖 Auto-populating lineups for Season ${seasonId}, Round ${roundNumber}`);
      
      const response = await fetch('/api/lineups/auto-populate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_id: seasonId,
          round_number: roundNumber,
          leg: leg
        })
      });

      const data = await response.json();

      if (data.success) {
        console.log(`✅ Auto-populated ${data.auto_populated} lineup(s)`);
        
        // Show notification to user
        if (data.auto_populated > 0 && typeof window !== 'undefined') {
          // You can add a toast notification here
          console.log(`📢 ${data.auto_populated} team(s) with 5 players had lineups auto-populated`);
        }
      } else {
        console.error('❌ Auto-population failed:', data.error);
      }
    } catch (error) {
      console.error('❌ Error triggering auto-population:', error);
    }
  };

  const formatTimeRemaining = () => {
    if (timeRemaining <= 0) return 'Deadline passed';

    const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return {
    timeRemaining,
    hasTriggered,
    formatTimeRemaining,
    isExpired: timeRemaining <= 0
  };
}
