'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface NotificationUser {
  userId: string;
  deviceCount: number;
  devices: Array<{
    deviceName: string;
    deviceType: string;
  }>;
}

export default function TestNotificationsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [customUserId, setCustomUserId] = useState('');
  const [title, setTitle] = useState('Test Notification 🔔');
  const [body, setBody] = useState('This is a test push notification!');
  const [notificationUsers, setNotificationUsers] = useState<NotificationUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const loadNotificationUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await fetchWithTokenRefresh('/api/notifications/users');
      if (response.ok) {
        const data = await response.json();
        console.log('Loaded notification users:', data);
        setNotificationUsers(data.users || []);
      } else {
        const errorData = await response.json();
        console.error('Failed to load notification users:', response.status, errorData);
        setResult(`❌ Failed to load users: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error loading notification users:', error);
      setResult(`❌ Error: ${error.message}`);
    } finally {
      setLoadingUsers(false);
    }
  };

  const sendTestNotification = async (targetUserId?: string) => {
    if (!user) {
      setResult('❌ You must be logged in');
      return;
    }

    setLoading(true);
    setResult('📤 Sending notification...');

    try {
      const response = await fetchWithTokenRefresh('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: targetUserId || user.uid,
          title: title,
          body: body,
          icon: '/logo.png',
          url: '/dashboard/team',
          data: {
            type: 'test',
            timestamp: new Date().toISOString()
          }
        })
      });

      const data = await response.json();

      if (response.ok) {
        setResult(`✅ Success! Sent to ${data.sentToDevices} device(s)\n${data.failedDevices > 0 ? `⚠️ Failed on ${data.failedDevices} device(s)` : ''}`);
      } else {
        setResult(`❌ Error: ${data.error}`);
      }
    } catch (error: any) {
      setResult(`❌ Failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Please Login</h1>
          <p className="text-gray-600">You must be logged in to test notifications</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🔔 Test Push Notifications
          </h1>
          <p className="text-gray-600 mb-8">
            Send test notifications to check if FCM is working properly
          </p>

          <div className="space-y-6">
            {/* Notification Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notification Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter notification title"
              />
            </div>

            {/* Notification Body */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notification Message
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter notification message"
              />
            </div>

            {/* Current User Info */}
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                <strong>Your User ID:</strong> <code className="bg-white px-2 py-1 rounded text-xs">{user.uid}</code>
              </p>
              <p className="text-sm text-gray-600 mt-1">
                You can send notifications to yourself or another user
              </p>
            </div>

            {/* Quick Test Buttons */}
            <div className="flex gap-4">
              <button
                onClick={() => sendTestNotification()}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-6 py-3 rounded-lg font-medium hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
              >
                {loading ? 'Sending...' : '📤 Send to Myself'}
              </button>
            </div>

            {/* Users with Notifications Enabled */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Send to Users with Notifications
                </label>
                <button
                  onClick={loadNotificationUsers}
                  disabled={loadingUsers}
                  className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition-colors"
                >
                  {loadingUsers ? 'Loading...' : 'Refresh List'}
                </button>
              </div>
              
              {notificationUsers.length > 0 ? (
                <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
                  {notificationUsers.map((notifUser) => (
                    <div key={notifUser.userId} className="flex items-center justify-between p-3 bg-white rounded-lg hover:shadow-md transition-shadow">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {notifUser.userId}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {notifUser.deviceCount} device(s): {notifUser.devices.map(d => d.deviceName).join(', ')}
                        </p>
                      </div>
                      <button
                        onClick={() => sendTestNotification(notifUser.userId)}
                        disabled={loading}
                        className="ml-3 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-lg disabled:opacity-50 transition-colors flex-shrink-0"
                      >
                        Send
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 text-sm border border-gray-200 rounded-lg bg-gray-50">
                  {loadingUsers ? 'Loading users...' : 'Click "Refresh List" to load users with notifications enabled'}
                </div>
              )}
            </div>

            {/* Custom User ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Or Enter User ID Manually (Optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customUserId}
                  onChange={(e) => setCustomUserId(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter user ID"
                />
                <button
                  onClick={() => sendTestNotification(customUserId)}
                  disabled={loading || !customUserId}
                  className="bg-purple-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Send
                </button>
              </div>
            </div>

            {/* Result Display */}
            {result && (
              <div className={`p-4 rounded-lg ${
                result.startsWith('✅') ? 'bg-green-50 border border-green-200' :
                result.startsWith('❌') ? 'bg-red-50 border border-red-200' :
                'bg-yellow-50 border border-yellow-200'
              }`}>
                <pre className="text-sm whitespace-pre-wrap font-mono">{result}</pre>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">📋 Instructions:</h3>
            <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside">
              <li>Make sure you've enabled notifications on this device</li>
              <li>Click "Send to Myself" to test</li>
              <li>You should see a notification appear (even if the tab is active)</li>
              <li>Check browser console (F12) for detailed logs</li>
            </ol>
          </div>

          {/* Troubleshooting */}
          <div className="mt-6 bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">🔧 Troubleshooting:</h3>
            <ul className="space-y-1 text-sm text-gray-600 list-disc list-inside">
              <li>If you see "Unauthorized" - make sure you're logged in as committee/admin</li>
              <li>If "User has not enabled notifications" - enable notifications first</li>
              <li>If no notification appears - check browser notification permissions</li>
              <li>Open browser console (F12) to see detailed error messages</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
