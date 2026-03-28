'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface Player {
  real_player_id: string;
  player_name: string;
  position: string;
  real_team_name: string;
  total_points: number;
  games_played: number;
  avg_points_per_game: number;
}

interface Tier {
  tier_id: string;
  tier_number: number;
  tier_name: string;
  players: Player[];
  player_count: number;
  min_points: number;
  max_points: number;
  avg_points: number;
}

export default function GenerateDraftTiersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const leagueId = params?.leagueId as string;

  const [numberOfTiers, setNumberOfTiers] = useState(7);
  const [draftType, setDraftType] = useState<'initial' | 'transfer'>('initial');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [generatedTiers, setGeneratedTiers] = useState<Tier[]>([]);
  const [expandedTier, setExpandedTier] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [totalPlayers, setTotalPlayers] = useState<number>(0);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && user.role !== 'committee_admin' && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && leagueId) {
      loadAvailablePlayers();
    }
  }, [user, leagueId]);

  const loadAvailablePlayers = async () => {
    setIsLoadingPlayers(true);
    try {
      const response = await fetchWithTokenRefresh(`/api/fantasy/players/available?league_id=${leagueId}`);
      if (response.ok) {
        const data = await response.json();
        setTotalPlayers(data.available_players?.length || 0);
      }
    } catch (err) {
      console.error('Error loading players:', err);
    } finally {
      setIsLoadingPlayers(false);
    }
  };

  const loadPreview = async () => {
    setIsLoadingPreview(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetchWithTokenRefresh('/api/fantasy/draft/generate-tiers/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          league_id: leagueId,
          draft_type: draftType,
          number_of_tiers: numberOfTiers,
          min_games_played: 3
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorMsg = data.details || data.error || 'Failed to load preview';
        throw new Error(errorMsg);
      }

      setPreviewData(data.preview);
      setShowPreview(true);
      setExpandedTier(1); // Auto-expand first tier
    } catch (err: any) {
      setError(err.message || 'Failed to load preview');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleGenerate = async () => {
    if (!confirm(`Generate ${numberOfTiers} tiers for ${draftType} draft?`)) {
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSuccess(null);
    setGeneratedTiers([]);
    setHasChanges(false);

    try {
      const response = await fetchWithTokenRefresh('/api/fantasy/draft/generate-tiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          league_id: leagueId,
          draft_type: draftType,
          number_of_tiers: numberOfTiers,
          min_games_played: 3
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate tiers');
      }

      setSuccess(`Successfully generated ${data.tiers.length} tiers with ${data.tiers.reduce((sum: number, t: any) => sum + t.player_count, 0)} players`);
      setGeneratedTiers(data.tiers);
      setExpandedTier(1); // Auto-expand first tier
      setShowPreview(false); // Close preview after generation
      setPreviewData(null);
    } catch (err: any) {
      setError(err.message || 'Failed to generate tiers');
    } finally {
      setIsGenerating(false);
    }
  };

  const movePlayerUp = (tierIndex: number, playerIndex: number) => {
    if (tierIndex === 0) return; // Can't move up from first tier

    const newTiers = [...generatedTiers];
    const player = newTiers[tierIndex].players[playerIndex];
    
    // Remove from current tier
    newTiers[tierIndex].players.splice(playerIndex, 1);
    newTiers[tierIndex].player_count--;
    
    // Add to tier above
    newTiers[tierIndex - 1].players.push(player);
    newTiers[tierIndex - 1].player_count++;
    
    // Recalculate stats for both tiers
    recalculateTierStats(newTiers[tierIndex]);
    recalculateTierStats(newTiers[tierIndex - 1]);
    
    setGeneratedTiers(newTiers);
    setHasChanges(true);
  };

  const movePlayerDown = (tierIndex: number, playerIndex: number) => {
    if (tierIndex === generatedTiers.length - 1) return; // Can't move down from last tier

    const newTiers = [...generatedTiers];
    const player = newTiers[tierIndex].players[playerIndex];
    
    // Remove from current tier
    newTiers[tierIndex].players.splice(playerIndex, 1);
    newTiers[tierIndex].player_count--;
    
    // Add to tier below
    newTiers[tierIndex + 1].players.unshift(player);
    newTiers[tierIndex + 1].player_count++;
    
    // Recalculate stats for both tiers
    recalculateTierStats(newTiers[tierIndex]);
    recalculateTierStats(newTiers[tierIndex + 1]);
    
    setGeneratedTiers(newTiers);
    setHasChanges(true);
  };

  const recalculateTierStats = (tier: Tier) => {
    if (tier.players.length === 0) {
      tier.min_points = 0;
      tier.max_points = 0;
      tier.avg_points = 0;
      return;
    }

    const points = tier.players.map(p => p.total_points);
    tier.min_points = Math.min(...points);
    tier.max_points = Math.max(...points);
    tier.avg_points = points.reduce((sum, p) => sum + p, 0) / points.length;
  };

  const handleSave = async () => {
    if (!confirm('Save the modified tier structure? This will overwrite the previously generated tiers.')) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Prepare tiers data for saving
      const tiersToSave = generatedTiers.map(tier => ({
        tier_id: tier.tier_id,
        tier_number: tier.tier_number,
        tier_name: tier.tier_name,
        player_ids: tier.players.map(p => p.real_player_id),
        player_count: tier.player_count,
        min_points: tier.min_points,
        max_points: tier.max_points,
        avg_points: tier.avg_points,
      }));

      const response = await fetchWithTokenRefresh('/api/fantasy/draft/update-tiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          league_id: leagueId,
          draft_type: draftType,
          tiers: tiersToSave
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save tiers');
      }

      setSuccess('Tier structure saved successfully!');
      setHasChanges(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save tiers');
    } finally {
      setIsSaving(false);
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
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center text-white">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Generate Draft Tiers</h1>
                <p className="text-gray-600">Create and adjust tiers for blind bidding</p>
              </div>
            </div>
            {hasChanges && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : '💾 Save Changes'}
              </button>
            )}
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

          {hasChanges && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-amber-900 mb-1">Unsaved Changes</h3>
                  <p className="text-sm text-amber-800">
                    You have modified the tier structure. Click "Save Changes" to apply your adjustments.
                  </p>
                </div>
              </div>
            </div>
          )}

          {generatedTiers.length === 0 && !showPreview && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h3 className="font-semibold text-blue-900 mb-1">How Tier Generation Works</h3>
                    <p className="text-sm text-blue-800">
                      Players are automatically divided into tiers based on their recent performance stats. 
                      Click "Preview Tiers" to see the distribution before generating.
                    </p>
                  </div>
                </div>
              </div>

              {/* Player Pool Summary */}
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-6 mb-6 border border-indigo-200">
                <h3 className="font-bold text-gray-900 mb-4 text-lg">📊 Player Pool</h3>
                {isLoadingPlayers ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="text-sm text-gray-600 mt-2">Loading available players...</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="bg-white rounded-lg p-4 border border-indigo-200">
                        <p className="text-sm text-gray-600 mb-1">Total Available Players</p>
                        <p className="text-3xl font-bold text-indigo-600">{totalPlayers}</p>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-indigo-200">
                        <p className="text-sm text-gray-600 mb-1">Number of Tiers</p>
                        <p className="text-3xl font-bold text-purple-600">{numberOfTiers}</p>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-indigo-200">
                        <p className="text-sm text-gray-600 mb-1">Avg Players per Tier</p>
                        <p className="text-3xl font-bold text-pink-600">
                          {totalPlayers > 0 ? Math.round(totalPlayers / numberOfTiers) : 0}
                        </p>
                      </div>
                    </div>

                    {/* Preview: Tier Structure */}
                    <div className="bg-white rounded-lg p-4 border border-indigo-200">
                      <h4 className="font-semibold text-gray-900 mb-3">Estimated Tier Structure</h4>
                      <div className="space-y-2">
                        {Array.from({ length: numberOfTiers }, (_, i) => {
                          const tierNumber = i + 1;
                          const tierNames = ['Elite', 'Stars', 'Quality', 'Solid', 'Average', 'Depth', 'Reserves', 'Backup', 'Fringe'];
                          const tierName = tierNames[i] || `Tier ${tierNumber}`;
                          const estimatedPlayers = Math.round(totalPlayers / numberOfTiers);
                          
                          return (
                            <div key={tierNumber} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-sm font-bold text-indigo-600">
                                  {tierNumber}
                                </div>
                                <span className="font-medium text-gray-900">{tierName}</span>
                              </div>
                              <span className="text-sm text-gray-600">~{estimatedPlayers} players</span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-500 mt-3 text-center">
                        * Actual distribution will be based on player performance stats
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Draft Type
                  </label>
                  <select
                    value={draftType}
                    onChange={(e) => setDraftType(e.target.value as 'initial' | 'transfer')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="initial">Initial Draft</option>
                    <option value="transfer">Transfer Draft</option>
                  </select>
                  <p className="text-sm text-gray-500 mt-1">
                    Initial draft for new league, transfer draft for mid-season
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Tiers
                  </label>
                  <select
                    value={numberOfTiers}
                    onChange={(e) => setNumberOfTiers(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value={5}>5 Tiers</option>
                    <option value={6}>6 Tiers</option>
                    <option value={7}>7 Tiers (Recommended)</option>
                    <option value={8}>8 Tiers</option>
                    <option value={9}>9 Tiers</option>
                  </select>
                  <p className="text-sm text-gray-500 mt-1">
                    More tiers = more granular skill distribution
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <h3 className="font-semibold text-amber-900 mb-1">Preview Before Generating</h3>
                      <p className="text-sm text-amber-800">
                        Click "Preview Tiers" to see exactly which players will be in each tier before saving.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={loadPreview}
                  disabled={isLoadingPreview}
                  className="w-full px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoadingPreview ? 'Loading Preview...' : '🔍 Preview Tiers'}
                </button>
              </div>
            </>
          )}

          {showPreview && previewData && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                <h3 className="font-bold text-gray-900 mb-4 text-lg">📊 Tier Generation Preview</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Total Players</p>
                    <p className="text-2xl font-bold text-gray-900">{previewData.summary.total_players}</p>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Number of Tiers</p>
                    <p className="text-2xl font-bold text-indigo-600">{previewData.summary.number_of_tiers}</p>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Avg per Tier</p>
                    <p className="text-2xl font-bold text-purple-600">{previewData.summary.avg_players_per_tier}</p>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Draft Type</p>
                    <p className="text-lg font-bold text-pink-600 capitalize">{previewData.summary.draft_type}</p>
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {previewData.warnings.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-bold text-gray-900 text-lg">⚠️ Warnings</h3>
                  {previewData.warnings.map((warning: any, idx: number) => (
                    <div key={idx} className={`border rounded-lg p-4 ${
                      warning.severity === 'critical' ? 'bg-red-50 border-red-300 text-red-800' :
                      warning.severity === 'high' ? 'bg-orange-50 border-orange-300 text-orange-800' :
                      warning.severity === 'medium' ? 'bg-yellow-50 border-yellow-300 text-yellow-800' :
                      'bg-blue-50 border-blue-300 text-blue-800'
                    }`}>
                      <p className="font-semibold">{warning.message}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Tier Preview */}
              <div>
                <h3 className="font-bold text-gray-900 mb-4 text-lg">🎯 Tier Distribution - Click to expand</h3>
                <div className="space-y-3">
                  {previewData.tiers.map((tier: Tier, tierIndex: number) => (
                    <div key={tier.tier_id} className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpandedTier(expandedTier === tier.tier_number ? null : tier.tier_number)}
                        className="w-full p-4 bg-gradient-to-r from-gray-50 to-white hover:from-gray-100 hover:to-gray-50 transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-lg font-bold text-indigo-600">
                            {tier.tier_number}
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-gray-900 text-lg">{tier.tier_name}</p>
                            <p className="text-sm text-gray-600">
                              {tier.player_count} players • {tier.min_points}-{tier.max_points} pts (avg: {Math.round(tier.avg_points)})
                            </p>
                          </div>
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
                          <div className="space-y-2">
                            {tier.players.map((player: Player) => (
                              <div 
                                key={player.real_player_id} 
                                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                              >
                                <div className="flex-1">
                                  <p className="font-semibold text-gray-900">{player.player_name}</p>
                                  <p className="text-sm text-gray-600">
                                    {player.real_team_name}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-indigo-600">{player.total_points} pts</p>
                                  <p className="text-xs text-gray-500">
                                    {player.games_played} games • {Number(player.avg_points_per_game).toFixed(1)} avg
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => {
                    setShowPreview(false);
                    setPreviewData(null);
                  }}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !previewData.can_generate}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold rounded-lg hover:from-violet-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? 'Generating...' : '✅ Confirm & Generate Tiers'}
                </button>
              </div>

              {!previewData.can_generate && (
                <p className="text-sm text-red-600 text-center">
                  ⚠️ Cannot generate due to critical warnings. Please adjust settings first.
                </p>
              )}
            </div>
          )}

          {generatedTiers.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Generated Tiers - Click to expand</h3>
                <button
                  onClick={() => {
                    if (confirm('Regenerate tiers? This will discard any manual adjustments.')) {
                      setGeneratedTiers([]);
                      setHasChanges(false);
                    }
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
                >
                  🔄 Regenerate
                </button>
              </div>

              {generatedTiers.map((tier, tierIndex) => (
                <div key={tier.tier_id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedTier(expandedTier === tier.tier_number ? null : tier.tier_number)}
                    className="w-full p-4 bg-gradient-to-r from-gray-50 to-white hover:from-gray-100 hover:to-gray-50 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-lg font-bold text-indigo-600">
                        {tier.tier_number}
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-gray-900 text-lg">{tier.tier_name}</p>
                        <p className="text-sm text-gray-600">
                          {tier.player_count} players • {tier.min_points}-{tier.max_points} pts (avg: {Math.round(tier.avg_points)})
                        </p>
                      </div>
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
                      <div className="space-y-2">
                        {tier.players.map((player, playerIndex) => (
                          <div 
                            key={player.real_player_id} 
                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => movePlayerUp(tierIndex, playerIndex)}
                                disabled={tierIndex === 0}
                                className="p-1 bg-white border border-gray-300 rounded hover:bg-indigo-50 hover:border-indigo-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title="Move to tier above"
                              >
                                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => movePlayerDown(tierIndex, playerIndex)}
                                disabled={tierIndex === generatedTiers.length - 1}
                                className="p-1 bg-white border border-gray-300 rounded hover:bg-indigo-50 hover:border-indigo-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title="Move to tier below"
                              >
                                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">{player.player_name}</p>
                              <p className="text-sm text-gray-600">
                                {player.real_team_name}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-indigo-600">{player.total_points} pts</p>
                              <p className="text-xs text-gray-500">
                                {player.games_played} games • {Number(player.avg_points_per_game).toFixed(1)} avg
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
