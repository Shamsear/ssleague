/**
 * Firebase Cloud Messaging Connectivity Test
 * Tests if FCM endpoints are reachable from the user's network
 */

export interface ConnectivityTestResult {
  endpoint: string;
  status: 'success' | 'failed' | 'timeout';
  message: string;
  responseTime?: number;
}

export async function testFirebaseConnectivity(): Promise<{
  canReachFCM: boolean;
  results: ConnectivityTestResult[];
  recommendations: string[];
}> {
  const results: ConnectivityTestResult[] = [];
  const recommendations: string[] = [];

  // Test FCM endpoints
  const endpoints = [
    { url: 'https://fcm.googleapis.com', name: 'FCM API' },
    { url: 'https://fcmtoken.googleapis.com', name: 'FCM Token Service' },
    { url: 'https://firebase.googleapis.com', name: 'Firebase API' },
  ];

  for (const endpoint of endpoints) {
    const startTime = Date.now();
    try {
      // Use a simple OPTIONS request to test connectivity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(endpoint.url, {
        method: 'HEAD',
        mode: 'no-cors', // Avoid CORS issues
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      results.push({
        endpoint: endpoint.name,
        status: 'success',
        message: `✅ Reachable (${responseTime}ms)`,
        responseTime,
      });
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      if (error.name === 'AbortError') {
        results.push({
          endpoint: endpoint.name,
          status: 'timeout',
          message: '⏱️ Connection timeout (>5s) - likely blocked by firewall',
          responseTime,
        });
      } else {
        results.push({
          endpoint: endpoint.name,
          status: 'failed',
          message: `❌ ${error.message}`,
          responseTime,
        });
      }
    }
  }

  // Analyze results and provide recommendations
  const allSuccess = results.every(r => r.status === 'success');
  const anyTimeout = results.some(r => r.status === 'timeout');
  const anyFailed = results.some(r => r.status === 'failed');

  if (!allSuccess) {
    recommendations.push('🚫 Firebase Cloud Messaging endpoints are not fully reachable from your network.');
    
    if (anyTimeout || anyFailed) {
      recommendations.push('💡 This often happens on:');
      recommendations.push('  • Government or corporate networks');
      recommendations.push('  • School/university WiFi');
      recommendations.push('  • Public WiFi with restrictions');
      recommendations.push('  • VPNs or proxy servers');
      recommendations.push('  • Internet service providers with content filtering');
      recommendations.push('');
      recommendations.push('✅ Solutions:');
      recommendations.push('  1. Try from a different network (home WiFi, mobile data)');
      recommendations.push('  2. Disable VPN temporarily');
      recommendations.push('  3. Ask network administrator to whitelist:');
      recommendations.push('     - fcm.googleapis.com');
      recommendations.push('     - fcmtoken.googleapis.com');
      recommendations.push('     - firebase.googleapis.com');
      recommendations.push('  4. Try from a different device/location');
    }
  }

  // Check VAPID key
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    recommendations.push('⚠️ VAPID key is not configured in environment variables');
  }

  return {
    canReachFCM: allSuccess,
    results,
    recommendations,
  };
}

export async function logDetailedConnectivityInfo() {
  console.group('🔍 Firebase Cloud Messaging Connectivity Test');
  
  console.log('Environment:');
  console.log('  - User Agent:', navigator.userAgent);
  console.log('  - Online:', navigator.onLine);
  console.log('  - Service Worker:', 'serviceWorker' in navigator ? '✅' : '❌');
  console.log('  - Push Manager:', 'PushManager' in window ? '✅' : '❌');
  console.log('  - Notification API:', 'Notification' in window ? '✅' : '❌');
  
  if ('Notification' in window) {
    console.log('  - Notification Permission:', Notification.permission);
  }

  console.log('\nTesting FCM endpoints...');
  const test = await testFirebaseConnectivity();
  
  console.log('\nResults:');
  test.results.forEach(result => {
    console.log(`  ${result.message} - ${result.endpoint}`);
  });
  
  if (test.recommendations.length > 0) {
    console.log('\n⚠️ Recommendations:');
    test.recommendations.forEach(rec => console.log(rec));
  } else {
    console.log('\n✅ All connectivity checks passed!');
  }
  
  console.groupEnd();
  
  return test;
}
