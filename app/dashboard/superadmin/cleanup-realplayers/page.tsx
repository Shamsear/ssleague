'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface PlayerIssue {
  player_id: string;
  name: string;
  unnecessary_fields: string[];
  field_values: { [key: string]: any };
}

export default function CleanupRealPlayersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [scanResults, setScanResults] = useState<any>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
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
      const response = await fetch('/api/admin/cleanup-realplayers');
      const result = await response.json();

      if (result.success) {
        setScanResults(result.data);
      } else {
        setError(result.error || 'Failed to scan players');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to scan players');
    } finally {
      setScanning(false);
    }
  };

  const handleCleanup = async (playerIds?: string[]) => {
    if (!confirm(`Are you sure you want to remove unnecessary fields from ${playerIds ? playerIds.length : 'all'} players? This cannot be undone.`)) {
      return;
    }

    setCleaning(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/cleanup-realplayers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirm: true,
          player_ids: playerIds
        })
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(result.message);
        // Refresh scan results
        await handleScan();
        setSelectedPlayers(new Set());
      } else {
        setError(result.error || 'Failed to clean up players');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to clean up players');
    } finally {
      setCleaning(false);
    }
  };

  const togglePlayerSelection = (playerId: string) => {
    const newSelection = new Set(selectedPlayers);
    if (newSelection.has(playerId)) {
      newSelection.delete(playerId);
    } else {
      newSelection.add(playerId);
    }
    setSelectedPlayers(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedPlayers.size === scanResults?.players.length) {
      setSelectedPlayers(new Set());
    } else {
      setSelectedPlayers(new Set(scanResults?.players.map((p: PlayerIssue) => p.player_id)));
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
            <h1 className="text-2xl sm:text-3xl font-bold text-dark">Cleanup Real Players</h1>
            <p className="text-sm text-gray-600 mt-1">
              Remove unnecessary user fields from real player documents
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

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">What this tool does:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Scans all real players for unnecessary fields: <code className="bg-blue-100 px-1 rounded">user_id</code>, <code className="bg-blue-100 px-1 rounded">role</code>, <code className="bg-blue-100 px-1 rounded">isActive</code>, <code className="bg-blue-100 px-1 rounded">createdAt</code>, <code className="bg-blue-100 px-1 rounded">updatedAt</code></li>
            <li>• These fields are from the users collection and don't belong on real players</li>
            <li>• Removing them won't affect any functionality</li>
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
            {scanning ? 'Scanning...' : 'Scan Real Players'}
          </button>
        </div>

        {/* Scan Results */}
        {scanResults && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white/60 rounded-xl p-4 border border-gray-200">
                <div className="text-sm text-gray-600">Total Players</div>
                <div className="text-2xl font-bold text-gray-900">{scanResults.total_players}</div>
              </div>
              <div className="bg-white/60 rounded-xl p-4 border border-gray-200">
                <div className="text-sm text-gray-600">Players with Issues</div>
                <div className="text-2xl font-bold text-orange-600">{scanResults.players_with_issues}</div>
              </div>
              <div className="bg-white/60 rounded-xl p-4 border border-gray-200">
                <div className="text-sm text-gray-600">Clean Players</div>
                <div className="text-2xl font-bold text-green-600">
                  {scanResults.total_players - scanResults.players_with_issues}
                </div>
              </div>
            </div>

            {/* Field Counts */}
            {scanResults.players_with_issues > 0 && (
              <>
                <div className="bg-white/60 rounded-xl p-4 border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-3">Field Occurrences:</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {Object.entries(scanResults.field_counts).map(([field, count]: [string, any]) => (
                      <div key={field} className="text-sm">
                        <code className="bg-gray-100 px-2 py-1 rounded">{field}</code>
                        <span className="ml-2 text-gray-600">({count})</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bulk Actions */}
                <div className="flex items-center justify-between bg-white/60 rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={toggleSelectAll}
                      className="text-sm text-[#0066FF] hover:underline"
                    >
                      {selectedPlayers.size === scanResults.players.length ? 'Deselect All' : 'Select All'}
                    </button>
                    {selectedPlayers.size > 0 && (
                      <span className="text-sm text-gray-600">
                        {selectedPlayers.size} selected
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {selectedPlayers.size > 0 && (
                      <button
                        onClick={() => handleCleanup(Array.from(selectedPlayers))}
                        disabled={cleaning}
                        className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                      >
                        {cleaning ? 'Cleaning...' : `Clean Selected (${selectedPlayers.size})`}
                      </button>
                    )}
                    <button
                      onClick={() => handleCleanup()}
                      disabled={cleaning}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                    >
                      {cleaning ? 'Cleaning...' : 'Clean All'}
                    </button>
                  </div>
                </div>

                {/* Players List */}
                <div className="bg-white/60 rounded-xl border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            <input
                              type="checkbox"
                              checked={selectedPlayers.size === scanResults.players.length}
                              onChange={toggleSelectAll}
                              className="rounded"
                            />
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Player ID</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unnecessary Fields</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Values</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {scanResults.players.map((player: PlayerIssue) => (
                          <tr key={player.player_id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedPlayers.has(player.player_id)}
                                onChange={() => togglePlayerSelection(player.player_id)}
                                className="rounded"
                              />
                            </td>
                            <td className="px-4 py-3 text-sm font-mono text-gray-900">{player.player_id}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{player.name}</td>
                            <td className="px-4 py-3 text-sm">
                              <div className="flex flex-wrap gap-1">
                                {player.unnecessary_fields.map(field => (
                                  <code key={field} className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded text-xs">
                                    {field}
                                  </code>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <details className="cursor-pointer">
                                <summary className="text-[#0066FF] hover:underline">View values</summary>
                                <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                                  {JSON.stringify(player.field_values, null, 2)}
                                </pre>
                              </details>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {scanResults.players_with_issues === 0 && (
              <div className="text-center py-12">
                <div className="text-green-600 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">All Clean!</h3>
                <p className="text-gray-600">No real players have unnecessary fields.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
