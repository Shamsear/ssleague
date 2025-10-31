'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface PollOption {
  text_en: string;
  text_ml: string;
}

export default function CreatePollPage() {
  const router = useRouter();
  
  // Form state
  const [seasonId, setSeasonId] = useState('');
  const [pollType, setPollType] = useState('custom');
  const [questionEn, setQuestionEn] = useState('');
  const [questionMl, setQuestionMl] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [descriptionMl, setDescriptionMl] = useState('');
  const [options, setOptions] = useState<PollOption[]>([
    { text_en: '', text_ml: '' },
    { text_en: '', text_ml: '' },
  ]);
  const [closesAt, setClosesAt] = useState('');
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [allowChangeVote, setAllowChangeVote] = useState(true);
  const [showResultsBeforeClose, setShowResultsBeforeClose] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [templates, setTemplates] = useState<any>(null);
  const [availableData, setAvailableData] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Load templates and available data
  useEffect(() => {
    if (seasonId) {
      fetch(`/api/polls/create?season_id=${seasonId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setTemplates(data.templates);
            setAvailableData(data.available_data);
          }
        })
        .catch(console.error);
    }
  }, [seasonId]);

  const addOption = () => {
    setOptions([...options, { text_en: '', text_ml: '' }]);
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, field: 'text_en' | 'text_ml', value: string) => {
    const updated = [...options];
    updated[index][field] = value;
    setOptions(updated);
  };

  const loadTemplate = (templateType: string) => {
    const template = templates?.[templateType];
    if (!template) return;

    setPollType(templateType);
    
    // Set sample questions based on template
    if (templateType === 'match_prediction') {
      setQuestionEn('Who will win this match?');
      setQuestionMl('ആരാണ് ഈ മാച്ച് ജയിക്കുക?');
      setDescriptionEn('Predict the winner of this exciting match');
      setDescriptionMl('ഈ ആവേശകരമായ മാച്ചിന്റെ വിജയി പ്രവചിക്കുക');
    } else if (templateType === 'season_mvp') {
      setQuestionEn('Who is the season MVP?');
      setQuestionMl('സീസണിലെ MVP ആരാണ്?');
      setDescriptionEn('Vote for the most valuable player this season');
      setDescriptionMl('ഈ സീസണിലെ ഏറ്റവും മൂല്യവത്തായ കളിക്കാരന് വോട്ട് ചെയ്യുക');
    }
  };

  const loadPlayers = () => {
    if (!availableData?.players) return;
    
    setOptions(availableData.players.slice(0, 10).map((p: any) => ({
      text_en: p.name,
      text_ml: p.name, // In real scenario, you'd translate this
    })));
  };

  const loadTeams = () => {
    if (!availableData?.teams) return;
    
    setOptions(availableData.teams.map((t: any) => ({
      text_en: t.name,
      text_ml: t.name,
    })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validation
      if (!seasonId || !questionEn || !questionMl) {
        throw new Error('Season, English question, and Malayalam question are required');
      }

      if (options.length < 2) {
        throw new Error('At least 2 options are required');
      }

      const validOptions = options.filter(opt => opt.text_en && opt.text_ml);
      if (validOptions.length < 2) {
        throw new Error('At least 2 options must have both English and Malayalam text');
      }

      if (!closesAt) {
        throw new Error('Closing date/time is required');
      }

      const response = await fetch('/api/polls/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_id: seasonId,
          poll_type: pollType,
          question_en: questionEn,
          question_ml: questionMl,
          description_en: descriptionEn || null,
          description_ml: descriptionMl || null,
          options: validOptions,
          closes_at: closesAt,
          allow_multiple: allowMultiple,
          allow_change_vote: allowChangeVote,
          show_results_before_close: showResultsBeforeClose,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create poll');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/admin/polls');
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Create Custom Poll</h1>
        <p className="text-gray-600 mt-2">Create a bilingual poll for your season</p>
      </div>

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800 font-medium">✅ Poll created successfully! Redirecting...</p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 font-medium">❌ {error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Season and Template Selection */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Basic Info</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Season ID *
              </label>
              <input
                type="text"
                value={seasonId}
                onChange={(e) => setSeasonId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="season_16"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Poll Type
              </label>
              <select
                value={pollType}
                onChange={(e) => setPollType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="custom">Custom Poll</option>
                <option value="match_prediction">Match Prediction</option>
                <option value="player_of_match">Player of Match</option>
                <option value="daily_best_player">Daily Best Player</option>
                <option value="daily_best_team">Daily Best Team</option>
                <option value="weekly_top_player">Weekly Top Player</option>
                <option value="weekly_top_team">Weekly Top Team</option>
                <option value="season_champion">Season Champion</option>
                <option value="season_mvp">Season MVP</option>
              </select>
            </div>
          </div>

          {templates && (
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => loadTemplate(pollType)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Load Template
              </button>
              {availableData && (
                <>
                  <button
                    type="button"
                    onClick={loadPlayers}
                    className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                  >
                    Load Players
                  </button>
                  <button
                    type="button"
                    onClick={loadTeams}
                    className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                  >
                    Load Teams
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Question */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Poll Question</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Question (English) *
              </label>
              <input
                type="text"
                value={questionEn}
                onChange={(e) => setQuestionEn(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Who is your favorite player?"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Question (Malayalam) *
              </label>
              <input
                type="text"
                value={questionMl}
                onChange={(e) => setQuestionMl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="നിങ്ങളുടെ പ്രിയ കളിക്കാരൻ ആരാണ്?"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (English)
              </label>
              <textarea
                value={descriptionEn}
                onChange={(e) => setDescriptionEn(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={2}
                placeholder="Optional description"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (Malayalam)
              </label>
              <textarea
                value={descriptionMl}
                onChange={(e) => setDescriptionMl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={2}
                placeholder="ഓപ്ഷണൽ വിവരണം"
              />
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Poll Options</h2>
            <button
              type="button"
              onClick={addOption}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              + Add Option
            </button>
          </div>

          <div className="space-y-4">
            {options.map((option, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-gray-700">Option {index + 1}</span>
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={option.text_en}
                    onChange={(e) => updateOption(index, 'text_en', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="English text"
                  />
                  <input
                    type="text"
                    value={option.text_ml}
                    onChange={(e) => updateOption(index, 'text_ml', e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Malayalam text"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Settings */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Poll Settings</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Closes At *
              </label>
              <input
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={allowMultiple}
                  onChange={(e) => setAllowMultiple(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Allow multiple choice</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={allowChangeVote}
                  onChange={(e) => setAllowChangeVote(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Allow users to change their vote</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={showResultsBeforeClose}
                  onChange={(e) => setShowResultsBeforeClose(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Show results before poll closes</span>
              </label>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Creating Poll...' : 'Create Poll'}
          </button>
          
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
          >
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Preview</h2>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              <div className="mb-4">
                <span className="text-xs font-medium text-gray-500 uppercase">{pollType}</span>
                <h3 className="text-xl font-bold text-gray-900 mt-1">{questionEn || 'Your question here'}</h3>
                {descriptionEn && <p className="text-sm text-gray-600 mt-2">{descriptionEn}</p>}
              </div>

              <div className="space-y-2">
                {options.filter(o => o.text_en).map((option, index) => (
                  <div key={index} className="border-2 border-gray-200 rounded-lg p-3 text-gray-700">
                    {option.text_en}
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-500">
                Closes: {closesAt ? new Date(closesAt).toLocaleString() : 'Not set'}
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
