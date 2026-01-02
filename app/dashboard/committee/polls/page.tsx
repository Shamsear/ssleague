'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

type PollType = 'POTD' | 'POTW' | 'TOD' | 'TOW';

interface Poll {
  id: string;
  poll_id: string;
  poll_type: string;
  question_en: string;
  options: any[];
  total_votes: number;
  status: string;
  closes_at?: string;
  created_at: string;
  metadata?: any;
}

export default function PollsManagementPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { isCommitteeAdmin, userSeasonId } = usePermissions();

  const [activeTab, setActiveTab] = useState<PollType>('POTD');
  const [currentRound, setCurrentRound] = useState(1);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [maxRounds, setMaxRounds] = useState(14);

  const [polls, setPolls] = useState<Poll[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading_data, setLoadingData] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tournamentId, setTournamentId] = useState<string>('');
  const [availableTournaments, setAvailableTournaments] = useState<Array<{ id: string, name: string }>>([]);
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [newDeadline, setNewDeadline] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && !isCommitteeAdmin) {
      router.push('/dashboard');
    }
  }, [user, loading, router, isCommitteeAdmin]);

  // Fetch available tournaments
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
          setTournamentId(tournaments[0].id);
        }
      } catch (err) {
        console.error('Error fetching tournaments:', err);
      }
    };

    fetchTournaments();
  }, [userSeasonId]);

  // Fetch max rounds
  useEffect(() => {
    const fetchMaxRounds = async () => {
      if (!tournamentId) return;

      try {
        const response = await fetchWithTokenRefresh(`/api/fixtures/season?tournament_id=${tournamentId}`);
        const result = await response.json();

        if (result.fixtures && result.fixtures.length > 0) {
          const maxRound = Math.max(...result.fixtures.map((f: any) => f.round_number || 0));
          setMaxRounds(maxRound);
        }
      } catch (err) {
        console.error('Error fetching rounds:', err);
      }
    };

    fetchMaxRounds();
  }, [tournamentId]);

  useEffect(() => {
    setCurrentWeek(Math.ceil(currentRound / 7));
  }, [currentRound]);

  // Load polls and candidates
  useEffect(() => {
    if (!userSeasonId || !tournamentId) return;
    loadData();
  }, [activeTab, currentRound, currentWeek, userSeasonId, tournamentId]);

  const loadData = async () => {
    if (!userSeasonId) return;

    setLoadingData(true);
    setError(null);

    try {
      // Load existing polls
      const pollParams = new URLSearchParams({
        season_id: userSeasonId,
        poll_type: `award_${activeTab.toLowerCase()}`,
      });

      if (['POTD', 'TOD'].includes(activeTab)) {
        pollParams.append('round_number', currentRound.toString());
      } else if (['POTW', 'TOW'].includes(activeTab)) {
        pollParams.append('week_number', currentWeek.toString());
      }

      console.log('🔍 Fetching polls with params:', pollParams.toString());
      const pollsRes = await fetchWithTokenRefresh(`/api/polls?${pollParams}`);
      const pollsData = await pollsRes.json();
      console.log('📊 Polls response:', pollsData);
      setPolls(pollsData.success && pollsData.data ? pollsData.data : []);


      // Load eligible candidates (same as awards but skip award check for fan polls)
      const candidateParams = new URLSearchParams({
        tournament_id: tournamentId,
        season_id: userSeasonId,
        award_type: activeTab,
        skip_award_check: 'true', // Allow candidates even if admin award was given
      });

      if (['POTD', 'TOD'].includes(activeTab)) {
        candidateParams.append('round_number', currentRound.toString());
      } else if (['POTW', 'TOW'].includes(activeTab)) {
        candidateParams.append('week_number', currentWeek.toString());
      }

      console.log('Fetching candidates:', candidateParams.toString());
      const candidatesRes = await fetchWithTokenRefresh(`/api/awards/eligible?${candidateParams}`);
      const candidatesData = await candidatesRes.json();

      console.log('Candidates response:', candidatesData);

      if (candidatesData.success) {
        setCandidates(candidatesData.data || []);

        // Show specific message if no candidates
        if (!candidatesData.data || candidatesData.data.length === 0) {
          if (candidatesData.message) {
            setError(candidatesData.message);
          } else {
            const period = ['POTD', 'TOD'].includes(activeTab) ? `Round ${currentRound}` : `Week ${currentWeek}`;
            setError(`No completed fixtures found for ${period}. Fixtures must be completed before candidates can be nominated.`);
          }
        }
      } else {
        setError(candidatesData.error || 'Failed to load candidates');
      }

    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load polls data');
    } finally {
      setLoadingData(false);
    }
  };

  const handleCreatePoll = async () => {
    if (!userSeasonId || !user || candidates.length === 0) return;

    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const pollType = `award_${activeTab.toLowerCase()}`;
      const isPlayer = ['POTD', 'POTW'].includes(activeTab);

      // English questions
      const questionEn = isPlayer
        ? `Who should win ${activeTab === 'POTD' ? 'Player of the Day' : 'Player of the Week'}?`
        : `Which team should win ${activeTab === 'TOD' ? 'Team of the Day' : 'Team of the Week'}?`;

      // Malayalam questions
      const questionMl = isPlayer
        ? `${activeTab === 'POTD' ? 'ദിവസത്തെ മികച്ച കളിക്കാരൻ' : 'ആഴ്ചയിലെ മികച്ച കളിക്കാരൻ'} ആരായിരിക്കണം?`
        : `${activeTab === 'TOD' ? 'ദിവസത്തെ മികച്ച ടീം' : 'ആഴ്ചയിലെ മികച്ച ടീം'} ഏതായിരിക്കണം?`;

      const options = candidates.map((candidate, idx) => ({
        id: `option_${idx + 1}`,
        text_en: candidate.player_name || candidate.team_name,
        text_ml: candidate.player_name || candidate.team_name, // Use same name for Malayalam
        player_id: candidate.player_id || null,
        team_id: candidate.team_id || null,
      }));

      const metadata: any = {
        tournament_id: tournamentId,
        award_type: activeTab,
      };

      if (['POTD', 'TOD'].includes(activeTab)) {
        metadata.round_number = currentRound;
      } else {
        metadata.week_number = currentWeek;
      }

      const payload = {
        season_id: userSeasonId,
        poll_type: pollType,
        question_en: questionEn,
        question_ml: questionMl,
        options,
        closes_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        metadata,
      };

      const response = await fetchWithTokenRefresh('/api/polls/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('Poll created successfully!');
        setCandidates([]); // Clear candidates immediately

        // Small delay to ensure database has committed the transaction
        setTimeout(() => {
          loadData();
        }, 500);
      } else {
        setError(result.error || 'Failed to create poll');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create poll');
    } finally {
      setCreating(false);
    }
  };

  const handleClosePoll = async (pollId: string) => {
    if (!confirm('Are you sure you want to close this poll?')) return;

    try {
      const response = await fetchWithTokenRefresh('/api/polls/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poll_id: pollId }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('Poll closed successfully');
        loadData();
      } else {
        setError(result.error || 'Failed to close poll');
      }
    } catch (err: any) {
      setError('Failed to close poll');
    }
  };

  const handleUpdateDeadline = async (pollId: string) => {
    if (!newDeadline) {
      setError('Please select a new deadline');
      return;
    }

    try {
      const response = await fetchWithTokenRefresh(`/api/polls/${pollId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closes_at: newDeadline }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('Poll deadline updated successfully');
        setEditingDeadline(false);
        setNewDeadline('');
        loadData();
      } else {
        setError(result.error || 'Failed to update deadline');
      }
    } catch (err: any) {
      setError('Failed to update deadline');
    }
  };

  const startEditingDeadline = (currentDeadline: string) => {
    // Convert to datetime-local format (YYYY-MM-DDTHH:mm)
    const date = new Date(currentDeadline);
    const localDateTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setNewDeadline(localDateTime);
    setEditingDeadline(true);
  };

  if (loading || !user || !isCommitteeAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  const currentPoll = polls.length > 0 ? polls[0] : null;
  const maxWeeks = Math.ceil(maxRounds / 7);

  return (
    <div className="min-h-screen py-8 px-4 bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            📊 Polls Management
          </h1>
          <p className="text-gray-600">
            Create and manage voting polls for awards
          </p>
        </div>

        {/* Tournament Selector */}
        {availableTournaments.length > 0 && (
          <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl shadow-md p-4">
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              🏟️ Select Tournament
            </label>
            <select
              value={tournamentId}
              onChange={(e) => setTournamentId(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border-2 border-blue-300 rounded-lg font-medium"
            >
              {availableTournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg">
            <p className="text-green-800">{success}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          {[
            { id: 'POTD' as PollType, label: 'POTD', icon: '⭐' },
            { id: 'POTW' as PollType, label: 'POTW', icon: '🌟' },
            { id: 'TOD' as PollType, label: 'TOD', icon: '🏅' },
            { id: 'TOW' as PollType, label: 'TOW', icon: '🏆' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${activeTab === tab.id
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div className="glass rounded-3xl p-6">
          {/* Round/Week Navigator */}
          {['POTD', 'TOD'].includes(activeTab) && (
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
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
                  <div className="flex gap-2">
                    {Array.from({ length: maxRounds }, (_, i) => i + 1).map((round) => (
                      <button
                        key={round}
                        onClick={() => setCurrentRound(round)}
                        className={`px-4 py-2 rounded-lg font-semibold ${currentRound === round
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
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Week
              </label>
              <div className="flex gap-2 flex-wrap">
                {Array.from({ length: maxWeeks }, (_, i) => i + 1).map((week) => (
                  <button
                    key={week}
                    onClick={() => setCurrentWeek(week)}
                    className={`px-6 py-2 rounded-lg font-semibold ${currentWeek === week
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

          {/* Current Poll Display */}
          {currentPoll && (
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-900">Active Poll</p>
                  <p className="text-xl font-bold text-blue-700">{currentPoll.question_en}</p>
                  <p className="text-sm text-blue-600 mt-1">
                    Total Votes: {currentPoll.total_votes} • Status: {currentPoll.status}
                  </p>
                  {currentPoll.closes_at && (
                    <p className="text-sm text-gray-600 mt-1">
                      🕒 Closes: {new Date(currentPoll.closes_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {currentPoll.status === 'active' && !editingDeadline && (
                    <>
                      <button
                        onClick={() => startEditingDeadline(currentPoll.closes_at)}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold"
                      >
                        📅 Edit Deadline
                      </button>
                      <button
                        onClick={() => handleClosePoll(currentPoll.poll_id)}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-semibold"
                      >
                        Close Poll
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Deadline Editor */}
              {editingDeadline && (
                <div className="mb-4 p-4 bg-white rounded-lg border-2 border-blue-400">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Edit Poll Deadline</p>
                  <div className="flex gap-2">
                    <input
                      type="datetime-local"
                      value={newDeadline}
                      onChange={(e) => setNewDeadline(e.target.value)}
                      className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      onClick={() => handleUpdateDeadline(currentPoll.poll_id)}
                      className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-semibold"
                    >
                      ✓ Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingDeadline(false);
                        setNewDeadline('');
                      }}
                      className="px-6 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 font-semibold"
                    >
                      ✕ Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Poll Results */}
              <div className="space-y-2">
                {currentPoll.options.map((option: any) => {
                  const percentage = currentPoll.total_votes > 0
                    ? ((option.votes || 0) / currentPoll.total_votes * 100).toFixed(1)
                    : '0.0';

                  return (
                    <div key={option.id} className="bg-white rounded-lg p-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium">{option.text_en}</span>
                        <span className="text-sm text-gray-600">{option.votes || 0} votes ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Create Poll Section */}
          {!currentPoll && (
            <div className="mb-6">
              {loading_data ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
                </div>
              ) : candidates.length > 0 ? (
                <>
                  <h3 className="text-lg font-bold text-gray-900 mb-3">
                    Create Poll
                  </h3>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-blue-800">
                      📋 {candidates.length} candidates will be added to the poll
                    </p>
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
                    {candidates.map((candidate, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-white border border-gray-200"
                      >
                        <p className="font-bold text-gray-900">
                          {candidate.player_name || candidate.team_name}
                        </p>
                        {candidate.result && (
                          <p className="text-xs text-gray-600 mt-1">{candidate.result}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleCreatePoll}
                    disabled={creating}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    {creating ? 'Creating Poll...' : 'Create Poll'}
                  </button>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-3">ℹ️</div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    No Candidates Available
                  </h3>
                  <p>No eligible candidates for this {['POTD', 'TOD'].includes(activeTab) ? 'round' : 'week'}</p>
                  {error && (
                    <p className="text-sm text-gray-600 mt-2">{error}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Poll Already Exists Message */}
          {currentPoll && (
            <div className="mb-6 text-center py-8 bg-green-50 border border-green-200 rounded-xl">
              <div className="text-4xl mb-3">✅</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Poll Already Created
              </h3>
              <p className="text-gray-600">
                A poll for this {['POTD', 'TOD'].includes(activeTab) ? 'round' : 'week'} already exists
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
