'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { fetchWithTokenRefresh } from '@/lib/token-refresh'

interface DuplicateGroup {
  name: string
  position: string
  nationality: string
  duplicate_count: number
  players: any[]
}

export default function DuplicateManagementPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedToDelete, setSelectedToDelete] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [deleteStatus, setDeleteStatus] = useState('')

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
    if (!authLoading && user && user.role !== 'committee_admin') {
      router.push('/dashboard')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user?.role === 'committee_admin') {
      loadDuplicates()
    }
  }, [user])

  const loadDuplicates = async () => {
    try {
      setLoading(true)
      const response = await fetchWithTokenRefresh('/api/players/find-duplicates')
      const result = await response.json()

      if (result.success) {
        setDuplicates(result.data)
      } else {
        throw new Error(result.error)
      }
    } catch (error: any) {
      console.error('Error loading duplicates:', error)
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const togglePlayerSelection = (playerId: string) => {
    setSelectedToDelete(prev => {
      const newSet = new Set(prev)
      if (newSet.has(playerId)) {
        newSet.delete(playerId)
      } else {
        newSet.add(playerId)
      }
      return newSet
    })
  }

  const selectAllInGroup = (players: any[]) => {
    setSelectedToDelete(prev => {
      const newSet = new Set(prev)
      players.forEach(p => newSet.add(p.id))
      return newSet
    })
  }

  const deselectAllInGroup = (players: any[]) => {
    setSelectedToDelete(prev => {
      const newSet = new Set(prev)
      players.forEach(p => newSet.delete(p.id))
      return newSet
    })
  }

  const keepOnlyOne = (players: any[], keepIndex: number) => {
    setSelectedToDelete(prev => {
      const newSet = new Set(prev)
      players.forEach((p, idx) => {
        if (idx !== keepIndex) {
          newSet.add(p.id)
        } else {
          newSet.delete(p.id)
        }
      })
      return newSet
    })
  }

  const handleDeleteSelected = async () => {
    if (selectedToDelete.size === 0) {
      alert('No players selected for deletion')
      return
    }

    if (!confirm(`This will permanently delete ${selectedToDelete.size} player(s). Continue?`)) {
      return
    }

    try {
      setDeleting(true)
      setDeleteStatus('Deleting selected players...')

      const response = await fetchWithTokenRefresh('/api/players/delete-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerIds: Array.from(selectedToDelete)
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error)
      }

      setDeleteStatus(`Successfully deleted ${result.deleted} players!`)
      setSelectedToDelete(new Set())
      
      // Reload duplicates
      setTimeout(() => {
        loadDuplicates()
        setDeleteStatus('')
      }, 2000)
    } catch (error: any) {
      setDeleteStatus(`Error: ${error.message}`)
    } finally {
      setDeleting(false)
    }
  }

  if (authLoading || loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading duplicates...</p>
        </div>
      </div>
    )
  }

  if (user.role !== 'committee_admin') {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-screen-2xl">
      {/* Header */}
      <div className="glass rounded-3xl p-6 mb-8 shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold gradient-text mb-2">🔍 Duplicate Players Management</h1>
            <p className="text-gray-600">Find and remove duplicate player entries</p>
          </div>
          <Link
            href="/dashboard/committee/database"
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            ← Back
          </Link>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="glass rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-orange-600">{duplicates.length}</div>
          <div className="text-sm text-gray-600 mt-1">Duplicate Groups</div>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">
            {duplicates.reduce((sum, group) => sum + group.duplicate_count, 0)}
          </div>
          <div className="text-sm text-gray-600 mt-1">Total Duplicates</div>
        </div>
        <div className="glass rounded-xl p-4 text-center bg-red-50/50">
          <div className="text-3xl font-bold text-red-600">{selectedToDelete.size}</div>
          <div className="text-sm text-gray-600 mt-1">Selected for Deletion</div>
        </div>
      </div>

      {/* Action Bar */}
      {selectedToDelete.size > 0 && (
        <div className="glass rounded-xl p-4 mb-6 bg-red-50/50 border border-red-200">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-red-800">
                {selectedToDelete.size} player(s) selected for deletion
              </h3>
              <p className="text-sm text-red-600">
                These players will be permanently removed from the database
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedToDelete(new Set())}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Clear Selection
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={deleting}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {deleting ? 'Deleting...' : 'Delete Selected'}
              </button>
            </div>
          </div>
          {deleteStatus && (
            <div className="mt-3 p-3 bg-white rounded-lg border border-red-200">
              <p className="text-sm text-gray-800">{deleteStatus}</p>
            </div>
          )}
        </div>
      )}

      {/* Duplicate Groups */}
      {duplicates.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">No Duplicates Found!</h3>
          <p className="text-gray-600">All players have unique combinations of name, position, and nationality.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {duplicates.map((group, groupIdx) => (
            <div key={groupIdx} className="glass rounded-xl p-6 shadow-lg border border-orange-200">
              {/* Group Header */}
              <div className="flex justify-between items-start mb-4 pb-4 border-b border-gray-200">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{group.name}</h3>
                  <div className="flex gap-4 text-sm text-gray-600">
                    <span>📍 Position: <span className="font-medium">{group.position}</span></span>
                    <span>🌍 Nationality: <span className="font-medium">{group.nationality}</span></span>
                    <span className="text-orange-600 font-medium">
                      {group.duplicate_count} duplicates found
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => selectAllInGroup(group.players)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => deselectAllInGroup(group.players)}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm transition-colors"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Players in Group */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.players.map((player, playerIdx) => {
                  const isSelected = selectedToDelete.has(player.id)
                  
                  return (
                    <div
                      key={player.id}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'border-red-500 bg-red-50/50'
                          : 'border-gray-200 bg-white hover:border-blue-300'
                      }`}
                    >
                      {/* Selection Checkbox */}
                      <div className="flex items-start gap-3 mb-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => togglePlayerSelection(player.id)}
                          className="mt-1 w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                        <div className="flex-1">
                          <div className="font-bold text-gray-900 flex items-center gap-2">
                            {playerIdx === 0 && (
                              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                                Highest Rating
                              </span>
                            )}
                            {isSelected && (
                              <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                                Will Delete
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Player Details */}
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">ID:</span>
                          <span className="font-mono text-xs">{player.player_id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Rating:</span>
                          <span className="font-bold text-blue-600">{player.overall_rating || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Status:</span>
                          <span className={`font-medium ${player.is_sold ? 'text-green-600' : 'text-gray-500'}`}>
                            {player.is_sold ? '✅ Sold' : '⚪ Available'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Team:</span>
                          <span className="font-medium">{player.team_name || 'None'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Club:</span>
                          <span className="text-xs">{player.club || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Age:</span>
                          <span>{player.age || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Style:</span>
                          <span className="text-xs">{player.playing_style || 'N/A'}</span>
                        </div>
                        {player.is_sold && player.acquisition_value && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Value:</span>
                            <span className="text-green-600 font-medium">
                              {player.acquisition_value} eCoin
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Quick Actions */}
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <button
                          onClick={() => keepOnlyOne(group.players, playerIdx)}
                          className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition-colors"
                        >
                          Keep Only This One
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
