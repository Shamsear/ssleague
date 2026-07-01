'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import FixtureTimeline from '@/components/FixtureTimeline';
import { useModal } from '@/hooks/useModal';
import AlertModal from '@/components/modals/AlertModal';
import ConfirmModal from '@/components/modals/ConfirmModal';
import PromptModal from '@/components/modals/PromptModal';
import FixtureShareButton from '@/components/FixtureShareButton';
import CommitteeMatchupCreator from '@/components/CommitteeMatchupCreator';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface Matchup {
  id: number;
  home_player_id: string;
  home_player_name: string;
  away_player_id: string;
  away_player_name: string;
  home_goals: number | null;
  away_goals: number | null;
  position: number;
}

interface Fixture {
  id: string;
  season_id: string;
  tournament_id?: string;
  round_number: number;
  match_number: number;
  home_team_id: string;
  home_team_name: string;
  away_team_id: string;
  away_team_name: string;
  status: string;
  leg: string;
  scheduled_date?: string;
  home_score?: number;
  away_score?: number;
  result?: string;
  motm_player_id?: string;
  motm_player_name?: string;
  match_status_reason?: string;
  created_at?: string;
  created_by_name?: string;
  result_submitted_at?: string;
  result_submitted_by_name?: string;
  scoring_type?: string;
  home_penalty_goals?: number;
  away_penalty_goals?: number;
}

export default function CommitteeFixtureDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const fixtureId = params?.fixtureId as string;

  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showMatchupCreator, setShowMatchupCreator] = useState(false);
  const [showLineupEditor, setShowLineupEditor] = useState<'home' | 'away' | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedScores, setEditedScores] = useState<{ [key: number]: { home: number, away: number } }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingRoundRobin, setIsGeneratingRoundRobin] = useState(false);
  const [knockoutFormat, setKnockoutFormat] = useState<string | null>(null);

  // Player and Result Entry state
  const [homePlayers, setHomePlayers] = useState<any[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<any[]>([]);
  const [motmPlayerId, setMotmPlayerId] = useState<string | null>(null);
  const [homePenaltyGoals, setHomePenaltyGoals] = useState(0);
  const [awayPenaltyGoals, setAwayPenaltyGoals] = useState(0);
  const [nullMatchups, setNullMatchups] = useState<Set<number>>(new Set());
  const [isMarkingNull, setIsMarkingNull] = useState(false);

  // Substitution state
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [subMatchupIndex, setSubMatchupIndex] = useState<number | null>(null);
  const [subSide, setSubSide] = useState<'home' | 'away' | null>(null);
  const [subNewPlayerId, setSubNewPlayerId] = useState<string>('');
  const [subPenaltyAmount, setSubPenaltyAmount] = useState(2);

  // Modal system
  const {
    alertState,
    showAlert,
    closeAlert,
    confirmState,
    showConfirm,
    closeConfirm,
    handleConfirm,
    promptState,
    showPrompt,
    closePrompt,
    handlePromptConfirm,
  } = useModal();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (fixtureId && user?.role === 'committee_admin') {
      fetchFixtureData();
    }
  }, [fixtureId, user]);

  const fetchFixtureData = async () => {
    setIsLoading(true);
    try {
      // Fetch fixture
      const fixtureRes = await fetchWithTokenRefresh(`/api/fixtures/${fixtureId}`);
      const fixtureData = await fixtureRes.json();

      let currentFixture = null;
      if (fixtureData.fixture) {
        currentFixture = fixtureData.fixture;
        setFixture(currentFixture);
        setKnockoutFormat(currentFixture.knockout_format || null);
        setMotmPlayerId(currentFixture.motm_player_id || null);
        setHomePenaltyGoals(currentFixture.home_penalty_goals || 0);
        setAwayPenaltyGoals(currentFixture.away_penalty_goals || 0);
      }

      // Fetch matchups
      const matchupsRes = await fetchWithTokenRefresh(`/api/fixtures/${fixtureId}/matchups`);
      const matchupsData = await matchupsRes.json();

      if (matchupsData.matchups) {
        setMatchups(matchupsData.matchups);

        // Initialize edited scores and null matchups
        const scores: { [key: number]: { home: number, away: number } } = {};
        const nullPositions = new Set<number>();
        matchupsData.matchups.forEach((m: Matchup) => {
          scores[m.position] = {
            home: m.home_goals ?? 0,
            away: m.away_goals ?? 0
          };
          if ((m as any).is_null) {
            nullPositions.add(m.position);
          }
        });
        setEditedScores(scores);
        setNullMatchups(nullPositions);
      }

      // Fetch squad players
      if (currentFixture) {
        const [homePlayersRes, awayPlayersRes] = await Promise.all([
          fetch(`/api/player-seasons?team_id=${currentFixture.home_team_id}&season_id=${currentFixture.season_id}`),
          fetch(`/api/player-seasons?team_id=${currentFixture.away_team_id}&season_id=${currentFixture.season_id}`)
        ]);

        if (homePlayersRes.ok) {
          const homePlayersData = await homePlayersRes.json();
          setHomePlayers(homePlayersData.players || []);
        }
        if (awayPlayersRes.ok) {
          const awayPlayersData = await awayPlayersRes.json();
          setAwayPlayers(awayPlayersData.players || []);
        }
      }
    } catch (error) {
      console.error('Error fetching fixture data:', error);
      showAlert({
        type: 'error',
        title: 'Load Failed',
        message: 'Failed to load fixture data'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeclareWO = async (absentTeam: 'home' | 'away') => {
    const teamName = absentTeam === 'home' ? fixture?.home_team_name : fixture?.away_team_name;
    const confirmed = await showConfirm({
      type: 'warning',
      title: 'Declare Walkover',
      message: `Declare walkover due to ${teamName} being absent?`,
      confirmText: 'Declare WO',
      cancelText: 'Cancel'
    });

    if (!confirmed || !fixture) return;

    setIsSaving(true);
    try {
      const response = await fetchWithTokenRefresh(`/api/fixtures/${fixtureId}/declare-wo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          absent_team: absentTeam,
          declared_by: user?.uid,
          declared_by_name: user?.displayName || user?.email,
        })
      });

      if (response.ok) {
        showAlert({
          type: 'success',
          title: 'Walkover Declared',
          message: 'Walkover declared successfully!'
        });
        fetchFixtureData();
      } else {
        const error = await response.json();
        showAlert({
          type: 'error',
          title: 'Failed',
          message: error.error || 'Unknown error'
        });
      }
    } catch (error) {
      console.error('Error declaring WO:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to declare walkover'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeclareNull = async () => {
    const confirmed = await showConfirm({
      type: 'warning',
      title: 'Declare Match NULL',
      message: 'Declare match NULL due to both teams being absent?',
      confirmText: 'Declare NULL',
      cancelText: 'Cancel'
    });

    if (!confirmed) return;

    setIsSaving(true);
    try {
      const response = await fetchWithTokenRefresh(`/api/fixtures/${fixtureId}/declare-null`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          declared_by: user?.uid,
          declared_by_name: user?.displayName || user?.email,
        })
      });

      if (response.ok) {
        showAlert({
          type: 'success',
          title: 'Match Nullified',
          message: 'Match declared NULL successfully!'
        });
        fetchFixtureData();
      } else {
        const error = await response.json();
        showAlert({
          type: 'error',
          title: 'Failed',
          message: error.error || 'Unknown error'
        });
      }
    } catch (error) {
      console.error('Error declaring NULL:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to declare NULL'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateRoundRobinMatchups = async () => {
    const confirmed = await showConfirm({
      type: 'info',
      title: 'Generate Round Robin Matchups',
      message: 'This will automatically generate all 25 matchups (5x5) based on the submitted lineups. Both lineups will be locked. Continue?',
      confirmText: 'Generate Matchups',
      cancelText: 'Cancel'
    });

    if (!confirmed) return;

    setIsGeneratingRoundRobin(true);
    try {
      const response = await fetchWithTokenRefresh(`/api/fixtures/${fixtureId}/generate-round-robin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showAlert({
          type: 'success',
          title: 'Matchups Generated',
          message: `Successfully generated ${data.matchups_count} round robin matchups!`
        });
        fetchFixtureData();
      } else {
        showAlert({
          type: 'error',
          title: 'Generation Failed',
          message: data.error || 'Failed to generate matchups'
        });
      }
    } catch (error) {
      console.error('Error generating round robin matchups:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to generate round robin matchups'
      });
    } finally {
      setIsGeneratingRoundRobin(false);
    }
  };

  const handleSubstitution = async () => {
    if (subMatchupIndex === null || !subSide || !subNewPlayerId || !fixture) return;

    const matchup = matchups[subMatchupIndex];
    const isHome = subSide === 'home';
    const currentPlayerId = isHome ? matchup.home_player_id : matchup.away_player_id;
    const currentPlayerName = isHome ? matchup.home_player_name : matchup.away_player_name;

    // Get new player details
    const playersList = isHome ? homePlayers : awayPlayers;
    const newPlayer = playersList.find(p => p.player_id === subNewPlayerId);
    if (!newPlayer) {
      showAlert({
        type: 'error',
        title: 'Player Not Found',
        message: 'Selected player not found'
      });
      return;
    }

    const totalPenalty = subPenaltyAmount;

    setIsSaving(true);
    try {
      const newMatchups = [...matchups];
      if (isHome) {
        newMatchups[subMatchupIndex].home_original_player_id = currentPlayerId;
        newMatchups[subMatchupIndex].home_original_player_name = currentPlayerName;
        newMatchups[subMatchupIndex].home_player_id = subNewPlayerId;
        newMatchups[subMatchupIndex].home_player_name = newPlayer.player_name;
        (newMatchups[subMatchupIndex] as any).home_substituted = true;
        (newMatchups[subMatchupIndex] as any).home_sub_penalty = totalPenalty;
      } else {
        newMatchups[subMatchupIndex].away_original_player_id = currentPlayerId;
        newMatchups[subMatchupIndex].away_original_player_name = currentPlayerName;
        newMatchups[subMatchupIndex].away_player_id = subNewPlayerId;
        newMatchups[subMatchupIndex].away_player_name = newPlayer.player_name;
        (newMatchups[subMatchupIndex] as any).away_substituted = true;
        (newMatchups[subMatchupIndex] as any).away_sub_penalty = totalPenalty;
      }

      const response = await fetchWithTokenRefresh(`/api/fixtures/${fixtureId}/matchups`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchups: newMatchups }),
      });

      if (!response.ok) throw new Error('Failed to substitute');

      setMatchups(newMatchups);
      setIsSubModalOpen(false);
      setSubMatchupIndex(null);
      setSubSide(null);
      setSubNewPlayerId('');

      showAlert({
        type: 'success',
        title: 'Substitution Complete',
        message: `${newPlayer.player_name} substituted in successfully!\n+${totalPenalty} penalty goals awarded to opponent.`
      });
      fetchFixtureData(); // reload
    } catch (error) {
      console.error('Error substituting:', error);
      showAlert({
        type: 'error',
        title: 'Substitution Failed',
        message: 'Failed to substitute player'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleNullMatchup = async (position: number) => {
    if (!user || !fixtureId) return;

    const isCurrentlyNull = nullMatchups.has(position);
    const newIsNull = !isCurrentlyNull;

    try {
      setIsMarkingNull(true);

      const response = await fetchWithTokenRefresh(`/api/fixtures/${fixtureId}/matchups/mark-null`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchup_positions: [position],
          is_null: newIsNull,
          updated_by: user.uid,
          updated_by_name: user.displayName || user.email
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to toggle null status');
      }

      // Update local state
      const newNullMatchups = new Set(nullMatchups);
      if (newIsNull) {
        newNullMatchups.add(position);
      } else {
        newNullMatchups.delete(position);
      }
      setNullMatchups(newNullMatchups);

      // Update matchups array
      setMatchups(prev => prev.map(m =>
        m.position === position ? { ...m, is_null: newIsNull } as any : m
      ));

      showAlert({
        type: 'success',
        title: newIsNull ? 'Matchup Marked as NULL' : 'Matchup Unmarked',
        message: newIsNull
          ? 'This matchup will not count in player stats but will count for salary and team stats'
          : 'This matchup will now count in player stats'
      });
    } catch (error) {
      console.error('Error marking matchups as null:', error);
      showAlert({
        type: 'error',
        title: 'Failed',
        message: error instanceof Error ? error.message : 'Failed to toggle null status'
      });
    } finally {
      setIsMarkingNull(false);
    }
  };

  const calculatePreviewScores = () => {
    if (!fixture) return { home: 0, away: 0 };

    const scoringType = fixture.scoring_type || 'goals';

    // Get substitution penalties from matchups
    const totalHomeSubPenalty = matchups.reduce((sum, m) => sum + (Number((m as any).home_sub_penalty) || 0), 0);
    const totalAwaySubPenalty = matchups.reduce((sum, m) => sum + (Number((m as any).away_sub_penalty) || 0), 0);

    let homeScore = 0;
    let awayScore = 0;

    if (scoringType === 'wins') {
      // Win-based: 3 points for matchup win, 1 for draw
      matchups.forEach((m) => {
        const hGoals = editedScores[m.position]?.home ?? m.home_goals ?? 0;
        const aGoals = editedScores[m.position]?.away ?? m.away_goals ?? 0;
        
        const homeMatchupScore = hGoals + (Number((m as any).away_sub_penalty) || 0);
        const awayMatchupScore = aGoals + (Number((m as any).home_sub_penalty) || 0);

        if (homeMatchupScore > awayMatchupScore) {
          homeScore += 3;
        } else if (awayMatchupScore > homeMatchupScore) {
          awayScore += 3;
        } else {
          homeScore += 1;
          awayScore += 1;
        }
      });
      homeScore += homePenaltyGoals;
      awayScore += awayPenaltyGoals;
    } else {
      // Goal-based: sum of matchup goals + sub penalties + penalty goals
      matchups.forEach((m) => {
        homeScore += editedScores[m.position]?.home ?? m.home_goals ?? 0;
        awayScore += editedScores[m.position]?.away ?? m.away_goals ?? 0;
      });
      homeScore += totalAwaySubPenalty + homePenaltyGoals;
      awayScore += totalHomeSubPenalty + awayPenaltyGoals;
    }

    return { home: homeScore, away: awayScore };
  };

  const handleSaveResults = async () => {
    if (!fixture) return;

    let reason = 'Initial result submission by admin';
    
    if (fixture.status === 'completed') {
      const promptReason = await showPrompt({
        title: 'Edit Reason',
        message: 'Enter reason for editing result (optional):',
        placeholder: 'Reason for edit...',
        defaultValue: ''
      });
      if (promptReason === null) return; // User cancelled
      reason = promptReason || 'Result corrected by committee admin';
    }

    const confirmed = await showConfirm({
      type: 'warning',
      title: fixture.status === 'completed' ? 'Save Changes' : 'Submit Results',
      message: fixture.status === 'completed' 
        ? 'Save the edited results? This will revert old stats and apply new ones.'
        : 'Are you sure you want to submit these results and complete the fixture?',
      confirmText: fixture.status === 'completed' ? 'Save Changes' : 'Submit Results',
      cancelText: 'Cancel'
    });

    if (!confirmed) return;

    setIsSaving(true);
    try {
      // Prepare edited matchups
      const editedMatchups = matchups.map(m => ({
        position: m.position,
        home_player_id: m.home_player_id,
        home_player_name: m.home_player_name,
        away_player_id: m.away_player_id,
        away_player_name: m.away_player_name,
        home_goals: editedScores[m.position]?.home ?? m.home_goals ?? 0,
        away_goals: editedScores[m.position]?.away ?? m.away_goals ?? 0,
      }));

      // Find MOTM Player Name from matchups
      const motmPlayerName = motmPlayerId
        ? matchups.find(m => m.home_player_id === motmPlayerId)?.home_player_name ||
          matchups.find(m => m.away_player_id === motmPlayerId)?.away_player_name || null
        : null;

      const response = await fetchWithTokenRefresh(`/api/fixtures/${fixtureId}/edit-result`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchups: editedMatchups,
          motm_player_id: motmPlayerId,
          motm_player_name: motmPlayerName,
          home_penalty_goals: homePenaltyGoals,
          away_penalty_goals: awayPenaltyGoals,
          edited_by: user?.uid,
          edited_by_name: user?.displayName || user?.email,
          edit_reason: reason
        })
      });

      if (response.ok) {
        showAlert({
          type: 'success',
          title: fixture.status === 'completed' ? 'Results Updated' : 'Results Submitted',
          message: fixture.status === 'completed'
            ? 'Results updated successfully! Stats have been recalculated.'
            : 'Results submitted successfully! Fixture is marked as completed.'
        });
        setIsEditMode(false);
        fetchFixtureData(); // Reload data
      } else {
        const error = await response.json();
        showAlert({
          type: 'error',
          title: 'Save Failed',
          message: error.error || 'Unknown error'
        });
      }
    } catch (error) {
      console.error('Error saving results:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to save results. Please try again.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading fixture...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'committee_admin') {
    return null;
  }

  if (!fixture) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Fixture Not Found</h1>
          <Link href="/dashboard/committee/team-management/tournament" className="text-blue-600 mt-4 inline-block">
            ← Back to Tournament
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/committee/team-management/tournament"
          className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-4"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Tournament
        </Link>
        <h1 className="text-3xl font-bold gradient-text">Committee Fixture Management</h1>
        <div className="flex items-center gap-3 mt-2">
          <p className="text-gray-600">
            {(fixture as any).knockout_round ? (
              <>
                {(fixture as any).knockout_round === 'quarter_finals' && 'quarter_finals' && '⚔️ Quarter Finals'}
                {(fixture as any).knockout_round === 'semi_finals' && '🏆 Semi Finals'}
                {(fixture as any).knockout_round === 'finals' && '👑 Finals'}
                {(fixture as any).knockout_round === 'third_place' && '🥉 Third Place Playoff'}
                {' • '}
              </>
            ) : (
              `Round ${fixture.round_number} • `
            )}
            Match {fixture.match_number} • {fixture.leg === 'first' ? '1st Leg' : '2nd Leg'}
          </p>
          {(fixture as any).knockout_round && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              KNOCKOUT
            </span>
          )}
          {(fixture as any).scoring_system && (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${(fixture as any).scoring_system === 'wins'
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-blue-100 text-blue-800 border border-blue-300'
              }`}>
              {(fixture as any).scoring_system === 'wins' ? (
                <>🏆 Win-Based Scoring</>
              ) : (
                <>⚽ Goal-Based Scoring</>
              )}
            </span>
          )}
          {fixture.scoring_type && (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${fixture.scoring_type === 'wins'
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : fixture.scoring_type === 'hybrid'
                  ? 'bg-purple-100 text-purple-800 border border-purple-300'
                  : 'bg-blue-100 text-blue-800 border border-blue-300'
              }`}>
              {fixture.scoring_type === 'wins' ? (
                <>🏆 Win-Based Scoring</>
              ) : fixture.scoring_type === 'hybrid' ? (
                <>🎯 Hybrid Scoring</>
              ) : (
                <>⚽ Goal-Based Scoring</>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Fixture Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Match Card */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border-2 border-purple-100">
            <div className="flex justify-between items-start mb-6">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-2xl font-bold text-gray-900">{fixture.home_team_name}</h2>
                  <button
                    onClick={() => setShowLineupEditor('home')}
                    className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 font-medium"
                  >
                    ✏️ Edit Lineup
                  </button>
                </div>
                <p className="text-sm text-gray-500">Home Team</p>
              </div>
              <div className="text-center px-6">
                {isEditMode ? (
                  <div>
                    <div className="text-4xl font-extrabold text-orange-600 animate-pulse">
                      {calculatePreviewScores().home} : {calculatePreviewScores().away}
                    </div>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
                      Preview Score
                    </span>
                  </div>
                ) : (
                  <div>
                    <div className="text-4xl font-bold text-purple-600">
                      {fixture.home_score ?? '-'} : {fixture.away_score ?? '-'}
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${fixture.status === 'completed' ? 'bg-green-100 text-green-700' :
                      fixture.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                      {fixture.status}
                    </span>
                  </div>
                )}
                {matchups.length === 0 && fixture.status !== 'completed' && (
                  <button
                    onClick={() => setShowMatchupCreator(true)}
                    className="mt-3 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm rounded-lg hover:from-green-700 hover:to-emerald-700 font-medium block mx-auto"
                  >
                    ⚔️ Add Matchups
                  </button>
                )}
              </div>
              <div className="flex-1 text-right">
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => setShowLineupEditor('away')}
                    className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium"
                  >
                    ✏️ Edit Lineup
                  </button>
                  <h2 className="text-2xl font-bold text-gray-900">{fixture.away_team_name}</h2>
                </div>
                <p className="text-sm text-gray-500">Away Team</p>
              </div>
            </div>

            {fixture.match_status_reason && (
              <div className={`p-3 rounded-lg mb-4 ${fixture.match_status_reason.includes('wo') ? 'bg-orange-100 border-l-4 border-orange-500' :
                'bg-gray-100 border-l-4 border-gray-500'
                }`}>
                <p className="font-semibold text-sm">
                  {fixture.match_status_reason === 'wo_home_absent' && '⚠️ Walkover - Home team absent'}
                  {fixture.match_status_reason === 'wo_away_absent' && '⚠️ Walkover - Away team absent'}
                  {fixture.match_status_reason === 'null_both_absent' && '❌ Match NULL - Both teams absent'}
                </p>
              </div>
            )}

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mt-4 pt-4 border-t">
              <div>
                <strong>Created:</strong> {fixture.created_at ? new Date(fixture.created_at).toLocaleString() : 'N/A'}
                {fixture.created_by_name && <span className="text-xs block">by {fixture.created_by_name}</span>}
              </div>
              {fixture.result_submitted_at && (
                <div>
                  <strong>Result Submitted:</strong> {new Date(fixture.result_submitted_at).toLocaleString()}
                  {fixture.result_submitted_by_name && <span className="text-xs block">by {fixture.result_submitted_by_name}</span>}
                </div>
              )}
            </div>
          </div>

          {/* Matchups */}
          {matchups.length > 0 && (
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex justify-between items-center mb-4 border-b pb-4">
                <h3 className="text-xl font-bold">Individual Matchups</h3>
                {!isEditMode && (
                  <button
                    onClick={() => setIsEditMode(true)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    {fixture.status === 'completed' ? '✏️ Edit Results' : '⚽ Enter Results'}
                  </button>
                )}
                {isEditMode && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIsEditMode(false);
                        fetchFixtureData();
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveResults}
                      disabled={isSaving}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {isSaving ? 'Saving...' : fixture.status === 'completed' ? '💾 Save Changes' : '🚀 Submit Results'}
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {matchups.map((matchup, idx) => (
                  <div key={matchup.id} className="bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition-colors border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-500">Match #{matchup.position}</span>
                        {nullMatchups.has(matchup.position) && (
                          <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded">NULL</span>
                        )}
                      </div>
                      {isEditMode && (
                        <div className="flex items-center gap-2">
                          {/* NULL checkbox */}
                          <label className="flex items-center gap-1.5 px-2 py-1 bg-white hover:bg-gray-100 rounded text-xs cursor-pointer border">
                            <input
                              type="checkbox"
                              checked={nullMatchups.has(matchup.position)}
                              onChange={() => handleToggleNullMatchup(matchup.position)}
                              disabled={isMarkingNull}
                              className="w-3.5 h-3.5 text-red-600 border-gray-300 rounded focus:ring-red-500 cursor-pointer"
                            />
                            <span className="text-gray-700 font-medium">NULL</span>
                          </label>
                          {/* Sub Home */}
                          <button
                            onClick={() => {
                              setSubMatchupIndex(idx);
                              setSubSide('home');
                              setSubNewPlayerId('');
                              setSubPenaltyAmount(2);
                              setIsSubModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded border border-blue-200"
                            title="Substitute Home Player"
                          >
                            Sub Home
                          </button>
                          {/* Sub Away */}
                          <button
                            onClick={() => {
                              setSubMatchupIndex(idx);
                              setSubSide('away');
                              setSubNewPlayerId('');
                              setSubPenaltyAmount(2);
                              setIsSubModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold rounded border border-purple-200"
                            title="Substitute Away Player"
                          >
                            Sub Away
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Show substitution indicator */}
                    {((matchup as any).home_substituted || (matchup as any).away_substituted) && (
                      <div className="mb-3 p-2.5 bg-yellow-50 border border-yellow-200 rounded text-xs">
                        {(matchup as any).home_substituted && (
                          <div className="text-yellow-800">
                            🔁 Home: {(matchup as any).home_original_player_name} → {matchup.home_player_name} (+{(matchup as any).home_sub_penalty} penalty to away)
                          </div>
                        )}
                        {(matchup as any).away_substituted && (
                          <div className="text-yellow-800">
                            🔁 Away: {(matchup as any).away_original_player_name} → {matchup.away_player_name} (+{(matchup as any).away_sub_penalty} penalty to home)
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{matchup.home_player_name}</p>
                      </div>
                      <div className="flex items-center gap-2 mx-4">
                        {isEditMode ? (
                          <>
                            <input
                              type="number"
                              min="0"
                              value={editedScores[matchup.position]?.home ?? 0}
                              onChange={(e) => setEditedScores(prev => ({
                                ...prev,
                                [matchup.position]: { ...prev[matchup.position], home: parseInt(e.target.value) || 0 }
                              }))}
                              className="w-16 px-2 py-1 border rounded text-center font-bold text-lg focus:ring-2 focus:ring-purple-500"
                            />
                            <span className="text-gray-400 font-bold">-</span>
                            <input
                              type="number"
                              min="0"
                              value={editedScores[matchup.position]?.away ?? 0}
                              onChange={(e) => setEditedScores(prev => ({
                                ...prev,
                                [matchup.position]: { ...prev[matchup.position], away: parseInt(e.target.value) || 0 }
                              }))}
                              className="w-16 px-2 py-1 border rounded text-center font-bold text-lg focus:ring-2 focus:ring-purple-500"
                            />
                          </>
                        ) : (
                          <span className="text-lg font-bold text-gray-900">
                            {matchup.home_goals ?? '-'} - {matchup.away_goals ?? '-'}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 text-right">
                        <p className="font-semibold text-gray-900">{matchup.away_player_name}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {isEditMode && (
                <div className="mt-6 pt-6 border-t space-y-6">
                  {/* Score Breakdown Preview */}
                  <div className="bg-gray-100 rounded-xl p-4 border border-gray-200">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Score Breakdown Preview
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="font-semibold text-gray-900">{fixture.home_team_name}:</p>
                        <ul className="list-disc pl-4 space-y-0.5 text-gray-600">
                          <li>Matchup Goals: {matchups.reduce((sum, m) => sum + (editedScores[m.position]?.home ?? m.home_goals ?? 0), 0)}</li>
                          {matchups.reduce((sum, m) => sum + (Number((m as any).away_sub_penalty) || 0), 0) > 0 && (
                            <li>Opponent Sub Penalty: +{matchups.reduce((sum, m) => sum + (Number((m as any).away_sub_penalty) || 0), 0)}</li>
                          )}
                          {homePenaltyGoals > 0 && <li>Fine Penalty: +{homePenaltyGoals}</li>}
                          <li className="font-bold text-gray-900 mt-1">Total Score: {calculatePreviewScores().home}</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{fixture.away_team_name}:</p>
                        <ul className="list-disc pl-4 space-y-0.5 text-gray-600">
                          <li>Matchup Goals: {matchups.reduce((sum, m) => sum + (editedScores[m.position]?.away ?? m.away_goals ?? 0), 0)}</li>
                          {matchups.reduce((sum, m) => sum + (Number((m as any).home_sub_penalty) || 0), 0) > 0 && (
                            <li>Opponent Sub Penalty: +{matchups.reduce((sum, m) => sum + (Number((m as any).home_sub_penalty) || 0), 0)}</li>
                          )}
                          {awayPenaltyGoals > 0 && <li>Fine Penalty: +{awayPenaltyGoals}</li>}
                          <li className="font-bold text-gray-900 mt-1">Total Score: {calculatePreviewScores().away}</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Penalty Goals */}
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <h4 className="text-sm font-bold text-orange-950 mb-3 flex items-center gap-1.5">
                      ⚠️ Penalty / Fine Goals
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          {fixture.home_team_name} Penalty Goals
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={homePenaltyGoals}
                          onChange={(e) => setHomePenaltyGoals(parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 border rounded-lg text-center font-bold focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          {fixture.away_team_name} Penalty Goals
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={awayPenaltyGoals}
                          onChange={(e) => setAwayPenaltyGoals(parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 border rounded-lg text-center font-bold focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* MOTM Dropdown */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                    <h4 className="text-sm font-bold text-yellow-950 mb-2 flex items-center gap-1.5">
                      ⭐ Man of the Match (MOTM)
                    </h4>
                    <select
                      value={motmPlayerId || ''}
                      onChange={(e) => setMotmPlayerId(e.target.value || null)}
                      className="w-full px-3 py-2 border-2 border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 bg-white font-medium"
                    >
                      <option value="">-- Select Man of the Match --</option>
                      {Array.from(
                        new Map(
                          matchups.flatMap(m => [
                            [m.home_player_id, m.home_player_name],
                            [m.away_player_id, m.away_player_name]
                          ])
                        ).entries()
                      ).map(([playerId, playerName]) => (
                        <option key={playerId} value={playerId}>
                          {playerName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Actions & Timeline */}
        <div className="space-y-6">
          {/* Actions */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h3 className="text-xl font-bold mb-4">Committee Actions</h3>
            <div className="space-y-3">
              {/* Share Button */}
              <div className="flex justify-center">
                <FixtureShareButton fixture={fixture} matchups={matchups} />
              </div>

              <button
                onClick={() => setShowTimeline(true)}
                className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 font-medium flex items-center justify-center"
              >
                📋 View Complete Timeline
              </button>

              {/* Create Matchups Button - Only show if matchups don't exist */}
              {matchups.length === 0 && fixture.status !== 'completed' && (
                <>
                  <button
                    onClick={() => setShowMatchupCreator(true)}
                    className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 font-medium flex items-center justify-center gap-2"
                  >
                    ⚔️ Create Matchups
                  </button>
                  
                  {/* Round Robin Auto-Generate Button */}
                  {knockoutFormat === 'round_robin' && (
                    <button
                      onClick={handleGenerateRoundRobinMatchups}
                      disabled={isGeneratingRoundRobin}
                      className="w-full px-4 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg hover:from-orange-700 hover:to-red-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isGeneratingRoundRobin ? (
                        <>
                          <span className="animate-spin">⚙️</span> Generating...
                        </>
                      ) : (
                        <>
                          🎯 Auto-Generate Round Robin (25 Matchups)
                        </>
                      )}
                    </button>
                  )}
                </>
              )}

              {fixture.status !== 'completed' && (
                <>
                  <button
                    onClick={() => handleDeclareWO('home')}
                    disabled={isSaving}
                    className="w-full px-4 py-3 bg-orange-50 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 font-medium"
                  >
                    ⚠️ WO - Home Team Absent
                  </button>
                  <button
                    onClick={() => handleDeclareWO('away')}
                    disabled={isSaving}
                    className="w-full px-4 py-3 bg-orange-50 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 font-medium"
                  >
                    ⚠️ WO - Away Team Absent
                  </button>
                  <button
                    onClick={handleDeclareNull}
                    disabled={isSaving}
                    className="w-full px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 font-medium"
                  >
                    ❌ NULL - Both Teams Absent
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Quick Info */}
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl shadow-lg p-6 border border-purple-200">
            <h3 className="font-bold text-purple-900 mb-3">Quick Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Season ID:</span>
                <span className="font-mono text-xs bg-white px-2 py-1 rounded">{fixture.season_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Fixture ID:</span>
                <span className="font-mono text-xs bg-white px-2 py-1 rounded">{fixture.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Matchups:</span>
                <span className="font-semibold">{matchups.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Modal */}
      <FixtureTimeline
        fixtureId={fixtureId}
        isOpen={showTimeline}
        onClose={() => setShowTimeline(false)}
      />

      {/* Matchup Creator Modal */}
      {showMatchupCreator && fixture && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full">
            <CommitteeMatchupCreator
              fixtureId={fixtureId}
              seasonId={fixture.season_id}
              homeTeamId={fixture.home_team_id}
              homeTeamName={fixture.home_team_name}
              awayTeamId={fixture.away_team_id}
              awayTeamName={fixture.away_team_name}
              userId={user.uid}
              userName={user.displayName || user.email || 'Committee Admin'}
              onSuccess={() => {
                setShowMatchupCreator(false);
                showAlert({
                  type: 'success',
                  title: 'Matchups Created',
                  message: 'Matchups have been created successfully!'
                });
                fetchFixtureData(); // Reload data
              }}
              onCancel={() => setShowMatchupCreator(false)}
            />
          </div>
        </div>
      )}

      {/* Lineup Editor Modal */}
      {showLineupEditor && fixture && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full">
            <CommitteeMatchupCreator
              fixtureId={fixtureId}
              seasonId={fixture.season_id}
              homeTeamId={fixture.home_team_id}
              homeTeamName={fixture.home_team_name}
              awayTeamId={fixture.away_team_id}
              awayTeamName={fixture.away_team_name}
              userId={user.uid}
              userName={user.displayName || user.email || 'Committee Admin'}
              onSuccess={() => {
                setShowLineupEditor(null);
                showAlert({
                  type: 'success',
                  title: 'Lineup Updated',
                  message: 'Lineup has been updated successfully!'
                });
                fetchFixtureData(); // Reload data
              }}
              onCancel={() => setShowLineupEditor(null)}
              initialTeamToEdit={showLineupEditor}
            />
          </div>
        </div>
      )}

      {/* Substitution Modal */}
      {isSubModalOpen && subMatchupIndex !== null && subSide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">🔁 Substitute Player</h3>
              <button
                onClick={() => setIsSubModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Current Player:</strong> {subSide === 'home'
                  ? matchups[subMatchupIndex].home_player_name
                  : matchups[subMatchupIndex].away_player_name}
              </p>

              {/* Manual penalty input */}
              <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <label className="block text-sm font-semibold text-orange-900 mb-2">
                  ⚠️ Penalty Goals (awarded to opponent)
                </label>
                <input
                  type="number"
                  min="0"
                  value={subPenaltyAmount}
                  onChange={(e) => setSubPenaltyAmount(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-center text-lg font-bold border-2 border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Enter penalty amount"
                />
                <p className="text-xs text-orange-600 mt-2">
                  Enter the number of penalty goals to award to the opponent for this substitution
                </p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Replacement Player
              </label>
              <select
                value={subNewPlayerId}
                onChange={(e) => setSubNewPlayerId(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- Choose Player --</option>
                {(subSide === 'home' ? homePlayers : awayPlayers)
                  .filter(player => {
                    if (subMatchupIndex === null) return true;
                    const currentMatchup = matchups[subMatchupIndex];
                    const currentPlayerId = subSide === 'home'
                      ? currentMatchup.home_player_id
                      : currentMatchup.away_player_id;
                    return player.player_id !== currentPlayerId;
                  })
                  .map((player) => {
                    let catDisplay = 'N/A';
                    if (player.category_id === 'legend' || player.category === 'legend') {
                      catDisplay = 'Legend';
                    } else if (player.category_id === 'classic' || player.category === 'classic') {
                      catDisplay = 'Classic';
                    } else if (player.category_name?.toLowerCase().includes('legend')) {
                      catDisplay = 'Legend';
                    } else if (player.category_name?.toLowerCase().includes('classic')) {
                      catDisplay = 'Classic';
                    } else if (player.category_name) {
                      catDisplay = player.category_name;
                    } else if (typeof player.category === 'number') {
                      catDisplay = player.category === 1 ? 'Legend' : player.category === 2 ? 'Classic' : `Cat ${player.category}`;
                    }

                    return (
                      <option key={player.player_id} value={player.player_id}>
                        {player.name || player.player_name} ({catDisplay})
                      </option>
                    );
                  })}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsSubModalOpen(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubstitution}
                disabled={!subNewPlayerId || isSaving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Substituting...' : subNewPlayerId ? 'Confirm Substitution' : 'Select Player First'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert, Confirm, and Prompt Modals */}
      <AlertModal
        isOpen={alertState.isOpen}
        onClose={closeAlert}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
      />

      <ConfirmModal
        isOpen={confirmState.isOpen}
        onConfirm={handleConfirm}
        onCancel={closeConfirm}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        type={confirmState.type}
      />

      <PromptModal
        isOpen={promptState.isOpen}
        onConfirm={handlePromptConfirm}
        onCancel={closePrompt}
        title={promptState.title}
        message={promptState.message}
        placeholder={promptState.placeholder}
        defaultValue={promptState.defaultValue}
        confirmText={promptState.confirmText}
        cancelText={promptState.cancelText}
      />
    </div>
  );
}
