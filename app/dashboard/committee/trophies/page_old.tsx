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
  alreadyAwarded: boolean;
}

export default function TrophyManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { isCommitteeAdmin, userSeasonId } = usePermissions();
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [trophies, setTrophies] = useState<Trophy[]>([]);
  const [preview, setPreview] = useState<TrophyPreview[]>([]);
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
    notes: ''
  });

  // Auto-select assigned season on mount
  useEffect(() => {
    if (userSeasonId) {
      setSelectedSeason(userSeasonId);
    }
  }, [userSeasonId]);

  // Fetch trophies and preview when season changes
  useEffect(() => {
    if (selectedSeason) {
      fetchTrophies();
      fetchPreview();
    }
  }, [selectedSeason]);

  const fetchSeasons = async () => {
    try {
      const res = await fetchWithTokenRefresh('/api/seasons');
      const data = await res.json();
      if (data.success) {
        setSeasons(data.seasons || []);
      }
    } catch (error) {
      console.error('Error fetching seasons:', error);
    }
  };

  const fetchTrophies = async () => {
    if (!selectedSeason) return;
    
    setLoading(true);
    try {
      const res = await fetchWithTokenRefresh(`/api/trophies?season_id=${selectedSeason}`);
      const data = await res.json();
      if (data.success) {
        setTrophies(data.trophies || []);
      }
    } catch (error) {
      console.error('Error fetching trophies:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPreview = async () => {
    if (!selectedSeason) return;
    
    try {
      const res = await fetchWithTokenRefresh(`/api/trophies/preview?season_id=${selectedSeason}`);
      const data = await res.json();
      if (data.success) {
        setPreview(data.preview || []);
      }
    } catch (error) {
      console.error('Error fetching preview:', error);
    }
  };

  const handleAutoAward = async () => {
    if (!selectedSeason) return;
    
    if (!confirm('Auto-award League Winner and Runner Up trophies based on final standings?')) {
      return;
    }
    
    setAwarding(true);
    try {
      const res = await fetchWithTokenRefresh('/api/trophies/award', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ season_id: selectedSeason })
      });
      
      const data = await res.json();
      if (data.success) {
        alert(`✅ Awarded ${data.trophiesAwarded} trophies!`);
        fetchTrophies();
        fetchPreview();
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to award trophies');
      console.error(error);
    } finally {
      setAwarding(false);
    }
  };

  const handleDeleteTrophy = async (trophyId: number) => {
    if (!confirm('Delete this trophy?')) return;
    
    try {
      const res = await fetchWithTokenRefresh(`/api/trophies/${trophyId}`, {
        method: 'DELETE'
      });
      
      const data = await res.json();
      if (data.success) {
        alert('✅ Trophy deleted');
        fetchTrophies();
        fetchPreview();
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to delete trophy');
      console.error(error);
    }
  };

  const handleAddTrophy = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedSeason || !newTrophy.team_name || !newTrophy.trophy_name) {
      alert('Please fill all required fields');
      return;
    }
    
    try {
      const res = await fetchWithTokenRefresh('/api/trophies/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_id: selectedSeason,
          ...newTrophy
        })
      });
      
      const data = await res.json();
      if (data.success) {
        alert('✅ Trophy added!');
        setShowAddModal(false);
        setNewTrophy({ team_name: '', trophy_type: 'cup', trophy_name: '', notes: '' });
        fetchTrophies();
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to add trophy');
      console.error(error);
    }
  };

  const getTrophyBadgeColor = (type: string) => {
    switch (type) {
      case 'league': return 'bg-yellow-500';
      case 'runner_up': return 'bg-gray-400';
      case 'cup': return 'bg-blue-500';
      case 'special': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">🏆 Trophy Management</h1>
        <p className="text-gray-600">Award and manage team trophies for completed seasons</p>
      </div>

      {/* Season Info (Auto-selected) */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-[#0066FF]/20 to-blue-500/20">
            <svg className="w-5 h-5 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-600">Managing Trophies For</p>
            <p className="text-lg font-bold text-gray-800">{selectedSeason || 'Loading...'}</p>
          </div>
        </div>
      </div>

      {selectedSeason && (
        <>
          {/* Auto-Award Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">🤖 Auto-Award Trophies</h2>
            <p className="text-sm text-gray-700 mb-4">
              Automatically award League Winner and Runner Up based on current/final standings.<br/>
              <span className="text-xs text-gray-600">💡 Award anytime after tournament completes - doesn't require season to be marked as completed.</span>
            </p>
            
            {preview.length > 0 && (
              <div className="mb-4 space-y-2">
                <h3 className="font-semibold">Preview:</h3>
                {preview.map((p) => (
                  <div key={p.team_name} className="flex items-center justify-between bg-white p-3 rounded">
                    <span>
                      <strong>{p.team_name}</strong> - {p.trophy_name} (Position {p.position})
                    </span>
                    {p.alreadyAwarded && <span className="text-green-600">✅ Already Awarded</span>}
                  </div>
                ))}
              </div>
            )}
            
            <button
              onClick={handleAutoAward}
              disabled={awarding || preview.length === 0}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {awarding ? 'Awarding...' : 'Auto-Award Trophies'}
            </button>
          </div>

          {/* Existing Trophies */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">🏅 Awarded Trophies</h2>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                + Add Trophy
              </button>
            </div>

            {loading ? (
              <p>Loading...</p>
            ) : trophies.length === 0 ? (
              <p className="text-gray-500">No trophies awarded yet for this season</p>
            ) : (
              <div className="space-y-3">
                {trophies.map((trophy) => (
                  <div key={trophy.id} className="border rounded p-4 flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className={`${getTrophyBadgeColor(trophy.trophy_type)} text-white px-3 py-1 rounded text-sm`}>
                          {trophy.trophy_type}
                        </span>
                        <span className="font-bold">{trophy.trophy_name}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Team: <strong>{trophy.team_name}</strong> | 
                        Awarded by: {trophy.awarded_by} | 
                        {trophy.position && ` Position: ${trophy.position}`}
                      </p>
                      {trophy.notes && (
                        <p className="text-sm text-gray-500 mt-1 italic">{trophy.notes}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteTrophy(trophy.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Add Trophy Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Add Manual Trophy</h2>
            <form onSubmit={handleAddTrophy}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Team Name *</label>
                  <input
                    type="text"
                    value={newTrophy.team_name}
                    onChange={(e) => setNewTrophy({ ...newTrophy, team_name: e.target.value })}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Trophy Type *</label>
                  <select
                    value={newTrophy.trophy_type}
                    onChange={(e) => setNewTrophy({ ...newTrophy, trophy_type: e.target.value })}
                    className="w-full p-2 border rounded"
                  >
                    <option value="cup">Cup</option>
                    <option value="special">Special Award</option>
                    <option value="league">League</option>
                    <option value="runner_up">Runner Up</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Trophy Name *</label>
                  <input
                    type="text"
                    value={newTrophy.trophy_name}
                    onChange={(e) => setNewTrophy({ ...newTrophy, trophy_name: e.target.value })}
                    className="w-full p-2 border rounded"
                    placeholder="e.g., FA Cup, UCL, DUO CUP"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea
                    value={newTrophy.notes}
                    onChange={(e) => setNewTrophy({ ...newTrophy, notes: e.target.value })}
                    className="w-full p-2 border rounded"
                    rows={3}
                  />
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700"
                >
                  Add Trophy
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-300 py-2 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
