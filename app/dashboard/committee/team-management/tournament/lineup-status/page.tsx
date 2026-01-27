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
  tournament_name: string;
  season_id: string;
}

export default function LineupStatusPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [fixtures, setFixtures] = useState<FixtureLineupStatus[]>([]);
  const [tournaments, setTournaments] = useState<TournamentInfo[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTournaments, setIsLoadingTournaments] = useState(true);
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

  // View lineup modal state
  const [showViewLineupModal, setShowViewLineupModal] = useState(false);
  const [viewLineupData, setViewLineupData] = useState<any>(null);
  const [isLoadingViewLineup, setIsLoadingViewLineup] = useState(false);

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

      setIsLoadingTournaments(true);
      try {
        const response = await fetchWithTokenRefresh('/api/tournaments');
        if (response.ok) {
          const data = await response.json();
          console.log('Tournaments fetched:', data);
          console.log('Tournaments array:', data.tournaments);
          console.log('Tournaments count:', data.tournaments?.length || 0);
          setTournaments(data.tournaments || []);
          if (data.tournaments && data.tournaments.length > 0) {
            console.log('Setting selected tournament to:', data.tournaments[0].id);
            setSelectedTournament(data.tournaments[0].id);
          } else {
            console.warn('No tournaments found in response');
          }
        } else {
          console.error('Failed to fetch tournaments:', response.status, response.statusText);
          const errorData = await response.json().catch(() => ({}));
          console.error('Error details:', errorData);
          setError('Failed to load tournaments');
        }
      } catch (err) {
        console.error('Error fetching tournaments:', err);
        setError('Failed to load tournaments');
      } finally {
        setIsLoadingTournaments(false);
      }
    };

    fetchTournaments();
  }, [user]);

  // Fetch lineup status
  useEffect(() => {
    const fetchLineupStatus = async () => {
      if (!selectedTournament) {
        console.log('No tournament selected yet, skipping fixture fetch');
        return;
      }

      console.log('Fetching lineup status for tournament:', selectedTournament);
      setIsLoading(true);
      setError('');

      try {
        const response = await fetchWithTokenRefresh(
          `/api/tournaments/${selectedTournament}/lineup-status`
        );

        if (response.ok) {
          const data = await response.json();
          console.log('Fixtures loaded:', data.fixtures?.length || 0);
          setFixtures(data.fixtures || []);
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('Failed to load lineup status:', response.status, errorData);
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

  // View lineup function
  const viewLineup = async (fixture: FixtureLineupStatus, teamType: 'home' | 'away') => {
    setSelectedFixture(fixture);
    setSelectedTeamType(teamType);
    setShowViewLineupModal(true);
    setViewLineupData(null);

    setIsLoadingViewLineup(true);
    try {
      const url = `/api/fixtures/${fixture.fixture_id}/lineup?team_type=${teamType}`;
      console.log('Fetching lineup from:', url);
      
      const response = await fetchWithTokenRefresh(url);

      console.log('Lineup response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Lineup data received:', data);
        setViewLineupData(data);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to load lineup:', response.status, errorData);
        setError('Failed to load lineup: ' + (errorData.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error fetching lineup:', err);
      setError('Failed to load lineup');
    } finally {
      setIsLoadingViewLineup(false);
    }
  };

  // Copy lineup to clipboard in WhatsApp format
  const copyLineupToClipboard = () => {
    if (!viewLineupData || !selectedFixture) return;

    const teamName = selectedTeamType === 'home' 
      ? selectedFixture.home_team_name 
      : selectedFixture.away_team_name;

    const playing = viewLineupData.lineup?.filter((p: any) => !p.is_substitute) || [];
    const substitutes = viewLineupData.lineup?.filter((p: any) => p.is_substitute) || [];

    let message = `*${teamName} - Round ${selectedFixture.round_number}*\n\n`;
    message += `*Starting Lineup:*\n`;
    playing.forEach((player: any, index: number) => {
      message += `${index + 1}. ${player.player_name}\n`;
    });

    if (substitutes.length > 0) {
      message += `\n*Substitutes:*\n`;
      substitutes.forEach((player: any, index: number) => {
        message += `${index + 1}. ${player.player_name}\n`;
      });
    }

    navigator.clipboard.writeText(message);
    alert('Lineup copied to clipboard! You can now paste it in WhatsApp.');
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
        <div className="glass rounded-2xl md:rounded-3xl p-4 md:p-6 mb-4 md:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl md:text-3xl font-bold text-dark mb-1 md:mb-2 truncate">Lineup Submission Status</h1>
              <p className="text-sm md:text-base text-gray-600">Track which teams have submitted their lineups</p>
            </div>
            <Link
              href="/dashboard/committee/team-management/tournament"
              className="px-3 md:px-4 py-2 rounded-xl bg-white/60 text-[#0066FF] hover:bg-white/80 transition-all duration-300 text-xs md:text-sm font-medium flex items-center justify-center shadow-sm flex-shrink-0"
            >
              <svg className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </Link>
          </div>

          {/* Tournament Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <label className="text-xs md:text-sm font-medium text-gray-700 flex-shrink-0">Tournament:</label>
            {isLoadingTournaments ? (
              <div className="flex items-center gap-2 px-3 md:px-4 py-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#0066FF]"></div>
                <span className="text-xs md:text-sm text-gray-600">Loading tournaments...</span>
              </div>
            ) : tournaments.length === 0 ? (
              <div className="px-3 md:px-4 py-2 text-xs md:text-sm text-red-600 bg-red-50 rounded-xl">
                No tournaments found. Please create a tournament first.
              </div>
            ) : (
              <select
                value={selectedTournament}
                onChange={(e) => setSelectedTournament(e.target.value)}
                className="flex-1 sm:flex-initial px-3 md:px-4 py-2 bg-white/70 backdrop-blur-sm border border-white/30 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all duration-200 shadow-sm text-xs md:text-sm min-w-0"
              >
                {tournaments.map((tournament) => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.tournament_name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
          <div className="glass rounded-xl md:rounded-2xl p-3 md:p-4 text-center">
            <div className="text-2xl md:text-3xl font-bold text-gray-800">{fixtures.length}</div>
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
        <div className="glass rounded-3xl p-4 md:p-6">
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
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <div className="inline-block min-w-full align-middle">
                <div className="overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50/80">
                      <tr>
                        <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Round
                        </th>
                        <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Home Team
                        </th>
                        <th className="px-3 md:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Home
                        </th>
                        <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Away Team
                        </th>
                        <th className="px-3 md:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Away
                        </th>
                        <th className="px-3 md:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-3 md:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                            <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                R{fixture.round_number}
                              </div>
                              <div className="text-xs text-gray-500">{fixture.leg}</div>
                            </td>
                            <td className="px-3 md:px-6 py-4">
                              <div className="text-sm font-medium text-gray-900 max-w-[150px] md:max-w-none truncate">
                                {fixture.home_team_name}
                              </div>
                            </td>
                            <td className="px-3 md:px-6 py-4 whitespace-nowrap text-center">
                              {fixture.home_lineup_submitted ? (
                                <div className="flex flex-col items-center">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    ✓
                                  </span>
                                  <span className="text-xs text-gray-500 mt-1 hidden md:block">
                                    {fixture.home_lineup_count}
                                  </span>
                                </div>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  ✗
                                </span>
                              )}
                            </td>
                            <td className="px-3 md:px-6 py-4">
                              <div className="text-sm font-medium text-gray-900 max-w-[150px] md:max-w-none truncate">
                                {fixture.away_team_name}
                              </div>
                            </td>
                            <td className="px-3 md:px-6 py-4 whitespace-nowrap text-center">
                              {fixture.away_lineup_submitted ? (
                                <div className="flex flex-col items-center">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    ✓
                                  </span>
                                  <span className="text-xs text-gray-500 mt-1 hidden md:block">
                                    {fixture.away_lineup_count}
                                  </span>
                                </div>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  ✗
                                </span>
                              )}
                            </td>
                            <td className="px-3 md:px-6 py-4 whitespace-nowrap text-center">
                              <span className={`inline-flex items-center px-2 md:px-3 py-1 rounded-full text-xs font-medium ${bothSubmitted
                                ? 'bg-green-100 text-green-800'
                                : noneSubmitted
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                {bothSubmitted ? 'Ready' : noneSubmitted ? 'Pending' : 'Partial'}
                              </span>
                            </td>
                            <td className="px-3 md:px-6 py-4 text-center">
                              <div className="flex gap-1 md:gap-2 justify-center flex-wrap">
                                {!fixture.home_lineup_submitted && (
                                  <button
                                    onClick={() => openLineupModal(fixture, 'home')}
                                    className="px-2 md:px-3 py-1 md:py-1.5 bg-[#0066FF] text-white rounded-lg hover:bg-[#0052CC] transition-colors text-xs font-medium"
                                  >
                                    Set H
                                  </button>
                                )}
                                {fixture.home_lineup_submitted && (
                                  <button
                                    onClick={() => viewLineup(fixture, 'home')}
                                    className="px-2 md:px-3 py-1 md:py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-medium"
                                  >
                                    View H
                                  </button>
                                )}
                                {!fixture.away_lineup_submitted && (
                                  <button
                                    onClick={() => openLineupModal(fixture, 'away')}
                                    className="px-2 md:px-3 py-1 md:py-1.5 bg-[#0066FF] text-white rounded-lg hover:bg-[#0052CC] transition-colors text-xs font-medium"
                                  >
                                    Set A
                                  </button>
                                )}
                                {fixture.away_lineup_submitted && (
                                  <button
                                    onClick={() => viewLineup(fixture, 'away')}
                                    className="px-2 md:px-3 py-1 md:py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-medium"
                                  >
                                    View A
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
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

        {/* View Lineup Modal */}
        {showViewLineupModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 md:p-4">
            <div className="glass rounded-2xl md:rounded-3xl p-4 md:p-6 max-w-2xl w-full max-h-[95vh] md:max-h-[90vh] overflow-y-auto">
              <div className="flex items-start md:items-center justify-between mb-4 md:mb-6">
                <div className="flex-1 min-w-0 pr-2">
                  <h2 className="text-xl md:text-2xl font-bold text-dark truncate">View Lineup</h2>
                  <p className="text-sm md:text-base text-gray-600 mt-1 truncate">
                    {selectedTeamType === 'home' ? selectedFixture?.home_team_name : selectedFixture?.away_team_name}
                    {' - '}Round {selectedFixture?.round_number}
                  </p>
                </div>
                <button
                  onClick={() => setShowViewLineupModal(false)}
                  className="p-2 hover:bg-white/50 rounded-xl transition-colors flex-shrink-0"
                >
                  <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {isLoadingViewLineup ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading lineup...</p>
                </div>
              ) : viewLineupData ? (
                <>
                  {/* Starting Lineup */}
                  <div className="mb-4 md:mb-6">
                    <h3 className="text-base md:text-lg font-semibold mb-2 md:mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <span className="text-sm md:text-base">Starting Lineup ({viewLineupData.lineup?.filter((p: any) => !p.is_substitute).length || 0})</span>
                    </h3>
                    {viewLineupData.lineup && viewLineupData.lineup.length > 0 ? (
                      <div className="space-y-2">
                        {viewLineupData.lineup
                          ?.filter((p: any) => !p.is_substitute)
                          .sort((a: any, b: any) => a.position - b.position)
                          .map((player: any, index: number) => (
                            <div
                              key={player.player_id}
                              className="flex items-center gap-2 md:gap-3 p-2 md:p-3 bg-white/60 rounded-xl"
                            >
                              <span className="text-xs md:text-sm font-medium text-gray-500 w-5 md:w-6 flex-shrink-0">
                                {index + 1}.
                              </span>
                              <span className="text-sm md:text-base font-medium truncate">{player.player_name}</span>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No starting players found</p>
                    )}
                  </div>

                  {/* Substitutes */}
                  {viewLineupData.lineup?.filter((p: any) => p.is_substitute).length > 0 && (
                    <div className="mb-4 md:mb-6">
                      <h3 className="text-base md:text-lg font-semibold mb-2 md:mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                        <span className="text-sm md:text-base">Substitutes ({viewLineupData.lineup?.filter((p: any) => p.is_substitute).length || 0})</span>
                      </h3>
                      <div className="space-y-2">
                        {viewLineupData.lineup
                          ?.filter((p: any) => p.is_substitute)
                          .sort((a: any, b: any) => a.position - b.position)
                          .map((player: any, index: number) => (
                            <div
                              key={player.player_id}
                              className="flex items-center gap-2 md:gap-3 p-2 md:p-3 bg-yellow-50/60 rounded-xl"
                            >
                              <span className="text-xs md:text-sm font-medium text-gray-500 w-5 md:w-6 flex-shrink-0">
                                {index + 1}.
                              </span>
                              <span className="text-sm md:text-base font-medium truncate flex-1">{player.player_name}</span>
                              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium flex-shrink-0">
                                SUB
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-2 md:gap-3 sm:justify-end">
                    <button
                      onClick={() => setShowViewLineupModal(false)}
                      className="w-full sm:w-auto px-4 md:px-6 py-2 md:py-2.5 bg-white/60 hover:bg-white/80 rounded-xl font-medium transition-colors text-sm md:text-base"
                    >
                      Close
                    </button>
                    <button
                      onClick={copyLineupToClipboard}
                      className="w-full sm:w-auto px-4 md:px-6 py-2 md:py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm md:text-base"
                    >
                      <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span className="hidden sm:inline">Copy for WhatsApp</span>
                      <span className="sm:hidden">Copy</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-600">No lineup data available</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
