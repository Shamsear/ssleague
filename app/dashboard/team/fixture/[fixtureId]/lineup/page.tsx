'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import LineupSubmission from '@/components/LineupSubmission';
import { useAutoLockLineups } from '@/hooks/useAutoLockLineups';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

export default function FixtureLineupPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const fixtureId = params?.fixtureId as string;

  const [fixture, setFixture] = useState<any>(null);
  const [teamId, setTeamId] = useState<string>('');
  const [existingLineup, setExistingLineup] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [deadline, setDeadline] = useState<string | null>(null);

  // Auto-lock lineups when deadline passes
  useAutoLockLineups(fixtureId, deadline);

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
      const fixtureRes = await fetchWithTokenRefresh(`/api/fixtures/${fixtureId}`);
      
      if (!fixtureRes.ok) {
        throw new Error('Fixture not found');
      }

      const fixtureData = await fixtureRes.json();
      
      if (!fixtureData.fixture) {
        throw new Error('Fixture not found');
      }

      setFixture(fixtureData.fixture);

      // Fetch deadline information from editable API
      const editableRes = await fetchWithTokenRefresh(`/api/fixtures/${fixtureId}/editable`);
      const editableData = await editableRes.json();
      
      if (editableData.deadline) {
        setDeadline(editableData.deadline);
      }

      // Fetch user's team_id from team_seasons for this season
      const teamSeasonsRes = await fetchWithTokenRefresh(`/api/team-seasons?user_id=${user?.uid}&season_id=${fixtureData.fixture.season_id}`);
      const teamSeasonsData = await teamSeasonsRes.json();
      
      console.log('🔍 DEBUG - Team seasons data:', teamSeasonsData);
      
      if (!teamSeasonsData.success || !teamSeasonsData.team_season) {
        throw new Error('You are not registered for this season');
      }
      
      const actualTeamId = teamSeasonsData.team_season.team_id;
      
      // Determine which team the user belongs to
      console.log('🔍 DEBUG - Fixture data:', {
        fixtureId,
        home_team_id: fixtureData.fixture.home_team_id,
        away_team_id: fixtureData.fixture.away_team_id,
        home_team_name: fixtureData.fixture.home_team_name,
        away_team_name: fixtureData.fixture.away_team_name,
        user_uid: user?.uid,
        actual_team_id: actualTeamId
      });
      
      console.log('🔍 DEBUG - Team matching:', {
        is_home_team: fixtureData.fixture.home_team_id === actualTeamId,
        is_away_team: fixtureData.fixture.away_team_id === actualTeamId
      });
      
      const userTeamId = fixtureData.fixture.home_team_id === actualTeamId
        ? fixtureData.fixture.home_team_id
        : fixtureData.fixture.away_team_id;
      
      console.log('🔍 DEBUG - Determined userTeamId:', userTeamId);
      
      // Verify user's team is actually in this fixture
      if (userTeamId !== fixtureData.fixture.home_team_id && userTeamId !== fixtureData.fixture.away_team_id) {
        console.error('❌ User team not in fixture!');
        throw new Error('You are not part of this fixture');
      }
      
      setTeamId(userTeamId);

      // Fetch existing lineup if any - only for the user's team
      const lineupUrl = `/api/lineups?fixture_id=${fixtureId}&team_id=${userTeamId}`;
      console.log('🔍 DEBUG - Fetching lineup from:', lineupUrl);
      const lineupRes = await fetch(lineupUrl);
      const lineupData = await lineupRes.json();
      
      console.log('🔍 DEBUG - Lineup API response:', lineupData);
      
      // Verify the returned lineup belongs to this team
      if (lineupData.success && lineupData.lineups !== null && lineupData.lineups !== undefined) {
        console.log('🔍 DEBUG - Checking lineup team_id:', {
          returned_team_id: lineupData.lineups.team_id,
          expected_team_id: userTeamId,
          match: lineupData.lineups.team_id === userTeamId,
          lineupData: lineupData.lineups
        });
        
        // Double-check that the lineup's team_id matches
        if (lineupData.lineups.team_id === userTeamId) {
          console.log('✅ DEBUG - Team ID matches, setting lineup');
          setExistingLineup(lineupData.lineups);
        } else {
          console.error('❌ CRITICAL - Lineup team_id mismatch!', {
            returned: lineupData.lineups.team_id,
            expected: userTeamId
          });
        }
      } else {
        console.log('ℹ️ DEBUG - No existing lineup found for this team (lineups is null/undefined)');
        setExistingLineup(null);
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
