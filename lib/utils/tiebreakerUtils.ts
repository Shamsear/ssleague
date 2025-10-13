/**
 * Tiebreaker Utility Functions
 * Helper functions for formatting, calculations, and status management
 */

import { TiebreakerStatus } from '@/types/tiebreaker';

/**
 * Format currency amount with £ symbol
 */
export function formatCurrency(amount: number): string {
  return `£${amount.toLocaleString()}`;
}

/**
 * Format time remaining from max_end_time
 */
export function calculateTimeRemaining(maxEndTime: string | null): {
  text: string;
  isExpired: boolean;
  percentage: number;
} {
  if (!maxEndTime) {
    return { text: 'No limit', isExpired: false, percentage: 100 };
  }

  const now = new Date();
  const maxEnd = new Date(maxEndTime);
  const diffMs = maxEnd.getTime() - now.getTime();

  if (diffMs <= 0) {
    return { text: 'EXPIRED', isExpired: true, percentage: 0 };
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  // Calculate percentage (24 hours = 100%)
  const totalMs = 24 * 60 * 60 * 1000;
  const percentage = Math.min(100, Math.max(0, (diffMs / totalMs) * 100));

  let text = '';
  if (hours > 0) {
    text = `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    text = `${minutes}m ${seconds}s`;
  } else {
    text = `${seconds}s`;
  }

  return { text, isExpired: false, percentage };
}

/**
 * Get status badge color and label
 */
export function getStatusBadge(status: TiebreakerStatus): {
  color: string;
  label: string;
  bgColor: string;
} {
  switch (status) {
    case 'pending':
      return { color: 'text-gray-700', label: 'Pending', bgColor: 'bg-gray-200' };
    case 'active':
      return { color: 'text-green-700', label: 'Active', bgColor: 'bg-green-100' };
    case 'completed':
      return { color: 'text-blue-700', label: 'Completed', bgColor: 'bg-blue-100' };
    case 'cancelled':
      return { color: 'text-red-700', label: 'Cancelled', bgColor: 'bg-red-100' };
    case 'auto_finalize_pending':
      return { color: 'text-yellow-700', label: 'Finalizing', bgColor: 'bg-yellow-100' };
    default:
      return { color: 'text-gray-700', label: 'Unknown', bgColor: 'bg-gray-200' };
  }
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) return 'Unknown';

  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now.getTime() - past.getTime();

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  if (seconds > 0) return `${seconds}s ago`;
  return 'Just now';
}

/**
 * Format date and time
 */
export function formatDateTime(timestamp: string | null): string {
  if (!timestamp) return 'N/A';
  
  const date = new Date(timestamp);
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get minimum bid amount (current highest + 1)
 */
export function getMinimumBid(currentHighestBid: number): number {
  return currentHighestBid + 1;
}

/**
 * Validate bid amount
 */
export function validateBidAmount(
  bidAmount: number,
  currentHighestBid: number,
  balance: number
): { valid: boolean; error?: string } {
  if (!bidAmount || bidAmount <= 0) {
    return { valid: false, error: 'Bid amount must be greater than 0' };
  }

  if (bidAmount <= currentHighestBid) {
    return {
      valid: false,
      error: `Bid must be higher than ${formatCurrency(currentHighestBid)}`,
    };
  }

  if (bidAmount > balance) {
    return {
      valid: false,
      error: `Insufficient balance. You have ${formatCurrency(balance)}`,
    };
  }

  return { valid: true };
}

/**
 * Get urgency level based on time remaining
 */
export function getUrgencyLevel(timeRemaining: string | null): 'low' | 'medium' | 'high' | 'critical' {
  if (!timeRemaining) return 'low';

  const hours = parseInt(timeRemaining.split('h')[0]);
  
  if (isNaN(hours)) {
    // If it's in minutes or seconds
    if (timeRemaining.includes('m')) {
      const minutes = parseInt(timeRemaining.split('m')[0]);
      if (minutes < 5) return 'critical';
      if (minutes < 30) return 'high';
    }
    return 'high';
  }

  if (hours < 1) return 'critical';
  if (hours < 6) return 'high';
  if (hours < 12) return 'medium';
  return 'low';
}

/**
 * Get urgency color
 */
export function getUrgencyColor(urgency: 'low' | 'medium' | 'high' | 'critical'): string {
  switch (urgency) {
    case 'critical':
      return 'text-red-600';
    case 'high':
      return 'text-orange-600';
    case 'medium':
      return 'text-yellow-600';
    case 'low':
      return 'text-green-600';
  }
}

/**
 * Get position badge color
 */
export function getPositionColor(position: string): string {
  const pos = position.toUpperCase();
  
  switch (pos) {
    case 'GKP':
      return 'bg-yellow-100 text-yellow-800';
    case 'DEF':
      return 'bg-blue-100 text-blue-800';
    case 'MID':
      return 'bg-green-100 text-green-800';
    case 'FWD':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Sort tiebreakers by urgency (active first, then by time remaining)
 */
export function sortTiebreakersByUrgency<T extends { status: TiebreakerStatus; time_remaining: string | null }>(
  tiebreakers: T[]
): T[] {
  return [...tiebreakers].sort((a, b) => {
    // Active tiebreakers first
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (a.status !== 'active' && b.status === 'active') return 1;

    // Within active, sort by time remaining
    if (a.status === 'active' && b.status === 'active') {
      const urgencyA = getUrgencyLevel(a.time_remaining);
      const urgencyB = getUrgencyLevel(b.time_remaining);
      
      const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return urgencyOrder[urgencyA] - urgencyOrder[urgencyB];
    }

    return 0;
  });
}

/**
 * Get action text for team status
 */
export function getActionText(
  youAreHighest: boolean,
  canBid: boolean,
  canWithdraw: boolean,
  status: TiebreakerStatus
): string {
  if (status !== 'active') {
    return 'Tiebreaker not active';
  }

  if (youAreHighest) {
    return 'You are the highest bidder! (Cannot withdraw)';
  }

  if (canBid && canWithdraw) {
    return 'You can bid higher or withdraw';
  }

  if (canBid) {
    return 'You can place a bid';
  }

  if (canWithdraw) {
    return 'You can withdraw';
  }

  return 'No actions available';
}

/**
 * Calculate bid increment suggestions
 */
export function getBidSuggestions(currentHighestBid: number): number[] {
  const base = getMinimumBid(currentHighestBid);
  return [
    base,
    base + 5,
    base + 10,
    base + 20,
    base + 50,
  ];
}

/**
 * Check if countdown needs urgent styling
 */
export function isCountdownUrgent(timeRemaining: string | null): boolean {
  const urgency = getUrgencyLevel(timeRemaining);
  return urgency === 'critical' || urgency === 'high';
}
