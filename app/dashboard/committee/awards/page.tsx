'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

type AwardTab = 'POTD' | 'POTW' | 'TOD' | 'TOW' | 'POTS' | 'TOTS';

interface Award {
  id: string;
  award_type: string;
  player_id?: string;
  player_name?: string;
  team_id?: string;
  team_name?: string;
  round_number?: number;
  week_number?: number;
  performance_stats: any;
  selected_by_name?: string;
  selected_at?: string;
}

interface Candidate {
  player_id?: string;
  player_name?: string;
  team_id?: string;
  team_name?: string;
  performance_stats: any;
  fixture_id?: string;
  result?: string;
}

export default function AwardsManagementPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { isCommitteeAdmin, userSeasonId } = usePermissions();
  
  const [activeTab, setActiveTab] = useState<AwardTab>('POTD');
  const [currentRound, setCurrentRound] = useState(1);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [maxRounds, setMaxRounds] = useState(0);
  
  const [awards, setAwards] = useState<Award[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  
  const [loading_data, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tournamentId, setTournamentId] = useState<string>('');
  const [availableTournaments, setAvailableTournaments] = useState<Array<{id: string, name: string}>>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && !isCommitteeAdmin) {
      router.push('/dashboard');
    }
  }, [user, loading, router, isCommitteeAdmin]);

  // Fetch available tournaments for the season
  useEffect(() => {
    const fetchTournaments = async () => {
      if (!userSeasonId) return;
      
      try {
        const response = await fetchWithTokenRefresh(`/api/tournaments?season_id=${userSeasonId}`);
        const result = await response.json();
        
        if (result.success && result.tournaments && result.tournaments.length > 0) {
          const tournaments = result.tournaments.map((t: any) => ({
            id: t.id,
            name: t.tournament_name || t.id
          }));
          setAvailableTournaments(tournaments);
          
          // Set first tournament as default
          setTournamentId(tournaments[0].id);
          console.log(`🏆 Available tournaments:`, tournaments);
        }
      } catch (err) {
        console.error('Error fetching tournaments:', err);
      }
    };
    
    fetchTournaments();
  }, [userSeasonId]);

  // Fetch max rounds when tournament changes
  useEffect(() => {
    const fetchMaxRounds = async () => {
      if (!tournamentId) return;
      
      try {
        const response = await fetchWithTokenRefresh(`/api/fixtures/season?tournament_id=${tournamentId}`);
        const result = await response.json();
        
        if (result.fixtures && result.fixtures.length > 0) {
          const maxRound = Math.max(...result.fixtures.map((f: any) => f.round_number || 0));
          setMaxRounds(maxRound);
          console.log(`🎮 Found ${maxRound} rounds in tournament ${tournamentId}`);
        } else {
          setMaxRounds(14);
        }
      } catch (err) {
        console.error('Error fetching rounds:', err);
        setMaxRounds(14);
      }
    };
    
    fetchMaxRounds();
  }, [tournamentId]);

  // Calculate current week from round
  useEffect(() => {
    setCurrentWeek(Math.ceil(currentRound / 7));
  }, [currentRound]);

  // Load awards and candidates when tab/round/week changes
  useEffect(() => {
    if (!userSeasonId || !tournamentId) return;
    loadData();
  }, [activeTab, currentRound, currentWeek, userSeasonId, tournamentId]);

  const loadData = async () => {
    if (!userSeasonId) return;
    
    setLoadingData(true);
    setError(null);
    
    try {
      // Load existing award for current context
      const awardParams = new URLSearchParams({
        tournament_id: tournamentId,
        season_id: userSeasonId,
        award_type: activeTab,
      });

      if (['POTD', 'TOD'].includes(activeTab)) {
        awardParams.append('round_number', currentRound.toString());
      } else if (['POTW', 'TOW'].includes(activeTab)) {
        awardParams.append('week_number', currentWeek.toString());
      }

      const awardsRes = await fetchWithTokenRefresh(`/api/awards?${awardParams}`);
      const awardsData = await awardsRes.json();
      setAwards(awardsData.success ? awardsData.data : []);

      // Load eligible candidates
      const candidateParams = new URLSearchParams({
        tournament_id: tournamentId,
        season_id: userSeasonId,
        award_type: activeTab,
      });

      if (['POTD', 'TOD'].includes(activeTab)) {
        candidateParams.append('round_number', currentRound.toString());
      } else if (['POTW', 'TOW'].includes(activeTab)) {
        candidateParams.append('week_number', currentWeek.toString());
      }

      const candidatesRes = await fetchWithTokenRefresh(`/api/awards/eligible?${candidateParams}`);
      const candidatesData = await candidatesRes.json();
      setCandidates(candidatesData.success ? candidatesData.data : []);
      
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load awards data');
    } finally {
      setLoadingData(false);
    }
  };

  const handleSelectAward = async () => {
    if (!selectedCandidate || !userSeasonId || !user) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const candidate = candidates.find(c => 
        (c.player_id === selectedCandidate) || (c.team_id === selectedCandidate)
      );

      if (!candidate) throw new Error('Candidate not found');

      const payload = {
        award_type: activeTab,
        tournament_id: tournamentId,
        season_id: userSeasonId,
        round_number: ['POTD', 'TOD'].includes(activeTab) ? currentRound : null,
        week_number: ['POTW', 'TOW'].includes(activeTab) ? currentWeek : null,
        player_id: candidate.player_id || null,
        player_name: candidate.player_name || null,
        team_id: candidate.team_id || null,
        team_name: candidate.team_name || null,
        performance_stats: candidate.performance_stats,
        selected_by: user.uid,
        selected_by_name: user.displayName || user.email,
        notes: '',
      };

      const response = await fetchWithTokenRefresh('/api/awards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(result.message);
        setSelectedCandidate(null);
        loadData(); // Reload to show updated award
      } else {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save award');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAward = async (awardId: string) => {
    if (!confirm('Are you sure you want to remove this award?')) return;

    try {
      const response = await fetchWithTokenRefresh(`/api/awards?id=${awardId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('Award removed successfully');
        loadData();
      } else {
        setError(result.error);
      }
    } catch (err: any) {
      setError('Failed to delete award');
    }
  };

  if (loading || !user || !isCommitteeAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  const currentAward = awards.length > 0 ? awards[0] : null;
  const maxWeeks = Math.ceil(maxRounds / 7);

  return (
    <div className="min-h-screen py-4 sm:py-8 px-2 sm:px-4 bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            🏆 Awards Management
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Select and manage tournament awards
          </p>
        </div>

        {/* Tournament Selector */}
        {availableTournaments.length > 0 && (
          <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl shadow-md p-4">
            <label className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <span className="text-xl">🏟️</span>
              Select Tournament
            </label>
            <select
              value={tournamentId}
              onChange={(e) => setTournamentId(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border-2 border-blue-300 rounded-lg font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
            >
              {availableTournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.name}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-gray-600">
              Awards are specific to each tournament. Select a tournament to view and manage its awards.
            </p>
          </div>
        )}

        {/* Messages */}
        {error && (
          <div className="mb-4 p-3 sm:p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
            <p className="text-sm sm:text-base text-red-800">{error}</p>
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-3 sm:p-4 bg-green-50 border-l-4 border-green-500 rounded-lg">
            <p className="text-sm sm:text-base text-green-800">{success}</p>
          </div>
        )}

        {/* Tabs - Responsive */}
        <div className="mb-4 sm:mb-6 overflow-x-auto">
          <div className="flex gap-1 sm:gap-2 min-w-max sm:min-w-0">
            {[
              { id: 'POTD' as AwardTab, label: 'POTD', icon: '⭐' },
              { id: 'POTW' as AwardTab, label: 'POTW', icon: '🌟' },
              { id: 'TOD' as AwardTab, label: 'TOD', icon: '🏅' },
              { id: 'TOW' as AwardTab, label: 'TOW', icon: '🏆' },
              { id: 'POTS' as AwardTab, label: 'POTS', icon: '👑' },
              { id: 'TOTS' as AwardTab, label: 'TOTS', icon: '🏆' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold text-xs sm:text-base transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="hidden sm:inline">{tab.icon} </span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="glass rounded-2xl sm:rounded-3xl p-3 sm:p-6">
          {/* Round/Week Navigator */}
          {['POTD', 'TOD'].includes(activeTab) && (
            <div className="mb-4 sm:mb-6">
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                Select Round
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentRound(Math.max(1, currentRound - 1))}
                  disabled={currentRound === 1}
                  className="p-2 bg-gray-200 rounded-lg disabled:opacity-50"
                >
                  ◀
                </button>
                <div className="flex-1 overflow-x-auto">
                  <div className="flex gap-1 sm:gap-2">
                    {maxRounds > 0 && Array.from({ length: maxRounds }, (_, i) => i + 1).map((round) => (
                      <button
                        key={round}
                        onClick={() => setCurrentRound(round)}
                        className={`px-2 sm:px-4 py-1 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap ${
                          currentRound === round
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        R{round}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setCurrentRound(Math.min(maxRounds, currentRound + 1))}
                  disabled={currentRound === maxRounds}
                  className="p-2 bg-gray-200 rounded-lg disabled:opacity-50"
                >
                  ▶
                </button>
              </div>
            </div>
          )}

          {['POTW', 'TOW'].includes(activeTab) && (
            <div className="mb-4 sm:mb-6">
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                Select Week (7 rounds each)
              </label>
              <div className="flex gap-2 flex-wrap">
                {Array.from({ length: maxWeeks }, (_, i) => i + 1).map((week) => (
                  <button
                    key={week}
                    onClick={() => setCurrentWeek(week)}
                    className={`px-3 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-semibold ${
                      currentWeek === week
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Week {week}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Current Award Display */}
          {currentAward && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-green-900">Current Winner</p>
                  <p className="text-base sm:text-xl font-bold text-green-700">
                    {currentAward.player_name || currentAward.team_name}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Selected by {currentAward.selected_by_name}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDeleteAward(currentAward.id)}
                    className="px-3 sm:px-4 py-2 bg-red-500 text-white text-xs sm:text-sm rounded-lg hover:bg-red-600"
                  >
                    🗑️ Remove
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Candidates List */}
          <div className="mb-4 sm:mb-6">
            <h3 className="text-sm sm:text-lg font-bold text-gray-900 mb-3">
              {candidates.length > 0 ? 'Eligible Candidates' : 'No candidates available'}
            </h3>
            
            {loading_data ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3 max-h-96 overflow-y-auto">
                {candidates.map((candidate, idx) => {
                  const candidateId = candidate.player_id || candidate.team_id || `candidate-${idx}`;
                  const isSelected = selectedCandidate === candidateId;
                  
                  return (
                    <div
                      key={candidateId}
                      onClick={() => setSelectedCandidate(candidateId)}
                      className={`p-3 sm:p-4 rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-blue-100 border-2 border-blue-500'
                          : 'bg-white border border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm sm:text-base font-bold text-gray-900">
                            {candidate.player_name || candidate.team_name}
                          </p>
                          {candidate.result && (
                            <p className="text-xs text-gray-600 mt-1">{candidate.result}</p>
                          )}
                          <div className="flex flex-wrap gap-2 mt-2 text-xs">
                            {candidate.performance_stats && Object.entries(candidate.performance_stats).map(([key, value]) => (
                              <span key={key} className="px-2 py-1 bg-gray-100 rounded">
                                {key}: {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}
                              </span>
                            ))}
                          </div>
                        </div>
                        {isSelected && (
                          <span className="text-blue-600 text-xl sm:text-2xl">✓</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Button */}
          {candidates.length > 0 && (
            <button
              onClick={handleSelectAward}
              disabled={!selectedCandidate || submitting}
              className="w-full py-3 sm:py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm sm:text-base font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving...' : currentAward ? 'Update Award' : 'Select Award'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
