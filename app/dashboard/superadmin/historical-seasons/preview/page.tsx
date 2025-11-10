'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { findMatches, MatchResult } from '@/lib/utils/fuzzyMatch';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface TeamData {
  rank: number;
  team: string;
  owner_name: string;
  p: number; // Points
  mp: number; // Matches Played
  w: number; // Wins
  d: number; // Draws
  l: number; // Losses
  f: number; // Goals For
  a: number; // Goals Against
  gd: number; // Goal Difference
  percentage: number; // Win percentage
  cups?: string[]; // Multiple cup achievements
  cup_1?: string; // For display/editing
  cup_2?: string;
  cup_3?: string;
  linked_team_id?: string; // Optional: link to existing team
}

interface PlayerData {
  name: string;
  team: string;
  category: string;
  goals_scored: number | null;
  goals_per_game: number | null;
  goals_conceded: number | null;
  conceded_per_game: number | null;
  net_goals: number | null;
  cleansheets: number | null;
  potm: number | null; // Player of the Match
  points: number | null;
  win: number;
  draw: number;
  loss: number;
  total_matches: number;
  total_points: number | null;
  // Trophy/Award fields (optional)
  category_wise_trophy_1?: string;
  category_wise_trophy_2?: string;
  individual_wise_trophy_1?: string;
  individual_wise_trophy_2?: string;
  linked_player_id?: string; // Optional: link to existing player
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

interface DuplicateMatch {
  inputName: string;
  matches: MatchResult[];
  type: 'player' | 'team';
}

interface ExistingEntities {
  players: Array<{ id: string; name: string; player_id?: string }>;
  teams: Array<{ id: string; name: string; team_name?: string; teamId?: string; owner_name?: string }>;
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
  
  // Duplicate detection state
  const [existingEntities, setExistingEntities] = useState<ExistingEntities | null>(null);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [loadingDuplicates, setLoadingDuplicates] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(true);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Map<string, string>>(new Map());
  const [showBulkReplace, setShowBulkReplace] = useState(false);
  const [bulkFindText, setBulkFindText] = useState('');
  const [bulkReplaceText, setBulkReplaceText] = useState('');
  
  // Player search dropdown state
  const [playerSearchQuery, setPlayerSearchQuery] = useState<Map<number, string>>(new Map());
  const [openPlayerDropdown, setOpenPlayerDropdown] = useState<number | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Sync player team names to match linked team names
  const syncPlayerTeamNames = useCallback((playersData: PlayerData[], oldTeams: TeamData[], newTeams: TeamData[], existingTeamsData: ExistingEntities['teams']) => {
    return playersData.map(player => {
      // Find which team this player belongs to based on the old team name
      const teamIndex = oldTeams.findIndex(t => 
        t.team.trim().toLowerCase() === player.team.trim().toLowerCase()
      );
      
      if (teamIndex === -1) {
        return player; // Team not found, keep as-is
      }
      
      const newTeam = newTeams[teamIndex];
      
      // If the team is linked, update player's team name to the existing team name
      if (newTeam.linked_team_id) {
        const existingTeam = existingTeamsData.find(t => t.teamId === newTeam.linked_team_id);
        if (existingTeam?.name && existingTeam.name !== player.team) {
          console.log(`  🔄 Updated player "${player.name}" team from "${player.team}" to "${existingTeam.name}"`);
          return { ...player, team: existingTeam.name };
        }
      }
      
      return player;
    });
  }, []);
  
  // Auto-link players based on exact or high-similarity name match
  const autoLinkPlayers = useCallback((playersData: PlayerData[], existingPlayersData: ExistingEntities['players']) => {
    return playersData.map(player => {
      // Skip if already linked
      if (player.linked_player_id) {
        console.log(`ℹ️  Player "${player.name}" already linked, skipping auto-link`);
        return player;
      }
      
      // Priority 1: Exact name match
      const exactNameMatch = existingPlayersData.find(
        ep => ep.name && player.name && ep.name.toLowerCase() === player.name.toLowerCase()
      );
      
      if (exactNameMatch) {
        console.log(`🔗 Auto-linked player "${player.name}" to existing player "${exactNameMatch.name}" (exact match)`);
        return { ...player, linked_player_id: exactNameMatch.player_id };
      }
      
      // Priority 2: Normalized name match (removes special characters)
      const normalizedMatch = existingPlayersData.find(ep => {
        if (!player.name || !ep.name) return false;
        const normalized1 = player.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normalized2 = ep.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return normalized1 === normalized2 && normalized1.length > 0;
      });
      
      if (normalizedMatch) {
        console.log(`🔗 Auto-linked player "${player.name}" to existing player "${normalizedMatch.name}" (normalized match)`);
        return { ...player, linked_player_id: normalizedMatch.player_id };
      }
      
      // Priority 3: Very high similarity match (>90% for auto-linking)
      const similarNameMatch = existingPlayersData.find(ep => {
        if (!player.name || !ep.name) return false;
        const similarity = calculateSimilarity(player.name.toLowerCase(), ep.name.toLowerCase());
        return similarity > 0.9; // High threshold for auto-linking
      });
      
      if (similarNameMatch) {
        console.log(`🔗 Auto-linked player "${player.name}" to existing player "${similarNameMatch.name}" (high similarity: ${(calculateSimilarity(player.name.toLowerCase(), similarNameMatch.name.toLowerCase()) * 100).toFixed(0)}%)`);
        return { ...player, linked_player_id: similarNameMatch.player_id };
      }
      
      console.log(`ℹ️  Player "${player.name}" not auto-linked - will create as new player unless manually linked`);
      return player; // No match, keep as new player
    });
  }, []);
  
  // Auto-link teams based on owner name or similar team name
  const autoLinkTeams = useCallback((teamsData: TeamData[], existingTeamsData: ExistingEntities['teams']) => {
    return teamsData.map(team => {
      // Skip if already linked
      if (team.linked_team_id) {
        console.log(`ℹ️  Team "${team.team}" already linked, skipping auto-link`);
        return team;
      }
      
      // Priority 1: Exact name match
      const exactNameMatch = existingTeamsData.find(
        et => et.name && team.team && et.name.toLowerCase() === team.team.toLowerCase()
      );
      
      if (exactNameMatch) {
        console.log(`🔗 Auto-linked "${team.team}" to existing team "${exactNameMatch.name}" (exact name match)`);
        return { ...team, linked_team_id: exactNameMatch.teamId };
      }
      
      // Priority 2: Normalized name match (removes FC, SC, etc.)
      const normalizedMatch = existingTeamsData.find(et => {
        if (!team.team || !et.name) return false;
        const normalized1 = normalizeTeamName(team.team);
        const normalized2 = normalizeTeamName(et.name);
        return normalized1 === normalized2 && normalized1.length > 0;
      });
      
      if (normalizedMatch) {
        console.log(`🔗 Auto-linked "${team.team}" to existing team "${normalizedMatch.name}" (normalized match - FC/SC removed)`);
        return { ...team, linked_team_id: normalizedMatch.teamId };
      }
      
      // Priority 3: Exact owner match
      const exactOwnerMatch = existingTeamsData.find(
        et => et.owner_name && team.owner_name && et.owner_name.toLowerCase() === team.owner_name.toLowerCase()
      );
      
      if (exactOwnerMatch) {
        console.log(`🔗 Auto-linked "${team.team}" to existing team "${exactOwnerMatch.name}" (same owner: ${team.owner_name})`);
        return { ...team, linked_team_id: exactOwnerMatch.teamId };
      }
      
      // Priority 4: High similarity match (>90% for auto-linking)
      const similarNameMatch = existingTeamsData.find(et => {
        if (!team.team || !et.name) return false;
        const similarity = calculateSimilarity(team.team.toLowerCase(), et.name.toLowerCase());
        return similarity > 0.9; // Higher threshold for auto-linking
      });
      
      if (similarNameMatch) {
        console.log(`🔗 Auto-linked "${team.team}" to existing team "${similarNameMatch.name}" (high similarity: ${(calculateSimilarity(team.team.toLowerCase(), similarNameMatch.name.toLowerCase()) * 100).toFixed(0)}%)`);
        return { ...team, linked_team_id: similarNameMatch.teamId };
      }
      
      console.log(`ℹ️  "${team.team}" not auto-linked - will create as new team unless manually linked`);
      return team; // No match, keep as new team
    });
  }, []);
  
  // Normalize team name by removing common prefixes/suffixes
  const normalizeTeamName = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .replace(/\b(fc|sc|ac|rc|cf|club)\b/gi, '') // Remove FC, SC, AC, RC, CF, Club
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  };
  
  // Simple string similarity calculation
  const calculateSimilarity = (str1: string, str2: string): number => {
    // First try normalized comparison (without FC, SC, etc.)
    const normalized1 = normalizeTeamName(str1);
    const normalized2 = normalizeTeamName(str2);
    
    // If normalized names match exactly, return perfect score
    if (normalized1 === normalized2 && normalized1.length > 0) {
      return 1.0;
    }
    
    // Otherwise use edit distance on original names
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) return 1.0;
    return (longer.length - editDistance(longer, shorter)) / longer.length;
  };
  
  const editDistance = (str1: string, str2: string): number => {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  };
  
  // Load uploaded data from localStorage
  useEffect(() => {
    const savedData = localStorage.getItem('seasonUploadData');
    if (savedData) {
      try {
        const data: any = JSON.parse(savedData);
        
        // Transform players data: convert trophy arrays to individual fields
        const transformedPlayers = data.players.map((player: any) => {
          const transformed: any = { ...player };
          
          // Convert category_trophies array to individual fields
          if (player.category_trophies && Array.isArray(player.category_trophies)) {
            transformed.category_wise_trophy_1 = player.category_trophies[0] || undefined;
            transformed.category_wise_trophy_2 = player.category_trophies[1] || undefined;
            delete transformed.category_trophies;
          }
          
          // Convert individual_trophies array to individual fields
          if (player.individual_trophies && Array.isArray(player.individual_trophies)) {
            transformed.individual_wise_trophy_1 = player.individual_trophies[0] || undefined;
            transformed.individual_wise_trophy_2 = player.individual_trophies[1] || undefined;
            delete transformed.individual_trophies;
          }
          
          return transformed;
        });
        
        // Transform teams data: convert cups array to individual fields for display
        const transformedTeams = data.teams.map((team: any) => {
          const transformed: any = { ...team };
          
          // Convert cups array to individual fields
          if (team.cups && Array.isArray(team.cups)) {
            transformed.cup_1 = team.cups[0] || undefined;
            transformed.cup_2 = team.cups[1] || undefined;
            transformed.cup_3 = team.cups[2] || undefined;
            delete transformed.cups;
          }
          
          return transformed;
        });
        
        setUploadData(data);
        setTeams(transformedTeams);
        setPlayers(transformedPlayers);
        
        // Set initial active tab based on available data
        if (data.teams.length > 0) setActiveTab('teams');
        else if (data.players.length > 0) setActiveTab('players');
        
        // Auto-run validation and duplicate check
        setTimeout(() => {
          // Load existing entities and check for duplicates, passing transformed data
          loadExistingEntitiesAndCheckDuplicates(transformedTeams, transformedPlayers);
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

  // Load existing entities from database and check for duplicates
  const loadExistingEntitiesAndCheckDuplicates = useCallback(async (currentTeams?: TeamData[], currentPlayers?: PlayerData[]) => {
    // Use passed data or fall back to state
    const teamsToProcess = currentTeams || teams;
    const playersToProcess = currentPlayers || players;
    
    setLoadingDuplicates(true);
    try {
      const response = await fetchWithTokenRefresh('/api/seasons/historical/check-duplicates');
      const result = await response.json();
      
      if (result.success && result.data) {
        setExistingEntities(result.data);
        
        console.log('\n🔍 Starting auto-linking process...');
        console.log(`Teams to process: ${teamsToProcess.length}`);
        console.log(`Players to process: ${playersToProcess.length}`);
        
        // Auto-link teams based on existing data
        const autoLinkedTeams = autoLinkTeams(teamsToProcess, result.data.teams);
        const teamsChanged = JSON.stringify(autoLinkedTeams) !== JSON.stringify(teamsToProcess);
        const teamsLinkedCount = autoLinkedTeams.filter(t => t.linked_team_id).length;
        
        // Auto-link players based on existing data  
        const autoLinkedPlayers = autoLinkPlayers(playersToProcess, result.data.players);
        const playersChanged = JSON.stringify(autoLinkedPlayers) !== JSON.stringify(playersToProcess);
        const playersLinkedCount = autoLinkedPlayers.filter(p => p.linked_player_id).length;
        
        // Update player team names to match linked teams
        let finalPlayers = autoLinkedPlayers;
        if (teamsChanged) {
          finalPlayers = syncPlayerTeamNames(autoLinkedPlayers, teamsToProcess, autoLinkedTeams, result.data.teams);
        }
        
        // Apply all changes at once
        if (teamsChanged) {
          setTeams(autoLinkedTeams);
        }
        
        if (playersChanged || teamsChanged) {
          setPlayers(finalPlayers);
        }
        
        // Log summary
        console.log('\n🎯 Auto-linking Summary:');
        console.log(`  Teams: ${teamsLinkedCount}/${teamsToProcess.length} linked`);
        console.log(`  Players: ${playersLinkedCount}/${playersToProcess.length} linked`);
        if (teamsChanged || playersChanged) {
          console.log('  ✅ Changes applied and saved');
        } else {
          console.log('  ℹ️  No new auto-links needed');
        }
        
        // Save auto-linked data to localStorage
        if (teamsChanged || playersChanged) {
          const savedData = localStorage.getItem('seasonUploadData');
          if (savedData) {
            try {
              const data = JSON.parse(savedData);
              const updatedData = {
                ...data,
                teams: autoLinkedTeams,
                players: finalPlayers
              };
              localStorage.setItem('seasonUploadData', JSON.stringify(updatedData));
              console.log('💾 Saved auto-linked data to localStorage');
            } catch (e) {
              console.error('Failed to save auto-linked data:', e);
            }
          }
        }
        
        // Check for duplicates using fuzzy matching (only for items not auto-linked)
        const matches: DuplicateMatch[] = [];
        const threshold = 70; // 70% similarity threshold
        
        // Check players (only those not auto-linked)
        const existingPlayerNames = result.data.players.map((p: any) => p.name);
        finalPlayers.forEach((player) => {
          // Skip if already linked
          if (!player.linked_player_id) {
            const playerMatches = findMatches(player.name, existingPlayerNames, threshold, 3);
            if (playerMatches.length > 0) {
              matches.push({
                inputName: player.name,
                matches: playerMatches,
                type: 'player'
              });
            }
          }
        });
        
        // Check teams (only those not auto-linked)
        const existingTeamNames = result.data.teams.map((t: any) => t.name);
        autoLinkedTeams.forEach((team) => {
          // Skip if already linked
          if (!team.linked_team_id) {
            const teamMatches = findMatches(team.team, existingTeamNames, threshold, 3);
            if (teamMatches.length > 0) {
              matches.push({
                inputName: team.team,
                matches: teamMatches,
                type: 'team'
              });
            }
          }
        });
        
        setDuplicateMatches(matches);
      }
    } catch (error) {
      console.error('Error loading existing entities:', error);
    } finally {
      setLoadingDuplicates(false);
    }
  }, [players, teams, autoLinkTeams, autoLinkPlayers, syncPlayerTeamNames]);
  
  const handleRemoveTeam = useCallback((index: number) => {
    if (confirm('Remove this team from the import?')) {
      const newTeams = teams.filter((_, i) => i !== index);
      setTeams(newTeams);
      
      // Save to localStorage
      if (uploadData) {
        const updatedUploadData = { ...uploadData, teams: newTeams };
        localStorage.setItem('seasonUploadData', JSON.stringify(updatedUploadData));
      }
    }
  }, [teams, uploadData]);

  const handleRemovePlayer = useCallback((index: number) => {
    if (confirm('Remove this player from the import?')) {
      const newPlayers = players.filter((_, i) => i !== index);
      setPlayers(newPlayers);
      
      // Save to localStorage
      if (uploadData) {
        const updatedUploadData = { ...uploadData, players: newPlayers };
        localStorage.setItem('seasonUploadData', JSON.stringify(updatedUploadData));
      }
    }
  }, [players, uploadData]);

  const handleTeamChange = useCallback((index: number, field: keyof TeamData, value: string) => {
    const oldTeams = [...teams];
    const newTeams = [...teams];
    newTeams[index][field] = value;
    setTeams(newTeams);
    
    // Save to localStorage to preserve linkings
    if (uploadData) {
      const updatedUploadData = { ...uploadData, teams: newTeams };
      localStorage.setItem('seasonUploadData', JSON.stringify(updatedUploadData));
    }
    
    // When linked_team_id changes, update all player team names for this team
    if (field === 'linked_team_id' && existingEntities?.teams) {
      const updatedPlayers = syncPlayerTeamNames(players, oldTeams, newTeams, existingEntities.teams);
      if (JSON.stringify(updatedPlayers) !== JSON.stringify(players)) {
        setPlayers(updatedPlayers);
        console.log(`🔄 Updated player team names after linking team at index ${index}`);
        
        // Also save updated players to localStorage
        if (uploadData) {
          const updatedUploadData = { ...uploadData, teams: newTeams, players: updatedPlayers };
          localStorage.setItem('seasonUploadData', JSON.stringify(updatedUploadData));
        }
      }
    }
    
    // Re-check duplicates when team name changes (debounced)
    if (field === 'team_name' && existingEntities) {
      const timeoutId = setTimeout(() => loadExistingEntitiesAndCheckDuplicates(), 500);
      return () => clearTimeout(timeoutId);
    }
  }, [teams, players, existingEntities, uploadData, syncPlayerTeamNames, loadExistingEntitiesAndCheckDuplicates]);

  const handlePlayerChange = useCallback((index: number, field: keyof PlayerData, value: any) => {
    const newPlayers = [...players];
    if (field === 'goals_scored' || field === 'goals_per_game' || field === 'goals_conceded' || 
        field === 'conceded_per_game' || field === 'net_goals' || field === 'cleansheets' || 
        field === 'potm' || field === 'points' || field === 'win' || field === 'draw' || field === 'loss' || 
        field === 'total_matches' || field === 'total_points') {
      // Allow null/empty for optional fields
      if (value === '' || value === null) {
        newPlayers[index][field] = null;
      } else {
        newPlayers[index][field] = typeof value === 'string' ? (parseFloat(value) || 0) : value;
      }
    } else {
      newPlayers[index][field] = value;
    }
    setPlayers(newPlayers);
    
    // Save to localStorage to preserve linkings
    if (uploadData) {
      const updatedUploadData = { ...uploadData, players: newPlayers };
      localStorage.setItem('seasonUploadData', JSON.stringify(updatedUploadData));
    }
    
    // Re-check duplicates when player name changes (debounced)
    if (field === 'name' && existingEntities) {
      const timeoutId = setTimeout(() => loadExistingEntitiesAndCheckDuplicates(), 500);
      return () => clearTimeout(timeoutId);
    }
  }, [players, existingEntities, uploadData, loadExistingEntitiesAndCheckDuplicates]);
  
  const handleBulkReplaceTeamNames = useCallback(() => {
    if (!bulkFindText.trim() || !bulkReplaceText.trim()) {
      alert('Please enter both find and replace text');
      return;
    }
    
    const findLower = bulkFindText.trim().toLowerCase();
    const replaceText = bulkReplaceText.trim();
    let replacedCount = 0;
    
    // Replace in players
    const updatedPlayers = players.map(player => {
      if (player.team && player.team.toLowerCase() === findLower) {
        replacedCount++;
        return { ...player, team: replaceText };
      }
      return player;
    });
    
    setPlayers(updatedPlayers);
    
    // Save to localStorage
    if (uploadData) {
      const updatedUploadData = { ...uploadData, players: updatedPlayers };
      localStorage.setItem('seasonUploadData', JSON.stringify(updatedUploadData));
    }
    
    alert(`✅ Replaced ${replacedCount} occurrences of "${bulkFindText}" with "${replaceText}"`);
    setBulkFindText('');
    setBulkReplaceText('');
    setShowBulkReplace(false);
  }, [bulkFindText, bulkReplaceText, players, uploadData]);
  
  const applySuggestion = useCallback((inputName: string, suggestedName: string, type: 'player' | 'team') => {
    if (type === 'player') {
      const playerIndex = players.findIndex(p => p.name === inputName);
      if (playerIndex !== -1) {
        handlePlayerChange(playerIndex, 'name', suggestedName);
      }
    } else {
      const teamIndex = teams.findIndex(t => t.team === inputName);
      if (teamIndex !== -1) {
        handleTeamChange(teamIndex, 'team', suggestedName);
      }
    }
    
    // Remove from duplicate matches after applying
    setDuplicateMatches(prev => prev.filter(m => m.inputName !== inputName));
  }, [players, teams]);

  const validateAll = useCallback(() => {
    const errors = new Set<string>();
    
    // Get team names for cross-referential validation
    // For linked teams, use the actual existing team name; for new teams, use the uploaded name
    const validTeamNames = new Set<string>();
    
    teams.forEach(team => {
      if (team.linked_team_id && existingEntities?.teams) {
        // Find the actual existing team name for linked teams
        const existingTeam = existingEntities.teams.find(t => t.teamId === team.linked_team_id);
        if (existingTeam?.name) {
          validTeamNames.add(existingTeam.name.trim().toLowerCase());
        }
      } else {
        // For new teams (not linked), use the uploaded team name
        validTeamNames.add(team.team.trim().toLowerCase());
      }
    });
    
    // Basic team validation
    teams.forEach((team, index) => {
      // Required string fields
      if (!team.team.trim()) errors.add(`team-${index}-team`);
      if (!team.owner_name.trim()) errors.add(`team-${index}-owner_name`);
      
      // Required numeric fields
      const numericFields = ['rank', 'p', 'mp', 'w', 'd', 'l', 'f', 'a', 'gd', 'percentage'];
      numericFields.forEach(field => {
        const value = team[field as keyof TeamData];
        if (value === undefined || value === null || (typeof value === 'number' && isNaN(value))) {
          errors.add(`team-${index}-${field}`);
        }
      });
      
      // W + D + L = MP validation removed - matches can be nulled/voided
      // If you need to check this, it should be a warning only
      
      // Validate Goal Difference
      if (team.f - team.a !== team.gd) {
        errors.add(`team-${index}-gd`);
      }
      
      // Check for duplicate team names
      const duplicateTeamIndex = teams.findIndex((t, i) => 
        i !== index && t.team.trim().toLowerCase() === team.team.trim().toLowerCase()
      );
      if (duplicateTeamIndex !== -1) {
        errors.add(`team-${index}-team`);
      }
    });
    
    // Basic player validation with cross-referential checks
    players.forEach((player, index) => {
      if (!player.name.trim()) errors.add(`player-${index}-name`);
      if (!player.team.trim()) errors.add(`player-${index}-team`);
      if (!player.category.trim()) errors.add(`player-${index}-category`);
      
      // Validate required numeric fields
      if (player.win === undefined || player.win === null || isNaN(player.win)) errors.add(`player-${index}-win`);
      if (player.draw === undefined || player.draw === null || isNaN(player.draw)) errors.add(`player-${index}-draw`);
      if (player.loss === undefined || player.loss === null || isNaN(player.loss)) errors.add(`player-${index}-loss`);
      if (player.total_matches === undefined || player.total_matches === null || isNaN(player.total_matches)) errors.add(`player-${index}-total_matches`);
      
      // Optional numeric fields - only validate if provided (null is OK)
      if (player.goals_scored !== null && player.goals_scored !== undefined && isNaN(player.goals_scored)) errors.add(`player-${index}-goals_scored`);
      if (player.goals_per_game !== null && player.goals_per_game !== undefined && isNaN(player.goals_per_game)) errors.add(`player-${index}-goals_per_game`);
      if (player.goals_conceded !== null && player.goals_conceded !== undefined && isNaN(player.goals_conceded)) errors.add(`player-${index}-goals_conceded`);
      if (player.conceded_per_game !== null && player.conceded_per_game !== undefined && isNaN(player.conceded_per_game)) errors.add(`player-${index}-conceded_per_game`);
      if (player.net_goals !== null && player.net_goals !== undefined && isNaN(player.net_goals)) errors.add(`player-${index}-net_goals`);
      if (player.cleansheets !== null && player.cleansheets !== undefined && isNaN(player.cleansheets)) errors.add(`player-${index}-cleansheets`);
      if (player.points !== null && player.points !== undefined && isNaN(player.points)) errors.add(`player-${index}-points`);
      if (player.total_points !== null && player.total_points !== undefined && isNaN(player.total_points)) errors.add(`player-${index}-total_points`);
      
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
      
      // Match calculations validation removed - matches can be nulled/voided
      // If you need to check this, it should be a warning only
      
      // Check for duplicate player names
      const duplicatePlayerIndex = players.findIndex((p, i) => 
        i !== index && p.name.trim().toLowerCase() === player.name.trim().toLowerCase()
      );
      if (duplicatePlayerIndex !== -1) {
        errors.add(`player-${index}-name`);
      }
      
      // Cross-referential validation: player team must exist in valid team names
      // Valid team names include both linked existing teams and new teams from the upload
      if (!player.team || !player.team.trim() || !validTeamNames.has(player.team.trim().toLowerCase())) {
        errors.add(`player-${index}-team`);
      }
    });
    
    setValidationErrors(errors);
    return errors.size === 0;
  }, [teams, players, existingEntities]);

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
      // Prepare the data for import - map frontend field names to backend expected names
      const importData = {
        seasonInfo: uploadData.seasonInfo,
        teams: teams.map(t => {
          // Transform individual cup fields back to array
          const cups: string[] = [];
          if (t.cup_1) cups.push(t.cup_1);
          if (t.cup_2) cups.push(t.cup_2);
          if (t.cup_3) cups.push(t.cup_3);
          
          return {
            team_name: t.team,
            owner_name: t.owner_name,
            linked_team_id: t.linked_team_id,
            // Team standings data
            rank: t.rank,
            p: t.p,
            mp: t.mp,
            w: t.w,
            d: t.d,
            l: t.l,
            f: t.f,
            a: t.a,
            gd: t.gd,
            percentage: t.percentage,
            cups: cups.length > 0 ? cups : undefined
          };
        }),
        players: players.map(p => {
          // Transform individual trophy fields back to arrays
          const category_trophies: string[] = [];
          if (p.category_wise_trophy_1) category_trophies.push(p.category_wise_trophy_1);
          if (p.category_wise_trophy_2) category_trophies.push(p.category_wise_trophy_2);
          
          const individual_trophies: string[] = [];
          if (p.individual_wise_trophy_1) individual_trophies.push(p.individual_wise_trophy_1);
          if (p.individual_wise_trophy_2) individual_trophies.push(p.individual_wise_trophy_2);
          
          return {
            name: p.name,
            team: p.team,
            category: p.category,
            linked_player_id: p.linked_player_id,
            goals_scored: p.goals_scored,
            goals_per_game: p.goals_per_game,
            goals_conceded: p.goals_conceded,
            conceded_per_game: p.conceded_per_game,
            net_goals: p.net_goals,
            cleansheets: p.cleansheets,
            potm: p.potm,
            points: p.points,
            win: p.win,
            draw: p.draw,
            loss: p.loss,
            total_matches: p.total_matches,
            total_points: p.total_points,
            category_trophies: category_trophies.length > 0 ? category_trophies : undefined,
            individual_trophies: individual_trophies.length > 0 ? individual_trophies : undefined
          };
        })
      };
      
      const response = await fetchWithTokenRefresh('/api/seasons/historical/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(importData),
      });
      
      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response received:', text.substring(0, 500));
        throw new Error(`Server returned non-JSON response (Status: ${response.status}). This usually means the API route crashed.`);
      }
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || `Import failed with status ${response.status}`);
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
                    <span className="font-semibold text-[#0066FF]">Season {uploadData.seasonInfo.seasonNumber}</span>
                    <span className="mx-2 text-gray-400">•</span>
                    <span className="text-gray-600">ID: SSPSLS{uploadData.seasonInfo.seasonNumber}</span>
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
        
        {/* Potential Duplicates Section */}
        {duplicateMatches.length > 0 && (
          <div className="glass rounded-3xl p-6 mb-6 shadow-lg backdrop-blur-md border border-white/20 bg-orange-50/30">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-orange-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-1.964-1.333-2.732 0L3.732 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <span className="text-sm font-semibold text-orange-800">⚠️ {duplicateMatches.length} Potential Duplicate(s) Found</span>
                  <p className="text-xs text-orange-600 mt-1">These names are similar to existing database entries. Review and correct them before importing.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowDuplicates(!showDuplicates)}
                className="text-xs text-orange-600 hover:text-orange-800 underline"
              >
                {showDuplicates ? 'Hide' : 'Show'} Duplicates
              </button>
            </div>
            
            {loadingDuplicates && (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
                <p className="text-xs text-orange-600 mt-2">Checking for duplicates...</p>
              </div>
            )}
            
            {showDuplicates && !loadingDuplicates && (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {duplicateMatches.map((match, idx) => (
                  <div key={idx} className="bg-white/60 rounded-lg p-4 border border-orange-200">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-semibold text-gray-500 uppercase">
                            {match.type === 'player' ? '👤 Player' : '👥 Team'}
                          </span>
                          <span className="text-sm font-semibold text-gray-800">{match.inputName}</span>
                        </div>
                        <p className="text-xs text-gray-600">Found {match.matches.length} similar {match.type === 'player' ? 'player' : 'team'}(s) in database</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      {match.matches.map((suggestion, sidx) => (
                        <div key={sidx} className="flex items-center justify-between bg-white/80 rounded px-3 py-2 border border-gray-200">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="flex items-center gap-2">
                              {suggestion.isExactMatch ? (
                                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded">EXACT</span>
                              ) : (
                                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded">
                                  {suggestion.similarity.toFixed(0)}%
                                </span>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-800">{suggestion.name}</div>
                              {suggestion.isFuzzyMatch && (
                                <div className="text-xs text-gray-500">Similar to your input (edit distance: {suggestion.distance})</div>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => applySuggestion(match.inputName, suggestion.name, match.type)}
                            className="ml-3 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
                          >
                            Use This
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-orange-200">
                      <p className="text-xs text-gray-600">
                        💡 <strong>Tip:</strong> Click "Use This" to replace your input with the existing database name, or edit your name in the table below to keep it as-is.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Bulk Replace Tool */}
        <div className="glass rounded-3xl p-4 mb-6 shadow-lg backdrop-blur-md border border-white/20">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">🔧 Bulk Fix Team Names</h3>
            <button
              onClick={() => setShowBulkReplace(!showBulkReplace)}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              {showBulkReplace ? 'Hide' : 'Show'} Tool
            </button>
          </div>
          {showBulkReplace && (
            <div className="space-y-3">
              <p className="text-xs text-gray-600">Find and replace team names in all player records at once:</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Find team name:</label>
                  <input
                    type="text"
                    value={bulkFindText}
                    onChange={(e) => setBulkFindText(e.target.value)}
                    placeholder="e.g., KATTU KOMBANS"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Replace with:</label>
                  <input
                    type="text"
                    value={bulkReplaceText}
                    onChange={(e) => setBulkReplaceText(e.target.value)}
                    placeholder="e.g., Kattu Kombans"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <button
                onClick={handleBulkReplaceTeamNames}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Replace All
              </button>
            </div>
          )}
        </div>
        
        {/* Auto-save Information Banner */}
        <div className="glass rounded-3xl p-4 mb-6 shadow-lg backdrop-blur-md border border-white/20 bg-green-50/30">
          <div className="flex items-start">
            <svg className="w-5 h-5 mr-2 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <span className="text-sm font-semibold text-green-800">💾 Auto-Save Enabled</span>
              <p className="text-xs text-green-700 mt-1">
                All your player and team linkings are automatically saved as you work. If an import error occurs or you refresh the page, your linkings will be preserved.
              </p>
            </div>
          </div>
        </div>
        
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
                    if (field === 'mp') {
                      const team = teams[parseInt(indexStr)];
                      errorMessage = `Team Row ${rowNum} (${team?.team || 'Unknown'}): W (${team?.w || 0}) + D (${team?.d || 0}) + L (${team?.l || 0}) = ${(team?.w || 0) + (team?.d || 0) + (team?.l || 0)} must equal MP (${team?.mp || 0})`;
                    } else if (field === 'gd') {
                      const team = teams[parseInt(indexStr)];
                      errorMessage = `Team Row ${rowNum} (${team?.team || 'Unknown'}): GD (${team?.gd || 0}) must equal F (${team?.f || 0}) - A (${team?.a || 0}) = ${(team?.f || 0) - (team?.a || 0)}`;
                    } else {
                      errorMessage = `Team Row ${rowNum}: ${field.toUpperCase()} is required`;
                    }
                  } else if (type === 'player') {
                    if (field === 'total_matches') {
                      const player = players[parseInt(indexStr)];
                      errorMessage = `Player Row ${rowNum} (${player?.name || 'Unknown'}): Win (${player?.win || 0}) + Draw (${player?.draw || 0}) + Loss (${player?.loss || 0}) = ${(player?.win || 0) + (player?.draw || 0) + (player?.loss || 0)} must equal Total Matches (${player?.total_matches || 0})`;
                    } else if (field === 'team') {
                      const player = players[parseInt(indexStr)];
                      const playerTeam = player?.team || '(empty)';
                      const playerName = player?.name || 'Unknown';
                      
                      // Build list of valid team names (including linked teams)
                      const validTeamNames: string[] = [];
                      teams.forEach(team => {
                        if (team.linked_team_id && existingEntities?.teams) {
                          const existingTeam = existingEntities.teams.find(t => t.teamId === team.linked_team_id);
                          if (existingTeam?.name) {
                            validTeamNames.push(existingTeam.name);
                          }
                        } else {
                          validTeamNames.push(team.team);
                        }
                      });
                      
                      errorMessage = `Player Row ${rowNum} (${playerName}): Team name "${playerTeam}" must match an existing team. Available teams: ${Array.from(new Set(validTeamNames)).join(', ')}`;
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
              <table className="min-w-full text-sm">
                <thead className="bg-white/10">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Rank</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Team</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Owner</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Link To</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">P</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">MP</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">W</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">D</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">L</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">F</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">A</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">GD</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">%</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Cup 1</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Cup 2</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Cup 3</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white/20 divide-y divide-gray-200">
                  {teams.map((team, index) => (
                    <tr key={index} className="hover:bg-white/30 transition-colors">
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={team.rank}
                          onChange={(e) => handleTeamChange(index, 'rank', parseInt(e.target.value) || 0)}
                          className={`w-14 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`team-${index}-rank`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={team.team}
                          onChange={(e) => handleTeamChange(index, 'team', e.target.value)}
                          className={`w-32 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`team-${index}-team`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                          placeholder="Team name"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={team.owner_name}
                          onChange={(e) => handleTeamChange(index, 'owner_name', e.target.value)}
                          className={`w-32 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`team-${index}-owner_name`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                          placeholder="Owner name"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={team.linked_team_id || ''}
                          onChange={(e) => handleTeamChange(index, 'linked_team_id', e.target.value)}
                          className={`w-48 border outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 text-xs ${
                            team.linked_team_id ? 'bg-blue-50 border-blue-300' : 'bg-transparent border-gray-300'
                          }`}
                        >
                          <option value="">➕ New Team</option>
                          {existingEntities?.teams && existingEntities.teams.length > 0 && (
                            <>
                              {/* Suggested matches (same owner or similar name) */}
                              {(() => {
                                const suggested = existingEntities.teams.filter(existingTeam => {
                                  const sameOwner = existingTeam.owner_name && team.owner_name && existingTeam.owner_name.toLowerCase() === team.owner_name.toLowerCase();
                                  
                                  // Check for similar names (improved matching)
                                  if (existingTeam.name && team.team) {
                                    // Exact match
                                    if (existingTeam.name.toLowerCase() === team.team.toLowerCase()) {
                                      return true;
                                    }
                                    
                                    // Normalized match (removes FC, SC, etc.)
                                    if (normalizeTeamName(existingTeam.name) === normalizeTeamName(team.team)) {
                                      return true;
                                    }
                                    
                                    // Substring match
                                    const similarName = existingTeam.name.toLowerCase().includes(team.team.toLowerCase().substring(0, 5)) ||
                                                       team.team.toLowerCase().includes(existingTeam.name.toLowerCase().substring(0, 5));
                                    if (similarName) {
                                      return true;
                                    }
                                  }
                                  
                                  return sameOwner;
                                });
                                
                                if (suggested.length > 0) {
                                  return (
                                    <>
                                      <optgroup label="🎯 Suggested Matches">
                                        {suggested.map(existingTeam => (
                                          <option key={existingTeam.teamId} value={existingTeam.teamId}>
                                            {existingTeam.name} ({existingTeam.owner_name || 'No owner'})
                                          </option>
                                        ))}
                                      </optgroup>
                                      <optgroup label="📋 All Other Teams">
                                        {existingEntities.teams
                                          .filter(t => !suggested.some(s => s.teamId === t.teamId))
                                          .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                                          .map(existingTeam => (
                                            <option key={existingTeam.teamId} value={existingTeam.teamId}>
                                              {existingTeam.name} ({existingTeam.owner_name || 'No owner'})
                                            </option>
                                          ))}
                                      </optgroup>
                                    </>
                                  );
                                } else {
                                  // No suggested matches, show all teams
                                  return existingEntities.teams
                                    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                                    .map(existingTeam => (
                                      <option key={existingTeam.teamId} value={existingTeam.teamId}>
                                        {existingTeam.name} ({existingTeam.owner_name || 'No owner'})
                                      </option>
                                    ));
                                }
                              })()}
                            </>
                          )}
                          {(!existingEntities?.teams || existingEntities.teams.length === 0) && (
                            <option disabled>No existing teams</option>
                          )}
                        </select>
                        {team.linked_team_id && (
                          <div className="text-xs text-green-600 mt-1 font-medium">
                            ✅ Linked • Change if needed
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={team.p}
                          onChange={(e) => handleTeamChange(index, 'p', parseInt(e.target.value) || 0)}
                          className={`w-14 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`team-${index}-p`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={team.mp}
                          onChange={(e) => handleTeamChange(index, 'mp', parseInt(e.target.value) || 0)}
                          className={`w-14 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`team-${index}-mp`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={team.w}
                          onChange={(e) => handleTeamChange(index, 'w', parseInt(e.target.value) || 0)}
                          className={`w-14 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`team-${index}-w`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={team.d}
                          onChange={(e) => handleTeamChange(index, 'd', parseInt(e.target.value) || 0)}
                          className={`w-14 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`team-${index}-d`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={team.l}
                          onChange={(e) => handleTeamChange(index, 'l', parseInt(e.target.value) || 0)}
                          className={`w-14 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`team-${index}-l`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={team.f}
                          onChange={(e) => handleTeamChange(index, 'f', parseInt(e.target.value) || 0)}
                          className={`w-14 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`team-${index}-f`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={team.a}
                          onChange={(e) => handleTeamChange(index, 'a', parseInt(e.target.value) || 0)}
                          className={`w-14 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`team-${index}-a`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={team.gd}
                          onChange={(e) => handleTeamChange(index, 'gd', parseInt(e.target.value) || 0)}
                          className={`w-14 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`team-${index}-gd`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={team.percentage}
                          onChange={(e) => handleTeamChange(index, 'percentage', parseFloat(e.target.value) || 0)}
                          step="0.1"
                          className={`w-16 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`team-${index}-percentage`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={team.cup_1 || ''}
                          onChange={(e) => handleTeamChange(index, 'cup_1', e.target.value)}
                          className="w-32 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1"
                          placeholder="Optional"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={team.cup_2 || ''}
                          onChange={(e) => handleTeamChange(index, 'cup_2', e.target.value)}
                          className="w-32 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1"
                          placeholder="Optional"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={team.cup_3 || ''}
                          onChange={(e) => handleTeamChange(index, 'cup_3', e.target.value)}
                          className="w-32 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1"
                          placeholder="Optional"
                        />
                      </td>
                      <td className="px-3 py-2">
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Link To</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Team</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Goals</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">G/Game</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Conceded</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">C/Game</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Net Goals</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Clean</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">POTM</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Points</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">W</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">D</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">L</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Total M</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Total P</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Cat Trophy 1</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Cat Trophy 2</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Ind Trophy 1</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Ind Trophy 2</th>
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
                          className={`w-48 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`player-${index}-name`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                          placeholder="Player name"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          {/* Searchable Player Dropdown */}
                          <div 
                            className={`w-56 border rounded px-2 py-1 text-xs cursor-pointer ${
                              player.linked_player_id ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-300'
                            }`}
                            onClick={() => setOpenPlayerDropdown(openPlayerDropdown === index ? null : index)}
                          >
                            {player.linked_player_id ? (
                              <span className="text-gray-800">
                                {existingEntities?.players.find(p => p.player_id === player.linked_player_id)?.name || 'Unknown Player'}
                              </span>
                            ) : (
                              <span className="text-gray-500">➕ New Player</span>
                            )}
                          </div>
                          
                          {/* Dropdown Menu */}
                          {openPlayerDropdown === index && (
                            <div className="absolute z-50 w-56 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-hidden">
                              {/* Search Input */}
                              <div className="p-2 border-b border-gray-200">
                                <input
                                  type="text"
                                  placeholder="Search players..."
                                  value={playerSearchQuery.get(index) || ''}
                                  onChange={(e) => {
                                    const newMap = new Map(playerSearchQuery);
                                    newMap.set(index, e.target.value);
                                    setPlayerSearchQuery(newMap);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                                  autoFocus
                                />
                              </div>
                              
                              {/* Player List */}
                              <div className="max-h-52 overflow-y-auto">
                                {/* New Player Option */}
                                <div
                                  className="px-3 py-2 text-xs hover:bg-gray-100 cursor-pointer border-b border-gray-200"
                                  onClick={() => {
                                    handlePlayerChange(index, 'linked_player_id', '');
                                    setOpenPlayerDropdown(null);
                                    const newMap = new Map(playerSearchQuery);
                                    newMap.delete(index);
                                    setPlayerSearchQuery(newMap);
                                  }}
                                >
                                  <span className="font-medium">➕ New Player</span>
                                </div>
                                
                                {/* Existing Players */}
                                {(() => {
                                  if (!existingEntities?.players || existingEntities.players.length === 0) {
                                    return (
                                      <div className="px-3 py-2 text-xs text-gray-500">No existing players</div>
                                    );
                                  }
                                  
                                  const searchQuery = (playerSearchQuery.get(index) || '').toLowerCase();
                                  
                                  // Find suggested matches
                                  const suggested = existingEntities.players.filter(existingPlayer => {
                                    if (!existingPlayer.name || !player.name) return false;
                                    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
                                    return (
                                      existingPlayer.name.toLowerCase() === player.name.toLowerCase() ||
                                      normalize(existingPlayer.name) === normalize(player.name) ||
                                      calculateSimilarity(player.name.toLowerCase(), existingPlayer.name.toLowerCase()) > 0.85
                                    );
                                  });
                                  
                                  // Filter players based on search
                                  const filteredSuggested = suggested.filter(p => 
                                    p.name.toLowerCase().includes(searchQuery)
                                  );
                                  const filteredOthers = existingEntities.players
                                    .filter(p => !suggested.some(s => s.player_id === p.player_id))
                                    .filter(p => p.name.toLowerCase().includes(searchQuery))
                                    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                                  
                                  return (
                                    <>
                                      {/* Suggested Matches */}
                                      {filteredSuggested.length > 0 && (
                                        <>
                                          <div className="px-3 py-1 text-xs font-semibold text-gray-600 bg-gray-50">
                                            🎯 Suggested Matches
                                          </div>
                                          {filteredSuggested.map(existingPlayer => (
                                            <div
                                              key={existingPlayer.player_id}
                                              className="px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer"
                                              onClick={() => {
                                                handlePlayerChange(index, 'linked_player_id', existingPlayer.player_id);
                                                setOpenPlayerDropdown(null);
                                                const newMap = new Map(playerSearchQuery);
                                                newMap.delete(index);
                                                setPlayerSearchQuery(newMap);
                                              }}
                                            >
                                              {existingPlayer.name}
                                            </div>
                                          ))}
                                        </>
                                      )}
                                      
                                      {/* All Other Players */}
                                      {filteredOthers.length > 0 && (
                                        <>
                                          <div className="px-3 py-1 text-xs font-semibold text-gray-600 bg-gray-50">
                                            📋 All Other Players
                                          </div>
                                          {filteredOthers.map(existingPlayer => (
                                            <div
                                              key={existingPlayer.player_id}
                                              className="px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer"
                                              onClick={() => {
                                                handlePlayerChange(index, 'linked_player_id', existingPlayer.player_id);
                                                setOpenPlayerDropdown(null);
                                                const newMap = new Map(playerSearchQuery);
                                                newMap.delete(index);
                                                setPlayerSearchQuery(newMap);
                                              }}
                                            >
                                              {existingPlayer.name}
                                            </div>
                                          ))}
                                        </>
                                      )}
                                      
                                      {/* No results */}
                                      {filteredSuggested.length === 0 && filteredOthers.length === 0 && (
                                        <div className="px-3 py-2 text-xs text-gray-500">
                                          No players found
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                        {player.linked_player_id && (
                          <div className="text-xs text-green-600 mt-1 font-medium">
                            ✅ Linked • Change if needed
                          </div>
                        )}
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
                          value={player.goals_scored ?? ''}
                          onChange={(e) => handlePlayerChange(index, 'goals_scored', e.target.value === '' ? null : parseFloat(e.target.value))}
                          step="0.1"
                          placeholder="N/A"
                          className={`w-20 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`player-${index}-goals_scored`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={player.goals_per_game ?? ''}
                          onChange={(e) => handlePlayerChange(index, 'goals_per_game', e.target.value === '' ? null : parseFloat(e.target.value))}
                          step="0.1"
                          placeholder="N/A"
                          className={`w-20 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`player-${index}-goals_per_game`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={player.goals_conceded ?? ''}
                          onChange={(e) => handlePlayerChange(index, 'goals_conceded', e.target.value === '' ? null : parseFloat(e.target.value))}
                          step="0.1"
                          placeholder="N/A"
                          className={`w-20 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`player-${index}-goals_conceded`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={player.conceded_per_game ?? ''}
                          onChange={(e) => handlePlayerChange(index, 'conceded_per_game', e.target.value === '' ? null : parseFloat(e.target.value))}
                          step="0.1"
                          placeholder="N/A"
                          className={`w-20 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`player-${index}-conceded_per_game`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={player.net_goals ?? ''}
                          onChange={(e) => handlePlayerChange(index, 'net_goals', e.target.value === '' ? null : parseFloat(e.target.value))}
                          step="0.1"
                          placeholder="N/A"
                          className={`w-20 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`player-${index}-net_goals`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={player.cleansheets ?? ''}
                          onChange={(e) => handlePlayerChange(index, 'cleansheets', e.target.value === '' ? null : parseFloat(e.target.value))}
                          step="0.1"
                          placeholder="N/A"
                          className={`w-20 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`player-${index}-cleansheets`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={player.potm ?? ''}
                          onChange={(e) => handlePlayerChange(index, 'potm', e.target.value === '' ? null : parseInt(e.target.value))}
                          placeholder="N/A"
                          className={`w-20 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`player-${index}-potm`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={player.points ?? ''}
                          onChange={(e) => handlePlayerChange(index, 'points', e.target.value === '' ? null : parseFloat(e.target.value))}
                          step="0.1"
                          placeholder="N/A"
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
                          value={player.total_points ?? ''}
                          onChange={(e) => handlePlayerChange(index, 'total_points', e.target.value === '' ? null : parseFloat(e.target.value))}
                          step="0.1"
                          placeholder="N/A"
                          className={`w-20 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
                            validationErrors.has(`player-${index}-total_points`) ? 'border-red-500 bg-red-50' : ''
                          }`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={player.category_wise_trophy_1 || ''}
                          onChange={(e) => handlePlayerChange(index, 'category_wise_trophy_1', e.target.value)}
                          className="w-32 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1"
                          placeholder="Optional"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={player.category_wise_trophy_2 || ''}
                          onChange={(e) => handlePlayerChange(index, 'category_wise_trophy_2', e.target.value)}
                          className="w-32 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1"
                          placeholder="Optional"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={player.individual_wise_trophy_1 || ''}
                          onChange={(e) => handlePlayerChange(index, 'individual_wise_trophy_1', e.target.value)}
                          className="w-32 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1"
                          placeholder="Optional"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={player.individual_wise_trophy_2 || ''}
                          onChange={(e) => handlePlayerChange(index, 'individual_wise_trophy_2', e.target.value)}
                          className="w-32 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1"
                          placeholder="Optional"
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
