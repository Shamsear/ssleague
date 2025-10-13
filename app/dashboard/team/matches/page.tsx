'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase/config';
import {
  collection,
  getDocs,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { getISTNow, parseISTDate, createISTDateTime } from '@/lib/utils/timezone';

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
  match_date?: Date;
  winner_id?: string;
  round_status?: string;
  leg?: string;
  phase?: 'home_fixture' | 'fixture_entry' | 'result_entry' | 'closed';
  phase_label?: string;
  home_deadline?: Date;
  away_deadline?: Date;
  result_deadline?: Date;
}

export default function TeamMatchesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [seasonId, setSeasonId] = useState<string>('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchMatches = async () => {
      if (!user || user.role !== 'team') return;

      try {
        setIsLoading(true);

        // Fetch active season
        const { db } = await import('@/lib/firebase/config');
        const { collection, query, where, getDocs, limit } = await import('firebase/firestore');

        console.log('🔍 Fetching active season...');
        const seasonsSnapshot = await getDocs(
          query(
            collection(db, 'seasons'),
            where('isActive', '==', true),
            limit(1)
          )
        );

        if (seasonsSnapshot.empty) {
          console.log('❌ No active season found');
          setIsLoading(false);
          return;
        }

        const season = seasonsSnapshot.docs[0];
        const currentSeasonId = season.id;
        setSeasonId(currentSeasonId);
        console.log('✅ Active season:', currentSeasonId);

        // Fetch fixtures directly from the fixtures collection
        console.log('🔍 Fetching fixtures for season:', currentSeasonId);
        const fixturesSnapshot = await getDocs(
          query(
            collection(db, 'fixtures'),
            where('season_id', '==', currentSeasonId)
          )
        );

        console.log('📊 Found fixtures:', fixturesSnapshot.docs.length);

        const allMatches: Match[] = [];

        // Build a map of fixture data first
        const fixturesByRound = new Map<string, any[]>();
        fixturesSnapshot.forEach(fixtureDoc => {
          const fixture = fixtureDoc.data();
          if (fixture.home_team_id === user.uid || fixture.away_team_id === user.uid) {
            const roundKey = `${fixture.round_number}_${fixture.leg || 'first'}`;
            if (!fixturesByRound.has(roundKey)) {
              fixturesByRound.set(roundKey, []);
            }
            fixturesByRound.get(roundKey)!.push({
              fixtureDoc,
              fixture
            });
          }
        });

        // Fetch round statuses and deadlines for all relevant rounds
        const roundDataMap = new Map<string, any>();
        for (const [roundKey, fixtures] of fixturesByRound.entries()) {
          const firstFixture = fixtures[0].fixture;
          const roundId = `${currentSeasonId}_r${firstFixture.round_number}_${firstFixture.leg || 'first'}`;
          
          try {
            const { doc, getDoc } = await import('firebase/firestore');
            const roundRef = doc(db, 'round_deadlines', roundId);
            const roundDoc = await getDoc(roundRef);
            
            if (roundDoc.exists()) {
              const roundData = roundDoc.data();
              roundDataMap.set(roundKey, {
                status: roundData.status || 'pending',
                home_fixture_deadline_time: roundData.home_fixture_deadline_time || '17:00',
                away_fixture_deadline_time: roundData.away_fixture_deadline_time || '17:00',
                result_entry_deadline_day_offset: roundData.result_entry_deadline_day_offset || 2,
                result_entry_deadline_time: roundData.result_entry_deadline_time || '00:30',
                scheduled_date: roundData.scheduled_date,
              });
            } else {
              roundDataMap.set(roundKey, {
                status: 'pending',
                home_fixture_deadline_time: '17:00',
                away_fixture_deadline_time: '17:00',
                result_entry_deadline_day_offset: 2,
                result_entry_deadline_time: '00:30',
              });
            }
          } catch (error) {
            console.error(`Error fetching round data for ${roundId}:`, error);
          }
        }

        // Helper function to calculate match phase
        const calculateMatchPhase = (roundData: any, matchDate: Date | null) => {
          if (!matchDate || !roundData.scheduled_date) {
            return { phase: 'fixture_entry' as const, phase_label: 'Fixture Entry' };
          }

          // Get current time in IST
          const now = getISTNow();
          // Parse scheduled date as IST
          const baseDate = parseISTDate(roundData.scheduled_date);
          
          // Parse deadlines using IST utilities
          const homeDeadline = createISTDateTime(
            roundData.scheduled_date,
            roundData.home_fixture_deadline_time
          );
          
          const awayDeadline = createISTDateTime(
            roundData.scheduled_date,
            roundData.away_fixture_deadline_time
          );
          
          // Calculate result deadline (base date + offset days + time)
          const resultDeadline = new Date(baseDate);
          resultDeadline.setDate(resultDeadline.getDate() + roundData.result_entry_deadline_day_offset);
          const [resultHour, resultMin] = roundData.result_entry_deadline_time.split(':').map(Number);
          resultDeadline.setHours(resultHour, resultMin, 0, 0);

          if (now < homeDeadline) {
            return { 
              phase: 'home_fixture' as const, 
              phase_label: 'Home Fixture Setup',
              home_deadline: homeDeadline,
              away_deadline: awayDeadline,
              result_deadline: resultDeadline,
            };
          } else if (now < awayDeadline) {
            return { 
              phase: 'fixture_entry' as const, 
              phase_label: 'Fixture Entry',
              home_deadline: homeDeadline,
              away_deadline: awayDeadline,
              result_deadline: resultDeadline,
            };
          } else if (now < resultDeadline) {
            return { 
              phase: 'result_entry' as const, 
              phase_label: 'Result Entry',
              home_deadline: homeDeadline,
              away_deadline: awayDeadline,
              result_deadline: resultDeadline,
            };
          } else {
            return { 
              phase: 'closed' as const, 
              phase_label: 'Closed',
              home_deadline: homeDeadline,
              away_deadline: awayDeadline,
              result_deadline: resultDeadline,
            };
          }
        };

        // Now build the matches array with round status and phase
        fixturesByRound.forEach((fixtures, roundKey) => {
          const roundData = roundDataMap.get(roundKey) || { status: 'pending' };
          
          fixtures.forEach(({ fixtureDoc, fixture }) => {
            const matchDate = fixture.scheduled_date?.toDate?.() || fixture.scheduled_date;
            const phaseInfo = calculateMatchPhase(roundData, matchDate);
            
            console.log('✅ Found match for current team:', {
              home: fixture.home_team_name,
              away: fixture.away_team_name,
              match_status: fixture.status,
              round_status: roundData.status,
              phase: phaseInfo.phase_label,
              round: fixture.round_number
            });
            
            allMatches.push({
              id: fixtureDoc.id,
              round_number: fixture.round_number || 0,
              match_number: fixture.match_number || 0,
              home_team_id: fixture.home_team_id,
              home_team_name: fixture.home_team_name || 'Team',
              away_team_id: fixture.away_team_id,
              away_team_name: fixture.away_team_name || 'Team',
              home_score: fixture.home_score,
              away_score: fixture.away_score,
              status: fixture.status || 'scheduled',
              match_date: matchDate,
              winner_id: fixture.result === 'home_win' ? fixture.home_team_id : fixture.result === 'away_win' ? fixture.away_team_id : undefined,
              round_status: roundData.status,
              leg: fixture.leg || 'first',
              phase: phaseInfo.phase,
              phase_label: phaseInfo.phase_label,
              home_deadline: phaseInfo.home_deadline,
              away_deadline: phaseInfo.away_deadline,
              result_deadline: phaseInfo.result_deadline,
            });
          });
        });

        // Sort by round number and match number
        allMatches.sort((a, b) => {
          if (a.round_number !== b.round_number) {
            return b.round_number - a.round_number; // Latest rounds first
          }
          return a.match_number - b.match_number;
        });

        console.log('📊 Total matches found for user:', allMatches.length);
        console.log('📊 Match statuses:', allMatches.map(m => ({ round: m.round_number, status: m.status })));
        setMatches(allMatches);
      } catch (error) {
        console.error('Error fetching matches:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMatches();
  }, [user]);

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading matches...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'team') {
    return null;
  }

  // Completed: matches that are closed/completed
  const completedMatches = matches.filter(m => 
    m.status === 'completed' || m.status === 'closed'
  );
  
  // Active: matches in an active round that aren't completed yet
  // These are matches where teams can work on fixtures, matchups, or results
  const activeMatches = matches.filter(m => 
    m.round_status === 'active' && 
    m.status !== 'completed' && 
    m.status !== 'closed'
  );
  
  // Upcoming: matches in pending/inactive rounds
  const upcomingMatches = matches.filter(m => 
    (m.round_status === 'pending' || m.round_status === 'paused' || !m.round_status) && 
    m.status !== 'completed' && 
    m.status !== 'closed'
  );

  const getMatchResultClass = (match: Match) => {
    if (match.status !== 'completed') return '';
    
    if (match.winner_id === user.uid) {
      return 'border-l-4 border-green-500 bg-green-50/50';
    } else if (match.winner_id) {
      return 'border-l-4 border-red-500 bg-red-50/50';
    }
    return 'border-l-4 border-gray-400 bg-gray-50/50'; // Draw
  };

  const getResultText = (match: Match) => {
    if (match.status !== 'completed') return null;
    
    if (match.winner_id === user.uid) {
      return <span className="text-green-700 font-semibold">Won</span>;
    } else if (match.winner_id) {
      return <span className="text-red-700 font-semibold">Lost</span>;
    }
    return <span className="text-gray-700 font-semibold">Draw</span>;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard/team"
          className="inline-flex items-center text-[#0066FF] hover:text-[#0052CC] mb-4"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </Link>
        <h1 className="text-3xl md:text-4xl font-bold gradient-text">Team Matches</h1>
        <p className="text-gray-500 mt-1">View your team's match history and upcoming fixtures</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 backdrop-blur-md rounded-xl p-4 border border-green-200/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Completed</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{completedMatches.length}</p>
            </div>
            <div className="p-3 bg-green-500/20 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 backdrop-blur-md rounded-xl p-4 border border-yellow-200/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Active</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{activeMatches.length}</p>
            </div>
            <div className="p-3 bg-yellow-500/20 rounded-lg">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 backdrop-blur-md rounded-xl p-4 border border-blue-200/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Upcoming</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{upcomingMatches.length}</p>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-12 text-center border border-gray-100/20">
          <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-500 mb-1 text-lg">No matches found</p>
          <p className="text-sm text-gray-400">Matches will appear here once fixtures are created by the admin</p>
        </div>
      ) : (
        <>
          {/* Active Matches */}
          {activeMatches.length > 0 && (
            <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl overflow-hidden border border-gray-100/20 mb-6">
              <div className="px-6 py-4 bg-green-50/50 border-b border-green-200/50">
                <h2 className="text-lg font-semibold text-green-800">Active Matches</h2>
                <p className="text-sm text-green-600 mt-1">Matches currently in progress</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeMatches.map(match => {
                    const getPhaseColor = () => {
                      switch (match.phase) {
                        case 'home_fixture': return 'bg-blue-100 text-blue-700 border-blue-200';
                        case 'fixture_entry': return 'bg-purple-100 text-purple-700 border-purple-200';
                        case 'result_entry': return 'bg-orange-100 text-orange-700 border-orange-200';
                        default: return 'bg-green-100 text-green-700 border-green-200';
                      }
                    };

                    const getNextDeadline = () => {
                      // Get current time in IST
                      const now = getISTNow();
                      if (match.home_deadline && now < match.home_deadline) {
                        return { label: 'Home deadline', date: match.home_deadline };
                      } else if (match.away_deadline && now < match.away_deadline) {
                        return { label: 'Away deadline', date: match.away_deadline };
                      } else if (match.result_deadline && now < match.result_deadline) {
                        return { label: 'Result deadline', date: match.result_deadline };
                      }
                      return null;
                    };

                    const nextDeadline = getNextDeadline();

                    return (
                      <div key={match.id} className="glass p-4 rounded-xl border border-green-200/30 hover:border-green-300/50 transition-all duration-300 bg-green-50/20">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-xs font-medium text-gray-500">Round {match.round_number} • Match {match.match_number}</span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPhaseColor()}`}>
                            {match.phase_label}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mb-3">
                          <div className="text-center flex-1">
                            <p className={`text-sm font-medium truncate ${match.home_team_id === user.uid ? 'text-[#0066FF]' : 'text-gray-700'}`}>
                              {match.home_team_name}
                            </p>
                          </div>
                          <div className="px-2 text-gray-500 text-sm font-medium">VS</div>
                          <div className="text-center flex-1">
                            <p className={`text-sm font-medium truncate ${match.away_team_id === user.uid ? 'text-[#0066FF]' : 'text-gray-700'}`}>
                              {match.away_team_name}
                            </p>
                          </div>
                        </div>
                        {nextDeadline && (
                          <div className="mt-2 pt-2 border-t border-gray-200/50">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-600">{nextDeadline.label}:</span>
                              <span className="font-medium text-gray-900">
                                {nextDeadline.date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })} {nextDeadline.date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                              </span>
                            </div>
                          </div>
                        )}
                        {match.match_date && (
                          <div className="text-center text-xs text-gray-500 mt-2">
                            Match Date: {new Date(match.match_date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                          </div>
                        )}
                        <Link
                          href={`/dashboard/team/fixtures/${match.id}`}
                          className="mt-3 w-full inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Manage Fixtures
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Upcoming Matches */}
          {upcomingMatches.length > 0 && (
            <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl overflow-hidden border border-gray-100/20 mb-6">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800">Upcoming Matches</h2>
                <p className="text-sm text-gray-600 mt-1">Scheduled matches</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {upcomingMatches.map(match => (
                    <div key={match.id} className="glass p-4 rounded-xl border border-white/10 hover:border-primary/20 transition-all duration-300">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-medium text-gray-500">Round {match.round_number} • Match {match.match_number}</span>
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          Upcoming
                        </span>
                      </div>
                      <div className="flex justify-between items-center mb-3">
                        <div className="text-center flex-1">
                          <p className={`text-sm font-medium truncate ${match.home_team_id === user.uid ? 'text-[#0066FF]' : 'text-gray-700'}`}>
                            {match.home_team_name}
                          </p>
                        </div>
                        <div className="px-2 text-gray-500 text-sm font-medium">VS</div>
                        <div className="text-center flex-1">
                          <p className={`text-sm font-medium truncate ${match.away_team_id === user.uid ? 'text-[#0066FF]' : 'text-gray-700'}`}>
                            {match.away_team_name}
                          </p>
                        </div>
                      </div>
                      {match.match_date && (
                        <div className="text-center text-xs text-gray-500 mb-3">
                          {new Date(match.match_date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                        </div>
                      )}
                      <Link
                        href={`/dashboard/team/fixtures/${match.id}`}
                        className="w-full inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Manage Fixtures
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Completed Matches */}
          {completedMatches.length > 0 && (
            <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl overflow-hidden border border-gray-100/20">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800">Completed Matches</h2>
                <p className="text-sm text-gray-600 mt-1">Match results and history</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {completedMatches.map(match => (
                    <div key={match.id} className={`glass p-4 rounded-xl hover:shadow-md transition-all duration-300 ${getMatchResultClass(match)}`}>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-medium text-gray-500">Round {match.round_number} • Match {match.match_number}</span>
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                          Completed
                        </span>
                      </div>
                      <div className="flex justify-between items-center mb-3">
                        <div className="text-center flex-1">
                          <p className={`text-sm font-medium truncate ${match.home_team_id === user.uid ? 'text-[#0066FF]' : 'text-gray-700'}`}>
                            {match.home_team_name}
                          </p>
                          <p className="text-xl font-bold text-gray-900">{match.home_score ?? '-'}</p>
                        </div>
                        <div className="px-2 text-gray-500 text-sm font-medium">VS</div>
                        <div className="text-center flex-1">
                          <p className={`text-sm font-medium truncate ${match.away_team_id === user.uid ? 'text-[#0066FF]' : 'text-gray-700'}`}>
                            {match.away_team_name}
                          </p>
                          <p className="text-xl font-bold text-gray-900">{match.away_score ?? '-'}</p>
                        </div>
                      </div>
                      <div className="text-center mb-2">
                        {getResultText(match)}
                      </div>
                      {match.match_date && (
                        <div className="text-center text-xs text-gray-500">
                          {new Date(match.match_date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
