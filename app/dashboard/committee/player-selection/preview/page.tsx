'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'

interface Change {
  player_id: string
  name: string
  current_status: boolean
  new_status: boolean
}

interface PreviewData {
  success: boolean
  total_rows: number
  changes_count: number
  errors_count: number
  changes: Change[]
  errors: string[]
  position_filter?: string
}

export default function PlayerSelectionPreviewPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
    if (!authLoading && user && user.role !== 'committee_admin') {
      router.push('/dashboard')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    const loadPreview = async () => {
      const storedData = sessionStorage.getItem('selectionPreview')
      if (!storedData) {
        router.push('/dashboard/committee/player-selection')
        return
      }

      try {
        const parsed: PreviewData = JSON.parse(storedData)
        
        // Fetch current player statuses from Neon API
        const playersResponse = await fetch('/api/players')
        const { data: players } = await playersResponse.json()
        
        const playerStatusMap = new Map<string, boolean>()
        players.forEach((player: any) => {
          playerStatusMap.set(player.player_id || player.id, player.is_auction_eligible || false)
        })

        // Fill in current statuses
        const changesWithStatus = parsed.changes.map(change => ({
          ...change,
          current_status: playerStatusMap.get(change.player_id) || false
        }))

        // Filter out changes that don't actually change anything
        const actualChanges = changesWithStatus.filter(
          c => c.current_status !== c.new_status
        )

        setPreviewData({
          ...parsed,
          changes: actualChanges,
          changes_count: actualChanges.length
        })
      } catch (err) {
        console.error('Error loading preview:', err)
        alert('Failed to load preview data')
        router.push('/dashboard/committee/player-selection')
      } finally {
        setLoading(false)
      }
    }

    if (user?.role === 'committee_admin') {
      loadPreview()
    }
  }, [user, router])

  const handleApplyChanges = async () => {
    if (!previewData || previewData.changes.length === 0) {
      alert('No changes to apply')
      return
    }

    if (!confirm(`Are you sure you want to apply ${previewData.changes.length} change(s)?`)) {
      return
    }

    setApplying(true)
    try {
      // Fetch all players to get IDs
      const playersResponse = await fetch('/api/players')
      const { data: players } = await playersResponse.json()
      
      const playerIdMap = new Map<string, number>() // player_id -> id
      players.forEach((player: any) => {
        playerIdMap.set(player.player_id || player.id.toString(), player.id)
      })

      // Apply changes using Neon bulk update API
      const playerIdsToUpdate = previewData.changes
        .map(change => {
          const id = playerIdMap.get(change.player_id)
          return id ? { id, status: change.new_status } : null
        })
        .filter(Boolean)

      let successCount = 0
      let errorCount = 0

      // Group by status and update in bulk
      const toEnable = playerIdsToUpdate.filter(p => p!.status).map(p => p!.id)
      const toDisable = playerIdsToUpdate.filter(p => !p!.status).map(p => p!.id)

      if (toEnable.length > 0) {
        const response = await fetch('/api/players/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'updateEligibility',
            playerIds: toEnable,
            isEligible: true
          })
        })
        const result = await response.json()
        if (result.success) successCount += result.count
        else errorCount += toEnable.length
      }

      if (toDisable.length > 0) {
        const response = await fetch('/api/players/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'updateEligibility',
            playerIds: toDisable,
            isEligible: false
          })
        })
        const result = await response.json()
        if (result.success) successCount += result.count
        else errorCount += toDisable.length
      }

      errorCount = previewData.changes.length - successCount

      // Clear session storage
      sessionStorage.removeItem('selectionPreview')

      alert(`Successfully updated ${successCount} player(s)${errorCount > 0 ? `, ${errorCount} error(s)` : ''}`)
      router.push('/dashboard/committee/player-selection')
    } catch (err) {
      console.error('Error applying changes:', err)
      alert('Failed to apply changes')
    } finally {
      setApplying(false)
    }
  }

  const handleCancel = () => {
    if (confirm('Are you sure you want to cancel? All changes will be lost.')) {
      sessionStorage.removeItem('selectionPreview')
      router.push('/dashboard/committee/player-selection')
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading preview...</p>
        </div>
      </div>
    )
  }

  if (!user || user.role !== 'committee_admin' || !previewData) {
    return null
  }

  const stats = {
    toEnable: previewData.changes.filter(c => !c.current_status && c.new_status).length,
    toDisable: previewData.changes.filter(c => c.current_status && !c.new_status).length
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
      <div className="glass rounded-3xl p-3 sm:p-6 mb-4 sm:mb-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center">
            <Link
              href="/dashboard/committee/player-selection"
              className="inline-flex items-center justify-center p-2 mr-3 rounded-xl bg-white/60 text-gray-700 hover:bg-white/80 transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h2 className="text-2xl font-bold gradient-text">Preview Changes</h2>
              {previewData.position_filter && (
                <div className="flex items-center mt-2 mb-1">
                  <span className="px-3 py-1 text-sm rounded-full bg-blue-100 text-blue-800 font-medium">
                    {previewData.position_filter} Position
                  </span>
                  <span className="ml-2 text-xs text-gray-500">Position-specific upload</span>
                </div>
              )}
              <p className="text-sm text-gray-600 mt-1">Review and confirm player selection changes</p>
            </div>
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="glass p-4 rounded-xl bg-blue-50/50 shadow-sm">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Rows Processed</p>
                <p className="text-2xl font-bold text-blue-600">{previewData.total_rows}</p>
              </div>
            </div>
          </div>

          <div className="glass p-4 rounded-xl bg-green-50/50 shadow-sm">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">To Enable</p>
                <p className="text-2xl font-bold text-green-600">{stats.toEnable}</p>
              </div>
            </div>
          </div>

          <div className="glass p-4 rounded-xl bg-red-50/50 shadow-sm">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">To Disable</p>
                <p className="text-2xl font-bold text-red-600">{stats.toDisable}</p>
              </div>
            </div>
          </div>

          <div className="glass p-4 rounded-xl bg-yellow-50/50 shadow-sm">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-1.732-1.333-2.5 0L4.732 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Errors</p>
                <p className="text-2xl font-bold text-yellow-600">{previewData.errors_count}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Errors Section */}
        {previewData.errors.length > 0 && (
          <div className="glass p-4 rounded-xl bg-yellow-50/50 border border-yellow-200 mb-6">
            <h3 className="text-md font-semibold text-yellow-800 mb-3 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-1.732-1.333-2.5 0L4.732 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Parsing Errors ({previewData.errors.length})
            </h3>
            <div className="space-y-1">
              {previewData.errors.map((error, idx) => (
                <p key={idx} className="text-sm text-yellow-700">• {error}</p>
              ))}
            </div>
          </div>
        )}

        {/* Changes Preview */}
        {previewData.changes.length > 0 ? (
          <div className="glass p-4 rounded-xl bg-white/30 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Changes to Apply ({previewData.changes.length})
            </h3>
            <div className="overflow-x-auto rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-white/10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Player ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Name</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase">Current</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase"></th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase">New</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white/30">
                  {previewData.changes.map((change, idx) => (
                    <tr key={idx} className="hover:bg-white/60 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-700">{change.player_id}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{change.name}</td>
                      <td className="px-4 py-3 text-center">
                        {change.current_status ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Eligible
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Not Eligible
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <svg className="w-5 h-5 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {change.new_status ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Eligible
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Not Eligible
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="glass p-8 rounded-xl bg-gray-50/50 text-center mb-6">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg font-medium text-gray-700 mb-2">No Changes to Apply</p>
            <p className="text-sm text-gray-500">All players in the file already have the correct eligibility status</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          <button
            onClick={handleCancel}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleApplyChanges}
            disabled={previewData.changes.length === 0 || applying}
            className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {applying ? (
              <>
                <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Applying Changes...
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Apply {previewData.changes.length} Change{previewData.changes.length !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
