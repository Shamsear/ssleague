'use client';

import { useState, useEffect } from 'react';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

export default function AdminNotificationsPage() {
  const [notificationType, setNotificationType] = useState<'round_deadline' | 'lineup_deadline' | 'custom'>('custom');
  const [seasons, setSeasons] = useState<any[]>([]);
  const [rounds, setRounds] = useState<any[]>([]);
  const [fixtures, setFixtures] = useState<any[]>([]);
  
  const [selectedSeason, setSelectedSeason] = useState('');
  const [selectedRound, setSelectedRound] = useState('');
  const [selectedFixture, setSelectedFixture] = useState('');
  
  const [customTitle, setCustomTitle] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'season' | 'specific'>('all');
  
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Load seasons
  useEffect(() => {
    loadSeasons();
  }, []);

  // Load rounds when season changes
  useEffect(() => {
    if (selectedSeason) {
      loadRounds(selectedSeason);
    }
  }, [selectedSeason]);

  // Load fixtures when season changes
  useEffect(() => {
    if (selectedSeason) {
      loadFixtures(selectedSeason);
    }
  }, [selectedSeason]);

  const loadSeasons = async () => {
    try {
      const response = await fetchWithTokenRefresh('/api/seasons/list');
      if (response.ok) {
        const data = await response.json();
        setSeasons(data.data || []);
      }
    } catch (error) {
      console.error('Error loading seasons:', error);
    }
  };

  const loadRounds = async (seasonId: string) => {
    try {
      const response = await fetchWithTokenRefresh(`/api/rounds?season_id=${seasonId}&status=active`);
      if (response.ok) {
        const data = await response.json();
        setRounds(data.data || []);
      }
    } catch (error) {
      console.error('Error loading rounds:', error);
    }
  };

  const loadFixtures = async (seasonId: string) => {
    try {
      const response = await fetchWithTokenRefresh(`/api/fixtures/season?season_id=${seasonId}`);
      if (response.ok) {
        const data = await response.json();
        setFixtures(data.fixtures || []);
      }
    } catch (error) {
      console.error('Error loading fixtures:', error);
    }
  };

  const handleSend = async () => {
    setSending(true);
    setResult(null);

    try {
      const payload: any = {
        type: notificationType,
      };

      if (notificationType === 'round_deadline') {
        if (!selectedRound) {
          alert('Please select a round');
          setSending(false);
          return;
        }
        payload.roundId = selectedRound;
      } else if (notificationType === 'lineup_deadline') {
        if (!selectedFixture) {
          alert('Please select a fixture');
          setSending(false);
          return;
        }
        payload.fixtureId = selectedFixture;
      } else if (notificationType === 'custom') {
        if (!customTitle || !customBody) {
          alert('Please enter title and body');
          setSending(false);
          return;
        }
        payload.title = customTitle;
        payload.bodyText = customBody;
        payload.url = customUrl;
        payload.targetType = targetType;
        if (targetType === 'season' && selectedSeason) {
          payload.seasonId = selectedSeason;
        }
      }

      const response = await fetchWithTokenRefresh('/api/admin/send-manual-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      setResult(data);

      if (data.success) {
        alert(`✅ Notification sent to ${data.sentCount} device(s)!`);
      } else {
        alert(`❌ Failed: ${data.error}`);
      }
    } catch (error: any) {
      console.error('Error sending notification:', error);
      alert('Failed to send notification: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">📬 Send Manual Notification</h1>
          <p className="text-sm text-gray-600 mb-6">
            Send notifications to teams for deadline reminders or custom announcements
          </p>

          {/* Notification Type Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notification Type
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setNotificationType('round_deadline')}
                className={`px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                  notificationType === 'round_deadline'
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                🔨 Round Deadline
              </button>
              <button
                onClick={() => setNotificationType('lineup_deadline')}
                className={`px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                  notificationType === 'lineup_deadline'
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                ⚽ Lineup Deadline
              </button>
              <button
                onClick={() => setNotificationType('custom')}
                className={`px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                  notificationType === 'custom'
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                ✉️ Custom
              </button>
            </div>
          </div>

          {/* Round Deadline Form */}
          {notificationType === 'round_deadline' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Season
                </label>
                <select
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select season...</option>
                  {seasons.map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Active Round
                </label>
                <select
                  value={selectedRound}
                  onChange={(e) => setSelectedRound(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!selectedSeason}
                >
                  <option value="">Select round...</option>
                  {rounds.map((round) => (
                    <option key={round.id} value={round.id}>
                      Round #{round.round_number} {round.position ? `- ${round.position}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-gray-500">
                💡 This will send a deadline reminder to all teams in the season showing time remaining
              </p>
            </div>
          )}

          {/* Lineup Deadline Form */}
          {notificationType === 'lineup_deadline' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Season
                </label>
                <select
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select season...</option>
                  {seasons.map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fixture
                </label>
                <select
                  value={selectedFixture}
                  onChange={(e) => setSelectedFixture(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!selectedSeason}
                >
                  <option value="">Select fixture...</option>
                  {fixtures.map((fixture) => (
                    <option key={fixture.id} value={fixture.id}>
                      {fixture.team1_name} vs {fixture.team2_name} - {new Date(fixture.match_date).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-gray-500">
                💡 This will send a lineup deadline reminder to both teams in the fixture
              </p>
            </div>
          )}

          {/* Custom Notification Form */}
          {notificationType === 'custom' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Audience
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setTargetType('all')}
                    className={`px-4 py-2 rounded-lg border font-medium text-sm ${
                      targetType === 'all'
                        ? 'bg-purple-50 border-purple-500 text-purple-700'
                        : 'bg-white border-gray-200 text-gray-700'
                    }`}
                  >
                    All Users
                  </button>
                  <button
                    onClick={() => setTargetType('season')}
                    className={`px-4 py-2 rounded-lg border font-medium text-sm ${
                      targetType === 'season'
                        ? 'bg-purple-50 border-purple-500 text-purple-700'
                        : 'bg-white border-gray-200 text-gray-700'
                    }`}
                  >
                    Season Teams
                  </button>
                  <button
                    onClick={() => setTargetType('specific')}
                    className={`px-4 py-2 rounded-lg border font-medium text-sm ${
                      targetType === 'specific'
                        ? 'bg-purple-50 border-purple-500 text-purple-700'
                        : 'bg-white border-gray-200 text-gray-700'
                    }`}
                    disabled
                  >
                    Specific Users
                  </button>
                </div>
              </div>

              {targetType === 'season' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Season
                  </label>
                  <select
                    value={selectedSeason}
                    onChange={(e) => setSelectedSeason(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select season...</option>
                    {seasons.map((season) => (
                      <option key={season.id} value={season.id}>
                        {season.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g., Season 16 Starting Soon!"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  value={customBody}
                  onChange={(e) => setCustomBody(e.target.value)}
                  placeholder="e.g., Season 16 starts on January 1st. Register your team now!"
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Link URL (optional)
                </label>
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="/dashboard/team"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {/* Send Button */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg font-medium hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {sending ? '📤 Sending...' : '📬 Send Notification'}
            </button>
          </div>

          {/* Result Display */}
          {result && (
            <div className={`mt-6 p-4 rounded-lg ${
              result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{result.success ? '✅' : '❌'}</span>
                <span className={`font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                  {result.success ? 'Notification Sent!' : 'Failed to Send'}
                </span>
              </div>
              {result.success && (
                <p className="text-sm text-green-700">
                  Sent to {result.sentCount} device(s)
                  {result.failedCount > 0 && ` • ${result.failedCount} failed`}
                </p>
              )}
              {result.error && (
                <p className="text-sm text-red-700">{result.error}</p>
              )}
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <h3 className="text-sm font-bold text-blue-900 mb-2">💡 Usage Tips</h3>
          <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
            <li><strong>Round Deadline:</strong> Send reminder 1 hour before auction ends</li>
            <li><strong>Lineup Deadline:</strong> Send reminder 2-3 hours before match</li>
            <li><strong>Custom:</strong> Use for announcements, season starts, maintenance, etc.</li>
            <li>Notifications only go to users who have enabled notifications</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
