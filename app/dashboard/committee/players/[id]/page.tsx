'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import Image from 'next/image'
import { PlayerCard } from '@/components/PlayerImage'

interface FootballPlayer {
  id: string
  player_id: string
  name: string
  position?: string
  overall_rating?: number
  nationality?: string
  playing_style?: string
  foot?: string
  age?: number
  nfl_team?: string
  club?: string
  team?: {
    id: string
    name: string
  }
  team_id?: string
  acquisition_value?: number
  acquired_at?: any
  round_id?: string
  is_auction_eligible?: boolean
  // Stats
  speed?: number
  acceleration?: number
  ball_control?: number
  dribbling?: number
  tight_possession?: number
  offensive_awareness?: number
  defensive_awareness?: number
  tackling?: number
  defensive_engagement?: number
  low_pass?: number
  lofted_pass?: number
  finishing?: number
  heading?: number
  stamina?: number
  physical_contact?: number
  kicking_power?: number
  gk_awareness?: number
  gk_catching?: number
  gk_parrying?: number
  gk_reflexes?: number
  gk_reach?: number
  [key: string]: any
}

interface StatsBarProps {
  label: string
  value: number
}

const StatsBar = ({ label, value }: StatsBarProps) => {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    setTimeout(() => setWidth(value), 200)
  }, [value])

  const getBarColor = (val: number) => {
    if (val >= 85) return 'bg-green-400 shadow'
    if (val >= 75) return 'bg-blue-400 shadow'
    if (val >= 65) return 'bg-yellow-400 shadow'
    return 'bg-gray-400 shadow'
  }

  return (
    <div className="bg-white/50 rounded-xl p-3 hover:bg-white/60 transition-all duration-300">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-gray-700 font-medium">{label}</span>
        <span className="text-xs font-medium bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full">
          {value}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5 shadow-inner overflow-hidden">
        <div
          className={`h-2.5 rounded-full transition-all duration-700 ${getBarColor(value)}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

export default function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [player, setPlayer] = useState<FootballPlayer | null>(null)
  const [loading, setLoading] = useState(true)
  const [imageError, setImageError] = useState(false)
  const [awards, setAwards] = useState<any[]>([])
  const [loadingAwards, setLoadingAwards] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
    if (!authLoading && user && user.role !== 'committee_admin') {
      router.push('/dashboard')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    const fetchPlayer = async () => {
      try {
        // Fetch from Neon database via API
        const response = await fetch(`/api/players/${resolvedParams.id}`, {
          headers: { 'Cache-Control': 'no-cache' },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch player details');
        }

        const result = await response.json();

        if (result.success && result.data.player) {
          const data = result.data.player;
          const playerData = {
            id: data.id.toString(),
            player_id: data.player_id || data.id.toString(),
            name: data.name,
            position: data.position,
            overall_rating: data.overall_rating,
            nationality: data.nationality,
            playing_style: data.playing_style,
            foot: data.foot,
            age: data.age,
            nfl_team: data.nfl_team,
            club: data.club || data.team_name,
            team: data.team ? {
              id: data.team.id.toString(),
              name: data.team.name
            } : undefined,
            team_id: data.team_id?.toString(),
            acquisition_value: data.acquisition_value,
            acquired_at: data.acquired_at,
            round_id: data.round_id,
            is_auction_eligible: data.is_auction_eligible,
            // Stats
            speed: data.speed,
            acceleration: data.acceleration,
            ball_control: data.ball_control,
            dribbling: data.dribbling,
            tight_possession: data.tight_possession,
            offensive_awareness: data.offensive_awareness,
            defensive_awareness: data.defensive_awareness,
            tackling: data.tackling,
            defensive_engagement: data.defensive_engagement,
            low_pass: data.low_pass,
            lofted_pass: data.lofted_pass,
            finishing: data.finishing,
            heading: data.heading,
            stamina: data.stamina,
            physical_contact: data.physical_contact,
            kicking_power: data.kicking_power,
            gk_awareness: data.gk_awareness,
            gk_catching: data.gk_catching,
            gk_parrying: data.gk_parrying,
            gk_reflexes: data.gk_reflexes,
            gk_reach: data.gk_reach,
          } as FootballPlayer;
          
          setPlayer(playerData);
          
          // Fetch awards for this player
          fetchPlayerAwards(playerData.player_id);
        } else {
          alert('Player not found');
          router.push('/dashboard/committee/players');
        }
      } catch (err) {
        console.error('Error fetching player:', err);
        alert('Failed to load player details');
      } finally {
        setLoading(false);
      }
    };

    if (user?.role === 'committee_admin') {
      fetchPlayer();
    }
  }, [user, resolvedParams.id, router])
  
  const fetchPlayerAwards = async (playerId: string) => {
    setLoadingAwards(true);
    try {
      const response = await fetch(`/api/awards?player_id=${playerId}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setAwards(result.data);
      }
    } catch (err) {
      console.error('Error fetching awards:', err);
    } finally {
      setLoadingAwards(false);
    }
  };

  const getPositionColor = (position?: string) => {
    switch (position) {
      case 'QB': return 'bg-red-100 text-red-800'
      case 'RB': return 'bg-blue-100 text-blue-800'
      case 'WR': return 'bg-green-100 text-green-800'
      case 'TE': return 'bg-purple-100 text-purple-800'
      case 'K': return 'bg-yellow-100 text-yellow-800'
      case 'DST': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRatingColor = (rating?: number) => {
    if (!rating) return 'from-gray-400 to-gray-500'
    if (rating >= 85) return 'from-green-400 to-green-500'
    if (rating >= 75) return 'from-blue-400 to-blue-500'
    if (rating >= 65) return 'from-yellow-400 to-yellow-500'
    return 'from-gray-400 to-gray-500'
  }

  const getRatingBadgeColor = (rating?: number) => {
    if (!rating) return 'bg-gray-100 text-gray-800'
    if (rating >= 85) return 'bg-green-100 text-green-800'
    if (rating >= 75) return 'bg-blue-100 text-blue-800'
    if (rating >= 65) return 'bg-yellow-100 text-yellow-800'
    return 'bg-gray-100 text-gray-800'
  }

  const getRatingLabel = (rating?: number) => {
    if (!rating) return 'Unrated'
    if (rating >= 85) return 'Elite'
    if (rating >= 75) return 'Excellent'
    if (rating >= 65) return 'Good'
    return 'Unrated'
  }

  const getKeyStats = (position?: string) => {
    if (!player) return []

    switch (position) {
      case 'GK':
        return [
          { label: 'GK Awareness', value: player.gk_awareness || 0 },
          { label: 'GK Catching', value: player.gk_catching || 0 },
          { label: 'GK Parrying', value: player.gk_parrying || 0 },
          { label: 'GK Reflexes', value: player.gk_reflexes || 0 },
          { label: 'GK Reach', value: player.gk_reach || 0 },
          { label: 'Defensive Awareness', value: player.defensive_awareness || 0 }
        ]
      case 'CB':
      case 'RB':
      case 'LB':
        return [
          { label: 'Defensive Awareness', value: player.defensive_awareness || 0 },
          { label: 'Tackling', value: player.tackling || 0 },
          { label: 'Defensive Engagement', value: player.defensive_engagement || 0 },
          { label: 'Physical Contact', value: player.physical_contact || 0 },
          { label: 'Ball Control', value: player.ball_control || 0 },
          { label: 'Speed', value: player.speed || 0 }
        ]
      case 'DMF':
        return [
          { label: 'Defensive Awareness', value: player.defensive_awareness || 0 },
          { label: 'Tackling', value: player.tackling || 0 },
          { label: 'Ball Control', value: player.ball_control || 0 },
          { label: 'Low Pass', value: player.low_pass || 0 },
          { label: 'Stamina', value: player.stamina || 0 },
          { label: 'Physical Contact', value: player.physical_contact || 0 }
        ]
      case 'CMF':
        return [
          { label: 'Ball Control', value: player.ball_control || 0 },
          { label: 'Low Pass', value: player.low_pass || 0 },
          { label: 'Lofted Pass', value: player.lofted_pass || 0 },
          { label: 'Offensive Awareness', value: player.offensive_awareness || 0 },
          { label: 'Dribbling', value: player.dribbling || 0 },
          { label: 'Stamina', value: player.stamina || 0 }
        ]
      case 'RMF':
      case 'LMF':
        return [
          { label: 'Speed', value: player.speed || 0 },
          { label: 'Acceleration', value: player.acceleration || 0 },
          { label: 'Dribbling', value: player.dribbling || 0 },
          { label: 'Ball Control', value: player.ball_control || 0 },
          { label: 'Lofted Pass', value: player.lofted_pass || 0 },
          { label: 'Tight Possession', value: player.tight_possession || 0 }
        ]
      case 'AMF':
        return [
          { label: 'Offensive Awareness', value: player.offensive_awareness || 0 },
          { label: 'Ball Control', value: player.ball_control || 0 },
          { label: 'Dribbling', value: player.dribbling || 0 },
          { label: 'Tight Possession', value: player.tight_possession || 0 },
          { label: 'Low Pass', value: player.low_pass || 0 },
          { label: 'Finishing', value: player.finishing || 0 }
        ]
      case 'SS':
        return [
          { label: 'Offensive Awareness', value: player.offensive_awareness || 0 },
          { label: 'Finishing', value: player.finishing || 0 },
          { label: 'Ball Control', value: player.ball_control || 0 },
          { label: 'Dribbling', value: player.dribbling || 0 },
          { label: 'Speed', value: player.speed || 0 },
          { label: 'Acceleration', value: player.acceleration || 0 }
        ]
      case 'CF':
        return [
          { label: 'Finishing', value: player.finishing || 0 },
          { label: 'Offensive Awareness', value: player.offensive_awareness || 0 },
          { label: 'Physical Contact', value: player.physical_contact || 0 },
          { label: 'Heading', value: player.heading || 0 },
          { label: 'Ball Control', value: player.ball_control || 0 },
          { label: 'Kicking Power', value: player.kicking_power || 0 }
        ]
      default:
        return [
          { label: 'Speed', value: player.speed || 0 },
          { label: 'Ball Control', value: player.ball_control || 0 },
          { label: 'Dribbling', value: player.dribbling || 0 },
          { label: 'Offensive Awareness', value: player.offensive_awareness || 0 },
          { label: 'Stamina', value: player.stamina || 0 },
          { label: 'Physical Contact', value: player.physical_contact || 0 }
        ]
    }
  }

  const getAdditionalStats = () => {
    if (!player) return []

    const mainStatsKeys = [
      'speed', 'acceleration', 'ball_control', 'dribbling', 'tight_possession',
      'offensive_awareness', 'defensive_awareness', 'tackling', 'defensive_engagement',
      'low_pass', 'lofted_pass', 'finishing', 'heading', 'stamina',
      'physical_contact', 'kicking_power',
      'gk_awareness', 'gk_catching', 'gk_parrying', 'gk_reflexes', 'gk_reach',
      'id', 'player_id', 'name', 'position', 'overall_rating', 'nationality',
      'playing_style', 'foot', 'age', 'nfl_team', 'club', 'team', 'team_id',
      'acquisition_value', 'acquired_at', 'round_id', 'is_auction_eligible'
    ]

    return Object.entries(player)
      .filter(([key, value]) => !mainStatsKeys.includes(key) && value && typeof value === 'number')
      .map(([key, value]) => ({
        name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value
      }))
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading player details...</p>
        </div>
      </div>
    )
  }

  if (!user || user.role !== 'committee_admin' || !player) {
    return null
  }

  const keyStats = getKeyStats(player.position)
  const additionalStats = getAdditionalStats()

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="glass rounded-3xl p-6 sm:p-8 max-w-5xl mx-auto hover:shadow-lg transition-all duration-300">
        {/* Header with Back Button (hidden on mobile) */}
        <div className="flex items-center justify-between mb-8 hidden sm:flex">
          <Link
            href="/dashboard/committee/players"
            className="flex items-center text-gray-600 hover:text-primary transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to All Players</span>
          </Link>

          <div className="flex items-center">
            <span className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-600">
              Player ID: {player.player_id}
            </span>
          </div>
        </div>

        {/* Player ID Display (mobile only) */}
        <div className="flex justify-end mb-8 sm:hidden">
          <div className="flex items-center">
            <span className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-600">
              Player ID: {player.player_id}
            </span>
          </div>
        </div>

        {/* Two-column layout for player info and statistics */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Column - Player Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Player Card */}
            <div className="bg-white/60 rounded-2xl p-6 shadow-md border border-white/20">
              {/* Player Image */}
              <div className="relative w-40 h-40 mx-auto mb-4">
                <PlayerCard
                  playerId={player.player_id || player.id}
                  playerName={player.name}
                  priority={true}
                />
                <div className="absolute bottom-0 right-0 bg-primary text-white text-xs font-bold py-1 px-2 rounded-tl-lg shadow-lg">
                  {player.overall_rating || '--'}
                </div>
              </div>

              {/* Player Basic Info */}
              <div className="text-center">
                <h1 className="text-2xl font-bold text-dark mb-1">{player.name}</h1>
                <div className="flex items-center justify-center mb-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${getPositionColor(player.position)}`}>
                    {player.position}
                  </span>

                  {player.nfl_team && (
                    <span className="ml-2 text-xs text-gray-500">{player.nfl_team}</span>
                  )}
                </div>
              </div>

              {/* Player Details */}
              <div className="space-y-3 text-sm border-t border-gray-200 pt-4">
                {(player.club || player.team_name) && (
                  <div className="flex justify-between items-center bg-blue-50/50 -mx-3 px-3 py-2 rounded">
                    <span className="text-gray-500 flex items-center">
                      Real Club:
                      <span className="ml-1 text-xs text-gray-400" title="Player's real-world club (informational)">
                        ⓘ
                      </span>
                    </span>
                    <span className="font-medium text-blue-700">{player.club || player.team_name}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Nationality:</span>
                  <span className="font-medium text-gray-700">{player.nationality || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Playing Style:</span>
                  <span className="font-medium text-gray-700">{player.playing_style || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Preferred Foot:</span>
                  <span className="font-medium text-gray-700">{player.foot || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Age:</span>
                  <span className="font-medium text-gray-700">{player.age || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Acquisition Details */}
            <div className="glass rounded-2xl p-6 shadow-md border border-white/20 bg-white/60 hover:bg-white/70 transition-all duration-300 transform hover:scale-[1.01]">
              <h3 className="text-lg font-semibold text-dark mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Tournament Team
              </h3>
              <p className="text-xs text-gray-500 mb-4">Player's assignment in your tournament</p>
              <div className="space-y-4">
                <div className="glass rounded-xl p-4 bg-white/40 hover:bg-white/50 transition-all duration-300 shadow-sm">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Team</p>
                  <p className="text-xl font-bold text-dark">
                    {player.team ? (
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        {player.team.name}
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Free Agent
                      </span>
                    )}
                  </p>
                </div>

                <div className="glass rounded-xl p-4 bg-white/40 hover:bg-white/50 transition-all duration-300 shadow-sm">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Cost</p>
                  <p className="text-xl font-bold text-dark">
                    {player.team && player.acquisition_value ? (
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        £{player.acquisition_value.toLocaleString()}
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Free Transfer
                      </span>
                    )}
                  </p>
                </div>

                {player.acquired_at && (
                  <div className="glass rounded-xl p-4 bg-white/40 hover:bg-white/50 transition-all duration-300 shadow-sm">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Acquired On</p>
                    <p className="text-xl font-bold text-dark">
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {new Date(player.acquired_at.seconds * 1000).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                    </p>
                  </div>
                )}

                {!player.acquired_at && player.round_id && (
                  <div className="glass rounded-xl p-4 bg-white/40 hover:bg-white/50 transition-all duration-300 shadow-sm">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Acquired Via</p>
                    <p className="text-xl font-bold text-dark">
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Round #{player.round_id} auction
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Awards Section */}
            {awards.length > 0 && (
              <div className="glass rounded-2xl p-6 shadow-md border border-white/20 bg-gradient-to-br from-yellow-50 to-amber-50 hover:from-yellow-100 hover:to-amber-100 transition-all duration-300">
                <h3 className="text-lg font-semibold text-dark mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  🏆 Awards & Honors
                </h3>
                <div className="space-y-3">
                  {awards.map((award) => (
                    <div key={award.id} className="bg-white/80 rounded-xl p-4 shadow-sm border border-yellow-200 hover:shadow-md transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-2xl">
                              {award.award_type === 'POTD' && '⭐'}
                              {award.award_type === 'POTW' && '🌟'}
                              {award.award_type === 'TOD' && '🏅'}
                              {award.award_type === 'TOW' && '🏆'}
                              {award.award_type === 'POTS' && '👑'}
                              {award.award_type === 'TOTS' && '🏆'}
                            </span>
                            <span className="font-bold text-gray-900">
                              {award.award_type === 'POTD' && 'Player of the Day'}
                              {award.award_type === 'POTW' && 'Player of the Week'}
                              {award.award_type === 'TOD' && 'Team of the Day'}
                              {award.award_type === 'TOW' && 'Team of the Week'}
                              {award.award_type === 'POTS' && 'Player of the Season'}
                              {award.award_type === 'TOTS' && 'Team of the Season'}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600">
                            {award.round_number && `Round ${award.round_number}`}
                            {award.week_number && `Week ${award.week_number}`}
                            {award.selected_at && ` • ${new Date(award.selected_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Stats */}
          <div className="lg:col-span-3 space-y-6">
            {/* Overall Rating */}
            <div className="bg-white/60 rounded-2xl p-6 shadow-md border border-white/20">
              <h3 className="text-lg font-semibold text-dark mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                Overall Rating
              </h3>
              <div className="flex items-center">
                <div className={`w-24 h-24 bg-gradient-to-br ${getRatingColor(player.overall_rating)} rounded-full flex items-center justify-center shadow-lg`}>
                  <span className="text-4xl font-bold text-white">{player.overall_rating || '--'}</span>
                </div>
                <div className="ml-6">
                  <h4 className="text-lg font-semibold text-dark">{player.name}</h4>
                  <p className="text-gray-500">
                    {player.position} {player.nfl_team && ` - ${player.nfl_team}`}
                  </p>

                  <div className="mt-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${getRatingBadgeColor(player.overall_rating)}`}>
                      {getRatingLabel(player.overall_rating)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Stats Based on Position */}
            <div className="bg-white/60 rounded-2xl p-6 shadow-md border border-white/20">
              <h3 className="text-lg font-semibold text-dark mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Key Attributes
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {keyStats.map((stat, index) => (
                  <StatsBar key={index} label={stat.label} value={stat.value} />
                ))}
              </div>
            </div>

            {/* Additional Stats */}
            {additionalStats.length > 0 && (
              <div className="bg-white/60 rounded-2xl p-6 shadow-md border border-white/20">
                <h3 className="text-lg font-semibold text-dark mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Additional Statistics
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {additionalStats.map((stat, index) => (
                    <div key={index} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-1">{stat.name}</p>
                      <p className="text-base font-medium text-dark">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {additionalStats.length === 0 && (
              <div className="bg-white/60 rounded-2xl p-6 shadow-md border border-white/20">
                <h3 className="text-lg font-semibold text-dark mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Additional Statistics
                </h3>

                <div className="text-center py-4 text-gray-500">
                  <p>No additional statistics available</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
