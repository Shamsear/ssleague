'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { db, auth } from '@/lib/firebase/config'
import { collection, addDoc, doc, getDoc, query, where, getDocs, Timestamp } from 'firebase/firestore'
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth'

interface Season {
  id: string
  name: string
  is_player_registration_open: boolean
}

interface Player {
  player_id: string
  name: string
  team?: string
  is_registered?: boolean
}

function PlayerVerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const seasonId = searchParams.get('season')
  const playerId = searchParams.get('player')

  const [season, setSeason] = useState<Season | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [signingIn, setSigningIn] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      if (!seasonId || !playerId) {
        setError('Missing required information')
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

        if (!seasonData.is_player_registration_open) {
          setError('Player registration is currently closed for this season')
          setLoading(false)
          return
        }

        setSeason(seasonData)

        // Fetch player from realplayers
        const playerQuery = query(
          collection(db, 'realplayers'),
          where('player_id', '==', playerId)
        )
        const playerSnapshot = await getDocs(playerQuery)

        if (playerSnapshot.empty) {
          setError('Player not found')
          setLoading(false)
          return
        }

        const playerData = playerSnapshot.docs[0].data() as Player

        // Check if already registered for this season
        const realPlayerQuery = query(
          collection(db, 'realplayer'),
          where('player_id', '==', playerId),
          where('season_id', '==', seasonId)
        )
        const realPlayerSnapshot = await getDocs(realPlayerQuery)

        if (!realPlayerSnapshot.empty) {
          setError('You are already registered for this season')
          setLoading(false)
          return
        }

        // Check if registered for another season
        const otherSeasonQuery = query(
          collection(db, 'realplayer'),
          where('player_id', '==', playerId)
        )
        const otherSeasonSnapshot = await getDocs(otherSeasonQuery)

        setPlayer({
          ...playerData,
          is_registered: !otherSeasonSnapshot.empty
        })
        setLoading(false)
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('Failed to load player details')
        setLoading(false)
      }
    }

    fetchData()
  }, [seasonId, playerId])
  
  // Fast polling for verification status when code is generated
  useEffect(() => {
    if (!verificationCode || step === 'verified') return
    
    let pollCount = 0
    const maxPolls = 180 // 6 minutes for email (admin might take time)
    
    const pollInterval = setInterval(async () => {
      pollCount++
      
      if (pollCount >= maxPolls) {
        clearInterval(pollInterval)
        if (verificationCode === 'email-pending') {
          setError('Admin approval timeout. Your request is still pending - please check back later or contact admin.')
        } else {
          setError('Verification timed out. Please try again.')
        }
        return
      }
      
      try {
        if (verificationCode === 'email-pending') {
          // Check email approval status
          const response = await fetch('/api/telegram/check-email-approval', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId, seasonId })
          })
          
          const data = await response.json()
          
          if (data.approved) {
            clearInterval(pollInterval)
            setStep('verified')
            setSuccess('✅ Approved by admin! Completing registration...')
            setTimeout(() => handleConfirm(), 1000)
          } else if (data.rejected) {
            clearInterval(pollInterval)
            setError(data.message)
            setStep('email')
          }
        } else {
          // Check Telegram verification
          const response = await fetch('/api/telegram/check-verification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ verificationCode })
          })
          
          const data = await response.json()
          
          if (data.verified) {
            clearInterval(pollInterval)
            setStep('verified')
            setSuccess('✅ Verified! Completing registration...')
            setTimeout(() => handleConfirm(), 1000)
          }
        }
      } catch (err) {
        console.error('Error checking verification:', err)
      }
    }, 3000) // Check every 3 seconds
    
    return () => clearInterval(pollInterval)
  }, [verificationCode, step, playerId, seasonId])
  
  const handleGenerateCode = async () => {
    setGeneratingCode(true)
    setError(null)
    setCopySuccess(false)
    
    try {
      const response = await fetch('/api/telegram/generate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, seasonId })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setVerificationCode(data.verificationCode)
        setStep('waiting')
        setSuccess('Code generated! Send it to the bot now.')
      } else {
        setError(data.error || 'Failed to generate code')
      }
    } catch (err) {
      console.error('Error generating code:', err)
      setError('Failed to generate verification code')
    } finally {
      setGeneratingCode(false)
    }
  }
  
  const handleCopyCode = async () => {
    if (!verificationCode) return
    
    try {
      await navigator.clipboard.writeText(verificationCode)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }
  
  const handleRequestEmailVerification = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address')
      return
    }
    
    setSubmittingEmail(true)
    setError(null)
    
    try {
      const response = await fetch('/api/telegram/request-email-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, seasonId, email, reason })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setSuccess('Email verification request submitted! Waiting for admin approval...')
        setStep('waiting')
        // Start polling for approval
        setVerificationCode('email-pending')
      } else {
        setError(data.error || 'Failed to submit request')
      }
    } catch (err) {
      console.error('Error submitting email request:', err)
      setError('Failed to submit verification request')
    } finally {
      setSubmittingEmail(false)
    }
  }

  const handleConfirm = async () => {
    if (!seasonId || !playerId || !player) return

    setSubmitting(true)
    try {
      // Create realplayer registration
      await addDoc(collection(db, 'realplayer'), {
        player_id: playerId,
        name: player.name,
        season_id: seasonId,
        registration_status: 'pending',
        is_active: true,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now()
      })

      // Redirect to success page
      router.push('/register/player/success')
    } catch (err) {
      console.error('Error confirming registration:', err)
      setError('Failed to complete registration. Please try again.')
      setSubmitting(false)
    }
  }

  const handleBack = () => {
    router.push(`/register/player?season=${seasonId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0066FF]/5 via-white to-[#00D4FF]/5 flex items-center justify-center p-4">
        <div className="glass rounded-3xl p-8 shadow-lg border border-white/20 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading player details...</p>
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
          <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Registration Error</h2>
          <p className="text-gray-600 text-center mb-6">{error}</p>
          <button
            onClick={handleBack}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#0066FF] to-[#00D4FF] text-white font-medium hover:shadow-lg transition-all"
          >
            Back to Search
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0066FF]/5 via-white to-[#00D4FF]/5 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="glass rounded-3xl shadow-lg border border-white/20 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4 text-white">
            <h1 className="text-2xl font-bold flex items-center">
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Verify Player Details
            </h1>
            {season && <p className="text-green-100 text-sm mt-1">{season.name}</p>}
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <div className="flex items-center text-blue-700">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <strong>Player Found!</strong> Please verify that the details below are correct before completing your registration.
              </div>
            </div>

            {/* Player Details */}
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="font-semibold text-gray-700">Player ID:</span>
                  <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-semibold">
                    {player?.player_id}
                  </span>
                </div>

                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="font-semibold text-gray-700">Name:</span>
                  <span className="text-gray-900">{player?.name}</span>
                </div>

                {player?.team && (
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="font-semibold text-gray-700">Previous Team:</span>
                    <span className="text-gray-900">{player.team}</span>
                  </div>
                )}

                <div className="flex justify-between py-2">
                  <span className="font-semibold text-gray-700">Registration Status:</span>
                  <span className={`${player?.is_registered ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'} px-3 py-1 rounded-full text-sm font-semibold`}>
                    {player?.is_registered ? 'Registered (Other Season)' : 'Not Registered'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <h3 className="text-amber-800 font-semibold mb-2 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Important:
              </h3>
              <ul className="text-amber-700 space-y-1 ml-4">
                <li>• Please ensure all your details are correct</li>
                <li>• Once registered, you cannot change seasons without admin approval</li>
                <li>• Your registration will be reviewed by committee admins</li>
              </ul>
            </div>

            {/* Telegram Verification Section */}
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6 mb-6 border border-blue-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-. 913.485-1.469.406-.828-1.406-.504-1.577-.639-.609-.075-.609-.453.041-.674 4.776-2.084 7.948-3.467 9.537-4.15 4.545-1.897 5.49-2.218 6.105-2.228.135 0 .437.031.633.188.167.131.212.306.234.432-.001.068.015.286-.001.442z"/>
                </svg>
                Verify via Telegram (Free & Fast)
              </h3>
              
              {step === 'telegram' && (
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-blue-100 to-cyan-100 border-2 border-blue-300 rounded-xl p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-lg">1</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-blue-900 mb-1">
                          Quick & Free Verification
                        </p>
                        <p className="text-sm text-blue-800">
                          Get a code instantly and verify in seconds via Telegram
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={handleGenerateCode}
                    disabled={generatingCode}
                    className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-lg"
                  >
                    {generatingCode ? (
                      <>
                        <div className="animate-spin rounded-full h-6 w-6 border-3 border-white border-t-transparent"></div>
                        <span>Generating Code...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.485-1.302.485-.428 0-1.252-.241-1.865-.442-.751-.245-1.349-.374-1.297-.791.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635.099 0 .321.023.465.141.122.099.155.232.171.325.016.093.036.305.02.47z"/>
                        </svg>
                        <span>Get Verification Code</span>
                      </>
                    )}
                  </button>
                  
                  <div className="border-t-2 border-gray-200 pt-4 mt-2">
                    <p className="text-xs text-gray-500 text-center mb-3">
                      Don't have Telegram?
                    </p>
                    <button
                      onClick={() => setStep('email')}
                      className="w-full py-2.5 px-4 bg-gray-50 hover:bg-gray-100 border border-gray-300 text-gray-700 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Request Admin Verification via Email
                    </button>
                  </div>
                </div>
              )}
              
              {step === 'waiting' && verificationCode && (
                <div className="space-y-4 animate-fade-in">
                  {/* Success Header */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex-shrink-0 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-bold text-green-900 text-lg">Code Generated!</p>
                        <p className="text-sm text-green-700">Send it to our Telegram bot</p>
                      </div>
                    </div>
                    
                    {/* Code Display */}
                    <div className="relative">
                      <div className="bg-white rounded-xl p-6 border-2 border-green-400 shadow-lg">
                        <p className="text-center text-5xl font-mono font-black text-gray-900 tracking-[0.5em] select-all">
                          {verificationCode}
                        </p>
                      </div>
                      <button
                        onClick={handleCopyCode}
                        className="absolute top-2 right-2 p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors shadow-md"
                        title="Copy code"
                      >
                        {copySuccess ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {/* Steps */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold">2</span>
                      </div>
                      <div>
                        <p className="font-semibold text-blue-900">Open Telegram</p>
                        <p className="text-sm text-blue-700">Click the button below or search for <span className="font-mono bg-blue-100 px-2 py-0.5 rounded">@{process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}</span></p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold">3</span>
                      </div>
                      <div>
                        <p className="font-semibold text-blue-900">Send the Code</p>
                        <p className="text-sm text-blue-700">Paste or type the 6-digit code</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Open Telegram Button */}
                  <a
                    href={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3 text-lg"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.485-1.302.485-.428 0-1.252-.241-1.865-.442-.751-.245-1.349-.374-1.297-.791.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635.099 0 .321.023.465.141.122.099.155.232.171.325.016.093.036.305.02.47z"/>
                    </svg>
                    <span>Open Telegram Now</span>
                  </a>
                  
                  {/* Waiting Status */}
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4">
                    <div className="flex items-center justify-center gap-3">
                      <div className="relative">
                        <div className="w-4 h-4 bg-purple-600 rounded-full animate-ping absolute"></div>
                        <div className="w-4 h-4 bg-purple-600 rounded-full"></div>
                      </div>
                      <p className="text-sm font-medium text-purple-800">
                        Waiting for verification... <span className="text-purple-600">This page will update automatically</span>
                      </p>
                    </div>
                  </div>
                  
                  {/* Cancel Button */}
                  <button
                    onClick={() => {
                      setStep('telegram')
                      setVerificationCode(null)
                      setError(null)
                      setSuccess(null)
                    }}
                    className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Cancel & Go Back
                  </button>
                </div>
              )}
              
              {step === 'email' && (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-amber-800">
                      <strong>Email Verification Request</strong>
                    </p>
                    <p className="text-sm text-amber-700 mt-1">
                      If you don't have Telegram, submit your email below. A committee admin will review and approve your registration.
                    </p>
                  </div>
                  
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
                      Reason (Optional)
                    </label>
                    <textarea
                      id="reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Why are you requesting email verification?"
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <button
                    onClick={handleRequestEmailVerification}
                    disabled={submittingEmail || !email}
                    className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submittingEmail ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Submitting...
                      </>
                    ) : (
                      'Submit Verification Request'
                    )}
                  </button>
                  
                  <button
                    onClick={() => setStep('telegram')}
                    className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors text-sm"
                  >
                    ← Back to Telegram Verification
                  </button>
                </div>
              )}
              
              {step === 'verified' && (
                <div className="text-center py-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-3">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-lg font-semibold text-green-600">Verification Successful!</p>
                  <p className="text-sm text-gray-600 mt-1">{success || 'Completing your registration...'}</p>
                </div>
              )}
            </div>

            {success && (
              <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200">
                <p className="text-green-600 text-sm">{success}</p>
              </div>
            )}
            
            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              {step !== 'verified' && (
                <button
                  onClick={handleBack}
                  disabled={submitting || generatingCode || submittingEmail}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl transition-colors duration-200 flex items-center justify-center disabled:opacity-50"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Search
                </button>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="text-center">
              <p className="text-sm text-gray-600 flex items-center justify-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Your information is securely managed by the committee admins
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            <strong>Need to update your details?</strong><br />
            Contact the committee admins to make changes to your player profile.
          </p>
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
