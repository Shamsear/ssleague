'use client';

import { useLineupDeadlineMonitor } from '@/hooks/useLineupDeadlineMonitor';
import { useEffect, useState } from 'react';

interface LineupDeadlineMonitorProps {
  seasonId: string;
  roundNumber: number;
  leg?: string;
  scheduledDate: string;
  awayDeadlineTime: string;
}

/**
 * Component to monitor lineup deadline and auto-populate lineups for teams with 5 players
 * Shows a countdown timer and triggers auto-population when deadline is reached
 */
export default function LineupDeadlineMonitor({
  seasonId,
  roundNumber,
  leg = 'first',
  scheduledDate,
  awayDeadlineTime
}: LineupDeadlineMonitorProps) {
  const [awayDeadline, setAwayDeadline] = useState<Date | null>(null);

  useEffect(() => {
    // Create deadline in IST timezone
    // scheduledDate is in format "YYYY-MM-DD" and awayDeadlineTime is in format "HH:MM"
    
    // Ensure scheduledDate is in YYYY-MM-DD format
    let dateStr = scheduledDate;
    if (typeof scheduledDate === 'string') {
      if (scheduledDate.includes('T')) {
        dateStr = scheduledDate.split('T')[0];
      }
    } else {
      // If it's a Date object, convert to YYYY-MM-DD
      const d = new Date(scheduledDate);
      dateStr = d.toISOString().split('T')[0];
    }
    
    // Create the deadline string in ISO format with IST timezone offset
    const deadlineStr = `${dateStr}T${awayDeadlineTime}:00+05:30`;
    const deadline = new Date(deadlineStr);
    
    console.log('🕐 Lineup Deadline Debug:', {
      scheduledDate,
      awayDeadlineTime,
      dateStr,
      deadlineStr,
      deadline: deadline.toISOString(),
      deadlineIST: deadline.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      now: new Date().toISOString(),
      nowIST: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      timeUntilDeadline: deadline.getTime() - new Date().getTime()
    });
    
    setAwayDeadline(deadline);
  }, [scheduledDate, awayDeadlineTime]);

  const { timeRemaining, hasTriggered, formatTimeRemaining, isExpired } = useLineupDeadlineMonitor({
    seasonId,
    roundNumber,
    leg,
    awayDeadline: awayDeadline || new Date(),
    enabled: !!awayDeadline
  });

  if (!awayDeadline) return null;

  // Only show if deadline is within 24 hours or just passed
  const hoursUntilDeadline = timeRemaining / (1000 * 60 * 60);
  if (hoursUntilDeadline > 24 && !isExpired) return null;

  return (
    <div className={`rounded-lg border p-4 ${
      isExpired 
        ? 'bg-gray-50 border-gray-300' 
        : timeRemaining < 60000 
        ? 'bg-red-50 border-red-300 animate-pulse' 
        : timeRemaining < 300000
        ? 'bg-orange-50 border-orange-300'
        : 'bg-blue-50 border-blue-300'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">
            {isExpired ? '✅' : timeRemaining < 60000 ? '⏰' : '⏱️'}
          </span>
          <div>
            <h3 className="font-semibold text-gray-900">
              {isExpired ? 'Lineup Deadline Passed' : 'Lineup Deadline'}
            </h3>
            <p className="text-sm text-gray-600">
              Round {roundNumber} {leg !== 'first' && `- ${leg}`}
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <div className={`text-2xl font-bold ${
            isExpired 
              ? 'text-gray-600' 
              : timeRemaining < 60000 
              ? 'text-red-600' 
              : timeRemaining < 300000
              ? 'text-orange-600'
              : 'text-blue-600'
          }`}>
            {formatTimeRemaining()}
          </div>
          {hasTriggered && (
            <p className="text-xs text-green-600 font-medium mt-1">
              ✓ Auto-populated teams with 5 players
            </p>
          )}
        </div>
      </div>

      {!isExpired && timeRemaining < 300000 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-600">
            <span className="font-medium">Note:</span> Teams with exactly 5 players will have lineups auto-populated when deadline reaches 0
          </p>
        </div>
      )}
    </div>
  );
}
