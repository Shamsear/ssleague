'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { db } from '@/lib/firebase/config'
import { collection, doc, getDoc, query, where, getDocs, orderBy, limit } from 'firebase/firestore'

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

export default function PlayerSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const seasonId = searchParams.get('season')

  const [season, setSeason] = useState<Season | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        // Load all players initially
        await searchPlayers('')
        setLoading(false)
      } catch (err) {
        console.error('Error fetching season:', err)
        setError('Failed to load registration')
        setLoading(false)
      }
    }

    fetchSeason()
  }, [seasonId])

  const searchPlayers = async (term: string) => {
    if (!seasonId) return

    setSearching(true)
    try {
      const realPlayersRef = collection(db, 'realplayers')
      let playersQuery

      if (term.trim().length >= 2) {
        // Search by player_id or name (case-insensitive partial match)
        const searchLower = term.toLowerCase()
        playersQuery = query(realPlayersRef, orderBy('player_id'), limit(50))
      } else {
        // Show all players
        playersQuery = query(realPlayersRef, orderBy('player_id'), limit(50))
      }

      const playersSnapshot = await getDocs(playersQuery)
      const allPlayers = playersSnapshot.docs.map(doc => ({
        id: doc.id,
        player_id: doc.data().player_id,
        name: doc.data().name,
        ...doc.data()
      }))

      // Filter in memory for partial matches
      let filteredPlayers = allPlayers
      if (term.trim().length >= 2) {
        const searchLower = term.toLowerCase()
        filteredPlayers = allPlayers.filter(p => 
          p.player_id?.toLowerCase().includes(searchLower) ||
          p.name?.toLowerCase().includes(searchLower)
        )
      }

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

  if (loading) {
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

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Find Your Player Profile</h2>
            <p className="text-gray-600">
              Search using your unique Player ID (e.g., sspslpsl001) or your full name to find your player profile.
            </p>
          </div>

          {/* Search Input */}
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
        </div>

        {/* Search Results */}
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
                        {searchTerm ? 'No players found' : 'Loading players...'}
                      </p>
                      <p className="text-sm">
                        {searchTerm ? 'Try adjusting your search terms' : 'Please wait'}
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

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 flex items-center justify-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Don't have your Player ID? Contact the committee admins for assistance.
          </p>
        </div>
      </div>
    </div>
  )
}
