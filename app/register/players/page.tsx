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

  const handleDeleteRegistration = async (playerId: string) => {
    if (!seasonId) return

    // Final confirmation
    if (!confirm('Are you sure you want to remove this player registration? This will cancel the entire 2-season contract for both the current and next season and remove all related data.')) {
      return
    }

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
    } catch (err) {
      console.error('Error removing registration:', err)
      setError('Failed to remove registration. Please try again.')
      setTimeout(() => setError(null), 3000)
    }
  }

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
    <div className="min-h-screen bg-gradient-to-br from-[#0066FF]/5 via-white to-[#00D4FF]/5 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header with Back Button */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 mb-2">Player Registration</h1>
            <p className="text-sm sm:text-base text-gray-600">
              Register players for <span className="font-semibold text-[#0066FF]">{season?.name}</span>
            </p>
          </div>
          <button
            onClick={() => router.push('/dashboard/committee')}
            className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-white hover:shadow-md transition-all w-full sm:w-auto justify-center"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </button>
        </div>

        {/* Registration Statistics Overview */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass rounded-2xl p-4 sm:p-6 shadow-lg border border-white/20 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
                <div className="h-10 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
            {/* Confirmed Slots */}
            <div className="glass rounded-2xl p-4 sm:p-6 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg border border-white/20">
              <h3 className="text-xs sm:text-sm font-semibold text-green-900 mb-2">✅ Confirmed Slots</h3>
              <p className="text-3xl sm:text-4xl font-bold text-green-600 mb-1">
                {stats.confirmed_registrations} / {stats.confirmed_slots_limit}
              </p>
              <p className="text-xs sm:text-sm text-green-700">
                {stats.confirmed_slots_limit - stats.confirmed_registrations} slots remaining
              </p>
            </div>

            {/* Unconfirmed Registrations */}
            <div className="glass rounded-2xl p-4 sm:p-6 bg-gradient-to-br from-amber-50 to-yellow-50 shadow-lg border border-white/20">
              <h3 className="text-xs sm:text-sm font-semibold text-amber-900 mb-2">⚠️ Unconfirmed Slots</h3>
              <p className="text-3xl sm:text-4xl font-bold text-amber-600 mb-1">
                {stats.unconfirmed_registrations}
              </p>
              <p className="text-xs sm:text-sm text-amber-700">Waitlist registrations</p>
            </div>

            {/* Total */}
            <div className="glass rounded-2xl p-4 sm:p-6 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg border border-white/20">
              <h3 className="text-xs sm:text-sm font-semibold text-blue-900 mb-2">👥 Total Registrations</h3>
              <p className="text-3xl sm:text-4xl font-bold text-blue-600 mb-1">
                {stats.total_registrations}
              </p>
              <p className="text-xs sm:text-sm text-blue-700">All players registered</p>
            </div>
          </div>
        ) : null}

        {/* Phase Management */}
        {loading ? (
          <div className="glass rounded-3xl p-4 sm:p-6 shadow-lg border border-white/20 mb-6 sm:mb-8 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="mb-6 p-4 rounded-xl bg-gray-100">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
            <div className="mb-6 p-6 bg-gray-100 rounded-xl">
              <div className="h-5 bg-gray-200 rounded w-1/3 mb-3"></div>
              <div className="flex gap-4">
                <div className="h-10 bg-gray-200 rounded flex-1"></div>
                <div className="h-10 bg-gray-200 rounded w-32"></div>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 bg-gray-200 rounded-xl"></div>
              ))}
            </div>
          </div>
        ) : stats ? (
          <div className="glass rounded-3xl p-4 sm:p-6 shadow-lg border border-white/20 mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">📋 Registration Phase Control</h2>
            
            {/* Current Phase */}
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl border-2 bg-gray-50">
              <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">Current Phase:</p>
              <div className="flex items-center gap-2">
                {stats.registration_phase === 'confirmed' && (
                  <span className="px-3 sm:px-4 py-1.5 sm:py-2 bg-green-500 text-white rounded-lg text-sm sm:text-base font-bold">
                    ✨ Phase 1: Confirmed Registration
                  </span>
                )}
                {stats.registration_phase === 'paused' && (
                  <span className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-500 text-white rounded-lg text-sm sm:text-base font-bold">
                    ⏸️ Paused (Confirmed Slots Full)
                  </span>
                )}
                {stats.registration_phase === 'unconfirmed' && (
                  <span className="px-3 sm:px-4 py-1.5 sm:py-2 bg-amber-500 text-white rounded-lg text-sm sm:text-base font-bold">
                    ⚠️ Phase 2: Unconfirmed Registration
                  </span>
                )}
                {stats.registration_phase === 'closed' && (
                  <span className="px-3 sm:px-4 py-1.5 sm:py-2 bg-red-500 text-white rounded-lg text-sm sm:text-base font-bold">
                    🔒 Closed
                  </span>
                )}
              </div>
            </div>

            {/* Adjust Confirmed Slots */}
            <div className="mb-4 sm:mb-6 p-4 sm:p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
              <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-3">Set Confirmed Slots Limit</h3>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                <input
                  type="number"
                  value={newLimit}
                  onChange={(e) => setNewLimit(parseInt(e.target.value) || 0)}
                  min="0"
                  className="px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                />
                <button
                  onClick={() => handlePhaseAction('set_confirmed_slots', newLimit)}
                  disabled={submitting}
                  className="px-4 sm:px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm sm:text-base font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                >
                  Update Limit
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                If you increase the limit, earliest unconfirmed registrations will be auto-promoted to confirmed
              </p>
            </div>

            {/* Phase Actions */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
              <button
                onClick={() => handlePhaseAction('enable_phase2')}
                disabled={submitting || stats.registration_phase === 'unconfirmed'}
                className="px-3 sm:px-4 py-2 sm:py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-xs sm:text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Enable Phase 2
              </button>
              
              <button
                onClick={() => handlePhaseAction('pause_registration')}
                disabled={submitting || stats.registration_phase === 'paused'}
                className="px-3 sm:px-4 py-2 sm:py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-xl text-xs sm:text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Pause Registration
              </button>
              
              <button
                onClick={() => handlePhaseAction('reopen_confirmed')}
                disabled={submitting || stats.registration_phase === 'confirmed'}
                className="px-3 sm:px-4 py-2 sm:py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl text-xs sm:text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reopen Phase 1
              </button>
              
              <button
                onClick={() => handlePhaseAction('close_registration')}
                disabled={submitting || stats.registration_phase === 'closed'}
                className="px-3 sm:px-4 py-2 sm:py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl text-xs sm:text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Close Registration
              </button>
            </div>
          </div>
        ) : null}

        {/* Show message if stats failed to load */}
        {!loading && !stats && (
          <div className="glass rounded-2xl p-6 shadow-lg border border-white/20 mb-6 sm:mb-8 bg-yellow-50">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-yellow-900">Registration management unavailable</p>
                <p className="text-xs text-yellow-700">Phase controls are not available at the moment</p>
              </div>
            </div>
          </div>
        )}

        {/* Player Registration Invite Link */}
        <div className="glass rounded-3xl p-4 sm:p-6 shadow-lg border border-white/20 mb-6 sm:mb-8">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-green-400/10 flex-shrink-0">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-2">Public Player Registration Link</h3>
              <p className="text-xs sm:text-sm text-gray-600 mb-3">
                Share this link with players so they can self-register for this season:
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                <input
                  type="text"
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/register/player?season=${seasonId}`}
                  readOnly
                  className="flex-1 px-3 sm:px-4 py-2 bg-white/60 border border-gray-200 rounded-xl text-xs sm:text-sm font-mono text-gray-700 truncate"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/register/player?season=${seasonId}`)
                    setSuccess('Link copied to clipboard!')
                    setTimeout(() => setSuccess(null), 3000)
                  }}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors flex items-center justify-center gap-2 text-sm whitespace-nowrap"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Link
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Registration Form */}
          <div className="glass rounded-3xl p-4 sm:p-6 lg:p-8 shadow-lg border border-white/20 h-fit">
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 -mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 rounded-t-3xl mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white flex items-center">
                <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Register Player
              </h2>
            </div>

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

          {/* Registered Players List */}
          <div className="glass rounded-3xl shadow-lg border border-white/20 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 sm:px-6 py-3 sm:py-4">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white flex items-center justify-between">
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
              <p className="text-blue-100 text-xs sm:text-sm mt-1">Sorted by registration time (earliest first)</p>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-8">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="mb-4 animate-pulse">
                      <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : registeredPlayers.length === 0 ? (
                <div className="p-12 text-center">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-gray-500 text-lg font-medium">No players registered yet</p>
                  <p className="text-gray-400 text-sm mt-1">Register the first player using the form</p>
                </div>
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="block sm:hidden p-4 space-y-3">
                    {registeredPlayers.map((player, index) => (
                      <div key={player.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-gray-500">#{index + 1}</span>
                              <span className="text-sm font-bold text-gray-900">{player.player_name || 'Unknown'}</span>
                            </div>
                            <div className="text-xs text-gray-600 font-mono mb-2">{player.player_id}</div>
                            <div className="flex items-center gap-2">
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
                            <div className="text-xs text-gray-500 mt-2">
                              {formatDateIST(player.registration_date)}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteRegistration(player.player_id)}
                            className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                            title="Remove registration"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <table className="w-full hidden sm:table">
                    <thead className="bg-gray-50 border-b-2 border-gray-200">
                      <tr>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-700 uppercase">#</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-700 uppercase">Player Name</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-700 uppercase">Player ID</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-700 uppercase">Type</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-700 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {registeredPlayers.map((player, index) => (
                        <tr key={player.id} className="hover:bg-blue-50/30 transition-colors">
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
                            <button
                              onClick={() => handleDeleteRegistration(player.player_id)}
                              className="p-1 sm:p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                              title="Remove registration"
                            >
                              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
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
