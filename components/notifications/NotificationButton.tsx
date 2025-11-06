'use client';

import { useState, useEffect } from 'react';
import { requestNotificationPermission, getNotificationPermission, isNotificationSupported } from '@/lib/firebase/messaging';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface Device {
  id: number;
  deviceName: string;
  deviceType: string;
  browser: string;
  os: string;
  isActive: boolean;
  lastUsedAt: string;
}

export default function NotificationButton() {
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [showDevices, setShowDevices] = useState(false);
  const [currentDevice, setCurrentDevice] = useState<string>('');

  useEffect(() => {
    // Check if notifications are supported
    setSupported(isNotificationSupported());
    
    // Get current permission status
    if (isNotificationSupported()) {
      const currentPermission = getNotificationPermission();
      setPermission(currentPermission);
      
      // Load devices if permission granted
      if (currentPermission === 'granted') {
        // Small delay to ensure service worker and token are ready
        setTimeout(() => {
          loadDevices();
        }, 100);
      }
    }
    
    // Detect current device
    detectCurrentDevice();
  }, []);

  const detectCurrentDevice = () => {
    const ua = navigator.userAgent;
    let device = '';
    
    if (/iPhone/.test(ua)) device = 'iPhone';
    else if (/iPad/.test(ua)) device = 'iPad';
    else if (/Android/.test(ua) && /Mobile/.test(ua)) device = 'Android Phone';
    else if (/Android/.test(ua)) device = 'Android Tablet';
    else {
      const browser = /Edge\//.test(ua) ? 'Edge' :
                     /Chrome\//.test(ua) ? 'Chrome' :
                     /Firefox\//.test(ua) ? 'Firefox' :
                     /Safari\//.test(ua) ? 'Safari' : 'Browser';
      const os = /Windows/.test(ua) ? 'Windows' :
                 /Mac/.test(ua) ? 'macOS' :
                 /Linux/.test(ua) ? 'Linux' : 'Desktop';
      device = `${browser} on ${os}`;
    }
    
    setCurrentDevice(device);
  };

  const loadDevices = async () => {
    try {
      const response = await fetchWithTokenRefresh('/api/notifications/devices');
      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices || []);
      }
    } catch (error) {
      console.error('Error loading devices:', error);
    }
  };

  const handleAddCurrentDevice = async () => {
    setLoading(true);
    try {
      console.log('🔔 Adding current device to notifications...');
      
      // Check if notifications are already enabled on this browser
      const currentPermission = getNotificationPermission();
      console.log('Current notification permission:', currentPermission);
      
      let token: string | null = null;
      
      if (currentPermission === 'granted') {
        // Permission already granted, just get the token
        console.log('✅ Notification permission already granted, getting token...');
        token = await requestNotificationPermission();
      } else if (currentPermission === 'denied') {
        // Permission denied, user needs to reset in browser settings
        alert('❌ Notifications are blocked on this browser.\n\nTo enable:\n1. Click the lock icon in address bar\n2. Find "Notifications" setting\n3. Change to "Allow"\n4. Refresh the page and try again');
        return;
      } else {
        // Permission not requested yet (default state)
        console.log('💬 Requesting notification permission...');
        token = await requestNotificationPermission();
      }

      if (token) {
        console.log('✅ Token received, saving to database...');
        
        // Save token to database
        const response = await fetchWithTokenRefresh('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fcmToken: token })
        });

        if (response.ok) {
          console.log('✅ Token saved successfully!');
          
          // Reload devices to show the new one
          await loadDevices();
          
          alert(`✅ ${currentDevice} added successfully! This device will now receive notifications.`);
        } else {
          const error = await response.json();
          console.error('❌ Failed to save token:', error);
          throw new Error(error.error || 'Failed to save notification token');
        }
      } else {
        console.error('❌ No token received - check browser console for details');
        alert('❌ Failed to get notification token. Common issues:\n\n1. Service worker not loaded - try refreshing the page\n2. VAPID key not configured\n3. Network firewall blocking Firebase (common on government/corporate networks)\n4. Browser blocked notifications');
      }
    } catch (error: any) {
      console.error('❌ Error adding device:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to add this device: ';
      
      if (error.code === 'messaging/permission-blocked') {
        errorMessage += 'Permission was blocked. Please reset site permissions in browser settings.';
      } else if (error.code === 'messaging/token-subscribe-failed') {
        errorMessage += 'Failed to subscribe to push notifications. Check your internet connection.';
      } else if (error.code === 'messaging/token-subscribe-no-token') {
        errorMessage += 'Could not get notification token. Service worker might not be ready.';
      } else if (error.name === 'AbortError' || error.message?.includes('AbortError')) {
        errorMessage += 'Push service registration failed. This often happens on:\n• Government/corporate networks that block Firebase\n• VPNs or firewalls blocking fcm.googleapis.com\n• VAPID key mismatch\n\nTry from a different network (home WiFi/mobile data).';
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Unknown error occurred.';
      }
      
      errorMessage += '\n\nCheck browser console (F12) for detailed error information.';
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEnableNotifications = async () => {
    setLoading(true);
    try {
      console.log('🔔 Starting notification setup...');
      
      // Request permission and get FCM token
      const token = await requestNotificationPermission();

      if (token) {
        console.log('✅ Token received, saving to database...');
        
        // Save token to database
        const response = await fetchWithTokenRefresh('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fcmToken: token })
        });

        if (response.ok) {
          console.log('✅ Token saved successfully!');
          
          // Load devices to confirm save worked
          await loadDevices();
          
          // Update permission state AFTER devices are loaded
          // Use a small delay to ensure React state updates properly
          await new Promise(resolve => setTimeout(resolve, 100));
          setPermission('granted');
          
          alert(`✅ Notifications enabled on ${currentDevice}! You\'ll now receive updates about auctions, matches, and more.`);
        } else {
          const error = await response.json();
          console.error('❌ Failed to save token:', error);
          throw new Error(error.error || 'Failed to save notification token');
        }
      } else {
        console.error('❌ No token received - check browser console for details');
        alert('❌ Failed to enable notifications. Check the browser console (F12) for details. Common issues:\n\n1. Service worker not loaded - try refreshing the page\n2. VAPID key not configured\n3. Browser blocked notifications');
      }
    } catch (error: any) {
      console.error('❌ Error enabling notifications:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to enable notifications: ';
      
      if (error.code === 'messaging/permission-blocked') {
        errorMessage += 'Permission was blocked. Please reset site permissions in Chrome settings.';
      } else if (error.code === 'messaging/token-subscribe-failed') {
        errorMessage += 'Failed to subscribe to push notifications. Check your internet connection.';
      } else if (error.code === 'messaging/token-subscribe-no-token') {
        errorMessage += 'Could not get notification token. Service worker might not be ready.';
      } else if (error.name === 'AbortError' || error.message?.includes('AbortError') || error.message?.includes('push service error')) {
        errorMessage += 'Push service registration failed. This often happens on:\n• Government/corporate networks that block Firebase\n• VPNs or firewalls blocking fcm.googleapis.com\n• VAPID key mismatch with Firebase Console\n• Internet service provider restrictions\n\nTry from a different network (home WiFi/mobile data) or contact your network administrator.';
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Unknown error occurred.';
      }
      
      errorMessage += '\n\nDetails in browser console (3 dots menu → More tools → Developer tools → Console tab)';
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveDevice = async (deviceId: number) => {
    if (!confirm('Remove this device from notifications?')) return;
    
    try {
      const response = await fetchWithTokenRefresh(
        `/api/notifications/devices?deviceId=${deviceId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        await loadDevices();
        alert('🔕 Device removed');
      } else {
        throw new Error('Failed to remove device');
      }
    } catch (error: any) {
      console.error('Error removing device:', error);
      alert('Failed to remove device: ' + error.message);
    }
  };

  const handleResetNotifications = () => {
    if (!confirm('Reset notification settings? You will need to enable notifications again.')) return;
    
    // Clear local state
    setPermission(null);
    setDevices([]);
    setShowDevices(false);
    
    alert('✅ Notification settings reset. Click "Enable Notifications" to set up again.');
  };

  // Don't show button if notifications are not supported
  if (!supported) {
    // Check if it's iOS (but not Safari)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    if (isIOS && !isSafari) {
      return (
        <div className="px-4 py-3 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
          <p className="font-medium mb-1">📱 iOS Notifications</p>
          <p className="text-xs">
            Web notifications are only supported in Safari on iOS. Please open this site in Safari to enable notifications.
          </p>
        </div>
      );
    }
    
    // Show debug info for Android if not supported
    if (isAndroid) {
      return (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
          <p className="font-medium mb-1">🔴 Notifications Not Available</p>
          <p className="text-xs mb-2">
            Notifications should work on Android Chrome but something is missing:
          </p>
          <ul className="text-xs space-y-1 ml-4 list-disc">
            <li>Notification API: {typeof window !== 'undefined' && 'Notification' in window ? '✅' : '❌'}</li>
            <li>Service Worker: {'serviceWorker' in navigator ? '✅' : '❌'}</li>
            <li>Push Manager: {'PushManager' in window ? '✅' : '❌'}</li>
          </ul>
          <p className="text-xs mt-2">Try refreshing the page or check if you're on HTTPS.</p>
        </div>
      );
    }
    
    return null;
  }

  // Show different UI based on permission status
  if (permission === 'granted') {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDevices(!showDevices)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-100 text-green-700 hover:bg-green-200 transition-all text-sm font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          Notifications On ({devices.length})
          <svg className={`w-4 h-4 transition-transform ${showDevices ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {showDevices && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 z-50">
            {devices.length > 0 ? (
              <>
                <h4 className="text-sm font-bold text-gray-900 mb-3">Your Devices</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto mb-3">
                  {devices.map((device) => (
                    <div key={device.id} className="flex items-start justify-between gap-2 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-gray-900">{device.deviceName}</span>
                          {!device.isActive && (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] rounded">Inactive</span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {device.browser} • {device.os}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          Last used: {new Date(device.lastUsedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveDevice(device.id)}
                        className="flex-shrink-0 p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Remove device"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                
                {/* Add This Device Button */}
                <div className="pt-3 border-t border-gray-200">
                  <button
                    onClick={handleAddCurrentDevice}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Adding...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        Add This Device ({currentDevice})
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h4 className="text-sm font-bold text-gray-900 mb-2">No Devices Found</h4>
                <p className="text-xs text-gray-600 mb-3">
                  Notifications are enabled but no devices are registered. This might be due to:
                </p>
                <ul className="text-xs text-gray-600 mb-3 ml-4 list-disc space-y-1">
                  <li>Database migration not run</li>
                  <li>Token registration failed</li>
                  <li>Permission granted but setup incomplete</li>
                </ul>
                <button
                  onClick={handleResetNotifications}
                  className="w-full px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Reset & Try Again
                </button>
              </>
            )}
          </div>
        )}
      </div>
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
