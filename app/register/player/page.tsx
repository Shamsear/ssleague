'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { db, auth } from '@/lib/firebase/config'
import { collection, doc, getDoc, query, where, getDocs, orderBy, limit } from 'firebase/firestore'
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User } from 'firebase/auth'

interface Season {
  id: string
  name: string
  is_player_registration_open: boolean
}

interface Player {
  id: string
  player_id: string
  name: string
  status: string
  status_text: string
}

function PlayerSearchContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const seasonId = searchParams.get('season')

  const [season, setSeason] = useState<Season | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [signingIn, setSigningIn] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  // Check auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setAuthLoading(false)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const fetchSeason = async () => {
      if (!seasonId) {
        setError('No season specified')
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
        // Don't load players initially - only when user searches
        setLoading(false)
      } catch (err) {
        console.error('Error fetching season:', err)
        setError('Failed to load registration')
        setLoading(false)
      }
    }

    fetchSeason()
  }, [seasonId])

  // Check if email already used for this season
  useEffect(() => {
    const checkEmailUsage = async () => {
      if (!user?.email || !seasonId) return

      try {
        const emailCheckQuery = query(
          collection(db, 'realplayers'),
          where('season_id', '==', seasonId),
          where('email', '==', user.email),
          where('is_registered', '==', true)
        )
        const emailCheckSnapshot = await getDocs(emailCheckQuery)

        if (!emailCheckSnapshot.empty) {
          setError(`This email (${user.email}) has already been used to register for this season`)
          await signOut(auth)
        }
      } catch (err) {
        console.error('Error checking email:', err)
      }
    }

    checkEmailUsage()
  }, [user, seasonId])

  const searchPlayers = async (term: string) => {
    if (!seasonId) return

    // Only search if term has at least 2 characters
    if (term.trim().length < 2) {
      setPlayers([])
      return
    }

    setSearching(true)
    try {
      const realPlayersRef = collection(db, 'realplayers')
      const playersQuery = query(realPlayersRef, orderBy('player_id'), limit(50))

      const playersSnapshot = await getDocs(playersQuery)
      const allPlayers = playersSnapshot.docs.map(doc => ({
        id: doc.id,
        player_id: doc.data().player_id,
        name: doc.data().name,
        ...doc.data()
      }))

      // Filter in memory for partial matches
      const searchLower = term.toLowerCase()
      const filteredPlayers = allPlayers.filter(p => 
        p.player_id?.toLowerCase().includes(searchLower) ||
        p.name?.toLowerCase().includes(searchLower)
      )

      // Check registration status for each player
      const playersWithStatus = await Promise.all(
        filteredPlayers.map(async (player) => {
          // Check if player is registered for this season
          const realPlayerQuery = query(
            collection(db, 'realplayer'),
            where('player_id', '==', player.player_id),
            where('season_id', '==', seasonId)
          )
          const realPlayerSnapshot = await getDocs(realPlayerQuery)
          
          if (!realPlayerSnapshot.empty) {
            return {
              ...player,
              status: 'registered_current',
              status_text: 'Already Registered'
            }
          }

          // Check if registered for another season
          const otherSeasonQuery = query(
            collection(db, 'realplayer'),
            where('player_id', '==', player.player_id)
          )
          const otherSeasonSnapshot = await getDocs(otherSeasonQuery)
          
          if (!otherSeasonSnapshot.empty) {
            return {
              ...player,
              status: 'registered_other',
              status_text: 'Registered (Other Season)'
            }
          }

          return {
            ...player,
            status: 'available',
            status_text: 'Available'
          }
        })
      )

      setPlayers(playersWithStatus)
    } catch (err) {
      console.error('Error searching players:', err)
    } finally {
      setSearching(false)
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchTerm(value)
    
    // Debounce search
    const timer = setTimeout(() => {
      searchPlayers(value)
    }, 300)

    return () => clearTimeout(timer)
  }

  const handleSelectPlayer = (playerId: string) => {
    router.push(`/register/player/verify?season=${seasonId}&player=${playerId}`)
  }

  const handleGoogleSignIn = async () => {
    setSigningIn(true)
    setError(null)

    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
      setSuccess('✅ Signed in successfully!')
    } catch (err: any) {
      console.error('Sign in error:', err)
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in cancelled. Please try again.')
      } else if (err.code === 'auth/popup-blocked') {
        setError('Pop-up blocked. Please allow pop-ups and try again.')
      } else {
        setError('Failed to sign in with Google. Please try again.')
      }
    } finally {
      setSigningIn(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut(auth)
      setSuccess(null)
      setSearchTerm('')
      setPlayers([])
    } catch (err) {
      console.error('Sign out error:', err)
    }
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

  if (error) {
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
          <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Registration Unavailable</h2>
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
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="glass rounded-3xl p-6 shadow-lg border border-white/20 mb-6">
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 -mx-6 -mt-6 px-6 py-4 rounded-t-3xl mb-6">
            <h1 className="text-2xl font-bold text-white flex items-center">
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Player Registration
            </h1>
            {season && <p className="text-purple-100 text-sm mt-1">{season.name}</p>}
          </div>

          {/* Step 1: Google Sign-in */}
          {!user ? (
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Step 1: Sign in with Gmail
              </h3>
              
              <div className="bg-blue-100 border border-blue-300 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800 mb-2">
                  <strong>🔒 Secure Authentication Required</strong>
                </p>
                <p className="text-sm text-blue-700">
                  Sign in with your Gmail account to begin registration.
                </p>
              </div>
              
              <button
                onClick={handleGoogleSignIn}
                disabled={signingIn}
                className="w-full py-4 px-6 bg-white hover:bg-gray-50 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg"
              >
                {signingIn ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-3 border-gray-700 border-t-transparent"></div>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC04" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>Sign in with Google</span>
                  </>
                )}
              </button>
            </div>
          ) : (
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

              {/* Step 2: Find Your Player Profile */}
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center">
                  <span className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">2</span>
                  Find Your Player Profile
                </h2>
                <p className="text-gray-600">
                  Search using your unique Player ID (e.g., sspslpsl001) or your full name to find your player profile.
                </p>
              </div>
            </>
          )}

          {/* Search Input - Only show if user is signed in */}
          {user && (
            <div className="mb-6">
              <label htmlFor="search_term" className="block text-sm font-semibold text-gray-700 mb-2">
                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search for your Player Profile
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="search_term"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-colors"
                  placeholder="Start typing your Player ID (sspslpsl001) or Full Name"
                  autoComplete="off"
                />
                {searching && (
                  <div className="absolute right-3 top-3">
                    <svg className="w-6 h-6 text-purple-500 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
              </div>
              <div className="mt-2 text-sm text-gray-600">
                <p><strong>Player ID format:</strong> sspslpsl001, sspslpsl002, etc.</p>
                <p><strong>Name search:</strong> Enter your full name as registered</p>
              </div>
            </div>
          )}
        </div>

        {/* Search Results - Only show if user is signed in */}
        {user && (
          <div className="glass rounded-3xl shadow-lg border border-white/20 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-4 py-3">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Player Search Results
                <span className="ml-2 text-sm bg-white/20 px-2 py-1 rounded-full">{players.length} players</span>
              </h3>
            </div>
          
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Player ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {players.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <p className="text-lg font-medium">
                        {searchTerm.trim().length >= 2 ? 'No players found' : 'Start typing to search'}
                      </p>
                      <p className="text-sm">
                        {searchTerm.trim().length >= 2 ? 'Try adjusting your search terms' : 'Enter at least 2 characters to search for players'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  players.map((player) => {
                    const statusClass = 
                      player.status === 'registered_current' ? 'bg-blue-100 text-blue-800' :
                      player.status === 'registered_other' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    
                    const rowClass =
                      player.status === 'registered_current' ? 'hover:bg-blue-50' :
                      player.status === 'registered_other' ? 'hover:bg-yellow-50' :
                      'hover:bg-green-50 cursor-pointer'

                    return (
                      <tr key={player.id} className={`${rowClass} transition-colors`}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{player.player_id}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{player.name}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusClass}`}>
                            {player.status_text}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {player.status === 'available' ? (
                            <button
                              onClick={() => handleSelectPlayer(player.player_id)}
                              className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-3 py-1 rounded-lg transition-colors"
                            >
                              Select
                            </button>
                          ) : (
                            <span className="text-sm text-gray-500">
                              {player.status === 'registered_current' ? 'Already registered' : 'Unavailable'}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          </div>
        )}

        {/* Footer */}
        {user && (
          <div className="mt-6">
            <div className="glass rounded-2xl p-6 border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Can't find your profile?</h3>
                  <p className="text-sm text-gray-700 mb-4">
                    If you're a new player and don't have a Player ID yet, you can register as a new player.
                  </p>
                  <button
                    onClick={() => router.push(`/register/player/verify?season=${seasonId}`)}
                    className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Register as New Player
                  </button>
                  <p className="text-xs text-gray-600 mt-3 flex items-center">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Already have a Player ID? Search above to find your profile.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Success/Error Messages */}
        {success && (
          <div className="mt-4 p-4 rounded-xl bg-green-50 border border-green-200">
            <p className="text-green-600 text-sm text-center">{success}</p>
          </div>
        )}
        
        {error && (
          <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200">
            <p className="text-red-600 text-sm text-center">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PlayerSearch() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-[#0066FF]/5 via-white to-[#00D4FF]/5 flex items-center justify-center p-4">
        <div className="glass rounded-3xl p-8 shadow-lg border border-white/20 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <PlayerSearchContent />
    </Suspense>
  )
}
