'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface TeamData {
  team_name: string;
  owner_name: string;
}

interface PlayerData {
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
  const [showValidationDetails, setShowValidationDetails] = useState(false);

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
        
        // Auto-run validation to show initial errors
        setTimeout(() => {
          const hasNoErrors = validateAll();
          if (!hasNoErrors) {
            setShowValidationDetails(true); // Show errors if validation failed
          }
        }, 100);
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
      newPlayers[index][field] = typeof value === 'string' ? (parseFloat(value) || 0) : value;
    } else {
      newPlayers[index][field] = value;
    }
    setPlayers(newPlayers);
  };

  const validateAll = () => {
    const errors = new Set<string>();
    
    // Get team names for cross-referential validation
    const teamNames = new Set(teams.map(team => team.team_name.trim().toLowerCase()));
    
    // Basic team validation
    teams.forEach((team, index) => {
      if (!team.team_name.trim()) errors.add(`team-${index}-team_name`);
      if (!team.owner_name.trim()) errors.add(`team-${index}-owner_name`);
      
      // Check for duplicate team names
      const duplicateTeamIndex = teams.findIndex((t, i) => 
        i !== index && t.team_name.trim().toLowerCase() === team.team_name.trim().toLowerCase()
      );
      if (duplicateTeamIndex !== -1) {
        errors.add(`team-${index}-team_name`);
      }
    });
    
    // Basic player validation with cross-referential checks
    players.forEach((player, index) => {
      if (!player.name.trim()) errors.add(`player-${index}-name`);
      if (!player.team.trim()) errors.add(`player-${index}-team`);
      if (!player.category.trim()) errors.add(`player-${index}-category`);
      
      // Validate numeric fields (check for valid numbers, negative values are allowed)
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
      
      // Special validation: match-related fields should be non-negative
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
      const duplicatePlayerIndex = players.findIndex((p, i) => 
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
        players: players
      };
      
      const response = await fetch('/api/seasons/historical/import', {
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">{teams.length}</div>
              <div className="text-sm text-gray-600">Teams</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{players.length}</div>
              <div className="text-sm text-gray-600">Players</div>
            </div>
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
          <div className="flex items-start justify-between">
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
                      const player = players[parseInt(indexStr)];
                      errorMessage = `Player Row ${rowNum} (${player?.name || 'Unknown'}): Win (${player?.win || 0}) + Draw (${player?.draw || 0}) + Loss (${player?.loss || 0}) = ${(player?.win || 0) + (player?.draw || 0) + (player?.loss || 0)} must equal Total Matches (${player?.total_matches || 0})`;
                    } else if (field === 'team') {
                      errorMessage = `Player Row ${rowNum}: Team name "${players[parseInt(indexStr)]?.team || ''}" must match an existing team`;
                    } else if (field === 'name') {
                      errorMessage = `Player Row ${rowNum}: Player name is required`;
                    } else if (field === 'category') {
                      errorMessage = `Player Row ${rowNum}: Category is required`;
                    } else if (['win', 'draw', 'loss'].includes(field)) {
                      errorMessage = `Player Row ${rowNum}: ${field.charAt(0).toUpperCase() + field.slice(1)} cannot be negative (match results must be non-negative)`;
                    } else if (field === 'total_matches') {
                      errorMessage = `Player Row ${rowNum}: Total matches cannot be negative`;
                    } else {
                      errorMessage = `Player Row ${rowNum}: ${field.replace('_', ' ')} must be a valid number (negative values allowed for most fields)`;
                    }
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Owner Name</th>
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
                          value={team.owner_name || ''}
                          onChange={(e) => handleTeamChange(index, 'owner_name', e.target.value)}
                          className={`w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`team-${index}-owner_name`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                          placeholder="Owner name"
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Team</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Goals</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">G/Game</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Conceded</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">C/Game</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Net Goals</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Clean</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Points</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">W</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">D</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">L</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Total M</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Total P</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white/20 divide-y divide-gray-200">
                  {players.map((player, index) => (
                    <tr key={index} className="hover:bg-white/30 transition-colors">
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={player.name}
                          onChange={(e) => handlePlayerChange(index, 'name', e.target.value)}
                          className={`w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`player-${index}-name`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                          placeholder="Player name"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={player.team}
                          onChange={(e) => handlePlayerChange(index, 'team', e.target.value)}
                          className={`w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`player-${index}-team`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                          placeholder="Team"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={player.category}
                          onChange={(e) => handlePlayerChange(index, 'category', e.target.value)}
                          className={`w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`player-${index}-category`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                          placeholder="Category"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={player.goals_scored}
                          onChange={(e) => handlePlayerChange(index, 'goals_scored', parseFloat(e.target.value) || 0)}
                          step="0.1"
                          className={`w-20 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`player-${index}-goals_scored`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={player.goals_per_game}
                          onChange={(e) => handlePlayerChange(index, 'goals_per_game', parseFloat(e.target.value) || 0)}
                          step="0.1"
                          className={`w-20 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`player-${index}-goals_per_game`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={player.goals_conceded}
                          onChange={(e) => handlePlayerChange(index, 'goals_conceded', parseFloat(e.target.value) || 0)}
                          step="0.1"
                          className={`w-20 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`player-${index}-goals_conceded`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={player.conceded_per_game}
                          onChange={(e) => handlePlayerChange(index, 'conceded_per_game', parseFloat(e.target.value) || 0)}
                          step="0.1"
                          className={`w-20 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`player-${index}-conceded_per_game`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={player.net_goals}
                          onChange={(e) => handlePlayerChange(index, 'net_goals', parseFloat(e.target.value) || 0)}
                          step="0.1"
                          className={`w-20 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`player-${index}-net_goals`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={player.cleansheets}
                          onChange={(e) => handlePlayerChange(index, 'cleansheets', parseFloat(e.target.value) || 0)}
                          step="0.1"
                          className={`w-20 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`player-${index}-cleansheets`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={player.points}
                          onChange={(e) => handlePlayerChange(index, 'points', parseFloat(e.target.value) || 0)}
                          step="0.1"
                          className={`w-20 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`player-${index}-points`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={player.win}
                          onChange={(e) => handlePlayerChange(index, 'win', parseInt(e.target.value) || 0)}
                          className={`w-16 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`player-${index}-win`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={player.draw}
                          onChange={(e) => handlePlayerChange(index, 'draw', parseInt(e.target.value) || 0)}
                          className={`w-16 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`player-${index}-draw`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={player.loss}
                          onChange={(e) => handlePlayerChange(index, 'loss', parseInt(e.target.value) || 0)}
                          className={`w-16 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`player-${index}-loss`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={player.total_matches}
                          onChange={(e) => handlePlayerChange(index, 'total_matches', parseInt(e.target.value) || 0)}
                          className={`w-20 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`player-${index}-total_matches`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={player.total_points}
                          onChange={(e) => handlePlayerChange(index, 'total_points', parseFloat(e.target.value) || 0)}
                          step="0.1"
                          className={`w-20 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`player-${index}-total_points`) ? 'border-red-500 bg-red-50' : ''
                          }`}
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

          {/* Empty State */}
          {((activeTab === 'teams' && teams.length === 0) ||
            (activeTab === 'players' && players.length === 0)) && (
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