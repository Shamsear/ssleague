'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { db, auth } from '@/lib/firebase/config'
import { collection, addDoc, doc, getDoc, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

interface Season {
  id: string
  name: string
  is_player_registration_open: boolean
}

interface Team {
  id: string
  team_name: string
  club_name: string
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

export default function PlayersRegistrationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const seasonId = searchParams.get('season')

  const [season, setSeason] = useState<Season | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [registeredPlayers, setRegisteredPlayers] = useState<RegisteredPlayer[]>([])
  const [masterPlayers, setMasterPlayers] = useState<MasterPlayer[]>([])
  const [filteredPlayers, setFilteredPlayers] = useState<MasterPlayer[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState<MasterPlayer | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)

  const [formData, setFormData] = useState({
    additional_info: ''
  })

  // Check authentication
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user)
      setAuthChecking(false)
      
      if (!user && seasonId) {
        // Redirect to login with return URL
        const returnUrl = encodeURIComponent(`/register/players?season=${seasonId}`)
        router.push(`/login?redirect=${returnUrl}`)
      }
    })

    return () => unsubscribe()
  }, [seasonId, router])

  // Fetch season, teams, and registered players
  useEffect(() => {
    const fetchData = async () => {
      if (!seasonId) {
        setError('No season specified')
        setLoading(false)
        return
      }

      if (!isAuthenticated) {
        setLoading(false)
        return
      }

      try {
        // Fetch season
        const seasonDoc = await getDoc(doc(db, 'seasons', seasonId))
        if (!seasonDoc.exists()) {
          setError('Season not found')
          setLoading(false)
          return
        }

        const seasonData = { id: seasonDoc.id, ...seasonDoc.data() } as Season
        setSeason(seasonData)

        // Fetch teams for this season
        const teamsQuery = query(
          collection(db, 'teams'),
          where('season_id', '==', seasonId),
          orderBy('team_name')
        )
        const teamsSnapshot = await getDocs(teamsQuery)
        const teamsData = teamsSnapshot.docs.map(doc => ({
          id: doc.id,
          team_name: doc.data().team_name,
          club_name: doc.data().club_name
        })) as Team[]
        setTeams(teamsData)

        // Fetch registered players for this season
        const playersQuery = query(
          collection(db, 'realplayer'),
          where('season_id', '==', seasonId),
          orderBy('registration_date', 'desc')
        )
        const playersSnapshot = await getDocs(playersQuery)
        
        // Enrich player data with team names
        const playersData = await Promise.all(
          playersSnapshot.docs.map(async (playerDoc) => {
            const data = playerDoc.data()
            let teamName = 'Unknown Team'
            
            if (data.team_id) {
              const team = teamsData.find(t => t.id === data.team_id)
              if (team) {
                teamName = team.team_name
              }
            }
            
            return {
              id: playerDoc.id,
              player_id: data.player_id,
              player_name: data.player_name,
              team_id: data.team_id,
              team_name: teamName,
              registration_date: data.registration_date || data.created_at,
              additional_info: data.additional_info
            }
          })
        )
        
        setRegisteredPlayers(playersData as RegisteredPlayer[])
        setLoading(false)
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('Failed to load registration page')
        setLoading(false)
      }
    }

    if (isAuthenticated) {
      fetchData()
    }
  }, [seasonId, isAuthenticated])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      // Validate required fields
      if (!formData.player_id || !formData.player_name || !formData.team_id) {
        setError('Please fill in all required fields')
        setSubmitting(false)
        return
      }

      // Check if player is already registered for this season
      const existingPlayerQuery = query(
        collection(db, 'realplayer'),
        where('season_id', '==', seasonId),
        where('player_id', '==', formData.player_id)
      )
      const existingPlayers = await getDocs(existingPlayerQuery)

      if (!existingPlayers.empty) {
        setError('This player is already registered for this season')
        setSubmitting(false)
        return
      }

      // Create player registration
      const newPlayer = await addDoc(collection(db, 'realplayer'), {
        season_id: seasonId,
        player_id: formData.player_id,
        player_name: formData.player_name,
        team_id: formData.team_id,
        additional_info: formData.additional_info,
        registration_date: Timestamp.now(),
        created_at: Timestamp.now(),
        updated_at: Timestamp.now()
      })

      // Get team name for display
      const selectedTeam = teams.find(t => t.id === formData.team_id)
      
      // Add to registered players list
      setRegisteredPlayers([
        {
          id: newPlayer.id,
          player_id: formData.player_id,
          player_name: formData.player_name,
          team_id: formData.team_id,
          team_name: selectedTeam?.team_name || 'Unknown Team',
          registration_date: Timestamp.now(),
          additional_info: formData.additional_info
        },
        ...registeredPlayers
      ])

      // Reset form
      setFormData({
        player_id: '',
        player_name: '',
        team_id: '',
        additional_info: ''
      })

      setSuccess('Player registered successfully!')
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000)
      
      setSubmitting(false)
    } catch (err) {
      console.error('Error registering player:', err)
      setError('Failed to register player. Please try again.')
      setSubmitting(false)
    }
  }

  if (authChecking || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0066FF]/5 via-white to-[#00D4FF]/5 flex items-center justify-center p-4">
        <div className="glass rounded-3xl p-8 shadow-lg border border-white/20 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto mb-4"></div>
          <p className="text-gray-600">{authChecking ? 'Checking authentication...' : 'Loading...'}</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect to login
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
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Player Registration</h1>
          <p className="text-gray-600">
            Register players for <span className="font-semibold text-[#0066FF]">{season?.name}</span>
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Registration Form */}
          <div className="glass rounded-3xl p-8 shadow-lg border border-white/20 h-fit">
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 -mx-8 -mt-8 px-8 py-4 rounded-t-3xl mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center">
                <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Register New Player
              </h2>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Player ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="player_id"
                    value={formData.player_id}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                    placeholder="e.g., sspslpsl001"
                  />
                  <p className="text-xs text-gray-500 mt-1">Unique player identifier</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Player Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="player_name"
                    value={formData.player_name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                    placeholder="Full name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Team <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="team_id"
                    value={formData.team_id}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                  >
                    <option value="">Select a team</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>
                        {team.team_name} ({team.club_name})
                      </option>
                    ))}
                  </select>
                  {teams.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">No teams registered yet. Please register teams first.</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Information
                  </label>
                  <textarea
                    name="additional_info"
                    value={formData.additional_info}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all resize-none"
                    placeholder="Any additional notes..."
                  />
                </div>
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
                  disabled={submitting || teams.length === 0}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 text-white font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Registering...' : 'Register Player'}
                </button>
              </div>
            </form>
          </div>

          {/* Registered Players List */}
          <div className="glass rounded-3xl shadow-lg border border-white/20 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
              <h2 className="text-2xl font-bold text-white flex items-center justify-between">
                <span className="flex items-center">
                  <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Registered Players
                </span>
                <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
                  {registeredPlayers.length} players
                </span>
              </h2>
            </div>

            <div className="max-h-[600px] overflow-y-auto">
              {registeredPlayers.length === 0 ? (
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
                    <div key={player.id} className="p-4 hover:bg-blue-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900">{player.player_name}</h3>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                              {player.player_id}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            {player.team_name}
                          </p>
                          {player.additional_info && (
                            <p className="text-xs text-gray-500 mt-1 italic">{player.additional_info}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">
                            {player.registration_date?.toDate().toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-white hover:shadow-md transition-all"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </button>
        </div>
      </div>
    </div>
  )
}
