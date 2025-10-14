'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { db } from '@/lib/firebase/config'
import { collection, addDoc, doc, getDoc, query, where, getDocs, Timestamp } from 'firebase/firestore'

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

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                {submitting ? 'Confirming...' : `Confirm & Register for ${season?.name}`}
              </button>

              <button
                onClick={handleBack}
                disabled={submitting}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl transition-colors duration-200 flex items-center justify-center disabled:opacity-50"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Search
              </button>
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
