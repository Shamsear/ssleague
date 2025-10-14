'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'DMF', 'CMF', 'AMF', 'LMF', 'RMF', 'LWF', 'RWF', 'SS', 'CF'];
const MAX_PLAYERS_PER_TEAM = 25;

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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        
        // Fetch team data from Firebase team_seasons
        const { db } = await import('@/lib/firebase/config');
        const { collection, query, where, getDocs, limit } = await import('firebase/firestore');

        let teamName = (user as any).teamName || 'My Team';
        let logoUrl = (user as any).logoUrl;

        // Get current season and team_seasons data
        const teamSeasonsQuery = query(
          collection(db, 'team_seasons'),
          where('team_id', '==', user.uid),
          where('status', '==', 'registered'),
          limit(1)
        );
        const teamSeasonsSnapshot = await getDocs(teamSeasonsQuery);

        if (!teamSeasonsSnapshot.empty) {
          const teamSeasonData = teamSeasonsSnapshot.docs[0].data();
          teamName = teamSeasonData.team_name || teamName;
          logoUrl = teamSeasonData.team_logo || logoUrl;
        }

        setProfileData({
          name: teamName,
          logoUrl: logoUrl,
          managerName: user.username || 'Manager',
          playerCount: 0,
          totalBids: 0,
          wonBids: 0,
          remainingBalance: 15000,
          totalSpent: 0,
          initialBudget: 15000,
          positionCounts: {},
        });

        setRecentPlayers([]);
        setTopPlayers([]);
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileData();
  }, [user]);

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'team' || !profileData) {
    return null;
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
                <p className="text-xs text-gray-600 mb-1">Manager</p>
                <p className="text-lg font-semibold text-dark">{profileData.managerName}</p>
              </div>
              <div className="bg-white/50 rounded-xl p-3">
                <p className="text-xs text-gray-600 mb-1">Players</p>
                <p className="text-lg font-semibold text-dark">{profileData.playerCount}/{MAX_PLAYERS_PER_TEAM}</p>
              </div>
              <div className="bg-white/50 rounded-xl p-3">
                <p className="text-xs text-gray-600 mb-1">Total Bids</p>
                <p className="text-lg font-semibold text-dark">{profileData.totalBids}</p>
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-3">
              <svg className="w-10 h-10 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="text-3xl font-bold">£{profileData.remainingBalance.toLocaleString()}</span>
            </div>
            <p className="text-white/90 font-medium">Current Balance</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-3">
              <svg className="w-10 h-10 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="text-3xl font-bold">£{profileData.totalSpent.toLocaleString()}</span>
            </div>
            <p className="text-white/90 font-medium">Total Spent</p>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-3">
              <svg className="w-10 h-10 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-3xl font-bold">£{profileData.initialBudget.toLocaleString()}</span>
            </div>
            <p className="text-white/90 font-medium">Initial Budget</p>
          </div>
        </div>
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
                  <p className="font-bold text-primary">£{player.acquisition_value.toLocaleString()}</p>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <Link href="/dashboard/team/players" className="px-4 py-3 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-white transition-all text-center font-medium">
            View Squad
          </Link>
          <Link href="/dashboard/team/bids" className="px-4 py-3 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-white transition-all text-center font-medium">
            Bid History
          </Link>
          <Link href="/dashboard/team/statistics" className="px-4 py-3 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-white transition-all text-center font-medium">
            Player Database
          </Link>
          <Link href="/dashboard/team/leaderboard" className="px-4 py-3 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-white transition-all text-center font-medium">
            Leaderboard
          </Link>
          <Link href="/dashboard" className="px-4 py-3 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-white transition-all text-center font-medium">
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
