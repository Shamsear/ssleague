'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePermissions } from '@/hooks/usePermissions';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useModal } from '@/hooks/useModal';
import AlertModal from '@/components/modals/AlertModal';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface RealPlayer {
  id: string;
  player_id: string;
  name: string;
  team_id?: string | null;
  team_name?: string;
  category_id?: string | null;
  category_name?: string;
  season_id?: string | null;
  season_name?: string;
}

interface Team {
  id: string;
  team_name: string;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

export default function TeamMembersPage() {
  const { user, loading } = useAuth();
  const { userSeasonId } = usePermissions();
  const router = useRouter();
  const [realPlayers, setRealPlayers] = useState<RealPlayer[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<RealPlayer[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [teamFilter, setTeamFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Individual assignment
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  
  // Bulk assignment
  const [bulkTeam, setBulkTeam] = useState('');
  const [bulkCategory, setBulkCategory] = useState('');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);
  
  // Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Preview
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [validationResults, setValidationResults] = useState<any[]>([]);
  
  // UI states
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);

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
    const fetchData = async () => {
      if (!userSeasonId) {
        console.log('No season assigned to committee admin');
        setIsLoading(false);
        return;
      }
      
      try {
        // Fetch registered players for this season from realplayer collection
        const realplayerQuery = query(
          collection(db, 'realplayer'),
          where('season_id', '==', userSeasonId)
        );
        const realplayerSnapshot = await getDocs(realplayerQuery);
        
        console.log(`📋 Fetched ${realplayerSnapshot.docs.length} registered players for season ${userSeasonId}`);
        
        const registeredPlayers = realplayerSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            player_id: data.player_id || '',
            name: data.name || '',
            team_id: data.team_id || null,
            team_name: data.team_name || '',
            category_id: data.category_id || null,
            category_name: data.category_name || '',
            season_id: data.season_id || null,
            season_name: data.season_name || '',
          };
        });
        
        setRealPlayers(registeredPlayers);
        
        // Fetch teams registered for this season from team_seasons collection
        const teamSeasonsQuery = query(
          collection(db, 'team_seasons'),
          where('season_id', '==', userSeasonId),
          where('status', '==', 'registered')
        );
        const teamSeasonsSnapshot = await getDocs(teamSeasonsQuery);
        
        console.log(`📋 Fetched ${teamSeasonsSnapshot.docs.length} registered teams for season ${userSeasonId}`);
        
        // Get team IDs from team_seasons
        const teamIds = teamSeasonsSnapshot.docs.map(doc => doc.data().team_id).filter(Boolean);
        
        // Fetch team details from teams collection
        const teamsData: Team[] = [];
        for (const teamId of teamIds) {
          const teamQuery = query(
            collection(db, 'teams'),
            where('id', '==', teamId)
          );
          const teamSnapshot = await getDocs(teamQuery);
          if (!teamSnapshot.empty) {
            const teamDoc = teamSnapshot.docs[0];
            teamsData.push({
              id: teamDoc.id,
              team_name: teamDoc.data().team_name || 'Unknown Team',
            });
          }
        }
        
        console.log(`📋 Fetched ${teamsData.length} team details`);
        setTeams(teamsData);
        
        // Fetch categories
        const categoriesRes = await fetchWithTokenRefresh(/api/categories');
        const categoriesData = await categoriesRes.json();
        if (categoriesData.success) setCategories(categoriesData.data);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user?.role === 'committee_admin' && userSeasonId) {
      fetchData();
    }
  }, [user, userSeasonId]);

  useEffect(() => {
    let filtered = realPlayers;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.player_id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Team filter
    if (teamFilter === 'unassigned') {
      filtered = filtered.filter((p) => !p.team_id);
    } else if (teamFilter) {
      filtered = filtered.filter((p) => p.team_id === teamFilter);
    }

    // Category filter
    if (categoryFilter === 'unassigned') {
      filtered = filtered.filter((p) => !p.category_id);
    } else if (categoryFilter) {
      filtered = filtered.filter((p) => p.category_id === categoryFilter);
    }

    setFilteredPlayers(filtered);
  }, [realPlayers, searchTerm, teamFilter, categoryFilter]);

  const handleIndividualAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetchWithTokenRefresh(`/api/real-players/${selectedPlayer}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: selectedTeam,
          category_id: selectedCategory,
        }),
      });

      if (response.ok) {
        closeAlert();
        showAlert({
          type: 'success',
          title: 'Player Assigned',
          message: 'Player assigned successfully!'
        });
        setSelectedPlayer('');
        setSelectedTeam('');
        setSelectedCategory('');
        window.location.reload();
      } else {
        const error = await response.json();
        closeAlert();
        showAlert({
          type: 'error',
          title: 'Assignment Failed',
          message: `Error: ${error.error}`
        });
      }
    } catch (error) {
      console.error('Error assigning player:', error);
      closeAlert();
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to assign player'
      });
    }
  };
  
  const handleBulkAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedPlayerIds.length === 0) {
      showAlert({
        type: 'warning',
        title: 'No Selection',
        message: 'Please select at least one player'
      });
      return;
    }
    
    if (!bulkTeam && !bulkCategory) {
      showAlert({
        type: 'warning',
        title: 'Missing Selection',
        message: 'Please select at least a team or category'
      });
      return;
    }
    
    setIsBulkAssigning(true);
    
    try {
      const updates = selectedPlayerIds.map(async (playerId) => {
        const response = await fetchWithTokenRefresh(`/api/real-players/${playerId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            team_id: bulkTeam || undefined,
            category_id: bulkCategory || undefined,
          }),
        });
        return response.ok;
      });
      
      const results = await Promise.all(updates);
      const successCount = results.filter(Boolean).length;
      
      showAlert({
        type: 'success',
        title: 'Bulk Assignment Complete',
        message: `Successfully assigned ${successCount} out of ${selectedPlayerIds.length} players`
      });
      setSelectedPlayerIds([]);
      setBulkTeam('');
      setBulkCategory('');
      window.location.reload();
    } catch (error) {
      console.error('Error bulk assigning players:', error);
      showAlert({
        type: 'error',
        title: 'Bulk Assignment Failed',
        message: 'Failed to assign players'
      });
    } finally {
      setIsBulkAssigning(false);
    }
  };
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const isCSV = file.name.endsWith('.csv');
    const isXLSX = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    
    if (!isCSV && !isXLSX) {
      showAlert({
        type: 'error',
        title: 'Invalid File',
        message: 'Please upload a CSV or Excel file (.csv, .xlsx, .xls)'
      });
      return;
    }
    
    setIsUploading(true);
    
    try {
      let parsedData: any[] = [];
      
      if (isCSV) {
        // Parse CSV
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          showAlert({
            type: 'error',
            title: 'Empty File',
            message: 'CSV file is empty or invalid'
          });
          setIsUploading(false);
          return;
        }
        
        // Skip header row
        const dataLines = lines.slice(1);
        parsedData = dataLines.map(line => {
          const [playerId, teamName, categoryName] = line.split(',').map(s => s.trim());
          return { playerId, teamName, categoryName };
        }).filter(row => row.playerId);
      } else {
        // Parse Excel using ExcelJS
        const ExcelJS = (await import('exceljs')).default;
        const buffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        
        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          showAlert({
            type: 'error',
            title: 'Empty File',
            message: 'Excel file is empty'
          });
          setIsUploading(false);
          return;
        }
        
        // Skip header row (row 1), start from row 2
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header
          
          const playerId = row.getCell(1).value?.toString().trim() || '';
          const teamName = row.getCell(2).value?.toString().trim() || '';
          const categoryName = row.getCell(3).value?.toString().trim() || '';
          
          if (playerId) {
            parsedData.push({ playerId, teamName, categoryName });
          }
        });
      }
      
      if (parsedData.length === 0) {
        showAlert({
          type: 'error',
          title: 'No Data',
          message: 'No valid data found in file'
        });
        setIsUploading(false);
        return;
      }
      
      // Validate data
      const validated = parsedData.map(row => {
        const player = realPlayers.find(p => p.player_id === row.playerId);
        const team = teams.find(t => t.team_name === row.teamName);
        const category = categories.find(c => c.name === row.categoryName);
        
        const errors: string[] = [];
        if (!player) errors.push('Player not found');
        if (row.teamName && !team) errors.push('Team not found');
        if (row.categoryName && !category) errors.push('Category not found');
        
        return {
          ...row,
          player,
          team,
          category,
          isValid: errors.length === 0,
          errors,
        };
      });
      
      setPreviewData(parsedData);
      setValidationResults(validated);
      setShowPreview(true);
      setIsUploading(false);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error processing file:', error);
      showAlert({
        type: 'error',
        title: 'Processing Failed',
        message: 'Failed to process file'
      });
      setIsUploading(false);
    }
  };
  
  const confirmUpload = async () => {
    setIsUploading(true);
    
    try {
      let successCount = 0;
      let errorCount = 0;
      
      for (const row of validationResults) {
        if (!row.isValid || !row.player) {
          errorCount++;
          continue;
        }
        
        try {
          const response = await fetchWithTokenRefresh(`/api/real-players/${row.player.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              team_id: row.team?.id || null,
              category_id: row.category?.id || null,
            }),
          });
          
          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch {
          errorCount++;
        }
      }
      
      showAlert({
        type: 'success',
        title: 'Upload Complete',
        message: `Upload complete!\nSuccess: ${successCount}\nErrors: ${errorCount}`
      });
      setShowPreview(false);
      setPreviewData([]);
      setValidationResults([]);
      window.location.reload();
    } catch (error) {
      console.error('Error uploading data:', error);
      showAlert({
        type: 'error',
        title: 'Upload Failed',
        message: 'Failed to upload data'
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  const cancelUpload = () => {
    setShowPreview(false);
    setPreviewData([]);
    setValidationResults([]);
  };
  
  const togglePlayerSelection = (playerId: string) => {
    setSelectedPlayerIds(prev => 
      prev.includes(playerId) 
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };
  
  const toggleSelectAll = () => {
    if (selectedPlayerIds.length === filteredPlayers.length) {
      setSelectedPlayerIds([]);
    } else {
      setSelectedPlayerIds(filteredPlayers.map(p => p.id));
    }
  };
  
  const exportToCSV = () => {
    const headers = ['Player ID', 'Name', 'Team', 'Category'];
    const rows = filteredPlayers.map(p => [
      p.player_id,
      p.name,
      p.team_name || '',
      p.category_name || ''
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `team-members-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const downloadTemplate = () => {
    const headers = ['player_id', 'team_name', 'category_name'];
    const example = ['SS001', 'Team A', 'Red Ball'];
    const csv = [headers, example].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'team-members-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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

  const getColorClass = (color: string) => {
    const colorMap: { [key: string]: string } = {
      red: 'bg-red-600',
      blue: 'bg-blue-600',
      black: 'bg-black',
      white: 'bg-white border-2 border-gray-300',
    };
    return colorMap[color] || 'bg-gray-200';
  };

  const stats = {
    total: realPlayers.length,
    assigned: realPlayers.filter(p => p.team_id && p.category_id).length,
    unassigned: realPlayers.filter(p => !p.team_id || !p.category_id).length,
    selected: selectedPlayerIds.length,
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">Assign Players to Teams</h1>
          <p className="text-gray-500 mt-1">Assign registered real players to teams with categories</p>
          <Link
            href="/dashboard/committee/team-management"
            className="inline-flex items-center mt-2 text-[#0066FF] hover:text-[#0052CC]"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors flex items-center text-sm"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
          <button
            onClick={() => setShowUploadForm(!showUploadForm)}
            className="px-4 py-2 bg-[#0066FF] text-white rounded-xl hover:bg-[#0052CC] transition-colors flex items-center text-sm"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload CSV
          </button>
        </div>
      </div>
      
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 backdrop-blur-md rounded-xl p-4 border border-blue-200/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Total Players</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 0 1 9.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 backdrop-blur-md rounded-xl p-4 border border-green-200/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Assigned</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.assigned}</p>
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
              <p className="text-sm text-gray-600 font-medium">Unassigned</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.unassigned}</p>
            </div>
            <div className="p-3 bg-orange-500/20 rounded-lg">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 backdrop-blur-md rounded-xl p-4 border border-purple-200/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Selected</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.selected}</p>
            </div>
            <div className="p-3 bg-purple-500/20 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      
      {/* Upload Form */}
      {showUploadForm && (
        <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-6 mb-6 border border-gray-100/20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Upload Players from CSV</h2>
            <button
              onClick={() => setShowUploadForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <p className="text-sm text-blue-800 mb-2">
              <strong>Supported formats:</strong> CSV (.csv) or Excel (.xlsx, .xls)
            </p>
            <p className="text-sm text-blue-800 mb-2">
              <strong>Columns:</strong> player_id, team_name, category_name
            </p>
            <button
              onClick={downloadTemplate}
              className="text-sm text-blue-600 hover:text-blue-800 underline flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Template CSV
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="flex-1 text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-[#0066FF] file:text-white hover:file:bg-[#0052CC] file:cursor-pointer"
              disabled={isUploading}
            />
            {isUploading && (
              <div className="flex items-center text-[#0066FF]">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#0066FF] mr-2"></div>
                <span className="text-sm">Processing...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bulk Assignment Form */}
      {selectedPlayerIds.length > 0 && (
        <div className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 backdrop-blur-md shadow-lg rounded-2xl p-6 mb-6 border border-purple-200/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Bulk Assignment ({selectedPlayerIds.length} selected)
            </h2>
            <button
              onClick={() => setSelectedPlayerIds([])}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Clear Selection
            </button>
          </div>

          <form onSubmit={handleBulkAssignment} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Assign to Team</label>
              <select
                value={bulkTeam}
                onChange={(e) => setBulkTeam(e.target.value)}
                className="w-full py-2 px-4 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/70"
              >
                <option value="">Keep current team...</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.team_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Assign to Category</label>
              <select
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value)}
                className="w-full py-2 px-4 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/70"
              >
                <option value="">Keep current category...</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={isBulkAssigning}
                className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBulkAssigning ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Assigning...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Assign All Selected
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
      
      {/* Individual Assignment Form */}
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-6 mb-6 border border-gray-100/20">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Individual Player Assignment</h2>

        <form onSubmit={handleIndividualAssignment} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Player</label>
            <select
              value={selectedPlayer}
              onChange={(e) => setSelectedPlayer(e.target.value)}
              required
              className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
            >
              <option value="">Choose a player...</option>
              {realPlayers.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.player_id} - {player.name}
                  {player.team_id && ' (Already Assigned)'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Team</label>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              required
              className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
            >
              <option value="">Choose a team...</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.team_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              required
              className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
            >
              <option value="">Choose a category...</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Assign Player
            </button>
          </div>
        </form>
      </div>

      {/* Filters */}
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-6 mb-6 border border-gray-100/20">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Filter Registered Players</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or ID..."
              className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Team</label>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
            >
              <option value="">All Teams</option>
              <option value="unassigned">Unassigned</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.team_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full py-2 px-4 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]/70"
            >
              <option value="">All Categories</option>
              <option value="unassigned">Unassigned</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Players Table */}
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl overflow-hidden border border-gray-100/20">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">
            Players List ({filteredPlayers.length})
          </h3>
          <button
            onClick={toggleSelectAll}
            className="text-sm text-[#0066FF] hover:text-[#0052CC] font-medium flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            {selectedPlayerIds.length === filteredPlayers.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-6 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={selectedPlayerIds.length === filteredPlayers.length && filteredPlayers.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-[#0066FF] border-gray-300 rounded focus:ring-[#0066FF]"
                  />
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Player
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Team
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contract
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white/60 divide-y divide-gray-200/50">
              {filteredPlayers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No players found
                  </td>
                </tr>
              ) : (
                filteredPlayers.map((player) => (
                  <tr 
                    key={player.id} 
                    className={`hover:bg-gray-50/80 transition-colors ${
                      selectedPlayerIds.includes(player.id) ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedPlayerIds.includes(player.id)}
                        onChange={() => togglePlayerSelection(player.id)}
                        className="w-4 h-4 text-[#0066FF] border-gray-300 rounded focus:ring-[#0066FF]"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{player.name}</div>
                        <div className="text-sm text-gray-500">{player.player_id}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {player.team_name || (
                          <span className="text-gray-400 italic">Not assigned</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {player.category_name ? (
                        <div className="flex items-center">
                          <div
                            className={`h-6 w-6 rounded-full mr-2 ${getColorClass(
                              categories.find((c) => c.id === player.category_id)?.color || ''
                            )}`}
                          ></div>
                          <span className="text-sm text-gray-900">{player.category_name}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Not assigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(player as any).contract_id ? (
                        <div className="text-sm">
                          <div className="flex items-center">
                            {(player as any).is_auto_registered ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Auto (S{(player as any).contract_start_season?.replace(/\D/g, '')})
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                2-Season Contract
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            S{(player as any).contract_start_season?.replace(/\D/g, '')} - S{(player as any).contract_end_season?.replace(/\D/g, '')}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic text-sm">No contract</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link
                        href={`/dashboard/committee/team-management/team-members/${player.id}/edit`}
                        className="text-[#0066FF] hover:text-[#0052CC] font-medium"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                    <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Upload Preview
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Review and validate data before assignment
                  </p>
                </div>
                <button
                  onClick={cancelUpload}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Statistics Bar */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                  <span className="text-sm font-medium text-gray-700">
                    Total: {validationResults.length}
                  </span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                  <span className="text-sm font-medium text-gray-700">
                    Valid: {validationResults.filter(r => r.isValid).length}
                  </span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                  <span className="text-sm font-medium text-gray-700">
                    Invalid: {validationResults.filter(r => !r.isValid).length}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Table Content */}
            <div className="flex-1 overflow-auto p-6">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Player ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Player Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Team
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Issues
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {validationResults.map((row, index) => (
                      <tr 
                        key={index}
                        className={row.isValid ? 'bg-green-50/30' : 'bg-red-50/30'}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          {row.isValid ? (
                            <div className="flex items-center text-green-600">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                          ) : (
                            <div className="flex items-center text-red-600">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">{row.playerId}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {row.player?.name || <span className="text-gray-400 italic">Not found</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {row.teamName ? (
                              row.team ? (
                                row.teamName
                              ) : (
                                <span className="text-red-600">{row.teamName} ✗</span>
                              )
                            ) : (
                              <span className="text-gray-400 italic">-</span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {row.categoryName ? (
                              row.category ? (
                                <div className="flex items-center">
                                  <div
                                    className={`h-4 w-4 rounded-full mr-2 ${getColorClass(row.category.color)}`}
                                  ></div>
                                  {row.categoryName}
                                </div>
                              ) : (
                                <span className="text-red-600">{row.categoryName} ✗</span>
                              )
                            ) : (
                              <span className="text-gray-400 italic">-</span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {row.errors.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {row.errors.map((error: string, i: number) => (
                                <span key={i} className="text-xs text-red-600 font-medium">
                                  • {error}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-green-600 font-medium">✓ Valid</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {validationResults.filter(r => !r.isValid).length > 0 && (
                  <div className="flex items-center text-orange-600">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="font-medium">Invalid entries will be skipped</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={cancelUpload}
                  className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors font-medium"
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmUpload}
                  disabled={isUploading || validationResults.filter(r => r.isValid).length === 0}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isUploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      Confirm & Upload ({validationResults.filter(r => r.isValid).length} valid)
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
