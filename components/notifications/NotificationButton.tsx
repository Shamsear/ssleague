'use client';

import { useState, useEffect } from 'react';
import { requestNotificationPermission, getNotificationPermission, isNotificationSupported } from '@/lib/firebase/messaging';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

export default function NotificationButton() {
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    // Check if notifications are supported
    setSupported(isNotificationSupported());
    
    // Get current permission status
    if (isNotificationSupported()) {
      setPermission(getNotificationPermission());
    }
  }, []);

  const handleEnableNotifications = async () => {
    setLoading(true);
    try {
      // Request permission and get FCM token
      const token = await requestNotificationPermission();

      if (token) {
        // Save token to database
        const response = await fetchWithTokenRefresh('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fcmToken: token })
        });

        if (response.ok) {
          setPermission('granted');
          alert('✅ Notifications enabled! You\'ll now receive updates about auctions, matches, and more.');
        } else {
          const error = await response.json();
          throw new Error(error.error || 'Failed to save notification token');
        }
      } else {
        alert('❌ Notification permission denied. Please enable notifications in your browser settings.');
      }
    } catch (error: any) {
      console.error('Error enabling notifications:', error);
      alert('Failed to enable notifications: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisableNotifications = async () => {
    setLoading(true);
    try {
      const response = await fetchWithTokenRefresh('/api/notifications/subscribe', {
        method: 'DELETE'
      });

      if (response.ok) {
        setPermission('denied');
        alert('🔕 Notifications disabled');
      } else {
        throw new Error('Failed to disable notifications');
      }
    } catch (error: any) {
      console.error('Error disabling notifications:', error);
      alert('Failed to disable notifications: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Don't show button if notifications are not supported
  if (!supported) {
    return null;
  }

  // Show different UI based on permission status
  if (permission === 'granted') {
    return (
      <button
        onClick={handleDisableNotifications}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-100 text-green-700 hover:bg-green-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {loading ? 'Disabling...' : 'Notifications On'}
      </button>
    );
  }

  return (
    <button
      onClick={handleEnableNotifications}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-lg"
    >
      {loading ? (
        <>
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          Enabling...
        </>
      ) : (
        <>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          Enable Notifications
        </>
      )}
    </button>
  );
}
