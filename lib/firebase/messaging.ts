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
    console.warn('Firebase Messaging not available');
    return null;
  }

  try {
    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return null;
    }

    // Request permission
    const permission = await Notification.requestPermission();
    
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    console.log('Notification permission granted');

    // Get registration token
    // NOTE: You need to add your VAPID key in Firebase Console
    // Go to: Project Settings > Cloud Messaging > Web Push certificates
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
    });

    if (token) {
      console.log('FCM Token obtained:', token);
      return token;
    } else {
      console.log('No registration token available');
      return null;
    }
  } catch (error) {
    console.error('Error getting notification permission:', error);
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
