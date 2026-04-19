'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { fetchWithTokenRefresh } from '@/lib/token-refresh'

interface ComparisonData {
  toUpdate: any[]
  toCreate: any[]
  unchanged: any[]
  notFoundInNew: any[]
  summary: {
    totalExisting: number
    totalNew: number
    willUpdate: number
    willCreate: number
    unchanged: number
    notFound: number
  }
}

export default function UpdatePreviewPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [comparison, setComparison] = useState<ComparisonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'update' | 'create' | 'unchanged' | 'notfound'>('update')
  const [importing, setImporting] = useState(false)
  const [importStatus, setImportStatus] = useState('')
  
  // Pagination states for each tab
  const [updatePage, setUpdatePage] = useState(1)
  const [createPage, setCreatePage] = useState(1)
  const [unchangedPage, setUnchangedPage] = useState(1)
  const [notFoundPage, setNotFoundPage] = useState(1)
  const itemsPerPage = 50

  // Track which players to exclude from creation (for duplicates)
  const [excludedPlayerIds, setExcludedPlayerIds] = useState<Set<string>>(new Set())
  
  // Filter for showing only duplicates in create tab
  const [showOnlyDuplicates, setShowOnlyDuplicates] = useState(false)

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
      loadComparison()
    }
  }, [user])

  const loadComparison = async () => {
    const parsedData = sessionStorage.getItem('parsedPlayers')
    if (!parsedData) {
      router.push('/dashboard/committee/database')
      return
    }

    try {
      setLoading(true)
      const players = JSON.parse(parsedData)

      const response = await fetchWithTokenRefresh('/api/players/compare-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPlayers: players })
      })

      const result = await response.json()
      if (result.success) {
        console.log('🔍 DEBUG - Comparison data received:', {
          toUpdateCount: result.data.toUpdate.length,
          toCreateCount: result.data.toCreate.length,
          unchangedCount: result.data.unchanged.length,
          notFoundCount: result.data.notFoundInNew.length,
          firstUpdate: result.data.toUpdate[0],
          firstCreate: result.data.toCreate[0],
          firstUnchanged: result.data.unchanged[0]
        });
        setComparison(result.data)
      } else {
        throw new Error(result.error)
      }
    } catch (error: any) {
      console.error('Error loading comparison:', error)
      alert(`Error: ${error.message}`)
      router.push('/dashboard/committee/database')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmUpdate = async () => {
    // Filter out excluded players from toCreate list
    const playersToCreate = comparison.toCreate.filter(
      (player: any) => !excludedPlayerIds.has(player.player_id)
    );
    
    const totalChanges = comparison.summary.willUpdate + playersToCreate.length;
    
    const confirmMessage = `This will update ${comparison.summary.willUpdate} players and create ${playersToCreate.length} new entries.

WHAT WILL BE UPDATED:
✅ Player stats (ratings, speed, shooting, passing, etc.)
✅ Position, playing style, nationality, age
✅ Club name (real-world team)

WHAT WILL BE PRESERVED (NOT changed):
🔒 Team assignments (team_id, team_name)
🔒 Ownership status (is_sold)
🔒 Purchase price (acquisition_value)
🔒 Season ID and Round ID
🔒 Contract information

Continue?`;
    
    if (!confirm(confirmMessage)) {
      return
    }

    const parsedData = sessionStorage.getItem('parsedPlayers')
    if (!parsedData) {
      alert('No data found. Please upload again.')
      return
    }

    try {
      setImporting(true)
      setImportStatus('Updating player stats...')

      const parsedData = sessionStorage.getItem('parsedPlayers')
      if (!parsedData) {
        alert('No data found. Please upload again.')
        return
      }

      const allPlayers = JSON.parse(parsedData)
      
      // Create a map of player_id to full player data
      const playerDataMap = new Map();
      allPlayers.forEach((player: any) => {
        if (player.player_id) {
          playerDataMap.set(player.player_id.toString(), player);
        }
      });

      // Get full player data for updates and creates
      const playersToProcess = [
        ...comparison.toUpdate.map((p: any) => playerDataMap.get(p.player_id.toString())).filter(Boolean),
        ...comparison.toCreate.filter((player: any) => !excludedPlayerIds.has(player.player_id?.toString())).map((p: any) => playerDataMap.get(p.player_id.toString())).filter(Boolean)
      ];

      console.log(`📊 Processing ${playersToProcess.length} players (${comparison.toUpdate.length} updates + ${comparison.toCreate.filter((p: any) => !excludedPlayerIds.has(p.player_id?.toString())).length} creates)`);

      const response = await fetchWithTokenRefresh('/api/players/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateStats',
          players: playersToProcess.map((player: any) => ({
            ...player,
            // Normalize name field - handle multiple column name variations
            name: player.name || player.player_name || player.full_name || player.Name || `Player ${player.player_id}`,
            // Normalize team_name field - ensure it's set from various possible column names
            team_name: player.team_name || player.team || player.club || player.current_club || player.Team || '',
            is_auction_eligible: player.is_auction_eligible || false
          }))
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to update players')
      }

      const excludedCount = comparison.toCreate.length - playersToCreate.length;
      const statusMsg = excludedCount > 0 
        ? `Successfully updated ${result.updated} players and added ${result.inserted} new players! (${excludedCount} duplicate(s) skipped)`
        : `Successfully updated ${result.updated} players and added ${result.inserted} new players!`;
      
      setImportStatus(statusMsg)
      sessionStorage.removeItem('parsedPlayers')

      setTimeout(() => {
        router.push('/dashboard/committee/database')
      }, 2000)
    } catch (error: any) {
      setImportStatus(`Error: ${error.message}`)
    } finally {
      setImporting(false)
    }
  }

  const togglePlayerExclusion = (playerId: string) => {
    setExcludedPlayerIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      return newSet;
    });
  };

  if (authLoading || loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading comparison...</p>
        </div>
      </div>
    )
  }

  if (user.role !== 'committee_admin' || !comparison) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-screen-2xl">
      {/* Header */}
      <div className="glass rounded-3xl p-6 mb-8 shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold gradient-text mb-2">📊 Update Stats Preview</h1>
            <p className="text-gray-600">Review changes before updating the database</p>
          </div>
          <Link
            href="/dashboard/committee/database"
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            ← Back
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
        <div className="glass rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">{comparison.summary.totalExisting}</div>
          <div className="text-sm text-gray-600 mt-1">Existing Players</div>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-purple-600">{comparison.summary.totalNew}</div>
          <div className="text-sm text-gray-600 mt-1">In Upload</div>
        </div>
        <div className="glass rounded-xl p-4 text-center bg-orange-50/50">
          <div className="text-3xl font-bold text-orange-600">{comparison.summary.willUpdate}</div>
          <div className="text-sm text-gray-600 mt-1">Will Update</div>
        </div>
        <div className="glass rounded-xl p-4 text-center bg-green-50/50">
          <div className="text-3xl font-bold text-green-600">{comparison.summary.willCreate}</div>
          <div className="text-sm text-gray-600 mt-1">Will Create</div>
        </div>
        <div className="glass rounded-xl p-4 text-center bg-gray-50/50">
          <div className="text-3xl font-bold text-gray-600">{comparison.summary.unchanged}</div>
          <div className="text-sm text-gray-600 mt-1">Unchanged</div>
        </div>
        <div className="glass rounded-xl p-4 text-center bg-red-50/50">
          <div className="text-3xl font-bold text-red-600">{comparison.summary.notFound}</div>
          <div className="text-sm text-gray-600 mt-1">Not in Upload</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="glass rounded-3xl overflow-hidden shadow-lg mb-8">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('update')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'update'
                ? 'bg-orange-50 text-orange-700 border-b-2 border-orange-500'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            🔄 Will Update ({comparison.summary.willUpdate})
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'create'
                ? 'bg-green-50 text-green-700 border-b-2 border-green-500'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            ➕ Will Create ({comparison.summary.willCreate})
          </button>
          <button
            onClick={() => setActiveTab('unchanged')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'unchanged'
                ? 'bg-gray-50 text-gray-700 border-b-2 border-gray-500'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            ✓ Unchanged ({comparison.summary.unchanged})
          </button>
          <button
            onClick={() => setActiveTab('notfound')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'notfound'
                ? 'bg-red-50 text-red-700 border-b-2 border-red-500'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            ⚠️ Not in Upload ({comparison.summary.notFound})
          </button>
        </div>

        <div className="p-6">
          {/* Players to Update */}
          {activeTab === 'update' && (
            <div>
              <div className="mb-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-sm text-orange-800">
                  <strong>These players will be UPDATED:</strong> Team name, position, playing style, and stats will be updated. 
                  Team ID and ownership data will be preserved.
                </p>
              </div>
              {comparison.toUpdate.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No players to update
                </div>
              ) : (
                <>
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {comparison.toUpdate
                      .slice((updatePage - 1) * itemsPerPage, updatePage * itemsPerPage)
                      .map((player, idx) => (
                    <div key={idx} className="glass rounded-lg p-3 border border-orange-200 hover:shadow-md transition-shadow">
                      {/* Player Name Header */}
                      <div className="font-bold text-lg mb-2 text-gray-900 flex items-center gap-2">
                        <span className="text-orange-600">🔄</span>
                        {player.name}
                      </div>
                      
                      {/* Compact Side-by-side comparison */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                        {/* OLD VALUES - Compact */}
                        <div className="bg-red-50/70 rounded-md p-2 border border-red-200">
                          <div className="text-xs font-semibold text-red-700 mb-1.5 flex items-center gap-1">
                            <span>❌</span>
                            <span>Current</span>
                          </div>
                          <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Team:</span>
                              <span className={player.old.team_name !== player.new.team_name ? "text-red-600 line-through font-medium" : "text-gray-700 font-medium"}>
                                {(player.old.team_name || 'None').substring(0, 12)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Pos:</span>
                              <span className={player.old.position !== player.new.position ? "text-red-600 line-through font-medium" : "text-gray-700 font-medium"}>
                                {player.old.position}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">OVR:</span>
                              <span className={player.old.overall_rating !== player.new.overall_rating ? "text-red-600 line-through font-medium" : "text-gray-700 font-medium"}>
                                {player.old.overall_rating}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">PAC:</span>
                              <span className={player.old.pace !== player.new.pace ? "text-red-600 line-through font-medium" : "text-gray-700 font-medium"}>
                                {player.old.pace || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">SHO:</span>
                              <span className={player.old.shooting !== player.new.shooting ? "text-red-600 line-through font-medium" : "text-gray-700 font-medium"}>
                                {player.old.shooting || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">PAS:</span>
                              <span className={player.old.passing !== player.new.passing ? "text-red-600 line-through font-medium" : "text-gray-700 font-medium"}>
                                {player.old.passing || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">DRI:</span>
                              <span className={player.old.dribbling !== player.new.dribbling ? "text-red-600 line-through font-medium" : "text-gray-700 font-medium"}>
                                {player.old.dribbling || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">DEF:</span>
                              <span className={player.old.defending !== player.new.defending ? "text-red-600 line-through font-medium" : "text-gray-700 font-medium"}>
                                {player.old.defending || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">PHY:</span>
                              <span className={player.old.physical !== player.new.physical ? "text-red-600 line-through font-medium" : "text-gray-700 font-medium"}>
                                {player.old.physical || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">ACC:</span>
                              <span className={player.old.acceleration !== player.new.acceleration ? "text-red-600 line-through font-medium" : "text-gray-700 font-medium"}>
                                {player.old.acceleration || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">BC:</span>
                              <span className={player.old.ball_control !== player.new.ball_control ? "text-red-600 line-through font-medium" : "text-gray-700 font-medium"}>
                                {player.old.ball_control || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">TP:</span>
                              <span className={player.old.tight_possession !== player.new.tight_possession ? "text-red-600 line-through font-medium" : "text-gray-700 font-medium"}>
                                {player.old.tight_possession || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">LP:</span>
                              <span className={player.old.lofted_pass !== player.new.lofted_pass ? "text-red-600 line-through font-medium" : "text-gray-700 font-medium"}>
                                {player.old.lofted_pass || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">HEA:</span>
                              <span className={player.old.heading !== player.new.heading ? "text-red-600 line-through font-medium" : "text-gray-700 font-medium"}>
                                {player.old.heading || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">KP:</span>
                              <span className={player.old.kicking_power !== player.new.kicking_power ? "text-red-600 line-through font-medium" : "text-gray-700 font-medium"}>
                                {player.old.kicking_power || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">JUM:</span>
                              <span className={player.old.jumping !== player.new.jumping ? "text-red-600 line-through font-medium" : "text-gray-700 font-medium"}>
                                {player.old.jumping || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">STA:</span>
                              <span className={player.old.stamina !== player.new.stamina ? "text-red-600 line-through font-medium" : "text-gray-700 font-medium"}>
                                {player.old.stamina || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">TAC:</span>
                              <span className={player.old.tackling !== player.new.tackling ? "text-red-600 line-through font-medium" : "text-gray-700 font-medium"}>
                                {player.old.tackling || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">AGG:</span>
                              <span className={player.old.aggression !== player.new.aggression ? "text-red-600 line-through font-medium" : "text-gray-700 font-medium"}>
                                {player.old.aggression || '-'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* NEW VALUES - Compact */}
                        <div className="bg-green-50/70 rounded-md p-2 border border-green-200">
                          <div className="text-xs font-semibold text-green-700 mb-1.5 flex items-center gap-1">
                            <span>✅</span>
                            <span>Updated</span>
                          </div>
                          <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Team:</span>
                              <span className={player.old.team_name !== player.new.team_name ? "text-green-600 font-bold" : "text-gray-700 font-medium"}>
                                {(player.new.team_name || 'None').substring(0, 12)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Pos:</span>
                              <span className={player.old.position !== player.new.position ? "text-green-600 font-bold" : "text-gray-700 font-medium"}>
                                {player.new.position}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">OVR:</span>
                              <span className={player.old.overall_rating !== player.new.overall_rating ? "text-green-600 font-bold" : "text-gray-700 font-medium"}>
                                {player.new.overall_rating}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">PAC:</span>
                              <span className={player.old.pace !== player.new.pace ? "text-green-600 font-bold" : "text-gray-700 font-medium"}>
                                {player.new.pace || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">SHO:</span>
                              <span className={player.old.shooting !== player.new.shooting ? "text-green-600 font-bold" : "text-gray-700 font-medium"}>
                                {player.new.shooting || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">PAS:</span>
                              <span className={player.old.passing !== player.new.passing ? "text-green-600 font-bold" : "text-gray-700 font-medium"}>
                                {player.new.passing || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">DRI:</span>
                              <span className={player.old.dribbling !== player.new.dribbling ? "text-green-600 font-bold" : "text-gray-700 font-medium"}>
                                {player.new.dribbling || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">DEF:</span>
                              <span className={player.old.defending !== player.new.defending ? "text-green-600 font-bold" : "text-gray-700 font-medium"}>
                                {player.new.defending || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">PHY:</span>
                              <span className={player.old.physical !== player.new.physical ? "text-green-600 font-bold" : "text-gray-700 font-medium"}>
                                {player.new.physical || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">ACC:</span>
                              <span className={player.old.acceleration !== player.new.acceleration ? "text-green-600 font-bold" : "text-gray-700 font-medium"}>
                                {player.new.acceleration || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">BC:</span>
                              <span className={player.old.ball_control !== player.new.ball_control ? "text-green-600 font-bold" : "text-gray-700 font-medium"}>
                                {player.new.ball_control || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">TP:</span>
                              <span className={player.old.tight_possession !== player.new.tight_possession ? "text-green-600 font-bold" : "text-gray-700 font-medium"}>
                                {player.new.tight_possession || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">LP:</span>
                              <span className={player.old.lofted_pass !== player.new.lofted_pass ? "text-green-600 font-bold" : "text-gray-700 font-medium"}>
                                {player.new.lofted_pass || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">HEA:</span>
                              <span className={player.old.heading !== player.new.heading ? "text-green-600 font-bold" : "text-gray-700 font-medium"}>
                                {player.new.heading || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">KP:</span>
                              <span className={player.old.kicking_power !== player.new.kicking_power ? "text-green-600 font-bold" : "text-gray-700 font-medium"}>
                                {player.new.kicking_power || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">JUM:</span>
                              <span className={player.old.jumping !== player.new.jumping ? "text-green-600 font-bold" : "text-gray-700 font-medium"}>
                                {player.new.jumping || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">STA:</span>
                              <span className={player.old.stamina !== player.new.stamina ? "text-green-600 font-bold" : "text-gray-700 font-medium"}>
                                {player.new.stamina || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">TAC:</span>
                              <span className={player.old.tackling !== player.new.tackling ? "text-green-600 font-bold" : "text-gray-700 font-medium"}>
                                {player.new.tackling || '-'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">AGG:</span>
                              <span className={player.old.aggression !== player.new.aggression ? "text-green-600 font-bold" : "text-gray-700 font-medium"}>
                                {player.new.aggression || '-'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Pagination for Update */}
                {comparison.toUpdate.length > itemsPerPage && (
                  <div className="mt-6 flex items-center justify-between border-t pt-4">
                    <div className="text-sm text-gray-600">
                      Showing {((updatePage - 1) * itemsPerPage) + 1} to {Math.min(updatePage * itemsPerPage, comparison.toUpdate.length)} of {comparison.toUpdate.length}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setUpdatePage(1)}
                        disabled={updatePage === 1}
                        className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        First
                      </button>
                      <button
                        onClick={() => setUpdatePage(p => Math.max(1, p - 1))}
                        disabled={updatePage === 1}
                        className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        Previous
                      </button>
                      <span className="px-4 py-1 bg-orange-100 text-orange-700 rounded text-sm font-medium">
                        {updatePage} / {Math.ceil(comparison.toUpdate.length / itemsPerPage)}
                      </span>
                      <button
                        onClick={() => setUpdatePage(p => Math.min(Math.ceil(comparison.toUpdate.length / itemsPerPage), p + 1))}
                        disabled={updatePage >= Math.ceil(comparison.toUpdate.length / itemsPerPage)}
                        className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        Next
                      </button>
                      <button
                        onClick={() => setUpdatePage(Math.ceil(comparison.toUpdate.length / itemsPerPage))}
                        disabled={updatePage >= Math.ceil(comparison.toUpdate.length / itemsPerPage)}
                        className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        Last
                      </button>
                    </div>
                  </div>
                )}
              </>
              )}
            </div>
          )}

          {/* New Players to Create */}
          {activeTab === 'create' && (
            <div>
              <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-800">
                  <strong>These players will be CREATED:</strong> New entries will be added to the database.
                  {comparison.toCreate.some((p: any) => p.hasDuplicates) && (
                    <span className="block mt-2 text-orange-700 font-medium">
                      ⚠️ Some players have potential duplicates (same name). Uncheck to skip creation.
                    </span>
                  )}
                </p>
              </div>
              
              {/* Filter Toggle */}
              {comparison.toCreate.some((p: any) => p.hasDuplicates) && (
                <div className="mb-4 space-y-3">
                  {/* Filter buttons */}
                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                    <span className="text-sm font-medium text-gray-700">Filter:</span>
                    <button
                      onClick={() => setShowOnlyDuplicates(false)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        !showOnlyDuplicates
                          ? 'bg-green-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Show All ({comparison.toCreate.length})
                    </button>
                    <button
                      onClick={() => setShowOnlyDuplicates(true)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        showOnlyDuplicates
                          ? 'bg-orange-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Only Duplicates ({comparison.toCreate.filter((p: any) => p.hasDuplicates).length})
                    </button>
                  </div>
                  
                  {/* Bulk selection buttons */}
                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                    <span className="text-sm font-medium text-gray-700">Bulk Actions:</span>
                    <button
                      onClick={() => {
                        const filteredPlayers = comparison.toCreate.filter((p: any) => !showOnlyDuplicates || p.hasDuplicates);
                        const newExcluded = new Set(excludedPlayerIds);
                        filteredPlayers.forEach((p: any) => newExcluded.delete(p.player_id));
                        setExcludedPlayerIds(newExcluded);
                      }}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm"
                    >
                      ✓ Select All {showOnlyDuplicates ? 'Duplicates' : 'Visible'}
                    </button>
                    <button
                      onClick={() => {
                        const filteredPlayers = comparison.toCreate.filter((p: any) => !showOnlyDuplicates || p.hasDuplicates);
                        const newExcluded = new Set(excludedPlayerIds);
                        filteredPlayers.forEach((p: any) => newExcluded.add(p.player_id));
                        setExcludedPlayerIds(newExcluded);
                      }}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm"
                    >
                      ✗ Deselect All {showOnlyDuplicates ? 'Duplicates' : 'Visible'}
                    </button>
                    {showOnlyDuplicates && (
                      <button
                        onClick={() => {
                          const duplicatePlayers = comparison.toCreate.filter((p: any) => p.hasDuplicates);
                          const newExcluded = new Set(excludedPlayerIds);
                          duplicatePlayers.forEach((p: any) => newExcluded.add(p.player_id));
                          setExcludedPlayerIds(newExcluded);
                        }}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm"
                      >
                        Skip All Duplicates
                      </button>
                    )}
                    {excludedPlayerIds.size > 0 && (
                      <button
                        onClick={() => setExcludedPlayerIds(new Set())}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm"
                      >
                        Reset All ({excludedPlayerIds.size} excluded)
                      </button>
                    )}
                  </div>
                </div>
              )}
              
              {comparison.toCreate.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No new players to create
                </div>
              ) : (
                <>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {comparison.toCreate
                    .filter((p: any) => !showOnlyDuplicates || p.hasDuplicates)
                    .slice((createPage - 1) * itemsPerPage, createPage * itemsPerPage)
                    .map((player: any, idx: number) => {
                      const isExcluded = excludedPlayerIds.has(player.player_id);
                      const hasDuplicates = player.hasDuplicates;
                      
                      return (
                    <div 
                      key={idx} 
                      className={`glass rounded-lg p-3 border transition-all ${
                        hasDuplicates 
                          ? 'border-orange-300 bg-orange-50/30' 
                          : 'border-green-200'
                      } ${isExcluded ? 'opacity-50' : 'hover:shadow-md'}`}
                    >
                      {/* Header with checkbox */}
                      <div className="flex items-start gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={!isExcluded}
                          onChange={() => togglePlayerExclusion(player.player_id)}
                          className="mt-0.5 w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                          title={isExcluded ? "Click to include" : "Click to exclude"}
                        />
                        <div className="flex-1">
                          <div className="font-bold text-base text-gray-900 flex items-center gap-2 flex-wrap">
                            <span className={hasDuplicates ? "text-orange-600" : "text-green-600"}>
                              {hasDuplicates ? "⚠️" : "➕"}
                            </span>
                            {player.name}
                            {hasDuplicates && (
                              <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium">
                                Duplicate
                              </span>
                            )}
                            {isExcluded && (
                              <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full font-medium">
                                Skipped
                              </span>
                            )}
                          </div>
                          
                          {/* Duplicate warning */}
                          {hasDuplicates && player.duplicates && player.duplicates.length > 0 && (
                            <div className="mt-2 p-2 bg-orange-100 rounded border border-orange-200">
                              <div className="text-xs font-bold text-orange-800 mb-1">
                                Found {player.duplicates.length} existing player(s) with same name:
                              </div>
                              {player.duplicates.map((dup: any, dupIdx: number) => (
                                <div key={dupIdx} className="text-xs text-orange-700 flex flex-wrap items-center gap-1">
                                  <span className="font-medium">ID: {dup.player_id}</span>
                                  <span>•</span>
                                  <span>{dup.position}</span>
                                  <span>•</span>
                                  <span>OVR: {dup.overall_rating}</span>
                                  <span>•</span>
                                  <span>{dup.team_name || 'No team'}</span>
                                  {dup.is_sold && <span className="text-green-600">• Sold</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Player stats */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-3 gap-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Team:</span>
                          <span className="font-medium text-gray-700">{(player.team_name || 'None').substring(0, 12)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Pos:</span>
                          <span className="font-medium text-gray-700">{player.position}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Style:</span>
                          <span className="font-medium text-gray-700">{(player.playing_style || 'None').substring(0, 10)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">OVR:</span>
                          <span className="font-medium text-green-600">{player.overall_rating}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">PAC:</span>
                          <span className="font-medium text-gray-700">{player.pace || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">SHO:</span>
                          <span className="font-medium text-gray-700">{player.shooting || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">PAS:</span>
                          <span className="font-medium text-gray-700">{player.passing || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">DRI:</span>
                          <span className="font-medium text-gray-700">{player.dribbling || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">DEF:</span>
                          <span className="font-medium text-gray-700">{player.defending || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">PHY:</span>
                          <span className="font-medium text-gray-700">{player.physical || '-'}</span>
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
                {/* Pagination for Create */}
                {(() => {
                  const filteredList = comparison.toCreate.filter((p: any) => !showOnlyDuplicates || p.hasDuplicates);
                  const totalPages = Math.ceil(filteredList.length / itemsPerPage);
                  
                  return filteredList.length > itemsPerPage && (
                  <div className="mt-6 flex items-center justify-between border-t pt-4">
                    <div className="text-sm text-gray-600">
                      Showing {((createPage - 1) * itemsPerPage) + 1} to {Math.min(createPage * itemsPerPage, filteredList.length)} of {filteredList.length}
                      {showOnlyDuplicates && <span className="ml-2 text-orange-600 font-medium">(Duplicates only)</span>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCreatePage(1)}
                        disabled={createPage === 1}
                        className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        First
                      </button>
                      <button
                        onClick={() => setCreatePage(p => Math.max(1, p - 1))}
                        disabled={createPage === 1}
                        className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        Previous
                      </button>
                      <span className="px-4 py-1 bg-green-100 text-green-700 rounded text-sm font-medium">
                        {createPage} / {totalPages}
                      </span>
                      <button
                        onClick={() => setCreatePage(p => Math.min(totalPages, p + 1))}
                        disabled={createPage >= totalPages}
                        className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        Next
                      </button>
                      <button
                        onClick={() => setCreatePage(totalPages)}
                        disabled={createPage >= totalPages}
                        className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        Last
                      </button>
                    </div>
                  </div>
                )})()}
              </>
              )}
            </div>
          )}

          {/* Unchanged Players */}
          {activeTab === 'unchanged' && (
            <div>
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-800">
                  <strong>These players are already up-to-date:</strong> No changes needed - all values match the upload.
                </p>
              </div>
              {comparison.unchanged.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No unchanged players
                </div>
              ) : (
                <>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {comparison.unchanged
                    .slice((unchangedPage - 1) * itemsPerPage, unchangedPage * itemsPerPage)
                    .map((player, idx) => (
                    <div key={idx} className="glass rounded-xl p-3 border border-gray-200 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-lg text-gray-900">
                          {player.name}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {player.position} • Rating: {player.overall_rating} • Team: {player.team_name || 'None'}
                        </div>
                      </div>
                      <div className="text-xs text-green-600 font-medium">✓ Up to date</div>
                    </div>
                  ))}
                </div>
                {/* Pagination for Unchanged */}
                {comparison.unchanged.length > itemsPerPage && (
                  <div className="mt-6 flex items-center justify-between border-t pt-4">
                    <div className="text-sm text-gray-600">
                      Showing {((unchangedPage - 1) * itemsPerPage) + 1} to {Math.min(unchangedPage * itemsPerPage, comparison.unchanged.length)} of {comparison.unchanged.length}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setUnchangedPage(1)}
                        disabled={unchangedPage === 1}
                        className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        First
                      </button>
                      <button
                        onClick={() => setUnchangedPage(p => Math.max(1, p - 1))}
                        disabled={unchangedPage === 1}
                        className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        Previous
                      </button>
                      <span className="px-4 py-1 bg-gray-100 text-gray-700 rounded text-sm font-medium">
                        {unchangedPage} / {Math.ceil(comparison.unchanged.length / itemsPerPage)}
                      </span>
                      <button
                        onClick={() => setUnchangedPage(p => Math.min(Math.ceil(comparison.unchanged.length / itemsPerPage), p + 1))}
                        disabled={unchangedPage >= Math.ceil(comparison.unchanged.length / itemsPerPage)}
                        className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        Next
                      </button>
                      <button
                        onClick={() => setUnchangedPage(Math.ceil(comparison.unchanged.length / itemsPerPage))}
                        disabled={unchangedPage >= Math.ceil(comparison.unchanged.length / itemsPerPage)}
                        className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        Last
                      </button>
                    </div>
                  </div>
                )}
              </>
              )}
            </div>
          )}

          {/* Players Not Found in Upload */}
          {activeTab === 'notfound' && (
            <div>
              <div className="mb-4 p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm text-red-800">
                  <strong>These players exist in the database but are NOT in your upload:</strong> They will remain unchanged in the database.
                </p>
              </div>
              {comparison.notFoundInNew.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  All existing players are in the upload
                </div>
              ) : (
                <>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {comparison.notFoundInNew
                    .slice((notFoundPage - 1) * itemsPerPage, notFoundPage * itemsPerPage)
                    .map((player, idx) => (
                    <div key={idx} className="glass rounded-xl p-3 border border-red-200 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-lg text-gray-900">
                          {player.name}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {player.position} • Rating: {player.overall_rating} • Team: {player.team_name || 'None'} ({player.team_id || 'No team'})
                          {player.is_sold && <span className="ml-2 text-green-600">• Sold</span>}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">ID: {player.player_id}</div>
                    </div>
                  ))}
                </div>
                {/* Pagination for Not Found */}
                {comparison.notFoundInNew.length > itemsPerPage && (
                  <div className="mt-6 flex items-center justify-between border-t pt-4">
                    <div className="text-sm text-gray-600">
                      Showing {((notFoundPage - 1) * itemsPerPage) + 1} to {Math.min(notFoundPage * itemsPerPage, comparison.notFoundInNew.length)} of {comparison.notFoundInNew.length}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setNotFoundPage(1)}
                        disabled={notFoundPage === 1}
                        className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        First
                      </button>
                      <button
                        onClick={() => setNotFoundPage(p => Math.max(1, p - 1))}
                        disabled={notFoundPage === 1}
                        className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        Previous
                      </button>
                      <span className="px-4 py-1 bg-red-100 text-red-700 rounded text-sm font-medium">
                        {notFoundPage} / {Math.ceil(comparison.notFoundInNew.length / itemsPerPage)}
                      </span>
                      <button
                        onClick={() => setNotFoundPage(p => Math.min(Math.ceil(comparison.notFoundInNew.length / itemsPerPage), p + 1))}
                        disabled={notFoundPage >= Math.ceil(comparison.notFoundInNew.length / itemsPerPage)}
                        className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        Next
                      </button>
                      <button
                        onClick={() => setNotFoundPage(Math.ceil(comparison.notFoundInNew.length / itemsPerPage))}
                        disabled={notFoundPage >= Math.ceil(comparison.notFoundInNew.length / itemsPerPage)}
                        className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        Last
                      </button>
                    </div>
                  </div>
                )}
              </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="glass rounded-3xl p-6 shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold mb-1">Ready to Update?</h3>
            <p className="text-sm text-gray-600">
              This will update {comparison.summary.willUpdate} players and create {comparison.summary.willCreate - excludedPlayerIds.size} new entries
              {excludedPlayerIds.size > 0 && (
                <span className="text-orange-600 font-medium"> ({excludedPlayerIds.size} duplicate(s) skipped)</span>
              )}
            </p>
          </div>
          <button
            onClick={handleConfirmUpdate}
            disabled={importing}
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-medium rounded-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? 'Updating...' : 'Confirm & Update'}
          </button>
        </div>
        {importStatus && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">{importStatus}</p>
          </div>
        )}
      </div>
    </div>
  )
}
