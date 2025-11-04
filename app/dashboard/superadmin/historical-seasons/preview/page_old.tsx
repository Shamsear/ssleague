'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface TeamData {
  team_name: string;
  team_code?: string;
  owner_name: string;
  owner_email?: string;
  initial_balance?: string;
}

interface PlayerData {
  name: string;
  player_name: string;
  team: string;
  team_name?: string;
  category: string;
  position?: string;
  overall_rating?: number;
  is_sold?: boolean;
  base_price?: number;
  final_price?: number;
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

interface SeasonUploadData {
  seasonInfo: {
    name: string;
    shortName: string;
    fileName: string;
    fileSize: number;
    fileType: string;
  };
  teams: TeamData[];
  players: PlayerData[];
  errors: string[];
  warnings: string[];
  summary: {
    teamsCount: number;
    playersCount: number;
    errorsCount: number;
    warningsCount: number;
  };
}

export default function PreviewHistoricalSeason() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  // State for uploaded data
  const [uploadData, setUploadData] = useState<SeasonUploadData | null>(null);
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [players, setPlayers] = useState<PlayerData[]>([]);
  
  const [activeTab, setActiveTab] = useState<'teams' | 'players'>('teams');
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [showWarnings, setShowWarnings] = useState(false);

  // Position options for player select dropdown
  const positions = ['GK', 'DEF', 'MID', 'FWD'];

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Load uploaded data from localStorage
  useEffect(() => {
    const savedData = localStorage.getItem('seasonUploadData');
    if (savedData) {
      try {
        const data: SeasonUploadData = JSON.parse(savedData);
        setUploadData(data);
        setTeams(data.teams);
        setPlayers(data.players);
        
        // Set initial active tab based on available data
        if (data.teams.length > 0) setActiveTab('teams');
        else if (data.players.length > 0) setActiveTab('players');
      } catch (error) {
        console.error('Error parsing upload data:', error);
        alert('Error loading upload data. Please try uploading again.');
        router.push('/dashboard/superadmin/historical-seasons/import');
      }
    } else {
      alert('No upload data found. Please upload a file first.');
      router.push('/dashboard/superadmin/historical-seasons/import');
    }
  }, [router]);

  const handleRemoveTeam = (index: number) => {
    if (confirm('Remove this team from the import?')) {
      setTeams(teams.filter((_, i) => i !== index));
    }
  };

  const handleRemovePlayer = (index: number) => {
    if (confirm('Remove this player from the import?')) {
      setPlayers(players.filter((_, i) => i !== index));
    }
  };

  const handleTeamChange = (index: number, field: keyof TeamData, value: string) => {
    const newTeams = [...teams];
    newTeams[index][field] = value;
    setTeams(newTeams);
  };

  const handlePlayerChange = (index: number, field: keyof PlayerData, value: any) => {
    const newPlayers = [...players];
    if (field === 'goals_scored' || field === 'goals_per_game' || field === 'goals_conceded' || 
        field === 'conceded_per_game' || field === 'net_goals' || field === 'cleansheets' || 
        field === 'points' || field === 'win' || field === 'draw' || field === 'loss' || 
        field === 'total_matches' || field === 'total_points') {
      (newPlayers[index][field] as any) = typeof value === 'string' ? (parseFloat(value) || 0) : value;
    } else {
      (newPlayers[index][field] as any) = value;
    }
    setPlayers(newPlayers);
  };

  const validateAll = () => {
    const errors = new Set<string>();
    
    // Get team names for cross-referential validation
    const teamNames = new Set(teams.map(team => team.team_name.trim().toLowerCase()));
    const playerNames = new Set(players.map(player => player.player_name.trim().toLowerCase()));
    
    // Basic team validation
    teams.forEach((team, index) => {
      if (!team.team_name.trim()) errors.add(`team-${index}-team_name`);
      if (team.team_code && !team.team_code.trim()) errors.add(`team-${index}-team_code`);
      
      // Check for duplicate team names
      const duplicateTeamIndex = teams.findIndex((t, i) => 
        i !== index && t.team_name.trim().toLowerCase() === team.team_name.trim().toLowerCase()
      );
      if (duplicateTeamIndex !== -1) {
        errors.add(`team-${index}-team_name`);
      }
      
      // Check for duplicate team codes
      if (team.team_code) {
        const duplicateCodeIndex = teams.findIndex((t, i) => 
          i !== index && t.team_code && t.team_code.trim().toLowerCase() === team.team_code!.trim().toLowerCase()
        );
        if (duplicateCodeIndex !== -1) {
          errors.add(`team-${index}-team_code`);
        }
      }
    });
    
    // Basic player validation with cross-referential checks
    players.forEach((player, index) => {
      if (!player.player_name.trim()) errors.add(`player-${index}-player_name`);
      if (player.position && !player.position) errors.add(`player-${index}-position`);
      if (player.overall_rating && (player.overall_rating < 1 || player.overall_rating > 99)) errors.add(`player-${index}-overall_rating`);
      
      // Check for duplicate player names
      const duplicatePlayerIndex = players.findIndex((p, i) => 
        i !== index && p.player_name.trim().toLowerCase() === player.player_name.trim().toLowerCase()
      );
      if (duplicatePlayerIndex !== -1) {
        errors.add(`player-${index}-player_name`);
      }
      
      // Cross-referential validation: player team must exist in teams list
      if (player.team_name && player.team_name.trim()) {
        if (!teamNames.has(player.team_name.trim().toLowerCase())) {
          errors.add(`player-${index}-team_name`);
        }
      }
      
      // Sold player must have a team and final price
      if (player.is_sold) {
        if (!player.team_name || !player.team_name.trim()) {
          errors.add(`player-${index}-team_name`);
        }
        if (!player.final_price || player.final_price <= 0) {
          errors.add(`player-${index}-final_price`);
        }
      }
    });
    
    // Basic award validation with cross-referential checks
    // awards.forEach((award, index) => {
    //   if (!award.award_name.trim()) errors.add(`award-${index}-award_name`);
    //   if (!award.award_category.trim()) errors.add(`award-${index}-award_category`);
    //   
    //   // Cross-referential validation: winner team must exist
    //   if (award.winner_team && award.winner_team.trim()) {
    //     if (!teamNames.has(award.winner_team.trim().toLowerCase())) {
    //       errors.add(`award-${index}-winner_team`);
    //     }
    //   }
    //   
    //   // Cross-referential validation: winner player must exist
    //   if (award.winner_player && award.winner_player.trim()) {
    //     if (!playerNames.has(award.winner_player.trim().toLowerCase())) {
    //       errors.add(`award-${index}-winner_player`);
    //     }
    //   }
    // });
    
    // Basic match validation with cross-referential checks
    // matches.forEach((match, index) => {
    //   if (!match.match_date.trim()) errors.add(`match-${index}-match_date`);
    //   if (!match.home_team.trim()) errors.add(`match-${index}-home_team`);
    //   if (!match.away_team.trim()) errors.add(`match-${index}-away_team`);
    //   if (match.home_score < 0) errors.add(`match-${index}-home_score`);
    //   if (match.away_score < 0) errors.add(`match-${index}-away_score`);
    //   
    //   // Cross-referential validation: teams must exist
    //   if (!teamNames.has(match.home_team.trim().toLowerCase())) {
    //     errors.add(`match-${index}-home_team`);
    //   }
    //   if (!teamNames.has(match.away_team.trim().toLowerCase())) {
    //     errors.add(`match-${index}-away_team`);
    //   }
    //   
    //   // Teams cannot play against themselves
    //   if (match.home_team.trim().toLowerCase() === match.away_team.trim().toLowerCase()) {
    //     errors.add(`match-${index}-home_team`);
    //     errors.add(`match-${index}-away_team`);
    //   }
    //   
    //   // Basic date validation (should be a valid date)
    //   const matchDate = new Date(match.match_date);
    //   if (isNaN(matchDate.getTime())) {
    //     errors.add(`match-${index}-match_date`);
    //   }
    // });
    
    setValidationErrors(errors);
    return errors.size === 0;
  };

  const handleStartImport = async () => {
    if (!validateAll()) {
      alert('Please fix all validation errors before importing.');
      return;
    }
    
    if (teams.length === 0 && players.length === 0) {
      alert('No data to import.');
      return;
    }
    
    if (!uploadData) {
      alert('No upload data found. Please try uploading again.');
      return;
    }
    
    setImporting(true);
    
    try {
      // Prepare the data for import
      const importData = {
        seasonInfo: uploadData.seasonInfo,
        teams: teams,
        players: players,
        // awards: awards,
        // matches: matches
      };
      
      const response = await fetchWithTokenRefresh(/api/seasons/historical/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(importData),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Import failed');
      }
      
      if (!result.success) {
        throw new Error(result.error || 'Import failed');
      }
      
      // Clear the upload data from localStorage
      localStorage.removeItem('seasonUploadData');
      
      // Redirect to import progress page with real import ID
      router.push(`/dashboard/superadmin/historical-seasons/import-progress?id=${result.importId}`);
      
    } catch (error: any) {
      console.error('Import error:', error);
      alert(`Import failed: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'super_admin') {
    return null;
  }

  return (
    <div className="min-h-screen py-4 sm:py-8 px-4">
      <div className="container mx-auto max-w-screen-xl">
        {/* Page Header */}
        <div className="glass rounded-3xl p-6 mb-8 shadow-lg backdrop-blur-md border border-white/20">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">🏆 Season Import Preview</h1>
              <p className="text-gray-600 text-sm md:text-base">Review and edit season data before importing</p>
              {uploadData && (
                <div className="mt-2 text-sm space-y-1">
                  <div>
                    <span className="font-semibold text-[#0066FF]">{uploadData.seasonInfo.name}</span>
                    <span className="mx-2 text-gray-400">•</span>
                    <span className="text-gray-600">{uploadData.seasonInfo.shortName}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    📄 {uploadData.seasonInfo.fileName} ({(uploadData.seasonInfo.fileSize / 1024).toFixed(1)} KB)
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center">
              <button
                onClick={() => router.push('/dashboard/superadmin/historical-seasons/import')}
                className="inline-flex items-center px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Upload
              </button>
            </div>
          </div>
        </div>

        {/* Import Summary */}
        <div className="glass rounded-3xl p-6 mb-8 shadow-lg backdrop-blur-md border border-white/20">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">{teams.length}</div>
              <div className="text-sm text-gray-600">Teams</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{players.length}</div>
              <div className="text-sm text-gray-600">Players</div>
            </div>
            {/* <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{awards.length}</div>
              <div className="text-sm text-gray-600">Awards</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">{matches.length}</div>
              <div className="text-sm text-gray-600">Matches</div>
            </div> */}
            <div className="text-center">
              <div className="text-3xl font-bold text-[#0066FF]">{teams.length + players.length}</div>
              <div className="text-sm text-gray-600">Total Items</div>
            </div>
          </div>
        </div>

        {/* Errors and Warnings */}
        {uploadData && (uploadData.errors.length > 0 || uploadData.warnings.length > 0) && (
          <div className="space-y-4 mb-6">
            {/* Errors */}
            {uploadData.errors.length > 0 && (
              <div className="glass rounded-3xl p-4 shadow-lg backdrop-blur-md border border-white/20 bg-red-50/30">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-semibold text-red-800">{uploadData.errors.length} Error(s) Found</span>
                  </div>
                  <button 
                    onClick={() => setShowErrors(!showErrors)}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    {showErrors ? 'Hide' : 'Show'} Details
                  </button>
                </div>
                {showErrors && (
                  <div className="space-y-1 text-xs text-red-700 max-h-32 overflow-y-auto">
                    {uploadData.errors.map((error, index) => (
                      <div key={index} className="flex items-start">
                        <span className="text-red-500 mr-2">•</span>
                        <span>{error}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Warnings */}
            {uploadData.warnings.length > 0 && (
              <div className="glass rounded-3xl p-4 shadow-lg backdrop-blur-md border border-white/20 bg-yellow-50/30">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span className="text-sm font-semibold text-yellow-800">{uploadData.warnings.length} Warning(s)</span>
                  </div>
                  <button 
                    onClick={() => setShowWarnings(!showWarnings)}
                    className="text-xs text-yellow-600 hover:text-yellow-800"
                  >
                    {showWarnings ? 'Hide' : 'Show'} Details
                  </button>
                </div>
                {showWarnings && (
                  <div className="space-y-1 text-xs text-yellow-700 max-h-32 overflow-y-auto">
                    {uploadData.warnings.map((warning, index) => (
                      <div key={index} className="flex items-start">
                        <span className="text-yellow-500 mr-2">•</span>
                        <span>{warning}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Validation Status */}
        <div className={`glass rounded-3xl p-4 mb-6 shadow-lg backdrop-blur-md border border-white/20 ${validationErrors.size > 0 ? 'bg-red-50/30' : 'bg-blue-50/30'}`}>
          <div className="flex items-center">
            <svg className={`w-5 h-5 mr-2 ${validationErrors.size > 0 ? 'text-red-600' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className={`text-sm ${validationErrors.size > 0 ? 'text-red-800' : 'text-blue-800'}`}>
              {validationErrors.size > 0 
                ? `${validationErrors.size} validation error(s) found. Please fix them before importing.`
                : 'Click on any cell to edit data. Changes are automatically validated.'}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="glass rounded-t-3xl p-2 shadow-lg backdrop-blur-md border border-white/20 border-b-0">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('teams')}
              className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'teams'
                  ? 'bg-gradient-to-r from-[#0066FF] to-[#0066FF]/80 text-white shadow-md'
                  : 'text-gray-600 hover:bg-white/30'
              }`}
            >
              <div className="flex items-center justify-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Teams ({teams.length})
              </div>
            </button>
            <button
              onClick={() => setActiveTab('players')}
              className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'players'
                  ? 'bg-gradient-to-r from-[#0066FF] to-[#0066FF]/80 text-white shadow-md'
                  : 'text-gray-600 hover:bg-white/30'
              }`}
            >
              <div className="flex items-center justify-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Players ({players.length})
              </div>
            </button>
            {/* <button
              onClick={() => setActiveTab('awards')}
              className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === 'awards'
                  ? 'bg-gradient-to-r from-[#0066FF] to-[#0066FF]/80 text-white shadow-md'
                  : 'text-gray-600 hover:bg-white/30'
              }`}
            >
              <div className="flex items-center justify-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                Awards ({awards.length})
              </div>
            </button>
            {matches.length > 0 && (
              <button
                onClick={() => setActiveTab('matches')}
                className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  activeTab === 'matches'
                    ? 'bg-gradient-to-r from-[#0066FF] to-[#0066FF]/80 text-white shadow-md'
                    : 'text-gray-600 hover:bg-white/30'
                }`}
              >
                <div className="flex items-center justify-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Matches ({matches.length})
                </div>
              </button>
            )} */}
          </div>
        </div>

        {/* Data Tables */}
        <div className="glass rounded-b-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden mb-8">
          {/* Teams Table */}
          {activeTab === 'teams' && teams.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-white/10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Team Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Team Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Owner Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Owner Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Initial Balance</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white/20 divide-y divide-gray-200">
                  {teams.map((team, index) => (
                    <tr key={index} className="hover:bg-white/30 transition-colors">
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={team.team_name}
                          onChange={(e) => handleTeamChange(index, 'team_name', e.target.value)}
                          className={`w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`team-${index}-team_name`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                          placeholder="Team name"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={team.team_code}
                          onChange={(e) => handleTeamChange(index, 'team_code', e.target.value)}
                          className={`w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`team-${index}-team_code`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                          placeholder="Code"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={team.owner_name || ''}
                          onChange={(e) => handleTeamChange(index, 'owner_name', e.target.value)}
                          className="w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1"
                          placeholder="Optional"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="email"
                          value={team.owner_email || ''}
                          onChange={(e) => handleTeamChange(index, 'owner_email', e.target.value)}
                          className="w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1"
                          placeholder="Optional"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={team.initial_balance || ''}
                          onChange={(e) => handleTeamChange(index, 'initial_balance', e.target.value)}
                          className="w-28 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1"
                          placeholder="Optional"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleRemoveTeam(index)}
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

          {/* Players Table */}
          {activeTab === 'players' && players.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-white/10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Player Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Position</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Rating</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Team</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Base Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Final Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Sold</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white/20 divide-y divide-gray-200">
                  {players.map((player, index) => (
                    <tr key={index} className="hover:bg-white/30 transition-colors">
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={player.player_name}
                          onChange={(e) => handlePlayerChange(index, 'player_name', e.target.value)}
                          className={`w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`player-${index}-player_name`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                          placeholder="Player name"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={player.position}
                          onChange={(e) => handlePlayerChange(index, 'position', e.target.value)}
                          className={`w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`player-${index}-position`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        >
                          {positions.map(pos => (
                            <option key={pos} value={pos}>{pos}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={player.overall_rating}
                          onChange={(e) => handlePlayerChange(index, 'overall_rating', e.target.value)}
                          min="1"
                          max="99"
                          className={`w-20 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`player-${index}-overall_rating`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={player.team_name || ''}
                          onChange={(e) => handlePlayerChange(index, 'team_name', e.target.value)}
                          className={`w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`player-${index}-team_name`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                          placeholder="Team name (empty if unsold)"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={player.base_price || ''}
                          onChange={(e) => handlePlayerChange(index, 'base_price', e.target.value)}
                          className="w-28 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1"
                          placeholder="Optional"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={player.final_price || ''}
                          onChange={(e) => handlePlayerChange(index, 'final_price', e.target.value)}
                          className={`w-28 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`player-${index}-final_price`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                          placeholder="If sold"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={player.is_sold || false}
                          onChange={(e) => handlePlayerChange(index, 'is_sold', e.target.checked)}
                          className="w-4 h-4 text-[#0066FF] bg-gray-100 border-gray-300 rounded focus:ring-[#0066FF] focus:ring-2"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleRemovePlayer(index)}
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

          {/* Awards Table */}
          {/* {activeTab === 'awards' && awards.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-white/10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Award Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Winner Team</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Winner Player</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white/20 divide-y divide-gray-200">
                  {awards.map((award, index) => (
                    <tr key={index} className="hover:bg-white/30 transition-colors">
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={award.award_name}
                          onChange={(e) => handleAwardChange(index, 'award_name', e.target.value)}
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
                          onChange={(e) => handleAwardChange(index, 'award_category', e.target.value)}
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
                          onChange={(e) => handleAwardChange(index, 'winner_team', e.target.value)}
                          className="w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1"
                          placeholder="Optional"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={award.winner_player || ''}
                          onChange={(e) => handleAwardChange(index, 'winner_player', e.target.value)}
                          className="w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1"
                          placeholder="Optional"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleRemoveAward(index)}
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
          )} */}

          {/* Matches Table */}
          {/* {activeTab === 'matches' && matches.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-white/10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Match Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Home Team</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Away Team</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Score</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Match Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white/20 divide-y divide-gray-200">
                  {matches.map((match, index) => (
                    <tr key={index} className="hover:bg-white/30 transition-colors">
                      <td className="px-4 py-3">
                        <input
                          type="date"
                          value={match.match_date}
                          onChange={(e) => handleMatchChange(index, 'match_date', e.target.value)}
                          className={`w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`match-${index}-match_date`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={match.home_team}
                          onChange={(e) => handleMatchChange(index, 'home_team', e.target.value)}
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
                          onChange={(e) => handleMatchChange(index, 'away_team', e.target.value)}
                          className={`w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`match-${index}-away_team`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                          placeholder="Away team"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-1">
                          <input
                            type="number"
                            value={match.home_score}
                            onChange={(e) => handleMatchChange(index, 'home_score', parseInt(e.target.value) || 0)}
                            min="0"
                            className={`w-12 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 text-center ${
                              validationErrors.has(`match-${index}-home_score`) ? 'border-red-500 bg-red-50' : ''
                            }`}
                          />
                          <span className="text-gray-500">-</span>
                          <input
                            type="number"
                            value={match.away_score}
                            onChange={(e) => handleMatchChange(index, 'away_score', parseInt(e.target.value) || 0)}
                            min="0"
                            className={`w-12 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 text-center ${
                              validationErrors.has(`match-${index}-away_score`) ? 'border-red-500 bg-red-50' : ''
                            }`}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={match.match_type || ''}
                          onChange={(e) => handleMatchChange(index, 'match_type', e.target.value)}
                          className="w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1"
                          placeholder="Optional"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleRemoveMatch(index)}
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
          )} */}

          {/* Empty State */}
          {((activeTab === 'teams' && teams.length === 0) ||
            (activeTab === 'players' && players.length === 0)
            // (activeTab === 'awards' && awards.length === 0) ||
            // (activeTab === 'matches' && matches.length === 0)
          ) && (
            <div className="px-8 py-16 text-center">
              <p className="text-gray-500">No {activeTab} data found in the uploaded file.</p>
            </div>
          )}
        </div>

        {/* Import Actions */}
        <div className="glass rounded-3xl p-6 shadow-lg backdrop-blur-md border border-white/20">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-1">Ready to Import</h3>
              <p className="text-sm text-gray-600">Review your changes and start the import process</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={validateAll}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Validate All
              </button>
              <button
                onClick={handleStartImport}
                disabled={importing || validationErrors.size > 0}
                className="inline-flex items-center px-6 py-2 bg-gradient-to-r from-[#0066FF] to-[#0066FF]/80 hover:from-[#0066FF]/90 hover:to-[#0066FF]/70 text-white text-sm font-medium rounded-lg transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Preparing Import...
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
      </div>
    </div>
  );
}
