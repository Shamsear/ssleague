'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface Trophy {
  id: number;
  team_id: string;
  team_name: string;
  season_id: string;
  trophy_type: string;
  trophy_name: string;
  trophy_position: string | null;
  position: number | null;
  awarded_by: string;
  notes: string | null;
  created_at: string;
}

interface TrophyPreview {
  team_id: string;
  team_name: string;
  position: number;
  trophy_name: string;
  trophy_type: string;
  tournament_name: string;
  alreadyAwarded: boolean;
}

export default function TrophyManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { isCommitteeAdmin, userSeasonId } = usePermissions();
  
  const [trophies, setTrophies] = useState<Trophy[]>([]);
  const [preview, setPreview] = useState<TrophyPreview[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  const [trophyOptions, setTrophyOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [awarding, setAwarding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // New trophy form
  const [newTrophy, setNewTrophy] = useState({
    team_name: '',
    trophy_type: 'cup',
    trophy_name: '',
    position: '',
    notes: ''
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
    if (!authLoading && user && !isCommitteeAdmin) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router, isCommitteeAdmin]);

  // Load data when season is set
  useEffect(() => {
    if (userSeasonId) {
      fetchTrophies();
      fetchPreview();
      fetchTeams();
      fetchSecondaryTournaments();
    }
  }, [userSeasonId]);

  const fetchTrophies = async () => {
    if (!userSeasonId) return;
    
    setLoading(true);
    try {
      const res = await fetchWithTokenRefresh(`/api/trophies?season_id=${userSeasonId}`);
      const data = await res.json();
      if (data.success) {
        setTrophies(data.trophies || []);
      }
    } catch (err) {
      console.error('Error fetching trophies:', err);
      setError('Failed to load trophies');
    } finally {
      setLoading(false);
    }
  };

  const fetchPreview = async () => {
    if (!userSeasonId) return;
    
    try {
      const res = await fetchWithTokenRefresh(`/api/trophies/preview?season_id=${userSeasonId}`);
      const data = await res.json();
      if (data.success) {
        setPreview(data.preview || []);
      }
    } catch (err) {
      console.error('Error fetching preview:', err);
    }
  };

  const fetchTeams = async () => {
    if (!userSeasonId) return;
    
    try {
      // Fetch teams from teamstats for current season
      const res = await fetchWithTokenRefresh(`/api/stats/teams?season_id=${userSeasonId}`);
      const data = await res.json();
      if (data.success && data.teams) {
        const teamNames = data.teams.map((t: any) => t.team_name).sort();
        setTeams(teamNames);
      }
    } catch (err) {
      console.error('Error fetching teams:', err);
    }
  };

  const fetchSecondaryTournaments = async () => {
    if (!userSeasonId) return;
    
    try {
      // Fetch all tournaments for the season
      const res = await fetchWithTokenRefresh(`/api/tournaments?season_id=${userSeasonId}`);
      const data = await res.json();
      if (data.success && data.tournaments) {
        // Generate trophy options from tournament names
        const options: string[] = data.tournaments.map((t: any) => t.tournament_name);
        // Add custom option at the end
        options.push('Other (Custom)');
        setTrophyOptions(options);
      } else {
        // Fallback to default options if API fails
        setTrophyOptions(['Other (Custom)']);
      }
    } catch (err) {
      console.error('Error fetching tournaments:', err);
      // Fallback to default options
      setTrophyOptions(['Other (Custom)']);
    }
  };

  const handleAutoAward = async () => {
    if (!userSeasonId) return;
    
    setAwarding(true);
    setError(null);
    setSuccess(null);
    
    try {
      const res = await fetchWithTokenRefresh('/api/trophies/award', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season_id: userSeasonId })
      });
      
      const data = await res.json();
      if (data.success) {
        setSuccess(`✅ Awarded ${data.trophiesAwarded} trophies!`);
        fetchTrophies();
        fetchPreview();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to award trophies');
    } finally {
      setAwarding(false);
    }
  };

  const handleDeleteTrophy = async (trophyId: number) => {
    if (!confirm('Delete this trophy?')) return;
    
    setError(null);
    setSuccess(null);
    
    try {
      const res = await fetchWithTokenRefresh(`/api/trophies/${trophyId}`, {
        method: 'DELETE'
      });
      
      const data = await res.json();
      if (data.success) {
        setSuccess('Trophy deleted successfully');
        fetchTrophies();
        fetchPreview();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to delete trophy');
    }
  };

  const handleAddTrophy = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userSeasonId || !newTrophy.team_name || !newTrophy.trophy_name || !newTrophy.position) {
      setError('Please fill all required fields');
      return;
    }
    
    setError(null);
    setSuccess(null);
    
    try {
      const res = await fetchWithTokenRefresh('/api/trophies/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_id: userSeasonId,
          team_name: newTrophy.team_name,
          trophy_type: newTrophy.trophy_type,
          trophy_name: newTrophy.trophy_name,
          trophy_position: newTrophy.position,
          notes: newTrophy.notes
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setSuccess('Trophy added successfully!');
        setShowAddForm(false);
        setNewTrophy({ team_name: '', trophy_type: 'cup', trophy_name: '', position: '', notes: '' });
        fetchTrophies();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to add trophy');
    }
  };

  const getTrophyBadgeColor = (type: string) => {
    switch (type) {
      case 'league': return 'from-yellow-500 to-amber-600';
      case 'runner_up': return 'from-gray-400 to-gray-500';
      case 'cup': return 'from-blue-500 to-indigo-600';
      case 'special': return 'from-purple-500 to-purple-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const getTrophyIcon = (type: string) => {
    switch (type) {
      case 'league': return '🏆';
      case 'runner_up': return '🥈';
      case 'cup': return '🏆';
      case 'special': return '⭐';
      default: return '🏅';
    }
  };

  if (authLoading || !user || !isCommitteeAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-4 sm:py-8 px-2 sm:px-4 bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent mb-2">
            🏆 Trophy Management
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Award and manage team trophies • Season: <span className="font-semibold">{userSeasonId}</span>
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-3 sm:p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
            <p className="text-sm sm:text-base text-red-800">{error}</p>
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-3 sm:p-4 bg-green-50 border-l-4 border-green-500 rounded-lg">
            <p className="text-sm sm:text-base text-green-800">{success}</p>
          </div>
        )}

        {/* Auto-Award Section */}
        {preview.length > 0 && (
          <div className="glass rounded-2xl sm:rounded-3xl p-4 sm:p-6 mb-6 border-2 border-blue-200">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl sm:text-3xl">🤖</span>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Auto-Award Trophies</h2>
                <p className="text-xs sm:text-sm text-gray-600">Based on tournament standings</p>
              </div>
            </div>
            
            {/* Group preview by tournament */}
            {Object.entries(
              preview.reduce((acc, p) => {
                if (!acc[p.tournament_name]) acc[p.tournament_name] = [];
                acc[p.tournament_name].push(p);
                return acc;
              }, {} as Record<string, TrophyPreview[]>)
            ).map(([tournamentName, trophies]) => (
              <div key={tournamentName} className="mb-4">
                <h3 className="text-sm sm:text-base font-bold text-gray-800 mb-2 px-2">
                  🏆 {tournamentName}
                </h3>
                <div className="space-y-2 sm:space-y-3">
                  {trophies.map((p) => (
                    <div key={`${p.team_name}-${p.trophy_name}`} className="flex items-center justify-between bg-white p-3 sm:p-4 rounded-xl border border-gray-200">
                      <div>
                        <p className="text-sm sm:text-base font-bold text-gray-900">{p.team_name}</p>
                        <p className="text-xs sm:text-sm text-gray-600">{p.trophy_name}</p>
                      </div>
                      {p.alreadyAwarded && <span className="text-green-600 text-xs sm:text-sm font-semibold">✅ Awarded</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            <button
              onClick={handleAutoAward}
              disabled={awarding}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 mt-4"
            >
              {awarding ? 'Awarding...' : '⚡ Auto-Award Trophies'}
            </button>
          </div>
        )}

        {/* Awarded Trophies List */}
        <div className="glass rounded-2xl sm:rounded-3xl p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">
              🏅 Awarded Trophies ({trophies.length})
            </h2>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
                showAddForm
                  ? 'bg-gray-200 text-gray-700'
                  : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:shadow-lg'
              }`}
            >
              {showAddForm ? '✕ Cancel' : '+ Add Trophy'}
            </button>
          </div>

          {/* Add Trophy Form */}
          {showAddForm && (
            <form onSubmit={handleAddTrophy} className="mb-6 p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-4">Add New Trophy</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Team Name *</label>
                  <select
                    value={newTrophy.team_name}
                    onChange={(e) => setNewTrophy({ ...newTrophy, team_name: e.target.value })}
                    className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value="">-- Select Team --</option>
                    {teams.map((team) => (
                      <option key={team} value={team}>{team}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Trophy Type *</label>
                  <select
                    value={newTrophy.trophy_type}
                    onChange={(e) => setNewTrophy({ ...newTrophy, trophy_type: e.target.value })}
                    className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  >
                    <option value="cup">🏆 Cup</option>
                    <option value="special">⭐ Special Award</option>
                    <option value="league">🏆 League</option>
                    <option value="runner_up">🥈 Runner Up</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Trophy Name *</label>
                  <select
                    value={newTrophy.trophy_name}
                    onChange={(e) => setNewTrophy({ ...newTrophy, trophy_name: e.target.value })}
                    className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value="">-- Select Trophy --</option>
                    {trophyOptions.map((trophy) => (
                      <option key={trophy} value={trophy === 'Other (Custom)' ? '' : trophy}>
                        {trophy}
                      </option>
                    ))}
                  </select>
                  {newTrophy.trophy_name === '' && trophyOptions.includes('Other (Custom)') && (
                    <input
                      type="text"
                      placeholder="Enter custom trophy name"
                      onChange={(e) => setNewTrophy({ ...newTrophy, trophy_name: e.target.value })}
                      className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 mt-2"
                    />
                  )}
                </div>
                
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Position *</label>
                  <select
                    value={newTrophy.position}
                    onChange={(e) => setNewTrophy({ ...newTrophy, position: e.target.value })}
                    className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value="">-- Select Position --</option>
                    <option value="Winner">🏆 Winner</option>
                    <option value="Runner Up">🥈 Runner Up</option>
                    <option value="Champions">🏆 Champions</option>
                    <option value="Third Place">🥉 Third Place</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Notes (Optional)</label>
                  <input
                    type="text"
                    value={newTrophy.notes}
                    onChange={(e) => setNewTrophy({ ...newTrophy, notes: e.target.value })}
                    className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                    placeholder="Additional info"
                  />
                </div>
              </div>
              
              <button
                type="submit"
                className="w-full mt-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl hover:shadow-lg transition-all"
              >
                ✨ Add Trophy
              </button>
            </form>
          )}

          {/* Trophies List */}
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
            </div>
          ) : trophies.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg">No trophies awarded yet</p>
              <p className="text-sm mt-2">Use auto-award or add manually</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Group trophies by tournament */}
              {Object.entries(
                trophies.reduce((acc, trophy) => {
                  if (!acc[trophy.trophy_name]) acc[trophy.trophy_name] = [];
                  acc[trophy.trophy_name].push(trophy);
                  return acc;
                }, {} as Record<string, Trophy[]>)
              ).map(([tournamentName, tournamentTrophies]) => (
                <div key={tournamentName} className="border-l-4 border-blue-500 pl-4">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3">
                    🏆 {tournamentName}
                  </h3>
                  <div className="space-y-3">
                    {tournamentTrophies.map((trophy) => (
                      <div key={trophy.id} className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 hover:shadow-md transition-all">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-2xl">{getTrophyIcon(trophy.trophy_type)}</span>
                              <div className={`px-3 py-1 rounded-lg text-white text-xs font-semibold bg-gradient-to-r ${getTrophyBadgeColor(trophy.trophy_type)}`}>
                                {trophy.trophy_type.toUpperCase()}
                              </div>
                              <span className="font-bold text-gray-900 text-sm sm:text-base">
                                {trophy.trophy_position || trophy.trophy_name}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs text-gray-600 ml-11">
                              <span>Team: <strong className="text-gray-900">{trophy.team_name}</strong></span>
                              <span>•</span>
                              <span>By: {trophy.awarded_by}</span>
                              {trophy.position && (
                                <>
                                  <span>•</span>
                                  <span>Position: {trophy.position}</span>
                                </>
                              )}
                            </div>
                            {trophy.notes && (
                              <p className="text-xs text-gray-500 mt-2 ml-11 italic">{trophy.notes}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteTrophy(trophy.id)}
                            className="px-3 sm:px-4 py-2 bg-red-500 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-red-600 transition-all self-end sm:self-center"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
