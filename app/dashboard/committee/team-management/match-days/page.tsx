'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getActiveSeason, getSeasonById } from '@/lib/firebase/seasons';
import { usePermissions } from '@/hooks/usePermissions';
import {
  getFixturesByRoundsWithDeadlines,
  TournamentRound,
  startRound,
  pauseRound,
  resumeRound,
  completeRound,
  restartRound
} from '@/lib/firebase/fixtures';
import { getISTNow, parseISTDate, createISTDateTime, getISTToday } from '@/lib/utils/timezone';
import { useModal } from '@/hooks/useModal';
import AlertModal from '@/components/modals/AlertModal';
import ConfirmModal from '@/components/modals/ConfirmModal';

export default function MatchDayManagementPage() {
  const { user, loading } = useAuth();
  const { userSeasonId } = usePermissions();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  const [seasonName, setSeasonName] = useState('');
  const [rounds, setRounds] = useState<TournamentRound[]>([]);
  const [actioningId, setActioningId] = useState<string | null>(null);

  // Modal system
  const {
    alertState,
    showAlert,
    closeAlert,
    confirmState,
    showConfirm,
    closeConfirm,
    handleConfirm,
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
    loadRounds();
  }, [user]);

  const loadRounds = async () => {
    if (!user || user.role !== 'committee_admin') return;

    try {
      setIsLoading(true);

      // Get season - use committee admin's assigned season or active season
      let seasonId = userSeasonId;
      let season = null;
      
      if (seasonId) {
        season = await getSeasonById(seasonId);
      } else {
        // Fallback to active season for super admins
        season = await getActiveSeason();
        seasonId = season?.id || null;
      }

      if (season && seasonId) {
        setActiveSeasonId(seasonId);
        setSeasonName(season.name);

        // Load all tournaments for this season
        const tournamentsRes = await fetch(`/api/tournaments?season_id=${seasonId}`);
        const tournamentsData = await tournamentsRes.json();
        
        if (!tournamentsData.success || !tournamentsData.tournaments || tournamentsData.tournaments.length === 0) {
          console.log('No tournaments found for season:', seasonId);
          setRounds([]);
          setIsLoading(false);
          return;
        }
        
        // Load round_deadlines from all tournaments
        const allRounds: TournamentRound[] = [];
        for (const tournament of tournamentsData.tournaments) {
          // Fetch fixtures for this tournament
          const fixturesRes = await fetch(`/api/tournaments/${tournament.id}/fixtures`);
          const fixturesData = await fixturesRes.json();
          
          if (fixturesData.success && fixturesData.fixtures && fixturesData.fixtures.length > 0) {
            // Group fixtures by round_number and leg
            const roundsMap = new Map();
            
            for (const fixture of fixturesData.fixtures) {
              const key = `${fixture.round_number}_${fixture.leg || 'first'}`;
              if (!roundsMap.has(key)) {
                roundsMap.set(key, {
                  round_number: fixture.round_number,
                  leg: fixture.leg || 'first',
                  tournament_id: tournament.id,
                  tournament_name: tournament.tournament_name,
                  total_matches: 0,
                  completed_matches: 0,
                  matches: [],
                  status: 'pending',
                  is_active: false,
                  scheduled_date: null,
                  home_fixture_deadline_time: '17:00',
                  away_fixture_deadline_time: '17:00',
                  result_entry_deadline_day_offset: 2,
                  result_entry_deadline_time: '00:30',
                });
              }
              
              const round = roundsMap.get(key);
              round.total_matches++;
              if (fixture.status === 'completed') round.completed_matches++;
              round.matches.push(fixture);
            }
            
            // Fetch round_deadlines for this tournament to get scheduled dates and settings
            try {
              const deadlinesRes = await fetch(`/api/round-deadlines?tournament_id=${tournament.id}`);
              if (deadlinesRes.ok) {
                const deadlinesData = await deadlinesRes.json();
                if (deadlinesData.roundDeadlines) {
                  for (const deadline of deadlinesData.roundDeadlines) {
                    const key = `${deadline.round_number}_${deadline.leg || 'first'}`;
                    const round = roundsMap.get(key);
                    if (round) {
                      // Merge deadline data into round
                      round.scheduled_date = deadline.scheduled_date;
                      round.home_fixture_deadline_time = deadline.home_fixture_deadline_time;
                      round.away_fixture_deadline_time = deadline.away_fixture_deadline_time;
                      round.result_entry_deadline_day_offset = deadline.result_entry_deadline_day_offset;
                      round.result_entry_deadline_time = deadline.result_entry_deadline_time;
                      round.status = deadline.status || 'pending';
                    }
                  }
                }
              }
            } catch (error) {
              console.error('Error fetching round deadlines for tournament:', tournament.id, error);
            }
            
            allRounds.push(...Array.from(roundsMap.values()));
          }
        }
        
        // Sort rounds by round number and leg
        allRounds.sort((a, b) => {
          if (a.round_number !== b.round_number) return a.round_number - b.round_number;
          return a.leg === 'first' ? -1 : 1;
        });
        
        setRounds(allRounds);
        console.log('Loaded rounds from tournaments:', allRounds.length);
      }
    } catch (error) {
      console.error('Error loading rounds:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const completedRounds = rounds.filter((r: any) => r.status === 'completed').length;
  const activeRound = rounds.find((r: any) => r.is_active);

  const handleStartRound = async (roundNumber: number, leg: 'first' | 'second') => {
    if (!activeSeasonId) return;
    
    const roundId = `${roundNumber}_${leg}`;
    setActioningId(roundId);
    
    try {
      // Check if round has a scheduled date
      const round = rounds.find(r => r.round_number === roundNumber && r.leg === leg);
      
      if (!round?.scheduled_date) {
        showAlert({
          type: 'warning',
          title: 'No Date Set',
          message: 'Please set a scheduled date before starting the round. Use "Edit Deadlines" to set the date.'
        });
        return;
      }
      
      // Start the round via API
      const response = await fetch('/api/round-deadlines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: round.tournament_id,
          season_id: activeSeasonId,
          round_number: roundNumber,
          leg,
          scheduled_date: round.scheduled_date,
          home_fixture_deadline_time: round.home_fixture_deadline_time,
          away_fixture_deadline_time: round.away_fixture_deadline_time,
          result_entry_deadline_day_offset: round.result_entry_deadline_day_offset,
          result_entry_deadline_time: round.result_entry_deadline_time,
          status: 'active',
        }),
      });
      
      if (response.ok) {
        await loadRounds();
        showAlert({
          type: 'success',
          title: 'Round Started',
          message: `Round ${roundNumber} has been started!`
        });
      } else {
        const error = await response.json();
        showAlert({
          type: 'error',
          title: 'Start Failed',
          message: error.error || 'Failed to start round'
        });
      }
    } catch (error: any) {
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to start round: ' + error.message
      });
    } finally {
      setActioningId(null);
    }
  };

  const handlePauseRound = async (roundNumber: number, leg: 'first' | 'second') => {
    if (!activeSeasonId) return;
    
    const confirmed = await showConfirm({
      type: 'warning',
      title: 'Pause Round',
      message: `Pause Round ${roundNumber} (${leg})?`,
      confirmText: 'Pause',
      cancelText: 'Cancel'
    });
    
    if (!confirmed) return;
    
    const roundId = `${roundNumber}_${leg}`;
    setActioningId(roundId);
    try {
      const round = rounds.find(r => r.round_number === roundNumber && r.leg === leg);
      if (!round) return;
      
      const response = await fetch('/api/round-deadlines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: round.tournament_id,
          season_id: activeSeasonId,
          round_number: roundNumber,
          leg,
          scheduled_date: round.scheduled_date,
          home_fixture_deadline_time: round.home_fixture_deadline_time,
          away_fixture_deadline_time: round.away_fixture_deadline_time,
          result_entry_deadline_day_offset: round.result_entry_deadline_day_offset,
          result_entry_deadline_time: round.result_entry_deadline_time,
          status: 'paused',
        }),
      });
      
      if (response.ok) {
        await loadRounds();
      } else {
        const error = await response.json();
        showAlert({
          type: 'error',
          title: 'Pause Failed',
          message: error.error || 'Failed to pause round'
        });
      }
    } catch (error: any) {
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to pause round: ' + error.message
      });
    } finally {
      setActioningId(null);
    }
  };

  const handleResumeRound = async (roundNumber: number, leg: 'first' | 'second') => {
    if (!activeSeasonId) return;
    
    const roundId = `${roundNumber}_${leg}`;
    setActioningId(roundId);
    try {
      const round = rounds.find(r => r.round_number === roundNumber && r.leg === leg);
      if (!round) return;
      
      const response = await fetch('/api/round-deadlines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: round.tournament_id,
          season_id: activeSeasonId,
          round_number: roundNumber,
          leg,
          scheduled_date: round.scheduled_date,
          home_fixture_deadline_time: round.home_fixture_deadline_time,
          away_fixture_deadline_time: round.away_fixture_deadline_time,
          result_entry_deadline_day_offset: round.result_entry_deadline_day_offset,
          result_entry_deadline_time: round.result_entry_deadline_time,
          status: 'active',
        }),
      });
      
      if (response.ok) {
        await loadRounds();
      } else {
        const error = await response.json();
        showAlert({
          type: 'error',
          title: 'Resume Failed',
          message: error.error || 'Failed to resume round'
        });
      }
    } catch (error: any) {
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to resume round: ' + error.message
      });
    } finally {
      setActioningId(null);
    }
  };

  const handleCompleteRound = async (roundNumber: number, leg: 'first' | 'second') => {
    if (!activeSeasonId) return;
    
    const confirmed = await showConfirm({
      type: 'danger',
      title: 'Complete Round',
      message: `Complete Round ${roundNumber} (${leg})? This action cannot be undone.`,
      confirmText: 'Complete',
      cancelText: 'Cancel'
    });
    
    if (!confirmed) return;
    
    const roundId = `${roundNumber}_${leg}`;
    setActioningId(roundId);
    try {
      const round = rounds.find(r => r.round_number === roundNumber && r.leg === leg);
      if (!round) return;
      
      const response = await fetch('/api/round-deadlines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: round.tournament_id,
          season_id: activeSeasonId,
          round_number: roundNumber,
          leg,
          scheduled_date: round.scheduled_date,
          home_fixture_deadline_time: round.home_fixture_deadline_time,
          away_fixture_deadline_time: round.away_fixture_deadline_time,
          result_entry_deadline_day_offset: round.result_entry_deadline_day_offset,
          result_entry_deadline_time: round.result_entry_deadline_time,
          status: 'completed',
        }),
      });
      
      if (response.ok) {
        await loadRounds();
      } else {
        const error = await response.json();
        showAlert({
          type: 'error',
          title: 'Complete Failed',
          message: error.error || 'Failed to complete round'
        });
      }
    } catch (error: any) {
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to complete round: ' + error.message
      });
    } finally {
      setActioningId(null);
    }
  };

  const handleRestartRound = async (roundNumber: number, leg: 'first' | 'second') => {
    if (!activeSeasonId) return;
    
    const confirmed = await showConfirm({
      type: 'warning',
      title: 'Restart Round',
      message: `Restart Round ${roundNumber} (${leg})?`,
      confirmText: 'Restart',
      cancelText: 'Cancel'
    });
    
    if (!confirmed) return;
    
    const roundId = `${roundNumber}_${leg}`;
    setActioningId(roundId);
    try {
      const round = rounds.find(r => r.round_number === roundNumber && r.leg === leg);
      if (!round) return;
      
      const response = await fetch('/api/round-deadlines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: round.tournament_id,
          season_id: activeSeasonId,
          round_number: roundNumber,
          leg,
          scheduled_date: round.scheduled_date,
          home_fixture_deadline_time: round.home_fixture_deadline_time,
          away_fixture_deadline_time: round.away_fixture_deadline_time,
          result_entry_deadline_day_offset: round.result_entry_deadline_day_offset,
          result_entry_deadline_time: round.result_entry_deadline_time,
          status: 'active',
        }),
      });
      
      if (response.ok) {
        await loadRounds();
      } else {
        const error = await response.json();
        showAlert({
          type: 'error',
          title: 'Restart Failed',
          message: error.error || 'Failed to restart round'
        });
      }
    } catch (error: any) {
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to restart round: ' + error.message
      });
    } finally {
      setActioningId(null);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading rounds...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'committee_admin') {
    return null;
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8">
        <div className="mb-3 sm:mb-0">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold gradient-text">Match Round Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-500 mt-1">{seasonName} - Tournament</p>
          <div className="flex items-center mt-1 sm:mt-2 text-xs sm:text-sm text-blue-600">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Current Time: {new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
          </div>
        </div>
        
        <Link
          href="/dashboard/committee/team-management/tournament"
          className="inline-flex items-center px-3 py-2 sm:px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-base font-medium rounded-xl transition-colors duration-200 shadow-sm hover:shadow-md"
        >
          <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="hidden sm:inline">Back to Tournament</span>
          <span className="sm:hidden">Back</span>
        </Link>
      </div>

      {/* Tournament Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-blue-100 text-xs sm:text-sm font-medium">Total Rounds</div>
              <div className="text-2xl sm:text-3xl font-bold">{rounds.length}</div>
            </div>
            <div className="text-blue-200">
              <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-green-100 text-xs sm:text-sm font-medium">Active Round</div>
              <div className="text-xl sm:text-3xl font-bold truncate">{activeRound ? `${activeRound.round_number} (${activeRound.leg})` : 'None'}</div>
            </div>
            <div className="text-green-200">
              <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-cyan-100 text-xs sm:text-sm font-medium">Completed</div>
              <div className="text-2xl sm:text-3xl font-bold">{completedRounds}</div>
            </div>
            <div className="text-cyan-200">
              <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-purple-100 text-xs sm:text-sm font-medium">Total Fixtures</div>
              <div className="text-2xl sm:text-3xl font-bold">{rounds.reduce((sum, r) => sum + r.total_matches, 0)}</div>
            </div>
            <div className="text-purple-200">
              <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Match Rounds Table */}
      <div className="bg-white/90 backdrop-blur-md shadow-xl rounded-2xl overflow-hidden border border-gray-100">
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 px-4 sm:px-6 py-4 border-b border-gray-100">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800">Match Rounds</h2>
        </div>
        <div className="p-3 sm:p-6">
          {rounds.length > 0 ? (
            <>
            {/* Desktop Table - Hidden on mobile */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Round</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leg</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Phase</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deadlines</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fixtures</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rounds.map((round: any) => {
                    const progressPercentage = round.total_matches > 0 ? Math.round((round.completed_matches / round.total_matches) * 100) : 0;
                    const status = round.status || 'pending';
                    const isActive = round.is_active || false;
                    const roundId = `${round.round_number}_${round.leg}`;
                    
                    // Calculate current phase
                    const calculatePhase = () => {
                      if (status !== 'active') {
                        return { phase: 'N/A', phaseLabel: 'Not Started', color: 'bg-gray-100 text-gray-600' };
                      }

                      if (!round.scheduled_date) {
                        return { 
                          phase: 'awaiting_schedule', 
                          phaseLabel: 'Set Schedule Date', 
                          color: 'bg-yellow-100 text-yellow-700',
                          remaining: 'Required'
                        };
                      }

                      // Get current time in IST
                      const now = getISTNow();
                      
                      // Extract date string from scheduled_date (could be full timestamp or date string)
                      const scheduledDateStr = typeof round.scheduled_date === 'string' && round.scheduled_date.includes('T')
                        ? round.scheduled_date.split('T')[0]  // Extract YYYY-MM-DD from timestamp
                        : round.scheduled_date;
                      
                      // Parse deadlines using IST utilities
                      const homeDeadline = createISTDateTime(
                        scheduledDateStr,
                        round.home_fixture_deadline_time || '23:30'
                      );
                      
                      const awayDeadline = createISTDateTime(
                        scheduledDateStr,
                        round.away_fixture_deadline_time || '23:45'
                      );
                      
                      // Result deadline calculation - add days to the scheduled date
                      const scheduledDate = new Date(scheduledDateStr + 'T00:00:00+05:30');
                      const offsetDays = round.result_entry_deadline_day_offset || 2;
                      const resultDateObj = new Date(scheduledDate.getTime() + offsetDays * 24 * 60 * 60 * 1000);
                      const resultYear = resultDateObj.getFullYear();
                      const resultMonth = String(resultDateObj.getMonth() + 1).padStart(2, '0');
                      const resultDay = String(resultDateObj.getDate()).padStart(2, '0');
                      const resultDateStr = `${resultYear}-${resultMonth}-${resultDay}`;
                      const resultDeadline = createISTDateTime(
                        resultDateStr,
                        round.result_entry_deadline_time || '00:30'
                      );

                      console.log('🕐 Match-Days Phase Debug:', {
                        round: `${round.round_number}_${round.leg}`,
                        scheduled_date: round.scheduled_date,
                        home_time: round.home_fixture_deadline_time,
                        away_time: round.away_fixture_deadline_time,
                        result_time: round.result_entry_deadline_time,
                        result_offset: round.result_entry_deadline_day_offset,
                        now: now.toISOString(),
                        homeDeadline: homeDeadline instanceof Date && !isNaN(homeDeadline.getTime()) ? homeDeadline.toISOString() : 'INVALID',
                        awayDeadline: awayDeadline instanceof Date && !isNaN(awayDeadline.getTime()) ? awayDeadline.toISOString() : 'INVALID',
                        resultDeadline: resultDeadline instanceof Date && !isNaN(resultDeadline.getTime()) ? resultDeadline.toISOString() : 'INVALID',
                        'now < homeDeadline': now < homeDeadline,
                        'now < awayDeadline': now < awayDeadline,
                        'now < resultDeadline': now < resultDeadline
                      });

                      if (now < homeDeadline) {
                        const remainingMinutes = Math.ceil((homeDeadline.getTime() - now.getTime()) / (1000 * 60));
                        const remainingDisplay = remainingMinutes >= 60 
                          ? `${Math.ceil(remainingMinutes / 60)}h left`
                          : `${remainingMinutes}m left`;
                        return { 
                          phase: 'home_fixture', 
                          phaseLabel: 'Home Fixture Setup',
                          color: 'bg-blue-100 text-blue-700',
                          deadline: homeDeadline,
                          remaining: remainingDisplay
                        };
                      } else if (now < awayDeadline) {
                        const remainingMinutes = Math.ceil((awayDeadline.getTime() - now.getTime()) / (1000 * 60));
                        const remainingDisplay = remainingMinutes >= 60 
                          ? `${Math.ceil(remainingMinutes / 60)}h left`
                          : `${remainingMinutes}m left`;
                        return { 
                          phase: 'fixture_entry', 
                          phaseLabel: 'Fixture Entry',
                          color: 'bg-purple-100 text-purple-700',
                          deadline: awayDeadline,
                          remaining: remainingDisplay
                        };
                      } else if (now < resultDeadline) {
                        const remaining = Math.ceil((resultDeadline.getTime() - now.getTime()) / (1000 * 60 * 60));
                        return { 
                          phase: 'result_entry', 
                          phaseLabel: 'Result Entry',
                          color: 'bg-orange-100 text-orange-700',
                          deadline: resultDeadline,
                          remaining: `${remaining}h left`
                        };
                      } else {
                        return { 
                          phase: 'closed', 
                          phaseLabel: 'Closed',
                          color: 'bg-red-100 text-red-700',
                          deadline: null,
                          remaining: 'Expired'
                        };
                      }
                    };

                    const phaseInfo = calculatePhase();
                    
                    return (
                      <tr
                        key={`${round.round_number}-${round.leg}`}
                        className={`${
                          isActive
                            ? 'bg-green-50 hover:bg-green-100'
                            : status === 'completed'
                            ? 'bg-blue-50 hover:bg-blue-100'
                            : status === 'paused'
                            ? 'bg-yellow-50 hover:bg-yellow-100'
                            : 'hover:bg-gray-50'
                        } transition-colors duration-200`}
                      >
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="font-semibold text-gray-900">Round {round.round_number}</span>
                            {isActive && (
                              <span className="ml-2 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">ACTIVE</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                            {round.leg === 'first' ? '1st Leg' : '2nd Leg'}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              status === 'pending'
                                ? 'bg-gray-100 text-gray-700'
                                : status === 'active'
                                ? 'bg-green-100 text-green-700'
                                : status === 'paused'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="space-y-1">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${phaseInfo.color}`}>
                              {phaseInfo.phaseLabel}
                            </span>
                            {phaseInfo.remaining && status === 'active' && (
                              <div className="text-xs text-gray-500 mt-1">
                                {phaseInfo.remaining}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-xs text-gray-600 space-y-1">
                            <div>
                              <span className="font-medium text-gray-700">Home:</span> {round.home_fixture_deadline_time || '23:30'}
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Away:</span> {round.away_fixture_deadline_time || '23:45'}
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Result:</span> Day {round.result_entry_deadline_day_offset || 2}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">{round.total_matches}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="flex-1">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${progressPercentage}%` }}
                                />
                              </div>
                            </div>
                            <span className="text-xs font-medium text-gray-600 w-12 text-right">
                              {progressPercentage}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            {/* Start Button - Green */}
                            {status === 'pending' && (
                              <button
                                onClick={() => handleStartRound(round.round_number, round.leg)}
                                disabled={actioningId === roundId}
                                className="inline-flex items-center px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors duration-200 disabled:opacity-50"
                                title="Start Round"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </button>
                            )}

                            {/* Pause Button - Yellow */}
                            {status === 'active' && (
                              <button
                                onClick={() => handlePauseRound(round.round_number, round.leg)}
                                disabled={actioningId === roundId}
                                className="inline-flex items-center px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-medium rounded-lg transition-colors duration-200 disabled:opacity-50"
                                title="Pause Round"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </button>
                            )}

                            {/* Resume Button - Cyan */}
                            {status === 'paused' && (
                              <button
                                onClick={() => handleResumeRound(round.round_number, round.leg)}
                                disabled={actioningId === roundId}
                                className="inline-flex items-center px-2 py-1 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-medium rounded-lg transition-colors duration-200 disabled:opacity-50"
                                title="Resume Round"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </button>
                            )}

                            {/* Complete Button - Blue */}
                            {status === 'active' && (
                              <button
                                onClick={() => handleCompleteRound(round.round_number, round.leg)}
                                disabled={actioningId === roundId}
                                className="inline-flex items-center px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors duration-200 disabled:opacity-50"
                                title="Complete Round"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                            )}

                            {/* Restart Button - Purple */}
                            {(status === 'completed' || status === 'paused') && (
                              <button
                                onClick={() => handleRestartRound(round.round_number, round.leg)}
                                disabled={actioningId === roundId}
                                className="inline-flex items-center px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors duration-200 disabled:opacity-50"
                                title="Restart Round"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              </button>
                            )}

                            {/* Edit Deadlines Button - Gray */}
                            <Link
                              href={`/dashboard/committee/team-management/match-days/edit?season=${activeSeasonId}&round=${round.round_number}&leg=${round.leg}`}
                              className="inline-flex items-center px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors duration-200"
                              title="Edit Deadlines"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Layout - Shown only on mobile */}
            <div className="md:hidden space-y-4">
              {rounds.map((round: any) => {
                const progressPercentage = round.total_matches > 0 ? Math.round((round.completed_matches / round.total_matches) * 100) : 0;
                const status = round.status || 'pending';
                const isActive = round.is_active || false;
                const roundId = `${round.round_number}_${round.leg}`;
                
                // Calculate current phase (same logic as desktop)
                const calculatePhase = () => {
                  if (status !== 'active') {
                    return { phase: 'N/A', phaseLabel: 'Not Started', color: 'bg-gray-100 text-gray-600' };
                  }

                  if (!round.scheduled_date) {
                    return { 
                      phase: 'awaiting_schedule', 
                      phaseLabel: 'Set Schedule Date', 
                      color: 'bg-yellow-100 text-yellow-700',
                      remaining: 'Required'
                    };
                  }

                  const now = getISTNow();
                  const scheduledDateStr = typeof round.scheduled_date === 'string' && round.scheduled_date.includes('T')
                    ? round.scheduled_date.split('T')[0]
                    : round.scheduled_date;
                  
                  const homeDeadline = createISTDateTime(
                    scheduledDateStr,
                    round.home_fixture_deadline_time || '23:30'
                  );
                  
                  const awayDeadline = createISTDateTime(
                    scheduledDateStr,
                    round.away_fixture_deadline_time || '23:45'
                  );
                  
                  const scheduledDate = new Date(scheduledDateStr + 'T00:00:00+05:30');
                  const offsetDays = round.result_entry_deadline_day_offset || 2;
                  const resultDateObj = new Date(scheduledDate.getTime() + offsetDays * 24 * 60 * 60 * 1000);
                  const resultYear = resultDateObj.getFullYear();
                  const resultMonth = String(resultDateObj.getMonth() + 1).padStart(2, '0');
                  const resultDay = String(resultDateObj.getDate()).padStart(2, '0');
                  const resultDateStr = `${resultYear}-${resultMonth}-${resultDay}`;
                  const resultDeadline = createISTDateTime(
                    resultDateStr,
                    round.result_entry_deadline_time || '00:30'
                  );

                  if (now < homeDeadline) {
                    const remainingMinutes = Math.ceil((homeDeadline.getTime() - now.getTime()) / (1000 * 60));
                    const remainingDisplay = remainingMinutes >= 60 
                      ? `${Math.ceil(remainingMinutes / 60)}h left`
                      : `${remainingMinutes}m left`;
                    return { 
                      phase: 'home_fixture', 
                      phaseLabel: 'Home Fixture Setup',
                      color: 'bg-blue-100 text-blue-700',
                      deadline: homeDeadline,
                      remaining: remainingDisplay
                    };
                  } else if (now < awayDeadline) {
                    const remainingMinutes = Math.ceil((awayDeadline.getTime() - now.getTime()) / (1000 * 60));
                    const remainingDisplay = remainingMinutes >= 60 
                      ? `${Math.ceil(remainingMinutes / 60)}h left`
                      : `${remainingMinutes}m left`;
                    return { 
                      phase: 'fixture_entry', 
                      phaseLabel: 'Fixture Entry',
                      color: 'bg-purple-100 text-purple-700',
                      deadline: awayDeadline,
                      remaining: remainingDisplay
                    };
                  } else if (now < resultDeadline) {
                    const remaining = Math.ceil((resultDeadline.getTime() - now.getTime()) / (1000 * 60 * 60));
                    return { 
                      phase: 'result_entry', 
                      phaseLabel: 'Result Entry',
                      color: 'bg-orange-100 text-orange-700',
                      deadline: resultDeadline,
                      remaining: `${remaining}h left`
                    };
                  } else {
                    return { 
                      phase: 'closed', 
                      phaseLabel: 'Closed',
                      color: 'bg-red-100 text-red-700',
                      deadline: null,
                      remaining: 'Expired'
                    };
                  }
                };

                const phaseInfo = calculatePhase();
                
                return (
                  <div
                    key={`${round.round_number}-${round.leg}`}
                    className={`rounded-xl border-2 p-4 ${
                      isActive
                        ? 'bg-green-50 border-green-200'
                        : status === 'completed'
                        ? 'bg-blue-50 border-blue-200'
                        : status === 'paused'
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    {/* Round Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">Round {round.round_number}</h3>
                        <span className="text-xs text-gray-600">{round.leg === 'first' ? '1st Leg' : '2nd Leg'}</span>
                      </div>
                      {isActive && (
                        <span className="px-3 py-1 text-xs font-bold bg-green-500 text-white rounded-full">ACTIVE</span>
                      )}
                    </div>

                    {/* Status & Phase */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Status</p>
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                          status === 'pending'
                            ? 'bg-gray-100 text-gray-700'
                            : status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : status === 'paused'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Current Phase</p>
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${phaseInfo.color}`}>
                          {phaseInfo.phaseLabel}
                        </span>
                        {phaseInfo.remaining && status === 'active' && (
                          <p className="text-xs text-gray-600 mt-1">{phaseInfo.remaining}</p>
                        )}
                      </div>
                    </div>

                    {/* Deadlines */}
                    <div className="bg-white/50 rounded-lg p-2 mb-3">
                      <p className="text-xs font-semibold text-gray-700 mb-1">Deadlines</p>
                      <div className="text-xs text-gray-600 space-y-0.5">
                        <div><span className="font-medium">Home:</span> {round.home_fixture_deadline_time || '23:30'}</div>
                        <div><span className="font-medium">Away:</span> {round.away_fixture_deadline_time || '23:45'}</div>
                        <div><span className="font-medium">Result:</span> Day {round.result_entry_deadline_day_offset || 2}</div>
                      </div>
                    </div>

                    {/* Fixtures & Progress */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                        <span>Fixtures: {round.total_matches}</span>
                        <span className="font-medium">{progressPercentage}% Complete</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                      {status === 'pending' && (
                        <button
                          onClick={() => handleStartRound(round.round_number, round.leg)}
                          disabled={actioningId === roundId}
                          className="flex-1 min-w-[45%] inline-flex items-center justify-center px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 disabled:opacity-50"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Start
                        </button>
                      )}

                      {status === 'active' && (
                        <>
                          <button
                            onClick={() => handlePauseRound(round.round_number, round.leg)}
                            disabled={actioningId === roundId}
                            className="flex-1 min-w-[45%] inline-flex items-center justify-center px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 disabled:opacity-50"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Pause
                          </button>
                          <button
                            onClick={() => handleCompleteRound(round.round_number, round.leg)}
                            disabled={actioningId === roundId}
                            className="flex-1 min-w-[45%] inline-flex items-center justify-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 disabled:opacity-50"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            Complete
                          </button>
                        </>
                      )}

                      {status === 'paused' && (
                        <>
                          <button
                            onClick={() => handleResumeRound(round.round_number, round.leg)}
                            disabled={actioningId === roundId}
                            className="flex-1 min-w-[45%] inline-flex items-center justify-center px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 disabled:opacity-50"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Resume
                          </button>
                          <button
                            onClick={() => handleRestartRound(round.round_number, round.leg)}
                            disabled={actioningId === roundId}
                            className="flex-1 min-w-[45%] inline-flex items-center justify-center px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 disabled:opacity-50"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Restart
                          </button>
                        </>
                      )}

                      {(status === 'completed') && (
                        <button
                          onClick={() => handleRestartRound(round.round_number, round.leg)}
                          disabled={actioningId === roundId}
                          className="flex-1 min-w-[45%] inline-flex items-center justify-center px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 disabled:opacity-50"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Restart
                        </button>
                      )}

                      <Link
                        href={`/dashboard/committee/team-management/match-days/edit?tournament=${round.tournament_id}&season=${activeSeasonId}&round=${round.round_number}&leg=${round.leg}`}
                        className="flex-1 min-w-[45%] inline-flex items-center justify-center px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors duration-200"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Edit Deadlines
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
            </>
          ) : (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Match Rounds Created</h3>
              <p className="text-gray-500 mb-6">Create match rounds by generating fixtures in the tournament dashboard.</p>
              <Link
                href="/dashboard/committee/team-management/tournament"
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Go to Tournament Dashboard
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* System Information */}
      <div className="mt-8">
        <div className="bg-white/90 backdrop-blur-md shadow-xl rounded-2xl overflow-hidden border border-gray-100">
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800">How Match Rounds Work</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="flex items-center text-base font-semibold text-gray-800 mb-4">
                  <svg className="w-5 h-5 text-cyan-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Deadline Configuration
                </h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>
                    <strong className="text-gray-800">Default Deadlines:</strong> Set in Tournament Settings and apply to all rounds
                  </li>
                  <li>
                    <strong className="text-gray-800">Round Overrides:</strong> Customize deadlines for specific rounds using the Edit button
                  </li>
                  <li>
                    <strong className="text-gray-800">Home Deadline:</strong> Daily time limit for home teams to create fixtures
                  </li>
                  <li>
                    <strong className="text-gray-800">Away Deadline:</strong> Daily time limit for away teams to modify fixtures
                  </li>
                  <li>
                    <strong className="text-gray-800">Result Entry:</strong> Number of days after fixture date for result submission
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="flex items-center text-base font-semibold text-gray-800 mb-4">
                  <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Match Phases
                </h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start">
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 mr-2 mt-0.5">Phase 1</span>
                    <div><strong className="text-gray-800">Home Fixture Setup:</strong> Home team creates matchups (realplayer vs realplayer)</div>
                  </li>
                  <li className="flex items-start">
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700 mr-2 mt-0.5">Phase 2</span>
                    <div><strong className="text-gray-800">Fixture Entry:</strong> Both teams can work on fixtures after home deadline</div>
                  </li>
                  <li className="flex items-start">
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-700 mr-2 mt-0.5">Phase 3</span>
                    <div><strong className="text-gray-800">Result Entry:</strong> Teams enter/edit results for each matchup</div>
                  </li>
                  <li className="flex items-start">
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700 mr-2 mt-0.5">Phase 4</span>
                    <div><strong className="text-gray-800">Closed:</strong> Match is finalized after result deadline expires</div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Components */}
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
    </div>
  );
}
