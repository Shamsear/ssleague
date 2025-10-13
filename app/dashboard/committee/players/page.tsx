'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/firebase/config'
import { collection, getDocs } from 'firebase/firestore'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'

interface FootballPlayer {
  id: string
  player_id: string
  name: string
  position?: string
  position_group?: string
  overall_rating?: number
  team?: {
    id: string
    name: string
  }
  is_auction_eligible?: boolean
  nationality?: string
  age?: number
  club?: string
}

const PLAYERS_PER_PAGE = 50

export default function CommitteePlayersPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [players, setPlayers] = useState<FootballPlayer[]>([])
  const [filteredPlayers, setFilteredPlayers] = useState<FootballPlayer[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [positionFilter, setPositionFilter] = useState('')
  const [eligibilityFilter, setEligibilityFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [teamsCache, setTeamsCache] = useState<Map<string, { id: string; name: string }>>(new Map())
  const [initialLoad, setInitialLoad] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
    if (!authLoading && user && user.role !== 'committee_admin') {
      router.push('/dashboard')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    const fetchPlayers = async () => {
      setLoading(true)
      
      try {
        console.log('🔄 Fetching players from Neon and teams from Firestore')
        
        // Fetch teams from Firestore (keep) and players from Neon (new)
        const [teamsSnapshot, playersResponse] = await Promise.all([
          getDocs(collection(db, 'teams')),
          fetch('/api/players')
        ])
        
        const { data: playersData, success } = await playersResponse.json()
        if (!success) {
          throw new Error('Failed to fetch players')
        }
        
        console.log(`✅ Fetched ${playersData.length} players from Neon, ${teamsSnapshot.size} teams from Firestore`)
        
        // Build teams cache
        const teamsMap = new Map<string, { id: string; name: string }>()
        teamsSnapshot.docs.forEach(teamDoc => {
          teamsMap.set(teamDoc.id, {
            id: teamDoc.id,
            name: teamDoc.data().team_name || teamDoc.data().name
          })
        })
        setTeamsCache(teamsMap)
        
        // Map team data to players
        const playersWithTeams = playersData.map((player: any) => {
          let teamData = null
          if (player.team_id && teamsMap.has(player.team_id)) {
            teamData = teamsMap.get(player.team_id) || null
          }
          return {
            ...player,
            team: teamData
          }
        })
        
        setPlayers(playersWithTeams)
        setFilteredPlayers(playersWithTeams)
      } catch (err) {
        console.error('Error fetching players:', err)
        alert('Failed to load players. Please try again.')
      } finally {
        setLoading(false)
        setInitialLoad(false)
      }
    }

    if (user?.role === 'committee_admin') {
      fetchPlayers()
    }
  }, [user])

  useEffect(() => {
    let filtered = players

    // Filter by search term
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(p =>
        p.name?.toLowerCase().includes(searchLower) ||
        p.player_id?.toLowerCase().includes(searchLower) ||
        p.position?.toLowerCase().includes(searchLower)
      )
    }

    // Filter by position
    if (positionFilter) {
      filtered = filtered.filter(p => p.position === positionFilter)
    }

    // Filter by eligibility
    if (eligibilityFilter === 'eligible') {
      filtered = filtered.filter(p => p.is_auction_eligible)
    }

    setFilteredPlayers(filtered)
    setCurrentPage(1) // Reset to first page when filters change
  }, [searchTerm, positionFilter, eligibilityFilter, players])

  const handleDelete = async (playerId: string) => {
    if (!confirm('Are you sure you want to delete this player?')) return
    
    try {
      const response = await fetch(`/api/players/${playerId}`, {
        method: 'DELETE'
      })
      
      const { success } = await response.json()
      if (!success) {
        throw new Error('Failed to delete player')
      }
      
      setPlayers(players.filter(p => p.id !== playerId))
      alert('Player deleted successfully')
    } catch (err) {
      console.error('Error deleting player:', err)
      alert('Failed to delete player')
    }
  }

  // Memoized calculations for performance
  const positions = useMemo(() => 
    ['', ...new Set(players.map(p => p.position).filter(Boolean))],
    [players]
  )
  
  const totalPages = useMemo(() => 
    Math.ceil(filteredPlayers.length / PLAYERS_PER_PAGE),
    [filteredPlayers.length]
  )
  
  const paginatedPlayers = useMemo(() => {
    const startIndex = (currentPage - 1) * PLAYERS_PER_PAGE
    return filteredPlayers.slice(startIndex, startIndex + PLAYERS_PER_PAGE)
  }, [filteredPlayers, currentPage])

  const getRatingColor = (rating?: number) => {
    if (!rating) return 'bg-gray-100 text-gray-800'
    if (rating >= 85) return 'bg-green-100 text-green-800'
    if (rating >= 75) return 'bg-blue-100 text-blue-800'
    if (rating >= 65) return 'bg-yellow-100 text-yellow-800'
    return 'bg-gray-100 text-gray-800'
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Show loading skeleton on initial load
  if (initialLoad && loading) {
    return (
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
        <div className="glass rounded-3xl p-3 sm:p-6 mb-4 sm:mb-8">
          {/* Header Skeleton */}
          <div className="flex justify-between items-center mb-6">
            <div className="h-8 bg-gray-200 rounded-lg w-48 animate-pulse"></div>
            <div className="h-10 bg-gray-200 rounded-lg w-32 animate-pulse"></div>
          </div>
          
          {/* Search Skeleton */}
          <div className="mb-4">
            <div className="h-11 bg-gray-200 rounded-xl animate-pulse mb-3"></div>
            <div className="flex gap-2">
              <div className="h-11 bg-gray-200 rounded-xl flex-1 animate-pulse"></div>
              <div className="h-11 bg-gray-200 rounded-xl flex-1 animate-pulse"></div>
              <div className="h-11 bg-gray-200 rounded-xl w-24 animate-pulse"></div>
            </div>
          </div>

          {/* Stats Bar Skeleton */}
          <div className="mb-4 p-3 bg-white/50 rounded-xl">
            <div className="h-5 bg-gray-200 rounded w-64 animate-pulse"></div>
          </div>
          
          {/* Table Skeleton */}
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="bg-white/70 rounded-lg p-4 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="h-6 bg-gray-200 rounded flex-1"></div>
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                  <div className="h-6 bg-gray-200 rounded w-24"></div>
                  <div className="h-6 bg-gray-200 rounded w-20"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!user || user.role !== 'committee_admin') {
    return null
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
      <div className="glass rounded-3xl p-3 sm:p-6 mb-4 sm:mb-8">
        <div className="flex flex-col gap-4 mb-4 sm:mb-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center hidden sm:flex">
            <h2 className="text-xl font-bold gradient-text">
              {eligibilityFilter === 'eligible' ? 'Auction Eligible Players' : 'All Players'}
            </h2>
            <Link
              href="/dashboard/committee"
              className="px-4 py-2.5 text-sm glass rounded-xl hover:bg-white/90 transition-all duration-300 flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </Link>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col gap-3">
            <div className="relative w-full">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search players..."
                className="pl-10 w-full py-2.5 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all duration-200"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
                className="flex-1 py-2.5 px-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all duration-200"
              >
                <option value="">All Positions</option>
                {positions.filter(p => p).map(pos => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </select>

              <select
                value={eligibilityFilter}
                onChange={(e) => setEligibilityFilter(e.target.value)}
                className="flex-1 py-2.5 px-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all duration-200"
              >
                <option value="eligible">Eligible Players</option>
                <option value="all">All Players</option>
              </select>

              <button
                type="button"
                className="px-4 py-2.5 rounded-xl bg-primary text-white hover:bg-primary/90 transition-all duration-300"
              >
                Filter
              </button>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="mb-4 p-3 bg-white/50 rounded-xl">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              Showing <strong>{((currentPage - 1) * PLAYERS_PER_PAGE) + 1}</strong> to <strong>{Math.min(currentPage * PLAYERS_PER_PAGE, filteredPlayers.length)}</strong> of <strong>{filteredPlayers.length}</strong> players
            </span>
            {totalPages > 1 && (
              <span className="text-gray-500">Page {currentPage} of {totalPages}</span>
            )}
          </div>
        </div>

        {/* Mobile Cards (hidden on desktop) */}
        <div className="block sm:hidden">
          {loading && !initialLoad ? (
            <div className="grid gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white/70 border border-white/40 rounded-xl p-3 animate-pulse">
                  <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : paginatedPlayers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm">No players found</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {paginatedPlayers.map((player) => (
                <div key={player.id} className="bg-white/70 backdrop-blur-sm border border-white/40 rounded-xl p-3 transition-all duration-200 hover:bg-white/80 hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-800 text-sm truncate">{player.name}</h3>
                        {player.is_auction_eligible && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                            ✓
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-600">
                        <span className="font-medium">{player.position}</span>
                        {player.position_group && (
                          <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
                            {player.position_group}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${getRatingColor(player.overall_rating)}`}>
                          {player.overall_rating || '--'}
                        </span>
                      </div>
                      {player.team ? (
                        <div className="text-xs text-gray-500 mt-1 truncate">
                          Team: {player.team.name}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500 mt-1">Free Agent</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Link
                        href={`/dashboard/committee/players/${player.id}`}
                        className="p-2 rounded-lg bg-gray-100/80 text-gray-600 hover:bg-gray-200/80 hover:text-gray-800 transition-colors duration-200"
                        title="View Details"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(player.id)}
                        className="p-2 rounded-lg bg-red-50/80 text-red-600 hover:bg-red-100/80 hover:text-red-700 transition-colors duration-200"
                        title="Delete Player"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop Table (hidden on mobile) */}
        <div className="hidden sm:block overflow-x-auto rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white/10">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Player</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Position</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Overall</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden md:table-cell">Team</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white/30">
              {loading && !initialLoad ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0066FF]"></div>
                    </div>
                  </td>
                </tr>
              ) : paginatedPlayers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                    No players found
                  </td>
                </tr>
              ) : (
                paginatedPlayers.map((player) => (
                  <tr key={player.id} className="hover:bg-white/60 transition-colors">
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="text-sm font-medium text-gray-800">
                          {player.name}
                          {player.is_auction_eligible && (
                            <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Eligible
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-700">
                      {player.position}
                      {player.position_group && (
                        <span className="ml-2 px-2 py-0.5 rounded text-xs bg-primary/10 text-primary font-medium">
                          {player.position_group}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-md ${getRatingColor(player.overall_rating)}`}>
                        {player.overall_rating || '--'}
                      </span>
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-700 hidden md:table-cell">
                      {player.team ? player.team.name : <span className="text-gray-500">Free Agent</span>}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap text-sm">
                      <div className="flex space-x-1">
                        <Link
                          href={`/dashboard/committee/players/${player.id}`}
                          className="text-gray-600 hover:text-gray-800 font-medium transition-colors duration-200 flex items-center p-1"
                          title="View Details"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(player.id)}
                          className="text-red-600 hover:text-red-800 font-medium transition-colors duration-200 flex items-center p-1"
                          title="Delete Player"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              Showing <strong>{((currentPage - 1) * PLAYERS_PER_PAGE) + 1}</strong> to <strong>{Math.min(currentPage * PLAYERS_PER_PAGE, filteredPlayers.length)}</strong> of <strong>{filteredPlayers.length}</strong> players
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm bg-white/60 border border-gray-200 rounded-lg hover:bg-white/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                First
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm bg-white/60 border border-gray-200 rounded-lg hover:bg-white/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <div className="flex items-center gap-2">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                        currentPage === pageNum
                          ? 'bg-primary text-white font-medium'
                          : 'bg-white/60 border border-gray-200 hover:bg-white/80'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm bg-white/60 border border-gray-200 rounded-lg hover:bg-white/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm bg-white/60 border border-gray-200 rounded-lg hover:bg-white/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
