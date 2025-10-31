'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { db, auth } from '@/lib/firebase/config'
import { collection, addDoc, doc, getDoc, query, where, getDocs, orderBy, Timestamp, deleteDoc, updateDoc, setDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

interface Season {
  id: string
  name: string
  is_player_registration_open: boolean
}

interface RegisteredPlayer {
  id: string
  player_id: string
  player_name: string
  registration_date: Timestamp
  registration_type: string
  additional_info?: string
}

interface RegistrationStats {
  registration_phase: string
  confirmed_slots_limit: number
  confirmed_slots_filled: number
  unconfirmed_registration_enabled: boolean
  confirmed_registrations: number
  unconfirmed_registrations: number
  total_registrations: number
}

interface MasterPlayer {
  id: string
  player_id: string
  name: string
}

function PlayersRegistrationPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const seasonId = searchParams.get('season')

  // Helper: parse Neon timestamp and compensate for database UTC-4 offset
  const parseNeonTimestampUTC = (s: string): number => {
    try {
      // Neon returns ISO strings like "2025-10-28T02:45:52Z"
      // But the database is in UTC-4, so we need to add 4 hours
      const date = new Date(s)
      if (isNaN(date.getTime())) return Date.now()
      
      // Add 4 hours (14400000 ms) to compensate for UTC-4 offset
      return date.getTime() + (4 * 60 * 60 * 1000)
    } catch {
      return Date.now()
    }
  }

  // Helper function to format timestamp in IST
  const formatDateIST = (timestamp: Timestamp) => {
    return timestamp.toDate().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }

  const [season, setSeason] = useState<Season | null>(null)
  const [registeredPlayers, setRegisteredPlayers] = useState<RegisteredPlayer[]>([])
  const [masterPlayers, setMasterPlayers] = useState<MasterPlayer[]>([])
  const [filteredPlayers, setFilteredPlayers] = useState<MasterPlayer[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPlayers, setSelectedPlayers] = useState<MasterPlayer[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false)
  const [togglingRegistration, setTogglingRegistration] = useState(false)
  const [stats, setStats] = useState<RegistrationStats | null>(null)
  const [newLimit, setNewLimit] = useState<number>(50)
  const [playerSearchQuery, setPlayerSearchQuery] = useState<string>('')
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([])
  const [actioningPlayer, setActioningPlayer] = useState<string | null>(null)


  // Fetch season, master players, and registered players
  useEffect(() => {
    const fetchData = async () => {
      if (!seasonId) {
        setError('No season specified')
        return
      }

      try {
        setLoading(true)
        
        // Fetch all data in parallel for faster loading
        const [seasonDoc, statsResponse, masterPlayersSnapshot, playersResponse] = await Promise.all([
          getDoc(doc(db, 'seasons', seasonId)),
          fetch(`/api/admin/registration-phases?season_id=${seasonId}`),
          getDocs(collection(db, 'realplayers')),
          fetch(`/api/stats/players?seasonId=${seasonId}&limit=1000`)
        ])

        // Process season data
        if (!seasonDoc.exists()) {
          setError('Season not found')
          setLoading(false)
          return
        }

        const seasonData = { id: seasonDoc.id, ...seasonDoc.data() } as Season
        setSeason(seasonData)
        setIsRegistrationOpen(seasonData.is_player_registration_open || false)

        // Process registration stats
        const statsResult = await statsResponse.json()
        if (statsResult.success) {
          setStats(statsResult.data)
          // Always default to 50 slots
          setNewLimit(50)
        }

        // Process master players
        const masterPlayersData = masterPlayersSnapshot.docs.map(doc => ({
          id: doc.id,
          player_id: doc.data().player_id,
          name: doc.data().name
        })) as MasterPlayer[]
        setMasterPlayers(masterPlayersData)

        // Process registered players
        const playersResult = await playersResponse.json()
        const playersData = playersResult.success ? playersResult.data : []
        
        const mappedPlayers = playersData
          .filter((p: any) => p.registration_type)
          .map((player: any, index: number) => {
            // Debug: log raw timestamp from DB for latest player
            if (player.player_name === 'Pranav' || index === 0) {
              console.log(`Raw DB timestamp for ${player.player_name}:`, player.registration_date)
              console.log('Type:', typeof player.registration_date)
            }
            return {
              id: player.id,
              player_id: player.player_id,
              player_name: player.player_name,
              registration_date: player.registration_date
                ? new Timestamp(Math.floor(parseNeonTimestampUTC(player.registration_date) / 1000), 0)
                : Timestamp.now(),
              registration_type: player.registration_type || 'confirmed',
              additional_info: ''
            }
          })
          .sort((a: RegisteredPlayer, b: RegisteredPlayer) => 
            a.registration_date.toMillis() - b.registration_date.toMillis()
          )
        
        setRegisteredPlayers(mappedPlayers as RegisteredPlayer[])
        setLoading(false)
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('Failed to load registration page')
        setLoading(false)
      }
    }

    fetchData()
  }, [seasonId])

  // Handle search
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchTerm(value)
    setShowDropdown(true)

    if (value.trim().length >= 2) {
      const searchLower = value.toLowerCase()
      
      // Filter players matching search (include all, we'll show status)
      const filtered = masterPlayers.filter(p =>
        p.player_id?.toLowerCase().includes(searchLower) ||
        p.name?.toLowerCase().includes(searchLower)
      )
      setFilteredPlayers(filtered)
    } else {
      setFilteredPlayers([])
    }
  }

  const handlePlayerSelect = (player: MasterPlayer) => {
    // Check if player is already selected
    const isAlreadySelected = selectedPlayers.some(p => p.player_id === player.player_id)
    
    if (!isAlreadySelected) {
      setSelectedPlayers([...selectedPlayers, player])
    }
    
    // Clear search
    setSearchTerm('')
    setShowDropdown(false)
    setFilteredPlayers([])
  }

  const handleRemovePlayer = (playerId: string) => {
    setSelectedPlayers(selectedPlayers.filter(p => p.player_id !== playerId))
  }


  const handlePhaseAction = async (action: string, limit?: number) => {
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/admin/registration-phases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season_id: seasonId,
          action,
          confirmed_slots_limit: limit,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setSuccess(result.message)
        // Reload data
        window.location.reload()
      } else {
        setError(result.error)
      }
    } catch (error) {
      console.error('Error performing action:', error)
      setError('Failed to perform action')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePromoteDemote = async (playerId: string, playerName: string, currentType: string) => {
    const newType = currentType === 'confirmed' ? 'unconfirmed' : 'confirmed'
    const action = newType === 'confirmed' ? 'Promote' : 'Demote'
    
    if (!confirm(`${action} ${playerName} to ${newType} registration?`)) return
    
    setActioningPlayer(playerId)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/admin/players/change-registration-type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: playerId,
          season_id: seasonId,
          new_type: newType,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setSuccess(result.message)
        window.location.reload()
      } else {
        setError(result.error)
      }
    } catch (error) {
      console.error('Error changing registration type:', error)
      setError('Failed to change registration type')
    } finally {
      setActioningPlayer(null)
    }
  }

  const handleDeleteRegistration = async (playerId: string) => {
    if (!seasonId) return

    // Final confirmation
    if (!confirm('Are you sure you want to remove this player registration? This will cancel the entire 2-season contract for both the current and next season and remove all related data.')) {
      return
    }

    setActioningPlayer(playerId)

    try {
      const currentRegistrationId = `${playerId}_${seasonId}`
      
      // Call API to delete from all databases (Neon, Firebase, Fantasy)
      const response = await fetch('/api/register/player/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          player_id: playerId,
          season_id: seasonId,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Failed to delete registration')
        setTimeout(() => setError(null), 5000)
        setActioningPlayer(null)
        return
      }

      // Get the registration type to know if it was confirmed or unconfirmed
      const deletedPlayer = registeredPlayers.find(p => p.id === currentRegistrationId)
      const wasConfirmed = deletedPlayer?.registration_type === 'confirmed'

      // Remove from local state
      setRegisteredPlayers(registeredPlayers.filter(p => p.id !== currentRegistrationId))
      
      // Update stats live
      if (stats) {
        setStats({
          ...stats,
          confirmed_registrations: wasConfirmed 
            ? stats.confirmed_registrations - 1 
            : stats.confirmed_registrations,
          unconfirmed_registrations: !wasConfirmed 
            ? stats.unconfirmed_registrations - 1 
            : stats.unconfirmed_registrations,
          total_registrations: stats.total_registrations - 1,
        })
      }
      
      setSuccess('Player contract cancelled successfully (both seasons and all related data removed)!')
      setTimeout(() => setSuccess(null), 3000)
      setActioningPlayer(null)
    } catch (err) {
      console.error('Error removing registration:', err)
      setError('Failed to remove registration. Please try again.')
      setTimeout(() => setError(null), 3000)
      setActioningPlayer(null)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedPlayerIds.length === 0) {
      setError('No players selected')
      return
    }

    if (!confirm(`Are you sure you want to delete ${selectedPlayerIds.length} selected players?`)) return
    
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/admin/players/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_ids: selectedPlayerIds,
          season_id: seasonId,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setSuccess(result.message)
        setSelectedPlayerIds([])
        window.location.reload()
      } else {
        setError(result.error)
      }
    } catch (error) {
      console.error('Error bulk deleting players:', error)
      setError('Failed to bulk delete players')
    } finally {
      setSubmitting(false)
    }
  }

  const togglePlayerSelection = (playerId: string) => {
    setSelectedPlayerIds(prev => 
      prev.includes(playerId) 
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    )
  }

  const toggleSelectAll = () => {
    if (selectedPlayerIds.length === filteredRegisteredPlayers.length) {
      setSelectedPlayerIds([])
    } else {
      setSelectedPlayerIds(filteredRegisteredPlayers.map(p => p.player_id))
    }
  }

  // Filter registered players based on search query
  const filteredRegisteredPlayers = registeredPlayers.filter(player => 
    player.player_name?.toLowerCase().includes(playerSearchQuery.toLowerCase()) ||
    player.player_id?.toLowerCase().includes(playerSearchQuery.toLowerCase())
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      if (selectedPlayers.length === 0) {
        setError('Please select at least one player to register')
        setSubmitting(false)
        return
      }

      let successCount = 0
      let skipCount = 0
      const errors: string[] = []

      // Register each selected player via API
      for (const player of selectedPlayers) {
        try {
          // Use API endpoint to register player (writes to Neon player_seasons)
          const registrationResponse = await fetch('/api/register/player/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              player_id: player.player_id,
              season_id: seasonId,
              user_email: '', // Not needed for committee registration
              user_uid: '', // Not needed for committee registration
              is_admin_registration: true, // Admin registrations always confirmed
              player_data: {
                name: player.name
              }
            })
          })
          
          const registrationResult = await registrationResponse.json()
          
          if (!registrationResponse.ok) {
            if (registrationResult.error?.includes('already registered')) {
              console.log(`Player ${player.name} is already registered for this season`)
              skipCount++
              continue
            }
            throw new Error(registrationResult.error || 'Registration failed')
          }
          
          const registrationId = `${player.player_id}_${seasonId}`
          
          // Add to registered players list
          setRegisteredPlayers(prev => [
            {
              id: registrationId,
              player_id: player.player_id,
              player_name: player.name,
              registration_date: Timestamp.now(),
              registration_type: 'confirmed' // Admin registrations are always confirmed
            },
            ...prev
          ])

          successCount++
        } catch (err) {
          console.error(`Error registering player ${player.player_id}:`, err)
          errors.push(`${player.name} (${player.player_id})`)
        }
      }

      // Clear selected players
      setSelectedPlayers([])
      setSearchTerm('')

      // Update stats live
      if (successCount > 0 && stats) {
        setStats({
          ...stats,
          confirmed_registrations: stats.confirmed_registrations + successCount,
          total_registrations: stats.total_registrations + successCount,
        })
      }

      // Show results
      if (successCount > 0) {
        setSuccess(`Successfully registered ${successCount} player${successCount > 1 ? 's' : ''}!${skipCount > 0 ? ` (${skipCount} already registered)` : ''}`)
      }
      if (errors.length > 0) {
        setError(`Failed to register: ${errors.join(', ')}`)
      }
      
      setTimeout(() => {
        setSuccess(null)
        setError(null)
      }, 5000)
      
      setSubmitting(false)
    } catch (err) {
      console.error('Error registering players:', err)
      setError('Failed to register players. Please try again.')
      setSubmitting(false)
    }
  }

  if (error && !season) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0066FF]/5 via-white to-[#00D4FF]/5 flex items-center justify-center p-4">
        <div className="glass rounded-3xl p-8 shadow-lg border border-white/20 max-w-md w-full">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 rounded-full bg-red-100">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Error</h2>
          <p className="text-gray-600 text-center mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#00D4FF] text-white font-medium hover:shadow-lg transition-all"
          >
            Return Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
      <div className="max-w-[1920px] mx-auto h-screen flex flex-col">
        {/* Modern Header */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard/committee')}
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all"
                title="Back to Dashboard"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Player Registration</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  <span className="font-medium text-blue-600">{season?.name}</span>
                </p>
              </div>
            </div>
            
            {/* Quick Stats Badge */}
            {stats && (
              <div className="hidden sm:flex items-center gap-2">
                <div className="px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
                  <span className="text-xs font-semibold text-green-700">{stats.confirmed_registrations}/{stats.confirmed_slots_limit}</span>
                  <span className="text-xs text-green-600 ml-1">Confirmed</span>
                </div>
                <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-xs font-semibold text-amber-700">{stats.unconfirmed_registrations}</span>
                  <span className="text-xs text-amber-600 ml-1">Waitlist</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="flex-1 overflow-hidden px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-full">
            {/* Left Sidebar - Registration Form & Stats */}
            <div className="xl:col-span-1 space-y-6 overflow-y-auto">
              {/* Statistics Cards */}
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
                      <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                    </div>
                  ))}
                </div>
              ) : stats ? (
                <div className="space-y-3">
                  {/* Confirmed Slots */}
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-l-4 border-l-green-500 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-700">Confirmed Slots</h3>
                      <span className="text-2xl">✅</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 mb-1">
                      {stats.confirmed_registrations} <span className="text-lg text-gray-400">/ {stats.confirmed_slots_limit}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {stats.confirmed_slots_limit - stats.confirmed_registrations} slots remaining
                    </p>
                  </div>

                  {/* Unconfirmed Registrations */}
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-l-4 border-l-amber-500 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-700">Waitlist</h3>
                      <span className="text-2xl">⏳</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 mb-1">
                      {stats.unconfirmed_registrations}
                    </p>
                    <p className="text-xs text-gray-500">Unconfirmed registrations</p>
                  </div>

                  {/* Total */}
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-700">Total Players</h3>
                      <span className="text-2xl">👥</span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 mb-1">
                      {stats.total_registrations}
                    </p>
                    <p className="text-xs text-gray-500">All registered</p>
                  </div>
                </div>
              ) : null}

              {/* Phase Management */}
              {loading ? (
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 animate-pulse">
                  <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
                  <div className="h-10 bg-gray-200 rounded w-full"></div>
                </div>
              ) : stats ? (
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    📋 <span>Phase Control</span>
                  </h3>
            
                  {/* Current Phase */}
                  <div className="mb-4 p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <p className="text-xs font-medium text-gray-600 mb-2">Current Phase</p>
                    {stats.registration_phase === 'confirmed' && (
                      <span className="inline-flex px-3 py-1 bg-green-500 text-white rounded-lg text-sm font-semibold">
                        ✨ Confirmed
                      </span>
                    )}
                    {stats.registration_phase === 'paused' && (
                      <span className="inline-flex px-3 py-1 bg-gray-500 text-white rounded-lg text-sm font-semibold">
                        ⏸️ Paused
                      </span>
                    )}
                    {stats.registration_phase === 'unconfirmed' && (
                      <span className="inline-flex px-3 py-1 bg-amber-500 text-white rounded-lg text-sm font-semibold">
                        ⚠️ Waitlist
                      </span>
                    )}
                    {stats.registration_phase === 'closed' && (
                      <span className="inline-flex px-3 py-1 bg-red-500 text-white rounded-lg text-sm font-semibold">
                        🔒 Closed
                      </span>
                    )}
                  </div>

                  {/* Adjust Confirmed Slots */}
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs font-medium text-gray-700 mb-2">Confirmed Slots Limit</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={newLimit}
                        onChange={(e) => setNewLimit(parseInt(e.target.value) || 0)}
                        min="0"
                        className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      <button
                        onClick={() => handlePhaseAction('set_confirmed_slots', newLimit)}
                        disabled={submitting}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                      >
                        Update
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      Auto-promotes earliest unconfirmed when increased
                    </p>
                  </div>

                  {/* Phase Actions */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handlePhaseAction('enable_phase2')}
                      disabled={submitting || stats.registration_phase === 'unconfirmed'}
                      className="px-2 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Enable Phase 2
                    </button>
                    
                    <button
                      onClick={() => handlePhaseAction('pause_registration')}
                      disabled={submitting || stats.registration_phase === 'paused'}
                      className="px-2 py-1.5 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Pause
                    </button>
                    
                    <button
                      onClick={() => handlePhaseAction('reopen_confirmed')}
                      disabled={submitting || stats.registration_phase === 'confirmed'}
                      className="px-2 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Reopen Phase 1
                    </button>
                    
                    <button
                      onClick={() => handlePhaseAction('close_registration')}
                      disabled={submitting || stats.registration_phase === 'closed'}
                      className="px-2 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Registration Form */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  <span>Quick Register</span>
                </h3>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {/* Player Search */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Search Player <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={handleSearchChange}
                      onFocus={() => setShowDropdown(true)}
                      className="w-full px-4 py-2 pr-10 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                      placeholder="Search by player ID or name..."
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchTerm('')
                          setFilteredPlayers([])
                          setShowDropdown(false)
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Type at least 2 characters to search</p>
                  
                  {/* Dropdown */}
                  {showDropdown && filteredPlayers.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      {filteredPlayers.map(player => {
                        const isRegistered = registeredPlayers.some(p => p.player_id === player.player_id)
                        const isSelected = selectedPlayers.some(p => p.player_id === player.player_id)
                        const isDisabled = isRegistered || isSelected
                        return (
                          <button
                            key={player.id}
                            type="button"
                            onClick={() => !isDisabled && handlePlayerSelect(player)}
                            disabled={isDisabled}
                            className={`w-full px-4 py-3 text-left transition-colors border-b border-gray-100 last:border-b-0 ${
                              isDisabled 
                                ? 'bg-gray-50 cursor-not-allowed opacity-60' 
                                : 'hover:bg-purple-50 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{player.name}</div>
                                <div className="text-sm text-gray-500">{player.player_id}</div>
                              </div>
                              {isRegistered && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                                  Already Registered
                                </span>
                              )}
                              {isSelected && !isRegistered && (
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                                  Selected
                                </span>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Selected Players Display */}
                {selectedPlayers.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-purple-900 mb-2">
                      Selected Players ({selectedPlayers.length}):
                    </div>
                    {selectedPlayers.map((player) => (
                      <div key={player.player_id} className="p-3 bg-purple-50 rounded-xl border border-purple-200 flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-purple-900">{player.name}</div>
                          <div className="text-sm text-purple-700">ID: {player.player_id}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemovePlayer(player.player_id)}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                          title="Remove player"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

              </div>

              {/* Messages */}
              {error && (
                <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              {success && (
                <div className="mt-4 p-4 rounded-xl bg-green-50 border border-green-200">
                  <p className="text-green-600 text-sm">{success}</p>
                </div>
              )}

              {/* Submit Button */}
              <div className="mt-6">
                <button
                  type="submit"
                  disabled={submitting || selectedPlayers.length === 0}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 text-white font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Registering...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Register {selectedPlayers.length > 0 ? `${selectedPlayers.length} Player${selectedPlayers.length > 1 ? 's' : ''}` : 'Players'}
                    </>
                  )}
                </button>
              </div>
            </form>
              </div>
            </div>

            {/* Main Content Area - Registered Players List */}
            <div className="xl:col-span-2 flex flex-col overflow-hidden">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex-shrink-0">
                  <h2 className="text-xl font-bold text-white flex items-center justify-between">
                <span className="flex items-center">
                  <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Registered Players
                </span>
                <span className="text-xs sm:text-sm bg-white/20 px-2 sm:px-3 py-1 rounded-full">
                  {loading ? '...' : `${registeredPlayers.length} players`}
                </span>
                  </h2>
                  
                  {/* Search and Bulk Actions */}
                  <div className="mt-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-md">
                  <input
                    type="text"
                    placeholder="Search by name or ID..."
                    value={playerSearchQuery}
                    onChange={(e) => setPlayerSearchQuery(e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 pl-9 sm:pl-10 rounded-lg bg-white/90 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-300 focus:outline-none text-sm"
                  />
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 absolute left-2.5 sm:left-3 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {/* Bulk Actions */}
                {selectedPlayerIds.length > 0 && (
                  <button
                    onClick={handleBulkDelete}
                    disabled={submitting}
                    className="px-3 sm:px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-all disabled:opacity-50 text-sm whitespace-nowrap"
                  >
                    Delete Selected ({selectedPlayerIds.length})
                  </button>
                )}
                  </div>
                  
                  <p className="text-blue-100 text-xs mt-2">
                Showing {filteredRegisteredPlayers.length} of {registeredPlayers.length} players (sorted by registration time)
                  </p>
                </div>

                <div className="overflow-x-auto overflow-y-auto flex-1">
              {loading ? (
                <div className="p-8">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="mb-4 animate-pulse">
                      <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : filteredRegisteredPlayers.length === 0 ? (
                <div className="p-12 text-center">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-gray-500 text-lg font-medium">
                    {playerSearchQuery ? 'No players found matching your search' : 'No players registered yet'}
                  </p>
                  <p className="text-gray-400 text-sm mt-1">
                    {playerSearchQuery ? 'Try a different search term' : 'Register the first player using the form'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="block sm:hidden p-4 space-y-3">
                    {filteredRegisteredPlayers.map((player, index) => {
                      const isActioning = actioningPlayer === player.player_id
                      return (
                        <div key={player.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                          <div className="flex gap-3 mb-2">
                            <input
                              type="checkbox"
                              checked={selectedPlayerIds.includes(player.player_id)}
                              onChange={() => togglePlayerSelection(player.player_id)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 mt-1"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold text-gray-500">#{index + 1}</span>
                                <span className="text-sm font-bold text-gray-900">{player.player_name || 'Unknown'}</span>
                              </div>
                              <div className="text-xs text-gray-600 font-mono mb-2">{player.player_id}</div>
                              <div className="flex items-center gap-2 mb-2">
                                {player.registration_type === 'confirmed' ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    ✅ Confirmed
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                    ⚠️ Unconfirmed
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 mb-2">
                                {formatDateIST(player.registration_date)}
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handlePromoteDemote(player.player_id, player.player_name || 'Unknown', player.registration_type)}
                                  disabled={isActioning}
                                  className="px-2 py-1 text-xs font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                  style={{
                                    backgroundColor: player.registration_type === 'confirmed' ? '#f59e0b' : '#10b981',
                                    color: 'white'
                                  }}
                                >
                                  {isActioning ? '...' : (player.registration_type === 'confirmed' ? 'Demote' : 'Promote')}
                                </button>
                                <button
                                  onClick={() => handleDeleteRegistration(player.player_id)}
                                  disabled={isActioning}
                                  className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isActioning ? '...' : 'Delete'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Desktop Table View */}
                  <table className="w-full hidden sm:table">
                    <thead className="bg-gray-50 border-b-2 border-gray-200">
                      <tr>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left">
                          <input
                            type="checkbox"
                            checked={selectedPlayerIds.length === filteredRegisteredPlayers.length && filteredRegisteredPlayers.length > 0}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                        </th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-700 uppercase">#</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-700 uppercase">Player Name</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-700 uppercase">Player ID</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-700 uppercase">Type</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredRegisteredPlayers.map((player, index) => {
                        const isActioning = actioningPlayer === player.player_id
                        return (
                          <tr key={player.id} className="hover:bg-blue-50/30 transition-colors">
                            <td className="px-3 sm:px-4 py-2 sm:py-3">
                              <input
                                type="checkbox"
                                checked={selectedPlayerIds.includes(player.player_id)}
                                onChange={() => togglePlayerSelection(player.player_id)}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600">{index + 1}</td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base font-medium text-gray-900">
                              {player.player_name || 'Unknown Player'}
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 font-mono">
                              {player.player_id}
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3">
                              {player.registration_type === 'confirmed' ? (
                                <span className="inline-flex items-center px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  ✅ Confirmed
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                  ⚠️ Unconfirmed
                                </span>
                              )}
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600">
                              {formatDateIST(player.registration_date)}
                            </td>
                            <td className="px-3 sm:px-4 py-2 sm:py-3">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handlePromoteDemote(player.player_id, player.player_name || 'Unknown', player.registration_type)}
                                  disabled={isActioning}
                                  className="px-2 py-1 text-xs font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                  style={{
                                    backgroundColor: player.registration_type === 'confirmed' ? '#f59e0b' : '#10b981',
                                    color: 'white'
                                  }}
                                >
                                  {isActioning ? '...' : (player.registration_type === 'confirmed' ? 'Demote' : 'Promote')}
                                </button>
                                <button
                                  onClick={() => handleDeleteRegistration(player.player_id)}
                                  disabled={isActioning}
                                  className="p-1 sm:p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Remove registration"
                                >
                                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </>
              )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PlayersRegistrationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-[#0066FF]/5 via-white to-[#00D4FF]/5 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <PlayersRegistrationPageContent />
    </Suspense>
  );
}
