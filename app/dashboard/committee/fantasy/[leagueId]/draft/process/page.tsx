'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface PreviewData {
  bid_summary: {
    total_bids: number;
    total_teams: number;
    teams_participated: number;
    teams_without_bids: Array<{ team_name: string; owner_name: string }>;
  };
  tier_summary: Array<{
    tier_number: number;
    tier_name: string;
    total_bids: number;
    unique_players: number;
    players_available: number;
    predicted_winners: Array<{
      player_name: string;
      winning_team: string;
      bid_amount: number;
      is_tiebreaker: boolean;
      competing_bids: number;
    }>;
    total_winners: number;
  }>;
  budget_impact: {
    total_to_spend: number;
    average_per_team: number;
    team_breakdown: Array<{
      team_name: string;
      current_budget: number;
      total_spend: number;
      new_budget: number;
      players_won: number;
    }>;
    teams_over_budget: Array<{
      team_name: string;
      overspend: number;
    }>;
  };
  warnings: Array<{
    type: string;
    severity: string;
    message: string;
    teams?: any;
  }>;
  can_process: boolean;
}

export default function ProcessDraftPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const leagueId = params?.leagueId as string;

  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);
  const [expandedTier, setExpandedTier] = useState<number | null>(null);
  const [tierNumber, setTierNumber] = useState<number | null>(null);

  // Get tier number from URL query params
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tier = searchParams.get('tier');
    if (tier) {
      setTierNumber(parseInt(tier));
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && user.role !== 'committee_admin' && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const loadPreview = async () => {
    setIsLoadingPreview(true);
    setError(null);

    try {
      const body: any = { league_id: leagueId };
      if (tierNumber) {
        body.tier_number = tierNumber;
      }

      const response = await fetchWithTokenRefresh('/api/fantasy/draft/process-tiers/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load preview');
      }

      setPreviewData(data.preview);
      setShowPreview(true);
    } catch (err: any) {
      setError(err.message || 'Failed to load preview');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleProcess = async () => {
    const confirmMsg = tierNumber 
      ? `Are you sure you want to process Tier ${tierNumber}? This action cannot be undone.`
      : 'Are you sure you want to process all draft bids? This action cannot be undone.';
    
    if (!confirm(confirmMsg)) {
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    setSuccess(null);
    setResults(null);

    try {
      const body: any = {
        league_id: leagueId,
        send_notifications: true
      };
      if (tierNumber) {
        body.tier_number = tierNumber;
      }

      const response = await fetchWithTokenRefresh('/api/fantasy/draft/process-tiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to process draft');
      }

      const successMsg = tierNumber
        ? `Successfully processed Tier ${tierNumber}! ${data.total_players_drafted} players drafted, €${data.total_budget_spent}M spent`
        : `Successfully processed draft! ${data.total_players_drafted} players drafted, €${data.total_budget_spent}M spent`;
      
      setSuccess(successMsg);
      setResults(data);
      setShowPreview(false);
    } catch (err: any) {
      setError(err.message || 'Failed to process draft');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-50 border-red-300 text-red-800';
      case 'high': return 'bg-orange-50 border-orange-300 text-orange-800';
      case 'medium': return 'bg-yellow-50 border-yellow-300 text-yellow-800';
      default: return 'bg-blue-50 border-blue-300 text-blue-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
        <Link
          href={`/dashboard/committee/fantasy/${leagueId}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-6 text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </Link>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center text-white">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {tierNumber ? `Process Tier ${tierNumber}` : 'Process Draft'}
              </h1>
              <p className="text-gray-600">
                {tierNumber 
                  ? `Process bids for Tier ${tierNumber} and assign players to teams`
                  : 'Process all tier bids and assign players to teams'
                }
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-red-900 mb-1">Error</h3>
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-green-900 mb-1">Success</h3>
                  <p className="text-sm text-green-800">{success}</p>
                </div>
              </div>
            </div>
          )}

          {!showPreview && !results && (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-amber-900 mb-1">Important</h3>
                    <p className="text-sm text-amber-800">
                      {tierNumber 
                        ? `Click "Preview Processing" to see what will happen for Tier ${tierNumber} before executing.`
                        : 'Click "Preview Processing" to see what will happen before executing.'
                      } This will show you predicted winners, budget impact, and any issues.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={loadPreview}
                disabled={isLoadingPreview}
                className="w-full px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingPreview ? 'Loading Preview...' : '🔍 Preview Processing'}
              </button>
            </>
          )}

          {showPreview && previewData && (
            <div className="space-y-6">
              {/* Bid Summary */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                <h3 className="font-bold text-gray-900 mb-4 text-lg">📊 Bid Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Total Bids</p>
                    <p className="text-2xl font-bold text-gray-900">{previewData.bid_summary.total_bids}</p>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Teams Participated</p>
                    <p className="text-2xl font-bold text-green-600">
                      {previewData.bid_summary.teams_participated}/{previewData.bid_summary.total_teams}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Total Budget</p>
                    <p className="text-2xl font-bold text-purple-600">
                      €{previewData.budget_impact.total_to_spend.toFixed(1)}M
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Avg Per Team</p>
                    <p className="text-2xl font-bold text-blue-600">
                      €{previewData.budget_impact.average_per_team.toFixed(1)}M
                    </p>
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {previewData.warnings.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-bold text-gray-900 text-lg">⚠️ Warnings</h3>
                  {previewData.warnings.map((warning, idx) => (
                    <div key={idx} className={`border rounded-lg p-4 ${getSeverityColor(warning.severity)}`}>
                      <p className="font-semibold mb-2">{warning.message}</p>
                      {warning.teams && Array.isArray(warning.teams) && warning.teams.length > 0 && (
                        <div className="mt-2 text-sm">
                          {warning.type === 'no_bids' && (
                            <ul className="list-disc list-inside">
                              {warning.teams.map((team: any, i: number) => (
                                <li key={i}>{team.team_name} ({team.owner_name})</li>
                              ))}
                            </ul>
                          )}
                          {warning.type === 'over_budget' && (
                            <ul className="list-disc list-inside">
                              {warning.teams.map((team: any, i: number) => (
                                <li key={i}>{team.team_name} - Over by €{team.overspend.toFixed(1)}M</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Tier-by-Tier Preview */}
              <div>
                <h3 className="font-bold text-gray-900 mb-4 text-lg">🎯 Predicted Winners by Tier</h3>
                <div className="space-y-3">
                  {previewData.tier_summary.map((tier) => (
                    <div key={tier.tier_number} className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpandedTier(expandedTier === tier.tier_number ? null : tier.tier_number)}
                        className="w-full p-4 bg-gradient-to-r from-gray-50 to-white hover:from-gray-100 hover:to-gray-50 transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-bold text-indigo-600">Tier {tier.tier_number}</span>
                          <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-semibold">
                            {tier.tier_name}
                          </span>
                          <span className="text-sm text-gray-600">
                            {tier.total_winners} winners • {tier.total_bids} bids
                          </span>
                        </div>
                        <svg 
                          className={`w-5 h-5 text-gray-400 transition-transform ${expandedTier === tier.tier_number ? 'rotate-180' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {expandedTier === tier.tier_number && (
                        <div className="p-4 bg-white border-t border-gray-200">
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Player</th>
                                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Winning Team</th>
                                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Bid Amount</th>
                                  <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {tier.predicted_winners.map((winner, idx) => (
                                  <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 font-medium text-gray-900">{winner.player_name}</td>
                                    <td className="px-4 py-2 text-gray-700">{winner.winning_team}</td>
                                    <td className="px-4 py-2 text-green-600 font-semibold">€{winner.bid_amount.toFixed(1)}M</td>
                                    <td className="px-4 py-2">
                                      {winner.is_tiebreaker ? (
                                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                                          Tiebreaker ({winner.competing_bids} bids)
                                        </span>
                                      ) : (
                                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                          Clear Winner
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {tier.total_winners > tier.predicted_winners.length && (
                              <p className="text-sm text-gray-500 mt-2 text-center">
                                ... and {tier.total_winners - tier.predicted_winners.length} more winners
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Budget Impact */}
              <div>
                <h3 className="font-bold text-gray-900 mb-4 text-lg">💰 Budget Impact by Team</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Team</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Current Budget</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Total Spend</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">New Budget</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Players Won</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {previewData.budget_impact.team_breakdown.map((team, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{team.team_name}</td>
                          <td className="px-4 py-3 text-gray-700">€{team.current_budget.toFixed(1)}M</td>
                          <td className="px-4 py-3 text-red-600 font-semibold">-€{team.total_spend.toFixed(1)}M</td>
                          <td className={`px-4 py-3 font-bold ${team.new_budget >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            €{team.new_budget.toFixed(1)}M
                          </td>
                          <td className="px-4 py-3 text-indigo-600 font-semibold">{team.players_won}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setShowPreview(false)}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProcess}
                  disabled={isProcessing || !previewData.can_process}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold rounded-lg hover:from-emerald-600 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Processing...' : '✅ Confirm & Process Draft'}
                </button>
              </div>

              {!previewData.can_process && (
                <p className="text-sm text-red-600 text-center">
                  ⚠️ Cannot process due to critical warnings. Please resolve issues first.
                </p>
              )}
            </div>
          )}

          {results && (
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Processing Results</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                  <span className="text-gray-700">Players Drafted</span>
                  <span className="font-bold text-gray-900">{results.total_players_drafted}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                  <span className="text-gray-700">Budget Spent</span>
                  <span className="font-bold text-gray-900">€{results.total_budget_spent}M</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                  <span className="text-gray-700">Average Squad Size</span>
                  <span className="font-bold text-gray-900">{results.average_squad_size.toFixed(1)}</span>
                </div>
                {results.notifications_sent > 0 && (
                  <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                    <span className="text-gray-700">Notifications Sent</span>
                    <span className="font-bold text-gray-900">{results.notifications_sent}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
