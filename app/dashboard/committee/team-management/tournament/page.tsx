'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getActiveSeason } from '@/lib/firebase/seasons';
import { getTournamentSettings, saveTournamentSettings } from '@/lib/firebase/tournamentSettings';
import { generateSeasonFixtures, getFixturesByRounds, deleteSeasonFixtures, TournamentRound } from '@/lib/firebase/fixtures';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface Match {
  id: string;
  player1_id: string;
  player1_name: string;
  player1_category?: string;
  player2_id: string;
  player2_name: string;
  player2_category?: string;
  scheduled_date?: Date;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  result?: 'player1_win' | 'player2_win' | 'draw';
  player1_score?: number;
  player2_score?: number;
}

interface Standing {
  rank: number;
  player_id: string;
  player_name: string;
  category_name?: string;
  category_color?: string;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  win_rate: number;
}

type TabType = 'overview' | 'fixtures' | 'standings' | 'schedule' | 'settings';

export default function TournamentDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [matches, setMatches] = useState<Match[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [participantsCount, setParticipantsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  
  // Tournament Settings State
  const [tournamentName, setTournamentName] = useState('');
  const [squadSize, setSquadSize] = useState('11');
  const [tournamentSystem, setTournamentSystem] = useState('match_round');
  const [homeDeadlineTime, setHomeDeadlineTime] = useState('17:00');
  const [awayDeadlineTime, setAwayDeadlineTime] = useState('17:00');
  const [resultDayOffset, setResultDayOffset] = useState('2');
  const [resultDeadlineTime, setResultDeadlineTime] = useState('00:30');
  const [hasKnockoutStage, setHasKnockoutStage] = useState(false);
  const [playoffTeams, setPlayoffTeams] = useState('4');
  const [directSemifinalTeams, setDirectSemifinalTeams] = useState('2');
  const [qualificationThreshold, setQualificationThreshold] = useState('75');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  
  // Fixtures State
  const [fixtureRounds, setFixtureRounds] = useState<TournamentRound[]>([]);
  const [isGeneratingFixtures, setIsGeneratingFixtures] = useState(false);
  const [isDeletingFixtures, setIsDeletingFixtures] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user || user.role !== 'committee_admin') return;

      try {
        setIsLoading(true);
        
        // Get active season first
        const activeSeason = await getActiveSeason();
        
        if (activeSeason) {
          setActiveSeasonId(activeSeason.id);
          
          // Fetch teams for active season to get participants count
          const teamsRes = await fetch(`/api/team/all?season_id=${activeSeason.id}`);
          const teamsData = await teamsRes.json();
          
          if (teamsData.success && teamsData.data && teamsData.data.teams) {
            setParticipantsCount(teamsData.data.teams.length);
          }
          
          // Load existing tournament settings
          try {
            const settings = await getTournamentSettings(activeSeason.id);
            if (settings) {
              setTournamentName(settings.tournament_name);
              setSquadSize(settings.squad_size.toString());
              setTournamentSystem(settings.tournament_system);
              setHomeDeadlineTime(settings.home_deadline_time);
              setAwayDeadlineTime(settings.away_deadline_time);
              setResultDayOffset(settings.result_day_offset.toString());
              setResultDeadlineTime(settings.result_deadline_time);
              setHasKnockoutStage(settings.has_knockout_stage);
              setPlayoffTeams(settings.playoff_teams.toString());
              setDirectSemifinalTeams(settings.direct_semifinal_teams.toString());
              setQualificationThreshold(settings.qualification_threshold.toString());
              setSettingsLoaded(true);
            }
          } catch (error) {
            console.error('Error loading tournament settings:', error);
          }
          
          // Load fixtures
          await loadFixtures(activeSeason.id);
        }
        
        // TODO: Fetch real match data from API
        setMatches([]);
        setStandings([]);
      } catch (error) {
        console.error('Error fetching tournament data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);
  
  const loadFixtures = async (seasonId: string) => {
    try {
      const rounds = await getFixturesByRounds(seasonId);
      setFixtureRounds(rounds);
    } catch (error) {
      console.error('Error loading fixtures:', error);
    }
  };
  
  const handleGenerateFixtures = async () => {
    if (!activeSeasonId) {
      alert('No active season found');
      return;
    }
    
    if (participantsCount < 2) {
      alert('At least 2 teams are required to generate fixtures');
      return;
    }
    
    const confirm = window.confirm(
      `Generate fixtures for ${participantsCount} teams? This will create ${participantsCount - 1} rounds with ${Math.floor(participantsCount / 2)} matches per round for both legs (total ${2 * (participantsCount - 1)} rounds).`
    );
    
    if (!confirm) return;
    
    setIsGeneratingFixtures(true);
    
    try {
      // Fetch teams for active season (with automatic token refresh)
      const teamsRes = await fetchWithTokenRefresh(`/api/team/all?season_id=${activeSeasonId}`, {
        credentials: 'include'
      });
      
      if (!teamsRes.ok) {
        const errorText = await teamsRes.text();
        console.error('API error response:', errorText);
        throw new Error(`API returned ${teamsRes.status}: ${errorText}`);
      }
      
      const teamsData = await teamsRes.json();
      
      console.log('Teams API response:', teamsData);
      
      if (!teamsData.success) {
        throw new Error(teamsData.error || 'Failed to fetch teams');
      }
      
      if (!teamsData.data?.teams || teamsData.data.teams.length === 0) {
        throw new Error('No teams found for this season. Please register teams first.');
      }
      
      const teams = teamsData.data.teams;
      const teamIds = teams.map((t: any) => t.team.id);
      const teamNames = teams.map((t: any) => t.team.name);
      
      // Generate fixtures (2-legged by default)
      const result = await generateSeasonFixtures(activeSeasonId, teamIds, teamNames, true);
      
      if (result.success) {
        alert(`Successfully generated ${result.fixtures?.length} fixtures!`);
        await loadFixtures(activeSeasonId);
      } else {
        alert(result.error || 'Failed to generate fixtures');
      }
    } catch (error: any) {
      console.error('Error generating fixtures:', error);
      alert('Failed to generate fixtures: ' + error.message);
    } finally {
      setIsGeneratingFixtures(false);
    }
  };
  
  const handleDeleteFixtures = async () => {
    if (!activeSeasonId) return;
    
    const confirm = window.confirm(
      'Are you sure you want to delete ALL fixtures for this season? This action cannot be undone.'
    );
    
    if (!confirm) return;
    
    setIsDeletingFixtures(true);
    
    try {
      const success = await deleteSeasonFixtures(activeSeasonId);
      
      if (success) {
        alert('All fixtures deleted successfully');
        setFixtureRounds([]);
      } else {
        alert('Failed to delete fixtures');
      }
    } catch (error) {
      console.error('Error deleting fixtures:', error);
      alert('Failed to delete fixtures');
    } finally {
      setIsDeletingFixtures(false);
    }
  };
  
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!activeSeasonId) {
      alert('No active season found. Please create and activate a season first.');
      return;
    }
    
    setIsSavingSettings(true);
    
    try {
      const settings = {
        tournament_name: tournamentName,
        squad_size: parseInt(squadSize),
        tournament_system: tournamentSystem as 'match_round' | 'legacy',
        home_deadline_time: homeDeadlineTime,
        away_deadline_time: awayDeadlineTime,
        result_day_offset: parseInt(resultDayOffset),
        result_deadline_time: resultDeadlineTime,
        has_knockout_stage: hasKnockoutStage,
        playoff_teams: parseInt(playoffTeams),
        direct_semifinal_teams: parseInt(directSemifinalTeams),
        qualification_threshold: parseInt(qualificationThreshold),
      };
      
      // Save to Firebase
      await saveTournamentSettings(activeSeasonId, settings);
      
      alert('Tournament settings saved successfully!');
      setSettingsLoaded(true);
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save tournament settings. Please try again.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tournament...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'committee_admin') {
    return null;
  }

  // Calculate stats from fixture rounds
  const totalMatches = fixtureRounds.reduce((acc, round) => acc + round.total_matches, 0);
  const completedMatches = fixtureRounds.reduce((acc, round) => acc + round.completed_matches, 0);
  const pendingMatches = totalMatches - completedMatches;
  
  // Get all matches from fixtures for display
  const allMatches = fixtureRounds.flatMap(round => 
    round.matches.map(match => ({
      ...match,
      round_number: round.round_number,
      leg: round.leg
    }))
  );
  
  const upcomingMatches = allMatches
    .filter(m => m.status === 'scheduled')
    .slice(0, 5);
    
  const recentMatches = allMatches
    .filter(m => m.status === 'completed')
    .sort((a, b) => {
      // Sort by updated_at if available, otherwise by id
      if (a.updated_at && b.updated_at) {
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
      return 0;
    })
    .slice(0, 5);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">Tournament Dashboard</h1>
          <p className="text-gray-500 mt-1">Manage fixtures, standings, and match operations</p>
          <div className="flex gap-4 mt-2">
            <Link
              href="/dashboard/committee/team-management"
              className="inline-flex items-center text-[#0066FF] hover:text-[#0052CC]"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Team Management
            </Link>
            <Link
              href="/dashboard/committee/team-management/match-days"
              className="inline-flex items-center text-green-600 hover:text-green-700 font-medium"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Match Day Management
            </Link>
          </div>
        </div>

      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 backdrop-blur-md rounded-xl p-4 border border-blue-200/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Total Matches</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalMatches}</p>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 backdrop-blur-md rounded-xl p-4 border border-green-200/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Completed</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{completedMatches}</p>
            </div>
            <div className="p-3 bg-green-500/20 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 backdrop-blur-md rounded-xl p-4 border border-orange-200/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Pending</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{pendingMatches}</p>
            </div>
            <div className="p-3 bg-orange-500/20 rounded-lg">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 backdrop-blur-md rounded-xl p-4 border border-purple-200/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Participants</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{participantsCount}</p>
            </div>
            <div className="p-3 bg-purple-500/20 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 0 1 9.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'overview'
                  ? 'border-[#0066FF] text-[#0066FF]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('fixtures')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'fixtures'
                  ? 'border-[#0066FF] text-[#0066FF]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Fixtures
            </button>
            <button
              onClick={() => setActiveTab('standings')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'standings'
                  ? 'border-[#0066FF] text-[#0066FF]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Standings
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'settings'
                  ? 'border-[#0066FF] text-[#0066FF]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Settings
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Upcoming Matches */}
          <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-6 border border-gray-100/20">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <svg className="w-5 h-5 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Upcoming Matches
              </h2>
              <button
                onClick={() => setActiveTab('fixtures')}
                className="text-sm text-[#0066FF] hover:text-[#0052CC] font-medium"
              >
                View All →
              </button>
            </div>

            {upcomingMatches.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p>No upcoming matches scheduled</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingMatches.map((match: any) => (
                  <div key={match.id} className="glass rounded-xl p-4 border border-gray-200/50 hover:border-[#0066FF]/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                            R{match.round_number} - {match.leg === 'first' ? '1st' : '2nd'} Leg
                          </span>
                          <span className="text-xs text-gray-500">Match {match.match_number}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">{match.home_team_name}</span>
                          <span className="text-xs text-gray-500 mx-2">VS</span>
                          <span className="text-sm font-medium text-gray-900">{match.away_team_name}</span>
                        </div>
                        {match.scheduled_date && (
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(match.scheduled_date).toLocaleDateString()} at {new Date(match.scheduled_date).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                      <button className="ml-4 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors">
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Results */}
          <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-6 border border-gray-100/20">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Recent Results
              </h2>
              <button
                onClick={() => setActiveTab('fixtures')}
                className="text-sm text-[#0066FF] hover:text-[#0052CC] font-medium"
              >
                View All →
              </button>
            </div>

            {recentMatches.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p>No completed matches yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentMatches.map((match: any) => (
                  <div key={match.id} className="glass rounded-xl p-4 border border-gray-200/50">
                    <div className="mb-2">
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        R{match.round_number} - {match.leg === 'first' ? '1st' : '2nd'} Leg
                      </span>
                      <span className="text-xs text-gray-500 ml-2">Match {match.match_number}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`flex-1 text-right ${match.result === 'home_win' ? 'font-bold text-green-600' : 'text-gray-600'}`}>
                          <span className="text-sm">{match.home_team_name}</span>
                          {match.home_score !== undefined && (
                            <span className="ml-2 text-lg">{match.home_score}</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">-</span>
                        <div className={`flex-1 text-left ${match.result === 'away_win' ? 'font-bold text-green-600' : 'text-gray-600'}`}>
                          {match.away_score !== undefined && (
                            <span className="mr-2 text-lg">{match.away_score}</span>
                          )}
                          <span className="text-sm">{match.away_team_name}</span>
                        </div>
                      </div>
                      {match.result === 'draw' && (
                        <span className="ml-4 px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded-full">Draw</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'fixtures' && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-xl p-4 border border-gray-100/20 flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-gray-800">Tournament Fixtures</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {fixtureRounds.length > 0 
                  ? `${fixtureRounds.length} rounds • ${fixtureRounds.reduce((acc, r) => acc + r.total_matches, 0)} total matches`
                  : 'No fixtures generated yet'}
              </p>
            </div>
            <div className="flex gap-2">
              {fixtureRounds.length > 0 && (
                <button
                  onClick={handleDeleteFixtures}
                  disabled={isDeletingFixtures}
                  className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeletingFixtures ? 'Deleting...' : 'Delete All Fixtures'}
                </button>
              )}
              <button
                onClick={handleGenerateFixtures}
                disabled={isGeneratingFixtures || participantsCount < 2}
                className="px-4 py-2 bg-[#0066FF] text-white rounded-xl hover:bg-[#0052CC] transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isGeneratingFixtures ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    {fixtureRounds.length > 0 ? 'Regenerate Fixtures' : 'Generate Fixtures'}
                  </>
                )}
              </button>
            </div>
          </div>

          {fixtureRounds.length === 0 ? (
            <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-12 text-center border border-gray-100/20">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-600 mb-2">No Fixtures Available</h3>
              <p className="text-sm text-gray-500 mb-4">Generate round-robin fixtures to start the tournament</p>
              <p className="text-xs text-gray-400">Click the "Generate Fixtures" button above to create fixtures</p>
            </div>
          ) : (
            <div className="space-y-6">
              {fixtureRounds.map((round) => (
                <div key={round.round_number} className="bg-white/90 backdrop-blur-md shadow-xl rounded-2xl overflow-hidden border border-gray-100/20">
                  <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 px-6 py-4 border-b border-gray-100">
                    <div className="flex justify-between items-center">
                      <div>
                        <h2 className="text-xl font-bold text-gray-800">Round {round.round_number}</h2>
                        <p className="text-sm text-gray-600">
                          {round.total_matches} matches ({round.leg === 'first' ? 'First Leg' : 'Second Leg'})
                        </p>
                      </div>
                      <div className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full font-medium">
                        {round.completed_matches}/{round.total_matches} Complete
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {round.matches.map((match) => (
                        <div key={match.id} className="bg-white/90 backdrop-blur-md shadow-md rounded-xl overflow-hidden border border-gray-100 hover:shadow-lg transition-all duration-200">
                          <div className="p-4">
                            <div className="flex justify-between items-center mb-3">
                              <div className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                Match {match.match_number}
                              </div>
                              <div className={`text-xs font-medium rounded-full px-2 py-1 ${
                                match.status === 'completed' ? 'bg-green-100 text-green-700' :
                                match.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-blue-100 text-blue-700'
                              }`}>
                                {match.status === 'completed' ? 'Completed' :
                                 match.status === 'in_progress' ? 'Live' : 'Scheduled'}
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between py-2">
                              <div className="flex flex-col items-start flex-1">
                                <span className={`font-medium text-sm ${
                                  match.status === 'completed' && match.result === 'home_win' ? 'text-green-600' : 'text-gray-900'
                                }`}>
                                  {match.home_team_name}
                                </span>
                                {match.status === 'completed' && (
                                  <span className="text-lg font-bold">{match.home_score}</span>
                                )}
                              </div>
                              <div className="text-sm text-gray-400 mx-2">vs</div>
                              <div className="flex flex-col items-end flex-1">
                                <span className={`font-medium text-sm ${
                                  match.status === 'completed' && match.result === 'away_win' ? 'text-green-600' : 'text-gray-900'
                                }`}>
                                  {match.away_team_name}
                                </span>
                                {match.status === 'completed' && (
                                  <span className="text-lg font-bold">{match.away_score}</span>
                                )}
                              </div>
                            </div>
                            
                            {match.status !== 'completed' && (
                              <div className="mt-3">
                                <button className="w-full px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 transition-all">
                                  Record Result
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'standings' && (
        <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl overflow-hidden border border-gray-100/20">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Tournament Standings</h2>
          </div>

          {standings.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-600 mb-2">No Standings Data</h3>
              <p className="text-sm">Complete matches to generate standings</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Player</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">MP</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">W</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">D</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">L</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Points</th>
                  </tr>
                </thead>
                <tbody className="bg-white/60 divide-y divide-gray-200/50">
                  {standings.map((standing) => (
                    <tr key={standing.player_id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                        {standing.rank === 1 && '🥇'}
                        {standing.rank === 2 && '🥈'}
                        {standing.rank === 3 && '🥉'}
                        {standing.rank > 3 && `#${standing.rank}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {standing.player_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                        {standing.matches_played}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-green-600">
                        {standing.wins}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                        {standing.draws}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-red-600">
                        {standing.losses}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-gray-900">
                        {standing.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Tournament Info */}
          <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-6 border border-gray-100/20">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Tournament Settings</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tournament Name</label>
                <input
                  type="text"
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                  placeholder="Enter tournament name"
                  className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Squad Size</label>
                <input
                  type="number"
                  min="1"
                  value={squadSize}
                  onChange={(e) => setSquadSize(e.target.value)}
                  placeholder="Number of players per team"
                  className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                  required
                />
              </div>
            </div>
          </div>

          {/* Tournament System */}
          <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-6 border border-gray-100/20">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Tournament System</h3>
            
            <div className="space-y-3">
              <label className="flex items-start">
                <input
                  type="radio"
                  name="tournament_system"
                  value="match_round"
                  checked={tournamentSystem === 'match_round'}
                  onChange={(e) => setTournamentSystem(e.target.value)}
                  className="mt-1 rounded border-gray-300 text-[#0066FF] focus:ring-[#0066FF]"
                />
                <span className="ml-3">
                  <strong className="text-sm text-gray-900">MatchRound System</strong>
                  <span className="block text-xs text-green-600 mt-0.5">✓ Recommended - Flexible round-by-round deadlines</span>
                </span>
              </label>
              
              <label className="flex items-start">
                <input
                  type="radio"
                  name="tournament_system"
                  value="legacy"
                  checked={tournamentSystem === 'legacy'}
                  onChange={(e) => setTournamentSystem(e.target.value)}
                  className="mt-1 rounded border-gray-300 text-[#0066FF] focus:ring-[#0066FF]"
                />
                <span className="ml-3">
                  <strong className="text-sm text-gray-900">Legacy System</strong>
                  <span className="block text-xs text-gray-500 mt-0.5">Fixed tournament-wide deadlines</span>
                </span>
              </label>
            </div>
          </div>

          {/* Deadline Settings */}
          <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-6 border border-gray-100/20">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Default Match Round Deadlines</h3>
            
            <div className="bg-blue-50/50 border border-blue-200/50 rounded-xl p-4 mb-4">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h4 className="text-sm font-medium text-blue-800">MatchRound System Active</h4>
                  <p className="text-xs text-blue-600 mt-1">
                    Configure tournament-wide default deadlines below. Individual rounds can override these settings.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Home Fixture Deadline Time
                  <span className="text-xs text-green-600 ml-1">(Default)</span>
                </label>
                <input
                  type="time"
                  value={homeDeadlineTime}
                  onChange={(e) => setHomeDeadlineTime(e.target.value)}
                  className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                />
                <p className="text-xs text-gray-500 mt-1">Daily deadline for home fixture creation (IST)</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Away Fixture Deadline Time
                  <span className="text-xs text-green-600 ml-1">(Default)</span>
                </label>
                <input
                  type="time"
                  value={awayDeadlineTime}
                  onChange={(e) => setAwayDeadlineTime(e.target.value)}
                  className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                />
                <p className="text-xs text-gray-500 mt-1">Daily deadline for away modifications (IST)</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Result Entry Day Offset
                  <span className="text-xs text-green-600 ml-1">(Default)</span>
                </label>
                <select 
                  value={resultDayOffset}
                  onChange={(e) => setResultDayOffset(e.target.value)}
                  className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                >
                  <option value="1">Next day (Day 1)</option>
                  <option value="2">Day after tomorrow (Day 2)</option>
                  <option value="3">3 days later (Day 3)</option>
                  <option value="4">4 days later (Day 4)</option>
                  <option value="7">1 week later (Day 7)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Days after fixture when results are due</p>
              </div>
            </div>
            
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Result Entry Deadline Time
                <span className="text-xs text-green-600 ml-1">(Default)</span>
              </label>
              <input
                type="time"
                value={resultDeadlineTime}
                onChange={(e) => setResultDeadlineTime(e.target.value)}
                className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
              />
              <p className="text-xs text-gray-500 mt-1">Time when results are due on the deadline day (IST)</p>
              
              <div className="mt-2 p-3 bg-blue-50/50 border border-blue-200/50 rounded-lg">
                <p className="text-xs text-blue-700">
                  <strong>Example:</strong> If fixture is on Monday and you select "Day 2" + "00:30", 
                  results are due by <strong>12:30 AM on Wednesday</strong> (IST).
                </p>
              </div>
            </div>
          </div>

          {/* Knockout Stage Settings */}
          <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-6 border border-gray-100/20">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Knockout Stage Settings</h3>
            
            <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={hasKnockoutStage}
                  onChange={(e) => setHasKnockoutStage(e.target.checked)}
                  className="rounded border-gray-300 text-[#0066FF] focus:ring-[#0066FF]"
                />
                <span className="ml-2 text-sm font-medium text-gray-700">Enable Knockout Stage</span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-6">Add playoff stages after league completion</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Total Playoff Teams</label>
                <input
                  type="number"
                  min="1"
                  value={playoffTeams}
                  onChange={(e) => setPlayoffTeams(e.target.value)}
                  disabled={!hasKnockoutStage}
                  className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Teams qualifying for knockouts</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Direct to Semifinals</label>
                <input
                  type="number"
                  min="0"
                  max={playoffTeams}
                  value={directSemifinalTeams}
                  onChange={(e) => setDirectSemifinalTeams(e.target.value)}
                  disabled={!hasKnockoutStage}
                  className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Top teams skip quarterfinals</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirmation Threshold (%)</label>
                <select 
                  value={qualificationThreshold}
                  onChange={(e) => setQualificationThreshold(e.target.value)}
                  disabled={!hasKnockoutStage}
                  className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="50">50% - Early Confirmation</option>
                  <option value="65">65% - Moderate</option>
                  <option value="75">75% - Standard</option>
                  <option value="85">85% - Conservative</option>
                  <option value="95">95% - Very Late</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">% of matches before positions are confirmed</p>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                // Reset to defaults
                setTournamentName('');
                setSquadSize('11');
                setTournamentSystem('match_round');
                setHomeDeadlineTime('17:00');
                setAwayDeadlineTime('17:00');
                setResultDayOffset('2');
                setResultDeadlineTime('00:30');
                setHasKnockoutStage(false);
                setPlayoffTeams('4');
                setDirectSemifinalTeams('2');
                setQualificationThreshold('75');
              }}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium shadow-sm"
            >
              Reset to Defaults
            </button>
            <button
              type="submit"
              disabled={isSavingSettings}
              className="px-6 py-3 bg-[#0066FF] text-white rounded-xl hover:bg-[#0052CC] transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isSavingSettings ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
