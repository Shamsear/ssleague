'use client';

import { useState, useEffect } from 'react';

export default function IOSTestPage() {
  const [diagnostics, setDiagnostics] = useState<Record<string, any>>({});

  useEffect(() => {
    const runDiagnostics = () => {
      const ua = navigator.userAgent;
      const info: Record<string, any> = {
        userAgent: ua,
        isIOS: /iPad|iPhone|iPod/.test(ua),
        isSafari: /^((?!chrome|android).)*safari/i.test(ua),
        isStandalone: ('standalone' in (window as any).navigator) && ((window as any).navigator.standalone),
        notificationSupport: 'Notification' in window,
        notificationPermission: 'Notification' in window ? Notification.permission : 'N/A',
        serviceWorkerSupport: 'serviceWorker' in navigator,
        pushManagerSupport: 'PushManager' in window,
        iosVersion: ua.match(/OS (\d+)_/)?.[1] || 'Unknown',
      };

      // Check service worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(reg => {
          info.serviceWorkerRegistered = !!reg;
          info.serviceWorkerScope = reg?.scope || 'N/A';
          info.serviceWorkerState = reg?.active?.state || 'N/A';
          setDiagnostics({...info});
        });
      } else {
        setDiagnostics(info);
      }
    };

    runDiagnostics();
  }, []);

  const getStatusIcon = (value: boolean | string) => {
    if (typeof value === 'boolean') {
      return value ? '✅' : '❌';
    }
    if (value === 'granted') return '✅';
    if (value === 'denied') return '❌';
    if (value === 'default') return '⚠️';
    return '❓';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            📱 iOS Notification Diagnostics
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            Check if your device supports web push notifications
          </p>

          <div className="space-y-3">
            {Object.entries(diagnostics).map(([key, value]) => (
              <div key={key} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </p>
                  {typeof value === 'string' && value.length > 50 ? (
                    <p className="text-xs text-gray-500 mt-1 break-all">{value}</p>
                  ) : null}
                </div>
                <div className="ml-4 flex items-center gap-2">
                  <span className="text-2xl">{getStatusIcon(value)}</span>
                  {typeof value !== 'string' || value.length <= 50 ? (
                    <span className="text-sm font-mono text-gray-600">
                      {String(value)}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {/* Requirements */}
          <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-3">📋 Requirements for iOS:</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex items-start gap-2">
                <span>1️⃣</span>
                <span><strong>iOS 16.4+</strong> required (you have: iOS {diagnostics.iosVersion})</span>
              </li>
              <li className="flex items-start gap-2">
                <span>2️⃣</span>
                <span><strong>Safari browser</strong> only (not Chrome/Firefox)</span>
              </li>
              <li className="flex items-start gap-2">
                <span>3️⃣</span>
                <span><strong>Add to Home Screen</strong> - Must run as PWA</span>
              </li>
              <li className="flex items-start gap-2">
                <span>4️⃣</span>
                <span><strong>Open from Home Screen</strong> - Not from Safari</span>
              </li>
            </ul>
          </div>

          {/* Status */}
          <div className="mt-6">
            {diagnostics.isIOS && diagnostics.isSafari && diagnostics.isStandalone ? (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-green-800 font-medium">
                  ✅ Your device meets all requirements!
                </p>
                <p className="text-sm text-green-700 mt-1">
                  You should be able to enable notifications.
                </p>
              </div>
            ) : diagnostics.isIOS && diagnostics.isSafari && !diagnostics.isStandalone ? (
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-yellow-800 font-medium">
                  ⚠️ Almost there!
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  Tap the Share button → "Add to Home Screen" → Open from home screen
                </p>
              </div>
            ) : diagnostics.isIOS && !diagnostics.isSafari ? (
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-red-800 font-medium">
                  ❌ Wrong browser
                </p>
                <p className="text-sm text-red-700 mt-1">
                  Web push notifications only work in Safari on iOS. Open this URL in Safari.
                </p>
              </div>
            ) : !diagnostics.isIOS ? (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-gray-800 font-medium">
                  ℹ️ Not an iOS device
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  This diagnostic page is for iOS devices. Your device should support notifications normally.
                </p>
              </div>
            ) : null}
          </div>

          {/* Copy diagnostics */}
          <button
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
              alert('Diagnostics copied to clipboard!');
            }}
            className="mt-6 w-full px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            📋 Copy Diagnostics
          </button>
        </div>
      </div>
    </div>
  );
}
