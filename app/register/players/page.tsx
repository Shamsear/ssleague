'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { db, auth } from '@/lib/firebase/config'
import { collection, addDoc, doc, getDoc, query, where, getDocs, orderBy, Timestamp, deleteDoc, updateDoc, setDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import EmailVerificationRequests from './EmailVerificationRequests'

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
  additional_info?: string
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


  // Fetch season, master players, and registered players
  useEffect(() => {
    const fetchData = async () => {
      if (!seasonId) {
        setError('No season specified')
        return
      }

      try {
        setLoading(true)
        // Fetch season
        const seasonDoc = await getDoc(doc(db, 'seasons', seasonId))
        if (!seasonDoc.exists()) {
          setError('Season not found')
          setLoading(false)
          return
        }

        const seasonData = { id: seasonDoc.id, ...seasonDoc.data() } as Season
        setSeason(seasonData)
        setIsRegistrationOpen(seasonData.is_player_registration_open || false)

        // Fetch all master players from realplayers collection
        const masterPlayersRef = collection(db, 'realplayers')
        const masterPlayersSnapshot = await getDocs(masterPlayersRef)
        const masterPlayersData = masterPlayersSnapshot.docs.map(doc => ({
          id: doc.id,
          player_id: doc.data().player_id,
          name: doc.data().name
        })) as MasterPlayer[]
        setMasterPlayers(masterPlayersData)

        // Fetch registered players for this season
        const playersQuery = query(
          collection(db, 'realplayer'),
          where('season_id', '==', seasonId)
        )
        const playersSnapshot = await getDocs(playersQuery)
        
        const playersData = playersSnapshot.docs.map(playerDoc => {
          const data = playerDoc.data()
          return {
            id: playerDoc.id,
            player_id: data.player_id,
            player_name: data.player_name || data.name, // Support both field names
            registration_date: data.registration_date || data.created_at,
            additional_info: data.additional_info
          }
        })
        
        setRegisteredPlayers(playersData as RegisteredPlayer[])
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


  const handleToggleRegistration = async () => {
    if (!seasonId) return
    
    setTogglingRegistration(true)
    setError(null)
    setSuccess(null)
    
    try {
      const response = await fetch(`/api/admin/seasons/${seasonId}/toggle-player-registration`, {
        method: 'POST',
      })
      
      const data = await response.json()
      
      if (data.success) {
        setIsRegistrationOpen(data.season.is_player_registration_open)
        setSuccess(data.message)
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(data.error || 'Failed to toggle registration')
      }
    } catch (err) {
      console.error('Error toggling registration:', err)
      setError('Failed to toggle registration status')
    } finally {
      setTogglingRegistration(false)
    }
  }

  const handleDeleteRegistration = async (playerId: string) => {
    if (!seasonId) return

    try {
      // First, check if player is assigned to any team in current or next season
      const currentSeasonNumber = parseInt(seasonId.replace(/\D/g, ''))
      const seasonPrefix = seasonId.replace(/\d+$/, '')
      const nextSeasonId = `${seasonPrefix}${currentSeasonNumber + 1}`
      
      // Check current season assignment
      const currentSeasonQuery = query(
        collection(db, 'realplayer'),
        where('player_id', '==', playerId),
        where('season_id', '==', seasonId)
      )
      const currentSeasonSnapshot = await getDocs(currentSeasonQuery)
      
      if (!currentSeasonSnapshot.empty) {
        const playerData = currentSeasonSnapshot.docs[0].data()
        if (playerData.team_id) {
          setError(`Cannot delete registration: ${playerData.player_name || 'Player'} is already assigned to a team (${playerData.team_id}). Please remove the player from the team first.`)
          setTimeout(() => setError(null), 5000)
          return
        }
      }
      
      // Check next season assignment
      const nextSeasonQuery = query(
        collection(db, 'realplayer'),
        where('player_id', '==', playerId),
        where('season_id', '==', nextSeasonId)
      )
      const nextSeasonSnapshot = await getDocs(nextSeasonQuery)
      
      if (!nextSeasonSnapshot.empty) {
        const playerData = nextSeasonSnapshot.docs[0].data()
        if (playerData.team_id) {
          setError(`Cannot delete registration: Player is already assigned to a team in next season (${playerData.team_id}). Please remove the player from the team first.`)
          setTimeout(() => setError(null), 5000)
          return
        }
      }
      
      // Check if player has any auction value set (indicates they were in an auction)
      if (!currentSeasonSnapshot.empty) {
        const playerData = currentSeasonSnapshot.docs[0].data()
        if (playerData.auction_value && playerData.auction_value > 0) {
          if (!confirm(`This player has an auction value of $${playerData.auction_value}. Are you sure you want to delete? This may indicate they participated in an auction.`)) {
            return
          }
        }
      }
      
      // Final confirmation
      if (!confirm('Are you sure you want to remove this player registration? This will cancel the entire 2-season contract for both the current and next season.')) {
        return
      }
      
      // Construct the composite document IDs for both seasons
      const currentRegistrationId = `${playerId}_${seasonId}`
      const nextRegistrationId = `${playerId}_${nextSeasonId}`
      
      // Delete the registration from realplayer collection for CURRENT season
      await deleteDoc(doc(db, 'realplayer', currentRegistrationId))
      
      // Delete the registration from realplayer collection for NEXT season
      try {
        await deleteDoc(doc(db, 'realplayer', nextRegistrationId))
      } catch (nextSeasonError) {
        console.warn('Next season registration may not exist yet:', nextSeasonError)
      }

      // Update is_registered to false in realplayers collection
      try {
        await fetch('/api/real-players', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            player_id: playerId,
            is_registered: false,
            registered_at: null,
            season_id: null
          })
        })
      } catch (updateError) {
        console.warn('Failed to update is_registered status:', updateError)
      }

      // Remove from local state
      setRegisteredPlayers(registeredPlayers.filter(p => p.id !== currentRegistrationId))
      setSuccess('Player contract cancelled successfully (both seasons removed)!')
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

      // Register each selected player
      for (const player of selectedPlayers) {
        try {
          // Check if player is already registered for this season
          const existingPlayerQuery = query(
            collection(db, 'realplayer'),
            where('season_id', '==', seasonId),
            where('player_id', '==', player.player_id)
          )
          const existingPlayers = await getDocs(existingPlayerQuery)

          if (!existingPlayers.empty) {
            skipCount++
            continue
          }

          // Generate contract ID for 2-season contract
          const currentSeasonNumber = parseInt(seasonId.replace(/\D/g, ''))
          const seasonPrefix = seasonId.replace(/\d+$/, '')
          const nextSeasonId = `${seasonPrefix}${currentSeasonNumber + 1}`
          const contractId = `${player.player_id}_${seasonId}_${nextSeasonId}_${Date.now()}`
          
          // Create player registration for CURRENT season
          const registrationId = `${player.player_id}_${seasonId}`
          const registrationRef = doc(db, 'realplayer', registrationId)
          
          await setDoc(registrationRef, {
            season_id: seasonId,
            player_id: player.player_id,
            player_name: player.name,
            name: player.name,
            registration_date: Timestamp.now(),
            created_at: Timestamp.now(),
            updated_at: Timestamp.now(),
            // Contract fields for 2-season system
            contract_id: contractId,
            contract_start_season: seasonId,
            contract_end_season: nextSeasonId,
            contract_length: 2,
            is_auto_registered: false // First season registration
          })
          
          // Create player registration for NEXT season (auto-registered)
          const nextRegistrationId = `${player.player_id}_${nextSeasonId}`
          const nextRegistrationRef = doc(db, 'realplayer', nextRegistrationId)
          
          await setDoc(nextRegistrationRef, {
            season_id: nextSeasonId,
            player_id: player.player_id,
            player_name: player.name,
            name: player.name,
            registration_date: Timestamp.now(),
            created_at: Timestamp.now(),
            updated_at: Timestamp.now(),
            // Contract fields for 2-season system
            contract_id: contractId,
            contract_start_season: seasonId,
            contract_end_season: nextSeasonId,
            contract_length: 2,
            is_auto_registered: true // Second season (auto-registered)
          })

          // Update the player's is_registered status in realplayers collection
          try {
            const updateResponse = await fetch('/api/real-players', {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                player_id: player.player_id,
                is_registered: true,
                registered_at: new Date().toISOString(),
                season_id: seasonId
              })
            })
            
            const updateResult = await updateResponse.json()
            if (!updateResult.success) {
              console.error('Failed to update is_registered status:', updateResult.error)
            }
          } catch (updateError) {
            console.error('Error updating is_registered status:', updateError)
          }
          
          // Add to registered players list
          setRegisteredPlayers(prev => [
            {
              id: registrationId,
              player_id: player.player_id,
              player_name: player.name,
              registration_date: Timestamp.now()
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

        {/* Player Registration Status Toggle */}
        <div className="glass rounded-3xl p-4 sm:p-6 shadow-lg border border-white/20 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className={`p-3 rounded-xl ${
                isRegistrationOpen 
                  ? 'bg-gradient-to-br from-green-500/20 to-green-400/10' 
                  : 'bg-gradient-to-br from-red-500/20 to-red-400/10'
              }`}>
                <svg className={`w-6 h-6 ${
                  isRegistrationOpen ? 'text-green-600' : 'text-red-600'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isRegistrationOpen 
                    ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    : "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  } />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Public Player Registration</h3>
                <p className={`text-sm font-medium ${
                  isRegistrationOpen ? 'text-green-600' : 'text-red-600'
                }`}>
                  Status: {isRegistrationOpen ? 'Open' : 'Closed'}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleRegistration}
              disabled={togglingRegistration}
              className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm sm:text-base font-medium transition-all flex items-center justify-center gap-2 w-full sm:w-auto ${
                isRegistrationOpen
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {togglingRegistration ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Updating...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isRegistrationOpen
                      ? "M6 18L18 6M6 6l12 12"
                      : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    } />
                  </svg>
                  {isRegistrationOpen ? 'Close Registration' : 'Open Registration'}
                </>
              )}
            </button>
          </div>
        </div>

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
                        return (
                          <button
                            key={player.id}
                            type="button"
                            onClick={() => !isRegistered && handlePlayerSelect(player)}
                            disabled={isRegistered}
                            className={`w-full px-4 py-3 text-left transition-colors border-b border-gray-100 last:border-b-0 ${
                              isRegistered 
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
                <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
                  {loading ? '...' : `${registeredPlayers.length} players`}
                </span>
              </h2>
            </div>

            <div className="max-h-[600px] overflow-y-auto">
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
                <div className="divide-y divide-gray-200">
                  {registeredPlayers.map((player) => (
                    <div key={player.id} className="p-3 sm:p-4 hover:bg-blue-50 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 text-base sm:text-lg mb-1 truncate">
                            {player.player_name || 'Unknown Player'}
                          </h3>
                          <span className="text-xs sm:text-sm text-gray-600 font-mono">
                            ID: {player.player_id}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                          <div className="text-right hidden sm:block">
                            <p className="text-xs text-gray-500">
                              {player.registration_date?.toDate().toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteRegistration(player.player_id)}
                            className="p-1.5 sm:p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                            title="Remove registration"
                          >
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {/* Show date on mobile below the name */}
                      <p className="text-xs text-gray-500 mt-1 sm:hidden">
                        {player.registration_date?.toDate().toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Email Verification Requests - Only visible if there are pending requests */}
        {seasonId && <EmailVerificationRequests seasonId={seasonId} />}

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
