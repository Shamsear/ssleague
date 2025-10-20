'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { db, auth } from '@/lib/firebase/config'
import { collection, addDoc, doc, getDoc, query, where, getDocs, Timestamp, updateDoc } from 'firebase/firestore'
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User } from 'firebase/auth'

interface Season {
  id: string
  name: string
  is_player_registration_open: boolean
}

interface Player {
  id?: string
  player_id: string
  name: string
  place?: string
  date_of_birth?: string
  email?: string
  phone?: string
  team?: string
  is_registered?: boolean
  previous_season_team?: string
  previous_season_category?: string
}

interface FormData {
  name: string
  place: string
  date_of_birth: string
  email: string
  phone: string
}

function PlayerVerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const seasonId = searchParams.get('season')

  const [season, setSeason] = useState<Season | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<Player[]>([])
  const [showSearchStep, setShowSearchStep] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [isNewPlayer, setIsNewPlayer] = useState(false)
  const playerId = searchParams.get('player')
  const [showDistrictDropdown, setShowDistrictDropdown] = useState(false)
  const [districtSearch, setDistrictSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [formData, setFormData] = useState<FormData>({
    name: '',
    place: '',
    date_of_birth: '',
    email: '',
    phone: ''
  })

  // Kerala districts list
  const keralaDistricts = [
    'Alappuzha',
    'Ernakulam',
    'Idukki',
    'Kannur',
    'Kasaragod',
    'Kollam',
    'Kottayam',
    'Kozhikode',
    'Malappuram',
    'Palakkad',
    'Pathanamthitta',
    'Thiruvananthapuram',
    'Thrissur',
    'Wayanad'
  ]

  // Filter districts based on search
  const filteredDistricts = keralaDistricts.filter(district =>
    district.toLowerCase().includes(districtSearch.toLowerCase())
  )

  // Check auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      if (!currentUser) {
        // Redirect back to main registration page if not signed in
        router.push(`/register/player?season=${seasonId}`)
        return
      }
      setAuthLoading(false)
    })
    return () => unsubscribe()
  }, [router, seasonId])

  // Fetch season data
  useEffect(() => {
    const fetchSeason = async () => {
      if (!seasonId) {
        setError('Missing season information')
        setLoading(false)
        return
      }

      try {
        const seasonDoc = await getDoc(doc(db, 'seasons', seasonId))
        if (!seasonDoc.exists()) {
          setError('Season not found')
          setLoading(false)
          return
        }

        const seasonData = { id: seasonDoc.id, ...seasonDoc.data() } as Season

        if (!seasonData.is_player_registration_open) {
          setError('Player registration is currently closed for this season')
          setLoading(false)
          return
        }

        setSeason(seasonData)
        setLoading(false)
      } catch (err) {
        console.error('Error fetching season:', err)
        setError('Failed to load season details')
        setLoading(false)
      }
    }

    fetchSeason()
  }, [seasonId])

  // Load player data if player ID is provided, or set up for new player
  useEffect(() => {
    const loadPlayerData = async () => {
      if (!user) return

      // If no player ID provided, treat as new player registration
      if (!playerId) {
        setIsNewPlayer(true)
        setShowForm(true)
        setFormData({
          name: '',
          place: '',
          date_of_birth: '',
          email: user.email || '',
          phone: ''
        })
        return
      }

      try {
        const realPlayersRef = collection(db, 'realplayers')
        const playerQuery = query(realPlayersRef, where('player_id', '==', playerId))
        const playerSnapshot = await getDocs(playerQuery)

        if (!playerSnapshot.empty) {
          const playerData = { id: playerSnapshot.docs[0].id, ...playerSnapshot.docs[0].data() } as Player
          setPlayer(playerData)

          // Check if player has complete details
          const hasCompleteDetails = playerData.place && playerData.date_of_birth && playerData.email && playerData.phone

          if (!hasCompleteDetails) {
            // Pre-fill existing data and show form
            setFormData({
              name: playerData.name || '',
              place: playerData.place || '',
              date_of_birth: playerData.date_of_birth || '',
              email: playerData.email || user.email || '',
              phone: playerData.phone || ''
            })
            setShowForm(true)
            setIsNewPlayer(false)
          }
        } else {
          // Player not found, redirect back to search
          setError('Player not found')
          setTimeout(() => {
            router.push(`/register/player?season=${seasonId}`)
          }, 2000)
        }
      } catch (err) {
        console.error('Error loading player data:', err)
        setError('Failed to load player data')
      }
    }

    loadPlayerData()
  }, [playerId, user, seasonId, router])

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDistrictDropdown(false)
        setDistrictSearch('')
      }
    }

    if (showDistrictDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDistrictDropdown])

  // Check if email already used OR if player_id has different email registered
  useEffect(() => {
    const checkEmailUsage = async () => {
      if (!user?.email || !seasonId || !playerId) return

      try {
        // Check 1: Email already used for this season
        const emailCheckQuery = query(
          collection(db, 'realplayers'),
          where('season_id', '==', seasonId),
          where('email', '==', user.email),
          where('is_registered', '==', true)
        )
        const emailCheckSnapshot = await getDocs(emailCheckQuery)

        if (!emailCheckSnapshot.empty) {
          const existingPlayer = emailCheckSnapshot.docs[0].data()
          if (existingPlayer.player_id !== playerId) {
            setError(`This email (${user.email}) has already been used to register for this season by another player`)
            await signOut(auth)
            return
          }
        }

        // Check 2: If player_id already has a registered email in master database
        const masterPlayerQuery = query(
          collection(db, 'realplayers'),
          where('player_id', '==', playerId)
        )
        const masterPlayerSnapshot = await getDocs(masterPlayerQuery)

        if (!masterPlayerSnapshot.empty) {
          const masterPlayerData = masterPlayerSnapshot.docs[0].data()
          
          // If master player has an email and it's different from current user's email
          if (masterPlayerData.email && masterPlayerData.email !== user.email) {
            setError(
              `This player ID (${playerId}) is already registered with email: ${masterPlayerData.email}. ` +
              `You must use the same email address. If you don't have access to that email, please contact the committee admin.`
            )
            await signOut(auth)
            return
          }
        }

        // Check 3: Check if player_id has been registered with different email in ANY previous season
        const allSeasonsQuery = query(
          collection(db, 'realplayer'),
          where('player_id', '==', playerId)
        )
        const allSeasonsSnapshot = await getDocs(allSeasonsQuery)

        if (!allSeasonsSnapshot.empty) {
          for (const doc of allSeasonsSnapshot.docs) {
            const seasonPlayerData = doc.data()
            if (seasonPlayerData.email && seasonPlayerData.email !== user.email) {
              setError(
                `This player ID (${playerId}) was previously registered with email: ${seasonPlayerData.email}. ` +
                `You must use the same email address. Players cannot change emails across seasons for security reasons. ` +
                `If you don't have access to that email, please contact the committee admin.`
              )
              await signOut(auth)
              return
            }
          }
        }
      } catch (err) {
        console.error('Error checking email:', err)
      }
    }

    checkEmailUsage()
  }, [user, seasonId, playerId])

  // Search players by ID or name
  const searchPlayers = async (term: string) => {
    if (term.trim().length < 2) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      const realPlayersRef = collection(db, 'realplayers')
      const playersSnapshot = await getDocs(realPlayersRef)
      const allPlayers = playersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Player[]

      // Filter by player_id or name
      const searchLower = term.toLowerCase()
      const filteredPlayers = allPlayers.filter(p =>
        p.player_id?.toLowerCase().includes(searchLower) ||
        p.name?.toLowerCase().includes(searchLower)
      )

      setSearchResults(filteredPlayers)
    } catch (err) {
      console.error('Error searching players:', err)
    } finally {
      setSearching(false)
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchTerm(value)
    const timer = setTimeout(() => {
      searchPlayers(value)
    }, 300)
    return () => clearTimeout(timer)
  }

  const handleSelectExistingPlayer = async (selectedPlayer: Player) => {
    // Fetch previous season team and category
    try {
      if (seasonId) {
        const currentSeasonDoc = await getDoc(doc(db, 'seasons', seasonId))
        if (currentSeasonDoc.exists()) {
          const currentSeasonNumber = parseInt(currentSeasonDoc.data().name.replace(/\D/g, ''))
          
          if (currentSeasonNumber > 1) {
            // Query team_seasons for previous season
            const previousSeasonQuery = query(
              collection(db, 'team_seasons'),
              where('season_number', '==', currentSeasonNumber - 1)
            )
            const teamSeasonsSnapshot = await getDocs(previousSeasonQuery)
            
            // Find team that has this player
            for (const teamDoc of teamSeasonsSnapshot.docs) {
              const teamData = teamDoc.data()
              const realPlayers = teamData.real_players || []
              
              const playerInTeam = realPlayers.find((p: any) => p.player_id === selectedPlayer.player_id)
              
              if (playerInTeam) {
                selectedPlayer.previous_season_team = teamData.team_name || 'Unknown'
                selectedPlayer.previous_season_category = playerInTeam.category || 'Unknown'
                break
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching previous season data:', err)
    }

    setPlayer(selectedPlayer)
    setShowSearchStep(false)

    // Check if player has missing details
    const hasCompleteDetails = selectedPlayer.place && selectedPlayer.date_of_birth && selectedPlayer.email && selectedPlayer.phone

    if (!hasCompleteDetails) {
      // Pre-fill existing data
      setFormData({
        name: selectedPlayer.name || '',
        place: selectedPlayer.place || '',
        date_of_birth: selectedPlayer.date_of_birth || '',
        email: selectedPlayer.email || user?.email || '',
        phone: selectedPlayer.phone || ''
      })
      setShowForm(true)
      setIsNewPlayer(false)
    }
  }

  const handleAddNewPlayer = () => {
    setShowSearchStep(false)
    setShowForm(true)
    setIsNewPlayer(true)
    setFormData({
      name: '',
      place: '',
      date_of_birth: '',
      email: user?.email || '',
      phone: ''
    })
  }

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleDistrictSelect = (district: string) => {
    setFormData(prev => ({
      ...prev,
      place: district
    }))
    setShowDistrictDropdown(false)
    setDistrictSearch('')
  }

  const handleDistrictSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDistrictSearch(e.target.value)
    setShowDistrictDropdown(true)
  }

  const handleSignOut = async () => {
    try {
      await signOut(auth)
      router.push(`/register/player?season=${seasonId}`)
    } catch (err) {
      console.error('Sign out error:', err)
    }
  }

  const handleConfirm = async () => {
    if (!seasonId || !user?.email) return

    // Validate form if shown
    if (showForm) {
      // For existing players, only validate missing fields
      if (isNewPlayer) {
        // New player: all fields required
        if (!formData.name || !formData.place || !formData.date_of_birth || !formData.email || !formData.phone) {
          setError('Please fill in all required fields')
          return
        }
      } else {
        // Existing player: only validate fields that are missing from database
        const missingFields = []
        if (!player?.name && !formData.name) missingFields.push('Name')
        if (!player?.place && !formData.place) missingFields.push('District')
        if (!player?.date_of_birth && !formData.date_of_birth) missingFields.push('Date of Birth')
        if (!player?.email && !formData.email) missingFields.push('Email')
        if (!player?.phone && !formData.phone) missingFields.push('Phone')
        
        if (missingFields.length > 0) {
          setError(`Please fill in the missing required fields: ${missingFields.join(', ')}`)
          return
        }
      }
    }

    setSubmitting(true)
    setError(null)

    try {
      // For new players, generate a player ID first
      let finalPlayerId = player?.player_id
      
      if (isNewPlayer && !finalPlayerId) {
        // Generate new player ID by finding the max ID
        const playersRef = collection(db, 'realplayers')
        const playersSnapshot = await getDocs(query(playersRef))
        const maxId = playersSnapshot.docs.reduce((max, doc) => {
          const id = (doc.data() as any).player_id as string
          if (id && id.startsWith('sspslpsl')) {
            const numStr = id.replace('sspslpsl', '')
            const num = parseInt(numStr, 10)
            if (!isNaN(num)) {
              return num > max ? num : max
            }
          }
          return max
        }, 0)
        const nextId = maxId + 1
        // Pad with leading zeros to 4 digits to match existing format (0001-9999)
        const paddedId = String(nextId).padStart(4, '0')
        finalPlayerId = `sspslpsl${paddedId}`
      }

      // Prepare player data to send to API
      const playerData: any = {}
      
      if (showForm) {
        // Include form data for fields that need updating
        if (formData.name) playerData.name = formData.name
        if (formData.place) playerData.place = formData.place
        if (formData.date_of_birth) playerData.date_of_birth = formData.date_of_birth
        if (formData.email) playerData.email = formData.email
        if (formData.phone) playerData.phone = formData.phone
      } else if (player) {
        // Use existing player data
        playerData.name = player.name
        if (player.place) playerData.place = player.place
        if (player.date_of_birth) playerData.date_of_birth = player.date_of_birth
        if (player.email) playerData.email = player.email
        if (player.phone) playerData.phone = player.phone
      }

      // Call API to confirm registration
      const response = await fetch('/api/register/player/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          player_id: finalPlayerId,
          season_id: seasonId,
          user_email: user.email,
          user_uid: user.uid,
          player_data: playerData,
        }),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to confirm registration')
      }

      // Redirect to success page
      router.push('/register/player/success')
    } catch (err) {
      console.error('Error confirming registration:', err)
      setError(err instanceof Error ? err.message : 'Failed to complete registration. Please try again.')
      setSubmitting(false)
    }
  }

  const handleBack = () => {
    router.push(`/register/player?season=${seasonId}`)
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0066FF]/5 via-white to-[#00D4FF]/5 flex items-center justify-center p-4">
        <div className="glass rounded-3xl p-8 shadow-lg border border-white/20 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (error && !user) {
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
          <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Registration Error</h2>
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
      <div className="max-w-4xl mx-auto">
        <div className="glass rounded-3xl shadow-lg border border-white/20 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4 text-white">
            <h1 className="text-2xl font-bold flex items-center">
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Player Registration
            </h1>
            {season && <p className="text-green-100 text-sm mt-1">{season.name}</p>}
          </div>

          <div className="p-6">
            {user && (
              <>
                {/* Signed in indicator */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 mb-6 border border-green-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-bold text-green-900 text-sm">Signed In</p>
                        <p className="text-xs text-green-700">{user.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="px-3 py-1 text-xs bg-white hover:bg-gray-100 border border-green-300 text-green-700 font-medium rounded-lg transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>

                {/* Registration form */}
                {showForm && (
                  <div className="bg-orange-50 rounded-xl p-6 border border-orange-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      {isNewPlayer ? 'New Player Registration' : 'Complete Your Profile'}
                    </h3>
                    {!isNewPlayer && (
                      <div className="bg-blue-100 border border-blue-300 rounded-lg p-3 mb-4">
                        <p className="text-sm text-blue-800 mb-1">
                          <strong>🔒 Profile Update Rules</strong>
                        </p>
                        <p className="text-xs text-blue-700">
                          Fields with existing database values cannot be changed. You can only fill in missing information.
                        </p>
                      </div>
                    )}
                    {player?.previous_season_team && (
                      <div className="bg-blue-100 border border-blue-300 rounded-lg p-3 mb-4">
                        <p className="text-sm font-semibold text-blue-900 mb-1">Previous Season Info</p>
                        <p className="text-xs text-blue-800">Team: <strong>{player.previous_season_team}</strong></p>
                        {player.previous_season_category && (
                          <p className="text-xs text-blue-800">Category: <strong className="capitalize">{player.previous_season_category}</strong></p>
                        )}
                      </div>
                    )}
                    <p className="text-sm text-gray-600 mb-4">Please fill in all required information.</p>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          Full Name *
                          {player?.name && <span className="text-xs text-green-600 ml-2">(From Database)</span>}
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleFormChange}
                          readOnly={!isNewPlayer && player?.name}
                          className={`w-full px-4 py-2 border rounded-lg outline-none ${
                            !isNewPlayer && player?.name
                              ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                              : 'border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500'
                          }`}
                          placeholder="Enter your full name"
                        />
                        {!isNewPlayer && player?.name && (
                          <p className="text-xs text-gray-500 mt-1">This field cannot be changed as it exists in our database</p>
                        )}
                      </div>

                      <div className="relative">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          District (Kerala) *
                          {player?.place && <span className="text-xs text-green-600 ml-2">(From Database)</span>}
                        </label>
                        
                        {/* Custom Dropdown */}
                        <div className="relative" ref={dropdownRef}>
                          <div
                            className={`w-full px-4 py-3 border rounded-lg outline-none cursor-pointer transition-all duration-200 flex items-center justify-between ${
                              !isNewPlayer && player?.place
                                ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                                : 'border-gray-300 hover:border-orange-400 focus-within:ring-2 focus-within:ring-orange-500 focus-within:border-orange-500 bg-white'
                            }`}
                            onClick={() => {
                              if (!(!isNewPlayer && player?.place)) {
                                setShowDistrictDropdown(!showDistrictDropdown)
                                setDistrictSearch('')
                              }
                            }}
                          >
                            <div className="flex-1">
                              {formData.place ? (
                                <div className="flex items-center gap-3">
                                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                  </div>
                                  <span className="font-medium text-gray-900">{formData.place}</span>
                                  {!isNewPlayer && player?.place && (
                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">From Database</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-500 font-medium">Select your district</span>
                              )}
                            </div>
                            
                            {!(!isNewPlayer && player?.place) && (
                              <svg 
                                className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                                  showDistrictDropdown ? 'rotate-180' : 'rotate-0'
                                }`} 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                          </div>
                          
                          {/* Dropdown Menu */}
                          {showDistrictDropdown && !(!isNewPlayer && player?.place) && (
                            <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-hidden">
                              {/* Search Input */}
                              <div className="p-3 border-b border-gray-100">
                                <div className="relative">
                                  <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                  </svg>
                                  <input
                                    type="text"
                                    value={districtSearch}
                                    onChange={handleDistrictSearchChange}
                                    placeholder="Search districts..."
                                    className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                                    autoFocus
                                  />
                                </div>
                              </div>
                              
                              {/* Districts List */}
                              <div className="max-h-60 overflow-y-auto">
                                {filteredDistricts.length > 0 ? (
                                  filteredDistricts.map((district, index) => (
                                    <div
                                      key={district}
                                      onClick={() => handleDistrictSelect(district)}
                                      className={`px-4 py-3 cursor-pointer transition-colors flex items-center gap-3 ${
                                        formData.place === district 
                                          ? 'bg-orange-50 text-orange-900 border-l-4 border-orange-500' 
                                          : 'hover:bg-gray-50 text-gray-700'
                                      } ${
                                        index !== filteredDistricts.length - 1 ? 'border-b border-gray-100' : ''
                                      }`}
                                    >
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                        formData.place === district 
                                          ? 'bg-orange-100' 
                                          : 'bg-gray-100'
                                      }`}>
                                        <svg className={`w-4 h-4 ${
                                          formData.place === district 
                                            ? 'text-orange-600' 
                                            : 'text-gray-500'
                                        }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                      </div>
                                      <div className="flex-1">
                                        <span className="font-medium">{district}</span>
                                        <div className="text-xs text-gray-500 mt-0.5">Kerala</div>
                                      </div>
                                      {formData.place === district && (
                                        <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </div>
                                  ))
                                ) : (
                                  <div className="px-4 py-8 text-center text-gray-500">
                                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <p className="font-medium">No districts found</p>
                                    <p className="text-sm text-gray-400">Try adjusting your search</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {!isNewPlayer && player?.place && (
                          <p className="text-xs text-gray-500 mt-1">This field cannot be changed as it exists in our database</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          Date of Birth *
                          {player?.date_of_birth && <span className="text-xs text-green-600 ml-2">(From Database)</span>}
                        </label>
                        <input
                          type="date"
                          name="date_of_birth"
                          value={formData.date_of_birth}
                          onChange={handleFormChange}
                          readOnly={!isNewPlayer && player?.date_of_birth}
                          className={`w-full px-4 py-2 border rounded-lg outline-none ${
                            !isNewPlayer && player?.date_of_birth
                              ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                              : 'border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500'
                          }`}
                        />
                        {!isNewPlayer && player?.date_of_birth && (
                          <p className="text-xs text-gray-500 mt-1">This field cannot be changed as it exists in our database</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          Email *
                          {player?.email && <span className="text-xs text-green-600 ml-2">(From Database)</span>}
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleFormChange}
                          readOnly={!isNewPlayer && player?.email}
                          className={`w-full px-4 py-2 border rounded-lg outline-none ${
                            !isNewPlayer && player?.email
                              ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                              : 'border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500'
                          }`}
                          placeholder="Enter your email"
                        />
                        {!isNewPlayer && player?.email && (
                          <p className="text-xs text-gray-500 mt-1">This field cannot be changed as it exists in our database</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          Phone Number *
                          {player?.phone && <span className="text-xs text-green-600 ml-2">(From Database)</span>}
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleFormChange}
                          readOnly={!isNewPlayer && player?.phone}
                          className={`w-full px-4 py-2 border rounded-lg outline-none ${
                            !isNewPlayer && player?.phone
                              ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                              : 'border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500'
                          }`}
                          placeholder="Enter your phone number"
                        />
                        {!isNewPlayer && player?.phone && (
                          <p className="text-xs text-gray-500 mt-1">This field cannot be changed as it exists in our database</p>
                        )}
                      </div>
                    </div>

                    {/* 2-Season Contract Information */}
                    <div className="mt-4 bg-blue-50 border-2 border-blue-300 rounded-xl p-4">
                      <div className="flex items-start space-x-3">
                        <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-blue-900 mb-2">2-Season Contract</h4>
                          <p className="text-xs text-blue-800 mb-2">
                            By registering, you agree to a <strong>2-season contract</strong>. You will be automatically registered for:
                          </p>
                          <ul className="text-xs text-blue-800 space-y-1 ml-4">
                            <li className="flex items-center">
                              <span className="mr-2">✓</span>
                              <strong>{season?.name || 'Current Season'}</strong> (Current)
                            </li>
                            <li className="flex items-center">
                              <span className="mr-2">✓</span>
                              <strong>Season {(parseInt(season?.name?.replace(/\D/g, '') || '0') + 1)}</strong> (Next Season - Auto-registered)
                            </li>
                          </ul>
                          <p className="text-xs text-blue-700 mt-2 italic">
                            You commit to playing for 2 consecutive seasons
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={handleConfirm}
                      disabled={submitting}
                      className="w-full mt-4 py-3 px-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? 'Submitting...' : 'Complete Registration (2-Season Contract)'}
                    </button>
                  </div>
                )}

                {/* Show confirm button for existing player with complete details */}
                {player && !showForm && (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-300">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Player Profile</h3>
                    <div className="bg-white rounded-lg p-4 mb-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-semibold text-gray-700">Player ID:</span>
                        <span className="text-sm text-gray-900">{player.player_id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-semibold text-gray-700">Name:</span>
                        <span className="text-sm text-gray-900">{player.name}</span>
                      </div>
                      {player.place && (
                        <div className="flex justify-between">
                          <span className="text-sm font-semibold text-gray-700">District:</span>
                          <span className="text-sm text-gray-900">{player.place}</span>
                        </div>
                      )}
                      {player.previous_season_team && (
                        <>
                          <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                            <span className="text-sm font-semibold text-gray-700">Previous Team:</span>
                            <span className="text-sm text-gray-900">{player.previous_season_team}</span>
                          </div>
                          {player.previous_season_category && (
                            <div className="flex justify-between">
                              <span className="text-sm font-semibold text-gray-700">Previous Category:</span>
                              <span className="text-sm text-gray-900 capitalize">{player.previous_season_category}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    
                    {/* 2-Season Contract Information */}
                    <div className="mt-4 bg-blue-50 border-2 border-blue-300 rounded-xl p-4">
                      <div className="flex items-start space-x-3">
                        <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-blue-900 mb-2">2-Season Contract</h4>
                          <p className="text-xs text-blue-800 mb-2">
                            By registering, you agree to a <strong>2-season contract</strong>. You will be automatically registered for:
                          </p>
                          <ul className="text-xs text-blue-800 space-y-1 ml-4">
                            <li className="flex items-center">
                              <span className="mr-2">✓</span>
                              <strong>{season?.name || 'Current Season'}</strong> (Current)
                            </li>
                            <li className="flex items-center">
                              <span className="mr-2">✓</span>
                              <strong>Season {(parseInt(season?.name?.replace(/\D/g, '') || '0') + 1)}</strong> (Next Season - Auto-registered)
                            </li>
                          </ul>
                          <p className="text-xs text-blue-700 mt-2 italic">
                            You commit to playing for 2 consecutive seasons
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={handleConfirm}
                      disabled={submitting}
                      className="w-full py-3 px-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                    >
                      {submitting ? 'Registering...' : 'Confirm Registration (2-Season Contract)'}
                    </button>
                  </div>
                )}
              </>
            )}

            {success && (
              <div className="mt-4 p-4 rounded-xl bg-green-50 border border-green-200">
                <p className="text-green-600 text-sm">{success}</p>
              </div>
            )}
            
            {error && (
              <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <div className="mt-6">
              <button
                onClick={handleBack}
                disabled={submitting}
                className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                ← Back to Player Selection
              </button>
            </div>
          </div>

          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <p className="text-sm text-gray-600 text-center">
              Your information is securely managed by the committee
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PlayerVerify() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-[#0066FF]/5 via-white to-[#00D4FF]/5 flex items-center justify-center p-4">
          <div className="glass rounded-3xl p-8 shadow-lg border border-white/20 max-w-md w-full text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <PlayerVerifyContent />
    </Suspense>
  )
}
