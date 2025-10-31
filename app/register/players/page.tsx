'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { db } from '@/lib/firebase/config'
import { collection, doc, getDoc, getDocs, Timestamp, onSnapshot, query as firestoreQuery, where } from 'firebase/firestore'
import * as XLSX from 'xlsx'

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

  const parseNeonTimestampUTC = (s: string): number => {
    try {
      const date = new Date(s)
      if (isNaN(date.getTime())) return Date.now()
      return date.getTime() + (4 * 60 * 60 * 1000)
    } catch {
      return Date.now()
    }
  }

  const formatDateIST = (timestamp: Timestamp) => {
    return timestamp.toDate().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [stats, setStats] = useState<RegistrationStats | null>(null)
  const [newLimit, setNewLimit] = useState<number>(50)
  const [playerSearchQuery, setPlayerSearchQuery] = useState<string>('')
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([])
  const [actioningPlayer, setActioningPlayer] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'manage' | 'register' | 'phases' | 'registration'>('manage')
  const [totalMasterPlayers, setTotalMasterPlayers] = useState<number>(0)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [isTogglingRegistration, setIsTogglingRegistration] = useState(false)

  const fetchData = async () => {
    if (!seasonId) {
      setError('No season specified')
      return
    }

    try {
      const [seasonDoc, statsResponse, masterPlayersSnapshot, playersResponse] = await Promise.all([
        getDoc(doc(db, 'seasons', seasonId)),
        fetch(`/api/admin/registration-phases?season_id=${seasonId}`),
        getDocs(collection(db, 'realplayers')),
        fetch(`/api/stats/players?seasonId=${seasonId}&limit=1000`)
      ])

      if (!seasonDoc.exists()) {
        setError('Season not found')
        setLoading(false)
        return
      }

      const seasonData = { id: seasonDoc.id, ...seasonDoc.data() } as Season
      setSeason(seasonData)

      const statsResult = await statsResponse.json()
      if (statsResult.success) {
        setStats(statsResult.data)
        setNewLimit(statsResult.data.confirmed_slots_limit)
      }

      const masterPlayersData = masterPlayersSnapshot.docs.map(doc => ({
        id: doc.id,
        player_id: doc.data().player_id,
        name: doc.data().name
      })) as MasterPlayer[]
      setMasterPlayers(masterPlayersData)
      setTotalMasterPlayers(masterPlayersData.length)

      const playersResult = await playersResponse.json()
      const playersData = playersResult.success ? playersResult.data : []
      
      const mappedPlayers = playersData
        .filter((p: any) => p.registration_type)
        .map((player: any) => ({
          id: player.id,
          player_id: player.player_id,
          player_name: player.player_name,
          registration_date: player.registration_date
            ? new Timestamp(Math.floor(parseNeonTimestampUTC(player.registration_date) / 1000), 0)
            : Timestamp.now(),
          registration_type: player.registration_type || 'confirmed',
          additional_info: ''
        }))
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

  useEffect(() => {
    fetchData()
  }, [seasonId])

  // Set up real-time listener for stats updates
  useEffect(() => {
    if (!seasonId) return

    const unsubscribe = onSnapshot(
      doc(db, 'seasons', seasonId),
      (snapshot) => {
        if (snapshot.exists()) {
          const seasonData = { id: snapshot.id, ...snapshot.data() } as Season
          setSeason(seasonData)
        }
      },
      (error) => {
        console.error('Error listening to season updates:', error)
      }
    )

    return () => unsubscribe()
  }, [seasonId])

  // Set up real-time listener for registration stats
  useEffect(() => {
    if (!seasonId) return

    let intervalId: NodeJS.Timeout

    const fetchStats = async () => {
      try {
        const statsResponse = await fetch(`/api/admin/registration-phases?season_id=${seasonId}`)
        const statsResult = await statsResponse.json()
        if (statsResult.success) {
          setStats(statsResult.data)
        }
      } catch (err) {
        console.error('Error fetching stats:', err)
      }
    }

    // Fetch immediately
    fetchStats()

    // Then fetch every 3 seconds for real-time updates
    intervalId = setInterval(fetchStats, 3000)

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [seasonId])

  // Set up real-time listener for registered players
  useEffect(() => {
    if (!seasonId) return

    let intervalId: NodeJS.Timeout

    const fetchPlayers = async () => {
      try {
        const playersResponse = await fetch(`/api/stats/players?seasonId=${seasonId}&limit=1000`)
        const playersResult = await playersResponse.json()
        const playersData = playersResult.success ? playersResult.data : []
        
        const mappedPlayers = playersData
          .filter((p: any) => p.registration_type)
          .map((player: any) => ({
            id: player.id,
            player_id: player.player_id,
            player_name: player.player_name,
            registration_date: player.registration_date
              ? new Timestamp(Math.floor(parseNeonTimestampUTC(player.registration_date) / 1000), 0)
              : Timestamp.now(),
            registration_type: player.registration_type || 'confirmed',
            additional_info: ''
          }))
          .sort((a: RegisteredPlayer, b: RegisteredPlayer) => 
            a.registration_date.toMillis() - b.registration_date.toMillis()
          )
        
        setRegisteredPlayers(mappedPlayers as RegisteredPlayer[])
      } catch (err) {
        console.error('Error fetching players:', err)
      }
    }

    // Fetch immediately
    fetchPlayers()

    // Then fetch every 3 seconds for real-time updates
    intervalId = setInterval(fetchPlayers, 3000)

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [seasonId])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchTerm(value)
    setShowDropdown(true)

    if (value.trim().length >= 2) {
      const searchLower = value.toLowerCase()
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
    const isAlreadySelected = selectedPlayers.some(p => p.player_id === player.player_id)
    if (!isAlreadySelected) {
      setSelectedPlayers([...selectedPlayers, player])
    }
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
        await fetchData()
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
        await fetchData()
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

    if (!confirm('Are you sure you want to remove this player registration? This will cancel the entire 2-season contract for both the current and next season and remove all related data.')) {
      return
    }

    setActioningPlayer(playerId)

    try {
      const currentRegistrationId = `${playerId}_${seasonId}`
      
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

      const deletedPlayer = registeredPlayers.find(p => p.id === currentRegistrationId)
      const wasConfirmed = deletedPlayer?.registration_type === 'confirmed'

      setRegisteredPlayers(registeredPlayers.filter(p => p.id !== currentRegistrationId))
      
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
      
      setSuccess('Player contract cancelled successfully!')
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
        await fetchData()
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

  const filteredRegisteredPlayers = registeredPlayers.filter(player => 
    player.player_name?.toLowerCase().includes(playerSearchQuery.toLowerCase()) ||
    player.player_id?.toLowerCase().includes(playerSearchQuery.toLowerCase())
  )

  const handleExportToExcel = async () => {
    try {
      // Fetch additional player details from Firebase realplayers collection
      const playerIds = filteredRegisteredPlayers.map(p => p.player_id)
      
      // Fetch player details in batches (Firestore 'in' query limit is 30)
      const playerDetailsMap = new Map()
      
      for (let i = 0; i < playerIds.length; i += 30) {
        const batch = playerIds.slice(i, i + 30)
        const playersQuery = firestoreQuery(
          collection(db, 'realplayers'),
          where('player_id', 'in', batch)
        )
        const playersSnapshot = await getDocs(playersQuery)
        playersSnapshot.docs.forEach(doc => {
          const data = doc.data()
          playerDetailsMap.set(data.player_id, {
            email: data.email || '',
            phone: data.phone || ''
          })
        })
      }

      // Prepare data for export
      const exportData = filteredRegisteredPlayers.map((player, index) => {
        const details = playerDetailsMap.get(player.player_id) || { email: '', phone: '' }
        return {
          '#': index + 1,
          'Name': player.player_name || 'Unknown',
          'Player ID': player.player_id,
          'Status': player.registration_type === 'confirmed' ? 'Confirmed' : 'Waitlist',
          'Registration Date': formatDateIST(player.registration_date),
          'Email': details.email,
          'Phone Number': details.phone
        }
      })

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(exportData)
      
      // Set column widths
      ws['!cols'] = [
        { wch: 5 },  // #
        { wch: 25 }, // Name
        { wch: 15 }, // Player ID
        { wch: 12 }, // Status
        { wch: 20 }, // Registration Date
        { wch: 30 }, // Email
        { wch: 15 }  // Phone Number
      ]

      // Create workbook
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Registered Players')

      // Generate filename with season and timestamp
      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `registered_players_${season?.name || seasonId}_${timestamp}.xlsx`

      // Download file
      XLSX.writeFile(wb, filename)
      
      setSuccess(`Exported ${exportData.length} players to Excel!`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (error) {
      console.error('Error exporting to Excel:', error)
      setError('Failed to export to Excel')
      setTimeout(() => setError(null), 3000)
    }
  }

  const togglePlayerRegistration = async () => {
    if (!seasonId || isTogglingRegistration) return

    const confirmMessage = season?.is_player_registration_open
      ? `Close player registration for ${season?.name}?`
      : `Open player registration for ${season?.name}?`
    
    if (!confirm(confirmMessage)) return

    try {
      setIsTogglingRegistration(true)
      setError(null)
      setSuccess(null)
      
      const response = await fetch(`/api/admin/seasons/${seasonId}/toggle-player-registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const result = await response.json()

      if (result.success && season) {
        setSeason({
          ...season,
          is_player_registration_open: result.season.is_player_registration_open
        })
        setSuccess(result.message)
      } else {
        setError(result.error || 'Failed to toggle registration')
      }
    } catch (error) {
      console.error('Error toggling player registration:', error)
      setError('Failed to toggle player registration')
    } finally {
      setIsTogglingRegistration(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    }).catch(() => {
      setError('Failed to copy link')
      setTimeout(() => setError(null), 3000)
    })
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

      for (const player of selectedPlayers) {
        try {
          const registrationResponse = await fetch('/api/register/player/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              player_id: player.player_id,
              season_id: seasonId,
              user_email: '',
              user_uid: '',
              is_admin_registration: true,
              player_data: {
                name: player.name
              }
            })
          })
          
          const registrationResult = await registrationResponse.json()
          
          if (!registrationResponse.ok) {
            if (registrationResult.error?.includes('already registered')) {
              skipCount++
              continue
            }
            throw new Error(registrationResult.error || 'Registration failed')
          }
          
          const registrationId = `${player.player_id}_${seasonId}`
          
          setRegisteredPlayers(prev => [
            {
              id: registrationId,
              player_id: player.player_id,
              player_name: player.name,
              registration_date: Timestamp.now(),
              registration_type: 'confirmed'
            },
            ...prev
          ])

          successCount++
        } catch (err) {
          console.error(`Error registering player ${player.player_id}:`, err)
          errors.push(`${player.name} (${player.player_id})`)
        }
      }

      setSelectedPlayers([])
      setSearchTerm('')

      if (successCount > 0 && stats) {
        setStats({
          ...stats,
          confirmed_registrations: stats.confirmed_registrations + successCount,
          total_registrations: stats.total_registrations + successCount,
        })
      }

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading registration data...</p>
        </div>
      </div>
    )
  }

  if (error && !season) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 shadow-xl max-w-md w-full">
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
            className="w-full py-3 px-4 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            Return Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Top Navigation Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/dashboard/committee')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Back to Dashboard"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">Player Registration</h1>
                <p className="text-xs sm:text-sm text-blue-600 font-medium">{season?.name}</p>
              </div>
            </div>
            
            <div className="hidden md:flex items-center gap-2">
              <div className="px-3 py-1.5 bg-blue-50 rounded-lg">
                <span className="text-xs font-medium text-blue-700 mr-1">Total:</span>
                <span className="text-xs font-bold text-blue-900">{registeredPlayers.length}</span>
              </div>
              <div className="px-3 py-1.5 bg-gray-50 rounded-lg">
                <span className="text-xs font-medium text-gray-700 mr-1">Available:</span>
                <span className="text-xs font-bold text-gray-900">{totalMasterPlayers - registeredPlayers.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Stats Bar */}
      {stats && (
        <div className="md:hidden bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-around">
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">Confirmed</div>
              <div className="text-lg font-bold text-green-600">{stats.confirmed_registrations}/{stats.confirmed_slots_limit}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">Waitlist</div>
              <div className="text-lg font-bold text-amber-600">{stats.unconfirmed_registrations}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">Total</div>
              <div className="text-lg font-bold text-blue-600">{stats.total_registrations}</div>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      {(error || success) && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
          {success && (
            <div className="bg-green-50 border-l-4 border-green-500 rounded-lg p-4 mb-4">
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Desktop: Tab Navigation */}
        <div className="hidden lg:flex items-center gap-2 mb-6">
          <button
            onClick={() => setActiveTab('registration')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'registration'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Registration
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'manage'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Manage Players
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'register'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Quick Register
          </button>
          <button
            onClick={() => setActiveTab('phases')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'phases'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Phase Control
          </button>
        </div>

        {/* Mobile: Dropdown Navigation */}
        <div className="lg:hidden mb-4">
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as any)}
            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="registration">Registration</option>
            <option value="manage">Manage Players</option>
            <option value="register">Quick Register</option>
            <option value="phases">Phase Control</option>
          </select>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Registration Tab */}
          {activeTab === 'registration' && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Total Players</p>
                      <p className="text-3xl font-bold text-gray-900">{totalMasterPlayers}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Registered</p>
                      <p className="text-3xl font-bold text-green-600">{stats?.total_registrations || 0}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Available</p>
                      <p className="text-3xl font-bold text-amber-600">
                        {totalMasterPlayers - (stats?.total_registrations || 0)}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Registration Control */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-semibold text-gray-700">Registration Status:</span>
                    {season?.is_player_registration_open ? (
                      <span className="inline-flex items-center px-3 py-1 text-sm font-bold rounded-full bg-green-100 text-green-800 border border-green-200">
                        <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
                        </svg>
                        OPEN
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 text-sm font-bold rounded-full bg-red-100 text-red-800 border border-red-200">
                        <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                        </svg>
                        CLOSED
                      </span>
                    )}
                  </div>
                  
                  <button
                    onClick={togglePlayerRegistration}
                    disabled={isTogglingRegistration}
                    className={`inline-flex items-center px-4 py-2 text-sm font-semibold rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                      season?.is_player_registration_open
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : 'bg-green-500 hover:bg-green-600 text-white'
                    }`}
                  >
                    {isTogglingRegistration ? (
                      <>
                        <svg className="animate-spin w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : season?.is_player_registration_open ? (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Close Registration
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Open Registration
                      </>
                    )}
                  </button>
                </div>

                {season?.is_player_registration_open ? (
                  <div>
                    <div className="mb-4 p-4 bg-green-50 rounded-xl border border-green-200">
                      <p className="text-sm text-green-800 flex items-start">
                        <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span><strong>Registration Link Active:</strong> Share the link below with players to register for {season?.name}.</span>
                      </p>
                      {stats?.registration_phase === 'paused' && (
                        <p className="text-sm text-amber-700 flex items-start mt-2">
                          <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span><strong>Note:</strong> Registration is paused. Players can access the link but cannot register until Phase 2 is enabled or slots are increased.</span>
                        </p>
                      )}
                    </div>
                    
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Registration Link</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/register/player?season=${seasonId}`}
                        readOnly
                        onClick={(e) => e.currentTarget.select()}
                        className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-mono text-gray-700"
                      />
                      <button
                        onClick={() => copyToClipboard(`${typeof window !== 'undefined' ? window.location.origin : ''}/register/player?season=${seasonId}`)}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all shadow-md hover:shadow-lg flex items-center justify-center"
                      >
                        <svg className="w-4 h-4 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span className="hidden sm:inline">{copiedUrl ? 'Copied!' : 'Copy Link'}</span>
                        <span className="sm:hidden">{copiedUrl ? '✓' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                    <p className="text-sm text-red-800 flex items-start">
                      <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span><strong>Registration Closed:</strong> Players cannot register at this time. Click "Open Registration" to allow new player registrations.</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Info Section */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Registration Information
                </h3>
                <div className="space-y-3 text-sm text-gray-600">
                  <p>
                    <strong className="text-gray-800">Season-Specific Link:</strong> The registration link is tied directly to {season?.name}. Players will automatically register for this season.
                  </p>
                  <p>
                    <strong className="text-gray-800">Process:</strong> Players will complete registration and receive a 2-season contract for {season?.name} and the following season.
                  </p>
                  <p>
                    <strong className="text-gray-800">Control:</strong> You can open or close registration at any time using the toggle above.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Manage Players Tab */}
          {activeTab === 'manage' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 sm:px-6 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h2 className="text-xl font-bold text-white">Registered Players ({registeredPlayers.length})</h2>
                  
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="Search..."
                      value={playerSearchQuery}
                      onChange={(e) => setPlayerSearchQuery(e.target.value)}
                      className="px-3 py-2 rounded-lg text-sm bg-white/90 placeholder-gray-500 focus:ring-2 focus:ring-white/30"
                    />
                    
                    <button
                      onClick={handleExportToExcel}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export
                    </button>
                    
                    {selectedPlayerIds.length > 0 && (
                      <button
                        onClick={handleBulkDelete}
                        disabled={submitting}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                      >
                        Delete ({selectedPlayerIds.length})
                      </button>
                    )}
                  </div>
                </div>
                
                <p className="text-blue-100 text-sm mt-2">
                  Showing {filteredRegisteredPlayers.length} of {registeredPlayers.length} players
                </p>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                {filteredRegisteredPlayers.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-600 font-medium">
                      {playerSearchQuery ? 'No players found' : 'No players registered yet'}
                    </p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={selectedPlayerIds.length === filteredRegisteredPlayers.length && filteredRegisteredPlayers.length > 0}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">#</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase hidden sm:table-cell">ID</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">Date</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredRegisteredPlayers.map((player, index) => {
                        const isActioning = actioningPlayer === player.player_id
                        return (
                          <tr key={player.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedPlayerIds.includes(player.player_id)}
                                onChange={() => togglePlayerSelection(player.player_id)}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                            <td className="px-4 py-3 font-medium text-gray-900">{player.player_name || 'Unknown'}</td>
                            <td className="px-4 py-3 text-sm text-gray-600 font-mono hidden sm:table-cell">{player.player_id}</td>
                            <td className="px-4 py-3">
                              {player.registration_type === 'confirmed' ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Confirmed
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                  Waitlist
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">
                              {formatDateIST(player.registration_date)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handlePromoteDemote(player.player_id, player.player_name || 'Unknown', player.registration_type)}
                                  disabled={isActioning}
                                  className="px-2 py-1 text-xs font-medium rounded transition-colors disabled:opacity-50"
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
                                  className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                )}
              </div>
            </div>
          )}

          {/* Quick Register Tab */}
          {activeTab === 'register' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Quick Player Registration</h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search Player <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={handleSearchChange}
                    onFocus={() => setShowDropdown(true)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Search by player ID or name..."
                  />
                  <p className="text-xs text-gray-500 mt-1">Type at least 2 characters to search</p>
                  
                  {showDropdown && filteredPlayers.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
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
                                : 'hover:bg-blue-50 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-gray-900">{player.name}</div>
                                <div className="text-sm text-gray-500">{player.player_id}</div>
                              </div>
                              {isRegistered && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                                  Registered
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

                {selectedPlayers.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Selected Players ({selectedPlayers.length}):
                    </p>
                    <div className="space-y-2">
                      {selectedPlayers.map((player) => (
                        <div key={player.player_id} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                          <div>
                            <div className="font-medium text-gray-900">{player.name}</div>
                            <div className="text-sm text-gray-600">ID: {player.player_id}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemovePlayer(player.player_id)}
                            className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || selectedPlayers.length === 0}
                  className="w-full py-3 px-4 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Registering...' : `Register ${selectedPlayers.length > 0 ? `${selectedPlayers.length} Player${selectedPlayers.length > 1 ? 's' : ''}` : 'Players'}`}
                </button>
              </form>
            </div>
          )}

          {/* Phase Control Tab */}
          {activeTab === 'phases' && stats && (
            <div className="space-y-6">
              {/* Current Phase */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Current Phase</h3>
                <div className="flex items-center gap-3">
                  {stats.registration_phase === 'confirmed' && (
                    <span className="px-4 py-2 bg-green-500 text-white rounded-lg font-medium">
                      ✨ Phase 1: Confirmed
                    </span>
                  )}
                  {stats.registration_phase === 'paused' && (
                    <span className="px-4 py-2 bg-gray-500 text-white rounded-lg font-medium">
                      ⏸️ Paused
                    </span>
                  )}
                  {stats.registration_phase === 'unconfirmed' && (
                    <span className="px-4 py-2 bg-amber-500 text-white rounded-lg font-medium">
                      ⚠️ Phase 2: Waitlist
                    </span>
                  )}
                  {stats.registration_phase === 'closed' && (
                    <span className="px-4 py-2 bg-red-500 text-white rounded-lg font-medium">
                      🔒 Closed
                    </span>
                  )}
                </div>
              </div>

              {/* Slot Management */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Confirmed Slots Limit</h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="number"
                    value={newLimit}
                    onChange={(e) => setNewLimit(parseInt(e.target.value) || 0)}
                    min="0"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={() => handlePhaseAction('set_confirmed_slots', newLimit)}
                    disabled={submitting}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    Update Limit
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Auto-promotes earliest unconfirmed players when increased
                </p>
              </div>

              {/* Phase Actions */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Phase Actions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => handlePhaseAction('enable_phase2')}
                    disabled={submitting || stats.registration_phase === 'unconfirmed'}
                    className="px-4 py-3 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Enable Phase 2
                  </button>
                  
                  <button
                    onClick={() => handlePhaseAction('pause_registration')}
                    disabled={submitting || stats.registration_phase === 'paused'}
                    className="px-4 py-3 bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Pause
                  </button>
                  
                  <button
                    onClick={() => handlePhaseAction('reopen_confirmed')}
                    disabled={submitting || stats.registration_phase === 'confirmed'}
                    className="px-4 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Reopen Phase 1
                  </button>
                  
                  <button
                    onClick={() => handlePhaseAction('close_registration')}
                    disabled={submitting || stats.registration_phase === 'closed'}
                    className="px-4 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Close Registration
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PlayersRegistrationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <PlayersRegistrationPageContent />
    </Suspense>
  );
}
