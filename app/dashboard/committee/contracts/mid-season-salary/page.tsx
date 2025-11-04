'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { getSeasonById } from '@/lib/firebase/seasons';
import { Season } from '@/types/season';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

export default function MidSeasonSalaryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { isCommitteeAdmin, userSeasonId } = usePermissions();
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [roundNumber, setRoundNumber] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

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
      } catch (error) {
        console.error('Error fetching season:', error);
      }
    };

    if (isCommitteeAdmin && userSeasonId) {
      fetchData();
    }
  }, [isCommitteeAdmin, userSeasonId]);

  const handleProcessSalary = async () => {
    if (!currentSeason || !userSeasonId) {
      setError('No season selected');
      return;
    }

    if (currentSeason.type !== 'multi') {
      setError('This feature is only available for multi-season types');
      return;
    }

    try {
      setProcessing(true);
      setError(null);
      setSuccess(null);
      setResult(null);

      const response = await fetchWithTokenRefresh('/api/contracts/mid-season-salary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId: userSeasonId,
          roundNumber,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process salary deductions');
      }

      setSuccess('Mid-season salary deductions processed successfully!');
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to process salary deductions');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
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

  return (
    <div className="min-h-screen py-4 sm:py-8 px-4">
      <div className="container mx-auto max-w-4xl">
        {/* Page Header */}
        <div className="glass rounded-3xl p-6 mb-8 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">Mid-Season Salary Payment</h1>
              <p className="text-gray-600 text-sm md:text-base">
                Process football player salary deductions for {currentSeason?.name}
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

        {/* Info Box */}
        <div className="glass rounded-2xl p-6 mb-6 bg-blue-50 border border-blue-200">
          <div className="flex items-start">
            <svg className="w-6 h-6 text-blue-600 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">About Mid-Season Salary</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Football player salaries = 10% of auction value per half-season</li>
                <li>• Deducted from team's Euro balance</li>
                <li>• Trigger this at mid-season round (e.g., Round 19 for 38-round season)</li>
                <li>• Process once per half-season</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="glass rounded-2xl p-4 mb-6 bg-green-50 border border-green-200">
            <p className="text-green-800 text-sm font-semibold">{success}</p>
          </div>
        )}
        {error && (
          <div className="glass rounded-2xl p-4 mb-6 bg-red-50 border border-red-200">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Form */}
        <div className="glass rounded-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden">
          <div className="px-8 py-6 bg-gradient-to-r from-[#9580FF]/5 to-[#9580FF]/10 border-b border-[#9580FF]/20">
            <h3 className="text-xl font-semibold text-[#9580FF]">Process Salary Deductions</h3>
          </div>

          <div className="p-8 space-y-6">
            {/* Current Season Info */}
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Season</p>
                  <p className="font-semibold text-gray-900">{currentSeason?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Rounds</p>
                  <p className="font-semibold text-gray-900">{currentSeason?.totalRounds || 38}</p>
                </div>
              </div>
            </div>

            {/* Round Number Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Current Round Number *
              </label>
              <input
                type="number"
                min="1"
                max={currentSeason?.totalRounds || 38}
                value={roundNumber}
                onChange={(e) => setRoundNumber(parseInt(e.target.value) || 1)}
                className="block w-full px-4 py-3 rounded-2xl border-2 border-gray-200 bg-white shadow-sm focus:ring-4 focus:ring-[#9580FF]/20 focus:border-[#9580FF] sm:text-sm"
                placeholder="Enter current round number"
              />
              <p className="mt-2 text-sm text-gray-500">
                Mid-season is typically at Round {Math.floor((currentSeason?.totalRounds || 38) / 2)}
              </p>
            </div>

            {/* Warning */}
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-amber-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm text-amber-800">
                  This will deduct salaries from all teams' Euro balance. Make sure you're at the correct mid-season round!
                </p>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="px-8 py-6 bg-gray-50 border-t flex justify-end">
            <button
              onClick={handleProcessSalary}
              disabled={processing}
              className="px-8 py-3 border border-transparent text-sm font-semibold rounded-2xl text-white bg-gradient-to-r from-[#9580FF] to-[#0066FF] hover:from-[#9580FF]/90 hover:to-[#0066FF]/90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? 'Processing...' : 'Process Salary Deductions'}
            </button>
          </div>
        </div>

        {/* Result Details */}
        {result && (
          <div className="glass rounded-3xl p-6 mt-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Processing Results</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                <span className="text-sm text-gray-600">Teams Processed</span>
                <span className="font-semibold text-gray-900">{result.teamsProcessed || 0}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                <span className="text-sm text-gray-600">Total Salary Deducted</span>
                <span className="font-semibold text-[#9580FF]">€{result.totalDeducted?.toFixed(2) || '0.00'}</span>
              </div>
              {result.errors && result.errors.length > 0 && (
                <div className="p-3 bg-red-50 rounded-xl border border-red-200">
                  <p className="text-sm font-semibold text-red-800 mb-2">Errors:</p>
                  <ul className="text-sm text-red-700 space-y-1">
                    {result.errors.map((err: string, idx: number) => (
                      <li key={idx}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
