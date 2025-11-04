'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { getSeasonById } from '@/lib/firebase/seasons';
import { Season } from '@/types/season';
import { TeamData } from '@/types/team';
import { useCachedTeams } from '@/hooks/useCachedData';
import { calculateRealPlayerSalary } from '@/lib/contracts';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

export default function AssignRealPlayerPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { isCommitteeAdmin, userSeasonId } = usePermissions();
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  
  const { data: cachedTeams, isLoading: teamsLoading } = useCachedTeams();
  const allTeams = cachedTeams || [];
  
  const [formData, setFormData] = useState({
    teamId: '',
    playerName: '',
    auctionValue: 0,
    starRating: 5,
    startSeason: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && !isCommitteeAdmin) {
      router.push('/dashboard');
    }
  }, [user, loading, router, isCommitteeAdmin]);

  useEffect(() => {
    const fetchData = async () => {
      if (!userSeasonId) return;

      try {
        const season = await getSeasonById(userSeasonId);
        setCurrentSeason(season);
        
        // Set default start season to current season
        if (season) {
          setFormData(prev => ({ ...prev, startSeason: season.name }));
        }
      } catch (error) {
        console.error('Error fetching season:', error);
      }
    };

    if (isCommitteeAdmin && userSeasonId) {
      fetchData();
    }
  }, [isCommitteeAdmin, userSeasonId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.teamId || !formData.playerName || !formData.startSeason) {
      setError('Please fill in all required fields');
      return;
    }

    if (currentSeason?.type !== 'multi') {
      setError('This feature is only available for multi-season type');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      // Calculate salary
      const salaryPerMatch = calculateRealPlayerSalary(formData.auctionValue, formData.starRating);
      
      // Calculate end season (2 season contract)
      const startSeasonNum = parseInt(formData.startSeason.replace(/\D/g, '')) || 0;
      const endSeasonNum = startSeasonNum + 1;
      const endSeason = formData.startSeason.replace(/\d+/, endSeasonNum.toString());

      // Call API to assign real player
      const response = await fetchWithTokenRefresh('/api/contracts/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: formData.teamId,
          playerName: formData.playerName,
          auctionValue: formData.auctionValue,
          starRating: formData.starRating,
          startSeason: formData.startSeason,
          endSeason: endSeason,
          salaryPerMatch: salaryPerMatch,
          category: null, // Category will be manually assigned by admin
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to assign player');
      }

      setSuccess(`Successfully assigned ${formData.playerName} to team. Contract updated for ${formData.startSeason}-${endSeason}`);
      
      // Reset form
      setFormData({
        teamId: '',
        playerName: '',
        auctionValue: 0,
        starRating: 5,
        startSeason: currentSeason?.name || '',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to assign player');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || teamsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !isCommitteeAdmin) {
    return null;
  }

  if (currentSeason?.type !== 'multi') {
    return (
      <div className="min-h-screen py-8 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="glass rounded-3xl p-8 text-center">
            <p className="text-amber-600">This feature is only available for multi-season types (Season 16+)</p>
          </div>
        </div>
      </div>
    );
  }

  const teamsInSeason = allTeams.filter(t => t.season_id === userSeasonId);
  const salaryPerMatch = calculateRealPlayerSalary(formData.auctionValue, formData.starRating);

  return (
    <div className="min-h-screen py-4 sm:py-8 px-4">
      <div className="container mx-auto max-w-4xl">
        {/* Page Header */}
        <div className="glass rounded-3xl p-6 mb-8 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">Assign Real Player to Team</h1>
              <p className="text-gray-600 text-sm md:text-base">
                Assign SS Members to teams and update their contract details
              </p>
            </div>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 text-sm glass rounded-xl hover:bg-white/90 transition-all"
            >
              Back
            </button>
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="glass rounded-2xl p-4 mb-6 bg-green-50 border border-green-200">
            <p className="text-green-800 text-sm">{success}</p>
          </div>
        )}
        {error && (
          <div className="glass rounded-2xl p-4 mb-6 bg-red-50 border border-red-200">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Form */}
        <div className="glass rounded-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden">
          <form onSubmit={handleSubmit} className="space-y-0">
            <div className="px-8 py-6 bg-gradient-to-r from-[#9580FF]/5 to-[#9580FF]/10 border-b border-[#9580FF]/20">
              <h3 className="text-xl font-semibold text-[#9580FF]">Player & Contract Details</h3>
            </div>

            <div className="p-8 space-y-6">
              {/* Team Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Team *
                </label>
                <select
                  value={formData.teamId}
                  onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}
                  className="block w-full px-4 py-3 rounded-2xl border-2 border-gray-200 bg-white shadow-sm focus:ring-4 focus:ring-[#9580FF]/20 focus:border-[#9580FF] sm:text-sm"
                  required
                >
                  <option value="">Select a team</option>
                  {teamsInSeason.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.team_name} ({team.team_code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Player Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Player Name *
                </label>
                <input
                  type="text"
                  value={formData.playerName}
                  onChange={(e) => setFormData({ ...formData, playerName: e.target.value })}
                  className="block w-full px-4 py-3 rounded-2xl border-2 border-gray-200 bg-white shadow-sm focus:ring-4 focus:ring-[#9580FF]/20 focus:border-[#9580FF] sm:text-sm"
                  placeholder="Enter player name"
                  required
                />
              </div>

              {/* Auction Value */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Auction Value ($) *
                </label>
                <input
                  type="number"
                  value={formData.auctionValue || ''}
                  onChange={(e) => setFormData({ ...formData, auctionValue: parseInt(e.target.value) || 0 })}
                  className="block w-full px-4 py-3 rounded-2xl border-2 border-gray-200 bg-white shadow-sm focus:ring-4 focus:ring-[#9580FF]/20 focus:border-[#9580FF] sm:text-sm"
                  placeholder="Enter auction value"
                  required
                />
              </div>

              {/* Star Rating */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Star Rating (3☆ - 10☆) *
                </label>
                <select
                  value={formData.starRating}
                  onChange={(e) => setFormData({ ...formData, starRating: parseInt(e.target.value) })}
                  className="block w-full px-4 py-3 rounded-2xl border-2 border-gray-200 bg-white shadow-sm focus:ring-4 focus:ring-[#9580FF]/20 focus:border-[#9580FF] sm:text-sm"
                  required
                >
                  <option value="3">3☆</option>
                  <option value="4">4☆</option>
                  <option value="5">5☆</option>
                  <option value="6">6☆</option>
                  <option value="7">7☆</option>
                  <option value="8">8☆</option>
                  <option value="9">9☆</option>
                  <option value="10">10☆</option>
                </select>
                <p className="mt-2 text-sm text-gray-500">
                  Initial star rating • Base values: 3☆=$60, 4☆=$80, 9☆=$180, 10☆=$200
                </p>
              </div>

              {/* Start Season */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Start Season *
                </label>
                <input
                  type="text"
                  value={formData.startSeason}
                  onChange={(e) => setFormData({ ...formData, startSeason: e.target.value })}
                  className="block w-full px-4 py-3 rounded-2xl border-2 border-gray-200 bg-white shadow-sm focus:ring-4 focus:ring-[#9580FF]/20 focus:border-[#9580FF] sm:text-sm"
                  placeholder="e.g., Season 16"
                  required
                />
                <p className="mt-2 text-sm text-gray-500">Player's existing 2-season contract will be updated with team assignment</p>
              </div>

              {/* Contract & Category Info */}
              <div className="space-y-4">
                {/* Contract Info */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
                  <div className="flex items-start">
                    <div className="bg-blue-100 p-2 rounded-lg mr-3">
                      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-blue-900 mb-2">📄 2-Season Contract</h4>
                      <p className="text-sm text-blue-800">Player's existing 2-season contract will be updated with team assignment and salary details for both seasons.</p>
                    </div>
                  </div>
                </div>

                {/* Category Info */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
                  <div className="flex items-start">
                    <div className="bg-amber-100 p-2 rounded-lg mr-3">
                      <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-amber-900 mb-2">📊 Auto Category Assignment</h4>
                      <div className="text-sm text-amber-800 space-y-1">
                        <p>• <strong>Legend:</strong> Top 50% of players by points ranking</p>
                        <p>• <strong>Classic:</strong> Bottom 50% of players by points ranking</p>
                        <p className="text-xs mt-2 text-amber-700">Categories are automatically updated based on player performance and points</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Calculated Salary */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-[#9580FF]/5 to-[#0066FF]/5 border border-[#9580FF]/20">
                <h4 className="font-semibold text-gray-900 mb-4">Calculated Salary</h4>
                <p className="text-3xl font-bold text-[#9580FF] mb-2">${salaryPerMatch.toFixed(2)} <span className="text-lg text-gray-600">per match</span></p>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Formula: (${formData.auctionValue} ÷ 100) × {formData.starRating}☆ ÷ 10</p>
                  <p>= {((formData.auctionValue / 100) * formData.starRating).toFixed(2)} ÷ 10 = ${salaryPerMatch.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="px-8 py-6 bg-gray-50 border-t flex justify-between items-center">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-3 border-2 border-gray-300 text-sm font-medium rounded-2xl text-gray-700 bg-white hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="px-8 py-3 border border-transparent text-sm font-semibold rounded-2xl text-white bg-gradient-to-r from-[#9580FF] to-[#0066FF] hover:from-[#9580FF]/90 hover:to-[#0066FF]/90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Assigning...' : 'Assign Player'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
