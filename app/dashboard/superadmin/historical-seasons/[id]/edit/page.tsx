'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getIdToken } from 'firebase/auth';

interface Season {
  id: string;
  name: string;
  short_name: string;
  description: string;
  champion_team_name?: string;
  runner_up_team_name?: string;
  top_scorer_player_name?: string;
  top_scorer_goals?: number;
  best_goalkeeper_player_name?: string;
  best_goalkeeper_clean_sheets?: number;
  most_assists_player_name?: string;
  most_assists_count?: number;
  mvp_player_name?: string;
  potm?: number;
  notes?: string;
}

export default function EditHistoricalSeasonPage() {
  const { user, firebaseUser, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const seasonId = params?.id as string;

  const [season, setSeason] = useState<Season | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    short_name: '',
    description: '',
    champion_team_name: '',
    runner_up_team_name: '',
    top_scorer_player_name: '',
    top_scorer_goals: '',
    best_goalkeeper_player_name: '',
    best_goalkeeper_clean_sheets: '',
    most_assists_player_name: '',
    most_assists_count: '',
    mvp_player_name: '',
    potm: '',
    notes: ''
  });

  // Auth check
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Fetch season data
  useEffect(() => {
    if (!seasonId || loading || !user) return;
    
    const fetchSeasonData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/seasons/historical/${seasonId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch season data');
        }
        
        const { success, data } = await response.json();
        
        if (!success) {
          throw new Error('Failed to load season');
        }
        
        setSeason(data.season);
        
        // Populate form
        setFormData({
          name: data.season.name || '',
          short_name: data.season.short_name || '',
          description: data.season.description || '',
          champion_team_name: data.season.champion_team_name || '',
          runner_up_team_name: data.season.runner_up_team_name || '',
          top_scorer_player_name: data.season.top_scorer_player_name || '',
          top_scorer_goals: data.season.top_scorer_goals?.toString() || '',
          best_goalkeeper_player_name: data.season.best_goalkeeper_player_name || '',
          best_goalkeeper_clean_sheets: data.season.best_goalkeeper_clean_sheets?.toString() || '',
          most_assists_player_name: data.season.most_assists_player_name || '',
          most_assists_count: data.season.most_assists_count?.toString() || '',
          mvp_player_name: data.season.mvp_player_name || '',
          potm: data.season.potm?.toString() || '',
          notes: data.season.notes || ''
        });
        
        setIsLoading(false);
      } catch (error: any) {
        console.error('Error fetching season:', error);
        setError(error.message);
        setIsLoading(false);
      }
    };

    fetchSeasonData();
  }, [seasonId, loading, user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!firebaseUser) {
      setError('Not authenticated');
      return;
    }

    try {
      setIsSaving(true);
      setError('');
      setSuccessMessage('');

      const token = await getIdToken(firebaseUser);
      
      // Prepare update data
      const updateData: any = {
        name: formData.name,
        short_name: formData.short_name,
        description: formData.description,
        champion_team_name: formData.champion_team_name,
        runner_up_team_name: formData.runner_up_team_name,
        top_scorer_player_name: formData.top_scorer_player_name,
        best_goalkeeper_player_name: formData.best_goalkeeper_player_name,
        most_assists_player_name: formData.most_assists_player_name,
        mvp_player_name: formData.mvp_player_name,
        notes: formData.notes
      };

      // Add numeric fields only if they have values
      if (formData.top_scorer_goals) {
        updateData.top_scorer_goals = parseInt(formData.top_scorer_goals);
      }
      if (formData.best_goalkeeper_clean_sheets) {
        updateData.best_goalkeeper_clean_sheets = parseInt(formData.best_goalkeeper_clean_sheets);
      }
      if (formData.most_assists_count) {
        updateData.most_assists_count = parseInt(formData.most_assists_count);
      }
      if (formData.potm) {
        updateData.potm = parseInt(formData.potm);
      }

      const response = await fetch(`/api/seasons/historical/${seasonId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update season');
      }

      console.log('✅ Season updated successfully');
      setSuccessMessage('Season updated successfully!');
      
      // Redirect back to season detail page after 1.5 seconds
      setTimeout(() => {
        router.push(`/dashboard/superadmin/historical-seasons/${seasonId}`);
      }, 1500);
      
    } catch (err: any) {
      console.error('❌ Error updating season:', err);
      setError(err.message || 'Failed to update season');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading season data...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'super_admin') {
    return null;
  }

  if (!season) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Season not found</p>
          <button
            onClick={() => router.push('/dashboard/superadmin/historical-seasons')}
            className="mt-4 px-4 py-2 bg-[#0066FF] text-white rounded-lg hover:bg-[#0066FF]/90"
          >
            Return to Historical Seasons
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 py-8 px-4">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="glass rounded-2xl p-6 shadow-xl backdrop-blur-md border border-white/30">
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={() => router.push(`/dashboard/superadmin/historical-seasons/${seasonId}`)}
                className="group p-3 rounded-xl bg-white/60 hover:bg-white/80 transition-all duration-300 hover:shadow-md"
              >
                <svg className="w-5 h-5 text-gray-600 group-hover:text-[#0066FF] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-r from-[#0066FF] to-purple-600 rounded-xl">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-[#0066FF] to-purple-600 bg-clip-text text-transparent">
                    Edit Season Details
                  </h1>
                  <p className="text-sm text-gray-600 mt-1">Update champions, awards, and other metadata</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="glass rounded-2xl shadow-xl backdrop-blur-md border border-white/30 p-8 space-y-8">
          {/* Success Message */}
          {successMessage && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-800">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">{successMessage}</span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-800">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">{error}</span>
              </div>
            </div>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 pb-2 border-b">
              <span className="text-xl">📋</span>
              Basic Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Season Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition-all"
                  placeholder="e.g., Season 2024"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Short Name
                </label>
                <input
                  type="text"
                  name="short_name"
                  value={formData.short_name}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition-all"
                  placeholder="e.g., S24"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition-all"
                placeholder="Season description..."
              />
            </div>
          </div>

          {/* Champions */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 pb-2 border-b">
              <span className="text-xl">🏆</span>
              Champions & Runner-up
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Champion Team
                </label>
                <input
                  type="text"
                  name="champion_team_name"
                  value={formData.champion_team_name}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition-all"
                  placeholder="Winning team name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Runner-up Team
                </label>
                <input
                  type="text"
                  name="runner_up_team_name"
                  value={formData.runner_up_team_name}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition-all"
                  placeholder="Second place team"
                />
              </div>
            </div>
          </div>

          {/* Individual Awards */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 pb-2 border-b">
              <span className="text-xl">⭐</span>
              Individual Awards
            </h3>

            {/* Top Scorer */}
            <div className="bg-green-50 rounded-lg p-4">
              <h4 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                <span>⚽</span> Top Scorer
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Player Name
                  </label>
                  <input
                    type="text"
                    name="top_scorer_player_name"
                    value={formData.top_scorer_player_name}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition-all"
                    placeholder="Player name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Goals
                  </label>
                  <input
                    type="number"
                    name="top_scorer_goals"
                    value={formData.top_scorer_goals}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition-all"
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>
            </div>

            {/* Best Goalkeeper */}
            <div className="bg-yellow-50 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-800 mb-3 flex items-center gap-2">
                <span>🧤</span> Best Goalkeeper
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Player Name
                  </label>
                  <input
                    type="text"
                    name="best_goalkeeper_player_name"
                    value={formData.best_goalkeeper_player_name}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition-all"
                    placeholder="Player name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Clean Sheets
                  </label>
                  <input
                    type="number"
                    name="best_goalkeeper_clean_sheets"
                    value={formData.best_goalkeeper_clean_sheets}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition-all"
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>
            </div>

            {/* Most Assists */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                <span>🎯</span> Most Assists
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Player Name
                  </label>
                  <input
                    type="text"
                    name="most_assists_player_name"
                    value={formData.most_assists_player_name}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition-all"
                    placeholder="Player name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assists
                  </label>
                  <input
                    type="number"
                    name="most_assists_count"
                    value={formData.most_assists_count}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition-all"
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>
            </div>

            {/* MVP */}
            <div className="bg-purple-50 rounded-lg p-4">
              <h4 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
                <span>👑</span> Most Valuable Player (MVP)
              </h4>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Player Name
                </label>
                <input
                  type="text"
                  name="mvp_player_name"
                  value={formData.mvp_player_name}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition-all"
                  placeholder="Player name"
                />
              </div>
            </div>

            {/* POTM */}
            <div className="bg-orange-50 rounded-lg p-4">
              <h4 className="font-semibold text-orange-800 mb-3 flex items-center gap-2">
                <span>🌟</span> Player of the Match (POTM)
              </h4>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Player ID
                </label>
                <input
                  type="number"
                  name="potm"
                  value={formData.potm}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition-all"
                  placeholder="Enter Player ID"
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 pb-2 border-b">
              <span className="text-xl">📝</span>
              Additional Notes
            </h3>
            
            <div>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition-all"
                placeholder="Any additional notes about this season..."
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-4 pt-6 border-t">
            <button
              type="button"
              onClick={() => router.push(`/dashboard/superadmin/historical-seasons/${seasonId}`)}
              className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={`px-8 py-3 rounded-lg font-medium text-white transition-all ${
                isSaving
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#0066FF] to-purple-600 hover:shadow-lg transform hover:scale-105'
              }`}
            >
              {isSaving ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Saving Changes...</span>
                </div>
              ) : (
                '💾 Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
