import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { app } from './config';
import { logDetailedConnectivityInfo } from './connectivity-test';

let messaging: Messaging | null = null;

// Initialize messaging only on client side
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    messaging = getMessaging(app);
  } catch (error) {
    console.error('Failed to initialize Firebase Messaging:', error);
  }
}

/**
 * Request notification permission and get FCM token
 * @returns FCM token or null if permission denied
 */
export async function requestNotificationPermission(): Promise<string | null> {
  if (!messaging) {
    console.error('❌ Firebase Messaging not initialized');
    return null;
  }

  try {
    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.error('❌ This browser does not support notifications');
      return null;
    }
    
    // Android Chrome specific checks
    if (/Android/.test(navigator.userAgent)) {
      console.log('🤖 Android device detected');
      console.log('Current URL:', window.location.href);
      console.log('Protocol:', window.location.protocol);
      
      // Check if on HTTPS (required for notifications)
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        console.error('❌ Notifications require HTTPS. Current protocol:', window.location.protocol);
        throw new Error('Notifications require HTTPS connection');
      }
      
      console.log('✅ HTTPS check passed');
    }

    // Detect iOS Safari
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = ('standalone' in (window as any).navigator) && ((window as any).navigator.standalone);
    
    if (isIOS) {
      console.log('📱 iOS device detected');
      if (isStandalone) {
        console.log('✅ Running as PWA (home screen app)');
      } else {
        console.log('⚠️ Running in Safari browser (not PWA)');
      }
    }

    // Check if service worker is registered
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      console.error('❌ Service worker not registered. Please refresh the page.');
      return null;
    }
    console.log('✅ Service worker registered:', registration.scope);

    // Request permission
    console.log('📢 Requesting notification permission...');
    const permission = await Notification.requestPermission();
    console.log('Permission result:', permission);
    
    if (permission !== 'granted') {
      console.log('❌ Notification permission denied by user');
      return null;
    }

    console.log('✅ Notification permission granted');

    // Check VAPID key
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.error('❌ VAPID key not configured in environment variables');
      throw new Error('VAPID key missing');
    }
    console.log('✅ VAPID key found:', vapidKey.substring(0, 20) + '...');

    // Get registration token
    console.log('🔑 Requesting FCM token...');
    
    // For iOS, we might need to wait a bit for service worker to be fully ready
    if (isIOS) {
      console.log('⏳ Waiting for iOS service worker to be ready...');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const token = await getToken(messaging, {
      vapidKey: vapidKey,
      serviceWorkerRegistration: registration
    });

    if (token) {
      console.log('✅ FCM Token obtained:', token.substring(0, 20) + '...');
      return token;
    } else {
      console.error('❌ No registration token available. Check Firebase config.');
      return null;
    }
  } catch (error: any) {
    console.error('❌ Error getting notification permission:', error);
    console.error('Error details:', error.message, error.code);
    console.error('Error name:', error.name);
    console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    
    // If it's an AbortError or push service error, run connectivity test
    if (error.name === 'AbortError' || error.message?.includes('push service') || error.message?.includes('registration failed')) {
      console.error('❌❌❌ PUSH SERVICE ERROR DETECTED - Running connectivity diagnostics...');
      console.error('');
      
      try {
        await logDetailedConnectivityInfo();
      } catch (testError) {
        console.error('Failed to run connectivity test:', testError);
      }
    }
    
    // iOS-specific error handling
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      console.error('📱 iOS Error - Common issues:');
      console.error('1. Make sure you added the app to home screen');
      console.error('2. iOS 16.4+ is required for web push');
      console.error('3. Service worker scope might be incorrect');
      console.error('4. Try closing and reopening the PWA');
    }
    
    // Android-specific error handling
    if (/Android/.test(navigator.userAgent)) {
      console.error('🤖 Android Error - Common issues:');
      console.error('1. Check if site is on HTTPS (required for notifications)');
      console.error('2. Check if Firebase config is correct');
      console.error('3. Check if VAPID key matches Firebase console');
      console.error('4. Try clearing site data and refreshing');
      console.error('5. Make sure service worker is active:', await navigator.serviceWorker.getRegistration());
    }
    
    throw error; // Re-throw so the UI can catch and display it
  }
}

/**
 * Listen for foreground messages (when app is open)
 * @param callback Function to handle incoming messages
 */
export function onForegroundMessage(callback: (payload: any) => void) {
  if (!messaging) {
    console.warn('Firebase Messaging not available');
    return;
  }

  onMessage(messaging, (payload) => {
    console.log('Foreground message received:', payload);
    callback(payload);
    
    // Show notification even when app is in foreground
    if (payload.notification) {
      const { title, body, icon } = payload.notification;
      new Notification(title || 'Notification', {
        body: body || '',
        icon: icon || '/logo.png',
        badge: '/badge.png',
        tag: payload.data?.tag || 'notification'
      });
    }
  });
}

/**
 * Check if notifications are supported and permission is granted
 */
export function isNotificationSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission | null {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }
  return Notification.permission;
}
