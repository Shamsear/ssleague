// Service Worker for Firebase Cloud Messaging
// This handles push notifications when the browser/tab is closed

// Import Firebase scripts for service worker (compat version)
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
// Replace with your actual Firebase config values
firebase.initializeApp({
  apiKey: "AIzaSyCERFgJcwl0gHFQXhTPMavt26q0RaKDHF8",
  authDomain: "eaguedemo.firebaseapp.com",
  projectId: "eaguedemo",
  storageBucket: "eaguedemo.firebasestorage.app",
  messagingSenderId: "811342007569",
  appId: "1:811342007569:web:c1b78c0c5b336f989450b0"
});

// Get Firebase Messaging instance
const messaging = firebase.messaging();

// Handle background messages (when app is closed or in background)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message received:', payload);
  
  // Customize notification here
  const notificationTitle = payload.notification?.title || 'SS League Notification';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: payload.notification?.icon || '/logo.png',
    badge: '/badge.png',
    tag: payload.data?.tag || 'notification',
    data: {
      url: payload.data?.url || '/',
      ...payload.data
    },
    // Actions for interactive notifications
    actions: payload.data?.actions ? JSON.parse(payload.data.actions) : []
  };

  // Show notification
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);
  
  event.notification.close();
  
  // Get the URL to open (default to home page)
  const urlToOpen = event.notification.data?.url || '/';
  
  // Check if action button was clicked
  if (event.action) {
    console.log('[firebase-messaging-sw.js] Action clicked:', event.action);
    // Handle specific action clicks here
  }
  
  // Open or focus window
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Log service worker installation
self.addEventListener('install', (event) => {
  console.log('[firebase-messaging-sw.js] Service worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[firebase-messaging-sw.js] Service worker activated');
  event.waitUntil(clients.claim());
});
