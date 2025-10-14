'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getIdToken } from 'firebase/auth';

// Types for the season data
interface Season {
  id: string;
  name: string;
  short_name: string;
  status: string;
  is_historical: boolean;
  created_at: any;
  updated_at: any;
  import_metadata?: {
    source_file: string;
    file_size: number;
    file_type: string;
    import_date: any;
  };
}

interface Team {
  id: string;
  season_id: string;
  team_name: string;
  team_code: string;
  owner_name?: string;
  owner_email?: string;
  initial_balance?: number;
  current_balance?: number;
  is_historical: boolean;
}

interface Player {
  id: string;
  player_id?: string;
  name: string;
  category?: string;
  team?: string;
  season_id?: string;
  display_name?: string;
  email?: string;
  phone?: string;
  role?: string;
  psn_id?: string;
  xbox_id?: string;
  steam_id?: string;
  is_registered?: boolean;
  is_active?: boolean;
  is_available?: boolean;
  notes?: string;
  
  // Statistics stored in nested stats object
  stats?: {
    matches_played: number;
    matches_won: number;
    matches_lost: number;
    matches_drawn: number;
    goals_scored: number;
    goals_per_game: number;
    goals_conceded: number;
    conceded_per_game: number;
    net_goals: number;
    assists: number;
    clean_sheets: number;
    points: number;
    total_points: number;
    win_rate: number;
    average_rating: number;
    current_season_matches: number;
    current_season_wins: number;
  };
}

interface Award {
  id: string;
  season_id: string;
  award_name: string;
  award_category: string;
  winner_team?: string;
  winner_player?: string;
  description?: string;
  is_historical: boolean;
}

interface Match {
  id: string;
  season_id: string;
  match_date: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  match_type?: string;
  is_historical: boolean;
}

// Preview data interfaces
interface PreviewTeamData {
  team_name: string;
  owner_name: string;
}

interface PreviewPlayerData {
  name: string;
  team: string;
  category: string;
  goals_scored: number;
  goals_per_game: number;
  goals_conceded: number;
  conceded_per_game: number;
  net_goals: number;
  cleansheets: number;
  points: number;
  win: number;
  draw: number;
  loss: number;
  total_matches: number;
  total_points: number;
}

interface PreviewData {
  teams: PreviewTeamData[];
  players: PreviewPlayerData[];
  errors: string[];
  warnings: string[];
  summary: {
    teamsCount: number;
    playersCount: number;
    errorsCount: number;
    warningsCount: number;
  };
}

export default function HistoricalSeasonDetailPage() {
  const { user, firebaseUser, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const seasonId = params?.id as string;

  const [season, setSeason] = useState<Season | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'teams' | 'players' | 'stats' | 'import'>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<any>(null);
  const [dragOver, setDragOver] = useState(false);
  
  // Preview states
  const [previewMode, setPreviewMode] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewTeams, setPreviewTeams] = useState<PreviewTeamData[]>([]);
  const [previewPlayers, setPreviewPlayers] = useState<PreviewPlayerData[]>([]);
  const [previewAwards, setPreviewAwards] = useState<Award[]>([]);
  const [previewMatches, setPreviewMatches] = useState<Match[]>([]);
  const [previewTab, setPreviewTab] = useState<'teams' | 'players' | 'awards' | 'matches'>('teams');
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [showValidationDetails, setShowValidationDetails] = useState(false);
  const [importing, setImporting] = useState(false);
  
  // Category filter state
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    console.log('🔄 UPDATED VERSION: HistoricalSeasonDetailPage useEffect called', { seasonId, loading, user: user ? `${user.role} (${user.uid})` : 'null' });
    
    // Don't fetch data until user is loaded and authenticated
    if (!seasonId || loading || !user) return;
    
    // Only allow super admins
    if (user.role !== 'super_admin') {
      console.warn('Access denied: Super admin role required');
      router.push('/dashboard');
      return;
    }

    const fetchSeasonData = async (retryCount = 0) => {
      const maxRetries = 3;
      
      try {
        setIsLoading(true);
        console.log(`\n🔍 Using API route to fetch season data for ID: ${seasonId} (attempt ${retryCount + 1})`);
        console.log(`👤 Current user: ${user?.role} (${user?.uid})`);

        // Use server-side API route to bypass client-side permission issues
        console.log('📞 Making API call to /api/seasons/historical/${seasonId}...');
        const response = await fetch(`/api/seasons/historical/${seasonId}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        const { success, data, error } = await response.json();
        
        if (!success) {
          throw new Error(error || 'Failed to fetch season data');
        }
        
        // Set all data from the API response
        setSeason(data.season as Season);
        setTeams(data.teams as Team[]);
        setPlayers(data.players as Player[]);
        setAwards(data.awards as Award[]);
        setMatches(data.matches as Match[]);
        
        console.log('✅ All data loaded successfully via API!');
        console.log(`  - Season: ${data.season.name}`);
        console.log(`  - Teams: ${data.teams.length}`);
        console.log(`  - Players: ${data.players.length}`);
        console.log(`  - Awards: ${data.awards.length}`);
        console.log(`  - Matches: ${data.matches.length}`);
        setIsLoading(false);

      } catch (error: any) {
        console.error(`❌ Error fetching season data (attempt ${retryCount + 1}):`, error);
        
        // Handle permission errors with retry logic
        if (error.code === 'permission-denied' && retryCount < maxRetries) {
          console.warn(`🔁 Permission denied, retrying in ${Math.pow(2, retryCount) * 1000}ms...`);
          
          // Wait before retrying with exponential backoff
          setTimeout(() => {
            fetchSeasonData(retryCount + 1);
          }, Math.pow(2, retryCount) * 1000);
          return; // Don't set loading to false - we're retrying
        }
        
        // If not a permission error or retries exhausted, show error and redirect
        console.error('❌ All retries exhausted or non-permission error:', error.message);
        alert(`Failed to load season data: ${error.message}. Redirecting back to historical seasons.`);
        router.push('/dashboard/superadmin/historical-seasons');
        setIsLoading(false);
      }
    };

    // Add a small delay to ensure Firebase Auth state has propagated to Firestore
    console.log('✅ User authenticated as super admin, waiting 200ms for auth propagation...');
    setTimeout(() => {
      fetchSeasonData();
    }, 200);
  }, [seasonId, loading, router, user]);

  // Calculate statistics (no financial data for historical seasons)
  // Category/Position distribution
  const categoryDistribution = players.reduce((acc, player) => {
    const category = player.category || 'Unknown';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Get unique categories for filter
  const uniqueCategories = Object.keys(categoryDistribution).sort();
  
  // Filter players by selected category
  const filteredPlayers = selectedCategory === 'all' 
    ? players 
    : players.filter(p => (p.category || 'Unknown') === selectedCategory);

  // Active players (those with teams)
  const activePlayers = players.filter(p => p.team && p.is_active !== false);
  
  // Calculate total goals across all players for this season
  const totalGoalsScored = players.reduce((total, player) => {
    return total + (player.stats?.goals_scored || 0);
  }, 0);

  // Team statistics 
  const teamStats = teams.map(team => {
    const teamPlayers = players.filter(p => 
      p.team === team.team_name
    );
    
    // Calculate team performance from matches
    const teamWins = matches.filter(m => 
      (m.home_team === team.team_name && m.home_score > m.away_score) ||
      (m.away_team === team.team_name && m.away_score > m.home_score)
    ).length;
    const teamLosses = matches.filter(m => 
      (m.home_team === team.team_name && m.home_score < m.away_score) ||
      (m.away_team === team.team_name && m.away_score < m.home_score)
    ).length;
    const teamDraws = matches.filter(m => 
      (m.home_team === team.team_name || m.away_team === team.team_name) && m.home_score === m.away_score
    ).length;

    // Calculate team's total goals and wins from player stats
    const teamGoals = teamPlayers.reduce((total, player) => {
      return total + (player.stats?.goals_scored || 0);
    }, 0);
    
    const teamPlayerWins = teamPlayers.reduce((total, player) => {
      return total + (player.stats?.matches_won || 0);
    }, 0);

    return {
      ...team,
      playerCount: teamPlayers.length,
      wins: teamWins,
      losses: teamLosses,
      draws: teamDraws,
      matchesPlayed: teamWins + teamLosses + teamDraws,
      totalPoints: teamGoals, // Use goals as points for display
      totalGoals: teamGoals,
      totalPlayerWins: teamPlayerWins
    };
  });

  // Excel export function
  const handleExportToExcel = async () => {
    if (!firebaseUser) {
      console.error('❌ No firebase user found');
      return;
    }
    
    try {
      setIsExporting(true);
      console.log('🔄 Starting Excel export for season:', seasonId);
      console.log('👤 Firebase user UID:', firebaseUser.uid);
      
      const token = await getIdToken(firebaseUser);
      console.log('✅ Got auth token');
      
      const exportUrl = `/api/seasons/historical/${seasonId}/export`;
      console.log('📡 Fetching export from:', exportUrl);
      
      const response = await fetch(exportUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('📥 Response status:', response.status, response.statusText);
      console.log('📥 Response content-type:', response.headers.get('content-type'));
      
      if (!response.ok) {
        let errorMessage = 'Export failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = `${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      // Create download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Get filename from response headers or create default
      const disposition = response.headers.get('content-disposition');
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `historical_season_${seasonId}_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log('✅ Excel export completed successfully');
    } catch (error: any) {
      console.error('❌ Error exporting Excel:', error);
      console.error('❌ Error stack:', error.stack);
      console.error('❌ Error details:', {
        message: error.message,
        name: error.name,
        cause: error.cause
      });
      alert(`Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Excel import function - now parses and shows preview first
  const handleImportFromExcel = async (file: File) => {
    if (!firebaseUser) return;
    
    try {
      setIsImporting(true);
      setImportResults(null);
      console.log('🔄 Starting Excel parse for preview...');
      
      const formData = new FormData();
      formData.append('file', file);
      
      const token = await getIdToken(firebaseUser);
      // Use a parse-only endpoint to get preview data
      const response = await fetch(`/api/seasons/historical/${seasonId}/parse`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'File parsing failed');
      }
      
      // Set preview data
      setPreviewData(result.data);
      setPreviewTeams(result.data.teams || []);
      setPreviewPlayers(result.data.players || []);
      
      // Set initial preview tab based on available data
      if (result.data.teams.length > 0) setPreviewTab('teams');
      else if (result.data.players.length > 0) setPreviewTab('players');
      
      // Enter preview mode
      setPreviewMode(true);
      
      // Auto-run validation
      setTimeout(() => {
        const hasNoErrors = validatePreviewData();
        if (!hasNoErrors) {
          setShowValidationDetails(true);
        }
      }, 100);
      
      console.log('✅ Excel parsed successfully for preview');
      
    } catch (error: any) {
      console.error('❌ Error parsing Excel:', error);
      alert(`Parse failed: ${error.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  // File drop handlers
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        handleImportFromExcel(file);
      } else {
        alert('Please select an Excel file (.xlsx or .xls)');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  };

  // Preview validation function
  const validatePreviewData = () => {
    const errors = new Set<string>();
    
    // Get team names for cross-referential validation
    const teamNames = new Set(previewTeams.map(team => team.team_name.trim().toLowerCase()));
    
    // Validate teams
    previewTeams.forEach((team, index) => {
      if (!team.team_name.trim()) errors.add(`team-${index}-team_name`);
      if (!team.owner_name.trim()) errors.add(`team-${index}-owner_name`);
      
      // Check for duplicate team names
      const duplicateTeamIndex = previewTeams.findIndex((t, i) => 
        i !== index && t.team_name.trim().toLowerCase() === team.team_name.trim().toLowerCase()
      );
      if (duplicateTeamIndex !== -1) {
        errors.add(`team-${index}-team_name`);
      }
    });
    
    // Validate players
    previewPlayers.forEach((player, index) => {
      if (!player.name.trim()) errors.add(`player-${index}-name`);
      if (!player.team.trim()) errors.add(`player-${index}-team`);
      if (!player.category.trim()) errors.add(`player-${index}-category`);
      
      // Validate numeric fields
      if (player.goals_scored === undefined || player.goals_scored === null || isNaN(player.goals_scored)) errors.add(`player-${index}-goals_scored`);
      if (player.goals_per_game === undefined || player.goals_per_game === null || isNaN(player.goals_per_game)) errors.add(`player-${index}-goals_per_game`);
      if (player.goals_conceded === undefined || player.goals_conceded === null || isNaN(player.goals_conceded)) errors.add(`player-${index}-goals_conceded`);
      if (player.conceded_per_game === undefined || player.conceded_per_game === null || isNaN(player.conceded_per_game)) errors.add(`player-${index}-conceded_per_game`);
      if (player.net_goals === undefined || player.net_goals === null || isNaN(player.net_goals)) errors.add(`player-${index}-net_goals`);
      if (player.cleansheets === undefined || player.cleansheets === null || isNaN(player.cleansheets)) errors.add(`player-${index}-cleansheets`);
      if (player.points === undefined || player.points === null || isNaN(player.points)) errors.add(`player-${index}-points`);
      if (player.win === undefined || player.win === null || isNaN(player.win)) errors.add(`player-${index}-win`);
      if (player.draw === undefined || player.draw === null || isNaN(player.draw)) errors.add(`player-${index}-draw`);
      if (player.loss === undefined || player.loss === null || isNaN(player.loss)) errors.add(`player-${index}-loss`);
      if (player.total_matches === undefined || player.total_matches === null || isNaN(player.total_matches)) errors.add(`player-${index}-total_matches`);
      if (player.total_points === undefined || player.total_points === null || isNaN(player.total_points)) errors.add(`player-${index}-total_points`);
      
      // Validate non-negative values
      if (typeof player.total_matches === 'number' && !isNaN(player.total_matches) && player.total_matches < 0) {
        errors.add(`player-${index}-total_matches`);
      }
      if (typeof player.win === 'number' && !isNaN(player.win) && player.win < 0) {
        errors.add(`player-${index}-win`);
      }
      if (typeof player.draw === 'number' && !isNaN(player.draw) && player.draw < 0) {
        errors.add(`player-${index}-draw`);
      }
      if (typeof player.loss === 'number' && !isNaN(player.loss) && player.loss < 0) {
        errors.add(`player-${index}-loss`);
      }
      
      // Validate match calculations
      if (player.win + player.draw + player.loss !== player.total_matches) {
        errors.add(`player-${index}-total_matches`);
      }
      
      // Check for duplicate player names
      const duplicatePlayerIndex = previewPlayers.findIndex((p, i) => 
        i !== index && p.name.trim().toLowerCase() === player.name.trim().toLowerCase()
      );
      if (duplicatePlayerIndex !== -1) {
        errors.add(`player-${index}-name`);
      }
      
      // Cross-referential validation: player team must exist in teams list
      if (player.team && player.team.trim()) {
        if (!teamNames.has(player.team.trim().toLowerCase())) {
          errors.add(`player-${index}-team`);
        }
      }
    });
    
    setValidationErrors(errors);
    return errors.size === 0;
  };

  // Handle removing items from preview
  const handleRemovePreviewTeam = (index: number) => {
    if (confirm('Remove this team from the import?')) {
      setPreviewTeams(previewTeams.filter((_, i) => i !== index));
    }
  };

  const handleRemovePreviewPlayer = (index: number) => {
    if (confirm('Remove this player from the import?')) {
      setPreviewPlayers(previewPlayers.filter((_, i) => i !== index));
    }
  };

  // Handle editing preview data
  const handlePreviewTeamChange = (index: number, field: keyof PreviewTeamData, value: string) => {
    const newTeams = [...previewTeams];
    newTeams[index][field] = value;
    setPreviewTeams(newTeams);
  };

  const handlePreviewPlayerChange = (index: number, field: keyof PreviewPlayerData, value: any) => {
    const newPlayers = [...previewPlayers];
    if (field === 'goals_scored' || field === 'goals_per_game' || field === 'goals_conceded' || 
        field === 'conceded_per_game' || field === 'net_goals' || field === 'cleansheets' || 
        field === 'points' || field === 'win' || field === 'draw' || field === 'loss' || 
        field === 'total_matches' || field === 'total_points') {
      newPlayers[index][field] = typeof value === 'string' ? (parseFloat(value) || 0) : value;
    } else {
      newPlayers[index][field] = value;
    }
    setPreviewPlayers(newPlayers);
  };

  const handlePreviewAwardChange = (index: number, field: keyof Award, value: any) => {
    const newAwards = [...previewAwards];
    (newAwards[index] as any)[field] = value;
    setPreviewAwards(newAwards);
  };

  const handlePreviewMatchChange = (index: number, field: keyof Match, value: any) => {
    const newMatches = [...previewMatches];
    if (field === 'home_score' || field === 'away_score') {
      (newMatches[index] as any)[field] = typeof value === 'string' ? (parseInt(value) || 0) : value;
    } else {
      (newMatches[index] as any)[field] = value;
    }
    setPreviewMatches(newMatches);
  };

  const handleRemovePreviewAward = (index: number) => {
    if (confirm('Remove this award from the import?')) {
      setPreviewAwards(previewAwards.filter((_, i) => i !== index));
    }
  };

  const handleRemovePreviewMatch = (index: number) => {
    if (confirm('Remove this match from the import?')) {
      setPreviewMatches(previewMatches.filter((_, i) => i !== index));
    }
  };

  // Final import after preview approval
  const handleFinalImport = async () => {
    if (!validatePreviewData()) {
      alert('Please fix all validation errors before importing.');
      return;
    }
    
    if (previewTeams.length === 0 && previewPlayers.length === 0) {
      alert('No data to import.');
      return;
    }
    
    if (!firebaseUser) return;
    
    try {
      setImporting(true);
      setImportResults(null);
      console.log('🔄 Starting final import after preview...');
      
      // Prepare the data for import
      const importData = {
        teams: previewTeams,
        players: previewPlayers
      };
      
      const token = await getIdToken(firebaseUser);
      const response = await fetch(`/api/seasons/historical/${seasonId}/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(importData)
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Import failed');
      }
      
      setImportResults(result);
      setPreviewMode(false); // Exit preview mode
      
      console.log('✅ Final import completed successfully');
      
      // Refresh the page data after import
      setTimeout(() => {
        window.location.reload();
      }, 3000);
      
    } catch (error: any) {
      console.error('❌ Error during final import:', error);
      alert(`Import failed: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  // Cancel preview and return to upload
  const handleCancelPreview = () => {
    setPreviewMode(false);
    setPreviewData(null);
    setPreviewTeams([]);
    setPreviewPlayers([]);
    setPreviewAwards([]);
    setPreviewMatches([]);
    setValidationErrors(new Set());
    setShowValidationDetails(false);
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading season data...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'super_admin') {
    return null;
  }

  if (!season) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Season not found</p>
          <button
            onClick={() => router.push('/dashboard/superadmin/historical-seasons')}
            className="mt-4 px-4 py-2 bg-[#0066FF] text-white rounded-lg hover:bg-[#0066FF]/90"
          >
            Return to Historical Seasons
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 py-4 sm:py-8 px-4">
      <div className="container mx-auto max-w-screen-2xl">
        {/* Enhanced Page Header */}
        <header className="mb-8">
          <div className="glass rounded-2xl p-6 mb-6 shadow-xl backdrop-blur-md border border-white/30">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push('/dashboard/superadmin/historical-seasons')}
                  className="group p-3 rounded-xl bg-white/60 hover:bg-white/80 transition-all duration-300 hover:shadow-md"
                >
                  <svg className="w-5 h-5 text-gray-600 group-hover:text-[#0066FF] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-r from-[#0066FF] to-purple-600 rounded-xl">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-[#0066FF] to-purple-600 bg-clip-text text-transparent">
                      {season.name}
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        📚 Historical Season
                      </span>
                      <span className="text-gray-500 text-sm">
                        {season.short_name && `${season.short_name} • `}Status: {season.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Enhanced Export Button */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleExportToExcel}
                  disabled={isExporting}
                  className={`group flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 ${
                    isExporting 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 shadow-lg hover:shadow-xl'
                  }`}
                >
                  {isExporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span className="hidden sm:inline">Exporting...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="hidden sm:inline">Export to Excel</span>
                      <span className="sm:hidden">Export</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          
          {/* Data Architecture Information Banner */}
          <div className="glass rounded-xl p-5 mb-6 border border-indigo-200/50 bg-gradient-to-r from-indigo-50/50 to-purple-50/30">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-indigo-800">📦 Data Architecture</h3>
            </div>
            <div className="text-sm text-gray-700 space-y-2">
              <p className="font-medium">
                This historical season uses our <span className="font-bold text-indigo-700">two-collection architecture</span>:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>
                  <span className="font-semibold text-indigo-600">realplayers</span> collection stores <span className="font-medium">permanent player information</span> (name, contact, gaming IDs)
                </li>
                <li>
                  <span className="font-semibold text-purple-600">realplayerstats</span> collection stores <span className="font-medium">season-specific stats</span> (category, team, statistics)
                </li>
              </ul>
              <p className="mt-2 text-xs text-gray-600 italic">
                ✅ This separation preserves permanent player data while allowing multiple seasons without overwriting
              </p>
            </div>
          </div>

          {season.import_metadata && (
            <div className="glass rounded-xl p-5 mb-6 border border-blue-200/50 bg-gradient-to-r from-blue-50/50 to-indigo-50/30">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-blue-800">📂 Import Information</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white/60 rounded-lg p-3 border border-white/50">
                  <div className="text-xs font-medium text-blue-700 mb-1">Source File</div>
                  <div className="text-sm font-semibold text-gray-800 truncate" title="{season.import_metadata.source_file}">
                    {season.import_metadata.source_file}
                  </div>
                </div>
                <div className="bg-white/60 rounded-lg p-3 border border-white/50">
                  <div className="text-xs font-medium text-blue-700 mb-1">File Size</div>
                  <div className="text-sm font-semibold text-gray-800">
                    {(season.import_metadata.file_size / 1024).toFixed(1)} KB
                  </div>
                </div>
                <div className="bg-white/60 rounded-lg p-3 border border-white/50">
                  <div className="text-xs font-medium text-blue-700 mb-1">File Type</div>
                  <div className="text-sm font-semibold text-gray-800">
                    {season.import_metadata.file_type.toUpperCase()}
                  </div>
                </div>
                <div className="bg-white/60 rounded-lg p-3 border border-white/50">
                  <div className="text-xs font-medium text-blue-700 mb-1">Import Date</div>
                  <div className="text-sm font-semibold text-gray-800">
                    {season.import_metadata.import_date?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </header>

        {/* Enhanced Tab Navigation */}
        <div className="glass rounded-t-3xl p-3 shadow-xl backdrop-blur-md border border-white/30 border-b-0 mb-0">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {[
              { id: 'overview', name: 'Overview', icon: '📊', color: 'from-purple-500 to-purple-600' },
              { id: 'teams', name: `Teams (${teams.length})`, icon: '🏆', color: 'from-orange-500 to-orange-600' },
              { id: 'players', name: `Players (${players.length})`, icon: '👤', color: 'from-blue-500 to-blue-600' },
              { id: 'stats', name: 'Player Stats', icon: '📈', color: 'from-green-500 to-green-600' },
              { id: 'import', name: 'Import/Export', icon: '📥', color: 'from-indigo-500 to-indigo-600' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`group flex-shrink-0 px-5 py-3 rounded-xl text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
                  activeTab === tab.id
                    ? `bg-gradient-to-r ${tab.color} text-white shadow-lg ring-2 ring-white/20`
                    : 'text-gray-600 hover:bg-white/40 hover:shadow-md'
                }`}
              >
                <span className={`mr-2 transition-transform duration-300 ${
                  activeTab === tab.id ? 'scale-110' : 'group-hover:scale-110'
                }`}>{tab.icon}</span>
                <span className="whitespace-nowrap">{tab.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Enhanced Tab Content */}
        <div className="glass rounded-b-3xl shadow-xl backdrop-blur-md border border-white/30 overflow-hidden">
          {/* Enhanced Overview Tab */}
          {activeTab === 'overview' && (
            <div className="p-6 lg:p-8">
              {/* Enhanced Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="group bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-2xl text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-3 bg-white/20 rounded-xl group-hover:rotate-12 transition-transform duration-300">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <span className="text-xs font-medium opacity-80">🏆</span>
                  </div>
                  <div className="text-3xl font-bold mb-1">{teams.length}</div>
                  <div className="text-sm font-medium opacity-90">Teams</div>
                </div>
                <div className="group bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-2xl text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-3 bg-white/20 rounded-xl group-hover:rotate-12 transition-transform duration-300">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <span className="text-xs font-medium opacity-80">👥</span>
                  </div>
                  <div className="text-3xl font-bold mb-1">{players.length}</div>
                  <div className="text-sm font-medium opacity-90">Total Players</div>
                </div>
                <div className="group bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-2xl text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-3 bg-white/20 rounded-xl group-hover:rotate-12 transition-transform duration-300">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="text-xs font-medium opacity-80">✅</span>
                  </div>
                  <div className="text-3xl font-bold mb-1">{activePlayers.length}</div>
                  <div className="text-sm font-medium opacity-90">Active Players</div>
                </div>
                <div className="group bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-2xl text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-3 bg-white/20 rounded-xl group-hover:rotate-12 transition-transform duration-300">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <span className="text-xs font-medium opacity-80">⚽</span>
                  </div>
                  <div className="text-3xl font-bold mb-1">{totalGoalsScored.toLocaleString()}</div>
                  <div className="text-sm font-medium opacity-90">Total Goals</div>
                </div>
              </div>

              {/* Enhanced Category Distribution */}
              <div className="glass rounded-2xl p-6 lg:p-8 border border-green-200/50 bg-gradient-to-br from-green-50/50 to-emerald-50/30">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-green-100 rounded-xl">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">📊 Category Distribution</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  {Object.entries(categoryDistribution).map(([category, count]) => {
                    const percentage = players.length > 0 ? ((count / players.length) * 100).toFixed(1) : '0';
                    return (
                      <div key={category} className="group bg-white/80 hover:bg-white rounded-xl p-4 border border-white/50 hover:shadow-md transition-all duration-300 transform hover:scale-105">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600 mb-1">{count}</div>
                          <div className="text-xs font-semibold text-gray-800 mb-2 truncate" title={category}>
                            {category || 'Uncategorized'}
                          </div>
                          <div className="text-xs text-gray-500 font-medium">
                            {percentage}%
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Teams Tab */}
          {activeTab === 'teams' && (
            <div className="p-6 lg:p-8">
              {/* Teams Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-orange-100 rounded-xl">
                    <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">🏆 Teams Overview</h3>
                    <p className="text-sm text-gray-600">Team performance and player statistics</p>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-orange-50 rounded-lg">
                  <span className="text-sm font-medium text-orange-800">Teams: {teamStats.length}</span>
                </div>
              </div>

              {teamStats.length === 0 ? (
                <div className="text-center py-16">
                  <div className="p-6 bg-gray-100 rounded-full w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">No Teams Found</h3>
                  <p className="text-gray-600">This season doesn't have any teams yet.</p>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden lg:block overflow-x-auto rounded-2xl border border-gray-200/50">
                    <table className="min-w-full bg-white/50">
                      <thead className="bg-gradient-to-r from-orange-50 to-orange-100/80">
                        <tr>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-800 uppercase tracking-wider">
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                              Team
                            </div>
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-800 uppercase tracking-wider">
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              Owner
                            </div>
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-800 uppercase tracking-wider">
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                              Players
                            </div>
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-800 uppercase tracking-wider">
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              Goals
                            </div>
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-800 uppercase tracking-wider">
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                              Record
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {teamStats.map((team, index) => (
                          <tr key={team.id} className={`hover:bg-orange-50/50 transition-all duration-200 ${
                            index % 2 === 0 ? 'bg-white/30' : 'bg-white/50'
                          }`}>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                  {team.team_code || team.team_name.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-semibold text-gray-900 text-base">{team.team_name}</div>
                                  <div className="text-xs text-gray-500">{team.team_code}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                </div>
                                <span className="text-sm font-medium text-gray-900">
                                  {team.owner_name || 'N/A'}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800 border border-purple-200">
                                {team.playerCount} players
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                <span className="text-lg font-bold text-green-600">
                                  {team.totalPoints.toLocaleString()}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-800">
                                  {team.wins}W
                                </span>
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-yellow-100 text-yellow-800">
                                  {team.draws}D
                                </span>
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-800">
                                  {team.losses}L
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile/Tablet Cards */}
                  <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {teamStats.map((team, index) => (
                      <div key={team.id} className="bg-white/70 rounded-xl p-5 border border-white/50 shadow-sm hover:shadow-md transition-all duration-300">
                        <div className="flex items-start gap-4 mb-4">
                          <div className="w-14 h-14 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                            {team.team_code || team.team_name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-900 text-base truncate">
                              {team.team_name}
                            </h4>
                            <p className="text-sm text-gray-600 mt-1">
                              Owner: {team.owner_name || 'N/A'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center bg-purple-50 rounded-lg p-3">
                            <div className="text-lg font-bold text-purple-600">{team.playerCount}</div>
                            <div className="text-xs text-purple-700 font-medium">Players</div>
                          </div>
                          <div className="text-center bg-green-50 rounded-lg p-3">
                            <div className="text-lg font-bold text-green-600">{team.totalPoints.toLocaleString()}</div>
                            <div className="text-xs text-green-700 font-medium">Goals</div>
                          </div>
                          <div className="text-center bg-blue-50 rounded-lg p-3">
                            <div className="text-sm font-bold text-blue-600">{team.wins}-{team.draws}-{team.losses}</div>
                            <div className="text-xs text-blue-700 font-medium">W-D-L</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Enhanced Players Tab */}
          {activeTab === 'players' && (
            <div className="p-6 lg:p-8">
              {/* Players Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">👤 Players Overview</h3>
                    <p className="text-sm text-gray-600">Simple view of all players with essential information</p>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
                  <span className="text-sm font-medium text-blue-800">Total: {players.length}</span>
                </div>
              </div>

              {players.length === 0 ? (
                <div className="text-center py-16">
                  <div className="p-6 bg-gray-100 rounded-full w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">No Players Found</h3>
                  <p className="text-gray-600">This season doesn't have any players yet.</p>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-200/50">
                    <table className="min-w-full bg-white/50">
                      <thead className="bg-gradient-to-r from-blue-50 to-blue-100/80">
                        <tr>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-800 uppercase tracking-wider">
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              Player Name
                            </div>
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-800 uppercase tracking-wider">
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                              </svg>
                              Category
                            </div>
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-semibold text-gray-800 uppercase tracking-wider">
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                              Team Name
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {players.map((player, index) => {
                          return (
                            <tr key={player.id} className={`hover:bg-blue-50/50 transition-all duration-200 ${
                              index % 2 === 0 ? 'bg-white/30' : 'bg-white/50'
                            }`}>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                                    {(player.name || 'U')[0].toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-gray-900">
                                      {player.name || 'Unknown Player'}
                                    </div>
                                    <div className="text-xs text-gray-500">Player #{index + 1}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                  player.category 
                                    ? 'bg-green-100 text-green-800 border border-green-200' 
                                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                                }`}>
                                  {player.category || 'N/A'}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <div className={`w-3 h-3 rounded-full ${
                                    player.team ? 'bg-purple-500' : 'bg-gray-400'
                                  }`}></div>
                                  <span className={`font-medium ${
                                    player.team ? 'text-gray-900' : 'text-gray-500'
                                  }`}>
                                    {player.team || 'No Team'}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden space-y-4">
                    {players.map((player, index) => (
                      <div key={player.id} className="bg-white/70 rounded-xl p-4 border border-white/50 shadow-sm hover:shadow-md transition-all duration-300">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                            {(player.name || 'U')[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold text-gray-900 truncate">
                                {player.name || 'Unknown Player'}
                              </h4>
                              <span className="text-xs text-gray-500 flex-shrink-0">#{index + 1}</span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-600">Category:</span>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  player.category 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {player.category || 'N/A'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-600">Team:</span>
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${
                                    player.team ? 'bg-purple-500' : 'bg-gray-400'
                                  }`}></div>
                                  <span className={`text-xs font-medium ${
                                    player.team ? 'text-gray-900' : 'text-gray-500'
                                  }`}>
                                    {player.team || 'No Team'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Enhanced Player Stats Tab */}
          {activeTab === 'stats' && (
            <div className="p-6 lg:p-8">
              {/* Stats Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-green-100 rounded-xl">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">📈 Player Statistics</h3>
                  <p className="text-sm text-gray-600">Detailed performance metrics and rankings</p>
                </div>
              </div>
              
              {/* Category Filter Tabs */}
              <div className="mb-6">
                <div className="bg-white rounded-xl p-2 shadow-sm border border-gray-200">
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                    {/* All Categories Tab */}
                    <button
                      onClick={() => setSelectedCategory('all')}
                      className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                        selectedCategory === 'all'
                          ? 'bg-green-500 text-white shadow-md'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      All ({players.length})
                    </button>
                    
                    {/* Individual Category Tabs */}
                    {uniqueCategories.map(category => {
                      const count = categoryDistribution[category];
                      const isSelected = selectedCategory === category;
                      const lowerCategory = category.toLowerCase();
                      
                      // Get color based on category
                      const getColor = () => {
                        if (lowerCategory.includes('forward') || lowerCategory.includes('striker')) {
                          return isSelected ? 'bg-red-500 text-white shadow-md' : 'text-gray-600 hover:bg-red-50';
                        } else if (lowerCategory.includes('midfielder') || lowerCategory.includes('mid')) {
                          return isSelected ? 'bg-blue-500 text-white shadow-md' : 'text-gray-600 hover:bg-blue-50';
                        } else if (lowerCategory.includes('defender') || lowerCategory.includes('defence')) {
                          return isSelected ? 'bg-indigo-500 text-white shadow-md' : 'text-gray-600 hover:bg-indigo-50';
                        } else if (lowerCategory.includes('goalkeeper') || lowerCategory.includes('gk')) {
                          return isSelected ? 'bg-yellow-500 text-white shadow-md' : 'text-gray-600 hover:bg-yellow-50';
                        } else {
                          return isSelected ? 'bg-purple-500 text-white shadow-md' : 'text-gray-600 hover:bg-purple-50';
                        }
                      };
                      
                      return (
                        <button
                          key={category}
                          onClick={() => setSelectedCategory(category)}
                          className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                            getColor()
                          }`}
                        >
                          {category} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Active Filter Info */}
                {selectedCategory !== 'all' && (
                  <div className="mt-3 flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <span className="text-sm text-gray-700">
                      Showing <span className="font-semibold text-green-600">{filteredPlayers.length}</span> {filteredPlayers.length === 1 ? 'player' : 'players'} in <span className="font-semibold">{selectedCategory}</span>
                    </span>
                    <button
                      onClick={() => setSelectedCategory('all')}
                      className="text-sm text-red-600 hover:text-red-700 font-medium"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {filteredPlayers.length === 0 ? (
                <div className="text-center py-16">
                  <div className="p-6 bg-gray-100 rounded-full w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    {selectedCategory === 'all' ? 'No Statistics Available' : `No Players in ${selectedCategory}`}
                  </h3>
                  <p className="text-gray-600">
                    {selectedCategory === 'all' 
                      ? 'Player statistics will appear here once available.' 
                      : 'Try selecting a different category or clear the filter.'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden lg:block overflow-x-auto rounded-2xl border border-gray-200/50">
                    <table className="min-w-full bg-white/50">
                      <thead className="bg-gradient-to-r from-green-50 to-green-100/80">
                        <tr>
                          <th className="px-4 py-4 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider">
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              Player
                            </div>
                          </th>
                          <th className="px-3 py-4 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider">Team</th>
                          <th className="px-3 py-4 text-left text-xs font-semibold text-gray-800 uppercase tracking-wider">Cat.</th>
                          <th className="px-3 py-4 text-center text-xs font-semibold text-gray-800 uppercase tracking-wider" title="Total Matches">Matches</th>
                          <th className="px-3 py-4 text-center text-xs font-semibold text-gray-800 uppercase tracking-wider" title="Wins-Draws-Losses">W-D-L</th>
                          <th className="px-3 py-4 text-center text-xs font-semibold text-gray-800 uppercase tracking-wider" title="Win Rate">Win %</th>
                          <th className="px-3 py-4 text-center text-xs font-semibold text-gray-800 uppercase tracking-wider" title="Goals Scored">Goals</th>
                          <th className="px-3 py-4 text-center text-xs font-semibold text-gray-800 uppercase tracking-wider" title="Goals Per Game">G/Game</th>
                          <th className="px-3 py-4 text-center text-xs font-semibold text-gray-800 uppercase tracking-wider" title="Goals Conceded">Conceded</th>
                          <th className="px-3 py-4 text-center text-xs font-semibold text-gray-800 uppercase tracking-wider" title="Conceded Per Game">C/Game</th>
                          <th className="px-3 py-4 text-center text-xs font-semibold text-gray-800 uppercase tracking-wider" title="Net Goals">Net</th>
                          <th className="px-3 py-4 text-center text-xs font-semibold text-gray-800 uppercase tracking-wider" title="Clean Sheets">Clean</th>
                          <th className="px-3 py-4 text-center text-xs font-semibold text-gray-800 uppercase tracking-wider" title="Points">Points</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {filteredPlayers
                          .sort((a, b) => {
                            const pointsA = a.stats?.points || a.stats?.total_points || 0;
                            const pointsB = b.stats?.points || b.stats?.total_points || 0;
                            return pointsB - pointsA;
                          })
                          .map((player, index) => {
                            const stats = (player.stats || {}) as any;
                            const matchesPlayed = stats.matches_played || 0;
                            const winRate = matchesPlayed > 0 
                              ? ((stats.matches_won || 0) / matchesPlayed * 100).toFixed(1) 
                              : '0.0';
                            const isTopPlayer = index < 3; // Top 3 by points
                            const goalsPerGame = stats.goals_per_game || (matchesPlayed > 0 ? (stats.goals_scored || 0) / matchesPlayed : 0);
                            const concededPerGame = stats.conceded_per_game || (matchesPlayed > 0 ? (stats.goals_conceded || 0) / matchesPlayed : 0);
                            const netGoals = stats.net_goals || ((stats.goals_scored || 0) - (stats.goals_conceded || 0));
                            
                            return (
                              <tr 
                                key={player.id} 
                                onClick={() => router.push(`/dashboard/players/${player.player_id || player.id}`)}
                                className={`cursor-pointer hover:bg-green-50/50 transition-all duration-200 ${
                                index % 2 === 0 ? 'bg-white/30' : 'bg-white/50'
                              }`}
                              >
                                <td className="px-4 py-4">
                                  <div className="flex items-center gap-3">
                                    {isTopPlayer && (
                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                                        index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-400'
                                      }`}>
                                        {index + 1}
                                      </div>
                                    )}
                                    <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                                      {(player.name || 'U')[0].toUpperCase()}
                                    </div>
                                    <div>
                                      <div className="font-semibold text-gray-900 text-sm">
                                        {player.name || 'Unknown Player'}
                                      </div>
                                      <div className="text-xs text-gray-500">Rank #{index + 1}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-4">
                                  <span className="text-xs font-medium text-gray-700">
                                    {player.team || 'No Team'}
                                  </span>
                                </td>
                                <td className="px-3 py-4">
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    player.category 
                                      ? 'bg-indigo-100 text-indigo-800' 
                                      : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    {player.category || 'N/A'}
                                  </span>
                                </td>
                                <td className="px-3 py-4 text-center">
                                  <span className="text-sm font-medium text-gray-900">{matchesPlayed}</span>
                                </td>
                                <td className="px-3 py-4 text-center">
                                  <div className="text-xs space-x-1">
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-100 text-green-800 font-semibold">
                                      {stats.matches_won || 0}W
                                    </span>
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 font-semibold">
                                      {stats.matches_drawn || 0}D
                                    </span>
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-100 text-red-800 font-semibold">
                                      {stats.matches_lost || 0}L
                                    </span>
                                  </div>
                                </td>
                                <td className="px-3 py-4 text-center">
                                  <span className={`text-sm font-bold ${
                                    parseFloat(winRate) >= 70 ? 'text-green-600' : 
                                    parseFloat(winRate) >= 50 ? 'text-yellow-600' : 'text-red-600'
                                  }`}>
                                    {winRate}%
                                  </span>
                                </td>
                                <td className="px-3 py-4 text-center">
                                  <span className="text-lg font-bold text-green-600">{stats.goals_scored || 0}</span>
                                </td>
                                <td className="px-3 py-4 text-center">
                                  <span className="text-sm font-medium text-blue-600">{typeof goalsPerGame === 'number' ? goalsPerGame.toFixed(2) : '0.00'}</span>
                                </td>
                                <td className="px-3 py-4 text-center">
                                  <span className="text-sm font-medium text-red-600">{stats.goals_conceded || 0}</span>
                                </td>
                                <td className="px-3 py-4 text-center">
                                  <span className="text-sm font-medium text-orange-600">{typeof concededPerGame === 'number' ? concededPerGame.toFixed(2) : '0.00'}</span>
                                </td>
                                <td className="px-3 py-4 text-center">
                                  <span className={`text-sm font-bold ${
                                    netGoals > 0 ? 'text-green-600' : netGoals < 0 ? 'text-red-600' : 'text-gray-600'
                                  }`}>
                                    {netGoals > 0 ? '+' : ''}{netGoals}
                                  </span>
                                </td>
                                <td className="px-3 py-4 text-center">
                                  <span className="text-sm font-medium text-purple-600">{stats.clean_sheets || 0}</span>
                                </td>
                                <td className="px-3 py-4 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <span className="text-sm font-bold text-indigo-600">{stats.points || stats.total_points || 0}</span>
                                    {isTopPlayer && (
                                      <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                      </svg>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile/Tablet Cards */}
                  <div className="lg:hidden space-y-4">
                    {filteredPlayers
                      .sort((a, b) => {
                        const pointsA = a.stats?.points || a.stats?.total_points || 0;
                        const pointsB = b.stats?.points || b.stats?.total_points || 0;
                        return pointsB - pointsA;
                      })
                      .map((player, index) => {
                        const stats = (player.stats || {}) as any;
                        const matchesPlayed = stats.matches_played || 0;
                        const winRate = matchesPlayed > 0 
                          ? ((stats.matches_won || 0) / matchesPlayed * 100).toFixed(1) 
                          : '0.0';
                        const isTopPlayer = index < 3; // Top 3 by points
                        const goalsPerGame = stats.goals_per_game || (matchesPlayed > 0 ? (stats.goals_scored || 0) / matchesPlayed : 0);
                        const concededPerGame = stats.conceded_per_game || (matchesPlayed > 0 ? (stats.goals_conceded || 0) / matchesPlayed : 0);
                        const netGoals = stats.net_goals || ((stats.goals_scored || 0) - (stats.goals_conceded || 0));

                        return (
                          <div 
                            key={player.id} 
                            onClick={() => router.push(`/dashboard/players/${player.player_id || player.id}`)}
                            className={`cursor-pointer bg-white/70 rounded-xl p-5 border border-white/50 shadow-sm hover:shadow-md transition-all duration-300 ${
                            isTopPlayer ? 'ring-2 ring-yellow-200' : ''
                          }`}
                          >
                            <div className="flex items-start gap-4 mb-4">
                              <div className="flex items-center gap-2">
                                {isTopPlayer && (
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                                    index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-400'
                                  }`}>
                                    {index + 1}
                                  </div>
                                )}
                                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                                  {(player.name || 'U')[0].toUpperCase()}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <h4 className="font-bold text-gray-900 text-base truncate">
                                    {player.name || 'Unknown Player'}
                                  </h4>
                                  {isTopPlayer && (
                                    <svg className="w-5 h-5 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <span>{player.team || 'No Team'}</span>
                                  <span>•</span>
                                  <span>{player.category || 'N/A'}</span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                              {/* Points - First and Highlighted */}
                              <div className={`text-center rounded-lg p-2.5 ${
                                isTopPlayer ? 'bg-gradient-to-br from-yellow-100 to-yellow-200 ring-2 ring-yellow-400' : 'bg-indigo-50'
                              }`}>
                                <div className="flex items-center justify-center gap-1">
                                  <div className="text-xl font-bold text-indigo-600">{stats.points || stats.total_points || 0}</div>
                                  {isTopPlayer && (
                                    <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                  )}
                                </div>
                                <div className={`text-xs font-medium ${
                                  isTopPlayer ? 'text-yellow-800' : 'text-indigo-700'
                                }`}>Points</div>
                              </div>
                              
                              <div className="text-center bg-yellow-50 rounded-lg p-2.5">
                                <div className="text-lg font-bold text-yellow-600">{matchesPlayed}</div>
                                <div className="text-xs text-yellow-700 font-medium">Matches</div>
                              </div>
                              <div className="text-center bg-gray-50 rounded-lg p-2.5">
                                <div className="text-sm font-bold text-gray-600">{stats.matches_won || 0}-{stats.matches_drawn || 0}-{stats.matches_lost || 0}</div>
                                <div className="text-xs text-gray-700 font-medium">W-D-L</div>
                              </div>
                              <div className="text-center bg-green-50 rounded-lg p-2.5">
                                <div className="text-xl font-bold text-green-600">{stats.goals_scored || 0}</div>
                                <div className="text-xs text-green-700 font-medium">Goals Scored</div>
                              </div>
                              <div className="text-center bg-blue-50 rounded-lg p-2.5">
                                <div className="text-lg font-bold text-blue-600">{typeof goalsPerGame === 'number' ? goalsPerGame.toFixed(2) : '0.00'}</div>
                                <div className="text-xs text-blue-700 font-medium">Goals/Game</div>
                              </div>
                              <div className="text-center bg-red-50 rounded-lg p-2.5">
                                <div className="text-lg font-bold text-red-600">{stats.goals_conceded || 0}</div>
                                <div className="text-xs text-red-700 font-medium">Conceded</div>
                              </div>
                              <div className="text-center bg-orange-50 rounded-lg p-2.5">
                                <div className="text-lg font-bold text-orange-600">{typeof concededPerGame === 'number' ? concededPerGame.toFixed(2) : '0.00'}</div>
                                <div className="text-xs text-orange-700 font-medium">Conceded/Game</div>
                              </div>
                              <div className="text-center bg-teal-50 rounded-lg p-2.5">
                                <div className={`text-lg font-bold ${
                                  netGoals > 0 ? 'text-green-600' : netGoals < 0 ? 'text-red-600' : 'text-gray-600'
                                }`}>
                                  {netGoals > 0 ? '+' : ''}{netGoals}
                                </div>
                                <div className="text-xs text-teal-700 font-medium">Net Goals</div>
                              </div>
                              <div className="text-center bg-purple-50 rounded-lg p-2.5">
                                <div className="text-lg font-bold text-purple-600">{stats.clean_sheets || 0}</div>
                                <div className="text-xs text-purple-700 font-medium">Clean Sheets</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Enhanced Import/Export Tab */}
          {activeTab === 'import' && (
            <div className="p-6 lg:p-8">
              {/* Import/Export Header */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-100 rounded-xl">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">📥 Import & Export</h3>
                    <p className="text-sm text-gray-600">Update historical season data with Excel files</p>
                  </div>
                </div>
              </div>

              <div className="max-w-6xl mx-auto">
                {!previewMode ? (
                  // Enhanced Upload Mode
                  <>
                    {/* Enhanced Instructions */}
                    <div className="glass rounded-2xl p-6 lg:p-8 mb-8 border border-blue-200/50 bg-gradient-to-br from-blue-50/50 to-indigo-50/30">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-blue-100 rounded-xl flex-shrink-0">
                          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-blue-800 mb-4">📋 How to Update Historical Season Data</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-blue-700">
                            <div className="bg-white/60 rounded-lg p-4 border border-blue-200/50">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                                <strong className="text-blue-800">Export Data</strong>
                              </div>
                              <p>Click "Export Excel" above to download the current season data as an Excel file.</p>
                            </div>
                            <div className="bg-white/60 rounded-lg p-4 border border-blue-200/50">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                                <strong className="text-blue-800">Make Changes</strong>
                              </div>
                              <p>Open the Excel file and update any data on the Teams, Players, Awards, or Matches sheets.</p>
                            </div>
                            <div className="bg-white/60 rounded-lg p-4 border border-blue-200/50">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                                <strong className="text-blue-800">Upload & Preview</strong>
                              </div>
                              <p>Save the Excel file and upload it below to preview and apply your changes.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Enhanced File Upload Area */}
                    <div className="glass rounded-2xl p-8 border border-gray-200/50">
                      <div
                        className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
                          dragOver 
                            ? 'border-indigo-400 bg-indigo-50/50 scale-102' 
                            : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/30'
                        }`}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                      >
                        {isImporting ? (
                          <div className="py-8">
                            <div className="w-16 h-16 mx-auto mb-6 relative">
                              <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600"></div>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Processing Excel File</h3>
                            <p className="text-gray-600">Analyzing your data for preview...</p>
                            <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
                          </div>
                        ) : (
                          <div className="py-8">
                            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center">
                              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-800 mb-3">Upload Your Excel File</h3>
                            <p className="text-gray-600 mb-6 max-w-md mx-auto">Drag and drop your updated Excel file here, or click the button below to browse your files</p>
                            <input
                              type="file"
                              accept=".xlsx,.xls"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleImportFromExcel(file);
                              }}
                              className="hidden"
                              id="excel-upload"
                            />
                            <label
                              htmlFor="excel-upload"
                              className="group inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 cursor-pointer transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 font-medium"
                            >
                              <svg className="w-5 h-5 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                              Select Excel File
                            </label>
                            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-500">
                              <div className="flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Supports .xlsx and .xls files
                              </div>
                              <div className="flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                Secure upload process
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Import Results */}
                    {importResults && (
                      <div className="mt-8 bg-green-50/50 rounded-xl p-6 border border-green-100">
                        <h3 className="text-lg font-bold text-green-800 mb-4">✅ Import Results</h3>
                        <p className="text-green-700 mb-4">{importResults.message}</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          {/* Teams Results */}
                          <div className="bg-white rounded-lg p-4">
                            <h4 className="font-semibold text-purple-600 mb-2">Teams</h4>
                            <div className="text-sm space-y-1">
                              <p>Updated: <span className="font-medium">{importResults.stats.teams.updated}</span></p>
                              <p>Unchanged: <span className="font-medium">{importResults.stats.teams.unchanged}</span></p>
                              <p>Total: <span className="font-medium">{importResults.stats.teams.total}</span></p>
                            </div>
                            {importResults.stats.teams.errors.length > 0 && (
                              <div className="mt-2 text-xs text-red-600">
                                <p>Errors: {importResults.stats.teams.errors.length}</p>
                              </div>
                            )}
                          </div>

                          {/* Players Results */}
                          <div className="bg-white rounded-lg p-4">
                            <h4 className="font-semibold text-blue-600 mb-2">Players</h4>
                            <div className="text-sm space-y-1">
                              <p>Updated: <span className="font-medium">{importResults.stats.players.updated}</span></p>
                              <p>Unchanged: <span className="font-medium">{importResults.stats.players.unchanged}</span></p>
                              <p>Total: <span className="font-medium">{importResults.stats.players.total}</span></p>
                            </div>
                            {importResults.stats.players.errors.length > 0 && (
                              <div className="mt-2 text-xs text-red-600">
                                <p>Errors: {importResults.stats.players.errors.length}</p>
                              </div>
                            )}
                          </div>

                          {/* Awards Results */}
                          <div className="bg-white rounded-lg p-4">
                            <h4 className="font-semibold text-yellow-600 mb-2">Awards</h4>
                            <div className="text-sm space-y-1">
                              <p>Updated: <span className="font-medium">{importResults.stats.awards.updated}</span></p>
                              <p>Unchanged: <span className="font-medium">{importResults.stats.awards.unchanged}</span></p>
                              <p>Total: <span className="font-medium">{importResults.stats.awards.total}</span></p>
                            </div>
                            {importResults.stats.awards.errors.length > 0 && (
                              <div className="mt-2 text-xs text-red-600">
                                <p>Errors: {importResults.stats.awards.errors.length}</p>
                              </div>
                            )}
                          </div>

                          {/* Matches Results */}
                          <div className="bg-white rounded-lg p-4">
                            <h4 className="font-semibold text-orange-600 mb-2">Matches</h4>
                            <div className="text-sm space-y-1">
                              <p>Updated: <span className="font-medium">{importResults.stats.matches.updated}</span></p>
                              <p>Unchanged: <span className="font-medium">{importResults.stats.matches.unchanged}</span></p>
                              <p>Total: <span className="font-medium">{importResults.stats.matches.total}</span></p>
                            </div>
                            {importResults.stats.matches.errors.length > 0 && (
                              <div className="mt-2 text-xs text-red-600">
                                <p>Errors: {importResults.stats.matches.errors.length}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Error Details */}
                        {(importResults.stats.teams.errors.length > 0 || 
                          importResults.stats.players.errors.length > 0 || 
                          importResults.stats.awards.errors.length > 0 || 
                          importResults.stats.matches.errors.length > 0) && (
                          <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                            <h4 className="font-semibold text-red-800 mb-2">Import Errors:</h4>
                            <div className="text-sm text-red-700 space-y-1">
                              {[...importResults.stats.teams.errors, 
                                ...importResults.stats.players.errors,
                                ...importResults.stats.awards.errors, 
                                ...importResults.stats.matches.errors].map((error, index) => (
                                <p key={index}>• {error}</p>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <p className="text-sm text-green-600 mt-4 font-medium">
                          ℹ️ The page will refresh in 3 seconds to show updated data.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  // Preview Mode
                  <>
                    {/* Preview Header */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-bold text-gray-800">📋 Import Preview</h3>
                          <p className="text-sm text-gray-600">Review and edit data before importing</p>
                        </div>
                        <button
                          onClick={handleCancelPreview}
                          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
                        >
                          ← Back to Upload
                        </button>
                      </div>
                      
                      {/* Preview Summary */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="text-center bg-purple-50 p-3 rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">{previewTeams.length}</div>
                          <div className="text-xs text-purple-700">Teams</div>
                        </div>
                        <div className="text-center bg-blue-50 p-3 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">{previewPlayers.length}</div>
                          <div className="text-xs text-blue-700">Players</div>
                        </div>
                        <div className="text-center bg-yellow-50 p-3 rounded-lg">
                          <div className="text-2xl font-bold text-yellow-600">{previewAwards.length}</div>
                          <div className="text-xs text-yellow-700">Awards</div>
                        </div>
                        <div className="text-center bg-orange-50 p-3 rounded-lg">
                          <div className="text-2xl font-bold text-orange-600">{previewMatches.length}</div>
                          <div className="text-xs text-orange-700">Matches</div>
                        </div>
                      </div>
                    </div>

                    {/* Errors and Warnings */}
                    {previewData && (previewData.errors.length > 0 || previewData.warnings.length > 0) && (
                      <div className="space-y-4 mb-6">
                        {/* Errors */}
                        {previewData.errors.length > 0 && (
                          <div className="bg-red-50/50 rounded-xl p-4 border border-red-100">
                            <div className="flex items-center mb-2">
                              <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="text-sm font-semibold text-red-800">{previewData.errors.length} Error(s) Found</span>
                            </div>
                            <div className="space-y-1 text-xs text-red-700 max-h-32 overflow-y-auto">
                              {previewData.errors.map((error, index) => (
                                <div key={index} className="flex items-start">
                                  <span className="text-red-500 mr-2">•</span>
                                  <span>{error}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Warnings */}
                        {previewData.warnings.length > 0 && (
                          <div className="bg-yellow-50/50 rounded-xl p-4 border border-yellow-100">
                            <div className="flex items-center mb-2">
                              <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                              <span className="text-sm font-semibold text-yellow-800">{previewData.warnings.length} Warning(s)</span>
                            </div>
                            <div className="space-y-1 text-xs text-yellow-700 max-h-32 overflow-y-auto">
                              {previewData.warnings.map((warning, index) => (
                                <div key={index} className="flex items-start">
                                  <span className="text-yellow-500 mr-2">•</span>
                                  <span>{warning}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Validation Status */}
                    <div className={`rounded-xl p-4 mb-6 border ${
                      validationErrors.size > 0 
                        ? 'bg-red-50/50 border-red-100' 
                        : 'bg-blue-50/50 border-blue-100'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center">
                          <svg className={`w-5 h-5 mr-2 ${
                            validationErrors.size > 0 ? 'text-red-600' : 'text-blue-600'
                          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className={`text-sm ${
                            validationErrors.size > 0 ? 'text-red-800' : 'text-blue-800'
                          }`}>
                            {validationErrors.size > 0 
                              ? `${validationErrors.size} validation error(s) found. Please fix them before importing.`
                              : 'Click on any cell to edit data. Changes are automatically validated.'}
                          </span>
                        </div>
                        {validationErrors.size > 0 && (
                          <button
                            onClick={() => setShowValidationDetails(!showValidationDetails)}
                            className="text-xs text-red-600 hover:text-red-800 underline"
                          >
                            {showValidationDetails ? 'Hide' : 'Show'} Details
                          </button>
                        )}
                      </div>
                      {validationErrors.size > 0 && showValidationDetails && (
                        <div className="mt-4 pt-4 border-t border-red-200">
                          <h4 className="text-sm font-semibold text-red-800 mb-3">Validation Error Details:</h4>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {Array.from(validationErrors).map((errorKey, index) => {
                              const [type, indexStr, field] = errorKey.split('-');
                              const rowNum = parseInt(indexStr) + 1;
                              let errorMessage = '';
                              
                              if (type === 'team') {
                                errorMessage = `Team Row ${rowNum}: ${field.replace('_', ' ')} is required`;
                              } else if (type === 'player') {
                                if (field === 'total_matches') {
                                  const player = previewPlayers[parseInt(indexStr)];
                                  errorMessage = `Player Row ${rowNum} (${player?.name || 'Unknown'}): Win (${player?.win || 0}) + Draw (${player?.draw || 0}) + Loss (${player?.loss || 0}) = ${(player?.win || 0) + (player?.draw || 0) + (player?.loss || 0)} must equal Total Matches (${player?.total_matches || 0})`;
                                } else if (field === 'team') {
                                  errorMessage = `Player Row ${rowNum}: Team name "${previewPlayers[parseInt(indexStr)]?.team || ''}" must match an existing team`;
                                } else if (field === 'name') {
                                  errorMessage = `Player Row ${rowNum}: Player name is required`;
                                } else if (field === 'category') {
                                  errorMessage = `Player Row ${rowNum}: Category is required`;
                                } else if (['win', 'draw', 'loss'].includes(field)) {
                                  errorMessage = `Player Row ${rowNum}: ${field.charAt(0).toUpperCase() + field.slice(1)} cannot be negative`;
                                } else {
                                  errorMessage = `Player Row ${rowNum}: ${field.replace('_', ' ')} must be a valid number`;
                                }
                              } else if (type === 'award') {
                                errorMessage = `Award Row ${rowNum}: ${field.replace('_', ' ')} is required`;
                              } else if (type === 'match') {
                                errorMessage = `Match Row ${rowNum}: ${field.replace('_', ' ')} is required`;
                              } else {
                                errorMessage = errorKey;
                              }
                              
                              return (
                                <div key={index} className="flex items-start">
                                  <span className="text-red-500 mr-2 mt-0.5">•</span>
                                  <span className="text-xs text-red-700">{errorMessage}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Preview Tab Navigation */}
                    <div className="rounded-t-xl border-b-0 mb-0 bg-white/10 p-2">
                      <div className="flex gap-2 overflow-x-auto">
                        {[
                          { id: 'teams', name: `Teams (${previewTeams.length})`, icon: '🏆' },
                          { id: 'players', name: `Players (${previewPlayers.length})`, icon: '👤' },
                          { id: 'awards', name: `Awards (${previewAwards.length})`, icon: '🏅' },
                          { id: 'matches', name: `Matches (${previewMatches.length})`, icon: '⚽' },
                        ].map(tab => (
                          <button
                            key={tab.id}
                            onClick={() => setPreviewTab(tab.id as any)}
                            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                              previewTab === tab.id
                                ? 'bg-[#0066FF] text-white shadow-md'
                                : 'text-gray-600 hover:bg-white/30'
                            }`}
                          >
                            <span className="mr-2">{tab.icon}</span>
                            {tab.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Preview Tables */}
                    <div className="rounded-b-xl bg-white/20 border border-gray-200 overflow-hidden">
                      {/* Teams Preview Table */}
                      {previewTab === 'teams' && previewTeams.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="min-w-full">
                            <thead className="bg-white/10">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Team Name</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Owner Name</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white/20 divide-y divide-gray-200">
                              {previewTeams.map((team, index) => (
                                <tr key={index} className="hover:bg-white/30 transition-colors">
                                  <td className="px-4 py-3">
                                    <input
                                      type="text"
                                      value={team.team_name}
                                      onChange={(e) => handlePreviewTeamChange(index, 'team_name', e.target.value)}
                                      className={`w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                                        validationErrors.has(`team-${index}-team_name`) ? 'border-red-500 bg-red-50' : ''
                                      }`}
                                      placeholder="Team name"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <input
                                      type="text"
                                      value={team.owner_name || ''}
                                      onChange={(e) => handlePreviewTeamChange(index, 'owner_name', e.target.value)}
                                      className={`w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                                        validationErrors.has(`team-${index}-owner_name`) ? 'border-red-500 bg-red-50' : ''
                                      }`}
                                      placeholder="Owner name"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePreviewTeam(index)}
                                      className="text-red-600 hover:text-red-800 p-1"
                                      title="Remove from import"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Players Preview Table */}
                      {previewTab === 'players' && previewPlayers.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="min-w-full">
                            <thead className="bg-white/10">
                              <tr>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-600 uppercase">Name</th>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-600 uppercase">Team</th>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-600 uppercase">Category</th>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-600 uppercase">Goals</th>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-600 uppercase">G/Game</th>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-600 uppercase">Conceded</th>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-600 uppercase">C/Game</th>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-600 uppercase">Net Goals</th>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-600 uppercase">Clean</th>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-600 uppercase">Points</th>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-600 uppercase">W</th>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-600 uppercase">D</th>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-600 uppercase">L</th>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-600 uppercase">Total M</th>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-600 uppercase">Total P</th>
                                <th className="px-2 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white/20 divide-y divide-gray-200">
                              {previewPlayers.map((player, index) => (
                                <tr key={index} className="hover:bg-white/30 transition-colors">
                                  <td className="px-2 py-3">
                                    <input
                                      type="text"
                                      value={player.name}
                                      onChange={(e) => handlePreviewPlayerChange(index, 'name', e.target.value)}
                                      className={`w-20 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-1 py-1 text-xs ${
                                        validationErrors.has(`player-${index}-name`) ? 'border-red-500 bg-red-50' : ''
                                      }`}
                                      placeholder="Name"
                                    />
                                  </td>
                                  <td className="px-2 py-3">
                                    <input
                                      type="text"
                                      value={player.team}
                                      onChange={(e) => handlePreviewPlayerChange(index, 'team', e.target.value)}
                                      className={`w-20 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-1 py-1 text-xs ${
                                        validationErrors.has(`player-${index}-team`) ? 'border-red-500 bg-red-50' : ''
                                      }`}
                                      placeholder="Team"
                                    />
                                  </td>
                                  <td className="px-2 py-3">
                                    <input
                                      type="text"
                                      value={player.category}
                                      onChange={(e) => handlePreviewPlayerChange(index, 'category', e.target.value)}
                                      className={`w-20 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-1 py-1 text-xs ${
                                        validationErrors.has(`player-${index}-category`) ? 'border-red-500 bg-red-50' : ''
                                      }`}
                                      placeholder="Category"
                                    />
                                  </td>
                                  <td className="px-2 py-3">
                                    <input
                                      type="number"
                                      value={player.goals_scored}
                                      onChange={(e) => handlePreviewPlayerChange(index, 'goals_scored', parseFloat(e.target.value) || 0)}
                                      step="0.1"
                                      className={`w-16 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-1 py-1 text-xs ${
                                        validationErrors.has(`player-${index}-goals_scored`) ? 'border-red-500 bg-red-50' : ''
                                      }`}
                                    />
                                  </td>
                                  <td className="px-2 py-3">
                                    <input
                                      type="number"
                                      value={player.goals_per_game}
                                      onChange={(e) => handlePreviewPlayerChange(index, 'goals_per_game', parseFloat(e.target.value) || 0)}
                                      step="0.1"
                                      className={`w-16 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-1 py-1 text-xs ${
                                        validationErrors.has(`player-${index}-goals_per_game`) ? 'border-red-500 bg-red-50' : ''
                                      }`}
                                    />
                                  </td>
                                  <td className="px-2 py-3">
                                    <input
                                      type="number"
                                      value={player.goals_conceded}
                                      onChange={(e) => handlePreviewPlayerChange(index, 'goals_conceded', parseFloat(e.target.value) || 0)}
                                      step="0.1"
                                      className={`w-16 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-1 py-1 text-xs ${
                                        validationErrors.has(`player-${index}-goals_conceded`) ? 'border-red-500 bg-red-50' : ''
                                      }`}
                                    />
                                  </td>
                                  <td className="px-2 py-3">
                                    <input
                                      type="number"
                                      value={player.conceded_per_game}
                                      onChange={(e) => handlePreviewPlayerChange(index, 'conceded_per_game', parseFloat(e.target.value) || 0)}
                                      step="0.1"
                                      className={`w-16 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-1 py-1 text-xs ${
                                        validationErrors.has(`player-${index}-conceded_per_game`) ? 'border-red-500 bg-red-50' : ''
                                      }`}
                                    />
                                  </td>
                                  <td className="px-2 py-3">
                                    <input
                                      type="number"
                                      value={player.net_goals}
                                      onChange={(e) => handlePreviewPlayerChange(index, 'net_goals', parseFloat(e.target.value) || 0)}
                                      step="0.1"
                                      className={`w-16 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-1 py-1 text-xs ${
                                        validationErrors.has(`player-${index}-net_goals`) ? 'border-red-500 bg-red-50' : ''
                                      }`}
                                    />
                                  </td>
                                  <td className="px-2 py-3">
                                    <input
                                      type="number"
                                      value={player.cleansheets}
                                      onChange={(e) => handlePreviewPlayerChange(index, 'cleansheets', parseFloat(e.target.value) || 0)}
                                      step="0.1"
                                      className={`w-16 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-1 py-1 text-xs ${
                                        validationErrors.has(`player-${index}-cleansheets`) ? 'border-red-500 bg-red-50' : ''
                                      }`}
                                    />
                                  </td>
                                  <td className="px-2 py-3">
                                    <input
                                      type="number"
                                      value={player.points}
                                      onChange={(e) => handlePreviewPlayerChange(index, 'points', parseFloat(e.target.value) || 0)}
                                      step="0.1"
                                      className={`w-16 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-1 py-1 text-xs ${
                                        validationErrors.has(`player-${index}-points`) ? 'border-red-500 bg-red-50' : ''
                                      }`}
                                    />
                                  </td>
                                  <td className="px-2 py-3">
                                    <input
                                      type="number"
                                      value={player.win}
                                      onChange={(e) => handlePreviewPlayerChange(index, 'win', parseInt(e.target.value) || 0)}
                                      className={`w-14 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-1 py-1 text-xs ${
                                        validationErrors.has(`player-${index}-win`) ? 'border-red-500 bg-red-50' : ''
                                      }`}
                                    />
                                  </td>
                                  <td className="px-2 py-3">
                                    <input
                                      type="number"
                                      value={player.draw}
                                      onChange={(e) => handlePreviewPlayerChange(index, 'draw', parseInt(e.target.value) || 0)}
                                      className={`w-14 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-1 py-1 text-xs ${
                                        validationErrors.has(`player-${index}-draw`) ? 'border-red-500 bg-red-50' : ''
                                      }`}
                                    />
                                  </td>
                                  <td className="px-2 py-3">
                                    <input
                                      type="number"
                                      value={player.loss}
                                      onChange={(e) => handlePreviewPlayerChange(index, 'loss', parseInt(e.target.value) || 0)}
                                      className={`w-14 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-1 py-1 text-xs ${
                                        validationErrors.has(`player-${index}-loss`) ? 'border-red-500 bg-red-50' : ''
                                      }`}
                                    />
                                  </td>
                                  <td className="px-2 py-3">
                                    <input
                                      type="number"
                                      value={player.total_matches}
                                      onChange={(e) => handlePreviewPlayerChange(index, 'total_matches', parseInt(e.target.value) || 0)}
                                      className={`w-16 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-1 py-1 text-xs ${
                                        validationErrors.has(`player-${index}-total_matches`) ? 'border-red-500 bg-red-50' : ''
                                      }`}
                                    />
                                  </td>
                                  <td className="px-2 py-3">
                                    <input
                                      type="number"
                                      value={player.total_points}
                                      onChange={(e) => handlePreviewPlayerChange(index, 'total_points', parseFloat(e.target.value) || 0)}
                                      step="0.1"
                                      className={`w-16 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-1 py-1 text-xs ${
                                        validationErrors.has(`player-${index}-total_points`) ? 'border-red-500 bg-red-50' : ''
                                      }`}
                                    />
                                  </td>
                                  <td className="px-2 py-3">
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePreviewPlayer(index)}
                                      className="text-red-600 hover:text-red-800 p-1"
                                      title="Remove from import"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Awards Preview Table */}
                      {previewTab === 'awards' && previewAwards.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="min-w-full">
                            <thead className="bg-white/10">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Award Name</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Category</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Winner Team</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Winner Player</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Description</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white/20 divide-y divide-gray-200">
                              {previewAwards.map((award, index) => (
                                <tr key={index} className="hover:bg-white/30 transition-colors">
                                  <td className="px-4 py-3">
                                    <input
                                      type="text"
                                      value={award.award_name}
                                      onChange={(e) => handlePreviewAwardChange(index, 'award_name', e.target.value)}
                                      className={`w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                                        validationErrors.has(`award-${index}-award_name`) ? 'border-red-500 bg-red-50' : ''
                                      }`}
                                      placeholder="Award name"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <input
                                      type="text"
                                      value={award.award_category}
                                      onChange={(e) => handlePreviewAwardChange(index, 'award_category', e.target.value)}
                                      className={`w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                                        validationErrors.has(`award-${index}-award_category`) ? 'border-red-500 bg-red-50' : ''
                                      }`}
                                      placeholder="Category"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <input
                                      type="text"
                                      value={award.winner_team || ''}
                                      onChange={(e) => handlePreviewAwardChange(index, 'winner_team', e.target.value)}
                                      className={`w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                                        validationErrors.has(`award-${index}-winner_team`) ? 'border-red-500 bg-red-50' : ''
                                      }`}
                                      placeholder="Winner team"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <input
                                      type="text"
                                      value={award.winner_player || ''}
                                      onChange={(e) => handlePreviewAwardChange(index, 'winner_player', e.target.value)}
                                      className="w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1"
                                      placeholder="Winner player"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <input
                                      type="text"
                                      value={award.description || ''}
                                      onChange={(e) => handlePreviewAwardChange(index, 'description', e.target.value)}
                                      className="w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1"
                                      placeholder="Description"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePreviewAward(index)}
                                      className="text-red-600 hover:text-red-800 p-1"
                                      title="Remove from import"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Matches Preview Table */}
                      {previewTab === 'matches' && previewMatches.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="min-w-full">
                            <thead className="bg-white/10">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Match Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Home Team</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Away Team</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Home Score</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Away Score</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Match Type</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white/20 divide-y divide-gray-200">
                              {previewMatches.map((match, index) => (
                                <tr key={index} className="hover:bg-white/30 transition-colors">
                                  <td className="px-4 py-3">
                                    <input
                                      type="text"
                                      value={match.match_date}
                                      onChange={(e) => handlePreviewMatchChange(index, 'match_date', e.target.value)}
                                      className={`w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                                        validationErrors.has(`match-${index}-match_date`) ? 'border-red-500 bg-red-50' : ''
                                      }`}
                                      placeholder="Match date"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <input
                                      type="text"
                                      value={match.home_team}
                                      onChange={(e) => handlePreviewMatchChange(index, 'home_team', e.target.value)}
                                      className={`w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                                        validationErrors.has(`match-${index}-home_team`) ? 'border-red-500 bg-red-50' : ''
                                      }`}
                                      placeholder="Home team"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <input
                                      type="text"
                                      value={match.away_team}
                                      onChange={(e) => handlePreviewMatchChange(index, 'away_team', e.target.value)}
                                      className={`w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                                        validationErrors.has(`match-${index}-away_team`) ? 'border-red-500 bg-red-50' : ''
                                      }`}
                                      placeholder="Away team"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <input
                                      type="number"
                                      value={match.home_score}
                                      onChange={(e) => handlePreviewMatchChange(index, 'home_score', parseInt(e.target.value) || 0)}
                                      className={`w-20 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                                        validationErrors.has(`match-${index}-home_score`) ? 'border-red-500 bg-red-50' : ''
                                      }`}
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <input
                                      type="number"
                                      value={match.away_score}
                                      onChange={(e) => handlePreviewMatchChange(index, 'away_score', parseInt(e.target.value) || 0)}
                                      className={`w-20 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                                        validationErrors.has(`match-${index}-away_score`) ? 'border-red-500 bg-red-50' : ''
                                      }`}
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <input
                                      type="text"
                                      value={match.match_type || ''}
                                      onChange={(e) => handlePreviewMatchChange(index, 'match_type', e.target.value)}
                                      className="w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1"
                                      placeholder="Match type"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePreviewMatch(index)}
                                      className="text-red-600 hover:text-red-800 p-1"
                                      title="Remove from import"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Empty State */}
                      {((previewTab === 'teams' && previewTeams.length === 0) ||
                        (previewTab === 'players' && previewPlayers.length === 0) ||
                        (previewTab === 'awards' && previewAwards.length === 0) ||
                        (previewTab === 'matches' && previewMatches.length === 0)) && (
                        <div className="px-8 py-16 text-center">
                          <p className="text-gray-500">No {previewTab} data found in the uploaded file.</p>
                        </div>
                      )}
                    </div>

                    {/* Import Actions */}
                    <div className="mt-6 bg-white/10 rounded-xl p-6 border border-gray-200">
                      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-800 mb-1">Ready to Import</h3>
                          <p className="text-sm text-gray-600">Review your changes and start the import process</p>
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={validatePreviewData}
                            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Validate All
                          </button>
                          <button
                            onClick={handleFinalImport}
                            disabled={importing || validationErrors.size > 0}
                            className="inline-flex items-center px-6 py-2 bg-gradient-to-r from-[#0066FF] to-[#0066FF]/80 hover:from-[#0066FF]/90 hover:to-[#0066FF]/70 text-white text-sm font-medium rounded-lg transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {importing ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Importing...
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                                </svg>
                                Start Import
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
