'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface StarConfig {
  star_rating: number;
  starting_points: number;
  base_auction_value: number;
}

export default function StarRatingConfigPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { isCommitteeAdmin, userSeasonId } = usePermissions();
  
  const [config, setConfig] = useState<StarConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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
    const fetchConfig = async () => {
      if (!userSeasonId) return;

      try {
        setIsLoading(true);
        const response = await fetchWithTokenRefresh(`/api/star-rating-config?seasonId=${userSeasonId}`);
        const result = await response.json();

        if (result.success) {
          setConfig(result.data);
        } else {
          setError(result.error);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (isCommitteeAdmin && userSeasonId) {
      fetchConfig();
    }
  }, [isCommitteeAdmin, userSeasonId]);

  const handleChange = (starRating: number, field: 'starting_points' | 'base_auction_value', value: number) => {
    setConfig(config.map(item => 
      item.star_rating === starRating 
        ? { ...item, [field]: value }
        : item
    ));
  };

  const handleSave = async () => {
    if (!userSeasonId) return;

    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetchWithTokenRefresh(/api/star-rating-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId: userSeasonId,
          config,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('✅ Configuration saved successfully!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600 font-medium">Loading configuration...</p>
        </div>
      </div>
    );
  }

  if (!user || !isCommitteeAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen py-8 px-4 bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard/committee')}
            className="mb-4 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-medium transition-all border border-gray-200"
          >
            ← Back to Dashboard
          </button>
          
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
              ⭐ Star Rating Configuration
            </h1>
            <p className="text-gray-600">
              Set starting points and base auction values for each star rating (3-10 stars)
            </p>
          </div>
        </div>

        {/* Messages */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg">
            <p className="text-green-800 font-medium">{success}</p>
          </div>
        )}
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
            <p className="text-red-800 font-medium">{error}</p>
          </div>
        )}

        {/* Info Card */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-1">How It Works</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>Starting Points:</strong> Initial points assigned to players when they register</li>
                <li>• <strong>Base Auction Value:</strong> Recommended starting bid for each star rating</li>
                <li>• Points adjust based on match performance (+/- 1-5 points per match)</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Configuration Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-600 to-indigo-600">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Star Rating</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Starting Points</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-white">Base Auction Value ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {config.map((item, index) => (
                  <tr key={item.star_rating} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{'⭐'.repeat(item.star_rating)}</span>
                        <span className="text-lg font-bold text-gray-900">{item.star_rating}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        value={item.starting_points}
                        onChange={(e) => handleChange(item.star_rating, 'starting_points', parseInt(e.target.value) || 0)}
                        min="0"
                        step="5"
                        className="w-32 px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-semibold text-lg"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        value={item.base_auction_value}
                        onChange={(e) => handleChange(item.star_rating, 'base_auction_value', parseInt(e.target.value) || 0)}
                        min="0"
                        step="10"
                        className="w-32 px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-semibold text-lg"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </span>
            ) : (
              '💾 Save Configuration'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
