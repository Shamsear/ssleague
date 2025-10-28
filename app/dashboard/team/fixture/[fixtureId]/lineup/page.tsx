'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import LineupSubmission from '@/components/LineupSubmission';
import { useAutoLockLineups } from '@/hooks/useAutoLockLineups';

export default function FixtureLineupPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const fixtureId = params?.fixtureId as string;

  const [fixture, setFixture] = useState<any>(null);
  const [teamId, setTeamId] = useState<string>('');
  const [existingLineup, setExistingLineup] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);

  // Auto-lock lineups when deadline passes
  useAutoLockLineups(fixtureId, fixture?.lineup_deadline);

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

      // Fetch fixture details
      const fixtureRes = await fetch(`/api/fixtures/${fixtureId}`);
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

      // Fetch existing lineup if any
      const lineupRes = await fetch(`/api/lineups?fixture_id=${fixtureId}&team_id=${userTeamId}`);
      const lineupData = await lineupRes.json();
      
      if (lineupData.success && lineupData.lineups) {
        setExistingLineup(lineupData.lineups);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmitSuccess = () => {
    // Refresh lineup data
    fetchFixtureAndLineup();
    
    // Show success message or redirect
    setTimeout(() => {
      router.push(`/dashboard/team/fixture/${fixtureId}`);
    }, 1500);
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

  if (!user || !fixture) {
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
                Lineup Submission
              </h1>
              <p className="text-gray-600 mt-1">Round {fixture.round_number}</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Match #</div>
              <div className="text-2xl font-bold text-gray-900">{fixture.match_number}</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 py-4">
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

          {fixture.scheduled_date && (
            <div className="text-center text-sm text-gray-600 mt-2">
              Scheduled: {new Date(fixture.scheduled_date).toLocaleString()}
            </div>
          )}
        </div>

        {/* Lineup Submission Component */}
        <div className="glass rounded-2xl p-6 shadow-lg">
          <LineupSubmission
            fixtureId={fixtureId}
            teamId={teamId}
            seasonId={fixture.season_id}
            existingLineup={existingLineup}
            onSubmitSuccess={handleSubmitSuccess}
          />
        </div>
      </div>
    </div>
  );
}
