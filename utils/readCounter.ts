// Firestore Read Counter Utility
// Tracks and monitors daily Firestore read usage

const READ_COUNT_KEY = 'firestore_daily_reads';
const READ_DATE_KEY = 'firestore_read_date';
const DAILY_LIMIT = 50000;
const WARNING_THRESHOLD = 40000;

/**
 * Get current read count for today
 */
export function getReadCount(): number {
  if (typeof window === 'undefined') return 0;
  
  const today = new Date().toDateString();
  const savedDate = localStorage.getItem(READ_DATE_KEY);
  
  // Reset counter if it's a new day
  if (savedDate !== today) {
    localStorage.setItem(READ_DATE_KEY, today);
    localStorage.setItem(READ_COUNT_KEY, '0');
    return 0;
  }
  
  const count = localStorage.getItem(READ_COUNT_KEY);
  return count ? parseInt(count, 10) : 0;
}

/**
 * Increment read count
 * @param count Number of reads to add (default: 1)
 */
export function incrementReadCount(count: number = 1): number {
  if (typeof window === 'undefined') return 0;
  
  const currentCount = getReadCount();
  const newCount = currentCount + count;
  
  localStorage.setItem(READ_COUNT_KEY, newCount.toString());
  
  // Log to console
  console.log(`📊 Firestore reads today: ${newCount.toLocaleString()} / ${DAILY_LIMIT.toLocaleString()}`);
  
  // Show warnings
  if (newCount >= DAILY_LIMIT) {
    console.error(`🚨 DAILY READ LIMIT EXCEEDED! (${newCount.toLocaleString()} / ${DAILY_LIMIT.toLocaleString()})`);
  } else if (newCount >= WARNING_THRESHOLD) {
    console.warn(`⚠️ Approaching daily read limit! (${newCount.toLocaleString()} / ${DAILY_LIMIT.toLocaleString()})`);
  }
  
  return newCount;
}

/**
 * Reset read count (for testing or manual reset)
 */
export function resetReadCount(): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem(READ_COUNT_KEY, '0');
  localStorage.setItem(READ_DATE_KEY, new Date().toDateString());
  console.log('✅ Read counter reset');
}

/**
 * Get read statistics
 */
export function getReadStats(): {
  current: number;
  limit: number;
  percentage: number;
  remaining: number;
  isNearLimit: boolean;
  isOverLimit: boolean;
} {
  const current = getReadCount();
  const remaining = Math.max(0, DAILY_LIMIT - current);
  const percentage = (current / DAILY_LIMIT) * 100;
  
  return {
    current,
    limit: DAILY_LIMIT,
    percentage: Math.min(100, percentage),
    remaining,
    isNearLimit: current >= WARNING_THRESHOLD,
    isOverLimit: current >= DAILY_LIMIT
  };
}

/**
 * Display read stats in console (for debugging)
 */
export function logReadStats(): void {
  const stats = getReadStats();
  
  console.log('📊 Firestore Read Statistics');
  console.log('─'.repeat(50));
  console.log(`Current reads: ${stats.current.toLocaleString()}`);
  console.log(`Daily limit: ${stats.limit.toLocaleString()}`);
  console.log(`Usage: ${stats.percentage.toFixed(2)}%`);
  console.log(`Remaining: ${stats.remaining.toLocaleString()}`);
  
  if (stats.isOverLimit) {
    console.log('Status: 🚨 OVER LIMIT');
  } else if (stats.isNearLimit) {
    console.log('Status: ⚠️ NEAR LIMIT');
  } else {
    console.log('Status: ✅ OK');
  }
  console.log('─'.repeat(50));
}

/**
 * Show read counter badge in UI (optional)
 */
export function createReadCounterBadge(): HTMLElement | null {
  if (typeof window === 'undefined') return null;
  
  const stats = getReadStats();
  const badge = document.createElement('div');
  
  badge.id = 'firestore-read-counter';
  badge.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${stats.isOverLimit ? '#dc3545' : stats.isNearLimit ? '#ffc107' : '#28a745'};
    color: ${stats.isNearLimit && !stats.isOverLimit ? '#000' : '#fff'};
    padding: 10px 15px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 9999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    cursor: pointer;
  `;
  
  badge.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span>${stats.isOverLimit ? '🚨' : stats.isNearLimit ? '⚠️' : '📊'}</span>
      <div>
        <div style="font-size: 10px; opacity: 0.9;">Firestore Reads</div>
        <div>${stats.current.toLocaleString()} / ${stats.limit.toLocaleString()}</div>
      </div>
    </div>
  `;
  
  badge.onclick = () => logReadStats();
  badge.title = 'Click for details';
  
  return badge;
}

/**
 * Initialize read counter badge in DOM (call this in your app root)
 */
export function initReadCounterBadge(): void {
  if (typeof window === 'undefined') return;
  
  // Remove existing badge if any
  const existing = document.getElementById('firestore-read-counter');
  if (existing) {
    existing.remove();
  }
  
  const badge = createReadCounterBadge();
  if (badge) {
    document.body.appendChild(badge);
    
    // Update badge every 5 seconds
    setInterval(() => {
      const newBadge = createReadCounterBadge();
      if (newBadge) {
        const oldBadge = document.getElementById('firestore-read-counter');
        if (oldBadge) {
          oldBadge.replaceWith(newBadge);
        }
      }
    }, 5000);
  }
}
