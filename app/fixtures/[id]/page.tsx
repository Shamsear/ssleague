'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Matchup {
  home_player_id: string;
  home_player_name: string;
  away_player_id: string;
  away_player_name: string;
  position: number;
  match_duration?: number;
  home_goals?: number | null;
  away_goals?: number | null;
  home_substituted?: boolean;
  home_original_player_name?: string;
  home_sub_penalty?: number;
  away_substituted?: boolean;
  away_original_player_name?: string;
  away_sub_penalty?: number;
}

interface Fixture {
  id: string;
  season_id: string;
  round_number: number;
  match_number: number;
  home_team_id: string;
  home_team_name: string;
  away_team_id: string;
  away_team_name: string;
  leg: string;
  status: string;
  scheduled_date?: string;
  home_score?: number;
  away_score?: number;
  motm_player_id?: string | null;
  motm_player_name?: string | null;
  home_penalty_goals?: number;
  away_penalty_goals?: number;
}

export default function PublicFixtureDetailPage() {
  const params = useParams();
  const fixtureId = params?.id as string;

  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (fixtureId) {
      fetchFixtureDetails();
    }
  }, [fixtureId]);

  const fetchFixtureDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch fixture details
      const fixtureResponse = await fetch(`/api/fixtures/${fixtureId}`);
      if (!fixtureResponse.ok) {
        throw new Error('Failed to fetch fixture details');
      }
      const fixtureData = await fixtureResponse.json();
      setFixture(fixtureData.fixture);

      // Fetch matchups
      const matchupsResponse = await fetch(`/api/fixtures/${fixtureId}/matchups`);
      if (matchupsResponse.ok) {
        const matchupsData = await matchupsResponse.json();
        if (matchupsData.success && matchupsData.matchups) {
          // Sort by position
          matchupsData.matchups.sort((a: Matchup, b: Matchup) => a.position - b.position);
          setMatchups(matchupsData.matchups);
        }
      }
    } catch (err: any) {
      console.error('Error fetching fixture details:', err);
      setError(err.message || 'Failed to load fixture details');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateScores = () => {
    if (!fixture || matchups.length === 0) {
      return { home: 0, away: 0 };
    }

    const homePlayerGoals = matchups.reduce((sum, m) => sum + (m.home_goals ?? 0), 0);
    const awayPlayerGoals = matchups.reduce((sum, m) => sum + (m.away_goals ?? 0), 0);
    
    const homeSubPenalties = matchups.reduce((sum, m) => sum + (m.home_sub_penalty ?? 0), 0);
    const awaySubPenalties = matchups.reduce((sum, m) => sum + (m.away_sub_penalty ?? 0), 0);
    
    const homeTotalGoals = homePlayerGoals + awaySubPenalties + (fixture.home_penalty_goals ?? 0);
    const awayTotalGoals = awayPlayerGoals + homeSubPenalties + (fixture.away_penalty_goals ?? 0);

    return {
      home: homeTotalGoals,
      away: awayTotalGoals,
      homePlayerGoals,
      awayPlayerGoals,
      homeSubPenalties,
      awaySubPenalties
    };
  };

  const scores = calculateScores();
  const hasResults = matchups.some(m => m.home_goals !== null && m.home_goals !== undefined);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading fixture details...</p>
        </div>
      </div>
    );
  }

  if (error || !fixture) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="glass rounded-3xl p-12 text-center shadow-xl backdrop-blur-md border border-white/20 max-w-md mx-4">
          <div className="text-6xl mb-4">⚠️</div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Fixture Not Found</h3>
          <p className="text-gray-600 mb-6">{error || 'This fixture does not exist or has been removed.'}</p>
          <Link
            href="/fixtures"
            className="inline-flex items-center px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
          >
            Back to Fixtures
          </Link>
        </div>
      </div>
    );
  }

  const winner = hasResults
    ? scores.home > scores.away
      ? 'home'
      : scores.away > scores.home
      ? 'away'
      : 'draw'
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <Link
          href="/fixtures"
          className="inline-flex items-center px-4 py-2 rounded-2xl text-gray-700 glass backdrop-blur-md border border-white/20 hover:shadow-lg transition-all duration-300 mb-6"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Fixtures
        </Link>

        {/* Match Header */}
        <div className="glass rounded-3xl p-8 shadow-xl backdrop-blur-md border border-white/20 mb-6">
          <div className="text-center mb-6">
            <p className="text-sm font-semibold text-gray-600 mb-2">
              Round {fixture.round_number} - {fixture.leg === 'first' ? '1st' : '2nd'} Leg
            </p>
            {fixture.scheduled_date && (
              <p className="text-xs text-gray-500">
                {new Date(fixture.scheduled_date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            )}
          </div>

          {/* Score Display */}
          <div className="grid grid-cols-3 gap-8 items-center mb-6">
            {/* Home Team */}
            <div className="text-center">
              <h2 className={`text-2xl font-bold mb-2 ${winner === 'home' ? 'text-green-600' : 'text-gray-900'}`}>
                {fixture.home_team_name}
              </h2>
              {hasResults && (
                <div className={`text-6xl font-bold ${winner === 'home' ? 'text-green-600' : 'text-gray-900'}`}>
                  {scores.home}
                </div>
              )}
            </div>

            {/* VS / Status */}
            <div className="text-center">
              {hasResults ? (
                <div>
                  <span className="text-gray-500 text-xl font-semibold block mb-2">FINAL</span>
                  {winner === 'draw' ? (
                    <span className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-xl font-bold">
                      DRAW
                    </span>
                  ) : (
                    <span className="px-4 py-2 bg-green-100 text-green-800 rounded-xl font-bold">
                      {winner === 'home' ? fixture.home_team_name : fixture.away_team_name} WON
                    </span>
                  )}
                </div>
              ) : (
                <div className="px-6 py-3 bg-blue-100 text-blue-800 rounded-xl font-bold">
                  {fixture.status === 'scheduled' || fixture.status === 'pending' ? 'UPCOMING' : fixture.status.toUpperCase()}
                </div>
              )}
            </div>

            {/* Away Team */}
            <div className="text-center">
              <h2 className={`text-2xl font-bold mb-2 ${winner === 'away' ? 'text-green-600' : 'text-gray-900'}`}>
                {fixture.away_team_name}
              </h2>
              {hasResults && (
                <div className={`text-6xl font-bold ${winner === 'away' ? 'text-green-600' : 'text-gray-900'}`}>
                  {scores.away}
                </div>
              )}
            </div>
          </div>

          {/* MOTM */}
          {hasResults && fixture.motm_player_name && (
            <div className="mt-6 pt-6 border-t border-gray-200 text-center">
              <span className="text-yellow-500 text-2xl mr-2">⭐</span>
              <span className="text-lg font-bold text-gray-900">
                Man of the Match: {fixture.motm_player_name}
              </span>
            </div>
          )}
        </div>

        {/* Matchups */}
        {matchups.length > 0 && (
          <div className="glass rounded-3xl p-8 shadow-xl backdrop-blur-md border border-white/20 mb-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Matchups</h3>
            <div className="space-y-4">
              {matchups.map((matchup, idx) => (
                <div
                  key={idx}
                  className="bg-white/60 rounded-2xl p-5 border border-white/40"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 text-right">
                      <p className="font-bold text-gray-900 mb-1">
                        {matchup.home_player_name}
                      </p>
                      {matchup.home_substituted && (
                        <p className="text-xs text-orange-600">
                          🔁 Sub: {matchup.home_original_player_name}
                          {matchup.home_sub_penalty && ` (-${matchup.home_sub_penalty} penalty)`}
                        </p>
                      )}
                    </div>

                    <div className="px-6 mx-4">
                      {hasResults ? (
                        <div className="text-center">
                          <span className="text-3xl font-bold text-gray-900">
                            {matchup.home_goals ?? 0} - {matchup.away_goals ?? 0}
                          </span>
                          <p className="text-xs text-gray-500 mt-1">
                            {matchup.match_duration || 6} min
                          </p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <span className="text-sm font-semibold text-gray-600 block">VS</span>
                          <p className="text-xs text-gray-500 mt-1">
                            {matchup.match_duration || 6} min
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 text-left">
                      <p className="font-bold text-gray-900 mb-1">
                        {matchup.away_player_name}
                      </p>
                      {matchup.away_substituted && (
                        <p className="text-xs text-orange-600">
                          🔁 Sub: {matchup.away_original_player_name}
                          {matchup.away_sub_penalty && ` (-${matchup.away_sub_penalty} penalty)`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Score Breakdown (if results available) */}
        {hasResults && (
          <div className="glass rounded-3xl p-8 shadow-xl backdrop-blur-md border border-white/20">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Score Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Home Team Breakdown */}
              <div className="bg-white/60 rounded-2xl p-6 border border-white/40">
                <h4 className="text-lg font-bold text-gray-900 mb-4">{fixture.home_team_name}</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Player Goals:</span>
                    <span className="font-bold">{scores.homePlayerGoals}</span>
                  </div>
                  {scores.awaySubPenalties > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Opponent Sub Penalties:</span>
                      <span className="font-bold text-green-600">+{scores.awaySubPenalties}</span>
                    </div>
                  )}
                  {(fixture.home_penalty_goals ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Fine/Violation Goals:</span>
                      <span className="font-bold text-green-600">+{fixture.home_penalty_goals}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-gray-300">
                    <span className="font-bold text-gray-900">Total:</span>
                    <span className="font-bold text-2xl text-gray-900">{scores.home}</span>
                  </div>
                </div>
              </div>

              {/* Away Team Breakdown */}
              <div className="bg-white/60 rounded-2xl p-6 border border-white/40">
                <h4 className="text-lg font-bold text-gray-900 mb-4">{fixture.away_team_name}</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Player Goals:</span>
                    <span className="font-bold">{scores.awayPlayerGoals}</span>
                  </div>
                  {scores.homeSubPenalties > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Opponent Sub Penalties:</span>
                      <span className="font-bold text-green-600">+{scores.homeSubPenalties}</span>
                    </div>
                  )}
                  {(fixture.away_penalty_goals ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Fine/Violation Goals:</span>
                      <span className="font-bold text-green-600">+{fixture.away_penalty_goals}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-gray-300">
                    <span className="font-bold text-gray-900">Total:</span>
                    <span className="font-bold text-2xl text-gray-900">{scores.away}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* No Matchups Message */}
        {matchups.length === 0 && (
          <div className="glass rounded-3xl p-12 text-center shadow-xl backdrop-blur-md border border-white/20">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Matchups Yet</h3>
            <p className="text-gray-600">
              Matchups for this fixture haven't been set up yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
