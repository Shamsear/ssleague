'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'

interface Player {
  name: string
  position: string
  overall_rating: number
  team_name?: string
  is_auction_eligible: boolean
  [key: string]: any
}

const ITEMS_PER_PAGE = 50 // Show 50 players per page

export default function ImportPreviewPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [positionFilter, setPositionFilter] = useState('')
  const [showSummary, setShowSummary] = useState(true)
  const [showDebug, setShowDebug] = useState(false)
  const [availableColumns, setAvailableColumns] = useState<string[]>([])

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
    if (!authLoading && user && user.role !== 'committee_admin') {
      router.push('/dashboard')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    // Load parsed players from sessionStorage
    const parsedData = sessionStorage.getItem('parsedPlayers')
    if (parsedData) {
      try {
        setLoading(true)
        const data = JSON.parse(parsedData)
        
        // Map SQLite columns to expected format
        const mappedPlayers = data.map((player: any) => {
          // Console log first player to debug column names
          if (data.indexOf(player) === 0) {
            console.log('First player raw data:', player)
            console.log('Available columns:', Object.keys(player))
            setAvailableColumns(Object.keys(player))
          }
          
          return {
            name: player.name || player.player_name || player.full_name || player.Name || '',
            position: player.position || player.pos || player.Position || 'CF',
            overall_rating: player.overall_rating || player.rating || player.ovr || player.Overall || player.overall || 75,
            team_name: player.team_name || player.team || player.club || player.current_club || player.Team || '',
            is_auction_eligible: player.is_auction_eligible !== undefined ? player.is_auction_eligible : true,
            // Preserve all original fields
            ...player
          }
        })
        
        setPlayers(mappedPlayers)
        setLoading(false)
      } catch (err) {
        console.error('Error loading parsed data:', err)
        router.push('/dashboard/committee/database')
      }
    } else {
      router.push('/dashboard/committee/database')
    }
  }, [router])

  // Filter and search players
  const filteredPlayers = useMemo(() => {
    let filtered = players

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(player => 
        player.name?.toLowerCase().includes(term) ||
        player.team_name?.toLowerCase().includes(term)
      )
    }

    // Apply position filter
    if (positionFilter) {
      filtered = filtered.filter(player => player.position === positionFilter)
    }

    return filtered
  }, [players, searchTerm, positionFilter])

  // Paginate filtered players
  const totalPages = Math.ceil(filteredPlayers.length / ITEMS_PER_PAGE)
  const paginatedPlayers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    return filteredPlayers.slice(startIndex, endIndex)
  }, [filteredPlayers, currentPage])

  // Get unique positions
  const uniquePositions = useMemo(() => {
    const positions = new Set(players.map(p => p.position).filter(Boolean))
    return Array.from(positions).sort()
  }, [players])

  // Calculate statistics
  const stats = useMemo(() => {
    const positionCounts: { [key: string]: number } = {}
    players.forEach(player => {
      const pos = player.position || 'Unknown'
      positionCounts[pos] = (positionCounts[pos] || 0) + 1
    })
    return {
      total: players.length,
      byPosition: positionCounts,
      eligible: players.filter(p => p.is_auction_eligible).length
    }
  }, [players])

  const handleCellChange = (index: number, field: string, value: any) => {
    // Use the actual index in the full players array
    const actualIndex = (currentPage - 1) * ITEMS_PER_PAGE + index
    const updatedPlayers = [...players]
    updatedPlayers[actualIndex][field] = value
    setPlayers(updatedPlayers)
    validateCell(actualIndex, field, value)
  }

  const validateCell = (index: number, field: string, value: any) => {
    const key = `${index}-${field}`
    const errors = new Set(validationErrors)

    // Required fields
    if (['name', 'position', 'overall_rating'].includes(field)) {
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        errors.add(key)
      } else {
        errors.delete(key)
      }
    }

    // Rating validation
    if (field === 'overall_rating') {
      const rating = parseInt(value)
      if (isNaN(rating) || rating < 1 || rating > 99) {
        errors.add(key)
      } else {
        errors.delete(key)
      }
    }

    setValidationErrors(errors)
  }

  const handleRemovePlayer = (index: number) => {
    if (confirm('Remove this player from the import?')) {
      const actualIndex = (currentPage - 1) * ITEMS_PER_PAGE + index
      const updatedPlayers = players.filter((_, i) => i !== actualIndex)
      setPlayers(updatedPlayers)
      
      // Adjust current page if necessary
      if (paginatedPlayers.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1)
      }
    }
  }

  const handleValidateAll = () => {
    setLoading(true)
    const errors = new Set<string>()
    
    // Use setTimeout to prevent UI freeze
    setTimeout(() => {
      players.forEach((player, index) => {
        if (!player.name || player.name.trim() === '') {
          errors.add(`${index}-name`)
        }
        if (!player.position || player.position.trim() === '') {
          errors.add(`${index}-position`)
        }
        const rating = parseInt(player.overall_rating as any)
        if (isNaN(rating) || rating < 1 || rating > 99) {
          errors.add(`${index}-overall_rating`)
        }
      })
      setValidationErrors(errors)
      setLoading(false)
      
      if (errors.size > 0) {
        alert(`Found ${errors.size} validation error(s). Please review and fix them.`)
      } else {
        alert('All data validated successfully!')
      }
    }, 100)
    
    return errors.size === 0
  }

  const handleStartImport = () => {
    if (validationErrors.size > 0) {
      alert('Please fix all validation errors before importing.')
      return
    }

    if (!handleValidateAll()) {
      alert('Please fix all validation errors before importing.')
      return
    }

    // Store validated data
    sessionStorage.setItem('validatedPlayers', JSON.stringify(players))
    
    // Navigate to progress page
    router.push('/dashboard/committee/database/import-progress')
  }

  const positions = ['GK', 'CB', 'LB', 'RB', 'DMF', 'CMF', 'LMF', 'RMF', 'AMF', 'CF', 'LWF', 'RWF', 'SS']

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (user.role !== 'committee_admin' || players.length === 0) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-4 sm:py-8 max-w-screen-xl">
      {/* Page Header */}
      <div className="glass rounded-3xl p-6 mb-8 shadow-lg backdrop-blur-md border border-white/20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">👥 Player Import Preview</h1>
            <p className="text-gray-600 text-sm md:text-base">Review and edit players before importing to database</p>
          </div>
          <div className="flex items-center">
            <Link
              href="/dashboard/committee/database"
              className="inline-flex items-center px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Database
            </Link>
          </div>
        </div>
      </div>

      {/* Debug Panel */}
      {availableColumns.length > 0 && (
        <div className="glass rounded-3xl p-6 mb-6 shadow-lg backdrop-blur-md border border-yellow-300/50 bg-yellow-50/30">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-yellow-800 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Database Column Debug Info
            </h3>
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="text-sm text-yellow-700 hover:underline"
            >
              {showDebug ? 'Hide' : 'Show'} Debug Info
            </button>
          </div>
          
          {showDebug && (
            <div>
              <p className="text-sm text-gray-700 mb-2">The following columns were detected in your SQLite database:</p>
              <div className="bg-white/50 rounded-lg p-4 border border-yellow-200">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {availableColumns.map(col => (
                    <div key={col} className="text-xs font-mono bg-gray-100 px-2 py-1 rounded border border-gray-300">
                      {col}
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-3">
                ℹ️ If player names or other data are not showing, the column names in your database may not match the expected format.
                Common name columns: <code className="bg-gray-200 px-1 rounded">name</code>, <code className="bg-gray-200 px-1 rounded">player_name</code>, <code className="bg-gray-200 px-1 rounded">full_name</code>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Import Summary */}
      <div className="glass rounded-3xl p-6 mb-8 shadow-lg backdrop-blur-md border border-white/20">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Import Summary</h3>
          <button
            onClick={() => setShowSummary(!showSummary)}
            className="text-sm text-primary hover:underline"
          >
            {showSummary ? 'Hide' : 'Show'} Details
          </button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center p-3 bg-green-50/50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{stats.total}</div>
            <div className="text-xs text-gray-600">Total Players</div>
          </div>
          <div className="text-center p-3 bg-blue-50/50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{validationErrors.size}</div>
            <div className="text-xs text-gray-600">Validation Errors</div>
          </div>
          <div className="text-center p-3 bg-purple-50/50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{stats.eligible}</div>
            <div className="text-xs text-gray-600">Auction Eligible</div>
          </div>
          <div className="text-center p-3 bg-orange-50/50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{filteredPlayers.length}</div>
            <div className="text-xs text-gray-600">Filtered Results</div>
          </div>
        </div>

        {showSummary && Object.keys(stats.byPosition).length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
            {Object.entries(stats.byPosition).sort(([a], [b]) => a.localeCompare(b)).map(([position, count]) => (
              <div key={position} className="text-center p-2 bg-white/50 rounded-lg border border-gray-200">
                <div className="text-sm font-bold text-gray-800">{position}</div>
                <div className="text-xs text-gray-600">{count}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Validation Status */}
      <div className={`glass rounded-3xl p-4 mb-6 shadow-lg backdrop-blur-md border border-white/20 ${
        validationErrors.size > 0 ? 'bg-red-50/30' : 'bg-green-50/30'
      }`}>
        <div className="flex items-center">
          <svg className={`w-5 h-5 mr-2 ${validationErrors.size > 0 ? 'text-red-600' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={validationErrors.size > 0 ? "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"} />
          </svg>
          <span className={`text-sm ${validationErrors.size > 0 ? 'text-red-800' : 'text-green-800'}`}>
            {validationErrors.size > 0 
              ? `${validationErrors.size} validation error(s) found. Please fix them before importing.`
              : 'All data validated successfully. Ready to import!'}
          </span>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="glass rounded-3xl p-6 mb-6 shadow-lg backdrop-blur-md border border-white/20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search Players</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="Search by name or team..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Position</label>
            <select
              value={positionFilter}
              onChange={(e) => {
                setPositionFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">All Positions</option>
              {uniquePositions.map(pos => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Results</label>
            <div className="px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
              <span className="text-sm font-medium text-blue-900">
                Showing {paginatedPlayers.length} of {filteredPlayers.length} players
              </span>
            </div>
          </div>
        </div>
        {(searchTerm || positionFilter) && (
          <div className="mt-4 flex gap-2">
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-xs hover:bg-gray-300 flex items-center"
              >
                Search: {searchTerm}
                <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            {positionFilter && (
              <button
                onClick={() => setPositionFilter('')}
                className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-xs hover:bg-gray-300 flex items-center"
              >
                Position: {positionFilter}
                <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="glass rounded-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden mb-6">
        <div className="px-6 py-5 bg-gradient-to-r from-green-50/50 to-green-100/50 border-b border-green-200/50">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold text-green-700 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Players to Import
            </h3>
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-white/10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Position</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Rating</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                  <div className="flex items-center">
                    Real Club
                    <span className="ml-1 text-xs text-gray-400" title="Real-world club affiliation (informational only)">
                      ⓘ
                    </span>
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Eligible</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white/20 divide-y divide-gray-200">
              {paginatedPlayers.map((player, index) => {
                const actualIndex = (currentPage - 1) * ITEMS_PER_PAGE + index
                return (
                  <tr key={actualIndex} className="hover:bg-white/30">
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={player.name}
                        onChange={(e) => handleCellChange(index, 'name', e.target.value)}
                        className={`w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-primary rounded px-2 py-1 ${
                          validationErrors.has(`${actualIndex}-name`) ? 'border-red-500 bg-red-50' : ''
                        }`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={player.position}
                        onChange={(e) => handleCellChange(index, 'position', e.target.value)}
                        className={`w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-primary rounded px-2 py-1 ${
                          validationErrors.has(`${actualIndex}-position`) ? 'border-red-500 bg-red-50' : ''
                        }`}
                      >
                        {positions.map(pos => (
                          <option key={pos} value={pos}>{pos}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={player.overall_rating}
                        onChange={(e) => handleCellChange(index, 'overall_rating', e.target.value)}
                        min="1"
                        max="99"
                        className={`w-20 bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-primary rounded px-2 py-1 ${
                          validationErrors.has(`${actualIndex}-overall_rating`) ? 'border-red-500 bg-red-50' : ''
                        }`}
                      />
                    </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={player.team_name || ''}
                      onChange={(e) => handleCellChange(index, 'team_name', e.target.value)}
                      placeholder="None"
                      className="w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-primary rounded px-2 py-1"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={player.is_auction_eligible}
                        onChange={(e) => handleCellChange(index, 'is_auction_eligible', e.target.checked)}
                        className="form-checkbox h-5 w-5 text-primary"
                      />
                      <span className="ml-2 text-sm">Yes</span>
                    </label>
                  </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleRemovePlayer(index)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Remove from import"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-white/10 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-sm text-gray-600">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredPlayers.length)} of {filteredPlayers.length} players
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  First
                </button>
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Previous
                </button>
                <span className="px-4 py-1 bg-primary text-white rounded text-sm">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Last
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Import Actions */}
      <div className="glass rounded-3xl p-6 shadow-lg backdrop-blur-md border border-white/20">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-1">Ready to Import</h3>
            <p className="text-sm text-gray-600">Review your changes and start the import process</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleValidateAll}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Validate All
            </button>
            <button
              onClick={handleStartImport}
              disabled={validationErrors.size > 0 || loading}
              className="inline-flex items-center px-6 py-2 bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-primary text-white text-sm font-medium rounded-lg transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              Start Import
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
