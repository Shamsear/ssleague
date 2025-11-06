/**
 * Device detection utilities for push notifications
 * Extracts device info from User-Agent string
 */

export interface DeviceInfo {
  deviceName: string;
  deviceType: 'mobile' | 'desktop' | 'tablet';
  browser: string;
  os: string;
}

/**
 * Detect device information from User-Agent
 */
export function detectDevice(userAgent: string): DeviceInfo {
  const ua = userAgent.toLowerCase();
  
  // Detect OS
  let os = 'Unknown';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os x')) os = 'macOS';
  else if (ua.includes('iphone')) os = 'iOS';
  else if (ua.includes('ipad')) os = 'iOS';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('linux')) os = 'Linux';
  
  // Detect Browser
  let browser = 'Unknown';
  if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('chrome/')) browser = 'Chrome';
  else if (ua.includes('firefox/')) browser = 'Firefox';
  else if (ua.includes('safari/') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('opera') || ua.includes('opr/')) browser = 'Opera';
  
  // Detect Device Type
  let deviceType: 'mobile' | 'desktop' | 'tablet' = 'desktop';
  if (ua.includes('mobile') || ua.includes('iphone') || ua.includes('android')) {
    deviceType = 'mobile';
  } else if (ua.includes('ipad') || ua.includes('tablet')) {
    deviceType = 'tablet';
  }
  
  // Generate device name
  const deviceName = generateDeviceName(browser, os, deviceType);
  
  return {
    deviceName,
    deviceType,
    browser,
    os
  };
}

/**
 * Generate a user-friendly device name
 */
function generateDeviceName(browser: string, os: string, deviceType: string): string {
  if (deviceType === 'mobile') {
    if (os === 'iOS') return 'iPhone';
    if (os === 'Android') return 'Android Phone';
    return `${os} Phone`;
  }
  
  if (deviceType === 'tablet') {
    if (os === 'iOS') return 'iPad';
    return `${os} Tablet`;
  }
  
  // Desktop
  return `${browser} on ${os}`;
}

/**
 * Get device info from request headers
 */
export function getDeviceInfoFromRequest(request: Request): DeviceInfo {
  const userAgent = request.headers.get('user-agent') || '';
  return detectDevice(userAgent);
}
