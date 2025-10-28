'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getActiveSeason, getSeasonById } from '@/lib/firebase/seasons';
import { getTournamentSettings, saveTournamentSettings } from '@/lib/firebase/tournamentSettings';
import { generateSeasonFixtures, getFixturesByRounds, deleteSeasonFixtures, TournamentRound } from '@/lib/firebase/fixtures';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
import { usePermissions } from '@/hooks/usePermissions';
import { useModal } from '@/hooks/useModal';
import AlertModal from '@/components/modals/AlertModal';
import ConfirmModal from '@/components/modals/ConfirmModal';

interface Match {
  id: string;
  home_team_name: string;
  away_team_name: string;
  round_number: number;
  leg: string;
  match_number: number;
  scheduled_date?: Date;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  result?: 'home_win' | 'away_win' | 'draw';
  home_score?: number;
  away_score?: number;
  tournament_name?: string;
  tournament_id?: string;
  updated_at?: string;
}

type TabType = 'overview' | 'teams' | 'fixtures' | 'standings' | 'management';

export default function TournamentDashboardPage() {
  const { user, loading } = useAuth();
  const { userSeasonId } = usePermissions();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [participantsCount, setParticipantsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  
  // Tournament Management State
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [isCreatingTournament, setIsCreatingTournament] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTournament, setEditingTournament] = useState<any>(null);
  const [newTournament, setNewTournament] = useState({
    tournament_type: 'league',
    tournament_name: '',
    tournament_code: '',
    status: 'active',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    description: '',
    is_primary: false,
    display_order: 1,
    include_in_fantasy: true,
    include_in_awards: true,
    squad_size: 11,
    tournament_system: 'match_round',
    home_deadline_time: '17:00',
    away_deadline_time: '17:00',
    result_day_offset: 2,
    result_deadline_time: '00:30',
    has_group_stage: false,
    number_of_groups: 4,
    teams_per_group: 4,
    teams_advancing_per_group: 2,
    has_knockout_stage: false,
    playoff_teams: 4,
    direct_semifinal_teams: 2,
    qualification_threshold: 75,
    is_pure_knockout: false
  });
  
  // Teams State
  const [selectedTournamentForTeams, setSelectedTournamentForTeams] = useState<string>('');
  const [tournamentTeams, setTournamentTeams] = useState<any[]>([]);
  const [selectedTeamsForTournament, setSelectedTeamsForTournament] = useState<string[]>([]);
  const [isSavingTeams, setIsSavingTeams] = useState(false);
  
  // Fixtures State
  const [selectedTournamentForFixtures, setSelectedTournamentForFixtures] = useState<string>('');
  const [tournamentFixtures, setTournamentFixtures] = useState<any[]>([]);
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [isGeneratingFixtures, setIsGeneratingFixtures] = useState(false);
  const [isDeletingFixtures, setIsDeletingFixtures] = useState(false);
  const [teamSearchTerm, setTeamSearchTerm] = useState('');
  const [selectedRound, setSelectedRound] = useState<number>(1);
  
  // Standings State
  const [selectedTournamentForStandings, setSelectedTournamentForStandings] = useState<string>('');
  const [standingsTab, setStandingsTab] = useState<'table' | 'bracket'>('table');
  const [tournamentStandings, setTournamentStandings] = useState<any[]>([]);
  
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

  // Auto-generate tournament name and code
  useEffect(() => {
    if (!activeSeasonId || !newTournament.tournament_type) return;
    
    const seasonMatch = activeSeasonId.match(/S(\d+)/);
    const seasonNumber = seasonMatch ? `S${seasonMatch[1]}` : activeSeasonId;
    
    const typeMap: Record<string, { code: string, name: string }> = {
      'league': { code: 'L', name: 'League' },
      'cup': { code: 'C', name: 'Cup' },
      'ucl': { code: 'CH', name: 'Champions League' },
      'uel': { code: 'EL', name: 'Europa League' },
      'super_cup': { code: 'SC', name: 'Super Cup' },
      'league_cup': { code: 'LC', name: 'League Cup' },
    };
    
    const typeInfo = typeMap[newTournament.tournament_type.toLowerCase()] || 
                     { code: newTournament.tournament_type.toUpperCase(), name: newTournament.tournament_type };
    
    const generatedCode = `SSPSL${seasonNumber}${typeInfo.code}`;
    const generatedName = `SS Super League ${seasonNumber} ${typeInfo.name}`;
    
    setNewTournament(prev => ({
      ...prev,
      tournament_code: generatedCode,
      tournament_name: generatedName
    }));
  }, [newTournament.tournament_type, activeSeasonId]);

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
        
        let seasonId = userSeasonId;
        let season = null;
        
        if (seasonId) {
          season = await getSeasonById(seasonId);
        } else {
          season = await getActiveSeason();
          seasonId = season?.id || null;
        }
        
        if (season && seasonId) {
          setActiveSeasonId(seasonId);
          
          // Fetch teams
          const teamsRes = await fetch(`/api/team/all?season_id=${seasonId}`);
          const teamsData = await teamsRes.json();
          
          if (teamsData.success && teamsData.data && teamsData.data.teams) {
            setParticipantsCount(teamsData.data.teams.length);
            setAllTeams(teamsData.data.teams);
          }
          
          // Load tournaments
          await loadTournaments(seasonId);
        }
      } catch (error) {
        console.error('Error fetching tournament data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, userSeasonId]);
  
  const loadTournaments = async (seasonId: string) => {
    try {
      const res = await fetch(`/api/tournaments?season_id=${seasonId}`);
      const data = await res.json();
      if (data.success) {
        setTournaments(data.tournaments || []);
        
        // Load fixtures from all tournaments
        const allTournamentFixtures: any[] = [];
        for (const tournament of data.tournaments || []) {
          const fixturesRes = await fetch(`/api/tournaments/${tournament.id}/fixtures`);
          const fixturesData = await fixturesRes.json();
          if (fixturesData.success && fixturesData.fixtures) {
            allTournamentFixtures.push(...fixturesData.fixtures.map((f: any) => ({
              ...f,
              tournament_name: tournament.tournament_name,
              tournament_id: tournament.id
            })));
          }
        }
        setTournamentFixtures(allTournamentFixtures);
      }
    } catch (error) {
      console.error('Error loading tournaments:', error);
    }
  };

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!activeSeasonId) {
      showAlert({
        type: 'error',
        title: 'No Season',
        message: 'No season available. Please refresh the page.'
      });
      return;
    }
    
    setIsCreatingTournament(true);
    
    try {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_id: activeSeasonId,
          ...newTournament
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        showAlert({
          type: 'success',
          title: 'Tournament Created',
          message: `${newTournament.tournament_name} created successfully!`
        });
        
        // Reset form
        setNewTournament({
          tournament_type: 'league',
          tournament_name: '',
          tournament_code: '',
          status: 'active',
          start_date: new Date().toISOString().split('T')[0],
          end_date: '',
          description: '',
          is_primary: false,
          display_order: 1,
          include_in_fantasy: true,
          include_in_awards: true,
          squad_size: 11,
          tournament_system: 'match_round',
          home_deadline_time: '17:00',
          away_deadline_time: '17:00',
          result_day_offset: 2,
          result_deadline_time: '00:30',
          has_group_stage: false,
          number_of_groups: 4,
          teams_per_group: 4,
          teams_advancing_per_group: 2,
          has_knockout_stage: false,
          playoff_teams: 4,
          direct_semifinal_teams: 2,
          qualification_threshold: 75,
          is_pure_knockout: false
        });
        
        setShowCreateForm(false);
        await loadTournaments(activeSeasonId);
      } else {
        showAlert({
          type: 'error',
          title: 'Creation Failed',
          message: data.error || 'Failed to create tournament'
        });
      }
    } catch (error: any) {
      console.error('Error creating tournament:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to create tournament: ' + error.message
      });
    } finally {
      setIsCreatingTournament(false);
    }
  };

  const handleDeleteTournament = async (tournamentId: string, tournamentName: string) => {
    const confirmed = await showConfirm({
      type: 'danger',
      title: 'Delete Tournament',
      message: `Are you sure you want to delete "${tournamentName}"? This will also delete all associated fixtures, stats, and settings. This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel'
    });
    
    if (!confirmed) return;
    
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}`, {
        method: 'DELETE'
      });
      
      const data = await res.json();
      
      if (data.success) {
        showAlert({
          type: 'success',
          title: 'Tournament Deleted',
          message: `${tournamentName} deleted successfully!`
        });
        
        await loadTournaments(activeSeasonId!);
      } else {
        showAlert({
          type: 'error',
          title: 'Delete Failed',
          message: data.error || 'Failed to delete tournament'
        });
      }
    } catch (error: any) {
      console.error('Error deleting tournament:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete tournament: ' + error.message
      });
    }
  };

  const loadTournamentFixtures = async (tournamentId: string) => {
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/fixtures`);
      const data = await res.json();
      if (data.success) {
        setTournamentFixtures(data.fixtures || []);
      }
    } catch (error) {
      console.error('Error loading tournament fixtures:', error);
    }
  };

  const handleGenerateTournamentFixtures = async () => {
    if (!selectedTournamentForFixtures) {
      showAlert({
        type: 'warning',
        title: 'No Tournament Selected',
        message: 'Please select a tournament first'
      });
      return;
    }
    
    if (selectedTeams.length < 2) {
      showAlert({
        type: 'warning',
        title: 'Insufficient Teams',
        message: 'Please select at least 2 teams'
      });
      return;
    }
    
    const confirmed = await showConfirm({
      type: 'info',
      title: 'Generate Fixtures',
      message: `Generate fixtures for ${selectedTeams.length} teams? This will create a complete round-robin schedule.`,
      confirmText: 'Generate',
      cancelText: 'Cancel'
    });
    
    if (!confirmed) return;
    
    setIsGeneratingFixtures(true);
    try {
      const res = await fetch(`/api/tournaments/${selectedTournamentForFixtures}/fixtures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_ids: selectedTeams,
          is_two_legged: true
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        showAlert({
          type: 'success',
          title: 'Fixtures Generated',
          message: `${data.fixtures_count} fixtures created successfully!`
        });
        await loadTournamentFixtures(selectedTournamentForFixtures);
      } else {
        showAlert({
          type: 'error',
          title: 'Generation Failed',
          message: data.error || 'Failed to generate fixtures'
        });
      }
    } catch (error: any) {
      console.error('Error generating fixtures:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to generate fixtures: ' + error.message
      });
    } finally {
      setIsGeneratingFixtures(false);
    }
  };

  const handleDeleteTournamentFixtures = async () => {
    if (!selectedTournamentForFixtures) return;
    
    const confirmed = await showConfirm({
      type: 'danger',
      title: 'Delete Fixtures',
      message: 'Delete all fixtures for this tournament? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    });
    
    if (!confirmed) return;
    
    setIsDeletingFixtures(true);
    try {
      const res = await fetch(`/api/tournaments/${selectedTournamentForFixtures}/fixtures`, {
        method: 'DELETE'
      });
      
      const data = await res.json();
      
      if (data.success) {
        showAlert({
          type: 'success',
          title: 'Deleted',
          message: 'All fixtures deleted successfully'
        });
        setTournamentFixtures([]);
      } else {
        showAlert({
          type: 'error',
          title: 'Delete Failed',
          message: data.error || 'Failed to delete fixtures'
        });
      }
    } catch (error) {
      console.error('Error deleting fixtures:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete fixtures'
      });
    } finally {
      setIsDeletingFixtures(false);
    }
  };

  const loadTournamentTeams = async (tournamentId: string) => {
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/teams`);
      const data = await res.json();
      if (data.success) {
        setTournamentTeams(data.teams || []);
        // Pre-select teams that are already assigned
        const assignedTeamIds = data.teams
          .filter((t: any) => t.is_participating)
          .map((t: any) => t.team_id);
        setSelectedTeamsForTournament(assignedTeamIds);
      }
    } catch (error) {
      console.error('Error loading tournament teams:', error);
    }
  };

  const handleSaveTournamentTeams = async () => {
    if (!selectedTournamentForTeams) return;
    
    setIsSavingTeams(true);
    try {
      const res = await fetch(`/api/tournaments/${selectedTournamentForTeams}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_ids: selectedTeamsForTournament
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        showAlert({
          type: 'success',
          title: 'Teams Saved',
          message: `${data.assigned_count} team(s) assigned to tournament`
        });
        await loadTournamentTeams(selectedTournamentForTeams);
      } else {
        showAlert({
          type: 'error',
          title: 'Save Failed',
          message: data.error || 'Failed to save teams'
        });
      }
    } catch (error: any) {
      console.error('Error saving teams:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to save teams: ' + error.message
      });
    } finally {
      setIsSavingTeams(false);
    }
  };

  const loadTournamentStandings = async (tournamentId: string) => {
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/standings`);
      const data = await res.json();
      if (data.success) {
        setTournamentStandings(data.standings || []);
      }
    } catch (error) {
      console.error('Error loading tournament standings:', error);
    }
  };

  useEffect(() => {
    if (selectedTournamentForTeams) {
      loadTournamentTeams(selectedTournamentForTeams);
    } else {
      setTournamentTeams([]);
      setSelectedTeamsForTournament([]);
    }
  }, [selectedTournamentForTeams]);

  useEffect(() => {
    if (selectedTournamentForFixtures) {
      loadTournamentFixtures(selectedTournamentForFixtures);
    } else {
      setTournamentFixtures([]);
    }
  }, [selectedTournamentForFixtures]);

  useEffect(() => {
    if (selectedTournamentForStandings) {
      loadTournamentStandings(selectedTournamentForStandings);
    } else {
      setTournamentStandings([]);
    }
  }, [selectedTournamentForStandings]);

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600 font-medium">Loading tournament dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'committee_admin') {
    return null;
  }

  // Calculate stats
  const totalMatches = tournamentFixtures.length;
  const completedMatches = tournamentFixtures.filter(f => f.status === 'completed').length;
  const pendingMatches = totalMatches - completedMatches;
  
  const allMatches = tournamentFixtures;
  const upcomingMatches = allMatches.filter(m => m.status !== 'completed').slice(0, 5);
  const recentMatches = allMatches
    .filter(m => m.status === 'completed')
    .sort((a, b) => {
      if (a.updated_at && b.updated_at) {
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
      return 0;
    })
    .slice(0, 5);

  // Filter teams for search
  const filteredTeams = allTeams.filter((teamData: any) => 
    teamData.team.name.toLowerCase().includes(teamSearchTerm.toLowerCase()) ||
    teamData.team.id.toLowerCase().includes(teamSearchTerm.toLowerCase())
  );

  // Get selected tournament details
  const selectedTournament = tournaments.find(t => t.id === selectedTournamentForFixtures);
  
  // Calculate max rounds from fixtures
  const fixturesForSelectedTournament = tournamentFixtures.filter(f => f.tournament_id === selectedTournamentForFixtures);
  const maxRounds = fixturesForSelectedTournament.length > 0 
    ? Math.max(...fixturesForSelectedTournament.map(f => f.round_number || 0))
    : 14;

  // Filter fixtures by selected round
  const filteredFixtures = selectedRound === 0 
    ? fixturesForSelectedTournament 
    : fixturesForSelectedTournament.filter(f => f.round_number === selectedRound);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-4 sm:py-8 px-4">
      <div className="container mx-auto max-w-screen-2xl">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col gap-4">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Link href="/dashboard/committee" className="hover:text-[#0066FF] transition-colors">
                Committee
              </Link>
              <span>/</span>
              <Link href="/dashboard/committee/team-management" className="hover:text-[#0066FF] transition-colors">
                Team Management
              </Link>
              <span>/</span>
              <span className="text-gray-900 font-medium">Tournament</span>
            </div>
            
            {/* Title & Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                  🏆 Tournament Management
                </h1>
                <p className="text-gray-600 text-sm sm:text-base">
                  Create tournaments, manage fixtures, and track standings
                </p>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/dashboard/committee/team-management/match-days"
                  className="inline-flex items-center px-4 sm:px-6 py-2.5 sm:py-3 glass rounded-xl border border-white/20 text-gray-700 hover:bg-white hover:shadow-lg transition-all text-sm font-medium whitespace-nowrap"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Match Days
                </Link>
                <Link
                  href="/dashboard/committee/team-management"
                  className="inline-flex items-center px-4 sm:px-6 py-2.5 sm:py-3 glass rounded-xl border border-white/20 text-gray-700 hover:bg-white hover:shadow-lg transition-all text-sm font-medium whitespace-nowrap"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="glass rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-blue-50 to-blue-100/50 shadow-lg border border-blue-200/30 hover:shadow-xl transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs sm:text-sm text-blue-900/70 font-medium mb-1">Total Matches</p>
                <p className="text-2xl sm:text-3xl font-bold text-blue-900">{totalMatches}</p>
              </div>
              <div className="p-2 sm:p-3 bg-blue-500/20 rounded-lg">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-green-50 to-green-100/50 shadow-lg border border-green-200/30 hover:shadow-xl transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs sm:text-sm text-green-900/70 font-medium mb-1">Completed</p>
                <p className="text-2xl sm:text-3xl font-bold text-green-900">{completedMatches}</p>
              </div>
              <div className="p-2 sm:p-3 bg-green-500/20 rounded-lg">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-orange-50 to-orange-100/50 shadow-lg border border-orange-200/30 hover:shadow-xl transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs sm:text-sm text-orange-900/70 font-medium mb-1">Pending</p>
                <p className="text-2xl sm:text-3xl font-bold text-orange-900">{pendingMatches}</p>
              </div>
              <div className="p-2 sm:p-3 bg-orange-500/20 rounded-lg">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-purple-50 to-purple-100/50 shadow-lg border border-purple-200/30 hover:shadow-xl transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs sm:text-sm text-purple-900/70 font-medium mb-1">Teams</p>
                <p className="text-2xl sm:text-3xl font-bold text-purple-900">{participantsCount}</p>
              </div>
              <div className="p-2 sm:p-3 bg-purple-500/20 rounded-lg">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Modern Tab Navigation */}
        <div className="mb-6 sm:mb-8">
          <div className="glass rounded-2xl p-2 inline-flex gap-2 shadow-lg border border-white/20 overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm transition-all inline-flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <span className="text-base sm:text-lg">📊</span>
              <span>Overview</span>
            </button>
            <button
              onClick={() => setActiveTab('teams')}
              className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm transition-all inline-flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'teams'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <span className="text-base sm:text-lg">👥</span>
              <span>Teams</span>
            </button>
            <button
              onClick={() => setActiveTab('fixtures')}
              className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm transition-all inline-flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'fixtures'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <span className="text-base sm:text-lg">📅</span>
              <span>Fixtures</span>
            </button>
            <button
              onClick={() => setActiveTab('standings')}
              className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm transition-all inline-flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'standings'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <span className="text-base sm:text-lg">🏆</span>
              <span>Standings</span>
            </button>
            <button
              onClick={() => setActiveTab('management')}
              className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm transition-all inline-flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'management'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <span className="text-base sm:text-lg">⚙️</span>
              <span>Management</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Tournaments Overview */}
            <div className="glass rounded-3xl p-4 sm:p-6 shadow-xl border border-white/20">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                  🏆 Active Tournaments
                </h2>
                <button
                  onClick={() => setActiveTab('management')}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all text-sm font-medium"
                >
                  + Create
                </button>
              </div>
              
              {tournaments.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                  <p className="text-gray-500 font-medium mb-4">No tournaments created yet</p>
                  <button
                    onClick={() => setActiveTab('management')}
                    className="text-sm text-[#0066FF] hover:text-[#0052CC] font-medium"
                  >
                    Create your first tournament →
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tournaments.map((tournament) => (
                    <div key={tournament.id} className="glass rounded-xl p-5 border border-gray-200/50 hover:border-blue-300/50 hover:shadow-xl transition-all group">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">{tournament.tournament_name}</h3>
                          <p className="text-xs text-gray-500 font-mono">{tournament.tournament_code}</p>
                        </div>
                        <span className={`px-2.5 py-1 text-xs rounded-full font-medium shrink-0 ${
                          tournament.status === 'active' ? 'bg-green-100 text-green-700' :
                          tournament.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {tournament.status}
                        </span>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center text-xs text-gray-600">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                          {tournament.tournament_type === 'league' ? '⚽ League' :
                           tournament.tournament_type === 'cup' ? '🏆 Cup' :
                           tournament.tournament_type === 'ucl' ? '🌟 Champions League' :
                           tournament.tournament_type === 'uel' ? '⭐ Europa League' :
                           tournament.tournament_type}
                        </div>
                        
                        {tournament.has_knockout_stage && (
                          <div className="text-xs text-purple-600 font-medium">
                            🥊 Includes Knockout Stage
                          </div>
                        )}
                        
                        {tournament.has_group_stage && (
                          <div className="text-xs text-blue-600 font-medium">
                            👥 {tournament.number_of_groups} Groups × {tournament.teams_per_group} Teams
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedTournamentForFixtures(tournament.id);
                            setActiveTab('fixtures');
                          }}
                          className="flex-1 px-3 py-2 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          📅 Fixtures
                        </button>
                        <button
                          onClick={() => {
                            setSelectedTournamentForStandings(tournament.id);
                            setActiveTab('standings');
                          }}
                          className="flex-1 px-3 py-2 bg-purple-50 text-purple-700 text-xs font-medium rounded-lg hover:bg-purple-100 transition-colors"
                        >
                          🏆 Standings
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Upcoming & Recent Matches */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Upcoming Matches */}
              <div className="glass rounded-3xl p-4 sm:p-6 shadow-xl border border-white/20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                    <span className="text-xl">⏳</span>
                    Upcoming Matches
                  </h3>
                  <button
                    onClick={() => setActiveTab('fixtures')}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    View All →
                  </button>
                </div>
                
                {upcomingMatches.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm">No upcoming matches</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {upcomingMatches.map((match: any) => (
                      <div key={match.id} className="p-4 bg-white/50 rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                            R{match.round_number}
                          </span>
                          <span className="text-xs text-gray-500">Match {match.match_number}</span>
                          {match.tournament_name && (
                            <span className="text-xs text-gray-400">• {match.tournament_name}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-gray-900">{match.home_team_name}</span>
                          <span className="text-xs text-gray-400 mx-2">vs</span>
                          <span className="font-medium text-gray-900">{match.away_team_name}</span>
                        </div>
                        <Link 
                          href={`/dashboard/committee/team-management/fixture/${match.id}`}
                          className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium inline-block"
                        >
                          View Details →
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Results */}
              <div className="glass rounded-3xl p-4 sm:p-6 shadow-xl border border-white/20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                    <span className="text-xl">✅</span>
                    Recent Results
                  </h3>
                  <button
                    onClick={() => setActiveTab('fixtures')}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    View All →
                  </button>
                </div>
                
                {recentMatches.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-sm">No completed matches yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentMatches.map((match: any) => (
                      <div key={match.id} className="p-4 bg-white/50 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                            R{match.round_number}
                          </span>
                          <span className="text-xs text-gray-500">Match {match.match_number}</span>
                          {match.tournament_name && (
                            <span className="text-xs text-gray-400">• {match.tournament_name}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <div className={`flex-1 text-right ${match.result === 'home_win' ? 'font-bold text-green-600' : 'text-gray-600'}`}>
                            <span className="text-sm">{match.home_team_name}</span>
                            {match.home_score !== undefined && (
                              <span className="ml-2 text-lg">{match.home_score}</span>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 mx-3">-</span>
                          <div className={`flex-1 text-left ${match.result === 'away_win' ? 'font-bold text-green-600' : 'text-gray-600'}`}>
                            {match.away_score !== undefined && (
                              <span className="mr-2 text-lg">{match.away_score}</span>
                            )}
                            <span className="text-sm">{match.away_team_name}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'teams' && (
          <div className="space-y-6">
            <div className="glass rounded-3xl p-4 sm:p-6 shadow-xl border border-white/20">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
                👥 Manage Tournament Teams
              </h2>
              <p className="text-gray-600 text-sm mb-6">
                Select which teams will participate in this tournament. You must assign teams before generating fixtures.
              </p>
              
              {/* Tournament Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Tournament
                </label>
                <select
                  value={selectedTournamentForTeams}
                  onChange={(e) => setSelectedTournamentForTeams(e.target.value)}
                  className="w-full px-4 py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/70 transition-all"
                >
                  <option value="">-- Select a tournament --</option>
                  {tournaments.map((tournament) => (
                    <option key={tournament.id} value={tournament.id}>
                      {tournament.tournament_name} ({tournament.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Teams List */}
              {selectedTournamentForTeams && tournamentTeams.length > 0 && (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900">
                      Select Participating Teams ({selectedTeamsForTournament.length} selected)
                    </h3>
                    <button
                      onClick={() => {
                        if (selectedTeamsForTournament.length === tournamentTeams.length) {
                          setSelectedTeamsForTournament([]);
                        } else {
                          setSelectedTeamsForTournament(tournamentTeams.map(t => t.team_id));
                        }
                      }}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {selectedTeamsForTournament.length === tournamentTeams.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6 max-h-96 overflow-y-auto">
                    {tournamentTeams.map((team: any) => (
                      <label
                        key={team.team_id}
                        className="flex items-center p-3 bg-white/50 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTeamsForTournament.includes(team.team_id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTeamsForTournament([...selectedTeamsForTournament, team.team_id]);
                            } else {
                              setSelectedTeamsForTournament(selectedTeamsForTournament.filter(id => id !== team.team_id));
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-3"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-900">{team.team_name}</span>
                          {team.is_participating && (
                            <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Assigned</span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveTournamentTeams}
                      disabled={isSavingTeams}
                      className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:shadow-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                    >
                      {isSavingTeams ? (
                        <>
                          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Saving...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                          Save Team Assignments
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}

              {/* Empty State */}
              {selectedTournamentForTeams && tournamentTeams.length === 0 && (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-gray-500 font-medium">No teams registered for this season yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'fixtures' && (
          <div className="space-y-6">
            {/* Tournament Selector & Actions */}
            <div className="glass rounded-3xl p-4 sm:p-6 shadow-xl border border-white/20">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
                📅 Fixtures Management
              </h2>
              
              <div className="space-y-4">
                {/* Tournament Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Tournament
                  </label>
                  <select
                    value={selectedTournamentForFixtures}
                    onChange={(e) => setSelectedTournamentForFixtures(e.target.value)}
                    className="w-full px-4 py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/70 transition-all"
                  >
                    <option value="">-- Select a tournament --</option>
                    {tournaments.map((tournament) => (
                      <option key={tournament.id} value={tournament.id}>
                        {tournament.tournament_name} ({tournament.status})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Action Buttons */}
                {selectedTournamentForFixtures && (
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleGenerateTournamentFixtures}
                      disabled={isGeneratingFixtures}
                      className="px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:shadow-lg transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                    >
                      {isGeneratingFixtures ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Generating...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                          </svg>
                          Generate Fixtures
                        </>
                      )}
                    </button>
                    
                    {fixturesForSelectedTournament.length > 0 && (
                      <button
                        onClick={handleDeleteTournamentFixtures}
                        disabled={isDeletingFixtures}
                        className="px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:shadow-lg transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                      >
                        {isDeletingFixtures ? (
                          <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Deleting...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete All Fixtures
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Info Box */}
            {selectedTournamentForFixtures && fixturesForSelectedTournament.length === 0 && (
              <div className="glass rounded-3xl p-4 sm:p-6 shadow-xl border border-white/20 bg-blue-50/30">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-1">Ready to Generate Fixtures?</h3>
                    <p className="text-sm text-gray-600 mb-2">
                      Make sure you've assigned teams to this tournament in the <strong>Teams tab</strong> first.
                    </p>
                    <button
                      onClick={() => setActiveTab('teams')}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Go to Teams Tab
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Fixtures List */}
            {selectedTournamentForFixtures && fixturesForSelectedTournament.length > 0 && (
              <div className="glass rounded-3xl p-4 sm:p-6 shadow-xl border border-white/20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">
                    📋 Fixtures ({fixturesForSelectedTournament.length})
                  </h3>
                  
                  {/* Round Selector */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700">Round:</label>
                    <select
                      value={selectedRound}
                      onChange={(e) => setSelectedRound(parseInt(e.target.value))}
                      className="px-3 py-1.5 bg-white/60 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/70"
                    >
                      <option value={0}>All Rounds</option>
                      {Array.from({ length: maxRounds }, (_, i) => i + 1).map(round => (
                        <option key={round} value={round}>Round {round}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredFixtures.map((fixture: any) => (
                    <div key={fixture.id} className="p-4 bg-white/50 rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                            R{fixture.round_number}
                          </span>
                          <span className="text-xs text-gray-500">Match {fixture.match_number}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            fixture.status === 'completed' ? 'bg-green-100 text-green-700' :
                            fixture.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {fixture.status}
                          </span>
                        </div>
                        <Link
                          href={`/dashboard/committee/team-management/fixture/${fixture.id}`}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Manage →
                        </Link>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className={`flex-1 text-right ${fixture.result === 'home_win' ? 'font-bold text-green-600' : 'text-gray-900'}`}>
                          <span className="text-sm">{fixture.home_team_name}</span>
                          {fixture.home_score !== undefined && (
                            <span className="ml-2 text-lg font-bold">{fixture.home_score}</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 mx-3">vs</span>
                        <div className={`flex-1 text-left ${fixture.result === 'away_win' ? 'font-bold text-green-600' : 'text-gray-900'}`}>
                          {fixture.away_score !== undefined && (
                            <span className="mr-2 text-lg font-bold">{fixture.away_score}</span>
                          )}
                          <span className="text-sm">{fixture.away_team_name}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'standings' && (
          <div className="space-y-6">
            {/* Tournament Selector */}
            <div className="glass rounded-3xl p-4 sm:p-6 shadow-xl border border-white/20">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
                🏆 Tournament Standings
              </h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Tournament
                </label>
                <select
                  value={selectedTournamentForStandings}
                  onChange={(e) => setSelectedTournamentForStandings(e.target.value)}
                  className="w-full px-4 py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/70 transition-all"
                >
                  <option value="">-- Select a tournament --</option>
                  {tournaments.map((tournament) => (
                    <option key={tournament.id} value={tournament.id}>
                      {tournament.tournament_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Standings Table */}
            {selectedTournamentForStandings && (
              <div className="glass rounded-3xl p-4 sm:p-6 shadow-xl border border-white/20">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  📊 League Table
                </h3>
                
                {tournamentStandings.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p className="font-medium mb-2">No standings data available</p>
                    <p className="text-sm">Complete matches to generate standings</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b-2 border-gray-200">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Pos</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Team</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">MP</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">W</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">D</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">L</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">GF</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">GA</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">GD</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Pts</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {tournamentStandings.map((standing, index) => (
                          <tr key={standing.team_id} className="hover:bg-white/60 transition-colors">
                            <td className="px-4 py-3 text-sm font-bold text-gray-900">
                              {index + 1 === 1 && '🥇'}
                              {index + 1 === 2 && '🥈'}
                              {index + 1 === 3 && '🥉'}
                              {index + 1 > 3 && `${index + 1}`}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                              {standing.team_name}
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-gray-600">
                              {standing.matches_played || 0}
                            </td>
                            <td className="px-4 py-3 text-center text-sm font-semibold text-green-600">
                              {standing.wins || 0}
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-gray-600">
                              {standing.draws || 0}
                            </td>
                            <td className="px-4 py-3 text-center text-sm font-semibold text-red-600">
                              {standing.losses || 0}
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-gray-600">
                              {standing.goals_for || 0}
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-gray-600">
                              {standing.goals_against || 0}
                            </td>
                            <td className="px-4 py-3 text-center text-sm font-medium text-gray-900">
                              {(standing.goals_for || 0) - (standing.goals_against || 0)}
                            </td>
                            <td className="px-4 py-3 text-center text-sm font-bold text-blue-600">
                              {standing.points || 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'management' && (
          <div className="space-y-6">
            {/* Create Tournament Form */}
            <div className="glass rounded-3xl p-4 sm:p-6 shadow-xl border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                  ➕ Create New Tournament
                </h2>
                <button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all text-sm font-medium"
                >
                  {showCreateForm ? 'Hide Form' : 'Show Form'}
                </button>
              </div>

              {showCreateForm && (
                <form onSubmit={handleCreateTournament} className="space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tournament Type
                      </label>
                      <select
                        value={newTournament.tournament_type}
                        onChange={(e) => setNewTournament({ ...newTournament, tournament_type: e.target.value })}
                        className="w-full px-4 py-2.5 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/70 transition-all"
                        required
                      >
                        <option value="league">⚽ League</option>
                        <option value="cup">🏆 Cup</option>
                        <option value="ucl">🌟 Champions League</option>
                        <option value="uel">⭐ Europa League</option>
                        <option value="super_cup">🏅 Super Cup</option>
                        <option value="league_cup">🥤 League Cup</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Status
                      </label>
                      <select
                        value={newTournament.status}
                        onChange={(e) => setNewTournament({ ...newTournament, status: e.target.value })}
                        className="w-full px-4 py-2.5 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/70 transition-all"
                        required
                      >
                        <option value="upcoming">Upcoming</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tournament Name
                      </label>
                      <input
                        type="text"
                        value={newTournament.tournament_name}
                        onChange={(e) => setNewTournament({ ...newTournament, tournament_name: e.target.value })}
                        className="w-full px-4 py-2.5 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/70 transition-all"
                        placeholder="Auto-generated"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tournament Code
                      </label>
                      <input
                        type="text"
                        value={newTournament.tournament_code}
                        onChange={(e) => setNewTournament({ ...newTournament, tournament_code: e.target.value })}
                        className="w-full px-4 py-2.5 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/70 transition-all"
                        placeholder="Auto-generated"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={newTournament.start_date}
                        onChange={(e) => setNewTournament({ ...newTournament, start_date: e.target.value })}
                        className="w-full px-4 py-2.5 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/70 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={newTournament.end_date}
                        onChange={(e) => setNewTournament({ ...newTournament, end_date: e.target.value })}
                        className="w-full px-4 py-2.5 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/70 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={newTournament.description}
                      onChange={(e) => setNewTournament({ ...newTournament, description: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2.5 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/70 transition-all"
                      placeholder="Optional description..."
                    />
                  </div>

                  {/* Format Settings */}
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Tournament Format</h3>
                    
                    <div className="space-y-4">
                      <label className="flex items-start p-4 bg-white/50 rounded-xl border border-gray-200 cursor-pointer hover:border-blue-300 transition-all">
                        <input
                          type="checkbox"
                          checked={newTournament.has_knockout_stage}
                          onChange={(e) => setNewTournament({ ...newTournament, has_knockout_stage: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-1 mr-3"
                        />
                        <div className="flex-1">
                          <span className="font-medium text-gray-900">Include Knockout Stage</span>
                          <p className="text-xs text-gray-500 mt-1">Add playoffs after league stage</p>
                        </div>
                      </label>

                      <label className="flex items-start p-4 bg-white/50 rounded-xl border border-gray-200 cursor-pointer hover:border-blue-300 transition-all">
                        <input
                          type="checkbox"
                          checked={newTournament.has_group_stage}
                          onChange={(e) => setNewTournament({ ...newTournament, has_group_stage: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-1 mr-3"
                        />
                        <div className="flex-1">
                          <span className="font-medium text-gray-900">Include Group Stage</span>
                          <p className="text-xs text-gray-500 mt-1">Divide teams into groups</p>
                        </div>
                      </label>

                      <label className="flex items-start p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border-2 border-green-200 cursor-pointer hover:border-green-400 transition-all shadow-sm">
                        <input
                          type="checkbox"
                          checked={newTournament.include_in_fantasy}
                          onChange={(e) => setNewTournament({ ...newTournament, include_in_fantasy: e.target.checked })}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500 mt-1 mr-3"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">⚡ Include in Fantasy League</span>
                            <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full font-semibold">IMPORTANT</span>
                          </div>
                          <p className="text-sm text-gray-700 mt-2 font-medium">Player stats from this tournament will count towards fantasy league:</p>
                          <ul className="text-xs text-gray-600 mt-1 ml-4 list-disc space-y-1">
                            <li>Fantasy league points and rankings</li>
                            <li>Fantasy team scoring calculations</li>
                          </ul>
                        </div>
                      </label>

                      <label className="flex items-start p-4 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl border-2 border-amber-200 cursor-pointer hover:border-amber-400 transition-all shadow-sm">
                        <input
                          type="checkbox"
                          checked={newTournament.include_in_awards}
                          onChange={(e) => setNewTournament({ ...newTournament, include_in_awards: e.target.checked })}
                          className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 mt-1 mr-3"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">🏆 Include in Player Awards</span>
                            <span className="text-xs bg-amber-600 text-white px-2 py-0.5 rounded-full font-semibold">IMPORTANT</span>
                          </div>
                          <p className="text-sm text-gray-700 mt-2 font-medium">Player stats from this tournament will count towards end-of-season awards:</p>
                          <ul className="text-xs text-gray-600 mt-1 ml-4 list-disc space-y-1">
                            <li>Golden Boot (Top Goal Scorer)</li>
                            <li>Golden Glove (Most Clean Sheets)</li>
                            <li>Golden Ball (Most POTM Awards)</li>
                            <li>Category-specific awards (Legend/Classic)</li>
                          </ul>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isCreatingTournament}
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                    >
                      {isCreatingTournament ? (
                        <>
                          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Creating...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                          </svg>
                          Create Tournament
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Existing Tournaments */}
            <div className="glass rounded-3xl p-4 sm:p-6 shadow-xl border border-white/20">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                📋 Existing Tournaments ({tournaments.length})
              </h2>

              {tournaments.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="font-medium mb-2">No tournaments found</p>
                  <p className="text-sm">Create a tournament above to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tournaments.map((tournament) => (
                    <div key={tournament.id} className="p-5 bg-white/50 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-bold text-gray-900">{tournament.tournament_name}</h3>
                            {tournament.is_primary && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                Primary
                              </span>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              tournament.status === 'active' ? 'bg-green-100 text-green-700' :
                              tournament.status === 'upcoming' ? 'bg-yellow-100 text-yellow-700' :
                              tournament.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {tournament.status}
                            </span>
                          </div>
                          
                          <p className="text-sm text-gray-600 mb-2">
                            <span className="font-medium">Code:</span> {tournament.tournament_code} •{' '}
                            <span className="font-medium">Type:</span> {tournament.tournament_type}
                          </p>

                          {tournament.description && (
                            <p className="text-xs text-gray-500 mb-2">{tournament.description}</p>
                          )}

                          <div className="flex flex-wrap gap-2 text-xs">
                            {tournament.has_knockout_stage && (
                              <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded-md font-medium">
                                🥊 Knockout
                              </span>
                            )}
                            {tournament.has_group_stage && (
                              <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md font-medium">
                                👥 Groups: {tournament.number_of_groups}
                              </span>
                            )}
                            {tournament.include_in_fantasy && (
                              <span className="bg-green-50 text-green-700 px-2 py-1 rounded-md font-medium">
                                ⚡ Fantasy
                              </span>
                            )}
                            {tournament.include_in_awards && (
                              <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded-md font-medium">
                                🏆 Awards
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2 ml-4 flex-wrap">
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/tournaments/${tournament.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    include_in_fantasy: !tournament.include_in_fantasy
                                  })
                                });
                                const data = await res.json();
                                if (data.success) {
                                  await loadTournaments(activeSeasonId!);
                                  showAlert({
                                    type: 'success',
                                    title: 'Updated',
                                    message: `Fantasy league ${tournament.include_in_fantasy ? 'disabled' : 'enabled'} for this tournament`
                                  });
                                }
                              } catch (error) {
                                showAlert({
                                  type: 'error',
                                  title: 'Error',
                                  message: 'Failed to update tournament'
                                });
                              }
                            }}
                            className={`px-3 py-2 rounded-lg transition-colors text-xs font-medium ${
                              tournament.include_in_fantasy
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-gray-300 text-gray-600 hover:bg-gray-400'
                            }`}
                            title={tournament.include_in_fantasy ? 'Fantasy Enabled - Click to disable' : 'Fantasy Disabled - Click to enable'}
                          >
                            {tournament.include_in_fantasy ? '⚡ Fantasy' : '⚡ Off'}
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/tournaments/${tournament.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    include_in_awards: !tournament.include_in_awards
                                  })
                                });
                                const data = await res.json();
                                if (data.success) {
                                  await loadTournaments(activeSeasonId!);
                                  showAlert({
                                    type: 'success',
                                    title: 'Updated',
                                    message: `Awards ${tournament.include_in_awards ? 'disabled' : 'enabled'} for this tournament`
                                  });
                                }
                              } catch (error) {
                                showAlert({
                                  type: 'error',
                                  title: 'Error',
                                  message: 'Failed to update tournament'
                                });
                              }
                            }}
                            className={`px-3 py-2 rounded-lg transition-colors text-xs font-medium ${
                              tournament.include_in_awards
                                ? 'bg-amber-600 text-white hover:bg-amber-700'
                                : 'bg-gray-300 text-gray-600 hover:bg-gray-400'
                            }`}
                            title={tournament.include_in_awards ? 'Awards Enabled - Click to disable' : 'Awards Disabled - Click to enable'}
                          >
                            {tournament.include_in_awards ? '🏆 Awards' : '🏆 Off'}
                          </button>
                          <button
                            onClick={() => handleDeleteTournament(tournament.id, tournament.tournament_name)}
                            className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
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
