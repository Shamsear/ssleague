import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { app } from './config';

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

    // Check if service worker is registered
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      console.error('❌ Service worker not registered. Please refresh the page.');
      return null;
    }
    console.log('✅ Service worker registered');

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
    return null;
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
