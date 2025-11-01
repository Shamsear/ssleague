'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import LineupSubmission from '@/components/LineupSubmission';

export default function SelectOpponentLineupPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const fixtureId = params?.fixtureId as string;

  const [fixture, setFixture] = useState<any>(null);
  const [opponentTeamId, setOpponentTeamId] = useState<string>('');
  const [opponentTeamName, setOpponentTeamName] = useState<string>('');
  const [canSelectLineup, setCanSelectLineup] = useState(false);
  const [existingLineup, setExistingLineup] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && fixtureId) {
      fetchFixtureAndCheckEligibility();
    }
  }, [user, fixtureId]);

  const fetchFixtureAndCheckEligibility = async () => {
    try {
      setLoadingData(true);
      setError(null);

      // Fetch fixture details
      const fixtureRes = await fetch(`/api/fixtures/${fixtureId}`);
      
      if (!fixtureRes.ok) {
        throw new Error('Fixture not found');
      }

      const fixtureData = await fixtureRes.json();
      
      if (!fixtureData.fixture) {
        throw new Error('Fixture not found');
      }

      setFixture(fixtureData.fixture);

      // Determine which team is the user's team and which is opponent
      const isHomeTeam = fixtureData.fixture.home_team_id === user?.team_id;
      const isAwayTeam = fixtureData.fixture.away_team_id === user?.team_id;

      if (!isHomeTeam && !isAwayTeam) {
        setError('You are not part of this fixture');
        setLoadingData(false);
        return;
      }

      const userTeamId = isHomeTeam ? fixtureData.fixture.home_team_id : fixtureData.fixture.away_team_id;
      const opponentId = isHomeTeam ? fixtureData.fixture.away_team_id : fixtureData.fixture.home_team_id;
      const opponentName = isHomeTeam ? fixtureData.fixture.away_team_name : fixtureData.fixture.home_team_name;

      setOpponentTeamId(opponentId);
      setOpponentTeamName(opponentName);

      // Check if opponent lineup is eligible for selection
      const eligibilityRes = await fetch(`/api/lineups/opponent-selection-eligibility?fixture_id=${fixtureId}&opponent_team_id=${opponentId}`);
      const eligibilityData = await eligibilityRes.json();

      if (!eligibilityData.success || !eligibilityData.eligible) {
        setError(eligibilityData.message || 'Opponent lineup selection not available');
        setCanSelectLineup(false);
      } else {
        setCanSelectLineup(true);

        // Check if lineup already selected
        const lineupRes = await fetch(`/api/lineups?fixture_id=${fixtureId}&team_id=${opponentId}`);
        const lineupData = await lineupRes.json();
        
        if (lineupData.success && lineupData.lineups) {
          setExistingLineup(lineupData.lineups);
        }
      }
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmitSuccess = () => {
    // Refresh data
    fetchFixtureAndCheckEligibility();
    
    // Show success message
    setTimeout(() => {
      router.push(`/dashboard/team/fixture/${fixtureId}`);
    }, 2000);
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

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-red-50/30 py-8 px-4">
        <div className="container mx-auto max-w-5xl">
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

          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Not Available</h2>
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-yellow-50/30 py-8 px-4">
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

        {/* Warning Banner */}
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-6 mb-6 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-yellow-900 mb-1">Opponent Lineup Selection</h3>
              <p className="text-sm text-yellow-800">
                <strong>{opponentTeamName}</strong> has failed to submit their lineup within the deadline. 
                As their opponent, you are now permitted to select their lineup on their behalf.
              </p>
              <p className="text-sm text-yellow-700 mt-2">
                ⚠️ The same validation rules apply: minimum 2 classic category players required.
              </p>
            </div>
          </div>
        </div>

        {/* Fixture Info */}
        <div className="glass rounded-2xl p-6 mb-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
                Select Opponent's Lineup
              </h1>
              <p className="text-gray-600 mt-1">Round {fixture.round_number} - For {opponentTeamName}</p>
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
        </div>

        {/* Lineup Selection Component */}
        {canSelectLineup && (
          <div className="glass rounded-2xl p-6 shadow-lg border-2 border-yellow-200">
            <LineupSubmission
              fixtureId={fixtureId}
              teamId={opponentTeamId}
              seasonId={fixture.season_id}
              existingLineup={existingLineup}
              onSubmitSuccess={handleSubmitSuccess}
              isOpponentSelection={true}
              opponentTeamName={opponentTeamName}
            />
          </div>
        )}
      </div>
    </div>
  );
}
