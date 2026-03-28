/**
 * Fantasy Predictions Page
 * Submit predictions for H2H matchups to earn bonus points
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface H2HFixture {
  fixture_id: string;
  team_a_id: string;
  team_b_id: string;
  team_a_name?: string;
  team_b_name?: string;
  status: string;
}

interface MatchPrediction {
  match_id: string;
  predicted_winner?: string;
  predicted_score?: {
    home: number;
    away: number;
  };
}

interface PredictionSubmission {
  prediction_id: string;
  predictions: Record<string, MatchPrediction>;
  is_locked: boolean;
  locked_at?: Date;
  bonus_points: number;
  correct_predictions: number;
  total_predictions: number;
}

export default function PredictionsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const roundId = params.roundId as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [teamId, setTeamId] = useState<string | null>(null);
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [fixtures, setFixtures] = useState<H2HFixture[]>([]);
  const [predictions, setPredictions] = useState<Record<string, MatchPrediction>>({});
  const [existingPrediction, setExistingPrediction] = useState<PredictionSubmission | null>(null);
  const [deadline, setDeadline] = useState<Date | null>(null);

  useEffect(() => {
    loadData();
  }, [user, roundId]);

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

      // Get H2H fixtures for this round
      const fixturesResponse = await fetch(
        `/api/fantasy/h2h/fixtures?league_id=${fetchedLeagueId}&round_id=${roundId}`
      );
      
      if (fixturesResponse.ok) {
        const fixturesData = await fixturesResponse.json();
        setFixtures(fixturesData.fixtures || []);
      }

      // Get existing predictions
      const predictionsResponse = await fetch(
        `/api/fantasy/predictions/submit?league_id=${fetchedLeagueId}&team_id=${fetchedTeamId}&round_id=${roundId}`
      );

      if (predictionsResponse.ok) {
        const predictionsData = await predictionsResponse.json();
        if (predictionsData.predictions) {
          setExistingPrediction(predictionsData.predictions);
          setPredictions(predictionsData.predictions.predictions || {});
        }
      }

      // TODO: Get deadline from round info
      // For now, set a placeholder deadline
      const placeholderDeadline = new Date();
      placeholderDeadline.setDate(placeholderDeadline.getDate() + 2);
      setDeadline(placeholderDeadline);

    } catch (err) {
      console.error('Error loading predictions data:', err);
      setError('Failed to load predictions');
    } finally {
      setLoading(false);
    }
  };

  const handlePredictionChange = (fixtureId: string, field: string, value: any) => {
    setPredictions(prev => ({
      ...prev,
      [fixtureId]: {
        ...prev[fixtureId],
        match_id: fixtureId,
        [field]: value
      }
    }));
  };

  const handleScoreChange = (fixtureId: string, team: 'home' | 'away', value: string) => {
    const numValue = parseInt(value) || 0;
    setPredictions(prev => ({
      ...prev,
      [fixtureId]: {
        ...prev[fixtureId],
        match_id: fixtureId,
        predicted_score: {
          home: team === 'home' ? numValue : (prev[fixtureId]?.predicted_score?.home || 0),
          away: team === 'away' ? numValue : (prev[fixtureId]?.predicted_score?.away || 0)
        }
      }
    }));
  };

  const handleSubmit = async () => {
    if (!teamId || !leagueId) return;

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/fantasy/predictions/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          league_id: leagueId,
          team_id: teamId,
          round_id: roundId,
          predictions
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit predictions');
      }

      setSuccess('Predictions submitted successfully!');
      setExistingPrediction(data.submission);
      
      // Reload after a short delay
      setTimeout(() => {
        loadData();
      }, 1500);

    } catch (err) {
      console.error('Error submitting predictions:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit predictions');
    } finally {
      setSubmitting(false);
    }
  };

  const isDeadlinePassed = deadline && new Date() > deadline;
  const isLocked = existingPrediction?.is_locked || false;
  const canSubmit = !isDeadlinePassed && !isLocked && Object.keys(predictions).length > 0;

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && !fixtures.length) {
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
        <button
          onClick={() => router.back()}
          className="text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-1"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          🔮 Round {roundId} Predictions
        </h1>
        <p className="text-gray-600">
          Predict match outcomes to earn bonus points
        </p>
      </div>

      {/* Deadline Warning */}
      {deadline && (
        <div className={`rounded-lg p-4 mb-6 ${
          isDeadlinePassed 
            ? 'bg-red-50 border border-red-200' 
            : 'bg-blue-50 border border-blue-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">
                {isDeadlinePassed ? '⏰ Deadline Passed' : '⏰ Deadline'}
              </h3>
              <p className="text-sm text-gray-600">
                {deadline.toLocaleString()}
              </p>
            </div>
            {isLocked && (
              <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm font-medium">
                🔒 Locked
              </span>
            )}
          </div>
        </div>
      )}

      {/* Bonus Points Info */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg p-6 mb-6 text-white">
        <h2 className="text-xl font-bold mb-3">💰 Bonus Points</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-2xl font-bold">+5</div>
            <div className="text-sm text-purple-100">Correct Winner</div>
          </div>
          <div>
            <div className="text-2xl font-bold">+10</div>
            <div className="text-sm text-purple-100">Correct Score</div>
          </div>
          <div>
            <div className="text-2xl font-bold">+15</div>
            <div className="text-sm text-purple-100">Correct MOTM</div>
          </div>
          <div>
            <div className="text-2xl font-bold">+50</div>
            <div className="text-sm text-purple-100">Perfect Round</div>
          </div>
        </div>
      </div>

      {/* Existing Prediction Summary */}
      {existingPrediction && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-green-900 mb-2">
            ✅ Your Predictions
          </h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Submitted:</span>
              <span className="ml-2 font-medium">{existingPrediction.total_predictions} matches</span>
            </div>
            {existingPrediction.bonus_points > 0 && (
              <>
                <div>
                  <span className="text-gray-600">Correct:</span>
                  <span className="ml-2 font-medium">{existingPrediction.correct_predictions}</span>
                </div>
                <div>
                  <span className="text-gray-600">Points Earned:</span>
                  <span className="ml-2 font-medium text-green-600">
                    +{existingPrediction.bonus_points}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-green-800">{success}</p>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Fixtures List */}
      {fixtures.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600">No H2H fixtures available for this round yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {fixtures.map((fixture, index) => {
            const prediction = predictions[fixture.fixture_id] || {};
            const isDisabled = isLocked || isDeadlinePassed;

            return (
              <div
                key={fixture.fixture_id}
                className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">
                    Match {index + 1}
                  </h3>
                  {fixture.status && (
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                      {fixture.status}
                    </span>
                  )}
                </div>

                {/* Teams */}
                <div className="grid grid-cols-3 gap-4 items-center mb-4">
                  <div className="text-center">
                    <div className="font-medium text-gray-900">
                      {fixture.team_a_name || 'Team A'}
                    </div>
                  </div>
                  <div className="text-center text-gray-400 font-bold">VS</div>
                  <div className="text-center">
                    <div className="font-medium text-gray-900">
                      {fixture.team_b_name || 'Team B'}
                    </div>
                  </div>
                </div>

                {/* Winner Prediction */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Predicted Winner (+5 pts)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handlePredictionChange(fixture.fixture_id, 'predicted_winner', fixture.team_a_id)}
                      disabled={isDisabled}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        prediction.predicted_winner === fixture.team_a_id
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Team A
                    </button>
                    <button
                      onClick={() => handlePredictionChange(fixture.fixture_id, 'predicted_winner', 'draw')}
                      disabled={isDisabled}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        prediction.predicted_winner === 'draw'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Draw
                    </button>
                    <button
                      onClick={() => handlePredictionChange(fixture.fixture_id, 'predicted_winner', fixture.team_b_id)}
                      disabled={isDisabled}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        prediction.predicted_winner === fixture.team_b_id
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Team B
                    </button>
                  </div>
                </div>

                {/* Score Prediction */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Predicted Score (+10 pts)
                  </label>
                  <div className="flex items-center justify-center gap-4">
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={prediction.predicted_score?.home || ''}
                      onChange={(e) => handleScoreChange(fixture.fixture_id, 'home', e.target.value)}
                      disabled={isDisabled}
                      placeholder="0"
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span className="text-gray-400 font-bold">-</span>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={prediction.predicted_score?.away || ''}
                      onChange={(e) => handleScoreChange(fixture.fixture_id, 'away', e.target.value)}
                      disabled={isDisabled}
                      placeholder="0"
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submit Button */}
      {fixtures.length > 0 && !isLocked && (
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => router.back()}
            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting ? (
              <>
                <span className="animate-spin">⏳</span>
                Submitting...
              </>
            ) : (
              <>
                💾 Submit Predictions
              </>
            )}
          </button>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ How It Works</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Predict the winner and score for each H2H matchup</li>
          <li>• Submit before the deadline to earn bonus points</li>
          <li>• Correct predictions add points to your total score</li>
          <li>• Get all predictions perfect for a +50 bonus!</li>
        </ul>
      </div>
    </div>
  );
}
