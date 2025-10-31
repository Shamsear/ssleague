/**
 * Device Fingerprinting Utility
 * Creates a unique identifier for each device/browser
 */

export interface DeviceInfo {
  fingerprint: string;
  userAgent: string;
  browserInfo: {
    platform: string;
    language: string;
    screenResolution: string;
    timezone: string;
    colorDepth: number;
    cookieEnabled: boolean;
    doNotTrack: string | null;
  };
}

/**
 * Generate a unique device fingerprint
 * Combines multiple browser properties to create a unique ID
 */
export async function generateDeviceFingerprint(): Promise<string> {
  if (typeof window === 'undefined') {
    // Server-side: return a placeholder
    return 'server-side-render';
  }

  const components: string[] = [];

  // 1. User Agent
  components.push(navigator.userAgent);

  // 2. Platform
  components.push(navigator.platform);

  // 3. Language
  components.push(navigator.language);

  // 4. Screen Resolution
  components.push(`${window.screen.width}x${window.screen.height}`);

  // 5. Color Depth
  components.push(String(window.screen.colorDepth));

  // 6. Timezone Offset
  components.push(String(new Date().getTimezoneOffset()));

  // 7. Session Storage Support
  components.push(String(!!window.sessionStorage));

  // 8. Local Storage Support
  components.push(String(!!window.localStorage));

  // 9. Indexed DB Support
  components.push(String(!!window.indexedDB));

  // 10. Cookie Enabled
  components.push(String(navigator.cookieEnabled));

  // 11. Do Not Track
  components.push(String((navigator as any).doNotTrack || 'unknown'));

  // 12. Hardware Concurrency (CPU cores)
  components.push(String(navigator.hardwareConcurrency || 'unknown'));

  // 13. Device Memory (if available)
  components.push(String((navigator as any).deviceMemory || 'unknown'));

  // 14. Touch Support
  components.push(String('ontouchstart' in window));

  // 15. Canvas Fingerprint (more unique)
  const canvasFingerprint = getCanvasFingerprint();
  components.push(canvasFingerprint);

  // Combine all components and hash
  const combined = components.join('|');
  const fingerprint = await hashString(combined);

  return fingerprint;
}

/**
 * Get canvas fingerprint (highly unique per device)
 */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return 'no-canvas';

    canvas.width = 200;
    canvas.height = 50;

    // Draw text with specific styling
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(0, 0, 140, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('SS League 🏆', 2, 2);

    // Get canvas data
    const dataURL = canvas.toDataURL();
    return dataURL.substring(0, 50); // Use first 50 chars
  } catch (e) {
    return 'canvas-error';
  }
}

/**
 * Hash a string using Web Crypto API
 */
async function hashString(str: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    // Fallback: simple hash
    return simpleHash(str);
  }

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 32); // First 32 chars
  } catch (e) {
    return simpleHash(str);
  }
}

/**
 * Simple hash fallback (for older browsers)
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get complete device information including fingerprint
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
  const fingerprint = await generateDeviceFingerprint();

  return {
    fingerprint,
    userAgent: navigator.userAgent,
    browserInfo: {
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      colorDepth: window.screen.colorDepth,
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: (navigator as any).doNotTrack || null,
    },
  };
}

/**
 * Store fingerprint in localStorage for quick access
 */
export function getCachedFingerprint(): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    return localStorage.getItem('device_fingerprint');
  } catch {
    return null;
  }
}

/**
 * Cache fingerprint in localStorage
 */
export function cacheFingerprint(fingerprint: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem('device_fingerprint', fingerprint);
  } catch (e) {
    console.warn('Failed to cache fingerprint:', e);
  }
}

/**
 * Get or generate fingerprint (with caching)
 */
export async function getFingerprint(): Promise<string> {
  // Try to get from cache first
  const cached = getCachedFingerprint();
  if (cached) return cached;

  // Generate new fingerprint
  const fingerprint = await generateDeviceFingerprint();
  cacheFingerprint(fingerprint);

  return fingerprint;
}

/**
 * Get client IP address (best effort - needs server-side help)
 */
export function getClientIP(): string | null {
  if (typeof window === 'undefined') return null;
  
  // This is approximate - actual IP should be captured server-side
  // from request headers
  return null;
}
