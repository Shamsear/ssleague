'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import BulkPhotoUpload from '@/components/BulkPhotoUpload'

interface PlayerCount {
  total: number
  byPosition: { [key: string]: number }
}

export default function DatabaseManagementPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [playerCount, setPlayerCount] = useState<PlayerCount>({ total: 0, byPosition: {} })
  const [loading, setLoading] = useState(false)
  const [showPositions, setShowPositions] = useState(false)
  const [deleteConfirmed, setDeleteConfirmed] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState('')
  const [importStatus, setImportStatus] = useState('')
  const [deleteStatus, setDeleteStatus] = useState('')
  const [backupStatus, setBackupStatus] = useState('')
  const [restoreStatus, setRestoreStatus] = useState('')

  // Filters
  const [positionFilter, setPositionFilter] = useState('')
  const [minRating, setMinRating] = useState('')
  const [maxRating, setMaxRating] = useState('')
  const [filteredCount, setFilteredCount] = useState('')

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
    if (!authLoading && user && user.role !== 'committee_admin') {
      router.push('/dashboard')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user?.role === 'committee_admin') {
      fetchPlayerCount()
    }
  }, [user])

  const fetchPlayerCount = async () => {
    try {
      console.log('🔄 Fetching player stats from Neon database')
      const response = await fetch('/api/players/stats')
      const { data, success } = await response.json()
      
      if (!success) {
        throw new Error('Failed to fetch player stats')
      }
      
      console.log(`✅ Fetched stats: ${data.total} players from Neon`)
      setPlayerCount({
        total: data.total,
        byPosition: data.byPosition
      })
    } catch (err) {
      console.error('Error fetching player count:', err)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
      setUploadStatus('')
    }
  }

  const handleSQLUpload = async () => {
    if (!selectedFile) {
      setUploadStatus('Please select a SQLite database file')
      return
    }

    if (!selectedFile.name.endsWith('.db')) {
      setUploadStatus('Please select a .db (SQLite database) file')
      return
    }

    setLoading(true)
    setUploadStatus('Loading SQLite parser...')

    try {
      setUploadStatus('Initializing database engine...')
      
      // Load SQL.js from CDN (browser-compatible version)
      const initSqlJs = await (async () => {
        const script = document.createElement('script')
        script.src = 'https://sql.js.org/dist/sql-wasm.js'
        document.head.appendChild(script)
        
        return new Promise((resolve) => {
          script.onload = () => {
        // @ts-expect-error - External library type issue
            resolve(window.initSqlJs)
          }
        })
      })()
      
      // @ts-expect-error - External library type issue
      const SQL = await initSqlJs({
        locateFile: (file: string) => `https://sql.js.org/dist/${file}`
      })

      setUploadStatus('Reading database file...')
      const arrayBuffer = await selectedFile.arrayBuffer()
      const buffer = new Uint8Array(arrayBuffer)
      
      setUploadStatus('Parsing SQLite database...')
      const db = new SQL.Database(buffer)
      
      // Try common table names
      const tableNames = ['players', 'players_all', 'footballplayers', 'footballplayer', 'player']
      let tableName = ''
      
      for (const name of tableNames) {
        try {
          const result = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`)
          if (result.length > 0) {
            tableName = name
            break
          }
        } catch (e) {
          continue
        }
      }
      
      if (!tableName) {
        // Get first table
        const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'")
        if (tables.length > 0 && tables[0].values.length > 0) {
          tableName = tables[0].values[0][0] as string
        } else {
          db.close()
          setUploadStatus('Error: No player tables found in database')
          return
        }
      }
      
      setUploadStatus(`Found table: ${tableName}. Extracting data...`)
      
      // Query all data from the found table
      const results = db.exec(`SELECT * FROM ${tableName}`)
      
      let players: any[] = []
      if (results.length > 0) {
        const columns = results[0].columns
        const values = results[0].values
        
        players = values.map((row: any[]) => {
          const player: any = {}
          columns.forEach((col: string, index: number) => {
            player[col] = row[index]
          })
          return player
        })
      }
      
      db.close()

      setUploadStatus(`Successfully parsed ${players.length} players from table "${tableName}". Click "Preview & Import" to review before importing.`)
      // Store parsed data in sessionStorage for preview
      sessionStorage.setItem('parsedPlayers', JSON.stringify(players))
      
    } catch (err: any) {
      console.error('Parse error:', err)
      setUploadStatus(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleQuickImport = async () => {
    const parsedData = sessionStorage.getItem('parsedPlayers')
    if (!parsedData) {
      setImportStatus('No parsed data found. Please upload a SQL file first.')
      return
    }

    if (!confirm('This will import all players directly. Continue?')) {
      return
    }

    setLoading(true)
    setImportStatus('Checking for existing players...')

    try {
      const players = JSON.parse(parsedData)
      
      // Fetch existing players from Neon to check for duplicates
      const existingResponse = await fetch('/api/players')
      const { data: existingPlayers } = await existingResponse.json()
      
      const existingPlayerNames = new Set(
        existingPlayers.map((player: any) => player.name?.toLowerCase())
      )
      
      // Filter out duplicates
      const newPlayers = players.filter((player: any) => {
        const playerName = player.name?.toLowerCase()
        return playerName && !existingPlayerNames.has(playerName)
      })
      
      const duplicateCount = players.length - newPlayers.length
      
      if (duplicateCount > 0) {
        setImportStatus(`Found ${duplicateCount} duplicate(s). Importing ${newPlayers.length} new players...`)
      } else {
        setImportStatus('Importing players...')
      }
      
      // Check if all players are duplicates
      if (newPlayers.length === 0) {
        setImportStatus(`All ${players.length} players already exist in the database. No new players imported.`)
        sessionStorage.removeItem('parsedPlayers')
        fetchPlayerCount()
        return
      }
      
      // Use bulk create API endpoint
      const importResponse = await fetch('/api/players/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'import',
          players: newPlayers.map((player: any) => ({
            ...player,
            is_auction_eligible: player.is_auction_eligible || false
          }))
        })
      })

      const result = await importResponse.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to import players')
      }
      
      setImportStatus(`Successfully imported ${result.count} new players! (${duplicateCount} duplicates skipped)`)
      sessionStorage.removeItem('parsedPlayers')
      fetchPlayerCount()
    } catch (err: any) {
      setImportStatus(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStats = async () => {
    const parsedData = sessionStorage.getItem('parsedPlayers')
    if (!parsedData) {
      setImportStatus('No parsed data found. Please upload a SQL file first.')
      return
    }

    if (!confirm('This will update existing player stats and add new players. Team assignments will be preserved. Continue?')) {
      return
    }

    setLoading(true)
    setImportStatus('Updating player stats...')

    try {
      const players = JSON.parse(parsedData)
      
      // Use bulk update API endpoint that preserves ownership
      const updateResponse = await fetch('/api/players/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'updateStats',
          players: players.map((player: any) => ({
            ...player,
            is_auction_eligible: player.is_auction_eligible || false
          }))
        })
      })

      const result = await updateResponse.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update players')
      }
      
      setImportStatus(`Successfully updated ${result.updated} players and added ${result.inserted} new players!`)
      sessionStorage.removeItem('parsedPlayers')
      fetchPlayerCount()
    } catch (err: any) {
      setImportStatus(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handlePreviewImport = () => {
    const parsedData = sessionStorage.getItem('parsedPlayers')
    if (!parsedData) {
      setImportStatus('No parsed data found. Please upload a SQL file first.')
      return
    }

    router.push('/dashboard/committee/database/import-preview')
  }

  const handleDeleteAll = async () => {
    if (!deleteConfirmed) {
      setDeleteStatus('Please confirm deletion by checking the checkbox')
      return
    }

    if (!confirm('WARNING: This will permanently delete ALL players. This cannot be undone. Continue?')) {
      return
    }

    setLoading(true)
    setDeleteStatus('Deleting all players...')

    try {
      // Call Neon API to delete all players
      const response = await fetch('/api/players/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteAll' })
      })
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete players')
      }
      
      setDeleteStatus(`Successfully deleted ${result.count} players`)
      setDeleteConfirmed(false)
      fetchPlayerCount()
    } catch (err: any) {
      setDeleteStatus(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBackup = async () => {
    setBackupStatus('Creating backup...')
    setLoading(true)

    try {
      // Fetch all players from Neon
      const response = await fetch('/api/players')
      const { data: players, success } = await response.json()
      
      if (!success) {
        throw new Error('Failed to fetch players for backup')
      }
      
      console.log(`📊 Creating backup of ${players.length} players from Neon database`)

      const backup = {
        timestamp: new Date().toISOString(),
        players,
        count: players.length
      }

      const dataStr = JSON.stringify(backup, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `players_backup_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setBackupStatus('Backup created successfully!')
    } catch (err: any) {
      setBackupStatus(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!confirm('WARNING: This will overwrite ALL existing players. Continue?')) {
      return
    }

    setRestoreStatus('Restoring backup...')
    setLoading(true)

    try {
      const text = await file.text()
      const backup = JSON.parse(text)

      if (!backup.players || !Array.isArray(backup.players)) {
        throw new Error('Invalid backup file format')
      }

      // Delete all existing players using Neon API
      const deleteResponse = await fetch('/api/players/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteAll' })
      })
      
      const deleteResult = await deleteResponse.json()
      if (!deleteResult.success) {
        throw new Error('Failed to delete existing players')
      }

      // Restore players from backup using Neon API
      const restoreResponse = await fetch('/api/players/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'import',
          players: backup.players.map((player: any) => {
            const { id, ...playerData } = player
            return playerData
          })
        })
      })
      
      const restoreResult = await restoreResponse.json()
      if (!restoreResult.success) {
        throw new Error('Failed to restore players')
      }

      setRestoreStatus(`Successfully restored ${backup.players.length} players!`)
      fetchPlayerCount()
    } catch (err: any) {
      setRestoreStatus(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterPlayers = async () => {
    try {
      // Fetch all players from Neon
      const response = await fetch('/api/players')
      const { data: allPlayers } = await response.json()
      
      // Apply filters client-side
      let filtered = allPlayers

      if (positionFilter) {
        filtered = filtered.filter((player: any) => player.position === positionFilter)
      }

      if (minRating || maxRating) {
        filtered = filtered.filter((player: any) => {
          const rating = player.overall_rating || 0
          const min = minRating ? parseInt(minRating) : 0
          const max = maxRating ? parseInt(maxRating) : 99
          return rating >= min && rating <= max
        })
      }

      console.log(`🔍 Filtered ${filtered.length} players from Neon database`)
      setFilteredCount(`Found ${filtered.length} players matching your criteria`)
    } catch (err: any) {
      setFilteredCount(`Error: ${err.message}`)
    }
  }

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

  if (user.role !== 'committee_admin') {
    return null
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
      <div className="glass rounded-3xl p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center mb-6 hidden sm:flex">
          <div className="mr-4 flex-shrink-0">
            <div className="h-12 w-12 flex items-center justify-center rounded-full bg-blue-50 border border-blue-200">
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-dark">Database Management</h2>
            <p className="text-sm text-gray-500">Manage player data and database operations</p>
          </div>
        </div>

        <Link
          href="/dashboard/committee"
          className="inline-flex items-center px-4 py-2 mb-6 text-sm glass rounded-xl hover:bg-white/90 transition-all duration-300"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </Link>

        {/* Database Status */}
        <div className="glass-card mb-6 p-4 rounded-xl bg-white/30">
          <h3 className="font-medium text-dark mb-3">Database Status</h3>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between p-3 bg-white/50 rounded-lg">
              <span className="text-gray-600">Current Player Count:</span>
              <span className="font-medium">{playerCount.total}</span>
            </div>

            {Object.keys(playerCount.byPosition).length > 0 && (
              <div className="p-3 bg-white/50 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Player Positions:</span>
                  <button
                    onClick={() => setShowPositions(!showPositions)}
                    className="text-primary text-xs hover:underline"
                  >
                    {showPositions ? 'Hide' : 'Show'}
                  </button>
                </div>
                {showPositions && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-1">
                    {Object.entries(playerCount.byPosition).map(([position, count]) => (
                      <div key={position} className="text-sm bg-white/70 rounded-lg px-3 py-1.5 flex justify-between">
                        <span className="font-medium">{position}</span>
                        <span className="text-primary-dark">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Upload SQLite Database */}
        <div className="glass-card mb-6 p-4 rounded-xl bg-white/30">
          <h3 className="font-medium text-dark mb-3">Upload SQLite Database</h3>
          <p className="text-sm text-gray-500 mb-4">
            Upload a SQLite database file (.db) containing player data. The system will automatically detect and import the player table.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-grow">
              <input
                type="file"
                accept=".db"
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
            </div>
            <button
              onClick={handleSQLUpload}
              disabled={!selectedFile || loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Parse Database
            </button>
          </div>
          {uploadStatus && (
            <div className="mt-2 text-sm text-gray-700">{uploadStatus}</div>
          )}
        </div>

        {/* Import Players */}
        <div className={`glass-card p-4 rounded-xl ${playerCount.total === 0 ? 'bg-green-50/50 border border-green-100' : 'bg-white/30'} mb-6`}>
          <h3 className="font-medium text-dark mb-3">Import Players</h3>
          <p className="text-sm text-gray-500 mb-4">
            Import players from the parsed SQL data. Choose between quick import or enhanced import with preview.
            {playerCount.total === 0 && (
              <span className="block text-green-600 font-medium mt-2">No players found. Import is recommended.</span>
            )}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            {/* Update Stats */}
            <div className="p-4 rounded-lg bg-orange-50/50 border border-orange-100">
              <h4 className="text-orange-700 font-medium mb-2 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Update Stats
              </h4>
              <p className="text-sm text-gray-600 mb-3">
                Update player stats, add new players. Preserves team ownership.
              </p>
              <button
                onClick={handleUpdateStats}
                disabled={loading}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors w-full disabled:bg-gray-400 text-sm"
              >
                Update Stats
              </button>
            </div>

            {/* Quick Import */}
            <div className="p-4 rounded-lg bg-blue-50/50 border border-blue-100">
              <h4 className="text-blue-700 font-medium mb-2 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Quick Import
              </h4>
              <p className="text-sm text-gray-600 mb-3">
                Import new players only. Skips duplicates by name.
              </p>
              <button
                onClick={handleQuickImport}
                disabled={loading}
                className={`px-4 py-2 ${playerCount.total === 0 ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg transition-colors w-full disabled:bg-gray-400 text-sm`}
              >
                Quick Import
              </button>
            </div>

            {/* Enhanced Import */}
            <div className="p-4 rounded-lg bg-green-50/50 border border-green-100">
              <h4 className="text-green-700 font-medium mb-2 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Enhanced Import
              </h4>
              <p className="text-sm text-gray-600 mb-3">
                Preview and edit player data before importing.
              </p>
              <button
                onClick={handlePreviewImport}
                disabled={loading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors w-full disabled:bg-gray-400 text-sm"
              >
                Preview & Import
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <Link
              href="/dashboard/committee/players"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors inline-flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              View All Players
            </Link>
          </div>

          {importStatus && (
            <div className="mt-4 text-sm text-gray-700">{importStatus}</div>
          )}
        </div>

        {/* Bulk Photo Upload */}
        <BulkPhotoUpload />

        {/* Delete All Players */}
        <div className="glass-card mb-6 p-4 rounded-xl bg-white/30 border border-red-100">
          <h3 className="font-medium text-dark mb-3">Delete All Players</h3>
          <p className="text-sm text-gray-500 mb-4">
            This will permanently delete all players from the database. This action cannot be undone.
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="confirmDelete"
                checked={deleteConfirmed}
                onChange={(e) => setDeleteConfirmed(e.target.checked)}
                className="rounded text-red-500 focus:ring-red-400"
              />
              <label htmlFor="confirmDelete" className="text-sm text-red-600">
                I understand this will delete all player data
              </label>
            </div>

            <button
              onClick={handleDeleteAll}
              disabled={!deleteConfirmed || loading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Delete All Players
            </button>
          </div>
          {deleteStatus && (
            <div className="mt-2 text-sm text-gray-700">{deleteStatus}</div>
          )}
        </div>

        {/* Backup and Restore */}
        <div className="glass-card mb-6 p-4 rounded-xl bg-white/30">
          <h3 className="font-medium text-dark mb-3">Backup and Restore</h3>
          <p className="text-sm text-gray-500 mb-4">
            Create backups of your entire database or restore from a previous backup.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Backup */}
            <div className="p-4 rounded-lg bg-blue-50/50 border border-blue-100">
              <h4 className="text-blue-700 font-medium mb-2">Create Backup</h4>
              <p className="text-sm text-gray-600 mb-3">
                Download a complete backup in JSON format.
              </p>
              <button
                onClick={handleCreateBackup}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full disabled:bg-gray-400"
              >
                Create Backup
              </button>
              {backupStatus && (
                <div className="mt-2 text-sm text-gray-700">{backupStatus}</div>
              )}
            </div>

            {/* Restore */}
            <div className="p-4 rounded-lg bg-green-50/50 border border-green-100">
              <h4 className="text-green-700 font-medium mb-2">Restore from Backup</h4>
              <p className="text-sm text-gray-600 mb-3">
                Upload a backup file to restore your database.
                <span className="text-red-600 font-medium block">This will overwrite existing data.</span>
              </p>
              <input
                type="file"
                accept=".json"
                onChange={handleRestoreBackup}
                disabled={loading}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-green-50 file:text-green-700
                  hover:file:bg-green-100
                  disabled:opacity-50"
              />
              {restoreStatus && (
                <div className="mt-2 text-sm text-gray-700">{restoreStatus}</div>
              )}
            </div>
          </div>
        </div>

        {/* Enhanced Data Management */}
        <div className="glass-card p-4 rounded-xl bg-white/30">
          <h3 className="font-medium text-dark mb-3">Filter Players</h3>
          <p className="text-sm text-gray-500 mb-4">
            Filter players by position and rating.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
              <select
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-primary focus:border-primary"
              >
                <option value="">All Positions</option>
                {Object.keys(playerCount.byPosition).map(pos => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rating Range</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={minRating}
                  onChange={(e) => setMinRating(e.target.value)}
                  placeholder="Min"
                  min="1"
                  max="99"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-primary focus:border-primary"
                />
                <span>to</span>
                <input
                  type="number"
                  value={maxRating}
                  onChange={(e) => setMaxRating(e.target.value)}
                  placeholder="Max"
                  min="1"
                  max="99"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleFilterPlayers}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Filter Players
          </button>

          {filteredCount && (
            <div className="mt-3 text-sm text-gray-700">{filteredCount}</div>
          )}
        </div>
      </div>
    </div>
  )
}
