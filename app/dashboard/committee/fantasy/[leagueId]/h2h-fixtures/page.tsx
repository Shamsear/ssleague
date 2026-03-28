'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface H2HFixture {
  fixture_id: string;
  team_a_id: string;
  team_b_id: string;
}

export default function H2HFixturesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const leagueId = params?.leagueId as string;

  const [selectedRound, setSelectedRound] = useState('');
  const [generationMethod, setGenerationMethod] = useState('random');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fixtures, setFixtures] = useState<H2HFixture[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && user.role !== 'committee_admin' && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && leagueId && selectedRound) {
      loadFixtures();
    }
  }, [user, leagueId, selectedRound]);

  const loadFixtures = async () => {
    try {
      const response = await fetchWithTokenRefresh(
        `/api/fantasy/h2h/fixtures?league_id=${leagueId}&round_id=${selectedRound}`
      );
      const data = await response.json();
      
      if (data.success) {
        setFixtures(data.fixtures || []);
      }
    } catch (err) {
      console.error('Error loading fixtures:', err);
    }
  };

  const handleGenerate = async () => {
    if (!selectedRound) {
      setError('Please select a round');
      return;
    }

    const regenerate = fixtures.length > 0;
    const confirmMessage = regenerate
      ? 'Fixtures already exist for this round. Regenerate them?'
      : `Generate H2H fixtures for ${selectedRound}?`;

    if (!confirm(confirmMessage)) {
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetchWithTokenRefresh('/api/fantasy/h2h/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          league_id: leagueId,
          round_id: selectedRound,
          regenerate: regenerate
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate fixtures');
      }

      setSuccess(`Successfully generated ${data.fixtures_count} H2H fixtures!`);
      setFixtures(data.fixtures);
    } catch (err: any) {
      setError(err.message || 'Failed to generate fixtures');
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-6xl">
        <Link
          href={`/dashboard/committee/fantasy/${leagueId}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-6 text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </Link>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center text-white">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">H2H Fixtures</h1>
              <p className="text-gray-600">Generate weekly head-to-head matchups</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-red-900 mb-1">Error</h3>
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-green-900 mb-1">Success</h3>
                  <p className="text-sm text-green-800">{success}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">Head-to-Head System</h3>
                <p className="text-sm text-blue-800">
                  Generate weekly matchups between teams. Winners get 3 points, draws get 1 point each. 
                  H2H standings run parallel to the main league (total points).
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Round
              </label>
              <select
                value={selectedRound}
                onChange={(e) => setSelectedRound(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Choose a round...</option>
                <option value="round_1">Round 1</option>
                <option value="round_2">Round 2</option>
                <option value="round_3">Round 3</option>
              </select>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Fixture Generation Options</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:border-indigo-500 transition-colors">
                  <input 
                    type="radio" 
                    name="generation" 
                    value="random" 
                    checked={generationMethod === 'random'}
                    onChange={(e) => setGenerationMethod(e.target.value)}
                    className="w-4 h-4 text-indigo-600" 
                  />
                  <div>
                    <p className="font-medium text-gray-900">Random Matchups</p>
                    <p className="text-sm text-gray-600">Randomly pair teams for this round (avoids recent repeats)</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:border-indigo-500 transition-colors opacity-50">
                  <input 
                    type="radio" 
                    name="generation" 
                    value="ranked" 
                    disabled
                    className="w-4 h-4 text-indigo-600" 
                  />
                  <div>
                    <p className="font-medium text-gray-900">Ranked Matchups (Coming Soon)</p>
                    <p className="text-sm text-gray-600">Pair teams based on current standings</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:border-indigo-500 transition-colors opacity-50">
                  <input 
                    type="radio" 
                    name="generation" 
                    value="round-robin" 
                    disabled
                    className="w-4 h-4 text-indigo-600" 
                  />
                  <div>
                    <p className="font-medium text-gray-900">Round Robin (Coming Soon)</p>
                    <p className="text-sm text-gray-600">Generate full season schedule</p>
                  </div>
                </label>
              </div>
            </div>

            {fixtures.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Current Fixtures ({fixtures.length})</h3>
                <div className="space-y-2">
                  {fixtures.map((fixture, index) => (
                    <div key={fixture.fixture_id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                      <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center text-sm font-bold text-pink-600">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          Team {fixture.team_a_id.slice(-4)} vs Team {fixture.team_b_id.slice(-4)}
                        </p>
                        <p className="text-sm text-gray-500">{fixture.fixture_id}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {fixtures.length === 0 && selectedRound && (
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Current Fixtures</h3>
                <div className="text-center text-gray-500 py-8">
                  No fixtures generated yet for this round.
                </div>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !selectedRound}
              className="w-full px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-600 text-white font-semibold rounded-lg hover:from-pink-600 hover:to-rose-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Generating...' : fixtures.length > 0 ? 'Regenerate Fixtures' : 'Generate Fixtures'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
