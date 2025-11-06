'use client';

import { useEffect } from 'react';
import { onForegroundMessage } from '@/lib/firebase/messaging';

/**
 * Component to register service worker for push notifications
 * This should be added to the root layout
 */
export default function RegisterServiceWorker() {
  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/firebase-messaging-sw.js')
        .then((registration) => {
          console.log('✅ Service Worker registered successfully:', registration.scope);
        })
        .catch((error) => {
          console.error('❌ Service Worker registration failed:', error);
        });
    } else {
      console.warn('Service Worker not supported in this browser');
    }

    // Listen for foreground messages (when app is open)
    onForegroundMessage((payload) => {
      console.log('📬 Received foreground message:', payload);
      
      // You can show a toast notification here
      // or update UI based on the notification
    });
  }, []);

  // This component doesn't render anything
  return null;
}
