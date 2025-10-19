'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';

interface Matchup {
  home_player_id: string;
  home_player_name: string;
  away_player_id: string;
  away_player_name: string;
  position: number;
  home_goals?: number | null;
  away_goals?: number | null;
  result_entered_by?: string | null;
  result_entered_at?: string | null;
}

interface Fixture {
  id: string;
  season_id: string;
  round_number: number;
  match_number: number;
  home_team_id: string;
  home_team_name: string;
  away_team_id: string;
  away_team_name: string;
  leg: string;
  status: string;
  scheduled_date?: Date;
}

interface RoundDeadlines {
  scheduled_date: string;
  home_fixture_deadline_time: string;
  away_fixture_deadline_time: string;
  result_entry_deadline_day_offset: number;
  result_entry_deadline_time: string;
  status: string;
}

export default function FixturePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const fixtureId = params?.fixtureId as string;

  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [teamId, setTeamId] = useState<string>('');
  const [isHomeTeam, setIsHomeTeam] = useState(false);
  const [roundDeadlines, setRoundDeadlines] = useState<RoundDeadlines | null>(null);
  const [phase, setPhase] = useState<'home_fixture' | 'fixture_entry' | 'result_entry' | 'closed'>('closed');
  const [isLoading, setIsLoading] = useState(true);
  
  // Player data
  const [homePlayers, setHomePlayers] = useState<any[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<any[]>([]);
  
  // Matchup state
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [selectedAwayPlayers, setSelectedAwayPlayers] = useState<{[key: number]: string}>({});
  const [isSaving, setIsSaving] = useState(false);
  const [canCreateMatchups, setCanCreateMatchups] = useState(false);
  const [canEditMatchups, setCanEditMatchups] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Result entry state
  const [matchResults, setMatchResults] = useState<{[key: number]: {home_goals: number, away_goals: number}}>({});
  const [isResultMode, setIsResultMode] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const loadFixture = async () => {
      if (!user || !fixtureId) return;

      try {
        setIsLoading(true);

        // Get fixture from Neon
        const fixtureResponse = await fetch(`/api/fixtures/${fixtureId}`);
        
        if (!fixtureResponse.ok) {
          alert('Fixture not found');
          router.push('/dashboard/team/matches');
          return;
        }

        const { fixture: fixtureData } = await fixtureResponse.json();
        setFixture(fixtureData as Fixture);

        // Get team_id from team_seasons
        const teamSeasonsQuery = query(
          collection(db, 'team_seasons'),
          where('user_id', '==', user.uid),
          where('season_id', '==', fixtureData.season_id),
          where('status', '==', 'registered')
        );

        const teamSeasonsSnapshot = await getDocs(teamSeasonsQuery);
        if (teamSeasonsSnapshot.empty) {
          alert('Team not registered for this season');
          router.push('/dashboard/team/matches');
          return;
        }

        const teamData = teamSeasonsSnapshot.docs[0].data();
        const currentTeamId = teamData.team_id;
        setTeamId(currentTeamId);

        const isHome = fixtureData.home_team_id === currentTeamId;
        const isAway = fixtureData.away_team_id === currentTeamId;
        setIsHomeTeam(isHome);

        if (!isHome && !isAway) {
          alert('You are not part of this fixture');
          router.push('/dashboard/team/matches');
          return;
        }

        // Get round deadlines from Neon
        const roundResponse = await fetch(`/api/round-deadlines?season_id=${fixtureData.season_id}&round_number=${fixtureData.round_number}&leg=${fixtureData.leg || 'first'}`);
        
        if (roundResponse.ok) {
          const { roundDeadline } = await roundResponse.json();
          
          if (roundDeadline) {
            const deadlines = roundDeadline as RoundDeadlines;
            setRoundDeadlines(deadlines);

          // Calculate current phase
          const now = new Date();
          const baseDate = new Date(deadlines.scheduled_date);

          const [homeHour, homeMin] = deadlines.home_fixture_deadline_time.split(':').map(Number);
          const homeDeadline = new Date(baseDate);
          homeDeadline.setHours(homeHour, homeMin, 0, 0);

          const [awayHour, awayMin] = deadlines.away_fixture_deadline_time.split(':').map(Number);
          const awayDeadline = new Date(baseDate);
          awayDeadline.setHours(awayHour, awayMin, 0, 0);

          const resultDeadline = new Date(baseDate);
          resultDeadline.setDate(resultDeadline.getDate() + deadlines.result_entry_deadline_day_offset);
          const [resultHour, resultMin] = deadlines.result_entry_deadline_time.split(':').map(Number);
          resultDeadline.setHours(resultHour, resultMin, 0, 0);

          let currentPhase: typeof phase = 'closed';
          if (now < awayDeadline) {
            // Home fixture phase lasts until away deadline
            currentPhase = 'home_fixture';
          } else if (now < resultDeadline) {
            currentPhase = 'result_entry';
          } else {
            currentPhase = 'closed';
          }

          setPhase(currentPhase);

          // Fetch home and away team players
          const homePlayersQuery = query(
            collection(db, 'realplayer'),
            where('team_id', '==', fixtureData.home_team_id),
            where('season_id', '==', fixtureData.season_id)
          );
          const awayPlayersQuery = query(
            collection(db, 'realplayer'),
            where('team_id', '==', fixtureData.away_team_id),
            where('season_id', '==', fixtureData.season_id)
          );

          const [homeSnap, awaySnap] = await Promise.all([
            getDocs(homePlayersQuery),
            getDocs(awayPlayersQuery)
          ]);

          const homePlayersList = homeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const awayPlayersList = awaySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          setHomePlayers(homePlayersList);
          setAwayPlayers(awayPlayersList);

          // Fetch matchups from Neon database
          const matchupsResponse = await fetch(`/api/fixtures/${fixtureId}/matchups`);
          let matchupsList: any[] = [];
          if (matchupsResponse.ok) {
            const matchupsData = await matchupsResponse.json();
            if (matchupsData.matchups && matchupsData.matchups.length > 0) {
              matchupsList = matchupsData.matchups;
              setMatchups(matchupsList);
            }
          }

          // Determine matchup permissions
          const matchupsExist = matchupsList.length > 0;
          const isAfterHomeDeadline = now >= homeDeadline;

          let canCreate = false;
          let canEditMatch = false;

          if (currentPhase === 'home_fixture') {
            // Home fixture phase lasts until away deadline
            if (!isAfterHomeDeadline) {
              // Before home deadline: only home can create/edit
              if (!matchupsExist) {
                canCreate = isHome;
              } else {
                canEditMatch = isHome;
              }
            } else {
              // After home deadline but before away deadline ("Away phase")
              if (!matchupsExist) {
                // If no matchups exist, both teams can create
                canCreate = true;
              } else {
                // If matchups exist:
                // - Home team can still edit until away deadline
                // - Away team CANNOT edit if home created matchups
                canEditMatch = isHome;
              }
            }
          }

          setCanCreateMatchups(canCreate);
          setCanEditMatchups(canEditMatch);
          }
        }
      } catch (error) {
        console.error('Error loading fixture:', error);
        alert('Failed to load fixture');
      } finally {
        setIsLoading(false);
      }
    };

    loadFixture();
  }, [user, fixtureId, router]);

  const handleCreateMatchups = async () => {
    // Validate all matchups are selected
    if (Object.keys(selectedAwayPlayers).length !== homePlayers.length) {
      alert('Please select an away player for each home player');
      return;
    }

    setIsSaving(true);
    try {
      const matchupsToSave: Matchup[] = homePlayers.map((homePlayer, idx) => ({
        home_player_id: homePlayer.player_id,
        home_player_name: homePlayer.name,
        away_player_id: selectedAwayPlayers[idx],
        away_player_name: awayPlayers.find(p => p.player_id === selectedAwayPlayers[idx])?.name || '',
        position: idx + 1,
      }));

      const response = await fetch(`/api/fixtures/${fixtureId}/matchups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchups: matchupsToSave,
          created_by: user!.uid,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create matchups');
      }

      alert('Matchups created successfully!');
      window.location.reload();
    } catch (error) {
      console.error('Error creating matchups:', error);
      alert('Failed to create matchups');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSwapOpponents = async (position1: number, position2: number) => {
    const newMatchups = [...matchups];
    const temp = newMatchups[position1].away_player_id;
    const tempName = newMatchups[position1].away_player_name;
    
    newMatchups[position1].away_player_id = newMatchups[position2].away_player_id;
    newMatchups[position1].away_player_name = newMatchups[position2].away_player_name;
    newMatchups[position2].away_player_id = temp;
    newMatchups[position2].away_player_name = tempName;

    try {
      const response = await fetch(`/api/fixtures/${fixtureId}/matchups`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchups: newMatchups,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to swap opponents');
      }

      setMatchups(newMatchups);
      alert('Opponents swapped successfully!');
    } catch (error) {
      console.error('Error swapping opponents:', error);
      alert('Failed to swap opponents');
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading fixture...</p>
        </div>
      </div>
    );
  }

  if (!user || !fixture) {
    return null;
  }

  const getPhaseInfo = () => {
    switch (phase) {
      case 'home_fixture':
        return {
          label: 'Home Fixture Phase',
          color: 'blue',
          description: 'Home team can set their lineup',
        };
      case 'fixture_entry':
        return {
          label: 'Fixture Entry Phase',
          color: 'purple',
          description: 'Both teams can set their lineup until submission',
        };
      case 'result_entry':
        return {
          label: 'Result Entry Phase',
          color: 'green',
          description: 'Lineups locked, enter match results',
        };
      case 'closed':
        return {
          label: 'Closed',
          color: 'gray',
          description: 'This fixture is closed',
        };
    }
  };

  const phaseInfo = getPhaseInfo();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <Link
            href="/dashboard/team/matches"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-3 sm:mb-4 font-medium transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm sm:text-base">Back to Matches</span>
          </Link>

          <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6">
            {/* Title and Phase Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
                  Round {fixture.round_number}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm sm:text-base text-gray-600">
                    {fixture.leg === 'first' ? '1st' : '2nd'} Leg
                  </span>
                  <span className="text-gray-400">•</span>
                  <span className="text-sm sm:text-base text-gray-600">Match {fixture.match_number}</span>
                </div>
              </div>
              <span className={`self-start sm:self-auto px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap bg-${phaseInfo.color}-100 text-${phaseInfo.color}-700`}>
                {phaseInfo.label}
              </span>
            </div>

            {/* Teams VS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 items-center mb-4 sm:mb-6">
              <div className="flex sm:block items-center sm:text-center gap-3 sm:gap-0 p-3 sm:p-0 bg-blue-50 sm:bg-transparent rounded-lg sm:rounded-none">
                <div className="text-xs sm:text-sm text-gray-500 sm:mb-2">Home</div>
                <div className="font-bold text-base sm:text-xl lg:text-2xl text-gray-900 truncate">
                  {fixture.home_team_name}
                </div>
              </div>
              <div className="flex sm:block justify-center">
                <div className="text-2xl sm:text-3xl font-bold text-gray-400">VS</div>
              </div>
              <div className="flex sm:block items-center sm:text-center gap-3 sm:gap-0 p-3 sm:p-0 bg-purple-50 sm:bg-transparent rounded-lg sm:rounded-none">
                <div className="text-xs sm:text-sm text-gray-500 sm:mb-2">Away</div>
                <div className="font-bold text-base sm:text-xl lg:text-2xl text-gray-900 truncate">
                  {fixture.away_team_name}
                </div>
              </div>
            </div>

            {/* Phase Info & Deadlines */}
            <div className="p-3 sm:p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg sm:rounded-xl border border-gray-200">
              <p className="text-xs sm:text-sm text-gray-700 font-medium mb-2">{phaseInfo.description}</p>
              {roundDeadlines && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-600">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📅</span>
                    <span>Match: {roundDeadlines.scheduled_date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">⏰</span>
                    <span>Home: {roundDeadlines.home_fixture_deadline_time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">⏰</span>
                    <span>Away: {roundDeadlines.away_fixture_deadline_time}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Matchups Section */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Player Matchups</h2>
            {matchups.length > 0 && (
              <span className="text-xs sm:text-sm text-gray-500">{matchups.length} matches</span>
            )}
          </div>

          {/* Create Matchups */}
          {canCreateMatchups && matchups.length === 0 && (
            <div className="space-y-3 sm:space-y-4">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg sm:rounded-xl p-3 sm:p-4">
                <div className="flex items-start gap-2 sm:gap-3">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs sm:text-sm text-blue-800">
                    <strong className="font-semibold">Create Matchups:</strong> Pair each home player with an away player to set up the match
                  </p>
                </div>
              </div>

              <div className="space-y-2 sm:space-y-3">
                {homePlayers.map((homePlayer, idx) => (
                  <div key={idx} className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-lg sm:rounded-xl p-3 sm:p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-500">Match #{idx + 1}</span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 sm:gap-4 items-center">
                      {/* Home Player */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Home Player</label>
                        <div className="flex items-center gap-2 p-2.5 sm:p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {homePlayer.name.charAt(0)}
                          </div>
                          <div className="font-medium text-sm sm:text-base text-gray-900 truncate">{homePlayer.name}</div>
                        </div>
                      </div>

                      {/* VS Badge */}
                      <div className="hidden sm:flex justify-center">
                        <div className="bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-full px-3 py-1 text-xs font-bold shadow-md">VS</div>
                      </div>
                      <div className="sm:hidden text-center">
                        <div className="inline-block bg-gray-200 text-gray-700 rounded-full px-4 py-1 text-xs font-bold">VS</div>
                      </div>

                      {/* Away Player */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Away Player</label>
                        <select
                          value={selectedAwayPlayers[idx] || ''}
                          onChange={(e) => setSelectedAwayPlayers({ ...selectedAwayPlayers, [idx]: e.target.value })}
                          className="w-full px-3 py-2.5 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all"
                          required
                        >
                          <option value="">Select player...</option>
                          {awayPlayers
                            .filter(p => !Object.values(selectedAwayPlayers).includes(p.player_id) || selectedAwayPlayers[idx] === p.player_id)
                            .map(player => (
                              <option key={player.player_id} value={player.player_id}>
                                {player.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleCreateMatchups}
                disabled={isSaving}
                className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-sm sm:text-base rounded-lg sm:rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </span>
                ) : (
                  'Create Matchups'
                )}
              </button>
            </div>
          )}

        {/* Display/Edit Existing Matchups */}
        {matchups.length > 0 && (
          <div className="space-y-4">
            {/* Edit Button */}
            {canEditMatchups && !isEditMode && (
              <button
                onClick={() => setIsEditMode(true)}
                className="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
              >
                Edit Matchups
              </button>
            )}

            {canEditMatchups && isEditMode ? (
              // Edit Mode
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                  <p className="text-sm text-blue-800">
                    <strong>Edit Matchups:</strong> Change which away player faces which home player
                  </p>
                </div>

                {matchups.map((matchup, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center p-4 bg-gray-50 rounded-xl">
                    {/* Home Player */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Home Player</label>
                      <div className="flex items-center p-3 bg-white rounded-lg border border-gray-200">
                        <div className="font-medium text-gray-900">{matchup.home_player_name}</div>
                      </div>
                    </div>

                    {/* VS */}
                    <div className="flex justify-center">
                      <div className="bg-gray-300 rounded-full px-3 py-1 text-xs font-medium text-gray-700">vs</div>
                    </div>

                    {/* Away Player Dropdown */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Away Player</label>
                      <select
                        value={matchup.away_player_id}
                        onChange={(e) => {
                          const newMatchups = [...matchups];
                          const selectedPlayer = awayPlayers.find(p => p.player_id === e.target.value);
                          newMatchups[idx].away_player_id = e.target.value;
                          newMatchups[idx].away_player_name = selectedPlayer?.name || '';
                          setMatchups(newMatchups);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        {awayPlayers.map(player => (
                          <option key={player.player_id} value={player.player_id}>
                            {player.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Position */}
                    <div className="text-center">
                      <span className="text-xs text-gray-500">Match #{matchup.position}</span>
                    </div>
                  </div>
                ))}

                <div className="flex gap-3">
                  <button
                    onClick={() => setIsEditMode(false)}
                    disabled={isSaving}
                    className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      setIsSaving(true);
                      try {
                        const response = await fetch(`/api/fixtures/${fixtureId}/matchups`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ matchups }),
                        });
                        if (!response.ok) throw new Error('Failed to update matchups');
                        alert('Matchups updated successfully!');
                        setIsEditMode(false);
                        window.location.reload();
                      } catch (error) {
                        console.error('Error updating matchups:', error);
                        alert('Failed to update matchups');
                      } finally {
                        setIsSaving(false);
                      }
                    }}
                    disabled={isSaving}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </>
            ) : phase === 'result_entry' && !isResultMode ? (
              // View Mode with Results + Enter Results Button
              <div className="space-y-4">
                {/* Team Totals & Winner */}
                {matchups.some(m => m.home_goals !== null) && (() => {
                  const homeTotalGoals = matchups.reduce((sum, m) => sum + (m.home_goals ?? 0), 0);
                  const awayTotalGoals = matchups.reduce((sum, m) => sum + (m.away_goals ?? 0), 0);
                  const winner = homeTotalGoals > awayTotalGoals ? 'home' : awayTotalGoals > homeTotalGoals ? 'away' : 'draw';

                  return (
                    <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 border-2 border-blue-300 rounded-2xl p-4 sm:p-6 shadow-xl">
                      <h3 className="text-center text-sm font-semibold text-gray-600 mb-4">Match Result</h3>
                      <div className="grid grid-cols-3 gap-4 items-center">
                        {/* Home Total */}
                        <div className={`text-center p-4 rounded-xl ${
                          winner === 'home' ? 'bg-green-500 text-white shadow-lg scale-105' : 'bg-white text-gray-700'
                        } transition-all`}>
                          <div className="text-xs sm:text-sm font-medium mb-1">{fixture.home_team_name}</div>
                          <div className="text-3xl sm:text-4xl font-bold">{homeTotalGoals}</div>
                          {winner === 'home' && <div className="text-xs mt-1 font-semibold">✓ WINNER</div>}
                        </div>

                        {/* VS or Draw */}
                        <div className="text-center">
                          {winner === 'draw' ? (
                            <div className="bg-yellow-400 text-yellow-900 px-4 py-2 rounded-full font-bold text-sm shadow-lg">
                              DRAW
                            </div>
                          ) : (
                            <div className="text-2xl font-bold text-gray-400">-</div>
                          )}
                        </div>

                        {/* Away Total */}
                        <div className={`text-center p-4 rounded-xl ${
                          winner === 'away' ? 'bg-green-500 text-white shadow-lg scale-105' : 'bg-white text-gray-700'
                        } transition-all`}>
                          <div className="text-xs sm:text-sm font-medium mb-1">{fixture.away_team_name}</div>
                          <div className="text-3xl sm:text-4xl font-bold">{awayTotalGoals}</div>
                          {winner === 'away' && <div className="text-xs mt-1 font-semibold">✓ WINNER</div>}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="space-y-3">
                  {matchups.map((matchup, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto] gap-3 sm:gap-4 items-center p-4 bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl">
                      {/* Home Player & Goals */}
                      <div className="text-center sm:text-right">
                        <p className="text-xs text-gray-500 mb-1">Home Player</p>
                        <p className="font-medium text-gray-900 mb-1">{matchup.home_player_name}</p>
                        {matchup.home_goals !== null && matchup.home_goals !== undefined ? (
                          <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-bold">
                            {matchup.home_goals} {matchup.home_goals === 1 ? 'goal' : 'goals'}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">No result</span>
                        )}
                      </div>

                      {/* VS Badge with Score */}
                      <div className="flex justify-center">
                        {matchup.home_goals !== null && matchup.away_goals !== null ? (
                          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg px-4 py-2 font-bold text-lg shadow-md">
                            {matchup.home_goals} - {matchup.away_goals}
                          </div>
                        ) : (
                          <div className="bg-gray-200 text-gray-600 rounded-full px-4 py-2 text-sm font-medium">VS</div>
                        )}
                      </div>

                      {/* Away Player & Goals */}
                      <div className="text-center sm:text-left">
                        <p className="text-xs text-gray-500 mb-1">Away Player</p>
                        <p className="font-medium text-gray-900 mb-1">{matchup.away_player_name}</p>
                        {matchup.away_goals !== null && matchup.away_goals !== undefined ? (
                          <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 rounded-full font-bold">
                            {matchup.away_goals} {matchup.away_goals === 1 ? 'goal' : 'goals'}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">No result</span>
                        )}
                      </div>

                      {/* Match Number Badge */}
                      <div className="col-span-full sm:col-span-1 text-center">
                        <span className="text-xs text-gray-500">Match #{matchup.position}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Enter/Edit Results Button */}
                <button
                  onClick={() => {
                    // Initialize results from existing data
                    const initialResults: any = {};
                    matchups.forEach((m, idx) => {
                      initialResults[idx] = {
                        home_goals: m.home_goals ?? 0,
                        away_goals: m.away_goals ?? 0
                      };
                    });
                    setMatchResults(initialResults);
                    setIsResultMode(true);
                  }}
                  className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold rounded-xl hover:from-green-700 hover:to-green-800 transition-all shadow-lg"
                >
                  {matchups.some(m => m.home_goals !== null) ? 'Edit Results' : 'Enter Results'}
                </button>
              </div>
            ) : phase === 'result_entry' && isResultMode ? (
              // Result Entry Mode
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-green-800">
                      <strong>Enter Match Results:</strong> Input the goals scored by each player
                    </p>
                  </div>
                </div>

                {/* Live Team Totals Preview */}
                {(() => {
                  const homeTotalGoals = Object.values(matchResults).reduce((sum: number, m: any) => sum + (m?.home_goals ?? 0), 0);
                  const awayTotalGoals = Object.values(matchResults).reduce((sum: number, m: any) => sum + (m?.away_goals ?? 0), 0);
                  const winner = homeTotalGoals > awayTotalGoals ? 'home' : awayTotalGoals > homeTotalGoals ? 'away' : 'draw';

                  return (
                    <div className="bg-gradient-to-r from-blue-100 to-purple-100 border-2 border-blue-300 rounded-xl p-4">
                      <div className="text-center text-xs font-semibold text-gray-600 mb-2">Current Score</div>
                      <div className="grid grid-cols-3 gap-3 items-center">
                        <div className="text-center">
                          <div className="text-xs text-gray-600 mb-1">{fixture.home_team_name}</div>
                          <div className={`text-2xl font-bold ${
                            winner === 'home' ? 'text-green-600' : 'text-gray-700'
                          }`}>{homeTotalGoals}</div>
                        </div>
                        <div className="text-center text-gray-400 font-bold">-</div>
                        <div className="text-center">
                          <div className="text-xs text-gray-600 mb-1">{fixture.away_team_name}</div>
                          <div className={`text-2xl font-bold ${
                            winner === 'away' ? 'text-green-600' : 'text-gray-700'
                          }`}>{awayTotalGoals}</div>
                        </div>
                      </div>
                      {winner === 'draw' && (
                        <div className="text-center mt-2">
                          <span className="text-xs bg-yellow-200 text-yellow-800 px-3 py-1 rounded-full font-semibold">Draw</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="space-y-3">
                  {matchups.map((matchup, idx) => (
                    <div key={idx} className="bg-gradient-to-br from-gray-50 to-white border-2 border-gray-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-gray-700">Match #{matchup.position}</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                        {/* Home Player Goals */}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-2">{matchup.home_player_name}</label>
                          <input
                            type="number"
                            min="0"
                            value={matchResults[idx]?.home_goals ?? 0}
                            onChange={(e) => setMatchResults({
                              ...matchResults,
                              [idx]: {
                                ...matchResults[idx],
                                home_goals: parseInt(e.target.value) || 0
                              }
                            })}
                            className="w-full px-4 py-3 text-center text-lg font-bold border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0"
                          />
                          <p className="text-xs text-gray-500 mt-1 text-center">Goals</p>
                        </div>

                        {/* VS */}
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-400">VS</div>
                        </div>

                        {/* Away Player Goals */}
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-2">{matchup.away_player_name}</label>
                          <input
                            type="number"
                            min="0"
                            value={matchResults[idx]?.away_goals ?? 0}
                            onChange={(e) => setMatchResults({
                              ...matchResults,
                              [idx]: {
                                ...matchResults[idx],
                                away_goals: parseInt(e.target.value) || 0
                              }
                            })}
                            className="w-full px-4 py-3 text-center text-lg font-bold border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            placeholder="0"
                          />
                          <p className="text-xs text-gray-500 mt-1 text-center">Goals</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setIsResultMode(false)}
                    disabled={isSaving}
                    className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      setIsSaving(true);
                      try {
                        const results = matchups.map((m, idx) => ({
                          position: m.position,
                          home_goals: matchResults[idx]?.home_goals ?? 0,
                          away_goals: matchResults[idx]?.away_goals ?? 0,
                        }));

                        const response = await fetch(`/api/fixtures/${fixtureId}/matchups`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            results,
                            entered_by: user!.uid,
                          }),
                        });

                        if (!response.ok) throw new Error('Failed to save results');

                        // Results are now stored in Neon database (matchups table)
                        // Aggregate scores are calculated dynamically by the fixtures API

                        // Update player points and star ratings
                        const pointsResponse = await fetch('/api/realplayers/update-points', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            fixture_id: fixtureId,
                            matchups: results,
                          }),
                        });

                        if (pointsResponse.ok) {
                          const pointsData = await pointsResponse.json();
                          console.log('Player points updated:', pointsData.updates);
                        }

                        alert('Results saved and player points updated successfully!');
                        setIsResultMode(false);
                        window.location.reload();
                      } catch (error) {
                        console.error('Error saving results:', error);
                        alert('Failed to save results');
                      } finally {
                        setIsSaving(false);
                      }
                    }}
                    disabled={isSaving}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold rounded-xl hover:from-green-700 hover:to-green-800 transition-all shadow-lg"
                  >
                    {isSaving ? 'Saving...' : 'Save Results'}
                  </button>
                </div>
              </div>
            ) : (
              // View Only Mode (non result_entry phase)
              <div className="space-y-3">
                {matchups.map((matchup, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center p-4 bg-gray-50 rounded-xl">
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">Home Player</p>
                      <p className="font-medium text-gray-900">{matchup.home_player_name}</p>
                    </div>

                    <div className="flex justify-center">
                      <div className="bg-green-100 text-green-700 rounded-full px-4 py-2 text-sm font-medium">VS</div>
                    </div>

                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">Away Player</p>
                      <p className="font-medium text-gray-900">{matchup.away_player_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Waiting Message */}
        {!canCreateMatchups && matchups.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-gray-700 mb-2">Waiting for Matchups</p>
            <p className="text-xs text-gray-600">
              {phase === 'home_fixture' && 'Home team will create player matchups during this phase'}
              {phase === 'fixture_entry' && 'First team to create matchups gets edit rights'}
              {phase === 'result_entry' && 'Matchups are finalized'}
            </p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
