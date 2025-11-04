'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { getActiveSeason } from '@/lib/firebase/seasons';
import { getRoundDeadlines, updateRoundDeadlines } from '@/lib/firebase/fixtures';
import { getISTToday, parseISTDate, createISTDateTime, formatISTDateTime } from '@/lib/utils/timezone';
import { useModal } from '@/hooks/useModal';
import AlertModal from '@/components/modals/AlertModal';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

function EditRoundDeadlinesContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const tournamentId = searchParams.get('tournament');
  const seasonId = searchParams.get('season');
  const roundNumber = parseInt(searchParams.get('round') || '0');
  const leg = (searchParams.get('leg') || 'first') as 'first' | 'second';

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [seasonName, setSeasonName] = useState('');
  
  const [homeTime, setHomeTime] = useState('17:00');
  const [awayTime, setAwayTime] = useState('17:00');
  const [resultDayOffset, setResultDayOffset] = useState(1);
  const [resultTime, setResultTime] = useState('00:30');
  const [scheduledDate, setScheduledDate] = useState('');

  // Modal system
  const {
    alertState,
    showAlert,
    closeAlert,
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
    loadDeadlines();
  }, [tournamentId, roundNumber, leg]);

  const loadDeadlines = async () => {
    if (!roundNumber) return;

    try {
      setIsLoading(true);

      const activeSeason = await getActiveSeason();
      if (activeSeason) {
        setSeasonName(activeSeason.name);
      }

      // If tournament_id is not provided, fetch it from season
      let tournamentIdToUse = tournamentId;
      if (!tournamentIdToUse && seasonId) {
        console.log('No tournament_id provided, fetching from season:', seasonId);
        const tournamentsRes = await fetchWithTokenRefresh(`/api/tournaments?season_id=${seasonId}`);
        const tournamentsData = await tournamentsRes.json();
        
        if (tournamentsData.success && tournamentsData.tournaments && tournamentsData.tournaments.length > 0) {
          // Use the first/primary tournament for this season
          tournamentIdToUse = tournamentsData.tournaments[0].id;
          console.log('Using tournament:', tournamentIdToUse);
        } else {
          console.error('No tournaments found for season:', seasonId);
          return;
        }
      }

      if (!tournamentIdToUse) {
        console.error('No tournament_id available');
        return;
      }

      // Fetch round deadlines from tournament API
      const response = await fetchWithTokenRefresh(`/api/round-deadlines?tournament_id=${tournamentIdToUse}&round_number=${roundNumber}&leg=${leg}`);
      if (!response.ok) {
        console.error('Failed to fetch round deadlines');
        return;
      }
      
      const { roundDeadline } = await response.json();
      const deadlines = roundDeadline;
      console.log('Loaded deadlines:', deadlines);
      if (deadlines) {
        setHomeTime(deadlines.home_fixture_deadline_time || '17:00');
        setAwayTime(deadlines.away_fixture_deadline_time || '17:00');
        setResultDayOffset(deadlines.result_entry_deadline_day_offset || 2);
        setResultTime(deadlines.result_entry_deadline_time || '00:30');
        
        // Extract date part if scheduled_date is a timestamp
        let dateValue = deadlines.scheduled_date || '';
        if (dateValue && dateValue.includes('T')) {
          dateValue = dateValue.split('T')[0]; // Extract YYYY-MM-DD
        }
        setScheduledDate(dateValue);
        
        console.log('Set values:', {
          homeTime: deadlines.home_fixture_deadline_time,
          awayTime: deadlines.away_fixture_deadline_time,
          resultTime: deadlines.result_entry_deadline_time,
          scheduled_date: dateValue
        });
      }
    } catch (error) {
      console.error('Error loading deadlines:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const deadlineData: any = {
        home_fixture_deadline_time: homeTime,
        away_fixture_deadline_time: awayTime,
        result_entry_deadline_day_offset: resultDayOffset,
        result_entry_deadline_time: resultTime,
      };

      // Only include scheduled_date if it has a value
      if (scheduledDate) {
        deadlineData.scheduled_date = scheduledDate;
      }

      // If tournament_id is not provided, fetch it from season
      let tournamentIdToUse = tournamentId;
      if (!tournamentIdToUse && seasonId) {
        const tournamentsRes = await fetchWithTokenRefresh(`/api/tournaments?season_id=${seasonId}`);
        const tournamentsData = await tournamentsRes.json();
        
        if (tournamentsData.success && tournamentsData.tournaments && tournamentsData.tournaments.length > 0) {
          tournamentIdToUse = tournamentsData.tournaments[0].id;
        }
      }
      
      if (!tournamentIdToUse) {
        showAlert({
          type: 'error',
          title: 'Error',
          message: 'No tournament found for this season'
        });
        return;
      }
      
      // Update round deadlines via tournament API
      const response = await fetchWithTokenRefresh(/api/round-deadlines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: tournamentIdToUse,
          season_id: seasonId,
          round_number: roundNumber,
          leg,
          ...deadlineData,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        showAlert({
          type: 'error',
          title: 'Update Failed',
          message: error.error || 'Failed to update deadlines'
        });
        return;
      }
      
      const result = await response.json();
      
      // Success - redirect after showing message
      showAlert({
        type: 'success',
        title: 'Deadlines Updated',
        message: 'Deadlines updated successfully!'
      });
      setTimeout(() => {
        router.push('/dashboard/committee/team-management/match-days');
      }, 1500);
    } catch (error) {
      console.error('Error updating deadlines:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to update deadlines'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getExampleDay = () => {
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return dayNames[(resultDayOffset) % 7];
  };

  // Calculate actual deadlines based on scheduled date
  const calculatedDeadlines = useMemo(() => {
    if (!scheduledDate) {
      return null;
    }

    try {
      const baseDate = parseISTDate(scheduledDate);
      
      // Home fixture deadline
      const homeDeadline = createISTDateTime(scheduledDate, homeTime);
      
      // Away fixture deadline
      const awayDeadline = createISTDateTime(scheduledDate, awayTime);
      
      // Result entry deadline (base date + offset days)
      const resultDate = new Date(baseDate);
      resultDate.setDate(resultDate.getDate() + resultDayOffset);
      const resultDeadline = createISTDateTime(
        `${resultDate.getFullYear()}-${String(resultDate.getMonth() + 1).padStart(2, '0')}-${String(resultDate.getDate()).padStart(2, '0')}`,
        resultTime
      );

      return {
        home: homeDeadline,
        away: awayDeadline,
        result: resultDeadline,
        scheduledDateFormatted: baseDate.toLocaleDateString('en-IN', { 
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: 'Asia/Kolkata'
        }),
      };
    } catch (error) {
      console.error('Error calculating deadlines:', error);
      return null;
    }
  }, [scheduledDate, homeTime, awayTime, resultTime, resultDayOffset]);

  if (loading || isLoading) {
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
          <div className="mb-4 sm:mb-0">
            <h1 className="text-3xl md:text-4xl font-bold gradient-text">Edit Match Round Deadlines</h1>
            <p className="text-gray-500 mt-1">
              Round {roundNumber} ({leg === 'first' ? '1st' : '2nd'} Leg) - {seasonName}
            </p>
          </div>
          <Link
            href="/dashboard/committee/team-management/match-days"
            className="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors duration-200"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
        </div>

        {/* Edit Form */}
        <div className="bg-white/90 backdrop-blur-md shadow-xl rounded-2xl overflow-hidden border border-gray-100">
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800">Deadline Configuration</h2>
          </div>
          <div className="p-6">
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="home_deadline_time" className="block text-sm font-medium text-gray-700 mb-2">
                    <svg className="inline w-4 h-4 mr-1 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Home Fixture Deadline Time
                  </label>
                  <input
                    type="time"
                    id="home_deadline_time"
                    value={homeTime}
                    onChange={(e) => setHomeTime(e.target.value)}
                    className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white/80"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Daily time when home teams can no longer create fixtures</p>
                </div>

                <div>
                  <label htmlFor="away_deadline_time" className="block text-sm font-medium text-gray-700 mb-2">
                    <svg className="inline w-4 h-4 mr-1 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Away Fixture Deadline Time
                  </label>
                  <input
                    type="time"
                    id="away_deadline_time"
                    value={awayTime}
                    onChange={(e) => setAwayTime(e.target.value)}
                    className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white/80"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Daily time when away teams can no longer modify fixtures</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div>
                  <label htmlFor="result_deadline_day_offset" className="block text-sm font-medium text-gray-700 mb-2">
                    <svg className="inline w-4 h-4 mr-1 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Result Entry Day Offset
                  </label>
                  <select
                    id="result_deadline_day_offset"
                    value={resultDayOffset}
                    onChange={(e) => setResultDayOffset(parseInt(e.target.value))}
                    className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white/80"
                    required
                  >
                    <option value="0">Same day (Day 0)</option>
                    <option value="1">Next day (Day 1)</option>
                    <option value="2">Day after tomorrow (Day 2)</option>
                    <option value="3">3 days later (Day 3)</option>
                    <option value="4">4 days later (Day 4)</option>
                    <option value="7">1 week later (Day 7)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">How many days after match day results are due</p>
                </div>

                <div>
                  <label htmlFor="result_deadline_time" className="block text-sm font-medium text-gray-700 mb-2">
                    <svg className="inline w-4 h-4 mr-1 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Result Entry Deadline Time
                  </label>
                  <input
                    type="time"
                    id="result_deadline_time"
                    value={resultTime}
                    onChange={(e) => setResultTime(e.target.value)}
                    className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white/80"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Time when results are due on the deadline day (IST)</p>
                </div>
              </div>

              <div className="mt-6">
                <label htmlFor="scheduled_date" className="block text-sm font-medium text-gray-700 mb-2">
                  <svg className="inline w-4 h-4 mr-1 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Scheduled Date
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    id="scheduled_date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="block flex-1 rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white/80"
                  />
                  <button
                    type="button"
                    onClick={() => setScheduledDate(getISTToday())}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-xl transition-colors duration-200 whitespace-nowrap"
                  >
                    Today
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">When this round is planned to be played (used for deadline calculations in IST)</p>
              </div>

              {/* Deadline Preview */}
              <div className="mt-8 p-4 bg-blue-50/50 border border-blue-200/50 rounded-xl">
                <div className="flex items-center mb-3">
                  <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-sm font-medium text-blue-800">Deadline Preview</h3>
                </div>
                
                {calculatedDeadlines ? (
                  <div className="space-y-4">
                    <div className="text-sm text-blue-700">
                      <div className="mb-2"><strong>Scheduled Match Day:</strong></div>
                      <div className="pl-2 text-blue-900 font-medium">{calculatedDeadlines.scheduledDateFormatted}</div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-start p-3 bg-white/50 border border-blue-200/30 rounded-lg">
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <div className="text-xs font-medium text-blue-800 mb-1">Home Fixture Deadline</div>
                          <div className="text-sm font-semibold text-blue-900">
                            {calculatedDeadlines.home.toLocaleDateString('en-IN', { 
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              timeZone: 'Asia/Kolkata'
                            })}
                            {' at '}
                            {calculatedDeadlines.home.toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZone: 'Asia/Kolkata'
                            })}
                            {' IST'}
                          </div>
                          <div className="text-xs text-blue-600 mt-1">Home teams must create fixtures before this time</div>
                        </div>
                      </div>

                      <div className="flex items-start p-3 bg-white/50 border border-cyan-200/30 rounded-lg">
                        <div className="flex-shrink-0 w-8 h-8 bg-cyan-100 rounded-full flex items-center justify-center mr-3">
                          <svg className="w-4 h-4 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <div className="text-xs font-medium text-cyan-800 mb-1">Away Fixture Deadline</div>
                          <div className="text-sm font-semibold text-cyan-900">
                            {calculatedDeadlines.away.toLocaleDateString('en-IN', { 
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              timeZone: 'Asia/Kolkata'
                            })}
                            {' at '}
                            {calculatedDeadlines.away.toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZone: 'Asia/Kolkata'
                            })}
                            {' IST'}
                          </div>
                          <div className="text-xs text-cyan-600 mt-1">Away teams can modify fixtures until this time</div>
                        </div>
                      </div>

                      <div className="flex items-start p-3 bg-white/50 border border-green-200/30 rounded-lg">
                        <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <div className="text-xs font-medium text-green-800 mb-1">Result Entry Deadline</div>
                          <div className="text-sm font-semibold text-green-900">
                            {calculatedDeadlines.result.toLocaleDateString('en-IN', { 
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              timeZone: 'Asia/Kolkata'
                            })}
                            {' at '}
                            {calculatedDeadlines.result.toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZone: 'Asia/Kolkata'
                            })}
                            {' IST'}
                          </div>
                          <div className="text-xs text-green-600 mt-1">
                            Results must be entered by this time ({resultDayOffset} {resultDayOffset === 1 ? 'day' : 'days'} after match day)
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-blue-700 space-y-3">
                    <div className="flex items-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <svg className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <div className="font-medium text-yellow-800 mb-1">Set Scheduled Date</div>
                        <div className="text-xs text-yellow-700">Please set a scheduled date above to see calculated deadline times</div>
                      </div>
                    </div>
                    <div className="text-xs text-blue-600 space-y-1 pl-2 border-l-2 border-blue-200">
                      <div><strong>Current Configuration:</strong></div>
                      <div>• Home fixture deadline: <strong>{homeTime}</strong> on match day</div>
                      <div>• Away fixture deadline: <strong>{awayTime}</strong> on match day</div>
                      <div>• Result deadline: <strong>{resultTime}</strong>, {resultDayOffset} {resultDayOffset === 1 ? 'day' : 'days'} after match day</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-8 pt-6 border-t border-gray-200">
                <Link
                  href="/dashboard/committee/team-management/match-days"
                  className="inline-flex items-center px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors duration-200"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors duration-200 shadow-sm hover:shadow-md disabled:opacity-50"
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h2m5-4V9a1 1 0 00-1-1H6a1 1 0 00-1 1v4h4.5L15 9h3a2 2 0 012 2v9a2 2 0 01-2 2h-2" />
                      </svg>
                      Update Deadlines
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Modal Component */}
      <AlertModal
        isOpen={alertState.isOpen}
        onClose={closeAlert}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
      />
    </div>
  );
}

export default function EditRoundDeadlinesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading deadline editor...</p>
          </div>
        </div>
      }
    >
      <EditRoundDeadlinesContent />
    </Suspense>
  );
}
