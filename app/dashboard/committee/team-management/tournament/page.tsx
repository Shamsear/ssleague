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

type TabType = 'overview' | 'fixtures' | 'standings' | 'settings' | 'management';

export default function TournamentDashboardPage() {
  const { user, loading } = useAuth();
  const { userSeasonId } = usePermissions();
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
  const [selectedTournamentForFixtures, setSelectedTournamentForFixtures] = useState<string>('');
  const [tournamentFixtures, setTournamentFixtures] = useState<any[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [allTeams, setAllTeams] = useState<any[]>([]);
  
  // Standings State
  const [selectedTournamentForStandings, setSelectedTournamentForStandings] = useState<string>('');
  const [standingsTab, setStandingsTab] = useState<'table' | 'bracket'>('table');
  const [tournamentStandings, setTournamentStandings] = useState<any[]>([]);
  const [knockoutBracket, setKnockoutBracket] = useState<any>(null);
  
  // Tournament Management State
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [isCreatingTournament, setIsCreatingTournament] = useState(false);
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
    // Tournament Settings
    squad_size: 11,
    tournament_system: 'match_round',
    home_deadline_time: '17:00',
    away_deadline_time: '17:00',
    result_day_offset: 2,
    result_deadline_time: '00:30',
    // Group Stage Settings
    has_group_stage: false,
    number_of_groups: 4,
    teams_per_group: 4,
    teams_advancing_per_group: 2,
    // Knockout Stage Settings
    has_knockout_stage: false,
    playoff_teams: 4,
    direct_semifinal_teams: 2,
    qualification_threshold: 75,
    is_pure_knockout: false  // Distinguishes knockout-only from league+knockout
  });

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
  
  // Auto-generate tournament name and code when type changes
  useEffect(() => {
    if (!activeSeasonId || !newTournament.tournament_type) return;
    
    // Extract season number from season ID (e.g., "SSPSLS16" -> "S16")
    const seasonMatch = activeSeasonId.match(/S(\d+)/);
    const seasonNumber = seasonMatch ? `S${seasonMatch[1]}` : activeSeasonId;
    
    // Map tournament types to codes and full names
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
    
    // Generate tournament code: SSPSL + season number + type code
    const generatedCode = `SSPSL${seasonNumber}${typeInfo.code}`;
    
    // Generate tournament name: SS Super League S16 League/Cup/etc
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
          
          // Fetch teams for season to get participants count
          const teamsRes = await fetch(`/api/team/all?season_id=${seasonId}`);
          const teamsData = await teamsRes.json();
          
          if (teamsData.success && teamsData.data && teamsData.data.teams) {
            setParticipantsCount(teamsData.data.teams.length);
          }
          
          // Load existing tournament settings
          try {
            const settings = await getTournamentSettings(seasonId);
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
          await loadFixtures(seasonId);
          
          // Load tournaments
          await loadTournaments(seasonId);
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
          description: '',
          is_primary: false,
          display_order: 1,
          include_in_fantasy: true,
          // Tournament Settings
          squad_size: 11,
          tournament_system: 'match_round',
          home_deadline_time: '17:00',
          away_deadline_time: '17:00',
          result_day_offset: 2,
          result_deadline_time: '00:30',
          // Group Stage Settings
          has_group_stage: false,
          number_of_groups: 4,
          teams_per_group: 4,
          teams_advancing_per_group: 2,
          // Knockout Stage Settings
          has_knockout_stage: false,
          playoff_teams: 4,
          direct_semifinal_teams: 2,
          qualification_threshold: 75,
          is_pure_knockout: false
        });
        
        // Reload tournaments
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
  
  const handleUpdateTournament = async (tournamentId: string, updates: any) => {
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      const data = await res.json();
      
      if (data.success) {
        showAlert({
          type: 'success',
          title: 'Tournament Updated',
          message: 'Tournament updated successfully!'
        });
        
        setEditingTournament(null);
        await loadTournaments(activeSeasonId!);
      } else {
        showAlert({
          type: 'error',
          title: 'Update Failed',
          message: data.error || 'Failed to update tournament'
        });
      }
    } catch (error: any) {
      console.error('Error updating tournament:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to update tournament: ' + error.message
      });
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
  
  const handleGenerateFixtures = async () => {
    if (!activeSeasonId) {
      showAlert({
        type: 'error',
        title: 'No Season',
        message: 'No season available. Please refresh the page.'
      });
      return;
    }
    
    if (participantsCount < 2) {
      showAlert({
        type: 'warning',
        title: 'Insufficient Teams',
        message: 'At least 2 teams are required to generate fixtures'
      });
      return;
    }
    
    const isRegenerate = fixtureRounds.length > 0;
    const confirmMessage = isRegenerate
      ? `Regenerate fixtures for ${participantsCount} teams? This will DELETE all existing fixtures, matchups, and round deadlines, then create new ones.`
      : `Generate fixtures for ${participantsCount} teams? This will create ${participantsCount - 1} rounds with ${Math.floor(participantsCount / 2)} matches per round for both legs (total ${2 * (participantsCount - 1)} rounds).`;
    
    const confirmed = await showConfirm({
      type: isRegenerate ? 'danger' : 'info',
      title: isRegenerate ? 'Regenerate Fixtures' : 'Generate Fixtures',
      message: confirmMessage,
      confirmText: isRegenerate ? 'Regenerate' : 'Generate',
      cancelText: 'Cancel'
    });
    
    if (!confirmed) return;
    
    setIsGeneratingFixtures(true);
    
    try {
      // If regenerating, delete existing fixtures first
      if (isRegenerate) {
        console.log('Deleting existing fixtures before regenerating...');
        const deleteSuccess = await deleteSeasonFixtures(activeSeasonId);
        if (!deleteSuccess) {
          throw new Error('Failed to delete existing fixtures');
        }
        console.log('Existing fixtures deleted successfully');
      }
      
      // Fetch teams for season (with automatic token refresh)
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
        showAlert({
          type: 'success',
          title: 'Fixtures Generated',
          message: `Successfully generated ${result.fixtures?.length} fixtures!`
        });
        await loadFixtures(activeSeasonId);
      } else {
        showAlert({
          type: 'error',
          title: 'Generation Failed',
          message: result.error || 'Failed to generate fixtures'
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
  
  const handleDeleteFixtures = async () => {
    if (!activeSeasonId) return;
    
    const confirmed = await showConfirm({
      type: 'danger',
      title: 'Delete All Fixtures',
      message: 'Are you sure you want to delete ALL fixtures for this season? This action cannot be undone.',
      confirmText: 'Delete All',
      cancelText: 'Cancel'
    });
    
    if (!confirmed) return;
    
    setIsDeletingFixtures(true);
    
    try {
      const success = await deleteSeasonFixtures(activeSeasonId);
      
      if (success) {
        showAlert({
          type: 'success',
          title: 'Deleted',
          message: 'All fixtures deleted successfully'
        });
        setFixtureRounds([]);
      } else {
        showAlert({
          type: 'error',
          title: 'Delete Failed',
          message: 'Failed to delete fixtures'
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
  
  // Tournament Fixtures Handlers
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
  
  // Load teams when season changes
  useEffect(() => {
    const loadTeams = async () => {
      if (!activeSeasonId) return;
      
      try {
        const res = await fetch(`/api/team/all?season_id=${activeSeasonId}`);
        const data = await res.json();
        if (data.success && data.data?.teams) {
          setAllTeams(data.data.teams);
        }
      } catch (error) {
        console.error('Error loading teams:', error);
      }
    };
    
    loadTeams();
  }, [activeSeasonId]);
  
  // Load tournament fixtures when tournament is selected
  useEffect(() => {
    if (selectedTournamentForFixtures) {
      loadTournamentFixtures(selectedTournamentForFixtures);
      setSelectedTeams([]); // Reset team selection
    } else {
      setTournamentFixtures([]);
      setSelectedTeams([]);
    }
  }, [selectedTournamentForFixtures]);
  
  // Load tournament settings when editing
  const loadTournamentSettings = async (tournamentId: string) => {
    try {
      const res = await fetch(`/api/tournament-settings?tournament_id=${tournamentId}`);
      const data = await res.json();
      
      if (data.settings) {
        // Merge tournament data with settings
        const tournament = tournaments.find(t => t.id === tournamentId);
        if (tournament) {
          // Format start_date for date input (YYYY-MM-DD)
          const formattedTournament = {
            ...tournament,
            ...data.settings,
            start_date: tournament.start_date ? new Date(tournament.start_date).toISOString().split('T')[0] : '',
          };
          setEditingTournament(formattedTournament);
        }
      }
    } catch (error) {
      console.error('Error loading tournament settings:', error);
    }
  };
  
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!activeSeasonId) {
      showAlert({
        type: 'error',
        title: 'No Season',
        message: 'No season available. Please refresh the page.'
      });
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
      
      showAlert({
        type: 'success',
        title: 'Settings Saved',
        message: 'Tournament settings saved successfully!'
      });
      setSettingsLoaded(true);
    } catch (error) {
      console.error('Error saving settings:', error);
      showAlert({
        type: 'error',
        title: 'Save Failed',
        message: 'Failed to save tournament settings. Please try again.'
      });
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

  // Calculate stats from tournament fixtures (Neon only)
  const totalMatches = tournamentFixtures.length;
  const completedMatches = tournamentFixtures.filter(f => f.status === 'completed').length;
  const pendingMatches = totalMatches - completedMatches;
  
  // All matches are from tournament fixtures
  const allMatches = tournamentFixtures;
  
  const upcomingMatches = allMatches
    .filter(m => m.status !== 'completed')
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
            <button
              onClick={() => setActiveTab('management')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'management'
                  ? 'border-[#0066FF] text-[#0066FF]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Tournament Management
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Tournaments Overview */}
          <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-6 border border-gray-100/20">
            <h2 className="text-xl font-bold text-gray-900 flex items-center mb-4">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              Active Tournaments
            </h2>
            
            {tournaments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                <p className="mb-2">No tournaments created yet</p>
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
                  <div key={tournament.id} className="glass rounded-xl p-4 border border-gray-200/50 hover:border-[#0066FF]/30 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">{tournament.tournament_name}</h3>
                        <p className="text-xs text-gray-500">{tournament.tournament_code}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                        tournament.status === 'active' ? 'bg-green-100 text-green-700' :
                        tournament.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {tournament.status}
                      </span>
                    </div>
                    
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center text-xs text-gray-600">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                        className="flex-1 px-3 py-1.5 bg-blue-100 text-blue-700 text-xs rounded-lg hover:bg-blue-200 transition-colors"
                      >
                        Fixtures
                      </button>
                      <button
                        onClick={() => {
                          setSelectedTournamentForStandings(tournament.id);
                          setActiveTab('standings');
                        }}
                        className="flex-1 px-3 py-1.5 bg-purple-100 text-purple-700 text-xs rounded-lg hover:bg-purple-200 transition-colors"
                      >
                        Standings
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
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
                      <Link 
                        href={`/dashboard/committee/team-management/fixture/${match.id}`}
                        className="ml-4 px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 transition-colors inline-block text-center"
                      >
                        🔍 View Details
                      </Link>
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
          {/* Tournament Selection */}
          <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-xl p-6 border border-gray-100/20">
            <h3 className="font-semibold text-gray-800 mb-4">Select Tournament</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tournament</label>
                <select
                  value={selectedTournamentForFixtures}
                  onChange={(e) => setSelectedTournamentForFixtures(e.target.value)}
                  className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                >
                  <option value="">-- Select a Tournament --</option>
                  {tournaments.map((tournament) => (
                    <option key={tournament.id} value={tournament.id}>
                      {tournament.tournament_name} ({tournament.status})
                    </option>
                  ))}
                </select>
              </div>
              {selectedTournamentForFixtures && (
                <div className="flex items-end gap-2">
                  {tournamentFixtures.length > 0 && (
                    <button
                      onClick={handleDeleteTournamentFixtures}
                      disabled={isDeletingFixtures}
                      className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDeletingFixtures ? 'Deleting...' : 'Delete Fixtures'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Team Selection & Generate */}
          {selectedTournamentForFixtures && tournamentFixtures.length === 0 && (
            <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-xl p-6 border border-gray-100/20">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-800">Select Teams</h3>
                  <p className="text-sm text-gray-600 mt-1">Choose which teams will participate in this tournament</p>
                </div>
                <button
                  onClick={() => {
                    if (selectedTeams.length === allTeams.length) {
                      setSelectedTeams([]);
                    } else {
                      setSelectedTeams(allTeams.map((t: any) => t.team.id));
                    }
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  {selectedTeams.length === allTeams.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                {allTeams.map((teamData: any) => (
                  <label key={teamData.team.id} className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTeams.includes(teamData.team.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTeams([...selectedTeams, teamData.team.id]);
                        } else {
                          setSelectedTeams(selectedTeams.filter(id => id !== teamData.team.id));
                        }
                      }}
                      className="rounded border-gray-300 text-[#0066FF] focus:ring-[#0066FF] mr-3"
                    />
                    <span className="text-sm font-medium text-gray-900">{teamData.team.name}</span>
                  </label>
                ))}
              </div>
              
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">
                  {selectedTeams.length} team{selectedTeams.length !== 1 ? 's' : ''} selected
                </p>
                <button
                  onClick={handleGenerateTournamentFixtures}
                  disabled={isGeneratingFixtures || selectedTeams.length < 2}
                  className="px-6 py-3 bg-[#0066FF] text-white rounded-xl hover:bg-[#0052CC] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
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
                      Generate Fixtures
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
          
          {/* Generated Fixtures Display */}
          {selectedTournamentForFixtures && tournamentFixtures.length > 0 && (
            <div className="space-y-6">
              {/* Group fixtures by round */}
              {Array.from(new Set(tournamentFixtures.map(f => f.round_number))).sort((a, b) => a - b).map(roundNum => {
                const roundFixtures = tournamentFixtures.filter(f => f.round_number === roundNum);
                const firstFixture = roundFixtures[0];
                
                return (
                  <div key={roundNum} className="bg-white/90 backdrop-blur-md shadow-xl rounded-2xl overflow-hidden border border-gray-100/20">
                    <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 px-6 py-4 border-b border-gray-100">
                      <div className="flex justify-between items-center">
                        <div>
                          <h2 className="text-xl font-bold text-gray-800">Round {roundNum}</h2>
                          <p className="text-sm text-gray-600">
                            {roundFixtures.length} matches ({firstFixture.leg === 'first' ? 'First Leg' : 'Second Leg'})
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {roundFixtures.map((match) => (
                          <div key={match.id} className="bg-white/90 backdrop-blur-md shadow-md rounded-xl overflow-hidden border border-gray-100 hover:shadow-lg transition-all duration-200">
                            <div className="p-4">
                              <div className="flex justify-between items-center mb-3">
                                <div className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                  Match {match.match_number}
                                </div>
                                <div className="text-xs font-medium rounded-full px-2 py-1 bg-blue-100 text-blue-700">
                                  {match.status || 'Scheduled'}
                                </div>
                              </div>
                              
                              <div className="flex items-center justify-between py-2">
                                <div className="flex flex-col items-start flex-1">
                                  <span className="font-medium text-sm text-gray-900">
                                    {match.home_team_name}
                                  </span>
                                </div>
                                <div className="text-sm text-gray-400 mx-2">vs</div>
                                <div className="flex flex-col items-end flex-1">
                                  <span className="font-medium text-sm text-gray-900">
                                    {match.away_team_name}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state when no tournament selected */}
          {!selectedTournamentForFixtures && (
            <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-12 text-center border border-gray-100/20">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-600 mb-2">Select a Tournament</h3>
              <p className="text-sm text-gray-500">Choose a tournament from the dropdown above to view and manage its fixtures</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'standings' && (
        <div className="space-y-6">
          {/* Tournament Selection */}
          <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-xl p-6 border border-gray-100/20">
            <h3 className="font-semibold text-gray-800 mb-4">Select Tournament</h3>
            <select
              value={selectedTournamentForStandings}
              onChange={(e) => setSelectedTournamentForStandings(e.target.value)}
              className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
            >
              <option value="">-- Select a Tournament --</option>
              {tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.tournament_name} ({tournament.status})
                </option>
              ))}
            </select>
          </div>
          
          {/* Standings Content */}
          {selectedTournamentForStandings ? (
            <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl overflow-hidden border border-gray-100/20">
              {/* Determine tournament format */}
              {(() => {
                const tournament = tournaments.find(t => t.id === selectedTournamentForStandings);
                if (!tournament) return null;
                
                const hasKnockout = tournament.has_knockout_stage || tournament.is_pure_knockout;
                const hasLeague = !tournament.is_pure_knockout;
                
                return (
                  <>
                    {/* Tab Header */}
                    {hasKnockout && hasLeague && (
                      <div className="border-b border-gray-200">
                        <nav className="flex">
                          <button
                            onClick={() => setStandingsTab('table')}
                            className={`flex-1 py-4 px-6 text-sm font-medium transition-colors ${
                              standingsTab === 'table'
                                ? 'border-b-2 border-[#0066FF] text-[#0066FF] bg-blue-50/50'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-center">
                              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              League Table
                            </div>
                          </button>
                          <button
                            onClick={() => setStandingsTab('bracket')}
                            className={`flex-1 py-4 px-6 text-sm font-medium transition-colors ${
                              standingsTab === 'bracket'
                                ? 'border-b-2 border-[#0066FF] text-[#0066FF] bg-blue-50/50'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-center">
                              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                              Knockout Bracket
                            </div>
                          </button>
                        </nav>
                      </div>
                    )}
                    
                    {/* Table View */}
                    {(standingsTab === 'table' || !hasKnockout) && hasLeague && (
                      <div className="p-6">
                        <div className="mb-4">
                          <h3 className="text-lg font-bold text-gray-900">League Standings</h3>
                          <p className="text-sm text-gray-500 mt-1">Points based on match results</p>
                        </div>
                        
                        {tournamentStandings.length === 0 ? (
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
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
                                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">MP</th>
                                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">W</th>
                                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">D</th>
                                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">L</th>
                                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">GF</th>
                                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">GA</th>
                                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">GD</th>
                                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Points</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white/60 divide-y divide-gray-200/50">
                                {tournamentStandings.map((standing, index) => (
                                  <tr key={standing.team_id} className={`hover:bg-gray-50/80 transition-colors ${
                                    index < 4 && hasKnockout ? 'bg-green-50/30' : ''
                                  }`}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                      {index + 1 === 1 && '🥇'}
                                      {index + 1 === 2 && '🥈'}
                                      {index + 1 === 3 && '🥉'}
                                      {index + 1 > 3 && `#${index + 1}`}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                      {standing.team_name}
                                      {index < 4 && hasKnockout && (
                                        <span className="ml-2 text-xs text-green-600 font-semibold">Q</span>
                                      )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                                      {standing.matches_played || 0}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-green-600">
                                      {standing.wins || 0}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                                      {standing.draws || 0}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-red-600">
                                      {standing.losses || 0}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                                      {standing.goals_for || 0}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                                      {standing.goals_against || 0}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">
                                      {(standing.goals_for || 0) - (standing.goals_against || 0)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-gray-900">
                                      {standing.points || 0}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            
                            {hasKnockout && tournamentStandings.length > 0 && (
                              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                                <p className="text-xs text-green-800">
                                  <span className="font-semibold">Q</span> = Qualified for knockout stage
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Bracket View */}
                    {standingsTab === 'bracket' && hasKnockout && (
                      <div className="p-6">
                        <div className="mb-6">
                          <h3 className="text-lg font-bold text-gray-900">Knockout Bracket</h3>
                          <p className="text-sm text-gray-500 mt-1">Single elimination tournament bracket</p>
                        </div>
                        
                        {!knockoutBracket ? (
                          <div className="text-center py-12 text-gray-500">
                            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <h3 className="text-lg font-medium text-gray-600 mb-2">Bracket Not Generated</h3>
                            <p className="text-sm">Complete league stage to generate knockout bracket</p>
                            <p className="text-xs text-gray-400 mt-2">Top teams will automatically qualify</p>
                          </div>
                        ) : (
                          <div className="space-y-8">
                            {/* Finals */}
                            {knockoutBracket.final && (
                              <div>
                                <h4 className="text-md font-semibold text-gray-800 mb-3">🏆 Final</h4>
                                <div className="flex justify-center">
                                  <div className="w-full max-w-md space-y-2">
                                    <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                                      <span className="font-medium">{knockoutBracket.final.team1}</span>
                                      <span className="text-lg font-bold text-gray-400">vs</span>
                                      <span className="font-medium">{knockoutBracket.final.team2}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* Semifinals */}
                            {knockoutBracket.semifinals && knockoutBracket.semifinals.length > 0 && (
                              <div>
                                <h4 className="text-md font-semibold text-gray-800 mb-3">🥈 Semifinals</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {knockoutBracket.semifinals.map((match: any, index: number) => (
                                    <div key={index} className="space-y-2">
                                      <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                                        <span className="font-medium">{match.team1}</span>
                                        <span className="text-sm text-gray-400">vs</span>
                                        <span className="font-medium">{match.team2}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Quarterfinals */}
                            {knockoutBracket.quarterfinals && knockoutBracket.quarterfinals.length > 0 && (
                              <div>
                                <h4 className="text-md font-semibold text-gray-800 mb-3">⚽ Quarterfinals</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                  {knockoutBracket.quarterfinals.map((match: any, index: number) => (
                                    <div key={index} className="space-y-2">
                                      <div className="flex flex-col p-3 bg-white border border-gray-200 rounded-lg">
                                        <span className="font-medium text-sm">{match.team1}</span>
                                        <span className="text-xs text-gray-400 text-center my-1">vs</span>
                                        <span className="font-medium text-sm">{match.team2}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Pure Knockout */}
                    {tournament.is_pure_knockout && (
                      <div className="p-6">
                        <div className="mb-6">
                          <h3 className="text-lg font-bold text-gray-900">Knockout Bracket</h3>
                          <p className="text-sm text-gray-500 mt-1">Pure elimination tournament</p>
                        </div>
                        
                        <div className="text-center py-12 text-gray-500">
                          <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          <h3 className="text-lg font-medium text-gray-600 mb-2">Bracket Coming Soon</h3>
                          <p className="text-sm">Knockout bracket will be generated based on fixtures</p>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-12 text-center border border-gray-100/20">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-600 mb-2">Select a Tournament</h3>
              <p className="text-sm text-gray-500">Choose a tournament to view standings and bracket</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'management' && (
        <div className="space-y-6">
          {/* Create New Tournament Section */}
          <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-6 border border-gray-100/20">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create New Tournament
            </h2>
            
            <form onSubmit={handleCreateTournament} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tournament Type *</label>
                  <select
                    value={newTournament.tournament_type}
                    onChange={(e) => setNewTournament({ ...newTournament, tournament_type: e.target.value })}
                    className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                    required
                  >
                    <option value="league">🏆 League</option>
                    <option value="cup">🏅 Cup</option>
                    <option value="ucl">⭐ Champions League</option>
                    <option value="uel">🌟 Europa League</option>
                    <option value="super_cup">👑 Super Cup</option>
                    <option value="league_cup">🥇 League Cup</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tournament Name *
                    <span className="ml-2 text-xs text-green-600">(Auto-generated)</span>
                  </label>
                  <input
                    type="text"
                    value={newTournament.tournament_name}
                    readOnly
                    placeholder="Select tournament type to generate"
                    className="w-full py-2 px-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 cursor-not-allowed"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tournament Code
                    <span className="ml-2 text-xs text-green-600">(Auto-generated)</span>
                  </label>
                  <input
                    type="text"
                    value={newTournament.tournament_code}
                    readOnly
                    placeholder="Select tournament type to generate"
                    className="w-full py-2 px-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 cursor-not-allowed"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={newTournament.status}
                    onChange={(e) => setNewTournament({ ...newTournament, status: e.target.value })}
                    className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={newTournament.start_date}
                    onChange={(e) => setNewTournament({ ...newTournament, start_date: e.target.value })}
                    className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Display Order</label>
                  <input
                    type="number"
                    min="1"
                    value={newTournament.display_order}
                    onChange={(e) => setNewTournament({ ...newTournament, display_order: parseInt(e.target.value) })}
                    className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                  />
                </div>
                
                <div className="flex items-center">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newTournament.is_primary}
                      onChange={(e) => setNewTournament({ ...newTournament, is_primary: e.target.checked })}
                      className="rounded border-gray-300 text-[#0066FF] focus:ring-[#0066FF]"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700">Set as Primary Tournament</span>
                  </label>
                </div>
                
                <div className="flex items-center">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newTournament.include_in_fantasy}
                      onChange={(e) => setNewTournament({ ...newTournament, include_in_fantasy: e.target.checked })}
                      className="rounded border-gray-300 text-[#0066FF] focus:ring-[#0066FF]"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700">Include in Fantasy League</span>
                  </label>
                  <div className="ml-2 group relative">
                    <svg className="w-4 h-4 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="hidden group-hover:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-10">
                      Check this to include player stats and points from this tournament in fantasy league calculations. Uncheck for standalone tournaments (e.g., mid-season cups).
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={newTournament.description}
                  onChange={(e) => setNewTournament({ ...newTournament, description: e.target.value })}
                  placeholder="Tournament description (optional)"
                  rows={3}
                  className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                />
              </div>
              
              {/* Tournament Format Section */}
              <div className="border-t border-gray-200 pt-6 mt-6">
                  <h4 className="text-md font-semibold text-gray-800 mb-4">Tournament Format</h4>
                  
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Format</label>
                    <select
                      value={
                        newTournament.has_group_stage && newTournament.has_knockout_stage ? 'group_knockout' :
                        newTournament.is_pure_knockout ? 'knockout_only' :
                        !newTournament.has_group_stage && newTournament.has_knockout_stage ? 'league_knockout' :
                        'league_only'
                      }
                      onChange={(e) => {
                        const format = e.target.value;
                        if (format === 'league_only') {
                          setNewTournament({ ...newTournament, has_group_stage: false, has_knockout_stage: false, is_pure_knockout: false });
                        } else if (format === 'league_knockout') {
                          setNewTournament({ ...newTournament, has_group_stage: false, has_knockout_stage: true, is_pure_knockout: false });
                        } else if (format === 'group_knockout') {
                          setNewTournament({ ...newTournament, has_group_stage: true, has_knockout_stage: true, is_pure_knockout: false });
                        } else if (format === 'knockout_only') {
                          setNewTournament({ ...newTournament, has_group_stage: false, has_knockout_stage: true, is_pure_knockout: true });
                        }
                      }}
                      className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                    >
                      <option value="league_only">🏆 League Only - Traditional round-robin league</option>
                      <option value="league_knockout">⚔️ League + Knockout - League followed by playoffs</option>
                      <option value="group_knockout">🌍 Group Stage + Knockout - Groups then playoffs</option>
                      <option value="knockout_only">🥊 Knockout Only - Pure elimination bracket</option>
                    </select>
                  </div>
              </div>
              
              {/* Tournament Settings Section */}
              <div className="border-t border-gray-200 pt-6 mt-6">
                <h4 className="text-md font-semibold text-gray-800 mb-4">Tournament Settings</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Squad Size *</label>
                    <input
                      type="number"
                      min="1"
                      value={newTournament.squad_size}
                      onChange={(e) => setNewTournament({ ...newTournament, squad_size: parseInt(e.target.value) })}
                      className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Number of players per team</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tournament System *</label>
                    <select
                      value={newTournament.tournament_system}
                      onChange={(e) => setNewTournament({ ...newTournament, tournament_system: e.target.value })}
                      className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                      required
                    >
                      <option value="match_round">Match Round</option>
                      <option value="match_day">Match Day</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Fixture organization system</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Result Day Offset *</label>
                    <input
                      type="number"
                      min="0"
                      value={newTournament.result_day_offset}
                      onChange={(e) => setNewTournament({ ...newTournament, result_day_offset: parseInt(e.target.value) })}
                      className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Days after match for result submission</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Home Team Deadline *</label>
                    <input
                      type="time"
                      value={newTournament.home_deadline_time}
                      onChange={(e) => setNewTournament({ ...newTournament, home_deadline_time: e.target.value })}
                      className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Squad submission deadline</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Away Team Deadline *</label>
                    <input
                      type="time"
                      value={newTournament.away_deadline_time}
                      onChange={(e) => setNewTournament({ ...newTournament, away_deadline_time: e.target.value })}
                      className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Squad submission deadline</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Result Deadline *</label>
                    <input
                      type="time"
                      value={newTournament.result_deadline_time}
                      onChange={(e) => setNewTournament({ ...newTournament, result_deadline_time: e.target.value })}
                      className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Result submission deadline</p>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isCreatingTournament}
                  className="px-6 py-3 bg-[#0066FF] text-white rounded-xl hover:bg-[#0052CC] transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isCreatingTournament ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Create Tournament
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
          
          {/* Existing Tournaments List */}
          <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-6 border border-gray-100/20">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Existing Tournaments ({tournaments.length})
            </h2>
            
            {tournaments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p>No tournaments found. Create one above to get started!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tournaments.map((tournament) => (
                  <div key={tournament.id} className="glass rounded-xl p-4 border border-gray-200/50 hover:border-[#0066FF]/30 transition-colors">
                    {editingTournament?.id === tournament.id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Tournament Name</label>
                            <input
                              type="text"
                              value={editingTournament.tournament_name}
                              onChange={(e) => setEditingTournament({ ...editingTournament, tournament_name: e.target.value })}
                              className="w-full py-1.5 px-3 bg-white/60 border border-gray-200 rounded-lg text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                            <select
                              value={editingTournament.status}
                              onChange={(e) => setEditingTournament({ ...editingTournament, status: e.target.value })}
                              className="w-full py-1.5 px-3 bg-white/60 border border-gray-200 rounded-lg text-sm"
                            >
                              <option value="upcoming">Upcoming</option>
                              <option value="active">Active</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingTournament(null)}
                            className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleUpdateTournament(tournament.id, {
                              tournament_name: editingTournament.tournament_name,
                              status: editingTournament.status
                            })}
                            className="px-3 py-1.5 text-sm bg-[#0066FF] text-white rounded-lg hover:bg-[#0052CC]"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold text-gray-900">{tournament.tournament_name}</h3>
                            {tournament.is_primary && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Primary</span>
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
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">ID:</span> {tournament.id}
                            {tournament.tournament_code && <span className="ml-3"><span className="font-medium">Code:</span> {tournament.tournament_code}</span>}
                            <span className="ml-3"><span className="font-medium">Type:</span> {tournament.tournament_type}</span>
                          </p>
                          {tournament.description && (
                            <p className="text-xs text-gray-500 mt-1">{tournament.description}</p>
                          )}
                          {(tournament.start_date || tournament.end_date) && (
                            <p className="text-xs text-gray-500 mt-1">
                              {tournament.start_date && <span>Start: {new Date(tournament.start_date).toLocaleDateString()}</span>}
                              {tournament.start_date && tournament.end_date && <span className="mx-2">•</span>}
                              {tournament.end_date && <span>End: {new Date(tournament.end_date).toLocaleDateString()}</span>}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingTournament(tournament)}
                            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteTournament(tournament.id, tournament.tournament_name)}
                            className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Tournament Selector */}
          <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-6 border border-gray-100/20">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Tournament Settings
            </h2>
            <p className="text-sm text-gray-600 mb-4">Select a tournament to view and edit its settings</p>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Tournament</label>
              <select
                value={editingTournament?.id || ''}
                onChange={(e) => {
                  const tournamentId = e.target.value;
                  if (tournamentId) {
                    loadTournamentSettings(tournamentId);
                  } else {
                    setEditingTournament(null);
                  }
                }}
                className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
              >
                <option value="">-- Select a tournament --</option>
                {tournaments.map((tournament) => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.tournament_name} ({tournament.status})
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Tournament Settings Form - Only show when tournament is selected */}
          {editingTournament && (
            <form onSubmit={(e) => {
              e.preventDefault();
              handleUpdateTournament(editingTournament.id, editingTournament);
            }} className="space-y-6">
              {/* Basic Tournament Info */}
              <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-6 border border-gray-100/20">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Basic Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tournament Name</label>
                    <input
                      type="text"
                      value={editingTournament.tournament_name || ''}
                      onChange={(e) => setEditingTournament({ ...editingTournament, tournament_name: e.target.value })}
                      className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tournament Code</label>
                    <input
                      type="text"
                      value={editingTournament.tournament_code || ''}
                      onChange={(e) => setEditingTournament({ ...editingTournament, tournament_code: e.target.value })}
                      className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select
                      value={editingTournament.status || 'active'}
                      onChange={(e) => setEditingTournament({ ...editingTournament, status: e.target.value })}
                      className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                    >
                      <option value="upcoming">Upcoming</option>
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={editingTournament.start_date || ''}
                      onChange={(e) => setEditingTournament({ ...editingTournament, start_date: e.target.value })}
                      className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                    />
                  </div>
                </div>
                
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={editingTournament.description || ''}
                    onChange={(e) => setEditingTournament({ ...editingTournament, description: e.target.value })}
                    rows={3}
                    className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                  />
                </div>
              </div>
              
              {/* Tournament Settings */}
              <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-6 border border-gray-100/20">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Tournament Settings</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Squad Size</label>
                    <input
                      type="number"
                      min="1"
                      value={editingTournament.squad_size || 11}
                      onChange={(e) => setEditingTournament({ ...editingTournament, squad_size: parseInt(e.target.value) })}
                      className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                    />
                    <p className="text-xs text-gray-500 mt-1">Number of players per team</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tournament System</label>
                    <select
                      value={editingTournament.tournament_system || 'match_round'}
                      onChange={(e) => setEditingTournament({ ...editingTournament, tournament_system: e.target.value })}
                      className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                    >
                      <option value="match_round">Match Round</option>
                      <option value="match_day">Match Day</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Fixture organization</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Result Day Offset</label>
                    <input
                      type="number"
                      min="0"
                      value={editingTournament.result_day_offset || 2}
                      onChange={(e) => setEditingTournament({ ...editingTournament, result_day_offset: parseInt(e.target.value) })}
                      className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                    />
                    <p className="text-xs text-gray-500 mt-1">Days for result submission</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Home Team Deadline</label>
                    <input
                      type="time"
                      value={editingTournament.home_deadline_time || '17:00'}
                      onChange={(e) => setEditingTournament({ ...editingTournament, home_deadline_time: e.target.value })}
                      className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                    />
                    <p className="text-xs text-gray-500 mt-1">Squad submission time</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Away Team Deadline</label>
                    <input
                      type="time"
                      value={editingTournament.away_deadline_time || '17:00'}
                      onChange={(e) => setEditingTournament({ ...editingTournament, away_deadline_time: e.target.value })}
                      className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                    />
                    <p className="text-xs text-gray-500 mt-1">Squad submission time</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Result Deadline</label>
                    <input
                      type="time"
                      value={editingTournament.result_deadline_time || '00:30'}
                      onChange={(e) => setEditingTournament({ ...editingTournament, result_deadline_time: e.target.value })}
                      className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                    />
                    <p className="text-xs text-gray-500 mt-1">Result submission time</p>
                  </div>
                </div>
              </div>
              
              {/* Format & Knockout Settings */}
              <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-6 border border-gray-100/20">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Tournament Format</h3>
                
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Format</label>
                  <select
                    value={
                      editingTournament.has_group_stage && editingTournament.has_knockout_stage ? 'group_knockout' :
                      editingTournament.is_pure_knockout ? 'knockout_only' :
                      !editingTournament.has_group_stage && editingTournament.has_knockout_stage ? 'league_knockout' :
                      'league_only'
                    }
                    onChange={(e) => {
                      const format = e.target.value;
                      if (format === 'league_only') {
                        setEditingTournament({ ...editingTournament, has_group_stage: false, has_knockout_stage: false, is_pure_knockout: false });
                      } else if (format === 'league_knockout') {
                        setEditingTournament({ ...editingTournament, has_group_stage: false, has_knockout_stage: true, is_pure_knockout: false });
                      } else if (format === 'group_knockout') {
                        setEditingTournament({ ...editingTournament, has_group_stage: true, has_knockout_stage: true, is_pure_knockout: false });
                      } else if (format === 'knockout_only') {
                        setEditingTournament({ ...editingTournament, has_group_stage: false, has_knockout_stage: true, is_pure_knockout: true });
                      }
                    }}
                    className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                  >
                    <option value="league_only">🏆 League Only - Traditional round-robin league</option>
                    <option value="league_knockout">⚔️ League + Knockout - League followed by playoffs</option>
                    <option value="group_knockout">🌍 Group Stage + Knockout - Groups then playoffs</option>
                    <option value="knockout_only">🥊 Knockout Only - Pure elimination bracket</option>
                  </select>
                </div>
                
                <div className="mb-6 pb-6 border-b border-gray-200">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingTournament.include_in_fantasy ?? true}
                      onChange={(e) => setEditingTournament({ ...editingTournament, include_in_fantasy: e.target.checked })}
                      className="rounded border-gray-300 text-[#0066FF] focus:ring-[#0066FF] mr-3"
                    />
                    <div>
                      <span className="font-medium text-gray-900">Include in Fantasy League</span>
                      <p className="text-xs text-gray-500 mt-1">Player stats from this tournament will count towards fantasy league points</p>
                    </div>
                  </label>
                </div>
                
                {/* Knockout Settings - Show if knockout enabled */}
                {editingTournament.has_knockout_stage && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="font-medium text-gray-800 mb-4">Knockout Configuration</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Playoff Teams</label>
                        <input
                          type="number"
                          min="2"
                          value={editingTournament.playoff_teams || 4}
                          onChange={(e) => setEditingTournament({ ...editingTournament, playoff_teams: parseInt(e.target.value) })}
                          className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                        />
                        <p className="text-xs text-gray-500 mt-1">Teams qualifying for playoffs</p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Direct to Semifinals</label>
                        <input
                          type="number"
                          min="0"
                          value={editingTournament.direct_semifinal_teams || 2}
                          onChange={(e) => setEditingTournament({ ...editingTournament, direct_semifinal_teams: parseInt(e.target.value) })}
                          className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                        />
                        <p className="text-xs text-gray-500 mt-1">Top teams skip quarterfinals</p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Qualification Threshold (%)</label>
                        <select
                          value={editingTournament.qualification_threshold || 75}
                          onChange={(e) => setEditingTournament({ ...editingTournament, qualification_threshold: parseInt(e.target.value) })}
                          className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                        >
                          <option value="50">50% - Early</option>
                          <option value="65">65% - Moderate</option>
                          <option value="75">75% - Standard</option>
                          <option value="85">85% - Conservative</option>
                          <option value="95">95% - Very Late</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">League completion required</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Group Settings - Show if group stage enabled */}
                {editingTournament.has_group_stage && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="font-medium text-gray-800 mb-4">Group Stage Configuration</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Number of Groups</label>
                        <input
                          type="number"
                          min="2"
                          max="8"
                          value={editingTournament.number_of_groups || 4}
                          onChange={(e) => setEditingTournament({ ...editingTournament, number_of_groups: parseInt(e.target.value) })}
                          className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                        />
                        <p className="text-xs text-gray-500 mt-1">Total groups (e.g., A, B, C...)</p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Teams Per Group</label>
                        <input
                          type="number"
                          min="2"
                          max="8"
                          value={editingTournament.teams_per_group || 4}
                          onChange={(e) => setEditingTournament({ ...editingTournament, teams_per_group: parseInt(e.target.value) })}
                          className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                        />
                        <p className="text-xs text-gray-500 mt-1">Teams in each group</p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Teams Advancing</label>
                        <input
                          type="number"
                          min="1"
                          value={editingTournament.teams_advancing_per_group || 2}
                          onChange={(e) => setEditingTournament({ ...editingTournament, teams_advancing_per_group: parseInt(e.target.value) })}
                          className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
                        />
                        <p className="text-xs text-gray-500 mt-1">Per group to knockout</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Save Button */}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingTournament(null)}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-[#0066FF] text-white rounded-xl hover:bg-[#0052CC] transition-colors font-medium shadow-sm flex items-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Save Changes
                </button>
              </div>
            </form>
          )}
        </div>
      )}

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
