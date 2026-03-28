/**
 * Fantasy Predictions List Page
 * View all rounds and access prediction submission
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface PredictionHistory {
  prediction_id: string;
  round_id: string;
  is_locked: boolean;
  locked_at?: Date;
  bonus_points: number;
  correct_predictions: number;
  total_predictions: number;
}

export default function PredictionsListPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [history, setHistory] = useState<PredictionHistory[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);

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

      // Get prediction history
      const historyResponse = await fetch(
        `/api/fantasy/predictions/submit?league_id=${fetchedLeagueId}&team_id=${fetchedTeamId}&view=history`
      );

      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        setHistory(historyData.history || []);
        
        // Calculate total points
        const total = (historyData.history || []).reduce(
          (sum: number, pred: PredictionHistory) => sum + pred.bonus_points,
          0
        );
        setTotalPoints(total);
      }

    } catch (err) {
      console.error('Error loading predictions:', err);
      setError('Failed to load predictions');
    } finally {
      setLoading(false);
    }
  };

  const getAccuracy = (pred: PredictionHistory) => {
    if (pred.total_predictions === 0) return 0;
    return Math.round((pred.correct_predictions / pred.total_predictions) * 100);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
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
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          🔮 Match Predictions
        </h1>
        <p className="text-gray-600">
          Predict H2H matchup outcomes to earn bonus points
        </p>
      </div>

      {/* Total Points Summary */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg p-6 mb-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold mb-1">Total Prediction Points</h2>
            <p className="text-purple-100 text-sm">Earned from all rounds</p>
          </div>
          <div className="text-4xl font-bold">
            +{totalPoints}
          </div>
        </div>
      </div>

      {/* Bonus Points Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-900 mb-3">💰 How to Earn Points</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="text-center">
            <div className="text-xl font-bold text-blue-600">+5</div>
            <div className="text-gray-600">Correct Winner</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-blue-600">+10</div>
            <div className="text-gray-600">Correct Score</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-blue-600">+15</div>
            <div className="text-gray-600">Correct MOTM</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-blue-600">+50</div>
            <div className="text-gray-600">Perfect Round</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/dashboard/team/fantasy/predictions/current')}
          className="w-full bg-blue-600 text-white px-6 py-4 rounded-lg hover:bg-blue-700 font-medium text-lg flex items-center justify-center gap-2"
        >
          🎯 Make Predictions for Current Round
        </button>
      </div>

      {/* Prediction History */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Prediction History</h2>
        </div>

        {history.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="mb-4">No predictions yet</p>
            <button
              onClick={() => router.push('/dashboard/team/fantasy/predictions/current')}
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Make your first prediction
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {history.map((pred) => (
              <div
                key={pred.prediction_id}
                className="px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => router.push(`/dashboard/team/fantasy/predictions/${pred.round_id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">
                        Round {pred.round_id}
                      </h3>
                      {pred.is_locked ? (
                        <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium">
                          🔒 Locked
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                          ✏️ Editable
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>
                        {pred.total_predictions} prediction{pred.total_predictions !== 1 ? 's' : ''}
                      </span>
                      {pred.bonus_points > 0 && (
                        <>
                          <span>•</span>
                          <span>
                            {pred.correct_predictions} correct ({getAccuracy(pred)}%)
                          </span>
                        </>
                      )}
                      {pred.locked_at && (
                        <>
                          <span>•</span>
                          <span>
                            {new Date(pred.locked_at).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    {pred.bonus_points > 0 ? (
                      <div className="text-2xl font-bold text-green-600">
                        +{pred.bonus_points}
                      </div>
                    ) : pred.is_locked ? (
                      <div className="text-sm text-gray-500">
                        Awaiting results
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">
                        Not submitted
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-2">ℹ️ Tips</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Submit predictions before the round deadline</li>
          <li>• You can edit predictions until they are locked</li>
          <li>• Points are awarded after matches are completed</li>
          <li>• Perfect round bonus requires all predictions correct</li>
        </ul>
      </div>
    </div>
  );
}
