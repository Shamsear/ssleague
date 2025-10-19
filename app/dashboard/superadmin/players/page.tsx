'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getAllRealPlayers, getRealPlayerStatistics, createRealPlayer } from '@/lib/firebase/realPlayers';
import { RealPlayerData } from '@/types/realPlayer';
import { db } from '@/lib/firebase/config';
import { collection, getDocs } from 'firebase/firestore';

export default function PlayersManagement() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // Real data from Firestore
  const [stats, setStats] = useState({
    totalPlayers: 0,
    registeredPlayers: 0,
    unregisteredPlayers: 0,
  });

  const [seasonsWithPlayers, setSeasonsWithPlayers] = useState<{
    id: string;
    name: string;
    playerCount: number;
  }[]>([]);

  const [players, setPlayers] = useState<RealPlayerData[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<RealPlayerData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'registered' | 'unregistered'>('all');
  const [error, setError] = useState<string | null>(null);
  
  // Form state for adding single player
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [playerName, setPlayerName] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Fetch real players data
  useEffect(() => {
    const fetchPlayersData = async () => {
      if (!user || user.role !== 'super_admin') return;

      try {
        setLoadingData(true);
        setError(null);
        
        // Fetch all players
        const allPlayers = await getAllRealPlayers();
        setPlayers(allPlayers);

        // Calculate statistics
        const playerStats = await getRealPlayerStatistics();
        setStats({
          totalPlayers: playerStats.totalPlayers,
          registeredPlayers: allPlayers.filter(p => p.is_registered).length,
          unregisteredPlayers: allPlayers.filter(p => !p.is_registered).length,
        });

        // Calculate players by season from realplayer collection (actual registrations)
        const [realPlayerRegistrations, seasonsSnapshot] = await Promise.all([
          getDocs(collection(db, 'realplayer')),
          getDocs(collection(db, 'seasons'))
        ]);
        
        // Create a map of season IDs to names
        const seasonNames = new Map<string, string>();
        seasonsSnapshot.docs.forEach(doc => {
          seasonNames.set(doc.id, doc.data().name || `Season ${doc.id.replace('SSPSLS', '')}`);
        });
        
        const seasonMap = new Map<string, { name: string; players: Set<string> }>();
        
        realPlayerRegistrations.docs.forEach(doc => {
          const data = doc.data();
          const seasonId = data.season_id;
          const playerId = data.player_id;
          
          if (seasonId && playerId) {
            const seasonName = seasonNames.get(seasonId) || `Season ${seasonId.replace('SSPSLS', '')}`;
            
            const existing = seasonMap.get(seasonId);
            if (existing) {
              existing.players.add(playerId);
            } else {
              seasonMap.set(seasonId, {
                name: seasonName,
                players: new Set([playerId])
              });
            }
          }
        });
        
        // Convert player sets to counts
        const seasonsArray = Array.from(seasonMap.entries()).map(([id, data]) => ({
          id,
          name: data.name,
          playerCount: data.players.size
        }));
        setSeasonsWithPlayers(seasonsArray);

      } catch (error) {
        console.error('Error fetching players data:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to load players data';
        setError(errorMessage);
      } finally {
        setLoadingData(false);
      }
    };

    fetchPlayersData();
  }, [user]);

  // Filter and search players
  useEffect(() => {
    let filtered = players;

    // Apply status filter
    if (filterStatus === 'registered') {
      filtered = filtered.filter(p => p.is_registered);
    } else if (filterStatus === 'unregistered') {
      filtered = filtered.filter(p => !p.is_registered);
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => {
        // Search in player name and ID
        const matchesBasicInfo = 
          p.name.toLowerCase().includes(term) ||
          p.player_id.toLowerCase().includes(term) ||
          (p.display_name && p.display_name.toLowerCase().includes(term));
        
        // Search in team info (team_name is the assigned team, team is previous team)
        const matchesTeam = 
          (p.team_name && p.team_name.toLowerCase().includes(term)) ||
          (p.team && p.team.toLowerCase().includes(term)) ||
          (p.team_code && p.team_code.toLowerCase().includes(term));
        
        // Search in season info
        const matchesSeason = 
          (p.season_name && p.season_name.toLowerCase().includes(term));
        
        return matchesBasicInfo || matchesTeam || matchesSeason;
      });
    }

    setFilteredPlayers(filtered);
  }, [players, searchTerm, filterStatus]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      alert('Please select a file first');
      return;
    }

    // Validate file type
    const validTypes = ['.xlsx', '.xls', '.csv'];
    const fileExtension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
    
    if (!validTypes.includes(fileExtension)) {
      alert('Please upload a valid Excel (.xlsx, .xls) or CSV file');
      return;
    }

    setUploading(true);
    
    try {
      // Read the file
      const text = await selectedFile.text();
      
      // Parse CSV
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        alert('File is empty or has no data rows');
        setUploading(false);
        return;
      }
      
      // Get headers (first line)
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      // Find column indices
      const playerIdIndex = headers.findIndex(h => h === 'player_id');
      const nameIndex = headers.findIndex(h => h === 'name');
      
      if (nameIndex === -1) {
        alert('CSV file must have a "name" column');
        setUploading(false);
        return;
      }
      
      // Parse data rows (skip header)
      const players: Array<{ player_id?: string; name: string }> = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const playerName = values[nameIndex];
        const playerId = playerIdIndex !== -1 ? values[playerIdIndex] : undefined;
        
        if (playerName) {
          players.push({
            player_id: playerId || undefined,
            name: playerName
          });
        }
      }
      
      if (players.length === 0) {
        alert('No valid player names found in file');
        setUploading(false);
        return;
      }
      
      // Store in sessionStorage to pass to preview page
      sessionStorage.setItem('importPlayers', JSON.stringify(players));
      
      // Redirect to preview page
      router.push('/dashboard/superadmin/players/import-preview');
    } catch (error) {
      console.error('Error reading file:', error);
      alert('Failed to read file. Please make sure it is a valid CSV file.');
      setUploading(false);
    }
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!playerName.trim()) {
      alert('Please enter a player name');
      return;
    }
    
    try {
      setAddingPlayer(true);
      
      // Create player with only name (other fields will be assigned later)
      await createRealPlayer({
        name: playerName.trim(),
      }, user?.uid);
      
      // Clear form
      setPlayerName('');
      
      // Refresh players list
      const allPlayers = await getAllRealPlayers();
      setPlayers(allPlayers);
      
      // Update statistics
      const playerStats = await getRealPlayerStatistics();
      setStats({
        totalPlayers: playerStats.totalPlayers,
        registeredPlayers: allPlayers.filter(p => p.is_registered).length,
        unregisteredPlayers: allPlayers.filter(p => !p.is_registered).length,
      });
      
      // Recalculate seasons with players
      const seasonMap = new Map<string, { name: string; count: number }>();
      allPlayers.forEach(player => {
        if (player.season_id && player.season_name) {
          const existing = seasonMap.get(player.season_id);
          if (existing) {
            existing.count++;
          } else {
            seasonMap.set(player.season_id, {
              name: player.season_name,
              count: 1
            });
          }
        }
      });
      
      const seasonsArray = Array.from(seasonMap.entries()).map(([id, data]) => ({
        id,
        name: data.name,
        playerCount: data.count
      }));
      setSeasonsWithPlayers(seasonsArray);
      
      alert('Player added successfully!');
    } catch (error) {
      console.error('Error adding player:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to add player';
      alert(`Error: ${errorMessage}`);
    } finally {
      setAddingPlayer(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      // Fetch all real players from Firestore
      const allPlayers = await getAllRealPlayers();
      
      let csvRows: string[];
      let filename: string;
      
      if (allPlayers.length === 0) {
        // No players in database - provide sample template
        csvRows = [
          // Header
          'player_id,name',
          // Sample data for bulk import
          ',Cristiano Ronaldo',
          ',Lionel Messi',
          ',Neymar Jr',
          ',Kylian Mbappe',
          ',Erling Haaland',
          ',Kevin De Bruyne',
          ',Mohamed Salah',
          ',', // Empty row for user input
          ',', // Empty row for user input
          ',', // Empty row for user input
        ];
        filename = 'player_import_template.csv';
      } else {
        // Export existing players
        csvRows = [
          // Header
          'player_id,name',
          // Data rows - all existing players
          ...allPlayers.map(player => 
            `${player.player_id},${player.name}`
          )
        ];
        filename = `realplayers_export_${new Date().toISOString().split('T')[0]}.csv`;
      }
      
      const csvContent = csvRows.join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Cleanup
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading template:', error);
      alert('Failed to download template. Please try again.');
    }
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return 'N/A';
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      if (isNaN(dateObj.getTime())) return 'Invalid Date';
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  if (loading || loadingData) {
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
      <div className="container mx-auto max-w-screen-2xl">
        {/* Page Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => router.push('/dashboard/superadmin')}
              className="p-2 rounded-xl hover:bg-white/50 transition-colors"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-3xl md:text-4xl font-bold gradient-text">Player Database</h1>
          </div>
          <p className="text-gray-600 text-sm md:text-base ml-14">Manage all players in the system</p>
        </header>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm text-red-800 font-medium">Error loading players data</p>
                <p className="text-xs text-red-700 mt-1">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-600 hover:text-red-800"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Statistics Section */}
        <div className="glass rounded-3xl p-4 sm:p-6 mb-8 shadow-lg backdrop-blur-md border border-white/20">
          <h2 className="text-xl font-bold gradient-text mb-6">Player Statistics</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="glass p-6 rounded-xl bg-white/10 shadow-sm border border-gray-100/20 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Players</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.totalPlayers}</dd>
                  </dl>
                </div>
              </div>
            </div>
            
            <div className="glass p-6 rounded-xl bg-white/10 shadow-sm border border-gray-100/20 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Registered Players</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.registeredPlayers}</dd>
                  </dl>
                </div>
              </div>
            </div>
            
            <div className="glass p-6 rounded-xl bg-white/10 shadow-sm border border-gray-100/20 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Unregistered Players</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.unregisteredPlayers}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Season Breakdown */}
          {seasonsWithPlayers.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Players by Season</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {seasonsWithPlayers.map((season) => (
                  season.playerCount > 0 && (
                    <div key={season.id} className="glass p-3 rounded-lg bg-white/20">
                      <p className="text-sm font-medium text-gray-700">{season.name}</p>
                      <p className="text-lg font-bold text-[#0066FF]">{season.playerCount} players</p>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bulk Import Section */}
        <div className="glass rounded-3xl p-4 sm:p-6 mb-8 shadow-lg backdrop-blur-md border border-white/20">
          <h2 className="text-xl font-bold gradient-text mb-6">Bulk Import Players</h2>
          
          <div className="bg-blue-50/50 rounded-lg p-4 mb-6 border border-blue-100">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm text-blue-800 mb-2"><strong>Import Instructions:</strong></p>
                <ul className="text-xs text-blue-700 list-disc list-inside space-y-1">
                  <li><strong>Download Template:</strong> Click below to export all existing players with their IDs and names</li>
                  <li><strong>Edit Names:</strong> Update player names in the CSV file as needed</li>
                  <li><strong>Add New Players:</strong> Add new rows with empty player_id to create new players</li>
                  <li><strong>Player IDs:</strong> Existing players must keep their player_id. New players will get auto-generated IDs</li>
                  <li><strong>Supported formats:</strong> Excel (.xlsx, .xls) or CSV files</li>
                </ul>
              </div>
            </div>
          </div>
          
          {/* Download Template Button */}
          <div className="mb-6">
            <button
              onClick={handleDownloadTemplate}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              Download CSV Template
            </button>
            <p className="text-xs text-gray-500 mt-2">
              {stats.totalPlayers > 0 
                ? `Exports all ${stats.totalPlayers} existing players for editing`
                : 'Downloads a sample template with example player names'}
            </p>
          </div>
          
          <form onSubmit={handleFileUpload} className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
              <div className="flex-grow w-full">
                <label htmlFor="player_file" className="block text-sm font-medium text-gray-700 mb-2">
                  Select Player File
                </label>
                <input
                  type="file"
                  id="player_file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all"
                />
                {selectedFile && (
                  <p className="mt-2 text-sm text-gray-600">
                    Selected: <span className="font-medium">{selectedFile.name}</span>
                  </p>
                )}
              </div>
              <div className="flex-shrink-0 w-full sm:w-auto">
                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="w-full sm:w-auto px-6 py-3 bg-[#0066FF] text-white rounded-xl hover:bg-[#0066FF]/90 transition-colors duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Import Players
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Add Single Player Section */}
        <div className="glass rounded-3xl p-4 sm:p-6 mb-8 shadow-lg backdrop-blur-md border border-white/20">
          <h2 className="text-xl font-bold gradient-text mb-6">Add New Player</h2>
          
          <div className="bg-blue-50/50 rounded-lg p-4 mb-6 border border-blue-100">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm text-blue-800"><strong>Note:</strong> Only player name is required. Season, team, and other details will be assigned later.</p>
              </div>
            </div>
          </div>
          
          <form onSubmit={handleAddPlayer} className="space-y-6">
            <div>
              <label htmlFor="player_name" className="block text-sm font-medium text-gray-700 mb-2">
                Player Name *
              </label>
              <input
                type="text"
                id="player_name"
                name="player_name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                required
                disabled={addingPlayer}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Enter player name"
              />
            </div>
            
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={addingPlayer || !playerName.trim()}
                className="px-6 py-3 bg-[#0066FF] text-white rounded-xl hover:bg-[#0066FF]/90 transition-colors duration-200 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingPlayer ? (
                  <>
                    <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Adding...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Player
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Players List */}
        <div className="glass rounded-3xl p-4 sm:p-6 shadow-lg backdrop-blur-md border border-white/20">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h2 className="text-xl font-bold gradient-text">All Players</h2>
            <button
              onClick={async () => {
                setLoadingData(true);
                try {
                  const allPlayers = await getAllRealPlayers();
                  setPlayers(allPlayers);
                  
                  // Calculate statistics
                  const playerStats = await getRealPlayerStatistics();
                  setStats({
                    totalPlayers: playerStats.totalPlayers,
                    registeredPlayers: allPlayers.filter(p => p.is_registered).length,
                    unregisteredPlayers: allPlayers.filter(p => !p.is_registered).length,
                  });
                  
                  // Recalculate seasons with players
                  const seasonMap = new Map<string, { name: string; count: number }>();
                  allPlayers.forEach(player => {
                    if (player.season_id && player.season_name) {
                      const existing = seasonMap.get(player.season_id);
                      if (existing) {
                        existing.count++;
                      } else {
                        seasonMap.set(player.season_id, {
                          name: player.season_name,
                          count: 1
                        });
                      }
                    }
                  });
                  
                  const seasonsArray = Array.from(seasonMap.entries()).map(([id, data]) => ({
                    id,
                    name: data.name,
                    playerCount: data.count
                  }));
                  setSeasonsWithPlayers(seasonsArray);
                } catch (error) {
                  console.error('Error refreshing players:', error);
                  alert('Failed to refresh players data. Please try again.');
                } finally {
                  setLoadingData(false);
                }
              }}
              disabled={loadingData}
              className="inline-flex items-center px-4 py-2 bg-white/50 hover:bg-white/80 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className={`w-4 h-4 mr-2 ${loadingData ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
          
          {/* Search and Filter */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="flex-grow">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by name, ID, team, or season..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2.5 pl-10 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all"
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  filterStatus === 'all'
                    ? 'bg-[#0066FF] text-white'
                    : 'bg-white/50 text-gray-700 hover:bg-white/80'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterStatus('registered')}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  filterStatus === 'registered'
                    ? 'bg-green-600 text-white'
                    : 'bg-white/50 text-gray-700 hover:bg-white/80'
                }`}
              >
                Registered
              </button>
              <button
                onClick={() => setFilterStatus('unregistered')}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  filterStatus === 'unregistered'
                    ? 'bg-amber-600 text-white'
                    : 'bg-white/50 text-gray-700 hover:bg-white/80'
                }`}
              >
                Unregistered
              </button>
            </div>
          </div>
          
          {/* Results count */}
          {players.length > 0 && (
            <div className="mb-4 text-sm text-gray-600">
              Showing <span className="font-semibold text-gray-800">{filteredPlayers.length}</span> of <span className="font-semibold text-gray-800">{players.length}</span> players
            </div>
          )}
          
          {filteredPlayers.length > 0 ? (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto rounded-xl shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Player ID</th>
                      <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                      <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Team</th>
                      <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Season</th>
                      <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                      <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white/30">
                    {filteredPlayers.map((player) => (
                      <tr key={player.id} className="hover:bg-white/60 transition-colors">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="text-sm font-mono text-[#0066FF] font-medium">{player.player_id}</span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-800">{player.name}</div>
                          {player.display_name && (
                            <div className="text-xs text-gray-500">({player.display_name})</div>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-700">
                            {player.team_name ? (
                              <span className="font-medium">{player.team_name}</span>
                            ) : player.team ? (
                              <span className="text-gray-500">{player.team}</span>
                            ) : (
                              <span className="text-gray-400">No team</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {player.season_name ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">
                              {player.season_name}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600">
                              No season
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {player.is_registered ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Registered
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-800">
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-xs text-gray-500">
                          {formatDate(player.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {filteredPlayers.map((player) => (
                  <div key={player.id} className="bg-white/30 backdrop-blur-sm rounded-xl shadow-sm p-4 border border-gray-100">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-base font-semibold text-gray-800">{player.name}</h3>
                        {player.display_name && (
                          <p className="text-xs text-gray-500">({player.display_name})</p>
                        )}
                        <p className="text-sm font-mono text-[#0066FF]">{player.player_id}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600">Team:</span>{' '}
                        {player.team_name ? (
                          <span className="font-medium">{player.team_name}</span>
                        ) : player.team ? (
                          <span className="text-gray-500">{player.team}</span>
                        ) : (
                          <span className="text-gray-400">No team</span>
                        )}
                      </div>
                      <div>
                        <span className="text-gray-600">Season:</span>{' '}
                        {player.season_name ? (
                          <span className="text-green-600">{player.season_name}</span>
                        ) : (
                          <span className="text-gray-400">No season</span>
                        )}
                      </div>
                      <div>
                        <span className="text-gray-600">Status:</span>{' '}
                        {player.is_registered ? (
                          <span className="text-green-600">Registered</span>
                        ) : (
                          <span className="text-amber-600">Pending</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <h3 className="text-xl font-medium text-gray-600 mb-2">No players found</h3>
              <p className="text-gray-500 mb-4">Start by importing players using the bulk import feature above</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
