/**
 * Fantasy H2H (Head-to-Head) Page
 * View H2H standings, current matchup, and fixture history
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface H2HStanding {
  standing_id: string;
  team_id: string;
  team_name: string;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  points_for: number;
  points_against: number;
  points_difference: number;
}

interface H2HFixture {
  fixture_id: string;
  round_id: string;
  team_a_id: string;
  team_b_id: string;
  team_a_name: string;
  team_b_name: string;
  team_a_points: number;
  team_b_points: number;
  winner_id: string | null;
  is_draw: boolean;
  status: string;
}

export default function H2HPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [standings, setStandings] = useState<H2HStanding[]>([]);
  const [fixtures, setFixtures] = useState<H2HFixture[]>([]);
  const [teamRecord, setTeamRecord] = useState<H2HStanding | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      setError(null);

      // Get team info
      const teamResponse = await fetch(`/api/fantasy/teams/my-team?user_id=${user.uid}`);
      if (!teamResponse.ok) {
        if (teamResponse.status === 404) {
          setError('You are not registered in a fantasy league');
          return;
        }
        throw new Error('Failed to load team');
      }

      const teamData = await teamResponse.json();
      const fetchedTeamId = teamData.team.id;
      const fetchedLeagueId = teamData.team.league_id;
      setTeamId(fetchedTeamId);
      setLeagueId(fetchedLeagueId);

      // Get H2H standings
      const standingsResponse = await fetch(
        `/api/fantasy/h2h/standings?league_id=${fetchedLeagueId}&team_id=${fetchedTeamId}`
      );

      if (standingsResponse.ok) {
        const standingsData = await standingsResponse.json();
        setStandings(standingsData.standings || []);
        setTeamRecord(standingsData.team_record);
      }

      // Get team fixtures
      const fixturesResponse = await fetch(
        `/api/fantasy/h2h/standings?league_id=${fetchedLeagueId}&team_id=${fetchedTeamId}&view=fixtures`
      );

      if (fixturesResponse.ok) {
        const fixturesData = await fixturesResponse.json();
        setFixtures(fixturesData.fixtures || []);
      }

    } catch (err) {
      console.error('Error loading H2H data:', err);
      setError('Failed to load H2H data');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentMatchup = (): H2HFixture | null => {
    return fixtures.find(f => f.status === 'scheduled' || f.status === 'in_progress') || null;
  };

  const getCompletedFixtures = (): H2HFixture[] => {
    return fixtures.filter(f => f.status === 'completed');
  };

  const getTeamPosition = (): number => {
    if (!teamId) return 0;
    return standings.findIndex(s => s.team_id === teamId) + 1;
  };

  const getOpponentName = (fixture: H2HFixture): string => {
    if (!teamId) return '';
    return fixture.team_a_id === teamId ? fixture.team_b_name : fixture.team_a_name;
  };

  const getTeamPoints = (fixture: H2HFixture): number => {
    if (!teamId) return 0;
    return fixture.team_a_id === teamId ? fixture.team_a_points : fixture.team_b_points;
  };

  const getOpponentPoints = (fixture: H2HFixture): number => {
    if (!teamId) return 0;
    return fixture.team_a_id === teamId ? fixture.team_b_points : fixture.team_a_points;
  };

  const getMatchResult = (fixture: H2HFixture): 'win' | 'draw' | 'loss' | 'pending' => {
    if (fixture.status !== 'completed') return 'pending';
    if (fixture.is_draw) return 'draw';
    if (fixture.winner_id === teamId) return 'win';
    return 'loss';
  };

  const currentMatchup = getCurrentMatchup();
  const completedFixtures = getCompletedFixtures();
  const position = getTeamPosition();

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button
            onClick={loadData}
            className="mt-2 text-red-600 hover:text-red-800 underline"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          ⚔️ Head-to-Head
        </h1>
        <p className="text-gray-600">
          Weekly matchups and H2H league standings
        </p>
      </div>

      {/* Team Record Summary */}
      {teamRecord && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 text-white">
            <div className="text-sm text-blue-100 mb-1">Position</div>
            <div className="text-3xl font-bold">#{position}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">Played</div>
            <div className="text-3xl font-bold text-gray-900">{teamRecord.matches_played}</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-sm text-green-700 mb-1">Wins</div>
            <div className="text-3xl font-bold text-green-600">{teamRecord.wins}</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="text-sm text-yellow-700 mb-1">Draws</div>
            <div className="text-3xl font-bold text-yellow-600">{teamRecord.draws}</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-sm text-red-700 mb-1">Losses</div>
            <div className="text-3xl font-bold text-red-600">{teamRecord.losses}</div>
          </div>
        </div>
      )}

      {/* Current Matchup */}
      {currentMatchup && (
        <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg p-6 mb-6 text-white">
          <h2 className="text-xl font-bold mb-4">⚡ This Week's Matchup</h2>
          <div className="bg-white/10 backdrop-blur rounded-lg p-6">
            <div className="grid grid-cols-3 gap-4 items-center">
              {/* Team A */}
              <div className="text-center">
                <div className={`text-2xl font-bold mb-2 ${
                  currentMatchup.team_a_id === teamId ? 'text-yellow-300' : ''
                }`}>
                  {currentMatchup.team_a_name}
                  {currentMatchup.team_a_id === teamId && (
                    <span className="ml-2 text-sm">(You)</span>
                  )}
                </div>
                {currentMatchup.status === 'completed' && (
                  <div className="text-4xl font-bold">{currentMatchup.team_a_points}</div>
                )}
              </div>

              {/* VS */}
              <div className="text-center">
                <div className="text-3xl font-bold">VS</div>
                {currentMatchup.status === 'completed' && (
                  <div className="mt-2 text-sm">
                    {currentMatchup.is_draw ? 'Draw' : 
                     currentMatchup.winner_id === currentMatchup.team_a_id ? 
                     `${currentMatchup.team_a_name} wins` : 
                     `${currentMatchup.team_b_name} wins`}
                  </div>
                )}
              </div>

              {/* Team B */}
              <div className="text-center">
                <div className={`text-2xl font-bold mb-2 ${
                  currentMatchup.team_b_id === teamId ? 'text-yellow-300' : ''
                }`}>
                  {currentMatchup.team_b_name}
                  {currentMatchup.team_b_id === teamId && (
                    <span className="ml-2 text-sm">(You)</span>
                  )}
                </div>
                {currentMatchup.status === 'completed' && (
                  <div className="text-4xl font-bold">{currentMatchup.team_b_points}</div>
                )}
              </div>
            </div>

            {currentMatchup.status !== 'completed' && (
              <div className="text-center mt-4 text-sm text-purple-100">
                Round {currentMatchup.round_id.replace('round_', '')} • Awaiting results
              </div>
            )}
          </div>
        </div>
      )}

      {/* View Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setShowHistory(false)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            !showHistory
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Standings
        </button>
        <button
          onClick={() => setShowHistory(true)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            showHistory
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Match History
        </button>
      </div>

      {/* Standings Table */}
      {!showHistory ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-xl font-bold text-gray-900">H2H League Table</h2>
            <p className="text-sm text-gray-600 mt-1">
              Win = 3 pts • Draw = 1 pt • Loss = 0 pts
            </p>
          </div>

          {standings.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No H2H matches played yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pos
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Team
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      P
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      W
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      D
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      L
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      PF
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      PA
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      +/-
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pts
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {standings.map((standing, index) => (
                    <tr
                      key={standing.standing_id}
                      className={`hover:bg-gray-50 ${
                        standing.team_id === teamId ? 'bg-blue-50' : ''
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className={`text-sm font-medium ${
                            index < 3 ? 'text-blue-600' : 'text-gray-900'
                          }`}>
                            {index + 1}
                          </span>
                          {index === 0 && <span className="ml-1">🥇</span>}
                          {index === 1 && <span className="ml-1">🥈</span>}
                          {index === 2 && <span className="ml-1">🥉</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {standing.team_name}
                          {standing.team_id === teamId && (
                            <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                              You
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                        {standing.matches_played}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-green-600 font-medium">
                        {standing.wins}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-yellow-600 font-medium">
                        {standing.draws}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-red-600 font-medium">
                        {standing.losses}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                        {standing.points_for}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                        {standing.points_against}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                        <span className={
                          standing.points_difference > 0 ? 'text-green-600' :
                          standing.points_difference < 0 ? 'text-red-600' :
                          'text-gray-900'
                        }>
                          {standing.points_difference > 0 ? '+' : ''}{standing.points_difference}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-sm font-bold text-blue-600">
                          {standing.points}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Match History */
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Match History</h2>
            <p className="text-sm text-gray-600 mt-1">
              All your H2H fixtures this season
            </p>
          </div>

          {completedFixtures.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="mb-4">No completed matches yet</p>
              <button
                onClick={() => setShowHistory(false)}
                className="text-blue-600 hover:text-blue-800 underline"
              >
                View standings
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {completedFixtures.map((fixture) => {
                const result = getMatchResult(fixture);
                const opponentName = getOpponentName(fixture);
                const teamPoints = getTeamPoints(fixture);
                const opponentPoints = getOpponentPoints(fixture);

                return (
                  <div
                    key={fixture.fixture_id}
                    className="px-6 py-4 hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            result === 'win' ? 'bg-green-100 text-green-700' :
                            result === 'draw' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {result === 'win' ? 'W' : result === 'draw' ? 'D' : 'L'}
                          </span>
                          <span className="text-sm text-gray-600">
                            Round {fixture.round_id.replace('round_', '')}
                          </span>
                        </div>
                        <div className="font-semibold text-gray-900">
                          vs {opponentName}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">
                          {teamPoints} - {opponentPoints}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {result === 'win' ? '+3 pts' : result === 'draw' ? '+1 pt' : '0 pts'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ How H2H Works</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Each week you're matched against another team</li>
          <li>• Team with higher weekly points wins the matchup</li>
          <li>• Win = 3 points, Draw = 1 point, Loss = 0 points</li>
          <li>• H2H standings ranked by points, then goal difference</li>
          <li>• Compete for the H2H league title alongside overall points</li>
        </ul>
      </div>
    </div>
  );
}
