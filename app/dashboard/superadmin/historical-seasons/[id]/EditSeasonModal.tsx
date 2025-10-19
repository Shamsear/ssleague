'use client';

import { useState, useEffect } from 'react';
import { getIdToken } from 'firebase/auth';

interface EditSeasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  season: any;
  firebaseUser: any;
  onSuccess: () => void;
}

export default function EditSeasonModal({ isOpen, onClose, season, firebaseUser, onSuccess }: EditSeasonModalProps) {
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
    notes: ''
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (season && isOpen) {
      setFormData({
        name: season.name || '',
        short_name: season.short_name || '',
        description: season.description || '',
        champion_team_name: season.champion_team_name || '',
        runner_up_team_name: season.runner_up_team_name || '',
        top_scorer_player_name: season.top_scorer_player_name || '',
        top_scorer_goals: season.top_scorer_goals?.toString() || '',
        best_goalkeeper_player_name: season.best_goalkeeper_player_name || '',
        best_goalkeeper_clean_sheets: season.best_goalkeeper_clean_sheets?.toString() || '',
        most_assists_player_name: season.most_assists_player_name || '',
        most_assists_count: season.most_assists_count?.toString() || '',
        mvp_player_name: season.mvp_player_name || '',
        notes: season.notes || ''
      });
    }
  }, [season, isOpen]);

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

      const token = await getIdToken(firebaseUser);
      
      // Prepare update data (convert number strings to numbers)
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

      const response = await fetch(`/api/seasons/historical/${season.id}`, {
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
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('❌ Error updating season:', err);
      setError(err.message || 'Failed to update season');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-[#0066FF] to-purple-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold">Edit Season Details</h2>
                <p className="text-sm text-white/80 mt-1">Update champions, awards, and other metadata</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
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
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <span className="text-xl">📋</span>
              Basic Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Season Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent"
                placeholder="Season description..."
              />
            </div>
          </div>

          {/* Champions */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <span className="text-xl">🏆</span>
              Champions & Awards
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent"
                  placeholder="Second place team"
                />
              </div>
            </div>
          </div>

          {/* Individual Awards */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <span className="text-xl">⭐</span>
              Individual Awards
            </h3>

            {/* Top Scorer */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Top Scorer
                </label>
                <input
                  type="text"
                  name="top_scorer_player_name"
                  value={formData.top_scorer_player_name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>

            {/* Best Goalkeeper */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Best Goalkeeper
                </label>
                <input
                  type="text"
                  name="best_goalkeeper_player_name"
                  value={formData.best_goalkeeper_player_name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>

            {/* Most Assists */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Most Assists
                </label>
                <input
                  type="text"
                  name="most_assists_player_name"
                  value={formData.most_assists_player_name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>

            {/* MVP */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Most Valuable Player (MVP)
              </label>
              <input
                type="text"
                name="mvp_player_name"
                value={formData.mvp_player_name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent"
                placeholder="Player name"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <span className="text-xl">📝</span>
              Additional Notes
            </h3>
            
            <div>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0066FF] focus:border-transparent"
                placeholder="Any additional notes about this season..."
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={`px-6 py-2.5 rounded-lg font-medium text-white transition-all ${
                isSaving
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#0066FF] to-purple-600 hover:shadow-lg transform hover:scale-105'
              }`}
            >
              {isSaving ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Saving...</span>
</div>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
