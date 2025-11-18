'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCachedSeasons } from '@/hooks/useCachedFirebase';

const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'DMF', 'CMF', 'AMF', 'LMF', 'RMF', 'LWF', 'RWF', 'SS', 'CF'];
const MAX_PLAYERS_PER_TEAM = 25;

interface Owner {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  photo_url?: string;
  bio?: string;
  place?: string;
  nationality?: string;
}

interface Manager {
  id: string;
  name: string;
  is_player: boolean;
  photo_url?: string;
  email?: string;
  phone?: string;
  place?: string;
  nationality?: string;
}

interface TeamProfile {
  name: string;
  logoUrl?: string;
  managerName: string;
  playerCount: number;
  totalBids: number;
  wonBids: number;
  remainingBalance: number;
  totalSpent: number;
  initialBudget: number;
  positionCounts: { [key: string]: number };
  currencySystem?: string;
  footballBudget?: number;
  realPlayerBudget?: number;
  footballSpent?: number;
  realPlayerSpent?: number;
}

interface Player {
  id: string;
  name: string;
  position: string;
  overall_rating: number;
  acquisition_value: number;
}

export default function TeamProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profileData, setProfileData] = useState<TeamProfile | null>(null);
  const [recentPlayers, setRecentPlayers] = useState<Player[]>([]);
  const [topPlayers, setTopPlayers] = useState<Player[]>([]);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [manager, setManager] = useState<Manager | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Fetch active season using the same hook as main dashboard
  const { data: activeSeasons, isLoading: seasonsLoading } = useCachedSeasons(
    user?.role === 'team' ? { isActive: 'true' } : undefined
  );

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user || !activeSeasons || activeSeasons.length === 0) return;

      try {
        setIsLoading(true);
        
        const seasonId = activeSeasons[0].id;

        // Fetch dashboard data from API
        const response = await fetch(`/api/team/dashboard?season_id=${seasonId}`, {
          headers: { 'Cache-Control': 'no-cache' },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Dashboard API error:', response.status, errorText);
          setError(`API Error: ${response.status} - ${errorText}`);
          throw new Error('Failed to fetch dashboard data');
        }

        const { success, data } = await response.json();
        console.log('Dashboard data received:', { success, hasData: !!data });

        if (success && data) {
          const currencySystem = data.team.currency_system || 'single';
          const isDual = currencySystem === 'dual';

          setProfileData({
            name: data.team.name,
            logoUrl: data.team.logo_url,
            managerName: user.username || 'Manager',
            playerCount: data.stats.playerCount,
            totalBids: data.stats.activeBidsCount + data.roundResults.length,
            wonBids: data.roundResults.length,
            remainingBalance: isDual ? 0 : data.stats.balance,
            totalSpent: isDual ? data.team.football_spent : data.stats.totalSpent,
            initialBudget: isDual ? 0 : 15000,
            positionCounts: data.stats.positionBreakdown || {},
            currencySystem,
            footballBudget: isDual ? data.team.football_budget : undefined,
            realPlayerBudget: isDual ? data.team.real_player_budget : undefined,
            footballSpent: isDual ? data.team.football_spent : undefined,
            realPlayerSpent: isDual ? data.team.real_player_spent : undefined,
          });

          // Set recent players (last 5)
          const recentPlayersList = data.players.slice(0, 5);
          setRecentPlayers(recentPlayersList);

          // Set top players (sorted by rating)
          const topPlayersList = [...data.players]
            .sort((a: Player, b: Player) => b.overall_rating - a.overall_rating)
            .slice(0, 5);
          setTopPlayers(topPlayersList);

          // Set owner and manager data
          setOwner(data.owner);
          setManager(data.manager);
        }
      } catch (error: any) {
        console.error('Error fetching profile:', error);
        setError(error.message || 'Unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileData();
  }, [user, activeSeasons]);

  if (loading || isLoading || seasonsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'team') {
    return null;
  }

  if (!profileData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center p-4 bg-red-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Unable to load profile</h3>
          <p className="text-gray-600 mb-4">Please make sure you are registered for the current season.</p>
          {error && (
            <div className="mb-4 p-3 bg-gray-100 rounded-lg text-sm text-gray-700 max-w-md mx-auto">
              <strong>Error:</strong> {error}
            </div>
          )}
          <Link href="/dashboard/team" className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700">
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
      {/* Header Section */}
      <div className="glass rounded-3xl p-6 sm:p-8 mb-6 sm:mb-8 hover:shadow-lg transition-all duration-300">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
          {/* Team Logo Section */}
          <div className="relative group">
            {profileData.logoUrl ? (
              <Image
                src={profileData.logoUrl}
                alt={`${profileData.name} logo`}
                width={128}
                height={128}
                className="w-32 h-32 rounded-2xl object-contain border-4 border-primary/20 shadow-xl group-hover:shadow-2xl transition-all duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="w-32 h-32 bg-gradient-to-br from-primary to-primary-dark rounded-2xl flex items-center justify-center border-4 border-primary/20 shadow-xl group-hover:shadow-2xl transition-all duration-300 group-hover:scale-105">
                <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            )}
            {/* Edit button overlay */}
            <Link
              href="/dashboard/team/profile/edit"
              className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            >
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </Link>
          </div>

          {/* Team Information */}
          <div className="flex-grow">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
              <h1 className="text-3xl sm:text-4xl font-bold text-dark">{profileData.name}</h1>
              <Link
                href="/dashboard/team/profile/edit"
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Profile
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white/50 rounded-xl p-3">
                <p className="text-xs text-gray-600 mb-1">Owner</p>
                <p className="text-lg font-semibold text-dark">{owner?.name || 'Not set'}</p>
              </div>
              <div className="bg-white/50 rounded-xl p-3">
                <p className="text-xs text-gray-600 mb-1">Manager</p>
                <p className="text-lg font-semibold text-dark">{manager?.name || 'Not set'}</p>
              </div>
              <div className="bg-white/50 rounded-xl p-3">
                <p className="text-xs text-gray-600 mb-1">Players</p>
                <p className="text-lg font-semibold text-dark">{profileData.playerCount}/{MAX_PLAYERS_PER_TEAM}</p>
              </div>
              <div className="bg-white/50 rounded-xl p-3">
                <p className="text-xs text-gray-600 mb-1">Won Bids</p>
                <p className="text-lg font-semibold text-dark">{profileData.wonBids}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Statistics */}
      <div className="glass rounded-3xl p-6 sm:p-8 mb-6 sm:mb-8 hover:shadow-lg transition-all duration-300">
        <div className="flex items-center mb-6">
          <svg className="w-6 h-6 text-primary mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-2xl font-bold text-dark">Financial Overview</h2>
        </div>

        {profileData.currencySystem === 'dual' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white">
              <div className="flex items-center justify-between mb-3">
                <svg className="w-10 h-10 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="text-3xl font-bold">eCoin {(profileData.footballBudget || 0).toLocaleString()}</span>
              </div>
              <p className="text-white/90 font-medium">eCoin Budget</p>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white">
              <div className="flex items-center justify-between mb-3">
                <svg className="w-10 h-10 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-3xl font-bold">SSCoin {(profileData.realPlayerBudget || 0).toLocaleString()}</span>
              </div>
              <p className="text-white/90 font-medium">SSCoin Budget</p>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white">
              <div className="flex items-center justify-between mb-3">
                <svg className="w-10 h-10 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="text-3xl font-bold">eCoin {(profileData.footballSpent || 0).toLocaleString()}</span>
              </div>
              <p className="text-white/90 font-medium">eCoin Spent</p>
            </div>

            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white">
              <div className="flex items-center justify-between mb-3">
                <svg className="w-10 h-10 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="text-3xl font-bold">SSCoin {(profileData.realPlayerSpent || 0).toLocaleString()}</span>
              </div>
              <p className="text-white/90 font-medium">SSCoin Spent</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white">
              <div className="flex items-center justify-between mb-3">
                <svg className="w-10 h-10 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="text-3xl font-bold">eCoin {profileData.remainingBalance.toLocaleString()}</span>
              </div>
              <p className="text-white/90 font-medium">Current Balance</p>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white">
              <div className="flex items-center justify-between mb-3">
                <svg className="w-10 h-10 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="text-3xl font-bold">eCoin {profileData.totalSpent.toLocaleString()}</span>
              </div>
              <p className="text-white/90 font-medium">Total Spent</p>
            </div>

            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white">
              <div className="flex items-center justify-between mb-3">
                <svg className="w-10 h-10 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="text-3xl font-bold">eCoin {profileData.initialBudget.toLocaleString()}</span>
              </div>
              <p className="text-white/90 font-medium">Initial Budget</p>
            </div>
          </div>
        )}
      </div>

      {/* Position Breakdown */}
      <div className="glass rounded-3xl p-6 sm:p-8 mb-6 sm:mb-8 hover:shadow-lg transition-all duration-300">
        <div className="flex items-center mb-6">
          <svg className="w-6 h-6 text-primary mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
          <h2 className="text-2xl font-bold text-dark">Squad Composition</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {POSITIONS.map((position) => {
            const count = profileData.positionCounts[position] || 0;
            return (
              <div key={position} className="bg-white/50 rounded-xl p-4 text-center hover:bg-white/70 transition-all duration-300">
                <div
                  className={`w-14 h-14 mx-auto mb-2 rounded-full flex items-center justify-center text-white font-bold text-xl ${
                    count === 0 ? 'bg-gray-200' : count >= 2 ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                >
                  {count}
                </div>
                <p className="text-sm font-medium text-dark">{position}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Owner & Manager Section */}
      {(owner || manager) && (
        <div className="glass rounded-3xl p-6 sm:p-8 mb-6 sm:mb-8 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center mb-6">
            <svg className="w-6 h-6 text-primary mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h2 className="text-2xl font-bold text-dark">Team Management</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Owner Card */}
            {owner && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6">
                <div className="flex items-center mb-4">
                  {owner.photo_url ? (
                    <img
                      src={owner.photo_url}
                      alt={owner.name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-blue-500"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xl border-2 border-blue-600">
                      {owner.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="ml-4">
                    <p className="text-sm text-blue-600 font-medium mb-1">Team Owner</p>
                    <p className="text-xl font-bold text-dark">{owner.name}</p>
                  </div>
                </div>
                {(owner.email || owner.phone || owner.place || owner.nationality) && (
                  <div className="space-y-2 text-sm">
                    {owner.email && (
                      <div className="flex items-center text-gray-700">
                        <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span>{owner.email}</span>
                      </div>
                    )}
                    {owner.phone && (
                      <div className="flex items-center text-gray-700">
                        <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span>{owner.phone}</span>
                      </div>
                    )}
                    {owner.place && (
                      <div className="flex items-center text-gray-700">
                        <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>{owner.place}</span>
                      </div>
                    )}
                    {owner.nationality && (
                      <div className="flex items-center text-gray-700">
                        <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                        </svg>
                        <span>{owner.nationality}</span>
                      </div>
                    )}
                  </div>
                )}
                {owner.bio && (
                  <p className="mt-4 text-sm text-gray-600 italic">"{owner.bio}"</p>
                )}
              </div>
            )}

            {/* Manager Card */}
            {manager && (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6">
                <div className="flex items-center mb-4">
                  {manager.photo_url ? (
                    <img
                      src={manager.photo_url}
                      alt={manager.name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-green-500"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-xl border-2 border-green-600">
                      {manager.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="ml-4">
                    <p className="text-sm text-green-600 font-medium mb-1">
                      {manager.is_player ? 'Playing Manager' : 'Team Manager'}
                    </p>
                    <p className="text-xl font-bold text-dark">{manager.name}</p>
                  </div>
                </div>
                {(manager.email || manager.phone || manager.place || manager.nationality) && (
                  <div className="space-y-2 text-sm">
                    {manager.email && (
                      <div className="flex items-center text-gray-700">
                        <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span>{manager.email}</span>
                      </div>
                    )}
                    {manager.phone && (
                      <div className="flex items-center text-gray-700">
                        <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span>{manager.phone}</span>
                      </div>
                    )}
                    {manager.place && (
                      <div className="flex items-center text-gray-700">
                        <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>{manager.place}</span>
                      </div>
                    )}
                    {manager.nationality && (
                      <div className="flex items-center text-gray-700">
                        <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                        </svg>
                        <span>{manager.nationality}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Acquisitions and Top Players */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Recent Acquisitions */}
        <div className="glass rounded-3xl p-6 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center mb-4">
            <svg className="w-5 h-5 text-primary mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-xl font-bold text-dark">Recent Acquisitions</h3>
          </div>

          {recentPlayers.length > 0 ? (
            <div className="space-y-3">
              {recentPlayers.map((player) => (
                <div key={player.id} className="bg-white/50 rounded-xl p-3 flex items-center justify-between hover:bg-white/70 transition-all">
                  <div>
                    <p className="font-medium text-dark">{player.name}</p>
                    <p className="text-sm text-gray-600">{player.position} • Rating: {player.overall_rating}</p>
                  </div>
                  <p className="font-bold text-primary">{profileData.currencySystem === 'dual' ? 'eCoin ' : 'eCoin '}{player.acquisition_value.toLocaleString()}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No players acquired yet</p>
          )}
        </div>

        {/* Top Rated Players */}
        <div className="glass rounded-3xl p-6 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center mb-4">
            <svg className="w-5 h-5 text-primary mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <h3 className="text-xl font-bold text-dark">Top Rated Players</h3>
          </div>

          {topPlayers.length > 0 ? (
            <div className="space-y-3">
              {topPlayers.map((player, index) => (
                <div key={player.id} className="bg-white/50 rounded-xl p-3 flex items-center justify-between hover:bg-white/70 transition-all">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center text-white font-bold text-sm mr-3">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-dark">{player.name}</p>
                      <p className="text-sm text-gray-600">{player.position}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 text-yellow-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span className="font-bold text-dark">{player.overall_rating}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No players in squad yet</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass rounded-3xl p-6 hover:shadow-lg transition-all duration-300">
        <h3 className="text-xl font-bold text-dark mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
          <Link href="/dashboard/team" className="px-4 py-3 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-white transition-all text-center font-medium">
            Team Dashboard
          </Link>
          <Link href="/dashboard/team/profile/edit" className="px-4 py-3 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-white transition-all text-center font-medium">
            Edit Profile
          </Link>
        </div>
      </div>
    </div>
  );
}
