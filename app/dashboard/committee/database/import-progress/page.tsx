'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface Step {
  name: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  message?: string
  error?: string
  progress: number
}

export default function ImportProgressPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [overallProgress, setOverallProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)
  const [status, setStatus] = useState<'running' | 'completed' | 'failed'>('running')
  const [steps, setSteps] = useState<Step[]>([
    {
      name: 'Initializing Import',
      description: 'Preparing player data for import',
      status: 'pending',
      progress: 0
    },
    {
      name: 'Validating Data',
      description: 'Checking player data integrity',
      status: 'pending',
      progress: 0
    },
    {
      name: 'Importing Players',
      description: 'Writing player data to Neon database',
      status: 'pending',
      progress: 0
    },
    {
      name: 'Finalizing',
      description: 'Cleaning up and verifying import',
      status: 'pending',
      progress: 0
    }
  ])
  const [summary, setSummary] = useState({
    total_processed: 0,
    new_players_created: 0,
    existing_players_updated: 0,
    total_operations: 0
  })

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
      startImport()
    }
  }, [user])

  const startImport = async () => {
    const validatedData = sessionStorage.getItem('validatedPlayers')
    if (!validatedData) {
      router.push('/dashboard/committee/database')
      return
    }

    try {
      const players = JSON.parse(validatedData)

      // Step 1: Initialize
      updateStep(0, 'running', '', 50)
      await sleep(500)
      updateStep(0, 'completed', 'Initialization complete', 100)
      setOverallProgress(25)
      setCurrentStep(1)

      // Step 2: Validate
      updateStep(1, 'running', '', 50)
      await sleep(500)
      updateStep(1, 'completed', `Validated ${players.length} players`, 100)
      setOverallProgress(50)
      setCurrentStep(2)

      // Step 3: Import players
      updateStep(2, 'running', 'Starting import...', 0)
      
      // Check for existing players first using Neon API
      updateStep(2, 'running', 'Checking for existing players...', 10)
      const existingResponse = await fetchWithTokenRefresh(/api/players')
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
        updateStep(2, 'running', `Found ${duplicateCount} duplicate(s). Importing ${newPlayers.length} new players...`, 20)
      }
      
      // Check if all players are duplicates
      if (newPlayers.length === 0) {
        updateStep(2, 'completed', `All ${players.length} players already exist in the database (skipped)`, 100)
        setOverallProgress(90)
        setCurrentStep(3)
      } else {
        // Import in batches to avoid timeout and provide progress
        const batchSize = 100 // Process 100 players at a time
        const totalBatches = Math.ceil(newPlayers.length / batchSize)
        let totalImported = 0
        
        console.log('='.repeat(80))
        console.log('🚀 STARTING BATCH IMPORT PROCESS')
        console.log('='.repeat(80))
        console.log(`📊 Total players to import: ${newPlayers.length}`)
        console.log(`📦 Batch size: ${batchSize}`)
        console.log(`🔢 Total batches: ${totalBatches}`)
        console.log('='.repeat(80))
        
        updateStep(2, 'running', `Importing ${newPlayers.length} players in ${totalBatches} batch(es)...`, 30)
        
        for (let i = 0; i < totalBatches; i++) {
          const start = i * batchSize
          const end = Math.min(start + batchSize, newPlayers.length)
          const batch = newPlayers.slice(start, end)
          
          const batchNum = i + 1
          const progressPercent = 30 + Math.floor((i / totalBatches) * 60) // 30% to 90%
          
          console.log(`\n📦 BATCH ${batchNum}/${totalBatches}`)
          console.log(`   Players: ${start + 1} to ${end} (${batch.length} players)`)
          console.log(`   Progress: ${progressPercent}%`)
          console.log(`   Sample players:`, batch.slice(0, 3).map(p => p.name).join(', '))
          
          updateStep(2, 'running', `Processing batch ${batchNum}/${totalBatches} (${start + 1}-${end} of ${newPlayers.length})...`, progressPercent)
          
          const startTime = Date.now()
          
          const importResponse = await fetchWithTokenRefresh(/api/players/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'import',
              players: batch.map((player: any) => ({
                ...player,
                is_auction_eligible: player.is_auction_eligible || false
              }))
            })
          })
          
          const importResult = await importResponse.json()
          const duration = Date.now() - startTime
          
          if (!importResult.success) {
            console.error(`❌ BATCH ${batchNum} FAILED:`, importResult.error)
            throw new Error(importResult.error || `Failed to import batch ${batchNum}`)
          }
          
          totalImported += importResult.count
          
          console.log(`   ✅ Success! Imported ${importResult.count} players in ${duration}ms`)
          console.log(`   📈 Total imported so far: ${totalImported}/${newPlayers.length} (${Math.round((totalImported/newPlayers.length)*100)}%)`)
          
          updateStep(2, 'running', `Imported ${totalImported}/${newPlayers.length} players (batch ${batchNum}/${totalBatches} complete)`, progressPercent + Math.floor(60 / totalBatches))
          
          // Small delay between batches to avoid overwhelming the API
          await sleep(200)
        }
        
        console.log('\n' + '='.repeat(80))
        console.log('✨ IMPORT COMPLETE!')
        console.log(`   Total imported: ${totalImported}/${newPlayers.length} players`)
        console.log('='.repeat(80) + '\n')
        
        updateStep(2, 'running', `Successfully imported all ${totalImported} players`, 90)
        await sleep(500)
      }

      updateStep(2, 'completed', `Successfully imported ${newPlayers.length} new players (${duplicateCount} duplicates skipped)`, 100)
      setOverallProgress(90)
      setCurrentStep(3)

      // Step 4: Finalize
      updateStep(3, 'running', 'Finalizing import...', 50)
      await sleep(500)
      updateStep(3, 'completed', 'Import completed successfully', 100)
      setOverallProgress(100)

      // Set summary
      setSummary({
        total_processed: players.length,
        new_players_created: newPlayers.length,
        existing_players_updated: 0,
        total_operations: newPlayers.length
      })

      setStatus('completed')
      sessionStorage.removeItem('validatedPlayers')
      sessionStorage.removeItem('parsedPlayers')
      
    } catch (error: any) {
      console.error('Import error:', error)
      updateStep(currentStep, 'failed', '', 0, error.message)
      setStatus('failed')
    }
  }

  const updateStep = (
    index: number,
    status: 'pending' | 'running' | 'completed' | 'failed',
    message: string = '',
    progress: number = 0,
    error: string = ''
  ) => {
    setSteps(prev => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        status,
        message,
        progress,
        error
      }
      return updated
    })
  }

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <div className="w-6 h-6 rounded-full bg-gray-300"></div>
      case 'running':
        return <div className="w-6 h-6 rounded-full bg-blue-500 animate-pulse"></div>
      case 'completed':
        return (
          <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'failed':
        return (
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        )
      default:
        return null
    }
  }

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'pending':
        return { border: 'border-gray-200', text: 'text-gray-600', bg: '' }
      case 'running':
        return { border: 'border-blue-200 bg-blue-50', text: 'text-blue-800', bg: 'bg-blue-50' }
      case 'completed':
        return { border: 'border-green-200 bg-green-50', text: 'text-green-800', bg: 'bg-green-50' }
      case 'failed':
        return { border: 'border-red-200 bg-red-50', text: 'text-red-800', bg: 'bg-red-50' }
      default:
        return { border: 'border-gray-200', text: 'text-gray-600', bg: '' }
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

  const statusIndicator = status === 'running' 
    ? { class: 'bg-blue-100 text-blue-800', text: 'Processing...' }
    : status === 'completed'
    ? { class: 'bg-green-100 text-green-800', text: 'Completed!' }
    : { class: 'bg-red-100 text-red-800', text: 'Failed' }

  return (
    <div className="container mx-auto px-4 py-4 sm:py-8 max-w-screen-xl">
      {/* Page Header */}
      <div className="glass rounded-3xl p-6 mb-8 shadow-lg backdrop-blur-md border border-white/20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">👥 Player Import in Progress</h1>
            <p className="text-gray-600 text-sm md:text-base">Importing players from SQL data to Neon database</p>
          </div>
          <div className="flex items-center">
            <div className={`flex items-center px-3 py-2 rounded-lg ${statusIndicator.class}`}>
              {status === 'running' && (
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              <span>{statusIndicator.text}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Overall Progress */}
      <div className="glass rounded-3xl p-6 mb-8 shadow-lg backdrop-blur-md border border-white/20">
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-semibold text-gray-800">Overall Progress</h2>
            <span className="text-2xl font-bold text-primary">{Math.round(overallProgress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className="bg-gradient-to-r from-primary to-primary-dark h-4 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${overallProgress}%` }}
            ></div>
          </div>
        </div>
        <div className="text-sm text-gray-600">
          <span className="block">{steps[currentStep]?.name || 'Preparing...'}</span>
          {steps[currentStep]?.message && (
            <span className="block text-xs text-gray-500 mt-1">{steps[currentStep].message}</span>
          )}
        </div>
      </div>

      {/* Detailed Steps */}
      <div className="glass rounded-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-r from-primary/5 to-primary/10 border-b border-primary/20">
          <h3 className="text-xl font-semibold text-primary flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
            Player Import Steps
          </h3>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            {steps.map((step, index) => {
              const statusClass = getStatusClass(step.status)
              return (
                <div key={index} className={`flex items-center p-4 rounded-lg border ${statusClass.border} ${statusClass.bg}`}>
                  <div className="flex-shrink-0 mr-4">
                    {getStatusIcon(step.status)}
                  </div>
                  <div className="flex-grow">
                    <h4 className={`font-medium ${statusClass.text}`}>{step.name}</h4>
                    <p className="text-sm text-gray-600">{step.description}</p>
                    {step.message && <p className="text-xs text-gray-500 mt-1">{step.message}</p>}
                    {step.error && <p className="text-xs text-red-600 mt-1">Error: {step.error}</p>}
                  </div>
                  <div className="flex-shrink-0 ml-4">
                    {step.status === 'running' && step.progress > 0 && (
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${step.progress}%` }}
                        ></div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Import Summary */}
      {status === 'completed' && (
        <div className="glass rounded-3xl p-6 mt-8 shadow-lg backdrop-blur-md border border-white/20">
          <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Import Statistics
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{summary.new_players_created}</div>
              <div className="text-sm text-gray-600">New Players</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{summary.existing_players_updated}</div>
              <div className="text-sm text-gray-600">Updated Players</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{summary.total_operations}</div>
              <div className="text-sm text-gray-600">Total Operations</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{summary.total_processed}</div>
              <div className="text-sm text-gray-600">Players Processed</div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-8 flex justify-center gap-4">
        {status === 'completed' && (
          <>
            <Link
              href="/dashboard/committee/players"
              className="inline-flex items-center px-6 py-3 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              View Players
            </Link>
            <Link
              href="/dashboard/committee/database"
              className="inline-flex items-center px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
              Back to Database
            </Link>
          </>
        )}
        {status === 'failed' && (
          <Link
            href="/dashboard/committee/database"
            className="inline-flex items-center px-6 py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Try Again
          </Link>
        )}
      </div>
    </div>
  )
}
