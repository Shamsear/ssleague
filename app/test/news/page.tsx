'use client'

import { useState } from 'react'

export default function TestNewsPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const testEvents = [
    {
      name: 'Player Milestone (50)',
      eventType: 'player_milestone',
      category: 'milestone',
      metadata: { milestone_number: 50, player_count: 50 },
    },
    {
      name: 'Team Registered',
      eventType: 'team_registered',
      category: 'team',
      metadata: { team_name: 'Thunder FC', total_teams: 10 },
    },
    {
      name: 'Auction Start',
      eventType: 'auction_start',
      category: 'auction',
      metadata: { position: 'CF', round_number: 1, duration_seconds: 300 },
    },
    {
      name: 'Match Result',
      eventType: 'match_result',
      category: 'match',
      metadata: {
        home_team_name: 'Thunder FC',
        away_team_name: 'Storm FC',
        home_score: 3,
        away_score: 2,
        result: 'home_win',
      },
    },
    {
      name: 'Fantasy Draft',
      eventType: 'fantasy_draft',
      category: 'fantasy',
      metadata: { total_drafted: 20, player_name: 'Ronaldo', team_name: 'Fantasy FC' },
    },
  ]

  const generateNews = async (event: typeof testEvents[0]) => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generate_with_ai: true,
          generation_input: {
            event_type: event.eventType,
            category: event.category,
            season_name: 'SSPSLS16',
            season_id: 'SSPSLS16',
            metadata: event.metadata,
          },
        }),
      })

      const data = await response.json()

      if (data.success) {
        setResult(data)
      } else {
        setError(data.error || 'Failed to generate news')
      }
    } catch (err: any) {
      setError(err.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🧪 News Generation Test
          </h1>
          <p className="text-gray-600">
            Test AI news generation with images. Click any button to generate a news item.
          </p>
        </div>

        {/* Test Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {testEvents.map((event, index) => (
            <button
              key={index}
              onClick={() => generateNews(event)}
              disabled={loading}
              className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-transparent hover:border-blue-500"
            >
              <div className="text-left">
                <h3 className="font-bold text-gray-900 mb-2">{event.name}</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Category: {event.category}
                </p>
                <div className="text-xs text-gray-500 bg-gray-50 rounded p-2">
                  {Object.entries(event.metadata).map(([key, value]) => (
                    <div key={key}>
                      <span className="font-semibold">{key}:</span> {String(value)}
                    </div>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-700 font-medium">
              Generating news with AI and images...
            </p>
            <p className="text-sm text-gray-500 mt-2">
              This may take 5-10 seconds
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl shadow-xl p-6">
            <h3 className="text-xl font-bold text-red-800 mb-2">❌ Error</h3>
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-2xl font-bold text-green-600 mb-4">
              ✅ News Generated Successfully!
            </h2>

            {/* Image Preview */}
            {result.news?.image_url && (
              <div className="mb-6">
                <h3 className="font-bold text-gray-800 mb-2">Generated Image:</h3>
                <div className="rounded-xl overflow-hidden border-2 border-gray-200">
                  <img
                    src={result.news.image_url}
                    alt={result.news.title}
                    className="w-full h-auto"
                  />
                </div>
              </div>
            )}

            {/* News Content */}
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-gray-800 mb-1">Title:</h3>
                <p className="text-xl font-semibold text-gray-900">
                  {result.news?.title}
                </p>
              </div>

              <div>
                <h3 className="font-bold text-gray-800 mb-1">Summary:</h3>
                <p className="text-gray-700">{result.news?.summary}</p>
              </div>

              <div>
                <h3 className="font-bold text-gray-800 mb-1">Content:</h3>
                <p className="text-gray-700 whitespace-pre-line">
                  {result.news?.content}
                </p>
              </div>

              <div className="flex gap-4 pt-4 border-t">
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                  {result.news?.category}
                </span>
                <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-semibold">
                  {result.news?.generated_by === 'ai' ? '🤖 AI Generated' : 'Manual'}
                </span>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                  {result.news?.is_published ? '✓ Published' : '📝 Draft'}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex gap-3">
              <a
                href="/news"
                target="_blank"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                View on Public Page →
              </a>
              <a
                href="/admin/news"
                target="_blank"
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
              >
                View in Admin Panel →
              </a>
            </div>

            {/* Debug Info */}
            <details className="mt-6">
              <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
                View Raw Response (Debug)
              </summary>
              <pre className="mt-2 p-4 bg-gray-100 rounded-lg text-xs overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-2xl p-6">
          <h3 className="font-bold text-blue-900 mb-2">📖 How to Use:</h3>
          <ol className="list-decimal list-inside space-y-1 text-blue-800">
            <li>Click any test button above</li>
            <li>Wait 5-10 seconds for generation (AI text + image)</li>
            <li>View the generated news with image preview</li>
            <li>Click "View on Public Page" to see it live</li>
            <li>Click "View in Admin Panel" to edit/manage</li>
          </ol>
          <p className="mt-4 text-sm text-blue-700">
            💡 <strong>Note:</strong> Make sure you've added your Hugging Face API token to
            .env.local for image generation to work!
          </p>
        </div>
      </div>
    </div>
  )
}
