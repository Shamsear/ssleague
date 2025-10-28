'use client'

import { useState } from 'react'

export default function TestNewsPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const testGeneration = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/news', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          generate_with_ai: true,
          generation_input: {
            event_type: 'player_milestone',
            category: 'milestone',
            season_name: 'SSPSLS16',
            metadata: {
              milestone_number: 50,
              player_count: 50,
            },
          },
        }),
      })

      const data = await response.json()
      
      if (response.ok) {
        setResult(data)
      } else {
        setError(JSON.stringify(data, null, 2))
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">🧪 News Generation Test</h1>
        
        <button
          onClick={testGeneration}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 mb-4"
        >
          {loading ? 'Generating...' : 'Test AI News Generation'}
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <h3 className="font-bold text-red-800 mb-2">Error:</h3>
            <pre className="text-sm text-red-700 whitespace-pre-wrap">{error}</pre>
          </div>
        )}

        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-bold text-green-800 mb-2">Success!</h3>
            <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-white p-4 rounded">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
