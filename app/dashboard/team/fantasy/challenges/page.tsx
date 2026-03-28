/**
 * Fantasy Challenges Page
 * View active challenges, track progress, and see completed challenges
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface Challenge {
  challenge_id: string;
  league_id: string;
  round_id: string | null;
  challenge_name: string;
  challenge_description: string;
  challenge_type: string;
  requirements: Record<string, any>;
  bonus_points: number;
  badge_name: string | null;
  start_date: Date;
  end_date: Date;
  is_active: boolean;
}

interface ChallengeCompletion {
  completion_id: string;
  challenge_id: string;
  team_id: string;
  completed_at: Date;
  bonus_points_awarded: number;
}

interface LeaderboardEntry {
  team_id: string;
  team_name: string;
  completions_count: number;
  total_bonus_points: number;
}

export default function ChallengesPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [completions, setCompletions] = useState<ChallengeCompletion[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

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

      // Get challenges and completions
      const challengesResponse = await fetch(
        `/api/fantasy/challenges?league_id=${fetchedLeagueId}&team_id=${fetchedTeamId}`
      );

      if (challengesResponse.ok) {
        const challengesData = await challengesResponse.json();
        setChallenges(challengesData.challenges || []);
        setCompletions(challengesData.completions || []);
      }

      // Get leaderboard
      const leaderboardResponse = await fetch(
        `/api/fantasy/challenges?league_id=${fetchedLeagueId}&view=leaderboard`
      );

      if (leaderboardResponse.ok) {
        const leaderboardData = await leaderboardResponse.json();
        setLeaderboard(leaderboardData.leaderboard || []);
      }

    } catch (err) {
      console.error('Error loading challenges:', err);
      setError('Failed to load challenges');
    } finally {
      setLoading(false);
    }
  };

  const isCompleted = (challengeId: string) => {
    return completions.some(c => c.challenge_id === challengeId);
  };

  const getCompletionDate = (challengeId: string) => {
    const completion = completions.find(c => c.challenge_id === challengeId);
    return completion ? new Date(completion.completed_at) : null;
  };

  const totalPointsEarned = completions.reduce(
    (sum, c) => sum + c.bonus_points_awarded,
    0
  );

  const activeChallenges = challenges.filter(c => c.is_active);
  const completedChallenges = challenges.filter(c => isCompleted(c.challenge_id));

  const getChallengeIcon = (type: string) => {
    switch (type) {
      case 'captain_masterclass': return '👑';
      case 'underdog_hero': return '🦸';
      case 'perfect_lineup': return '⭐';
      case 'differential_pick': return '🎯';
      case 'budget_genius': return '💰';
      case 'clean_sweep': return '🧹';
      case 'comeback_king': return '🔥';
      default: return '🏆';
    }
  };

  const getDifficultyColor = (points: number) => {
    if (points >= 40) return 'text-red-600 bg-red-50 border-red-200';
    if (points >= 30) return 'text-orange-600 bg-orange-50 border-orange-200';
    if (points >= 20) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  const getDifficultyLabel = (points: number) => {
    if (points >= 40) return 'Hard';
    if (points >= 30) return 'Medium';
    if (points >= 20) return 'Easy';
    return 'Very Easy';
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-40 bg-gray-200 rounded"></div>
            ))}
          </div>
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
          🏆 Weekly Challenges
        </h1>
        <p className="text-gray-600">
          Complete challenges to earn bonus points and badges
        </p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
          <div className="text-sm text-blue-100 mb-1">Active Challenges</div>
          <div className="text-3xl font-bold">{activeChallenges.length}</div>
        </div>
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
          <div className="text-sm text-green-100 mb-1">Completed</div>
          <div className="text-3xl font-bold">{completions.length}</div>
        </div>
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
          <div className="text-sm text-purple-100 mb-1">Bonus Points Earned</div>
          <div className="text-3xl font-bold">+{totalPointsEarned}</div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setShowLeaderboard(false)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            !showLeaderboard
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          My Challenges
        </button>
        <button
          onClick={() => setShowLeaderboard(true)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            showLeaderboard
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Leaderboard
        </button>
      </div>

      {/* Leaderboard View */}
      {showLeaderboard ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Challenge Leaderboard</h2>
            <p className="text-sm text-gray-600 mt-1">
              Top teams by challenges completed
            </p>
          </div>

          {leaderboard.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No challenge completions yet
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {leaderboard.map((entry, index) => (
                <div
                  key={entry.team_id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <div className={`text-2xl font-bold ${
                      index === 0 ? 'text-yellow-500' :
                      index === 1 ? 'text-gray-400' :
                      index === 2 ? 'text-orange-600' :
                      'text-gray-400'
                    }`}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {entry.team_name}
                        {entry.team_id === teamId && (
                          <span className="ml-2 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        {entry.completions_count} challenge{entry.completions_count !== 1 ? 's' : ''} completed
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-green-600">
                      +{entry.total_bonus_points}
                    </div>
                    <div className="text-xs text-gray-500">points</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Active Challenges */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              🎯 Active Challenges
            </h2>

            {activeChallenges.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                <p className="text-gray-600">No active challenges at the moment</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeChallenges.map((challenge) => {
                  const completed = isCompleted(challenge.challenge_id);
                  const completionDate = getCompletionDate(challenge.challenge_id);

                  return (
                    <div
                      key={challenge.challenge_id}
                      className={`rounded-lg border-2 p-6 transition-all ${
                        completed
                          ? 'bg-green-50 border-green-300'
                          : 'bg-white border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      {/* Challenge Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="text-4xl">
                            {getChallengeIcon(challenge.challenge_type)}
                          </div>
                          <div>
                            <h3 className="font-bold text-lg text-gray-900">
                              {challenge.challenge_name}
                            </h3>
                            {challenge.badge_name && (
                              <div className="text-sm text-gray-600">
                                {challenge.badge_name}
                              </div>
                            )}
                          </div>
                        </div>
                        {completed && (
                          <span className="px-3 py-1 bg-green-600 text-white rounded-full text-sm font-medium">
                            ✓ Done
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-gray-700 mb-4">
                        {challenge.challenge_description}
                      </p>

                      {/* Difficulty & Points */}
                      <div className="flex items-center justify-between">
                        <span className={`px-3 py-1 rounded-lg text-sm font-medium border ${
                          getDifficultyColor(challenge.bonus_points)
                        }`}>
                          {getDifficultyLabel(challenge.bonus_points)}
                        </span>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-blue-600">
                            +{challenge.bonus_points}
                          </div>
                          <div className="text-xs text-gray-500">points</div>
                        </div>
                      </div>

                      {/* Completion Info */}
                      {completed && completionDate && (
                        <div className="mt-4 pt-4 border-t border-green-200">
                          <div className="text-sm text-green-700">
                            ✓ Completed on {completionDate.toLocaleDateString()}
                          </div>
                        </div>
                      )}

                      {/* Time Remaining */}
                      {!completed && challenge.end_date && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="text-sm text-gray-600">
                            ⏰ Ends: {new Date(challenge.end_date).toLocaleDateString()}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Completed Challenges */}
          {completedChallenges.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                ✅ Completed Challenges
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedChallenges.map((challenge) => {
                  const completionDate = getCompletionDate(challenge.challenge_id);

                  return (
                    <div
                      key={challenge.challenge_id}
                      className="bg-gray-50 border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="text-2xl">
                          {getChallengeIcon(challenge.challenge_type)}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 text-sm">
                            {challenge.challenge_name}
                          </h3>
                        </div>
                        <div className="text-green-600 font-bold">
                          +{challenge.bonus_points}
                        </div>
                      </div>
                      {completionDate && (
                        <div className="text-xs text-gray-500">
                          {completionDate.toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Info Box */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ How Challenges Work</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• New challenges are released weekly</li>
          <li>• Complete challenges automatically by meeting requirements</li>
          <li>• Earn bonus points added to your total score</li>
          <li>• Collect badges to show off your achievements</li>
          <li>• Compete on the leaderboard for most challenges completed</li>
        </ul>
      </div>
    </div>
  );
}
