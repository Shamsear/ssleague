'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { fetchWithTokenRefresh } from '@/lib/token-refresh'

interface Team {
  id: string
  name: string
  current_players: number
  base_slots: number
  purchased_slots: number
  total_slots: number
  available_slots: number
  purchase_history?: SlotPurchase[]
}

interface SlotPurchase {
  id: number
  slots_purchased: number
  price_per_slot: number
  total_cost: number
  purchased_by: string
  notes: string
  purchased_at: string
}

export default function TeamSlotsManagementPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [teams, setTeams] = useState<Team[]>([])
  const [currentSeasonId, setCurrentSeasonId] = useState<string | null>(null)
  const [seasonName, setSeasonName] = useState<string>('')
  const [slotSettings, setSlotSettings] = useState({
    base_slots: 25,
    max_purchasable: 3,
    slot_price: 10
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
    if (!authLoading && user && user.role !== 'committee_admin') {
      router.push('/dashboard')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    const fetchData = async () => {
      if (!user || user.role !== 'committee_admin') return

      try {
        setLoading(true)
        
        // Get current season
        const seasonsQuery = query(
          collection(db, 'seasons'),
          where('isActive', '==', true)
        )
        const seasonsSnapshot = await getDocs(seasonsQuery)

        if (seasonsSnapshot.empty) {
          setMessage({ type: 'error', text: 'No active season found' })
          setLoading(false)
          return
        }

        const seasonDoc = seasonsSnapshot.docs[0]
        const seasonId = seasonDoc.id
        const seasonData = seasonDoc.data()
        
        setCurrentSeasonId(seasonId)
        setSeasonName(seasonData.name || `Season ${seasonData.season_number || ''}`)
        
        // Get slot settings
        setSlotSettings({
          base_slots: seasonData.football_base_slots || seasonData.max_football_players || 25,
          max_purchasable: seasonData.football_max_purchasable_slots || 3,
          slot_price: seasonData.football_slot_price || 10
        })

        // Get all team_seasons for this season
        const teamSeasonsQuery = query(
          collection(db, 'team_seasons'),
          where('season_id', '==', seasonId)
        )
        const teamSeasonsSnapshot = await getDocs(teamSeasonsQuery)

        // Fetch current player counts from Neon database
        const response = await fetchWithTokenRefresh('/api/committee/team-slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ season_id: seasonId })
        })
        
        const neonData = response.ok ? await response.json() : { teams: [] }
        const neonTeamsMap = new Map(neonData.teams?.map((t: any) => [t.id, t.football_players_count]) || [])

        // Fetch slot purchase history
        const historyResponse = await fetchWithTokenRefresh('/api/committee/slot-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ season_id: seasonId })
        })
        
        const historyData = historyResponse.ok ? await historyResponse.json() : { history: [] }
        const historyMap = new Map<string, SlotPurchase[]>()
        
        if (historyData.history) {
          historyData.history.forEach((record: any) => {
            if (!historyMap.has(record.team_id)) {
              historyMap.set(record.team_id, [])
            }
            historyMap.get(record.team_id)!.push(record)
          })
        }

        const teamsData: Team[] = []
        
        for (const tsDoc of teamSeasonsSnapshot.docs) {
          const tsData = tsDoc.data()
          const teamId = tsData.team_id
          
          // Get team name
          const teamDoc = await getDoc(doc(db, 'teams', teamId))
          const teamData = teamDoc.data()
          
          const baseSlots = tsData.football_base_slots || slotSettings.base_slots
          const purchasedSlots = tsData.football_purchased_slots || 0
          const totalSlots = tsData.football_total_slots || baseSlots
          // Get current player count from Neon (source of truth)
          const currentPlayers = neonTeamsMap.get(teamId) || 0
          
          teamsData.push({
            id: teamId,
            name: teamData?.name || 'Unknown Team',
            current_players: currentPlayers,
            base_slots: baseSlots,
            purchased_slots: purchasedSlots,
            total_slots: totalSlots,
            available_slots: totalSlots - currentPlayers,
            purchase_history: historyMap.get(teamId) || []
          })
        }

        teamsData.sort((a, b) => a.name.localeCompare(b.name))
        setTeams(teamsData)
      } catch (error: any) {
        console.error('Error fetching data:', error)
        setMessage({ type: 'error', text: 'Failed to load teams' })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user])

  const toggleTeamExpansion = (teamId: string) => {
    const newExpanded = new Set(expandedTeams)
    if (newExpanded.has(teamId)) {
      newExpanded.delete(teamId)
    } else {
      newExpanded.add(teamId)
    }
    setExpandedTeams(newExpanded)
  }

  const handleAddSlots = async (teamId: string, slotsToAdd: number) => {
    if (!currentSeasonId) return
    
    const team = teams.find(t => t.id === teamId)
    if (!team) return

    if (team.purchased_slots + slotsToAdd > slotSettings.max_purchasable) {
      setMessage({ 
        type: 'error', 
        text: `Cannot add ${slotsToAdd} slots. Maximum is ${slotSettings.max_purchasable}, team already has ${team.purchased_slots}.` 
      })
      return
    }

    try {
      const response = await fetchWithTokenRefresh('/api/committee/manage-team-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: teamId,
          season_id: currentSeasonId,
          slots_change: slotsToAdd,
          deduct_payment: true, // Deduct payment when adding slots
          notes: `Committee added ${slotsToAdd} slot(s) to ${team.name}`
        })
      })

      const result = await response.json()

      if (result.success) {
        // Update local state
        setTeams(teams.map(t => t.id === teamId ? {
          ...t,
          purchased_slots: result.data.new_purchased_slots,
          total_slots: result.data.new_total_slots,
          available_slots: result.data.new_total_slots - t.current_players
        } : t))

        setMessage({ type: 'success', text: result.message })
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to add slots' })
      }
    } catch (error: any) {
      console.error('Error adding slots:', error)
      setMessage({ type: 'error', text: 'Failed to add slots' })
    }
  }

  const handleRemoveSlots = async (teamId: string, slotsToRemove: number) => {
    if (!currentSeasonId) return
    
    const team = teams.find(t => t.id === teamId)
    if (!team) return

    if (team.purchased_slots < slotsToRemove) {
      setMessage({ type: 'error', text: `Cannot remove ${slotsToRemove} slots. Team only has ${team.purchased_slots} purchased slots.` })
      return
    }

    const newTotal = team.total_slots - slotsToRemove
    if (newTotal < team.current_players) {
      setMessage({ 
        type: 'error', 
        text: `Cannot remove slots. Team has ${team.current_players} players, would result in ${newTotal} total slots.` 
      })
      return
    }

    try {
      const response = await fetchWithTokenRefresh('/api/committee/manage-team-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: teamId,
          season_id: currentSeasonId,
          slots_change: -slotsToRemove, // Negative for removal
          deduct_payment: true, // Refund when removing slots
          notes: `Committee removed ${slotsToRemove} slot(s) from ${team.name}`
        })
      })

      const result = await response.json()

      if (result.success) {
        // Update local state
        setTeams(teams.map(t => t.id === teamId ? {
          ...t,
          purchased_slots: result.data.new_purchased_slots,
          total_slots: result.data.new_total_slots,
          available_slots: result.data.new_total_slots - t.current_players
        } : t))

        setMessage({ type: 'success', text: result.message })
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to remove slots' })
      }
    } catch (error: any) {
      console.error('Error removing slots:', error)
      setMessage({ type: 'error', text: 'Failed to remove slots' })
    }
  }

  const filteredTeams = teams.filter(team =>
    team.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading teams...</p>
        </div>
      </div>
    )
  }

  if (!user || user.role !== 'committee_admin') {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="glass rounded-3xl p-6 mb-8 shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold gradient-text mb-2">🎯 Team Slot Management</h1>
            <p className="text-gray-600">Manage football player slots for teams in {seasonName}</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/dashboard/committee/football-slot-settings"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              ⚙️ Settings
            </Link>
            <Link
              href="/dashboard/committee"
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              ← Back
            </Link>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`glass rounded-xl p-4 mb-6 ${
          message.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        } border`}>
          <p className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {message.text}
          </p>
        </div>
      )}

      {/* Info Box */}
      <div className="glass rounded-xl p-6 mb-6 bg-blue-50/50 border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">📊 Current Settings</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-blue-700">Base Slots:</span>
            <span className="ml-2 font-bold text-blue-900">{slotSettings.base_slots}</span>
          </div>
          <div>
            <span className="text-blue-700">Max Purchasable:</span>
            <span className="ml-2 font-bold text-blue-900">{slotSettings.max_purchasable}</span>
          </div>
          <div>
            <span className="text-blue-700">Price Per Slot:</span>
            <span className="ml-2 font-bold text-blue-900">₡{slotSettings.slot_price}</span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="glass rounded-xl p-4 mb-6">
        <input
          type="text"
          placeholder="Search teams..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Teams Table */}
      <div className="glass rounded-3xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-blue-50 to-purple-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Team</th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">Current Players</th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">Base Slots</th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">Purchased</th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">Total Slots</th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">Available</th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTeams.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No teams found
                  </td>
                </tr>
              ) : (
                filteredTeams.map((team) => [
                  <tr key={`team-${team.id}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {team.purchase_history && team.purchase_history.length > 0 && (
                          <button
                            onClick={() => toggleTeamExpansion(team.id)}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            {expandedTeams.has(team.id) ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                              </svg>
                            )}
                          </button>
                        )}
                        <div className="text-sm font-medium text-gray-900">{team.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-semibold text-gray-900">{team.current_players}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm text-gray-600">{team.base_slots}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        team.purchased_slots > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        +{team.purchased_slots}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-bold text-gray-900">{team.total_slots}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        team.available_slots > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {team.available_slots}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleAddSlots(team.id, 1)}
                          disabled={team.purchased_slots >= slotSettings.max_purchasable}
                          className="px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Add 1 slot"
                        >
                          +1
                        </button>
                        <button
                          onClick={() => handleRemoveSlots(team.id, 1)}
                          disabled={team.purchased_slots === 0 || team.total_slots - 1 < team.current_players}
                          className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Remove 1 slot"
                        >
                          -1
                        </button>
                      </div>
                    </td>
                  </tr>,
                  
                  // Expanded History Row
                  expandedTeams.has(team.id) && team.purchase_history && team.purchase_history.length > 0 && (
                    <tr key={`history-${team.id}`} className="bg-gray-50">
                      <td colSpan={7} className="px-6 py-4">
                        <div className="ml-8">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">📜 Slot Purchase History</h4>
                          <div className="space-y-2">
                            {team.purchase_history.map((purchase) => (
                              <div key={purchase.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                                <div className="flex items-center gap-4">
                                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                                    purchase.slots_purchased > 0 
                                      ? 'bg-green-100 text-green-700' 
                                      : 'bg-red-100 text-red-700'
                                  }`}>
                                    {purchase.slots_purchased > 0 ? '+' : ''}{purchase.slots_purchased} slot{Math.abs(purchase.slots_purchased) !== 1 ? 's' : ''}
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    <span className="font-medium text-gray-800">By:</span> {purchase.purchased_by}
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    <span className="font-medium text-gray-800">Cost:</span> ₡{Math.abs(purchase.total_cost)}
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    <span className="font-medium text-gray-800">Date:</span> {new Date(purchase.purchased_at).toLocaleDateString()}
                                  </div>
                                </div>
                                {purchase.notes && (
                                  <div className="text-xs text-gray-500 italic">
                                    {purchase.notes}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                ])
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
