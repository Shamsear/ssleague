'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, collection, query, where, getDocs, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { getISTNow, formatISTDateTime, parseISTDate, createISTDateTime } from '@/lib/utils/timezone';

interface Player {
  id: string;
  name: string;
  category: string;
  categoryColor: string;
  categoryPriority: number;
}

interface Matchup {
  id: string;
  home_player_id: string;
  home_player_name: string;
  away_player_id: string;
  away_player_name: string;
  game_duration_minutes: number;
  home_goals?: number;
  away_goals?: number;
}

interface Match {
  id: string;
  round_number: number;
  match_number: number;
  home_team_id: string;
  home_team_name: string;
  away_team_id: string;
  away_team_name: string;
  home_score?: number;
  away_score?: number;
  status: string;
  scheduled_date?: Date;
  leg: string;
  season_id: string;
}

export default function FixtureManagementPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const matchId = params?.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [match, setMatch] = useState<Match | null>(null);
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [homePlayers, setHomePlayers] = useState<Player[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
  const [selectedAwayPlayers, setSelectedAwayPlayers] = useState<{ [key: number]: string }>({});
  const [gameDurations, setGameDurations] = useState<{ [key: number]: number }>({});
  const [canCreate, setCanCreate] = useState(false);
  const [canModify, setCanModify] = useState(false);
  const [canEnterResults, setCanEnterResults] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && matchId) {
      loadMatchData();
    }
  }, [user, matchId]);

  const loadMatchData = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError('');

      // Load match details
      const matchRef = doc(db, 'fixtures', matchId);
      const matchDoc = await getDoc(matchRef);

      if (!matchDoc.exists()) {
        setError('Match not found');
        return;
      }

      const matchData = matchDoc.data();
      const matchObj: Match = {
        id: matchDoc.id,
        round_number: matchData.round_number,
        match_number: matchData.match_number,
        home_team_id: matchData.home_team_id,
        home_team_name: matchData.home_team_name,
        away_team_id: matchData.away_team_id,
        away_team_name: matchData.away_team_name,
        home_score: matchData.home_score,
        away_score: matchData.away_score,
        status: matchData.status || 'scheduled',
        scheduled_date: matchData.scheduled_date?.toDate(),
        leg: matchData.leg || 'first',
        season_id: matchData.season_id,
      };
      setMatch(matchObj);

      // Check permissions and phase
      await checkPermissions(matchObj);

      // Load existing matchups
      await loadMatchups(matchId);

      // Load team players
      await loadTeamPlayers(matchObj.home_team_id, matchObj.away_team_id);

    } catch (error) {
      console.error('Error loading match data:', error);
      setError('Failed to load match data');
    } finally {
      setIsLoading(false);
    }
  };

  const checkPermissions = async (match: Match) => {
    if (!user) return;

    // Get round deadlines and status
    const roundId = `${match.season_id}_r${match.round_number}_${match.leg}`;
    const roundRef = doc(db, 'round_deadlines', roundId);
    const roundDoc = await getDoc(roundRef);

    if (!roundDoc.exists()) {
      setCurrentPhase('Round not configured');
      return;
    }

    const roundData = roundDoc.data();
    const roundStatus = roundData.status || 'pending';
    const scheduledDate = roundData.scheduled_date;

    if (roundStatus !== 'active' || !scheduledDate) {
      setCurrentPhase('Round not active');
      setCanCreate(false);
      setCanModify(false);
      setCanEnterResults(false);
      return;
    }

    // Calculate current phase using IST
    const now = getISTNow();
    const baseDate = parseISTDate(scheduledDate);

    const homeDeadline = createISTDateTime(
      scheduledDate,
      roundData.home_fixture_deadline_time || '17:00'
    );

    const awayDeadline = createISTDateTime(
      scheduledDate,
      roundData.away_fixture_deadline_time || '17:00'
    );

    const resultDate = new Date(baseDate);
    resultDate.setDate(resultDate.getDate() + (roundData.result_entry_deadline_day_offset || 2));
    const resultDeadline = createISTDateTime(
      `${resultDate.getFullYear()}-${String(resultDate.getMonth() + 1).padStart(2, '0')}-${String(resultDate.getDate()).padStart(2, '0')}`,
      roundData.result_entry_deadline_time || '00:30'
    );

    // Determine phase and permissions
    if (now < homeDeadline) {
      setCurrentPhase('Home Fixture Setup');
      setCanCreate(user.uid === match.home_team_id);
      setCanModify(false);
      setCanEnterResults(user.role === 'committee_admin'); // Admin can enter results anytime
    } else if (now < awayDeadline) {
      setCurrentPhase('Fixture Entry');
      setCanCreate(false);
      setCanModify(user.uid === match.away_team_id);
      setCanEnterResults(user.role === 'committee_admin');
    } else if (now < resultDeadline) {
      setCurrentPhase('Result Entry');
      setCanCreate(false);
      setCanModify(false);
      setCanEnterResults(true); // Both teams can enter results
    } else {
      setCurrentPhase('Closed');
      setCanCreate(false);
      setCanModify(false);
      setCanEnterResults(user.role === 'committee_admin'); // Only admin after closing
    }
  };

  const loadMatchups = async (matchId: string) => {
    try {
      const matchupsRef = collection(db, 'match_matchups');
      const q = query(matchupsRef, where('match_id', '==', matchId));
      const snapshot = await getDocs(q);

      const matchupsList: Matchup[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        matchupsList.push({
          id: doc.id,
          home_player_id: data.home_player_id,
          home_player_name: data.home_player_name,
          away_player_id: data.away_player_id,
          away_player_name: data.away_player_name,
          game_duration_minutes: data.game_duration_minutes || 6,
          home_goals: data.home_goals,
          away_goals: data.away_goals,
        });
      });

      setMatchups(matchupsList);
    } catch (error) {
      console.error('Error loading matchups:', error);
    }
  };

  const loadTeamPlayers = async (homeTeamId: string, awayTeamId: string) => {
    try {
      // Load home team players
      const homeTeamRef = doc(db, 'teams', homeTeamId);
      const homeTeamDoc = await getDoc(homeTeamRef);
      
      if (homeTeamDoc.exists()) {
        const homePlayerIds = homeTeamDoc.data().real_players || [];
        const homePlayers = await loadPlayers(homePlayerIds);
        setHomePlayers(homePlayers);
        
        // Initialize game durations
        const durations: { [key: number]: number } = {};
        homePlayers.forEach((_, index) => {
          durations[index] = 6;
        });
        setGameDurations(durations);
      }

      // Load away team players
      const awayTeamRef = doc(db, 'teams', awayTeamId);
      const awayTeamDoc = await getDoc(awayTeamRef);
      
      if (awayTeamDoc.exists()) {
        const awayPlayerIds = awayTeamDoc.data().real_players || [];
        const awayPlayers = await loadPlayers(awayPlayerIds);
        setAwayPlayers(awayPlayers);
      }
    } catch (error) {
      console.error('Error loading team players:', error);
    }
  };

  const loadPlayers = async (playerIds: string[]): Promise<Player[]> => {
    const players: Player[] = [];
    
    for (const playerId of playerIds) {
      try {
        const playerRef = doc(db, 'real_players', playerId);
        const playerDoc = await getDoc(playerRef);
        
        if (playerDoc.exists()) {
          const data = playerDoc.data();
          // Get category info
          const categoryRef = doc(db, 'categories', data.category_id);
          const categoryDoc = await getDoc(categoryRef);
          const categoryData = categoryDoc.exists() ? categoryDoc.data() : { name: 'Unknown', color: 'gray', priority: 999 };
          
          players.push({
            id: playerDoc.id,
            name: data.name,
            category: categoryData.name,
            categoryColor: categoryData.color,
            categoryPriority: categoryData.priority,
          });
        }
      } catch (error) {
        console.error('Error loading player:', error);
      }
    }

    // Sort by category priority
    return players.sort((a, b) => a.categoryPriority - b.categoryPriority);
  };

  const handleCreateMatchups = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!match || !user) return;

    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      // Validate all away players are selected
      const selectedCount = Object.keys(selectedAwayPlayers).length;
      if (selectedCount !== homePlayers.length) {
        setError('Please select an away player for each matchup');
        return;
      }

      // Create matchups
      const batch = [];
      for (let i = 0; i < homePlayers.length; i++) {
        const homePlayer = homePlayers[i];
        const awayPlayerId = selectedAwayPlayers[i];
        const awayPlayer = awayPlayers.find(p => p.id === awayPlayerId);

        if (!awayPlayer) continue;

        const matchupRef = doc(collection(db, 'match_matchups'));
        const matchupData = {
          match_id: matchId,
          home_player_id: homePlayer.id,
          home_player_name: homePlayer.name,
          away_player_id: awayPlayer.id,
          away_player_name: awayPlayer.name,
          game_duration_minutes: gameDurations[i] || 6,
          created_at: Timestamp.fromDate(getISTNow()),
          updated_at: Timestamp.fromDate(getISTNow()),
        };

        batch.push(setDoc(matchupRef, matchupData));
      }

      await Promise.all(batch);

      setSuccess('Matchups created successfully!');
      await loadMatchups(matchId);
      
    } catch (error) {
      console.error('Error creating matchups:', error);
      setError('Failed to create matchups');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveResults = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!match) return;

    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const form = e.target as HTMLFormElement;
      const batch = [];
      let totalHomeGoals = 0;
      let totalAwayGoals = 0;

      // Update each matchup with results
      for (const matchup of matchups) {
        const homeGoalsInput = form.elements.namedItem(`home_goals_${matchup.id}`) as HTMLInputElement;
        const awayGoalsInput = form.elements.namedItem(`away_goals_${matchup.id}`) as HTMLInputElement;

        if (homeGoalsInput && awayGoalsInput) {
          const homeGoals = parseInt(homeGoalsInput.value);
          const awayGoals = parseInt(awayGoalsInput.value);

          totalHomeGoals += homeGoals;
          totalAwayGoals += awayGoals;

          const matchupRef = doc(db, 'match_matchups', matchup.id);
          batch.push(updateDoc(matchupRef, {
            home_goals: homeGoals,
            away_goals: awayGoals,
            updated_at: Timestamp.fromDate(getISTNow()),
          }));
        }
      }

      // Update match with total scores and mark as completed
      const matchRef = doc(db, 'fixtures', matchId);
      batch.push(updateDoc(matchRef, {
        home_score: totalHomeGoals,
        away_score: totalAwayGoals,
        status: 'completed',
        result: totalHomeGoals > totalAwayGoals ? 'home_win' : totalAwayGoals > totalHomeGoals ? 'away_win' : 'draw',
        updated_at: Timestamp.fromDate(getISTNow()),
      }));

      await Promise.all(batch);

      setSuccess('Results saved successfully!');
      await loadMatchData();

    } catch (error) {
      console.error('Error saving results:', error);
      setError('Failed to save results');
    } finally {
      setIsSaving(false);
    }
  };

  const getCategoryStyle = (color: string) => {
    const styles: { [key: string]: string } = {
      red: 'bg-red-600 text-white',
      black: 'bg-gray-900 text-white',
      blue: 'bg-blue-600 text-white',
      white: 'bg-gray-100 text-gray-800 border border-gray-300',
    };
    return styles[color.toLowerCase()] || 'bg-gray-500 text-white';
  };

  const getPhaseColor = (phase: string) => {
    if (phase.includes('Home')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (phase.includes('Fixture')) return 'bg-purple-100 text-purple-700 border-purple-200';
    if (phase.includes('Result')) return 'bg-green-100 text-green-700 border-green-200';
    if (phase.includes('Closed')) return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading match details...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'team' || !match) {
    return null;
  }

  const isHomeTeam = user.uid === match.home_team_id;
  const isAwayTeam = user.uid === match.away_team_id;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard/team/matches"
          className="inline-flex items-center text-[#0066FF] hover:text-[#0052CC] mb-4"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Matches
        </Link>
        <h1 className="text-3xl md:text-4xl font-bold gradient-text">Player Matchups</h1>
        <p className="text-gray-500 mt-1">
          Round {match.round_number} - Match {match.match_number}
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-xl border border-red-200">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-green-100 text-green-700 rounded-xl border border-green-200">
          {success}
        </div>
      )}

      {/* Current Phase */}
      {currentPhase && (
        <div className="mb-6 p-4 rounded-xl border flex items-center justify-between" style={{ borderColor: getPhaseColor(currentPhase).split(' ').pop() }}>
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">Current Phase: </span>
            <span className={`ml-2 px-3 py-1 rounded-full text-sm font-medium ${getPhaseColor(currentPhase)}`}>
              {currentPhase}
            </span>
          </div>
          <span className="text-sm text-gray-600">{formatISTDateTime(getISTNow())}</span>
        </div>
      )}

      {/* Match Header */}
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-6 mb-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-full flex items-center justify-center text-xl font-bold mb-3 shadow-md">
              {match.home_team_name.charAt(0)}
            </div>
            <span className="text-lg font-medium text-center">{match.home_team_name}</span>
            <span className="text-sm text-gray-500">Home Team</span>
            {isHomeTeam && <span className="mt-2 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">Your Team</span>}
          </div>

          <div className="flex flex-col items-center">
            {match.status === 'completed' ? (
              <div className="text-3xl font-bold">
                <span className={match.home_score! > match.away_score! ? 'text-green-600' : 'text-gray-500'}>
                  {match.home_score}
                </span>
                <span className="text-gray-400 mx-2">-</span>
                <span className={match.away_score! > match.home_score! ? 'text-green-600' : 'text-gray-500'}>
                  {match.away_score}
                </span>
              </div>
            ) : (
              <span className="text-2xl text-gray-500">vs</span>
            )}
            <span className="text-sm text-gray-600 mt-2">
              {match.scheduled_date ? match.scheduled_date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Date TBD'}
            </span>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 text-white rounded-full flex items-center justify-center text-xl font-bold mb-3 shadow-md">
              {match.away_team_name.charAt(0)}
            </div>
            <span className="text-lg font-medium text-center">{match.away_team_name}</span>
            <span className="text-sm text-gray-500">Away Team</span>
            {isAwayTeam && <span className="mt-2 text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full">Your Team</span>}
          </div>
        </div>
      </div>

      {/* Existing Matchups */}
      {matchups.length > 0 && (
        <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Player Matchups</h2>
          
          <div className="space-y-4">
            {matchups.map((matchup, index) => (
              <div key={matchup.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                      {matchup.home_player_name.charAt(0)}
                    </div>
                    <div className="text-center sm:text-left">
                      <div className="font-medium">{matchup.home_player_name}</div>
                      <div className="text-xs text-gray-500">Home Player</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-lg font-bold text-gray-600">vs</div>
                    <div className="text-sm text-orange-600">
                      <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {matchup.game_duration_minutes} min
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-center sm:text-right">
                      <div className="font-medium">{matchup.away_player_name}</div>
                      <div className="text-xs text-gray-500">Away Player</div>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                      {matchup.away_player_name.charAt(0)}
                    </div>
                  </div>

                  {matchup.home_goals !== undefined && matchup.away_goals !== undefined && (
                    <div className="text-center">
                      <div className="text-lg font-bold">
                        <span className={matchup.home_goals > matchup.away_goals ? 'text-green-600' : 'text-gray-500'}>
                          {matchup.home_goals}
                        </span>
                        <span className="text-gray-400 mx-1">-</span>
                        <span className={matchup.away_goals > matchup.home_goals ? 'text-green-600' : 'text-gray-500'}>
                          {matchup.away_goals}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">Final Score</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Enter Results */}
          {canEnterResults && matchups.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Enter Match Results
              </h3>
              <form onSubmit={handleSaveResults}>
                <div className="space-y-3">
                  {matchups.map((matchup) => (
                    <div key={matchup.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3 w-full md:w-1/3">
                          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                            {matchup.home_player_name.charAt(0)}
                          </div>
                          <div className="font-medium text-gray-900">{matchup.home_player_name}</div>
                        </div>
                        
                        <div className="flex items-center gap-3 w-full md:w-1/3 justify-center">
                          <input
                            type="number"
                            name={`home_goals_${matchup.id}`}
                            defaultValue={matchup.home_goals}
                            min="0"
                            max="20"
                            className="w-16 px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            required
                          />
                          <span className="text-gray-400 font-semibold">-</span>
                          <input
                            type="number"
                            name={`away_goals_${matchup.id}`}
                            defaultValue={matchup.away_goals}
                            min="0"
                            max="20"
                            className="w-16 px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            required
                          />
                        </div>
                        
                        <div className="flex items-center gap-3 w-full md:w-1/3 md:justify-end">
                          <div className="font-medium text-gray-900">{matchup.away_player_name}</div>
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                            {matchup.away_player_name.charAt(0)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Save Results
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Create Matchups (Home Team) */}
      {canCreate && matchups.length === 0 && homePlayers.length > 0 && (
        <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Create Player Matchups</h2>
          <p className="text-gray-600 mb-6">
            Matchups are arranged by category priority (Red → Black → Blue → White). Select away team players for each matchup.
          </p>
          
          <form onSubmit={handleCreateMatchups}>
            <div className="space-y-4">
              {homePlayers.map((homePlayer, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-700">Matchup {index + 1}</h4>
                    <span className={`text-xs px-2 py-1 rounded-full ${getCategoryStyle(homePlayer.categoryColor)}`}>
                      {homePlayer.category} Priority
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                    {/* Home Player */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Home Player</label>
                      <div className="flex items-center p-3 bg-white rounded-lg border border-gray-200">
                        <div className={`w-8 h-8 rounded-full mr-3 ${getCategoryStyle(homePlayer.categoryColor)}`}></div>
                        <div>
                          <div className="font-medium text-gray-900">{homePlayer.name}</div>
                          <div className="text-xs text-gray-500">{homePlayer.category}</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* VS */}
                    <div className="flex justify-center">
                      <div className="bg-gray-200 rounded-full px-3 py-1 text-xs font-medium text-gray-600">vs</div>
                    </div>
                    
                    {/* Away Player Dropdown */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Away Player</label>
                      <select
                        value={selectedAwayPlayers[index] || ''}
                        onChange={(e) => setSelectedAwayPlayers({ ...selectedAwayPlayers, [index]: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        required
                      >
                        <option value="">Select player...</option>
                        {awayPlayers
                          .filter(p => !Object.values(selectedAwayPlayers).includes(p.id) || selectedAwayPlayers[index] === p.id)
                          .map(player => (
                            <option key={player.id} value={player.id}>
                              {player.name} ({player.category})
                            </option>
                          ))}
                      </select>
                    </div>
                    
                    {/* Game Duration */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Game Duration</label>
                      <select
                        value={gameDurations[index] || 6}
                        onChange={(e) => setGameDurations({ ...gameDurations, [index]: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-orange-300 rounded-lg text-xs focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      >
                        <option value="6">6 min</option>
                        <option value="7">7 min</option>
                        <option value="8">8 min</option>
                        <option value="9">9 min</option>
                        <option value="10">10 min</option>
                        <option value="11">11 min</option>
                        <option value="12">12 min</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center px-6 py-3 bg-[#0066FF] hover:bg-[#0052CC] text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Create Matchups
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Waiting Message */}
      {!canCreate && !canModify && matchups.length === 0 && (
        <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-8 text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Waiting for Match Organization</h3>
          <p className="text-gray-600">Player matchups haven't been organized yet.</p>
          
          {isHomeTeam && (
            <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <p className="text-sm text-blue-700">
                <strong>You're the home team!</strong> You can create the initial player matchups during the Home Fixture Setup phase.
              </p>
            </div>
          )}
          
          {isAwayTeam && (
            <div className="mt-4 p-4 bg-purple-50 rounded-xl border border-purple-200">
              <p className="text-sm text-purple-700">
                <strong>You're the away team!</strong> Once the home team creates matchups, you'll be able to modify them during the Fixture Entry phase.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
