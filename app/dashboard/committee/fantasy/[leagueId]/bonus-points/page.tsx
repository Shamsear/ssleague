'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { fetchWithTokenRefresh } from '@/lib/token-refresh'
import { useModal } from '@/hooks/useModal'
import AlertModal from '@/components/modals/AlertModal'
import ConfirmModal from '@/components/modals/ConfirmModal'
import Link from 'next/link'

interface RealPlayer {
  real_player_id: string
  player_name: string
  position?: string
  real_team_name?: string
  star_rating?: number
}

interface PassiveTeam {
  team_id: string
  team_name: string
  fantasy_teams_count?: number // How many fantasy teams support this team
}

interface BonusPointRecord {
  id: number
  target_type: 'player' | 'team'
  target_id: string
  target_name: string
  points: number
  reason: string
  league_id: string
  awarded_by: string
  awarded_at: string
}

interface FantasyLeague {
  league_id: string
  league_name: string
  season_id: string
  is_active: boolean
}

export default function BonusPointsPage() {
  const router = useRouter()
  const params = useParams()
  const leagueId = params?.leagueId as string
  const { user, loading: authLoading } = useAuth()
  
  const [league, setLeague] = useState<FantasyLeague | null>(null)
  const [targetType, setTargetType] = useState<'player' | 'team'>('player')
  const [selectedTargets, setSelectedTargets] = useState<string[]>([])
  const [points, setPoints] = useState<number>(0)
  const [reason, setReason] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [players, setPlayers] = useState<RealPlayer[]>([])
  const [teams, setTeams] = useState<PassiveTeam[]>([])
  const [bonusHistory, setBonusHistory] = useState<BonusPointRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const {
    alertState,
    showAlert,
    closeAlert,
    confirmState,
    showConfirm,
    closeConfirm,
  } = useModal()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
    if (!authLoading && user && user.role !== 'committee_admin' && user.role !== 'super_admin') {
      router.push('/dashboard')
    }
  }, [user, authLoading, router])

  // Fetch league data to get season_id and tournament_id
  useEffect(() => {
    const loadLeagueData = async () => {
      if (!leagueId || !user) return

      try {
        const response = await fetchWithTokenRefresh(`/api/fantasy/leagues/${leagueId}`)
        if (!response.ok) throw new Error('Failed to load league')

        const data = await response.json()
        setLeague(data.league)
      } catch (error) {
        console.error('Error loading league:', error)
        showAlert({
          type: 'error',
          title: 'Error',
          message: 'Failed to load fantasy league data.'
        })
      }
    }

    if (user) {
      loadLeagueData()
    }
  }, [user, leagueId])

  useEffect(() => {
    if (user && league) {
      fetchData()
    }
  }, [user, league, targetType])

  const fetchData = async () => {
    if (!league) return
    
    setLoading(true)
    try {
      if (targetType === 'player') {
        // Fetch ALL real players (both drafted and available) in this fantasy league
        const response = await fetchWithTokenRefresh(`/api/fantasy/players/available?league_id=${leagueId}`)
        const { available_players, success } = await response.json()
        if (success && available_players) {
          setPlayers(available_players)
        }
      } else {
        // Fetch passive teams (real football teams) that fantasy teams support
        const response = await fetchWithTokenRefresh(`/api/fantasy/passive-teams?league_id=${leagueId}`)
        const { teams: passiveTeams, success } = await response.json()
        if (success && passiveTeams) {
          setTeams(passiveTeams)
        }
      }

      // Fetch bonus history for this league
      const historyResponse = await fetchWithTokenRefresh(
        `/api/admin/bonus-points?league_id=${leagueId}&target_type=${targetType}`
      )
      const { data: historyData, success: historySuccess } = await historyResponse.json()
      if (historySuccess) {
        setBonusHistory(historyData)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      showAlert({
        type: 'error',
        title: 'Load Failed',
        message: 'Failed to load data. Please try again.'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleToggleTarget = (id: string) => {
    setSelectedTargets(prev =>
      prev.includes(id)
        ? prev.filter(t => t !== id)
        : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    const filteredItems = getFilteredItems()
    const allIds = filteredItems.map(item =>
      targetType === 'player' ? item.real_player_id : item.team_id
    )
    setSelectedTargets(allIds)
  }

  const handleDeselectAll = () => {
    setSelectedTargets([])
  }

  const getFilteredItems = () => {
    const items = targetType === 'player' ? players : teams
    if (!searchTerm.trim()) return items

    const search = searchTerm.toLowerCase()
    return items.filter((item: any) => {
      if (targetType === 'player') {
        return (
          item.player_name?.toLowerCase().includes(search) ||
          item.real_player_id?.toLowerCase().includes(search) ||
          item.position?.toLowerCase().includes(search) ||
          item.real_team_name?.toLowerCase().includes(search)
        )
      } else {
        return (
          item.team_name?.toLowerCase().includes(search) ||
          item.team_id?.toLowerCase().includes(search)
        )
      }
    })
  }

  const handleSubmit = async () => {
    if (!league) return

    if (selectedTargets.length === 0) {
      showAlert({
        type: 'warning',
        title: 'No Selection',
        message: `Please select at least one ${targetType}`
      })
      return
    }

    if (!points || points === 0) {
      showAlert({
        type: 'warning',
        title: 'Invalid Points',
        message: 'Please enter a valid points value'
      })
      return
    }

    if (!reason.trim()) {
      showAlert({
        type: 'warning',
        title: 'Missing Reason',
        message: 'Please provide a reason for awarding these points'
      })
      return
    }

    const confirmed = await showConfirm({
      type: points > 0 ? 'info' : 'warning',
      title: 'Confirm Bonus Points',
      message: `Award ${points > 0 ? '+' : ''}${points} points to ${selectedTargets.length} ${targetType}(s) for "${reason}"?`,
      confirmText: 'Award Points',
      cancelText: 'Cancel'
    })

    if (!confirmed) return

    setSubmitting(true)
    try {
      const response = await fetchWithTokenRefresh('/api/admin/bonus-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targets: selectedTargets,
          points,
          reason,
          league_id: leagueId,
          target_type: targetType
        })
      })

      const { success, message } = await response.json()
      if (!success) throw new Error(message)

      showAlert({
        type: 'success',
        title: 'Success',
        message: `Bonus points awarded successfully to ${selectedTargets.length} ${targetType}(s)!`
      })

      // Reset form
      setSelectedTargets([])
      setPoints(0)
      setReason('')
      fetchData()
    } catch (error: any) {
      console.error('Error awarding bonus points:', error)
      showAlert({
        type: 'error',
        title: 'Award Failed',
        message: error.message || 'Failed to award bonus points'
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteRecord = async (id: number) => {
    const confirmed = await showConfirm({
      type: 'danger',
      title: 'Delete Record',
      message: 'Are you sure you want to delete this bonus point record?',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    })

    if (!confirmed) return

    try {
      const response = await fetchWithTokenRefresh(`/api/admin/bonus-points?id=${id}`, {
        method: 'DELETE'
      })

      const { success } = await response.json()
      if (!success) throw new Error('Failed to delete')

      showAlert({
        type: 'success',
        title: 'Deleted',
        message: 'Bonus point record deleted successfully'
      })
      fetchData()
    } catch (error) {
      console.error('Error deleting record:', error)
      showAlert({
        type: 'error',
        title: 'Delete Failed',
        message: 'Failed to delete bonus point record'
      })
    }
  }

  if (authLoading || !user || !league) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  const filteredItems = getFilteredItems()

  return (
    <>
      <div className="container mx-auto px-4 py-6">
        <div className="glass rounded-3xl p-6 mb-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold gradient-text">Award Bonus Points</h1>
              <p className="text-gray-600 text-sm mt-1">
                {league.league_name} • {league.season_id.replace('SSPSLS', 'Season ')}
              </p>
            </div>
            <Link
              href={`/dashboard/committee/fantasy/${leagueId}`}
              className="px-4 py-2.5 text-sm glass rounded-xl hover:bg-white/90 transition-all duration-300"
            >
              Back to League
            </Link>
          </div>

          {/* Target Type Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Award Points To
            </label>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setTargetType('player')
                  setSelectedTargets([])
                }}
                className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-300 ${
                  targetType === 'player'
                    ? 'bg-primary text-white shadow-lg'
                    : 'bg-white/60 text-gray-700 hover:bg-white/80'
                }`}
              >
                Real Players
              </button>
              <button
                onClick={() => {
                  setTargetType('team')
                  setSelectedTargets([])
                }}
                className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-300 ${
                  targetType === 'team'
                    ? 'bg-primary text-white shadow-lg'
                    : 'bg-white/60 text-gray-700 hover:bg-white/80'
                }`}
              >
                Passive Teams
              </button>
            </div>
          </div>

          {/* Points and Reason */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Points *
              </label>
              <input
                type="number"
                value={points || ''}
                onChange={(e) => setPoints(parseInt(e.target.value) || 0)}
                placeholder="Enter points (can be negative)"
                className="w-full px-4 py-2.5 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                Use positive for bonus, negative for penalty
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason/Heading *
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Fair Play Award"
                maxLength={500}
                className="w-full px-4 py-2.5 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
              />
            </div>
          </div>

          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`Search ${targetType}s...`}
                className="pl-10 w-full py-2.5 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
              />
            </div>
          </div>

          {/* Selection Controls */}
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-gray-600">
              <strong>{selectedTargets.length}</strong> of <strong>{filteredItems.length}</strong> selected
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSelectAll}
                className="px-3 py-1.5 text-sm bg-white/60 rounded-lg hover:bg-white/80 transition-all"
              >
                Select All
              </button>
              <button
                onClick={handleDeselectAll}
                className="px-3 py-1.5 text-sm bg-white/60 rounded-lg hover:bg-white/80 transition-all"
              >
                Deselect All
              </button>
            </div>
          </div>

          {/* Selection List */}
          <div className="bg-white/50 rounded-xl p-4 mb-6 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No {targetType}s found
              </div>
            ) : (
              <div className="grid gap-2">
                {filteredItems.map((item: any) => {
                  const id = targetType === 'player' ? item.real_player_id : item.team_id
                  const name = targetType === 'player' ? item.player_name : item.team_name
                  const isSelected = selectedTargets.includes(id)

                  return (
                    <div
                      key={id}
                      onClick={() => handleToggleTarget(id)}
                      className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? 'bg-primary/10 border-2 border-primary'
                          : 'bg-white/70 border-2 border-transparent hover:bg-white/90'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            isSelected ? 'bg-primary border-primary' : 'border-gray-300'
                          }`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-gray-800">{name}</div>
                            {targetType === 'player' && (
                              <div className="text-xs text-gray-500">
                                {item.position} • {item.team || item.real_team_name}
                                {item.star_rating && ` • ${item.star_rating}★`}
                              </div>
                            )}
                            {targetType === 'team' && item.fantasy_teams_count !== undefined && (
                              <div className="text-xs text-gray-500">
                                {item.fantasy_teams_count} fantasy team{item.fantasy_teams_count !== 1 ? 's' : ''} supporting
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={submitting || selectedTargets.length === 0}
            className="w-full py-3 px-6 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
          >
            {submitting ? (
              <span className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Awarding Points...
              </span>
            ) : (
              `Award ${points > 0 ? '+' : ''}${points} Points to ${selectedTargets.length} ${targetType}(s)`
            )}
          </button>
        </div>

        {/* Bonus History */}
        <div className="glass rounded-3xl p-6">
          <h2 className="text-xl font-bold gradient-text mb-4">Bonus Points History</h2>
          {bonusHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No bonus points awarded yet
            </div>
          ) : (
            <div className="space-y-2">
              {bonusHistory.map((record) => (
                <div
                  key={record.id}
                  className="bg-white/70 rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        record.points > 0
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {record.points > 0 ? '+' : ''}{record.points} pts
                      </span>
                      <span className="font-medium text-gray-800">{record.target_name}</span>
                      <span className="text-xs text-gray-500">
                        ({record.target_type})
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">{record.reason}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(record.awarded_at).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteRecord(record.id)}
                    className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AlertModal
        isOpen={alertState.isOpen}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        onClose={closeAlert}
      />

      <ConfirmModal
        isOpen={confirmState.isOpen}
        type={confirmState.type}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
      />
    </>
  )
}
