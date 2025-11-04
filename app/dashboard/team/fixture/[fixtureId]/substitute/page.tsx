'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import LineupSubstitution from '@/components/LineupSubstitution';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

export default function FixtureSubstitutePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const fixtureId = params?.fixtureId as string;

  const [fixture, setFixture] = useState<any>(null);
  const [lineup, setLineup] = useState<any>(null);
  const [teamId, setTeamId] = useState<string>('');
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && fixtureId) {
      fetchFixtureAndLineup();
    }
  }, [user, fixtureId]);

  const fetchFixtureAndLineup = async () => {
    try {
      setLoadingData(true);
      setError(null);

      // Fetch fixture details
      const fixtureRes = await fetchWithTokenRefresh(`/api/fixtures/${fixtureId}`);
      const fixtureData = await fixtureRes.json();
      
      if (!fixtureData.success) {
        throw new Error('Fixture not found');
      }

      setFixture(fixtureData.fixture);

      // Determine which team the user belongs to
      const userTeamId = fixtureData.fixture.home_team_id === user?.team_id
        ? fixtureData.fixture.home_team_id
        : fixtureData.fixture.away_team_id;
      
      setTeamId(userTeamId);

      // Fetch lineup
      const lineupRes = await fetchWithTokenRefresh(`/api/lineups?fixture_id=${fixtureId}&team_id=${userTeamId}`);
      const lineupData = await lineupRes.json();
      
      if (!lineupData.success || !lineupData.lineups) {
        throw new Error('No lineup found for this fixture');
      }

      setLineup(lineupData.lineups);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      setError(error.message || 'Failed to load fixture data');
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubstitutionSuccess = () => {
    // Refresh lineup to get updated starting XI and substitutes
    fetchFixtureAndLineup();
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href={`/dashboard/team/fixture/${fixtureId}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Back to Fixture
          </Link>
        </div>
      </div>
    );
  }

  if (!user || !fixture || !lineup) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 py-8 px-4">
      <div className="container mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/dashboard/team/fixture/${fixtureId}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-700 hover:text-blue-600 font-medium transition-all rounded-lg shadow-sm hover:shadow-md"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Fixture
          </Link>
        </div>

        {/* Fixture Info */}
        <div className="glass rounded-2xl p-6 mb-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Match Substitutions
              </h1>
              <p className="text-gray-600 mt-1">Round {fixture.round_number} - Match #{fixture.match_number}</p>
            </div>
            {lineup.is_locked && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                🔒 Lineup Locked
              </span>
            )}
          </div>

          <div className="flex items-center justify-center gap-4 py-4 border-t border-gray-200">
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900">{fixture.home_team_name}</div>
              <div className="text-xs text-gray-500">Home</div>
            </div>
            <div className="text-2xl font-bold text-gray-400">VS</div>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900">{fixture.away_team_name}</div>
              <div className="text-xs text-gray-500">Away</div>
            </div>
          </div>
        </div>

        {/* Current Lineup Display */}
        <div className="glass rounded-2xl p-6 mb-6 shadow-lg">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Current Lineup</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-green-600 mb-2">⭐ Starting XI ({lineup.starting_xi.length})</h4>
              <div className="text-xs text-gray-600 space-y-1">
                {lineup.starting_xi.map((playerId: string, idx: number) => (
                  <div key={playerId} className="bg-green-50 rounded px-2 py-1">
                    Player {idx + 1}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-blue-600 mb-2">🔄 Substitutes ({lineup.substitutes.length})</h4>
              <div className="text-xs text-gray-600 space-y-1">
                {lineup.substitutes.map((playerId: string, idx: number) => (
                  <div key={playerId} className="bg-blue-50 rounded px-2 py-1">
                    Sub {idx + 1}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Substitution Interface */}
        <div className="glass rounded-2xl p-6 shadow-lg">
          {lineup.is_locked ? (
            <div className="text-center py-8">
              <div className="text-red-600 text-5xl mb-4">🔒</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Lineup is Locked</h3>
              <p className="text-gray-600">
                Substitutions can only be made before the lineup is locked.
              </p>
            </div>
          ) : (
            <LineupSubstitution
              lineupId={lineup.id}
              fixtureId={fixtureId}
              startingXI={lineup.starting_xi}
              substitutes={lineup.substitutes}
              onSubstitutionSuccess={handleSubstitutionSuccess}
            />
          )}
        </div>
      </div>
    </div>
  );
}
