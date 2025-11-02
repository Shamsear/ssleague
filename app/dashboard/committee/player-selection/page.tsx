'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { useModal } from '@/hooks/useModal'
import AlertModal from '@/components/modals/AlertModal'
import ConfirmModal from '@/components/modals/ConfirmModal'

interface FootballPlayer {
  id: string
  player_id: string
  name: string
  position?: string
  overall_rating?: number
  is_auction_eligible: boolean
  nationality?: string
  age?: number
  club?: string
}

const PLAYERS_PER_PAGE = 50

export default function PlayerSelectionPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [players, setPlayers] = useState<FootballPlayer[]>([])
  const [filteredPlayers, setFilteredPlayers] = useState<FootballPlayer[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [positionFilter, setPositionFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // all, eligible, not_eligible
  const [currentPage, setCurrentPage] = useState(1)
  const [updating, setUpdating] = useState<Set<string>>(new Set())
  const [showExcelSection, setShowExcelSection] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [selectedExportPosition, setSelectedExportPosition] = useState('')

  // Modal system
  const {
    alertState,
    showAlert,
    closeAlert,
    confirmState,
    showConfirm,
    closeConfirm,
    handleConfirm,
  } = useModal()

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
        console.log('🔄 Fetching ALL players from Neon database via API')
        
        // Fetch without limit to get all players
        const response = await fetch('/api/players?limit=999999')
        const { data, success } = await response.json()
        
        if (!success) {
          throw new Error('Failed to fetch players')
        }
        
        console.log(`✅ Fetched ${data.length} players from Neon`)
        
        setPlayers(data)
        setFilteredPlayers(data)
      } catch (err) {
        console.error('Error fetching players:', err)
        showAlert({
          type: 'error',
          title: 'Error',
          message: 'Failed to load players. Please try again.'
        })
      } finally {
        setLoading(false)
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

    // Filter by eligibility status
    if (statusFilter === 'eligible') {
      filtered = filtered.filter(p => p.is_auction_eligible)
    } else if (statusFilter === 'not_eligible') {
      filtered = filtered.filter(p => !p.is_auction_eligible)
    }

    setFilteredPlayers(filtered)
    setCurrentPage(1)
  }, [searchTerm, positionFilter, statusFilter, players])

  const positions = useMemo(() => 
    ['', ...new Set(players.map(p => p.position).filter(Boolean))].sort(),
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

  const stats = useMemo(() => ({
    total: players.length,
    eligible: players.filter(p => p.is_auction_eligible).length,
    notEligible: players.filter(p => !p.is_auction_eligible).length
  }), [players])

  const FOOTBALL_POSITIONS = ['GK', 'CB', 'LB', 'RB', 'DMF', 'CMF', 'AMF', 'LMF', 'RMF', 'LWF', 'RWF', 'SS', 'CF']
  
  const positionStats = useMemo(() => {
    const stats: { [key: string]: { total: number; eligible: number } } = {}
    FOOTBALL_POSITIONS.forEach(pos => {
      const posPlayers = players.filter(p => p.position === pos)
      stats[pos] = {
        total: posPlayers.length,
        eligible: posPlayers.filter(p => p.is_auction_eligible).length
      }
    })
    return stats
  }, [players])

  const handleTogglePlayer = async (playerId: string, currentStatus: boolean) => {
    setUpdating(prev => new Set(prev).add(playerId))
    try {
      const response = await fetch(`/api/players/${playerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_auction_eligible: !currentStatus })
      })
      
      const { success } = await response.json()
      if (!success) {
        throw new Error('Failed to update player')
      }
      
      // Update local state
      setPlayers(prev => prev.map(p => 
        p.id === playerId ? { ...p, is_auction_eligible: !currentStatus } : p
      ))
    } catch (err) {
      console.error('Error updating player:', err)
      showAlert({
        type: 'error',
        title: 'Update Failed',
        message: 'Failed to update player status'
      })
    } finally {
      setUpdating(prev => {
        const newSet = new Set(prev)
        newSet.delete(playerId)
        return newSet
      })
    }
  }

  const handleBulkToggle = async (makeEligible: boolean) => {
    const confirmed = await showConfirm({
      type: 'warning',
      title: 'Bulk Update',
      message: `Are you sure you want to ${makeEligible ? 'select' : 'deselect'} all ${paginatedPlayers.length} visible players?`,
      confirmText: 'Confirm',
      cancelText: 'Cancel'
    })
    
    if (!confirmed) {
      return
    }

    setLoading(true)
    try {
      const playerIds = paginatedPlayers.map(p => p.id)
      
      const response = await fetch('/api/players/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateEligibility',
          playerIds,
          isEligible: makeEligible
        })
      })
      
      const { success } = await response.json()
      if (!success) {
        throw new Error('Failed to update players')
      }
      
      // Update local state
      const updatedIds = new Set(playerIds)
      setPlayers(prev => prev.map(p => 
        updatedIds.has(p.id) ? { ...p, is_auction_eligible: makeEligible } : p
      ))
      
      showAlert({
        type: 'success',
        title: 'Success',
        message: `Successfully updated ${paginatedPlayers.length} players`
      })
    } catch (err) {
      console.error('Error bulk updating players:', err)
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to update players'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeselectAll = async () => {
    const eligibleCount = players.filter(p => p.is_auction_eligible).length
    
    if (eligibleCount === 0) {
      showAlert({
        type: 'info',
        title: 'No Players Selected',
        message: 'All players are already deselected'
      })
      return
    }

    const confirmed = await showConfirm({
      type: 'warning',
      title: 'Deselect All Players',
      message: `Are you sure you want to deselect ALL ${eligibleCount} eligible players across all pages?`,
      confirmText: 'Deselect All',
      cancelText: 'Cancel'
    })
    
    if (!confirmed) {
      return
    }

    setLoading(true)
    try {
      const eligiblePlayerIds = players
        .filter(p => p.is_auction_eligible)
        .map(p => p.id)
      
      const response = await fetch('/api/players/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateEligibility',
          playerIds: eligiblePlayerIds,
          isEligible: false
        })
      })
      
      const { success } = await response.json()
      if (!success) {
        throw new Error('Failed to update players')
      }
      
      // Update local state - set all to not eligible
      setPlayers(prev => prev.map(p => ({ ...p, is_auction_eligible: false })))
      
      showAlert({
        type: 'success',
        title: 'Success',
        message: `Successfully deselected all ${eligibleCount} players`
      })
    } catch (err) {
      console.error('Error deselecting all players:', err)
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to deselect all players'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleExportPosition = async (position: string) => {
    if (!position) {
      showAlert({
        type: 'warning',
        title: 'No Position Selected',
        message: 'Please select a position first'
      })
      return
    }

    try {
      // Filter players by selected position
      const positionPlayers = players.filter(p => p.position === position)
      
      if (positionPlayers.length === 0) {
        showAlert({
          type: 'info',
          title: 'No Players',
          message: `No players found for position ${position}`
        })
        return
      }

      // Dynamically import ExcelJS
      const ExcelJS = (await import('exceljs')).default
      
      // Create workbook and worksheet
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet(position)
      
      // Define columns with proper widths
      worksheet.columns = [
        { header: 'Player ID', key: 'player_id', width: 15 },
        { header: 'Name', key: 'name', width: 30 },
        { header: 'Position', key: 'position', width: 12 },
        { header: 'Overall Rating', key: 'overall_rating', width: 15 },
        { header: 'Eligible', key: 'eligible', width: 12 }
      ]
      
      // Style header row
      worksheet.getRow(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0066FF' }
      }
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
      worksheet.getRow(1).height = 25
      
      // Add data rows
      positionPlayers.forEach((player, index) => {
        const row = worksheet.addRow({
          player_id: player.player_id,
          name: player.name,
          position: player.position || '',
          overall_rating: player.overall_rating || '',
          eligible: player.is_auction_eligible ? 'Yes' : 'No'
        })
        
        // Alternate row colors
        if (index % 2 === 0) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF0F8FF' }
          }
        }
        
        // Center align certain columns
        row.getCell('player_id').alignment = { horizontal: 'center' }
        row.getCell('position').alignment = { horizontal: 'center' }
        row.getCell('overall_rating').alignment = { horizontal: 'center' }
        row.getCell('eligible').alignment = { horizontal: 'center' }
      })
      
      // Add data validation (dropdown) for Eligible column
      const eligibleColumnLetter = 'E' // Column E is "Eligible"
      for (let i = 2; i <= positionPlayers.length + 1; i++) {
        worksheet.getCell(`${eligibleColumnLetter}${i}`).dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: ['"Yes,No"'],
          showErrorMessage: true,
          errorStyle: 'error',
          errorTitle: 'Invalid Value',
          error: 'Please select Yes or No from the dropdown'
        }
        
        // Add conditional formatting for Eligible column
        const cell = worksheet.getCell(`${eligibleColumnLetter}${i}`)
        const value = cell.value as string
        if (value === 'Yes') {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD4EDDA' } // Light green
          }
          cell.font = { color: { argb: 'FF155724' }, bold: true }
        } else if (value === 'No') {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8D7DA' } // Light red
          }
          cell.font = { color: { argb: 'FF721C24' }, bold: true }
        }
      }
      
      // Add borders to all cells
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
            left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
            bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
            right: { style: 'thin', color: { argb: 'FFD3D3D3' } }
          }
        })
      })
      
      // Freeze header row
      worksheet.views = [
        { state: 'frozen', xSplit: 0, ySplit: 1, topLeftCell: 'A2', activeCell: 'A2' }
      ]
      
      // Add instructions sheet
      const instructionsSheet = workbook.addWorksheet('Instructions')
      instructionsSheet.columns = [
        { header: '', key: 'content', width: 80 }
      ]
      
      const instructions = [
        { content: '📋 Player Selection Export - Instructions' },
        { content: '' },
        { content: 'How to use this file:' },
        { content: '1. Go to the "' + position + '" tab to see all players for this position' },
        { content: '2. In the "Eligible" column, click on any cell to see a dropdown with Yes/No options' },
        { content: '3. Select "Yes" to make a player eligible for auction, or "No" to exclude them' },
        { content: '4. You can only edit the "Eligible" column - other columns are for reference' },
        { content: '5. Save this file after making changes' },
        { content: '6. Upload the saved file back to the system using the import feature' },
        { content: '' },
        { content: 'Important Notes:' },
        { content: '• Do NOT change the Player ID or Name columns' },
        { content: '• Do NOT add or remove rows' },
        { content: '• Do NOT delete the header row' },
        { content: '• Only "Yes" or "No" values are accepted in the Eligible column' },
        { content: '• Green = Yes (Eligible), Red = No (Not Eligible)' },
        { content: '' },
        { content: 'Position: ' + position },
        { content: 'Total Players: ' + positionPlayers.length },
        { content: 'Export Date: ' + new Date().toLocaleDateString() }
      ]
      
      instructions.forEach((item, index) => {
        const row = instructionsSheet.addRow(item)
        if (index === 0) {
          row.font = { bold: true, size: 14, color: { argb: 'FF0066FF' } }
          row.height = 30
        } else if (index === 2 || index === 10 || index === 16) {
          row.font = { bold: true, size: 11 }
        }
      })
      
      // Generate Excel file buffer
      const buffer = await workbook.xlsx.writeBuffer()
      
      // Download
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${position}-Players-${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
      
      showAlert({
        type: 'success',
        title: 'Export Successful',
        message: `✅ Exported ${positionPlayers.length} ${position} players to Excel\n\nThe file includes:\n• Yes/No dropdowns in the Eligible column\n• Color coding (Green=Yes, Red=No)\n• All player information\n\nEdit the file and upload it back to apply changes in bulk!`
      })
    } catch (err) {
      console.error('Error exporting:', err)
      showAlert({
        type: 'error',
        title: 'Export Failed',
        message: 'Failed to export data. Please try again.'
      })
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  const handleFileUpload = async () => {
    if (!selectedFile) {
      showAlert({
        type: 'warning',
        title: 'No File Selected',
        message: 'Please select a file first'
      })
      return
    }

    if (!selectedExportPosition) {
      showAlert({
        type: 'warning',
        title: 'No Position Selected',
        message: 'Please select which position this file is for'
      })
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('position', selectedExportPosition)

      const response = await fetch('/api/parse-player-selection', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to parse file')
      }

      const data = await response.json()
      
      // Store preview data with position filter and navigate to preview page
      sessionStorage.setItem('selectionPreview', JSON.stringify({
        ...data,
        position_filter: selectedExportPosition
      }))
      router.push('/dashboard/committee/player-selection/preview')
    } catch (err) {
      console.error('Error uploading file:', err)
      showAlert({
        type: 'error',
        title: 'Upload Failed',
        message: 'Failed to process file. Please check the format.'
      })
    } finally {
      setUploading(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading players...</p>
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center">
            <Link
              href="/dashboard/committee"
              className="inline-flex items-center justify-center p-2 mr-3 rounded-xl bg-white/60 text-gray-700 hover:bg-white/80 transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h2 className="text-2xl font-bold gradient-text">Player Selection</h2>
              <p className="text-sm text-gray-600 mt-1">
                {stats.eligible} of {stats.total} players selected for auction
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowExcelSection(!showExcelSection)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center text-sm"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {showExcelSection ? 'Hide' : 'Show'} Excel Import/Export
            </button>
          </div>
        </div>

        {/* Excel Import Section */}
        {showExcelSection && (
          <div className="glass p-5 rounded-xl bg-blue-50/50 backdrop-blur-sm border border-blue-200/50 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Excel/CSV Import
              </h3>
              <button
                onClick={() => setShowExcelSection(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="bg-blue-100/50 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">📋 Position-Based Import/Export:</h4>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Select a position below to export only that position's players</li>
                <li>Edit the CSV file - change "Yes"/"No" in the Eligible column (Excel dropdown recommended)</li>
                <li>Upload the modified file for the same position</li>
                <li>Preview changes before applying them</li>
              </ol>
              <p className="text-xs text-blue-700 mt-2 italic">
                💡 Tip: Each position gets its own file for easier management. Only ID, Name, and Eligible columns are needed.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/50 rounded-lg p-4">
                <h4 className="text-md font-medium text-gray-800 mb-3">1. Select & Export Position</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Choose a position to export (only that position's players will be included)
                </p>
                <select
                  value={selectedExportPosition}
                  onChange={(e) => setSelectedExportPosition(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-3"
                >
                  <option value="">Select Position...</option>
                  {FOOTBALL_POSITIONS.map(pos => (
                    <option key={pos} value={pos}>
                      {pos} ({positionStats[pos]?.total || 0} players, {positionStats[pos]?.eligible || 0} eligible)
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleExportPosition(selectedExportPosition)}
                  disabled={!selectedExportPosition}
                  className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export {selectedExportPosition || 'Position'} Players
                </button>
              </div>

              <div className="bg-white/50 rounded-lg p-4">
                <h4 className="text-md font-medium text-gray-800 mb-3">2. Upload Modified File</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Upload your modified file for the same position
                </p>
                <select
                  value={selectedExportPosition}
                  onChange={(e) => setSelectedExportPosition(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 mb-3"
                >
                  <option value="">Select Position for Upload...</option>
                  {FOOTBALL_POSITIONS.map(pos => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileSelect}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {selectedFile && (
                    <p className="text-xs text-green-600">✓ {selectedFile.name} selected</p>
                  )}
                  <button
                    onClick={handleFileUpload}
                    disabled={!selectedFile || uploading}
                    className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? (
                      <>
                        <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Preview Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="glass p-4 rounded-xl bg-white/10 shadow-sm">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Players</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="glass p-4 rounded-xl bg-white/10 shadow-sm">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Eligible</p>
                <p className="text-2xl font-bold text-green-600">{stats.eligible}</p>
              </div>
            </div>
          </div>

          <div className="glass p-4 rounded-xl bg-white/10 shadow-sm">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Not Eligible</p>
                <p className="text-2xl font-bold text-red-600">{stats.notEligible}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="glass p-4 rounded-xl bg-white/20 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search players..."
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
              <select
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">All Positions</option>
                {positions.filter(p => p).map(pos => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="all">All Players</option>
                <option value="eligible">Eligible Only</option>
                <option value="not_eligible">Not Eligible Only</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchTerm('')
                  setPositionFilter('')
                  setStatusFilter('all')
                }}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="glass p-4 rounded-xl bg-white/20 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <p className="text-sm text-gray-600">
                Showing {((currentPage - 1) * PLAYERS_PER_PAGE) + 1} to {Math.min(currentPage * PLAYERS_PER_PAGE, filteredPlayers.length)} of {filteredPlayers.length} players
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleBulkToggle(true)}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center text-sm"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Select Visible
              </button>
              <button
                onClick={() => handleBulkToggle(false)}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center text-sm"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Deselect Visible
              </button>
              <button
                onClick={handleDeselectAll}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center text-sm"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Deselect All
              </button>
            </div>
          </div>
        </div>

        {/* Players Table */}
        <div className="overflow-x-auto rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white/10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Player</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Position</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Rating</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase hidden md:table-cell">Club</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase">Eligible</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white/30">
              {paginatedPlayers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No players found
                  </td>
                </tr>
              ) : (
                paginatedPlayers.map((player) => (
                  <tr key={player.id} className="hover:bg-white/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-800">{player.name}</div>
                      <div className="text-xs text-gray-500">{player.player_id}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{player.position}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md font-medium">
                        {player.overall_rating || '--'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">
                      {player.club || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {player.is_auction_eligible ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleTogglePlayer(player.id, player.is_auction_eligible)}
                        disabled={updating.has(player.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                          player.is_auction_eligible
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {updating.has(player.id) ? (
                          <span className="flex items-center">
                            <svg className="animate-spin h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Updating...
                          </span>
                        ) : (
                          player.is_auction_eligible ? 'Deselect' : 'Select'
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                First
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Components */}
      <AlertModal
        isOpen={alertState.isOpen}
        onClose={closeAlert}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
      />

      <ConfirmModal
        isOpen={confirmState.isOpen}
        onConfirm={handleConfirm}
        onCancel={closeConfirm}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        type={confirmState.type}
      />
    </div>
  )
}
