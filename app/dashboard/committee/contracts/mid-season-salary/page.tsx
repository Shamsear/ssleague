'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { getSeasonById } from '@/lib/firebase/seasons';
import { Season } from '@/types/season';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface TeamPreview {
  teamId: string;
  teamName: string;
  playerCount: number;
  totalSalary: number;
  currentBalance: number;
  newBalance: number;
  canAfford: boolean;
  customAmount?: number; // Allow custom override
  players: {
    id: string;
    playerId: string;
    name: string;
    auctionValue: number;
    salary: number;
  }[];
}

export default function MidSeasonSalaryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { isCommitteeAdmin, userSeasonId } = usePermissions();
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [teamsPreview, setTeamsPreview] = useState<TeamPreview[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && !isCommitteeAdmin) {
      router.push('/dashboard');
    }
  }, [user, loading, router, isCommitteeAdmin]);

  useEffect(() => {
    const fetchData = async () => {
      if (!userSeasonId) return;

      try {
        const season = await getSeasonById(userSeasonId);
        setCurrentSeason(season);
      } catch (error) {
        console.error('Error fetching season:', error);
      }
    };

    if (isCommitteeAdmin && userSeasonId) {
      fetchData();
    }
  }, [isCommitteeAdmin, userSeasonId]);

  const loadPreview = async () => {
    if (!userSeasonId) return;

    try {
      setLoadingPreview(true);
      setError(null);

      const response = await fetchWithTokenRefresh(
        `/api/contracts/mid-season-salary/preview?seasonId=${userSeasonId}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load preview');
      }

      setTeamsPreview(data.teams);
    } catch (err: any) {
      setError(err.message || 'Failed to load preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  const toggleTeamSelection = (teamId: string) => {
    setSelectedTeams(prev => {
      const newSet = new Set(prev);
      if (newSet.has(teamId)) {
        newSet.delete(teamId);
      } else {
        newSet.add(teamId);
      }
      return newSet;
    });
  };

  const toggleSelectAllTeams = () => {
    if (selectedTeams.size === teamsPreview.length) {
      setSelectedTeams(new Set());
    } else {
      setSelectedTeams(new Set(teamsPreview.map(t => t.teamId)));
    }
  };

  useEffect(() => {
    if (userSeasonId && currentSeason?.type === 'multi') {
      loadPreview();
    }
  }, [userSeasonId, currentSeason]);

  const handleCustomAmountChange = (teamId: string, amount: string) => {
    const numAmount = parseFloat(amount) || 0;
    setTeamsPreview(prev =>
      prev.map(team =>
        team.teamId === teamId
          ? {
            ...team,
            customAmount: numAmount,
            newBalance: team.currentBalance - numAmount,
            canAfford: team.currentBalance >= numAmount,
          }
          : team
      )
    );
  };

  const resetCustomAmount = (teamId: string) => {
    setTeamsPreview(prev =>
      prev.map(team =>
        team.teamId === teamId
          ? {
            ...team,
            customAmount: undefined,
            newBalance: team.currentBalance - team.totalSalary,
            canAfford: team.currentBalance >= team.totalSalary,
          }
          : team
      )
    );
  };

  // Generate WhatsApp message for a team
  const generateWhatsAppMessage = (team: TeamPreview) => {
    const deductedAmount = team.customAmount ?? team.totalSalary;

    return `🏆 *${currentSeason?.name || 'Season'} - Mid-Season Salary Deduction*

📋 *Team:* ${team.teamName}
⚽ *Players:* ${team.playerCount}

━━━━━━━━━━━━━━━━━━━
💶 *Total Deducted:* €${deductedAmount.toFixed(2)}
💵 *Previous Balance:* €${team.currentBalance.toFixed(2)}
💳 *New Balance:* €${team.newBalance.toFixed(2)}
━━━━━━━━━━━━━━━━━━━

${team.canAfford ? '✅ Payment processed successfully!' : '⚠️ Insufficient balance - Please contact committee'}

_This is an automated salary deduction for the mid-season period._`;
  };

  // Generate all WhatsApp messages
  const generateAllWhatsAppMessages = () => {
    return teamsPreview
      .map(team => {
        const msg = generateWhatsAppMessage(team);
        return `${msg}\n\n${'═'.repeat(40)}\n\n`;
      })
      .join('');
  };

  // Copy single team message
  const copyTeamMessage = async (team: TeamPreview) => {
    const message = generateWhatsAppMessage(team);
    try {
      await navigator.clipboard.writeText(message);
      alert(`✅ WhatsApp message copied for ${team.teamName}!`);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('❌ Failed to copy message');
    }
  };

  // Copy all messages
  const copyAllMessages = async () => {
    const allMessages = generateAllWhatsAppMessages();
    try {
      await navigator.clipboard.writeText(allMessages);
      alert(`✅ All ${teamsPreview.length} WhatsApp messages copied!`);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('❌ Failed to copy messages');
    }
  };

  const handleProcessSalary = async () => {
    if (!currentSeason || !userSeasonId) {
      setError('No season selected');
      return;
    }

    if (selectedTeams.size === 0) {
      setError('Please select at least one team to process');
      return;
    }

    // Check if any SELECTED teams can't afford
    const selectedTeamsData = teamsPreview.filter(t => selectedTeams.has(t.teamId));
    const teamsWithIssues = selectedTeamsData.filter(t => !t.canAfford);
    if (teamsWithIssues.length > 0) {
      const confirmMsg = `⚠️ ${teamsWithIssues.length} selected team(s) have insufficient balance:\n${teamsWithIssues.map(t => `• ${t.teamName}`).join('\n')}\n\nDo you want to proceed anyway?`;
      if (!confirm(confirmMsg)) {
        return;
      }
    }

    try {
      setProcessing(true);
      setError(null);
      setSuccess(null);
      setResult(null);

      // Build custom amounts object for SELECTED teams only
      const hasCustomAmounts = selectedTeamsData.some(t => t.customAmount !== undefined);
      const customAmounts: { [teamId: string]: number } = {};

      if (hasCustomAmounts) {
        selectedTeamsData.forEach(team => {
          if (team.customAmount !== undefined) {
            customAmounts[team.teamId] = team.customAmount;
          }
        });
        console.log('Sending custom amounts:', customAmounts);
      }

      const response = await fetchWithTokenRefresh('/api/contracts/mid-season-salary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId: userSeasonId,
          roundNumber: Math.floor((currentSeason.totalRounds || 38) / 2), // Mid-season
          customAmounts: hasCustomAmounts ? customAmounts : undefined,
          selectedTeamIds: Array.from(selectedTeams), // Send selected team IDs
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process salary deductions');
      }

      setSuccess('Mid-season salary deductions processed successfully!');
      setResult(data);

      // Reload preview
      await loadPreview();
    } catch (err: any) {
      setError(err.message || 'Failed to process salary deductions');
    } finally {
      setProcessing(false);
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

  if (!user || !isCommitteeAdmin) {
    return null;
  }

  if (currentSeason?.type !== 'multi') {
    return (
      <div className="min-h-screen py-8 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="glass rounded-3xl p-8 text-center">
            <p className="text-amber-600">This feature is only available for multi-season types (Season 16+)</p>
          </div>
        </div>
      </div>
    );
  }

  const totalDeduction = teamsPreview.reduce((sum, t) => sum + (t.customAmount ?? t.totalSalary), 0);
  const teamsWithIssues = teamsPreview.filter(t => !t.canAfford).length;

  return (
    <div className="min-h-screen py-4 sm:py-8 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Page Header */}
        <div className="glass rounded-3xl p-6 mb-8 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">Mid-Season Salary Payment</h1>
              <p className="text-gray-600 text-sm md:text-base">
                Process football player salary deductions for {currentSeason?.name}
              </p>
            </div>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 text-sm glass rounded-xl hover:bg-white/90 transition-all"
            >
              Back
            </button>
          </div>
        </div>

        {/* Info Box */}
        <div className="glass rounded-2xl p-6 mb-6 bg-blue-50 border border-blue-200">
          <div className="flex items-start">
            <svg className="w-6 h-6 text-blue-600 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">About Mid-Season Salary</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Football player salaries = 10% of auction value per half-season</li>
                <li>• Deducted from team's Euro balance</li>
                <li>• Review and adjust amounts before processing</li>
                <li>• Process once per half-season</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="glass rounded-2xl p-4 mb-6 bg-green-50 border border-green-200">
            <p className="text-green-800 text-sm font-semibold">{success}</p>
          </div>
        )}
        {error && (
          <div className="glass rounded-2xl p-4 mb-6 bg-red-50 border border-red-200">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Summary Card */}
        {teamsPreview.length > 0 && (
          <div className="glass rounded-3xl p-6 mb-6 shadow-lg">
            <h3 className="text-xl font-bold mb-4">Summary {selectedTeams.size > 0 && `(${selectedTeams.size} Selected)`}</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 rounded-xl">
                <p className="text-sm text-gray-600">Selected Teams</p>
                <p className="text-2xl font-bold text-blue-600">{selectedTeams.size}</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-xl">
                <p className="text-sm text-gray-600">Total Deduction</p>
                <p className="text-2xl font-bold text-purple-600">
                  €{teamsPreview
                    .filter(t => selectedTeams.has(t.teamId))
                    .reduce((sum, t) => sum + (t.customAmount ?? t.totalSalary), 0)
                    .toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-xl">
                <p className="text-sm text-gray-600">Can Afford</p>
                <p className="text-2xl font-bold text-green-600">
                  {teamsPreview.filter(t => selectedTeams.has(t.teamId) && t.canAfford).length}
                </p>
              </div>
              <div className="p-4 bg-red-50 rounded-xl">
                <p className="text-sm text-gray-600">Insufficient Balance</p>
                <p className="text-2xl font-bold text-red-600">
                  {teamsPreview.filter(t => selectedTeams.has(t.teamId) && !t.canAfford).length}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Teams Preview Table */}
        <div className="glass rounded-3xl shadow-lg overflow-hidden mb-6">
          <div className="px-8 py-6 bg-gradient-to-r from-[#9580FF]/5 to-[#9580FF]/10 border-b border-[#9580FF]/20">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-[#9580FF]">Salary Deductions Preview</h3>
              <div className="flex gap-2">
                <button
                  onClick={copyAllMessages}
                  disabled={teamsPreview.length === 0}
                  className="px-4 py-2 text-sm bg-green-500 text-white rounded-xl hover:bg-green-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  📱 Copy All WhatsApp Messages
                </button>
                <button
                  onClick={loadPreview}
                  disabled={loadingPreview}
                  className="px-4 py-2 text-sm bg-white rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  {loadingPreview ? 'Refreshing...' : '🔄 Refresh'}
                </button>
              </div>
            </div>

            {/* Selection Controls */}
            <div className="flex justify-between items-center">
              <button
                onClick={toggleSelectAllTeams}
                disabled={teamsPreview.length === 0}
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all disabled:opacity-50"
              >
                {selectedTeams.size === teamsPreview.length ? '☑️ Deselect All' : '☐ Select All'}
              </button>
              <span className="text-sm font-semibold text-gray-700">
                {selectedTeams.size} of {teamsPreview.length} team(s) selected
              </span>
            </div>
          </div>

          <div className="p-6">
            {loadingPreview ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-300 border-t-[#9580FF] mx-auto mb-4"></div>
                <p className="text-gray-600">Loading preview...</p>
              </div>
            ) : teamsPreview.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">No teams found for this season</p>
              </div>
            ) : (
              <div className="space-y-3">
                {teamsPreview.map((team) => (
                  <div
                    key={team.teamId}
                    className={`border-2 rounded-xl overflow-hidden transition-all ${selectedTeams.has(team.teamId)
                      ? 'border-blue-400 bg-blue-50/50 shadow-md'
                      : team.canAfford
                        ? 'border-green-200 bg-green-50/30'
                        : 'border-red-200 bg-red-50/30'
                      }`}
                  >
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3 flex-1">
                          <input
                            type="checkbox"
                            checked={selectedTeams.has(team.teamId)}
                            onChange={() => toggleTeamSelection(team.teamId)}
                            className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                          />
                          <div>
                            <h4 className="font-bold text-lg">{team.teamName}</h4>
                            <p className="text-sm text-gray-600">{team.playerCount} players</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => copyTeamMessage(team)}
                            className="px-3 py-1 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all"
                            title="Copy WhatsApp message"
                          >
                            📱 WhatsApp
                          </button>
                          <button
                            onClick={() => setExpandedTeam(expandedTeam === team.teamId ? null : team.teamId)}
                            className="px-3 py-1 text-sm bg-white rounded-lg hover:bg-gray-50"
                          >
                            {expandedTeam === team.teamId ? '▼ Hide' : '▶ Details'}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                        <div>
                          <p className="text-gray-600">Current Balance</p>
                          <p className="font-semibold">€{team.currentBalance.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Calculated Salary</p>
                          <p className="font-semibold">€{team.totalSalary.toFixed(2)}</p>
                        </div>
                        <div className="col-span-2 md:col-span-1">
                          <p className="text-gray-600 mb-1">Custom Amount</p>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              step="0.01"
                              value={team.customAmount ?? ''}
                              onChange={(e) => handleCustomAmountChange(team.teamId, e.target.value)}
                              placeholder={team.totalSalary.toFixed(2)}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                            {team.customAmount !== undefined && (
                              <button
                                onClick={() => resetCustomAmount(team.teamId)}
                                className="px-2 py-1 bg-gray-200 rounded text-xs hover:bg-gray-300"
                                title="Reset to calculated"
                              >
                                ↺
                              </button>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-gray-600">New Balance</p>
                          <p className={`font-semibold ${team.canAfford ? 'text-green-600' : 'text-red-600'}`}>
                            €{team.newBalance.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Status</p>
                          <p className={`font-semibold ${team.canAfford ? 'text-green-600' : 'text-red-600'}`}>
                            {team.canAfford ? '✅ OK' : '❌ Insufficient'}
                          </p>
                        </div>
                      </div>

                      {/* Player Details */}
                      {expandedTeam === team.teamId && (
                        <div className="mt-4 pt-4 border-t">
                          <h5 className="font-semibold mb-2">Players:</h5>
                          <div className="space-y-1 max-h-60 overflow-y-auto">
                            {team.players.map((player) => (
                              <div key={player.id} className="flex justify-between text-sm bg-white p-2 rounded">
                                <span>{player.name}</span>
                                <span className="text-gray-600">
                                  €{player.auctionValue} → €{player.salary.toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Button */}
          {teamsPreview.length > 0 && (
            <div className="px-8 py-6 bg-gray-50 border-t flex justify-end gap-4">
              <div className="flex-1 flex items-center">
                {selectedTeams.size === 0 ? (
                  <p className="text-sm text-amber-600">
                    ⚠️ Please select at least one team to process
                  </p>
                ) : teamsPreview.filter(t => selectedTeams.has(t.teamId) && !t.canAfford).length > 0 && (
                  <p className="text-sm text-red-600">
                    ⚠️ {teamsPreview.filter(t => selectedTeams.has(t.teamId) && !t.canAfford).length} selected team(s) have insufficient balance
                  </p>
                )}
              </div>
              <button
                onClick={handleProcessSalary}
                disabled={processing || selectedTeams.size === 0}
                className="px-8 py-3 border border-transparent text-sm font-semibold rounded-2xl text-white bg-gradient-to-r from-[#9580FF] to-[#0066FF] hover:from-[#9580FF]/90 hover:to-[#0066FF]/90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? 'Processing...' : `Process ${selectedTeams.size} Team(s) - €${teamsPreview
                  .filter(t => selectedTeams.has(t.teamId))
                  .reduce((sum, t) => sum + (t.customAmount ?? t.totalSalary), 0)
                  .toFixed(2)}`}
              </button>
            </div>
          )}
        </div>

        {/* Result Details */}
        {result && (
          <div className="glass rounded-3xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Processing Results</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                <span className="text-sm text-gray-600">Teams Processed</span>
                <span className="font-semibold text-gray-900">{result.teamsProcessed || 0}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                <span className="text-sm text-gray-600">Total Salary Deducted</span>
                <span className="font-semibold text-[#9580FF]">€{result.totalDeducted?.toFixed(2) || '0.00'}</span>
              </div>
              {result.errors && result.errors.length > 0 && (
                <div className="p-3 bg-red-50 rounded-xl border border-red-200">
                  <p className="text-sm font-semibold text-red-800 mb-2">Errors:</p>
                  <ul className="text-sm text-red-700 space-y-1">
                    {result.errors.map((err: string, idx: number) => (
                      <li key={idx}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
