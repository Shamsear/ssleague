'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Edit2, Save, X, RefreshCw } from 'lucide-react';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

interface TeamSeason {
  id: string;
  team_id: string;
  team_name: string;
  season_id: string;
  season_name?: string;
  football_budget: number;
  football_spent: number;
  real_player_budget: number;
  real_player_spent: number;
  neon_football_budget?: number;
  neon_football_spent?: number;
  transfers_used?: number;
  created_at?: any;
  updated_at?: any;
}

export default function TeamSeasonsEditorPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [seasons, setSeasons] = useState<any[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [teamSeasons, setTeamSeasons] = useState<TeamSeason[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<TeamSeason>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && user.role === 'super_admin') {
      loadSeasons();
    }
  }, [user]);

  useEffect(() => {
    if (selectedSeasonId) {
      loadTeamSeasons();
    }
  }, [selectedSeasonId]);

  const loadSeasons = async () => {
    try {
      const seasonsSnapshot = await getDocs(collection(db, 'seasons'));
      const seasonsList: any[] = [];
      
      seasonsSnapshot.forEach(doc => {
        seasonsList.push({
          id: doc.id,
          ...doc.data()
        });
      });

      seasonsList.sort((a, b) => {
        if (a.created_at && b.created_at) {
          return b.created_at.toMillis() - a.created_at.toMillis();
        }
        return 0;
      });

      setSeasons(seasonsList);
      if (seasonsList.length > 0 && !selectedSeasonId) {
        setSelectedSeasonId(seasonsList[0].id);
      }
    } catch (error) {
      console.error('Error loading seasons:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTeamSeasons = async () => {
    if (!selectedSeasonId) return;

    try {
      setIsLoading(true);
      const q = query(
        collection(db, 'team_seasons'),
        where('season_id', '==', selectedSeasonId)
      );

      const snapshot = await getDocs(q);
      const teamSeasonsList: TeamSeason[] = [];

      // Fetch Neon data for all teams
      const response = await fetch(`/api/admin/team-seasons-neon?season_id=${selectedSeasonId}`);
      const neonData = response.ok ? await response.json() : { teams: [] };
      
      console.log('🔥 Neon API Response:', neonData);
      console.log('📊 Neon teams count:', neonData.teams?.length || 0);
      
      // Use 'id' field from Neon (team ID like SSPSLT0002) to match with Firebase team_id
      const neonBudgetMap = new Map(neonData.teams?.map((t: any) => [t.id, t.football_budget]) || []);
      const neonSpentMap = new Map(neonData.teams?.map((t: any) => [t.id, t.football_spent]) || []);

      console.log('🗺️ Neon budget map size:', neonBudgetMap.size);
      console.log('🗺️ Neon spent map size:', neonSpentMap.size);
      if (neonData.teams?.length > 0) {
        console.log('Sample Neon team:', neonData.teams[0]);
      }

      snapshot.forEach(doc => {
        const data = doc.data();
        const neonBudget = neonBudgetMap.get(data.team_id);
        const neonSpent = neonSpentMap.get(data.team_id);
        
        console.log(`Team ${data.team_name}:`, {
          team_id: data.team_id,
          neonBudget,
          neonSpent,
          hasInMap: neonBudgetMap.has(data.team_id)
        });
        
        teamSeasonsList.push({
          id: doc.id,
          team_id: data.team_id,
          team_name: data.team_name,
          season_id: data.season_id,
          season_name: data.season_name,
          football_budget: data.football_budget ?? 0,
          football_spent: data.football_spent ?? 0,
          real_player_budget: data.real_player_budget ?? 0,
          real_player_spent: data.real_player_spent ?? 0,
          neon_football_budget: neonBudget ?? 0,
          neon_football_spent: neonSpent ?? 0,
          transfers_used: data.transfers_used ?? 0,
          created_at: data.created_at,
          updated_at: data.updated_at
        } as TeamSeason);
      });

      teamSeasonsList.sort((a, b) => a.team_name.localeCompare(b.team_name));
      setTeamSeasons(teamSeasonsList);
    } catch (error) {
      console.error('Error loading team seasons:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startEdit = (teamSeason: TeamSeason) => {
    setEditingId(teamSeason.id);
    setEditForm({
      team_name: teamSeason.team_name,
      football_budget: teamSeason.football_budget,
      football_spent: teamSeason.football_spent,
      real_player_budget: teamSeason.real_player_budget,
      real_player_spent: teamSeason.real_player_spent,
      transfers_used: teamSeason.transfers_used || 0
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async (teamSeasonId: string) => {
    try {
      setIsSaving(true);
      const teamSeasonRef = doc(db, 'team_seasons', teamSeasonId);
      
      await updateDoc(teamSeasonRef, {
        team_name: editForm.team_name,
        football_budget: Number(editForm.football_budget),
        football_spent: Number(editForm.football_spent),
        real_player_budget: Number(editForm.real_player_budget),
        real_player_spent: Number(editForm.real_player_spent),
        transfers_used: Number(editForm.transfers_used || 0),
        updated_at: new Date()
      });

      // Update local state
      setTeamSeasons(prev => prev.map(ts => 
        ts.id === teamSeasonId 
          ? { 
              ...ts, 
              ...editForm, 
              football_budget: Number(editForm.football_budget),
              football_spent: Number(editForm.football_spent),
              real_player_budget: Number(editForm.real_player_budget),
              real_player_spent: Number(editForm.real_player_spent),
              transfers_used: Number(editForm.transfers_used || 0) 
            }
          : ts
      ));

      setEditingId(null);
      setEditForm({});
      alert('✅ Team season updated successfully!');
    } catch (error) {
      console.error('Error saving team season:', error);
      alert('❌ Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/admin"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-4 group"
          >
            <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Admin Dashboard
          </Link>
          
          <div className="glass rounded-3xl p-6 border border-white/30 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
                <Edit2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold gradient-text">Team Seasons Editor</h1>
                <p className="text-gray-600 mt-1">Edit team balances and season data</p>
              </div>
            </div>
          </div>
        </div>

        {/* Season Selector */}
        <div className="glass rounded-2xl p-6 border border-white/30 shadow-xl mb-6">
          <label className="block text-sm font-bold text-gray-900 mb-2">Select Season</label>
          <select
            value={selectedSeasonId}
            onChange={(e) => setSelectedSeasonId(e.target.value)}
            className="w-full md:w-96 px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white shadow-sm"
          >
            {seasons.map(season => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>
        </div>

        {/* Team Seasons Table */}
        {teamSeasons.length > 0 ? (
          <div className="glass rounded-2xl border border-white/30 shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Team Seasons ({teamSeasons.length})</h2>
                  <p className="text-indigo-100 text-sm">Click edit to modify team data</p>
                </div>
                <button
                  onClick={loadTeamSeasons}
                  className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Team Name</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase">eCoin Budget (FB)</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase">eCoin Spent (FB)</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase">eCoin Budget (Neon)</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase">eCoin Spent (Neon)</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase">SSCoin Budget</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase">SSCoin Spent</th>
                    <th className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase">Transfers Used</th>
                    <th className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {teamSeasons.map((ts) => (
                    <tr key={ts.id} className="hover:bg-gray-50 transition-colors">
                      {editingId === ts.id ? (
                        <>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={editForm.team_name || ''}
                              onChange={(e) => setEditForm({ ...editForm, team_name: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="number"
                              value={editForm.football_budget || 0}
                              onChange={(e) => setEditForm({ ...editForm, football_budget: Number(e.target.value) })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="number"
                              value={editForm.football_spent || 0}
                              onChange={(e) => setEditForm({ ...editForm, football_spent: Number(e.target.value) })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right"
                            />
                          </td>
                          <td className="px-6 py-4 text-center text-gray-400">
                            <span className="text-sm">Read-only</span>
                          </td>
                          <td className="px-6 py-4 text-center text-gray-400">
                            <span className="text-sm">Read-only</span>
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="number"
                              value={editForm.real_player_budget || 0}
                              onChange={(e) => setEditForm({ ...editForm, real_player_budget: Number(e.target.value) })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="number"
                              value={editForm.real_player_spent || 0}
                              onChange={(e) => setEditForm({ ...editForm, real_player_spent: Number(e.target.value) })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="number"
                              value={editForm.transfers_used || 0}
                              onChange={(e) => setEditForm({ ...editForm, transfers_used: Number(e.target.value) })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => saveEdit(ts.id)}
                                disabled={isSaving}
                                className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50"
                                title="Save"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                onClick={cancelEdit}
                                disabled={isSaving}
                                className="p-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4">
                            <span className="font-medium text-gray-900">{ts.team_name}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-bold text-blue-600">{(ts.football_budget ?? 0).toLocaleString()}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-bold text-blue-800">{(ts.football_spent ?? 0).toLocaleString()}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-bold text-green-600">{(ts.neon_football_budget ?? 0).toLocaleString()}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-bold text-green-800">{(ts.neon_football_spent ?? 0).toLocaleString()}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-bold text-purple-600">{(ts.real_player_budget ?? 0).toLocaleString()}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-bold text-purple-800">{(ts.real_player_spent ?? 0).toLocaleString()}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                              {ts.transfers_used || 0} / 2
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center">
                              <button
                                onClick={() => startEdit(ts)}
                                className="p-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="glass rounded-2xl p-12 text-center border border-white/30 shadow-xl">
            <div className="text-gray-400 mb-4">
              <Edit2 className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Team Seasons Found</h3>
            <p className="text-gray-600">Select a season to view and edit team data</p>
          </div>
        )}
      </div>
    </div>
  );
}
