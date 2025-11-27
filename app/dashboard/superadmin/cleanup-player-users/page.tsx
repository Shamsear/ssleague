'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface PlayerUser {
  uid: string;
  email: string;
  displayName?: string;
  role: string;
  createdAt?: string;
}

export default function CleanupPlayerUsersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [scanResults, setScanResults] = useState<any>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    setScanResults(null);

    try {
      const response = await fetch('/api/admin/cleanup-player-users');
      const result = await response.json();

      if (result.success) {
        setScanResults(result.data);
      } else {
        setError(result.error || 'Failed to scan users');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to scan users');
    } finally {
      setScanning(false);
    }
  };

  const handleDelete = async (userIds?: string[]) => {
    const count = userIds ? userIds.length : scanResults?.player_users.length || 0;
    if (!confirm(`Are you sure you want to DELETE ${count} user account(s)? This will permanently remove them from Firebase Auth and the users collection. This CANNOT be undone!`)) {
      return;
    }

    setDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/cleanup-player-users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirm: true,
          user_ids: userIds
        })
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(result.message);
        // Refresh scan results
        await handleScan();
        setSelectedUsers(new Set());
      } else {
        setError(result.error || 'Failed to delete users');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete users');
    } finally {
      setDeleting(false);
    }
  };

  const toggleUserSelection = (uid: string) => {
    const newSelection = new Set(selectedUsers);
    if (newSelection.has(uid)) {
      newSelection.delete(uid);
    } else {
      newSelection.add(uid);
    }
    setSelectedUsers(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === scanResults?.player_users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(scanResults?.player_users.map((u: PlayerUser) => u.uid)));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'super_admin') {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="glass rounded-3xl p-6 sm:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-dark">Cleanup Player User Accounts</h1>
            <p className="text-sm text-gray-600 mt-1">
              Delete unwanted user accounts created for real players
            </p>
          </div>
          <Link 
            href="/dashboard/superadmin" 
            className="flex items-center text-gray-600 hover:text-[#0066FF] transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back</span>
          </Link>
        </div>

        {/* Warning Box */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <div className="flex items-start">
            <svg className="w-6 h-6 text-red-600 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="font-semibold text-red-900 mb-2">⚠️ DANGER ZONE - Permanent Deletion</h3>
              <ul className="text-sm text-red-800 space-y-1">
                <li>• This tool DELETES user accounts from Firebase Auth AND Firestore</li>
                <li>• Real players should NOT have user accounts - they don't need to log in</li>
                <li>• Only team owners, managers, and committee members need user accounts</li>
                <li>• Deletion is PERMANENT and CANNOT be undone</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">What this tool does:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Finds user accounts linked to real players via <code className="bg-blue-100 px-1 rounded">registered_user_id</code></li>
            <li>• These are user accounts that were mistakenly created when registering real players</li>
            <li>• Real players should only exist in the <code className="bg-blue-100 px-1 rounded">realplayers</code> collection, not <code className="bg-blue-100 px-1 rounded">users</code></li>
            <li>• Deleting these accounts will NOT affect player stats or team rosters</li>
          </ul>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <p className="text-green-800">{success}</p>
          </div>
        )}

        {/* Scan Button */}
        <div className="mb-6">
          <button
            onClick={handleScan}
            disabled={scanning}
            className="px-6 py-3 bg-[#0066FF] text-white rounded-xl hover:bg-[#0052CC] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {scanning ? 'Scanning...' : 'Scan User Accounts'}
          </button>
        </div>

        {/* Scan Results */}
        {scanResults && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white/60 rounded-xl p-4 border border-gray-200">
                <div className="text-sm text-gray-600">Total Users</div>
                <div className="text-2xl font-bold text-gray-900">{scanResults.total_users}</div>
              </div>
              <div className="bg-white/60 rounded-xl p-4 border border-gray-200">
                <div className="text-sm text-gray-600">Player User Accounts</div>
                <div className="text-2xl font-bold text-red-600">{scanResults.player_users_count}</div>
              </div>
              <div className="bg-white/60 rounded-xl p-4 border border-gray-200">
                <div className="text-sm text-gray-600">Valid Users</div>
                <div className="text-2xl font-bold text-green-600">
                  {scanResults.total_users - scanResults.player_users_count}
                </div>
              </div>
            </div>

            {scanResults.player_users_count > 0 && (
              <>
                {/* Bulk Actions */}
                <div className="flex items-center justify-between bg-white/60 rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={toggleSelectAll}
                      className="text-sm text-[#0066FF] hover:underline"
                    >
                      {selectedUsers.size === scanResults.player_users.length ? 'Deselect All' : 'Select All'}
                    </button>
                    {selectedUsers.size > 0 && (
                      <span className="text-sm text-gray-600">
                        {selectedUsers.size} selected
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {selectedUsers.size > 0 && (
                      <button
                        onClick={() => handleDelete(Array.from(selectedUsers))}
                        disabled={deleting}
                        className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                      >
                        {deleting ? 'Deleting...' : `Delete Selected (${selectedUsers.size})`}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete()}
                      disabled={deleting}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      {deleting ? 'Deleting...' : 'Delete All'}
                    </button>
                  </div>
                </div>

                {/* Users List */}
                <div className="bg-white/60 rounded-xl border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            <input
                              type="checkbox"
                              checked={selectedUsers.size === scanResults.player_users.length}
                              onChange={toggleSelectAll}
                              className="rounded"
                            />
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">UID</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Display Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {scanResults.player_users.map((playerUser: PlayerUser) => (
                          <tr key={playerUser.uid} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedUsers.has(playerUser.uid)}
                                onChange={() => toggleUserSelection(playerUser.uid)}
                                className="rounded"
                              />
                            </td>
                            <td className="px-4 py-3 text-sm font-mono text-gray-900">{playerUser.uid}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{playerUser.email}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{playerUser.displayName || '-'}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                                {playerUser.role}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {playerUser.createdAt ? new Date(playerUser.createdAt).toLocaleDateString() : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {scanResults.player_users_count === 0 && (
              <div className="text-center py-12">
                <div className="text-green-600 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">All Clean!</h3>
                <p className="text-gray-600">No player user accounts found in the users collection.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
