'use client';

import { useState } from 'react';

export default function TestPlayerAwards() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    player_id: '',
    player_name: '',
    season_id: '1',
    award_name: 'Golden Boot',
    award_position: 'Winner',
    award_value: '',
  });

  const awardTypes = [
    'Golden Boot',
    'Most Assists',
    'Best Goalkeeper',
    'Best Attacker',
    'Best Midfielder',
    'Best Defender',
    'Player of the Season',
    'Young Player of the Season',
    'Most Clean Sheets',
    'Most Valuable Player',
  ];

  const positions = ['Winner', 'Runner-up', 'Third Place', null];

  const createAward = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const payload: any = {
        player_id: formData.player_id,
        player_name: formData.player_name,
        season_id: parseInt(formData.season_id),
        award_name: formData.award_name,
        award_position: formData.award_position || null,
      };

      if (formData.award_value) {
        payload.award_value = parseFloat(formData.award_value);
      }

      const response = await fetch('/api/player-awards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
        // Reset form
        setFormData({
          ...formData,
          award_value: '',
        });
      } else {
        setError(data.error || 'Failed to create award');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-amber-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            🏆 Test Player Awards
          </h1>
          <p className="text-gray-600 mb-8">
            Create test player awards to verify the system
          </p>

          <form onSubmit={createAward} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Player ID *
                </label>
                <input
                  type="text"
                  required
                  value={formData.player_id}
                  onChange={(e) => setFormData({ ...formData, player_id: e.target.value })}
                  placeholder="e.g., 1, 2, 3"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use a player ID from your database
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Player Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.player_name}
                  onChange={(e) => setFormData({ ...formData, player_name: e.target.value })}
                  placeholder="e.g., John Doe"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Season ID *
                </label>
                <input
                  type="number"
                  required
                  value={formData.season_id}
                  onChange={(e) => setFormData({ ...formData, season_id: e.target.value })}
                  placeholder="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Award Type *
                </label>
                <select
                  value={formData.award_name}
                  onChange={(e) => setFormData({ ...formData, award_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                >
                  {awardTypes.map((award) => (
                    <option key={award} value={award}>
                      {award}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Award Position
                </label>
                <select
                  value={formData.award_position}
                  onChange={(e) => setFormData({ ...formData, award_position: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                >
                  {positions.map((pos, idx) => (
                    <option key={idx} value={pos || ''}>
                      {pos || 'None'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Award Value (optional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.award_value}
                  onChange={(e) => setFormData({ ...formData, award_value: e.target.value })}
                  placeholder="e.g., 25 (goals)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Goals, assists, clean sheets, etc.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-6 rounded-xl font-semibold text-white transition-all duration-200 ${
                loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 shadow-lg hover:shadow-xl'
              }`}
            >
              {loading ? 'Creating Award...' : 'Create Player Award'}
            </button>
          </form>

          {error && (
            <div className="mt-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">{error}</div>
                </div>
              </div>
            </div>
          )}

          {result && (
            <div className="mt-6 bg-green-50 border-l-4 border-green-500 p-4 rounded-lg">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">Success!</h3>
                  <div className="mt-2 text-sm text-green-700">
                    <p className="font-semibold">Award created for {result.data?.player_name}</p>
                    <div className="mt-2 bg-white rounded p-2 text-xs">
                      <p><strong>Award:</strong> {result.data?.award_name}</p>
                      {result.data?.award_position && (
                        <p><strong>Position:</strong> {result.data?.award_position}</p>
                      )}
                      {result.data?.award_value && (
                        <p><strong>Value:</strong> {result.data?.award_value}</p>
                      )}
                      <p><strong>Season ID:</strong> {result.data?.season_id}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            📝 Quick Test Instructions
          </h2>
          <ol className="space-y-3 text-gray-700 text-sm">
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-yellow-500 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3">
                1
              </span>
              <span>Get a valid player ID from your database (check player profile URLs or database)</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-yellow-500 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3">
                2
              </span>
              <span>Fill in the form and create an award</span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-yellow-500 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3">
                3
              </span>
              <span>Navigate to that player's profile page at <code className="bg-gray-100 px-2 py-1 rounded">/dashboard/team/player/[id]</code></span>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-yellow-500 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3">
                4
              </span>
              <span>Verify the award appears in the "Season Awards" section</span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
