'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

export default function ReconcileContractsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { isCommitteeAdmin } = usePermissions();
  
  const [newSeasonId, setNewSeasonId] = useState('');
  const [mode, setMode] = useState<'preview' | 'execute'>('preview');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && !isCommitteeAdmin) {
      router.push('/dashboard');
    }
  }, [user, loading, router, isCommitteeAdmin]);

  const handleReconcile = async () => {
    if (!newSeasonId) {
      setError('Please enter the new season ID');
      return;
    }

    setProcessing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetchWithTokenRefresh('/api/admin/reconcile-contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newSeasonId,
          action: mode
        })
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Failed to reconcile contracts');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reconcile contracts');
    } finally {
      setProcessing(false);
    }
  };

  if (loading || !user || !isCommitteeAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto max-w-5xl">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                📄 Contract Reconciliation
              </h1>
              <p className="text-gray-600">
                Handle player contracts when teams don't re-register for the next season
              </p>
            </div>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-all"
            >
              ← Back
            </button>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6">
          <h3 className="text-lg font-bold text-blue-900 mb-3">ℹ️ How It Works</h3>
          <div className="text-sm text-blue-800 space-y-2">
            <p><strong>Example:</strong></p>
            <ul className="list-disc ml-5 space-y-1">
              <li>Team Azzuri FC: Contract S16-S17 (didn't re-register for S18)</li>
              <li>Player John (SS Member): Contract S17-S18 (signed during S17)</li>
              <li>Player Ronaldo (Football): Contract S17-S18 (signed during S17)</li>
            </ul>
            <p className="mt-3"><strong>What happens:</strong></p>
            <ul className="list-disc ml-5 space-y-1">
              <li>✂️ Cut both players' contracts: S17-S18 → S17-S17</li>
              <li>🆓 Release both for S18 (become free agents)</li>
              <li>✅ Preserve all S17 stats and data</li>
            </ul>
            <p className="mt-3 text-blue-700 font-semibold">
              ⚠️ Handles BOTH SS Members and Football Players automatically!
            </p>
            <p className="text-blue-700 font-semibold">
              ⚠️ Always run in PREVIEW mode first to see what will be affected!
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                New Season ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newSeasonId}
                onChange={(e) => setNewSeasonId(e.target.value)}
                placeholder="SSPSLS18"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter the season ID that teams are re-registering for (e.g., SSPSLS18)
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Mode
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="preview"
                    checked={mode === 'preview'}
                    onChange={(e) => setMode(e.target.value as 'preview')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    👁️ Preview (Safe - No Changes)
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="execute"
                    checked={mode === 'execute'}
                    onChange={(e) => setMode(e.target.value as 'execute')}
                    className="w-4 h-4 text-red-600"
                  />
                  <span className="text-sm font-medium text-red-700">
                    ⚡ Execute (Updates Database)
                  </span>
                </label>
              </div>
            </div>

            <button
              onClick={handleReconcile}
              disabled={processing || !newSeasonId}
              className={`w-full py-3 px-6 rounded-xl font-semibold transition-all ${
                mode === 'preview'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg'
                  : 'bg-gradient-to-r from-red-600 to-orange-600 text-white hover:shadow-lg'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {processing ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Processing...
                </span>
              ) : mode === 'preview' ? (
                '👁️ Preview Changes'
              ) : (
                '⚡ Execute Reconciliation'
              )}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-xl p-4 mb-6">
            <p className="text-red-800 font-medium">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                📊 Summary
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-xs text-blue-600 font-medium">New Season</p>
                  <p className="text-xl font-bold text-blue-900">{result.summary.newSeason}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-xs text-green-600 font-medium">Teams Re-registered</p>
                  <p className="text-xl font-bold text-green-900">{result.summary.teamsReRegistered}</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-4">
                  <p className="text-xs text-orange-600 font-medium">Players to Release</p>
                  <p className="text-xl font-bold text-orange-900">{result.summary.playersToRelease}</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-4">
                  <p className="text-xs text-purple-600 font-medium">Players to Keep</p>
                  <p className="text-xl font-bold text-purple-900">{result.summary.playersToKeep}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-600 font-medium">Expired Contracts</p>
                  <p className="text-xl font-bold text-gray-900">{result.summary.playersWithExpiredContracts}</p>
                </div>
                <div className="bg-red-50 rounded-xl p-4">
                  <p className="text-xs text-red-600 font-medium">Total Affected</p>
                  <p className="text-xl font-bold text-red-900">{result.summary.totalPlayersAffected}</p>
                </div>
              </div>
            </div>

            {/* Execution Results */}
            {result.mode === 'execute' && result.results && (
              <div className="bg-green-50 border-l-4 border-green-500 rounded-xl p-6">
                <h3 className="text-lg font-bold text-green-900 mb-3">✅ {result.message}</h3>
                <div className="space-y-2 text-sm text-green-800">
                  <p>• Contracts cut: {result.results.contractsCut}</p>
                  <p>• Players released: {result.results.playersReleased}</p>
                  {result.results.errors && (
                    <div className="mt-4 p-3 bg-red-50 rounded-lg">
                      <p className="font-semibold text-red-900 mb-2">⚠️ Errors:</p>
                      <ul className="list-disc ml-5 space-y-1 text-red-700">
                        {result.results.errors.map((err: string, i: number) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Details */}
            {result.details && (
              <>
                {/* Players to Release */}
                {result.details.playersToRelease.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">
                      🆓 Players to Release ({result.details.playersToRelease.length})
                    </h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {result.details.playersToRelease.map((player: any, i: number) => (
                        <div key={i} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-gray-900">{player.player_name}</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  player.player_type === 'Real Player' 
                                    ? 'bg-green-100 text-green-700' 
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {player.player_type === 'Real Player' ? '👤 SS Member' : '⚽ Football'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600">{player.team_name}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500 line-through">{player.contract_original}</p>
                              <p className="text-xs text-orange-700 font-semibold">{player.contract_cut_to}</p>
                            </div>
                          </div>
                          <p className="text-xs text-orange-600 mt-2">{player.action}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Players to Keep */}
                {result.details.playersToKeep.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">
                      ✅ Players to Keep ({result.details.playersToKeep.length})
                    </h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {result.details.playersToKeep.map((player: any, i: number) => (
                        <div key={i} className="p-3 bg-green-50 rounded-lg border border-green-200">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-gray-900">{player.player_name}</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  player.player_type === 'Real Player' 
                                    ? 'bg-green-100 text-green-700' 
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {player.player_type === 'Real Player' ? '👤 SS Member' : '⚽ Football'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600">{player.team_name}</p>
                            </div>
                            <p className="text-xs text-green-700 font-semibold">{player.contract}</p>
                          </div>
                          <p className="text-xs text-green-600 mt-2">{player.action}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expired Contracts */}
                {result.details.playersWithExpiredContracts.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">
                      ⏰ Expired Contracts ({result.details.playersWithExpiredContracts.length})
                    </h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {result.details.playersWithExpiredContracts.map((player: any, i: number) => (
                        <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-gray-900">{player.player_name}</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  player.player_type === 'Real Player' 
                                    ? 'bg-green-100 text-green-700' 
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {player.player_type === 'Real Player' ? '👤 SS Member' : '⚽ Football'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600">{player.team_name}</p>
                            </div>
                            <p className="text-xs text-gray-700 font-semibold">{player.contract}</p>
                          </div>
                          <p className="text-xs text-gray-600 mt-2">{player.action}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
