'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface FixtureLineupStatus {
  fixture_id: string;
  round_number: number;
  match_number: number;
  home_team_id: string;
  home_team_name: string;
  away_team_id: string;
  away_team_name: string;
  home_lineup_submitted: boolean;
  away_lineup_submitted: boolean;
  home_lineup_count: number;
  away_lineup_count: number;
  home_total_players: number;
  away_total_players: number;
  status: string;
  leg: string;
}

interface TournamentInfo {
  id: string;
  name: string;
  season_id: string;
}

export default function LineupStatusPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [fixtures, setFixtures] = useState<FixtureLineupStatus[]>([]);
  const [tournaments, setTournaments] = useState<TournamentInfo[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Lineup setting modal state
  const [showLineupModal, setShowLineupModal] = useState(false);
  const [selectedFixture, setSelectedFixture] = useState<FixtureLineupStatus | null>(null);
  const [selectedTeamType, setSelectedTeamType] = useState<'home' | 'away'>('home');
  const [availablePlayers, setAvailablePlayers] = useState<any[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<Array<{
    player_id: string;
    player_name: string;
    position: number;
    is_substitute: boolean;
  }>>([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [isSavingLineup, setIsSavingLineup] = useState(false);

  useEffect(() => {
    if (loading) return; // Wait for auth to complete

    if (!user) {
      router.push('/login');
      return;
    }

    if (user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Fetch tournaments
  useEffect(() => {
    const fetchTournaments = async () => {
      if (!user) return;

      try {
        const response = await fetchWithTokenRefresh('/api/tournaments');
        if (response.ok) {
          const data = await response.json();
          setTournaments(data.tournaments || []);
          if (data.tournaments && data.tournaments.length > 0) {
            setSelectedTournament(data.tournaments[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching tournaments:', err);
      }
    };

    fetchTournaments();
  }, [user]);

  // Fetch lineup status
  useEffect(() => {
    const fetchLineupStatus = async () => {
      if (!selectedTournament) return;

      setIsLoading(true);
      setError('');

      try {
        const response = await fetchWithTokenRefresh(
          `/api/tournaments/${selectedTournament}/lineup-status`
        );

        if (response.ok) {
          const data = await response.json();
          setFixtures(data.fixtures || []);
        } else {
          setError('Failed to load lineup status');
        }
      } catch (err) {
        console.error('Error fetching lineup status:', err);
        setError('Failed to load lineup status');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLineupStatus();
  }, [selectedTournament]);

  // Open lineup modal
  const openLineupModal = async (fixture: FixtureLineupStatus, teamType: 'home' | 'away') => {
    setSelectedFixture(fixture);
    setSelectedTeamType(teamType);
    setShowLineupModal(true);
    setSelectedPlayers([]);

    // Fetch available players
    setIsLoadingPlayers(true);
    try {
      const response = await fetchWithTokenRefresh(
        `/api/fixtures/${fixture.fixture_id}/admin-set-lineup?team_type=${teamType}`
      );

      if (response.ok) {
        const data = await response.json();
        setAvailablePlayers(data.players || []);
      } else {
        setError('Failed to load players');
      }
    } catch (err) {
      console.error('Error fetching players:', err);
      setError('Failed to load players');
    } finally {
      setIsLoadingPlayers(false);
    }
  };

  // Toggle player selection
  const togglePlayerSelection = (player: any) => {
    const isSelected = selectedPlayers.some(p => p.player_id === player.player_id);

    if (isSelected) {
      // Remove player and update positions
      const updatedPlayers = selectedPlayers
        .filter(p => p.player_id !== player.player_id)
        .map((p, index) => ({
          ...p,
          position: index + 1,
          is_substitute: index >= 5, // First 5 are playing, rest are subs
        }));
      setSelectedPlayers(updatedPlayers);
    } else {
      if (selectedPlayers.length >= 7) {
        alert('You can only select up to 7 players');
        return;
      }

      // Add player with automatic substitute status based on position
      const newPosition = selectedPlayers.length + 1;
      setSelectedPlayers([...selectedPlayers, {
        player_id: player.player_id,
        player_name: player.player_name,
        position: newPosition,
        is_substitute: newPosition > 5, // Players 6 and 7 are automatically subs
      }]);
    }
  };

  // Save lineup
  const saveLineup = async () => {
    if (selectedPlayers.length < 5 || selectedPlayers.length > 7) {
      alert('Please select between 5 and 7 players');
      return;
    }

    const playingCount = selectedPlayers.filter(p => !p.is_substitute).length;
    if (playingCount !== 5) {
      alert('Please select exactly 5 playing players (the rest will be substitutes)');
      return;
    }

    setIsSavingLineup(true);
    try {
      const response = await fetchWithTokenRefresh(
        `/api/fixtures/${selectedFixture?.fixture_id}/admin-set-lineup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            players: selectedPlayers,
            team_type: selectedTeamType,
          }),
        }
      );

      if (response.ok) {
        alert('Lineup saved successfully');
        setShowLineupModal(false);

        // Refresh lineup status
        const statusResponse = await fetchWithTokenRefresh(
          `/api/tournaments/${selectedTournament}/lineup-status`
        );
        if (statusResponse.ok) {
          const data = await statusResponse.json();
          setFixtures(data.fixtures || []);
        }
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to save lineup');
      }
    } catch (err) {
      console.error('Error saving lineup:', err);
      alert('Failed to save lineup');
    } finally {
      setIsSavingLineup(false);
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

  if (!user || user.role !== 'committee_admin') {
    return null;
  }

  const submittedCount = fixtures.filter(
    f => f.home_lineup_submitted && f.away_lineup_submitted
  ).length;
  const partialCount = fixtures.filter(
    f => (f.home_lineup_submitted && !f.away_lineup_submitted) ||
      (!f.home_lineup_submitted && f.away_lineup_submitted)
  ).length;
  const pendingCount = fixtures.filter(
    f => !f.home_lineup_submitted && !f.away_lineup_submitted
  ).length;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="glass rounded-3xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-dark mb-2">Lineup Submission Status</h1>
              <p className="text-gray-600">Track which teams have submitted their lineups</p>
            </div>
            <Link
              href="/dashboard/committee/team-management/tournament"
              className="px-4 py-2 rounded-xl bg-white/60 text-[#0066FF] hover:bg-white/80 transition-all duration-300 text-sm font-medium flex items-center shadow-sm"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </Link>
          </div>

          {/* Tournament Selector */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Tournament:</label>
            <select
              value={selectedTournament}
              onChange={(e) => setSelectedTournament(e.target.value)}
              className="px-4 py-2 bg-white/70 backdrop-blur-sm border border-white/30 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all duration-200 shadow-sm"
            >
              {tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="glass rounded-2xl p-4 text-center">
            <div className="text-3xl font-bold text-gray-800">{fixtures.length}</div>
            <div className="text-sm text-gray-600 mt-1">Total Fixtures</div>
          </div>
          <div className="glass rounded-2xl p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{submittedCount}</div>
            <div className="text-sm text-gray-600 mt-1">Both Submitted</div>
          </div>
          <div className="glass rounded-2xl p-4 text-center">
            <div className="text-3xl font-bold text-yellow-600">{partialCount}</div>
            <div className="text-sm text-gray-600 mt-1">Partial</div>
          </div>
          <div className="glass rounded-2xl p-4 text-center">
            <div className="text-3xl font-bold text-red-600">{pendingCount}</div>
            <div className="text-sm text-gray-600 mt-1">Pending</div>
          </div>
        </div>

        {/* Fixtures List */}
        <div className="glass rounded-3xl p-6">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading fixtures...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600">{error}</p>
            </div>
          ) : fixtures.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-600">No fixtures found for this tournament</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/80">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Round
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Home Team
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Home Lineup
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Away Team
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Away Lineup
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white/30">
                  {fixtures.map((fixture) => {
                    const bothSubmitted = fixture.home_lineup_submitted && fixture.away_lineup_submitted;
                    const noneSubmitted = !fixture.home_lineup_submitted && !fixture.away_lineup_submitted;

                    return (
                      <tr key={fixture.fixture_id} className="hover:bg-white/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            R{fixture.round_number}
                          </div>
                          <div className="text-xs text-gray-500">{fixture.leg}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {fixture.home_team_name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {fixture.home_lineup_submitted ? (
                            <div className="flex flex-col items-center">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                ✓ Submitted
                              </span>
                              <span className="text-xs text-gray-500 mt-1">
                                {fixture.home_lineup_count} selected
                              </span>
                              <span className="text-xs text-gray-400">
                                {fixture.home_total_players} total
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                ✗ Pending
                              </span>
                              <span className="text-xs text-gray-400 mt-1">
                                {fixture.home_total_players} total
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {fixture.away_team_name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {fixture.away_lineup_submitted ? (
                            <div className="flex flex-col items-center">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                ✓ Submitted
                              </span>
                              <span className="text-xs text-gray-500 mt-1">
                                {fixture.away_lineup_count} selected
                              </span>
                              <span className="text-xs text-gray-400">
                                {fixture.away_total_players} total
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                ✗ Pending
                              </span>
                              <span className="text-xs text-gray-400 mt-1">
                                {fixture.away_total_players} total
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${bothSubmitted
                            ? 'bg-green-100 text-green-800'
                            : noneSubmitted
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                            }`}>
                            {bothSubmitted ? 'Ready' : noneSubmitted ? 'Pending' : 'Partial'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex gap-2 justify-center">
                            {!fixture.home_lineup_submitted && (
                              <button
                                onClick={() => openLineupModal(fixture, 'home')}
                                className="px-3 py-1.5 bg-[#0066FF] text-white rounded-lg hover:bg-[#0052CC] transition-colors text-xs font-medium"
                              >
                                Set Home
                              </button>
                            )}
                            {!fixture.away_lineup_submitted && (
                              <button
                                onClick={() => openLineupModal(fixture, 'away')}
                                className="px-3 py-1.5 bg-[#0066FF] text-white rounded-lg hover:bg-[#0052CC] transition-colors text-xs font-medium"
                              >
                                Set Away
                              </button>
                            )}
                            {bothSubmitted && (
                              <span className="text-xs text-gray-500">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Lineup Setting Modal */}
        {showLineupModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass rounded-3xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-dark">Set Lineup</h2>
                  <p className="text-gray-600 mt-1">
                    {selectedTeamType === 'home' ? selectedFixture?.home_team_name : selectedFixture?.away_team_name}
                    {' - '}Round {selectedFixture?.round_number}
                  </p>
                </div>
                <button
                  onClick={() => setShowLineupModal(false)}
                  className="p-2 hover:bg-white/50 rounded-xl transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {isLoadingPlayers ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading players...</p>
                </div>
              ) : (
                <>
                  {/* Selected Players */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3">
                      Selected Players ({selectedPlayers.length}) - First 5 are playing, rest are subs
                    </h3>
                    {selectedPlayers.length > 0 ? (
                      <div className="space-y-2">
                        {selectedPlayers.map((player, index) => (
                          <div
                            key={player.player_id}
                            className="flex items-center justify-between p-3 bg-white/60 rounded-xl"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-gray-500 w-6">
                                {index + 1}.
                              </span>
                              <span className="font-medium">{player.player_name}</span>
                              {player.is_substitute && (
                                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">
                                  SUB
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => togglePlayerSelection(player)}
                              className="px-3 py-1 bg-red-100 text-red-800 hover:bg-red-200 rounded-lg text-xs font-medium transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No players selected yet</p>
                    )}
                  </div>

                  {/* Available Players */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3">Available Players</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                      {availablePlayers
                        .filter(p => !selectedPlayers.some(sp => sp.player_id === p.player_id))
                        .map((player) => (
                          <button
                            key={player.player_id}
                            onClick={() => togglePlayerSelection(player)}
                            className="p-3 bg-white/40 hover:bg-white/60 rounded-xl text-left transition-colors"
                          >
                            <div className="font-medium">{player.player_name}</div>
                          </button>
                        ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setShowLineupModal(false)}
                      className="px-6 py-2.5 bg-white/60 hover:bg-white/80 rounded-xl font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveLineup}
                      disabled={
                        isSavingLineup ||
                        selectedPlayers.length < 5 ||
                        selectedPlayers.length > 7 ||
                        selectedPlayers.filter(p => !p.is_substitute).length !== 5
                      }
                      className="px-6 py-2.5 bg-[#0066FF] text-white rounded-xl font-medium hover:bg-[#0052CC] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isSavingLineup ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Saving...
                        </>
                      ) : (
                        'Save Lineup'
                      )}
                    </button>
                  </div>

                  {/* Validation Messages */}
                  {selectedPlayers.length > 0 && (selectedPlayers.length < 5 || selectedPlayers.length > 7) && (
                    <div className="mt-4">
                      <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                        ⚠️ Please select between 5 and 7 players (first 5 will be playing, rest will be subs)
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
