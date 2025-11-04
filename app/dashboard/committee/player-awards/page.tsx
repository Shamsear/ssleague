'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface PlayerAward {
  id: number;
  player_id: string;
  player_name: string;
  season_id: string;
  award_category: string; // 'individual' or 'category'
  award_type: string;
  award_position: string | null;
  player_category: string | null; // For category awards
  awarded_by: string;
  notes: string | null;
  created_at: string;
}

interface Player {
  player_id: string;
  player_name: string;
  category: string;
}

export default function PlayerAwardsManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { isCommitteeAdmin, userSeasonId } = usePermissions();
  
  const [awards, setAwards] = useState<PlayerAward[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [awarding, setAwarding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<'all' | 'individual' | 'category'>('all');
  
  // New award form
  const [newAward, setNewAward] = useState({
    player_id: '',
    player_name: '',
    award_category: 'individual' as 'individual' | 'category',
    award_type: '',
    award_position: '',
    player_category: '',
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
      fetchAwards();
      fetchPlayers();
    }
  }, [userSeasonId, filterCategory]);

  const fetchAwards = async () => {
    if (!userSeasonId) return;
    
    setLoading(true);
    try {
      const url = filterCategory === 'all' 
        ? `/api/player-awards?season_id=${userSeasonId}`
        : `/api/player-awards?season_id=${userSeasonId}&award_category=${filterCategory}`;
      
      const res = await fetchWithTokenRefresh(url);
      const data = await res.json();
      if (data.success) {
        setAwards(data.awards || []);
      }
    } catch (err) {
      console.error('Error fetching awards:', err);
      setError('Failed to load awards');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayers = async () => {
    if (!userSeasonId) return;
    
    try {
      const res = await fetchWithTokenRefresh(`/api/stats/real-players?season_id=${userSeasonId}`);
      const data = await res.json();
      if (data.success && data.players) {
        setPlayers(data.players);
      }
    } catch (err) {
      console.error('Error fetching players:', err);
    }
  };

  const handleAutoAward = async () => {
    if (!userSeasonId) return;
    
    if (!confirm('This will auto-award all player awards based on statistics. Continue?')) return;
    
    setAwarding(true);
    setError(null);
    setSuccess(null);
    
    try {
      const res = await fetchWithTokenRefresh('/api/player-awards/auto-award', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season_id: userSeasonId })
      });
      
      const data = await res.json();
      if (data.success) {
        setSuccess(`✅ Awarded ${data.awardsGiven} player awards!`);
        fetchAwards();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to auto-award');
    } finally {
      setAwarding(false);
    }
  };

  const handleDeleteAward = async (awardId: number) => {
    if (!confirm('Delete this award?')) return;
    
    setError(null);
    setSuccess(null);
    
    try {
      const res = await fetchWithTokenRefresh(`/api/player-awards/${awardId}`, {
        method: 'DELETE'
      });
      
      const data = await res.json();
      if (data.success) {
        setSuccess('Award deleted successfully');
        fetchAwards();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to delete award');
    }
  };

  const handleAddAward = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userSeasonId || !newAward.player_id || !newAward.award_type || !newAward.award_position) {
      setError('Please fill all required fields');
      return;
    }
    
    // Validate category award requirements
    if (newAward.award_category === 'category' && !newAward.player_category) {
      setError('Player category is required for category awards');
      return;
    }
    
    setError(null);
    setSuccess(null);
    
    try {
      const res = await fetchWithTokenRefresh('/api/player-awards/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_id: userSeasonId,
          player_id: newAward.player_id,
          player_name: newAward.player_name,
          award_category: newAward.award_category,
          award_type: newAward.award_type,
          award_position: newAward.award_position,
          player_category: newAward.award_category === 'category' ? newAward.player_category : null,
          notes: newAward.notes
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setSuccess('Award added successfully!');
        setShowAddForm(false);
        setNewAward({
          player_id: '',
          player_name: '',
          award_category: 'individual',
          award_type: '',
          award_position: '',
          player_category: '',
          notes: ''
        });
        fetchAwards();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to add award');
    }
  };

  const handlePlayerSelect = (playerId: string) => {
    const player = players.find(p => p.player_id === playerId);
    if (player) {
      setNewAward({
        ...newAward,
        player_id: playerId,
        player_name: player.player_name,
        player_category: player.category
      });
    }
  };

  const getAwardIcon = (category: string) => {
    return category === 'individual' ? '🏆' : '⭐';
  };

  const getAwardBadgeColor = (category: string) => {
    return category === 'individual' 
      ? 'from-yellow-500 to-amber-600'
      : 'from-purple-500 to-purple-600';
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
            🏆 Player Awards Management
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Award and manage player achievements • Season: <span className="font-semibold">{userSeasonId}</span>
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
        <div className="glass rounded-2xl sm:rounded-3xl p-4 sm:p-6 mb-6 border-2 border-blue-200">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl sm:text-3xl">🤖</span>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Auto-Award Player Awards</h2>
              <p className="text-xs sm:text-sm text-gray-600">Based on season statistics</p>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-xl mb-4">
            <h3 className="font-semibold text-gray-900 mb-2">Will award:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
              <div>
                <p className="font-semibold text-purple-600">Individual Awards:</p>
                <ul className="ml-4 space-y-1">
                  <li>• Golden Boot (Top 3)</li>
                  <li>• Most Assists (Top 3)</li>
                  <li>• Most Clean Sheets (Top 3)</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-indigo-600">Category Awards:</p>
                <ul className="ml-4 space-y-1">
                  <li>• Best Attacker (Top 3)</li>
                  <li>• Best Midfielder (Top 3)</li>
                  <li>• Best Defender (Top 3)</li>
                  <li>• Best Goalkeeper (Top 3)</li>
                </ul>
              </div>
            </div>
          </div>
          
          <button
            onClick={handleAutoAward}
            disabled={awarding}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
          >
            {awarding ? 'Awarding...' : '⚡ Auto-Award All Player Awards'}
          </button>
        </div>

        {/* Awards List */}
        <div className="glass rounded-2xl sm:rounded-3xl p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                🏅 Player Awards ({awards.length})
              </h2>
              
              {/* Filter */}
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as any)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Awards</option>
                <option value="individual">Individual Only</option>
                <option value="category">Category Only</option>
              </select>
            </div>
            
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
                showAddForm
                  ? 'bg-gray-200 text-gray-700'
                  : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:shadow-lg'
              }`}
            >
              {showAddForm ? '✕ Cancel' : '+ Add Award'}
            </button>
          </div>

          {/* Add Award Form */}
          {showAddForm && (
            <form onSubmit={handleAddAward} className="mb-6 p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-4">Add New Award</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Player *</label>
                  <select
                    value={newAward.player_id}
                    onChange={(e) => handlePlayerSelect(e.target.value)}
                    className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value="">-- Select Player --</option>
                    {players.map((player) => (
                      <option key={player.player_id} value={player.player_id}>
                        {player.player_name} ({player.category})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Award Category *</label>
                  <select
                    value={newAward.award_category}
                    onChange={(e) => setNewAward({ ...newAward, award_category: e.target.value as any })}
                    className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                  >
                    <option value="individual">🏆 Individual (Season-wide)</option>
                    <option value="category">⭐ Category (Position-specific)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Award Type *</label>
                  <select
                    value={newAward.award_type}
                    onChange={(e) => setNewAward({ ...newAward, award_type: e.target.value })}
                    className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value="">-- Select Award Type --</option>
                    {newAward.award_category === 'individual' ? (
                      <>
                        <option value="Golden Boot">Golden Boot</option>
                        <option value="Most Assists">Most Assists</option>
                        <option value="Most Clean Sheets">Most Clean Sheets</option>
                        <option value="Player of the Season">Player of the Season</option>
                      </>
                    ) : (
                      <>
                        <option value="Best Attacker">Best Attacker</option>
                        <option value="Best Midfielder">Best Midfielder</option>
                        <option value="Best Defender">Best Defender</option>
                        <option value="Best Goalkeeper">Best Goalkeeper</option>
                      </>
                    )}
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Position *</label>
                  <select
                    value={newAward.award_position}
                    onChange={(e) => setNewAward({ ...newAward, award_position: e.target.value })}
                    className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value="">-- Select Position --</option>
                    <option value="Winner">🥇 Winner</option>
                    <option value="Runner Up">🥈 Runner Up</option>
                    <option value="Third Place">🥉 Third Place</option>
                  </select>
                </div>
                
                <div className="sm:col-span-2">
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Notes (Optional)</label>
                  <input
                    type="text"
                    value={newAward.notes}
                    onChange={(e) => setNewAward({ ...newAward, notes: e.target.value })}
                    className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                    placeholder="Additional info"
                  />
                </div>
              </div>
              
              <button
                type="submit"
                className="w-full mt-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl hover:shadow-lg transition-all"
              >
                ✨ Add Award
              </button>
            </form>
          )}

          {/* Awards List */}
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
            </div>
          ) : awards.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg">No player awards yet</p>
              <p className="text-sm mt-2">Use auto-award or add manually</p>
            </div>
          ) : (
            <div className="space-y-3">
              {awards.map((award) => (
                <div key={award.id} className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 hover:shadow-md transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{getAwardIcon(award.award_category)}</span>
                        <div className={`px-3 py-1 rounded-lg text-white text-xs font-semibold bg-gradient-to-r ${getAwardBadgeColor(award.award_category)}`}>
                          {award.award_category.toUpperCase()}
                        </div>
                        <span className="font-bold text-gray-900 text-sm sm:text-base">
                          {award.award_type} {award.award_position && `- ${award.award_position}`}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-gray-600 ml-11">
                        <span>Player: <strong className="text-gray-900">{award.player_name}</strong></span>
                        <span>•</span>
                        <span>By: {award.awarded_by}</span>
                        {award.player_category && (
                          <>
                            <span>•</span>
                            <span>Category: {award.player_category}</span>
                          </>
                        )}
                      </div>
                      {award.notes && (
                        <p className="text-xs text-gray-500 mt-2 ml-11 italic">{award.notes}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteAward(award.id)}
                      className="px-3 sm:px-4 py-2 bg-red-500 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-red-600 transition-all self-end sm:self-center"
                    >
                      🗑️ Delete
                    </button>
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
