'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'

interface TeamBudget {
  teamId: string
  teamName: string
  currencySystem: string
  firebase: {
    football_budget: number
    football_spent: number
    real_player_budget: number
    real_player_spent: number
  }
  neon: {
    football_budget: number
    football_spent: number
  }
}

export default function BudgetSyncPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [teams, setTeams] = useState<TeamBudget[]>([])
  const [editedTeams, setEditedTeams] = useState<Map<string, Partial<TeamBudget['firebase'] & TeamBudget['neon']>>>(new Map())
  const [seasonName, setSeasonName] = useState('')
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
    if (!authLoading && user && user.role !== 'committee_admin') {
      router.push('/dashboard')
    }
  }, [user, authLoading, router])

  const loadTeams = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/committee/budget-sync/teams')
      const data = await response.json()

      if (data.success) {
        setTeams(data.teams || [])
        setSeasonName(data.seasonName || '')
        setLastChecked(new Date())
        setEditedTeams(new Map())
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error: any) {
      console.error('Error loading teams:', error)
      alert('Failed to load teams')
    } finally {
      setLoading(false)
    }
  }

  const handleFieldChange = (teamId: string, field: string, value: string) => {
    const numValue = parseFloat(value) || 0
    const currentEdits = editedTeams.get(teamId) || {}
    const newEdits = new Map(editedTeams)
    newEdits.set(teamId, { ...currentEdits, [field]: numValue })
    setEditedTeams(newEdits)
  }

  const getDisplayValue = (teamId: string, field: string, originalValue: number): number => {
    const edits = editedTeams.get(teamId)
    return edits && field in edits ? (edits as any)[field] : originalValue
  }

  const hasChanges = (teamId: string): boolean => {
    return editedTeams.has(teamId)
  }

  const saveChanges = async () => {
    const changedTeams = Array.from(editedTeams.entries()).map(([teamId, changes]) => ({
      teamId,
      changes
    }))

    if (changedTeams.length === 0) {
      alert('No changes to save')
      return
    }

    if (!confirm(`Save changes for ${changedTeams.length} team(s)?`)) {
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/committee/budget-sync/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: changedTeams })
      })
      const data = await response.json()

      if (data.success) {
        alert(`✅ Successfully updated ${data.updated} team(s)!`)
        await loadTeams()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error: any) {
      console.error('Error saving changes:', error)
      alert('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const resetChanges = () => {
    if (editedTeams.size === 0) return
    if (confirm('Discard all unsaved changes?')) {
      setEditedTeams(new Map())
    }
  }

  useEffect(() => {
    if (user && user.role === 'committee_admin') {
      loadTeams()
    }
  }, [user])

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user || user.role !== 'committee_admin') {
    return null
  }

  const hasAnyChanges = editedTeams.size > 0

  return (
    <div className="container mx-auto px-4 py-8 max-w-[1800px]">
      {/* Header */}
      <div className="glass rounded-3xl p-6 mb-8 shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold gradient-text mb-2">💰 Budget Management</h1>
            <p className="text-gray-600">View and edit all team budgets for {seasonName}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadTeams}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? '🔄 Loading...' : '� Refresh'}
            </button>
            {hasAnyChanges && (
              <>
                <button
                  onClick={resetChanges}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  ↺ Reset
                </button>
                <button
                  onClick={saveChanges}
                  disabled={saving}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? '⏳ Saving...' : '💾 Save Changes'}
                </button>
              </>
            )}
            <Link
              href="/dashboard/committee"
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              ← Back
            </Link>
          </div>
        </div>
        {lastChecked && (
          <p className="text-sm text-gray-500 mt-2">
            Last loaded: {lastChecked.toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Info Box */}
      <div className="glass rounded-xl p-4 mb-6 bg-blue-50 border border-blue-200">
        <h4 className="font-semibold text-blue-900 mb-2">ℹ️ Budget Fields</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-blue-800">
          <div>
            <strong>Firebase Fields (team_seasons):</strong>
            <ul className="ml-4 mt-1 space-y-1">
              <li>• <strong>football_budget</strong> - Football player budget</li>
              <li>• <strong>football_spent</strong> - Football player spending</li>
              <li>• <strong>real_player_budget</strong> - Real player budget</li>
              <li>• <strong>real_player_spent</strong> - Real player spending</li>
            </ul>
          </div>
          <div>
            <strong>Neon Fields (teams table):</strong>
            <ul className="ml-4 mt-1 space-y-1">
              <li>• <strong>football_budget</strong> - Available budget</li>
              <li>• <strong>football_spent</strong> - Total spent</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Teams Table */}
      <div className="glass rounded-3xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-blue-50 to-purple-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider sticky left-0 bg-gradient-to-r from-blue-50 to-purple-50 z-10">
                  Team
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Currency
                </th>
                <th colSpan={4} className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider bg-green-50">
                  Firebase (team_seasons)
                </th>
                <th colSpan={2} className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider bg-blue-50">
                  Neon (teams)
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Status
                </th>
              </tr>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 sticky left-0 bg-gradient-to-r from-blue-50 to-purple-50 z-10">Name</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-600">System</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 bg-green-50">FB Budget</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 bg-green-50">FB Spent</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 bg-green-50">Real Budget</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 bg-green-50">Real Spent</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 bg-blue-50">Budget</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 bg-blue-50">Spent</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-600">Changed</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {teams.map((team) => (
                <tr key={team.teamId} className={`hover:bg-gray-50 transition-colors ${hasChanges(team.teamId) ? 'bg-yellow-50' : ''}`}>
                  <td className="px-4 py-3 sticky left-0 bg-white z-10">
                    <div className="text-sm font-medium text-gray-900">{team.teamName}</div>
                    <div className="text-xs text-gray-500">{team.teamId}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {team.currencySystem}
                    </span>
                  </td>
                  
                  {/* Firebase Fields */}
                  <td className="px-4 py-3 text-right bg-green-50">
                    <input
                      type="number"
                      step="0.01"
                      value={getDisplayValue(team.teamId, 'football_budget', team.firebase.football_budget)}
                      onChange={(e) => handleFieldChange(team.teamId, 'football_budget', e.target.value)}
                      className="w-24 px-2 py-1 text-sm text-right border rounded focus:ring-2 focus:ring-green-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-right bg-green-50">
                    <input
                      type="number"
                      step="0.01"
                      value={getDisplayValue(team.teamId, 'football_spent', team.firebase.football_spent)}
                      onChange={(e) => handleFieldChange(team.teamId, 'football_spent', e.target.value)}
                      className="w-24 px-2 py-1 text-sm text-right border rounded focus:ring-2 focus:ring-green-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-right bg-green-50">
                    <input
                      type="number"
                      step="0.01"
                      value={getDisplayValue(team.teamId, 'real_player_budget', team.firebase.real_player_budget)}
                      onChange={(e) => handleFieldChange(team.teamId, 'real_player_budget', e.target.value)}
                      className="w-24 px-2 py-1 text-sm text-right border rounded focus:ring-2 focus:ring-green-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-right bg-green-50">
                    <input
                      type="number"
                      step="0.01"
                      value={getDisplayValue(team.teamId, 'real_player_spent', team.firebase.real_player_spent)}
                      onChange={(e) => handleFieldChange(team.teamId, 'real_player_spent', e.target.value)}
                      className="w-24 px-2 py-1 text-sm text-right border rounded focus:ring-2 focus:ring-green-500"
                    />
                  </td>

                  {/* Neon Fields */}
                  <td className="px-4 py-3 text-right bg-blue-50">
                    <input
                      type="number"
                      step="0.01"
                      value={getDisplayValue(team.teamId, 'neon_football_budget', team.neon.football_budget)}
                      onChange={(e) => handleFieldChange(team.teamId, 'neon_football_budget', e.target.value)}
                      className="w-24 px-2 py-1 text-sm text-right border rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-right bg-blue-50">
                    <input
                      type="number"
                      step="0.01"
                      value={getDisplayValue(team.teamId, 'neon_football_spent', team.neon.football_spent)}
                      onChange={(e) => handleFieldChange(team.teamId, 'neon_football_spent', e.target.value)}
                      className="w-24 px-2 py-1 text-sm text-right border rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </td>

                  <td className="px-4 py-3 text-center">
                    {hasChanges(team.teamId) ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        ✏️ Edited
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {teams.length === 0 && !loading && (
        <div className="glass rounded-xl p-12 text-center mt-6">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">No Teams Found</h3>
          <p className="text-gray-600">No teams registered for this season</p>
        </div>
      )}
    </div>
  )
}
