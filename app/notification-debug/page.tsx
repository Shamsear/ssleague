'use client';

import { useState } from 'react';

export default function NotificationDebug() {
  const [logs, setLogs] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const emoji = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${emoji} ${message}`]);
  };

  const runDiagnostics = async () => {
    setTesting(true);
    setLogs([]);

    addLog('Starting diagnostics...');

    // 1. Check environment
    addLog(`User Agent: ${navigator.userAgent}`, 'info');
    addLog(`Current URL: ${window.location.href}`, 'info');
    addLog(`Protocol: ${window.location.protocol}`, 'info');

    // 2. Check HTTPS
    if (window.location.protocol === 'https:' || window.location.hostname === 'localhost') {
      addLog('HTTPS check passed', 'success');
    } else {
      addLog('HTTPS required! Current protocol: ' + window.location.protocol, 'error');
    }

    // 3. Check APIs
    if ('Notification' in window) {
      addLog('Notification API available', 'success');
      addLog(`Permission status: ${Notification.permission}`, 'info');
    } else {
      addLog('Notification API NOT available', 'error');
    }

    if ('serviceWorker' in navigator) {
      addLog('Service Worker API available', 'success');
      
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          addLog(`Service Worker registered at: ${registration.scope}`, 'success');
          addLog(`Active: ${registration.active ? 'Yes' : 'No'}`, 'info');
          addLog(`Installing: ${registration.installing ? 'Yes' : 'No'}`, 'info');
          addLog(`Waiting: ${registration.waiting ? 'Yes' : 'No'}`, 'info');
        } else {
          addLog('Service Worker NOT registered', 'error');
        }
      } catch (error: any) {
        addLog(`Error checking service worker: ${error.message}`, 'error');
      }
    } else {
      addLog('Service Worker API NOT available', 'error');
    }

    if ('PushManager' in window) {
      addLog('Push Manager available', 'success');
    } else {
      addLog('Push Manager NOT available', 'error');
    }

    // 4. Check Firebase config
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (vapidKey) {
      addLog(`VAPID key configured: ${vapidKey.substring(0, 20)}...`, 'success');
    } else {
      addLog('VAPID key NOT configured', 'error');
    }

    // 5. Try to request permission
    if ('Notification' in window && Notification.permission === 'default') {
      addLog('Attempting to request permission...');
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          addLog('Permission GRANTED!', 'success');
          
          // Try to get token
          addLog('Attempting to get FCM token...');
          try {
            const { getMessaging, getToken } = await import('firebase/messaging');
            const { app } = await import('@/lib/firebase/config');
            
            const messaging = getMessaging(app);
            const registration = await navigator.serviceWorker.getRegistration();
            
            if (registration && vapidKey) {
              const token = await getToken(messaging, {
                vapidKey,
                serviceWorkerRegistration: registration
              });
              
              if (token) {
                addLog(`Token received: ${token.substring(0, 20)}...`, 'success');
              } else {
                addLog('No token received', 'error');
              }
            }
          } catch (error: any) {
            addLog(`Error getting token: ${error.message}`, 'error');
            addLog(`Error code: ${error.code || 'unknown'}`, 'error');
            addLog(`Error stack: ${error.stack}`, 'error');
          }
        } else if (permission === 'denied') {
          addLog('Permission DENIED by user', 'error');
          addLog('Reset in Chrome: Settings → Site settings → Notifications', 'info');
        } else {
          addLog(`Permission: ${permission}`, 'info');
        }
      } catch (error: any) {
        addLog(`Error requesting permission: ${error.message}`, 'error');
      }
    } else if (Notification.permission === 'granted') {
      addLog('Permission already granted', 'success');
    } else if (Notification.permission === 'denied') {
      addLog('Permission previously denied', 'error');
      addLog('Reset in Chrome: Settings → Site settings → Notifications', 'info');
    }

    setTesting(false);
    addLog('Diagnostics complete!', 'success');
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            🔔 Notification Debug
          </h1>
          <p className="text-sm text-gray-600 mb-4">
            Diagnose notification issues on Android Chrome
          </p>

          <div className="flex gap-2">
            <button
              onClick={runDiagnostics}
              disabled={testing}
              className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testing ? '⏳ Testing...' : '🔍 Run Diagnostics'}
            </button>
            {logs.length > 0 && (
              <button
                onClick={clearLogs}
                className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
              >
                🗑️ Clear
              </button>
            )}
          </div>
        </div>

        {logs.length > 0 && (
          <div className="bg-gray-900 rounded-lg shadow-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-white">Console Logs</h2>
              <button
                onClick={() => {
                  const text = logs.join('\n');
                  navigator.clipboard.writeText(text);
                  alert('Logs copied to clipboard!');
                }}
                className="px-3 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600"
              >
                📋 Copy
              </button>
            </div>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {logs.map((log, index) => (
                <div
                  key={index}
                  className="text-xs font-mono text-gray-300 bg-gray-800 p-2 rounded"
                >
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 bg-blue-50 rounded-lg p-4 border border-blue-200">
          <h3 className="text-sm font-bold text-blue-900 mb-2">
            📱 Common Android Chrome Issues
          </h3>
          <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
            <li>Site must be on HTTPS (or localhost for testing)</li>
            <li>Service worker must be registered and active</li>
            <li>VAPID key must match Firebase console</li>
            <li>If permission denied, reset in: Settings → Site settings → Notifications</li>
            <li>Try clearing site data if issues persist</li>
          </ul>
        </div>

        <div className="mt-4 bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <h3 className="text-sm font-bold text-yellow-900 mb-2">
            ⚠️ Background Notifications (Tab Closed)
          </h3>
          <ul className="text-xs text-yellow-800 space-y-1 list-disc list-inside mb-3">
            <li>Notifications when tab is closed are handled by the Service Worker</li>
            <li>Browser must still be running (just close the tab, not the whole browser)</li>
            <li>On mobile, Chrome must be in background (home screen or other app)</li>
            <li>On Android, Chrome may need to be kept in memory (don't force stop)</li>
          </ul>
          <p className="text-xs text-yellow-800 font-medium">
            To test: Close this tab → Have someone send you a notification → Should appear even with tab closed
          </p>
        </div>
      </div>
    </div>
  );
}
