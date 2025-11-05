'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface Trophy {
  id: number;
  team_name: string;
  season_id: string;
  trophy_type: string;
  trophy_name: string;
  trophy_position: string | null;
  instagram_link: string | null;
}

interface Award {
  id: string;
  award_type: string;
  season_id: string;
  player_name?: string;
  team_name?: string;
  round_number?: number;
  week_number?: number;
  instagram_link: string | null;
}

interface PlayerAward {
  id: number;
  player_name: string;
  season_id: string;
  award_category: string;
  award_type: string;
  award_position: string | null;
  instagram_link: string | null;
}

type AwardType = 'trophies' | 'awards' | 'player_awards';

export default function AwardPhotosManagement() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AwardType>('trophies');
  const [seasons, setSeasons] = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [trophies, setTrophies] = useState<Trophy[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [playerAwards, setPlayerAwards] = useState<PlayerAward[]>([]);

  // Edit states
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editingLink, setEditingLink] = useState<string>('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
    if (!authLoading && user && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    fetchSeasons();
  }, []);

  useEffect(() => {
    if (selectedSeason) {
      fetchData();
    }
  }, [selectedSeason, activeTab]);

  const fetchSeasons = async () => {
    try {
      const res = await fetchWithTokenRefresh('/api/seasons/list');
      const data = await res.json();
      if (data.success && data.seasons) {
        setSeasons(data.seasons);
        if (data.seasons.length > 0) {
          setSelectedSeason(data.seasons[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching seasons:', err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'trophies') {
        const res = await fetchWithTokenRefresh(`/api/trophies?season_id=${selectedSeason}`);
        const data = await res.json();
        if (data.success) {
          setTrophies(data.trophies || []);
        }
      } else if (activeTab === 'awards') {
        const res = await fetchWithTokenRefresh(`/api/awards?season_id=${selectedSeason}`);
        const data = await res.json();
        if (data.success) {
          setAwards(data.awards || []);
        }
      } else if (activeTab === 'player_awards') {
        const res = await fetchWithTokenRefresh(`/api/player-awards?season_id=${selectedSeason}`);
        const data = await res.json();
        if (data.success) {
          setPlayerAwards(data.awards || []);
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (id: string | number, currentLink: string | null) => {
    setEditingId(id);
    setEditingLink(currentLink || '');
  };

  const handleSave = async () => {
    if (editingId === null) return;

    setError(null);
    setSuccess(null);

    try {
      let endpoint = '';
      let body: any = { instagram_link: editingLink };

      if (activeTab === 'trophies') {
        endpoint = `/api/trophies/${editingId}`;
      } else if (activeTab === 'awards') {
        endpoint = `/api/awards/${editingId}`;
      } else if (activeTab === 'player_awards') {
        endpoint = `/api/player-awards/${editingId}`;
      }

      const res = await fetchWithTokenRefresh(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (data.success) {
        setSuccess('✅ Instagram link updated successfully!');
        setEditingId(null);
        setEditingLink('');
        fetchData();
      } else {
        setError(data.error || 'Failed to update');
      }
    } catch (err) {
      console.error('Error updating:', err);
      setError('Failed to update Instagram link');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditingLink('');
  };

  const getAwardDisplayName = (award: Award) => {
    const typeNames: Record<string, string> = {
      POTD: 'Player of the Day',
      POTW: 'Player of the Week',
      POTS: 'Player of the Season',
      TOD: 'Team of the Day',
      TOW: 'Team of the Week',
      TOTS: 'Team of the Season'
    };
    
    let name = typeNames[award.award_type] || award.award_type;
    if (award.round_number) name += ` (Round ${award.round_number})`;
    if (award.week_number) name += ` (Week ${award.week_number})`;
    return name;
  };

  if (authLoading || !user || user.role !== 'super_admin') {
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
        <div className="mb-6">
          <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
            📸 Award Photos Management
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Add Instagram embed links for all awards and trophies
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

        {/* Season Selector */}
        <div className="glass rounded-2xl p-4 sm:p-6 mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Select Season</label>
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            className="w-full sm:w-64 p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name || season.short_name || season.id}
              </option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <div className="glass rounded-2xl p-4 sm:p-6 mb-6">
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setActiveTab('trophies')}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                activeTab === 'trophies'
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              🏆 Team Trophies ({trophies.length})
            </button>
            <button
              onClick={() => setActiveTab('awards')}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                activeTab === 'awards'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              ⭐ General Awards ({awards.length})
            </button>
            <button
              onClick={() => setActiveTab('player_awards')}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                activeTab === 'player_awards'
                  ? 'bg-gradient-to-r from-green-500 to-teal-500 text-white shadow-lg'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              👟 Player Awards ({playerAwards.length})
            </button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Team Trophies */}
              {activeTab === 'trophies' && trophies.map((trophy) => (
                <div key={trophy.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 text-base">
                          {trophy.trophy_name} {trophy.trophy_position && `• ${trophy.trophy_position}`}
                        </h3>
                        <p className="text-sm text-gray-600">Team: {trophy.team_name}</p>
                      </div>
                      <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-yellow-100 text-yellow-800">
                        {trophy.trophy_type}
                      </span>
                    </div>
                    
                    {editingId === trophy.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editingLink}
                          onChange={(e) => setEditingLink(e.target.value)}
                          placeholder="Instagram embed link (e.g., https://www.instagram.com/p/ABC123/embed)"
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleSave}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancel}
                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-400"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          {trophy.instagram_link ? (
                            <a
                              href={trophy.instagram_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline truncate block"
                            >
                              {trophy.instagram_link}
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400">No photo link added</span>
                          )}
                        </div>
                        <button
                          onClick={() => handleEdit(trophy.id, trophy.instagram_link)}
                          className="ml-3 px-3 py-1 bg-blue-500 text-white rounded-lg text-xs font-semibold hover:bg-blue-600"
                        >
                          {trophy.instagram_link ? 'Edit' : 'Add'} Link
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* General Awards */}
              {activeTab === 'awards' && awards.map((award) => (
                <div key={award.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 text-base">
                          {getAwardDisplayName(award)}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {award.player_name || award.team_name}
                        </p>
                      </div>
                      <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-blue-100 text-blue-800">
                        {award.award_type}
                      </span>
                    </div>
                    
                    {editingId === award.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editingLink}
                          onChange={(e) => setEditingLink(e.target.value)}
                          placeholder="Instagram embed link"
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleSave}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancel}
                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-400"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          {award.instagram_link ? (
                            <a
                              href={award.instagram_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline truncate block"
                            >
                              {award.instagram_link}
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400">No photo link added</span>
                          )}
                        </div>
                        <button
                          onClick={() => handleEdit(award.id, award.instagram_link)}
                          className="ml-3 px-3 py-1 bg-blue-500 text-white rounded-lg text-xs font-semibold hover:bg-blue-600"
                        >
                          {award.instagram_link ? 'Edit' : 'Add'} Link
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Player Awards */}
              {activeTab === 'player_awards' && playerAwards.map((award) => (
                <div key={award.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 text-base">
                          {award.award_type} {award.award_position && `• ${award.award_position}`}
                        </h3>
                        <p className="text-sm text-gray-600">Player: {award.player_name}</p>
                      </div>
                      <span className="px-2 py-1 rounded-lg text-xs font-semibold bg-green-100 text-green-800">
                        {award.award_category}
                      </span>
                    </div>
                    
                    {editingId === award.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editingLink}
                          onChange={(e) => setEditingLink(e.target.value)}
                          placeholder="Instagram embed link"
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleSave}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancel}
                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-400"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          {award.instagram_link ? (
                            <a
                              href={award.instagram_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline truncate block"
                            >
                              {award.instagram_link}
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400">No photo link added</span>
                          )}
                        </div>
                        <button
                          onClick={() => handleEdit(award.id, award.instagram_link)}
                          className="ml-3 px-3 py-1 bg-blue-500 text-white rounded-lg text-xs font-semibold hover:bg-blue-600"
                        >
                          {award.instagram_link ? 'Edit' : 'Add'} Link
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Empty State */}
              {activeTab === 'trophies' && trophies.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-lg">No trophies found for this season</p>
                </div>
              )}
              {activeTab === 'awards' && awards.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-lg">No awards found for this season</p>
                </div>
              )}
              {activeTab === 'player_awards' && playerAwards.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-lg">No player awards found for this season</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="glass rounded-2xl p-4 sm:p-6 bg-blue-50 border border-blue-200">
          <h3 className="font-bold text-gray-900 mb-3">📝 How to add Instagram embed links:</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
            <li>Open the Instagram post on web browser</li>
            <li>Click the three dots (•••) menu</li>
            <li>Select "Embed"</li>
            <li>Copy the embed URL or full iframe code</li>
            <li>Paste it in the input field above</li>
            <li>Click "Save" to update</li>
          </ol>
          <p className="mt-3 text-xs text-gray-600">
            Example: <code className="bg-gray-200 px-2 py-1 rounded">https://www.instagram.com/p/ABC123/embed</code>
          </p>
        </div>
      </div>
    </div>
  );
}
