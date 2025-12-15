'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useModal } from '@/hooks/useModal';
import AlertModal from '@/components/modals/AlertModal';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface FantasyLeague {
  id: string;
  name: string;
  season_id: string;
  status: string;
  created_at: any;
}

interface FantasyTeam {
  id: string;
  team_name: string;
  owner_name: string;
  total_points: number;
  player_count: number;
  rank: number;
}

export default function FantasyLeagueDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const leagueId = params?.leagueId as string;

  const [league, setLeague] = useState<FantasyLeague | null>(null);
  const [teams, setTeams] = useState<FantasyTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLineupLocked, setIsLineupLocked] = useState(false);
  const [isTogglingLock, setIsTogglingLock] = useState(false);

  const { alertState, showAlert, closeAlert } = useModal();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && user.role !== 'committee_admin' && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const loadLeagueData = async (retryCount = 0, maxRetries = 3) => {
      if (!leagueId) return;

      try {
        const response = await fetchWithTokenRefresh(`/api/fantasy/leagues/${leagueId}`);
        
        if (!response.ok) {
          // If it's a 404 and we haven't exceeded retries, wait and try again
          if (response.status === 404 && retryCount < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, retryCount), 3000); // Exponential backoff, max 3s
            console.log(`League not found, retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return loadLeagueData(retryCount + 1, maxRetries);
          }
          throw new Error('Failed to load league');
        }

        const data = await response.json();
        setLeague(data.league);
        setTeams(data.teams || []);

        // Load lineup lock status
        const lockRes = await fetchWithTokenRefresh(`/api/admin/fantasy/lineup-lock?league_id=${leagueId}`);
        if (lockRes.ok) {
          const lockData = await lockRes.json();
          setIsLineupLocked(lockData.is_lineup_locked || false);
        }
      } catch (error) {
        console.error('Error loading league:', error);
        showAlert({
          type: 'error',
          title: 'Error',
          message: 'Failed to load fantasy league data. The league may still be creating, please refresh the page.',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      loadLeagueData();
    }
  }, [user, leagueId]);

  const toggleLineupLock = async () => {
    if (!leagueId) return;

    const newLockState = !isLineupLocked;
    const action = newLockState ? 'lock' : 'unlock';
    
    if (!confirm(`Are you sure you want to ${action} lineup changes for all teams?`)) {
      return;
    }

    setIsTogglingLock(true);
    try {
      const response = await fetchWithTokenRefresh('/api/admin/fantasy/lineup-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          league_id: leagueId,
          is_locked: newLockState,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle lineup lock');
      }

      setIsLineupLocked(newLockState);
      showAlert({
        type: 'success',
        title: 'Success',
        message: `Lineup changes ${newLockState ? 'locked' : 'unlocked'} successfully!`,
      });
    } catch (error) {
      console.error('Error toggling lineup lock:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to toggle lineup lock',
      });
    } finally {
      setIsTogglingLock(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !league) return null;

  const managementCards = [
    {
      title: 'Enable Teams',
      description: 'Enable/disable teams for fantasy participation',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      href: `/dashboard/committee/fantasy/enable-teams`,
      color: 'from-teal-500 to-cyan-600',
      bgColor: 'from-teal-50 to-cyan-50',
      borderColor: 'border-teal-200',
    },
    {
      title: 'Draft Settings',
      description: 'Set budget per team and squad size limits',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      href: `/dashboard/committee/fantasy/draft-settings/${leagueId}`,
      color: 'from-indigo-500 to-purple-600',
      bgColor: 'from-indigo-50 to-purple-50',
      borderColor: 'border-indigo-200',
    },
    {
      title: 'Player Pricing',
      description: 'Configure credit prices for 3-10 star ratings',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      href: `/dashboard/committee/fantasy/pricing/${leagueId}`,
      color: 'from-green-500 to-teal-600',
      bgColor: 'from-green-50 to-teal-50',
      borderColor: 'border-green-200',
    },
    {
      title: 'Draft Results',
      description: 'View drafted players and team squads',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      href: `/dashboard/committee/fantasy/draft/${leagueId}`,
      color: 'from-emerald-500 to-green-600',
      bgColor: 'from-emerald-50 to-green-50',
      borderColor: 'border-emerald-200',
    },
    {
      title: 'Player Transfers',
      description: 'Manage player trades and roster changes',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
      href: `/dashboard/committee/fantasy/manage-players/${leagueId}`,
      color: 'from-orange-500 to-red-600',
      bgColor: 'from-orange-50 to-red-50',
      borderColor: 'border-orange-200',
    },
    {
      title: 'View Teams',
      description: 'See all fantasy teams and their rosters',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      href: `/dashboard/committee/fantasy/teams/${leagueId}`,
      color: 'from-blue-500 to-indigo-600',
      bgColor: 'from-blue-50 to-indigo-50',
      borderColor: 'border-blue-200',
    },
    {
      title: 'Scoring Rules',
      description: 'Configure points for goals, assists, wins, etc.',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
      href: `/dashboard/committee/fantasy/scoring/${leagueId}`,
      color: 'from-purple-500 to-pink-600',
      bgColor: 'from-purple-50 to-pink-50',
      borderColor: 'border-purple-200',
    },
    {
      title: 'Standings',
      description: 'View fantasy league standings and rankings',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      href: `/dashboard/committee/fantasy/standings/${leagueId}`,
      color: 'from-yellow-500 to-orange-600',
      bgColor: 'from-yellow-50 to-orange-50',
      borderColor: 'border-yellow-200',
    },
    {
      title: 'Draft Control',
      description: 'Open/close draft period and set deadlines',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      href: `/dashboard/committee/fantasy/draft-control/${leagueId}`,
      color: 'from-red-500 to-pink-600',
      bgColor: 'from-red-50 to-pink-50',
      borderColor: 'border-red-200',
    },
    {
      title: 'View Lineups',
      description: 'Check all teams\' starting 5, captain & vice-captain',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      href: `/dashboard/committee/fantasy/${leagueId}/lineups`,
      color: 'from-indigo-500 to-blue-600',
      bgColor: 'from-indigo-50 to-blue-50',
      borderColor: 'border-indigo-200',
    },
    {
      title: 'Transfer Management',
      description: 'Configure windows, settings & rules',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
      href: `/dashboard/committee/fantasy/transfers/${leagueId}`,
      color: 'from-cyan-500 to-teal-600',
      bgColor: 'from-cyan-50 to-teal-50',
      borderColor: 'border-cyan-200',
    },
    {
      title: 'Bonus Points',
      description: 'Award extra points to players or teams',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
        </svg>
      ),
      href: `/dashboard/committee/fantasy/${leagueId}/bonus-points`,
      color: 'from-pink-500 to-rose-600',
      bgColor: 'from-pink-50 to-rose-50',
      borderColor: 'border-pink-200',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <AlertModal {...alertState} onClose={closeAlert} />

      {/* Hero Header Section */}
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 max-w-7xl">
          <Link
            href="/dashboard/committee"
            className="inline-flex items-center gap-2 text-white/80 hover:text-white transition-colors mb-6 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Committee
          </Link>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/10 backdrop-blur-lg rounded-2xl flex items-center justify-center border border-white/20">
                <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl sm:text-4xl font-bold mb-1">{league.name}</h1>
                <p className="text-white/80 text-sm sm:text-base">Fantasy League Command Center</p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <div className="px-4 py-2 bg-white/10 backdrop-blur-lg rounded-lg border border-white/20">
                <p className="text-xs text-white/70">Status</p>
                <p className="text-sm font-semibold uppercase">{league.status}</p>
              </div>
              <div className="px-4 py-2 bg-white/10 backdrop-blur-lg rounded-lg border border-white/20">
                <p className="text-xs text-white/70">Season</p>
                <p className="text-sm font-semibold">{league.season_id.replace('SSPSLS', 'S')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-7xl">

        {/* Quick Stats Cards */}
        <div className="-mt-8 mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-1">{teams.length}</p>
            <p className="text-sm text-gray-600">Registered Teams</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {teams.reduce((sum, t) => sum + t.player_count, 0)}
            </p>
            <p className="text-sm text-gray-600">Players Drafted</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-1">{teams.filter(t => t.total_points > 0).length}</p>
            <p className="text-sm text-gray-600">Active Participants</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {teams.reduce((sum, t) => sum + t.total_points, 0)}
            </p>
            <p className="text-sm text-gray-600">Total Points</p>
          </div>
        </div>

        {/* Lineup Lock Control */}
        <div className="mb-8 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl shadow-lg border-2 border-purple-200 p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                isLineupLocked ? 'bg-red-500' : 'bg-green-500'
              }`}>
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isLineupLocked ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  )}
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  Lineup Lock Control
                </h3>
                <p className="text-sm text-gray-700 mb-2">
                  {isLineupLocked ? (
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                      <strong>LOCKED:</strong> Teams cannot change their lineup, captain, or vice-captain
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      <strong>UNLOCKED:</strong> Teams can freely modify their lineup
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-600">
                  Use this to prevent teams from gaining unfair advantages by changing lineups after seeing match results
                </p>
              </div>
            </div>
            <button
              onClick={toggleLineupLock}
              disabled={isTogglingLock}
              className={`px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${
                isLineupLocked
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                  : 'bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700'
              }`}
            >
              {isTogglingLock ? (
                'Processing...'
              ) : isLineupLocked ? (
                '🔓 Unlock Lineups'
              ) : (
                '🔒 Lock Lineups'
              )}
            </button>
          </div>
        </div>

        {/* Management Tools Grid */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Management Tools</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {managementCards.map((card, index) => (
              <Link
                key={index}
                href={card.href}
                className="group bg-white rounded-xl shadow-sm border border-gray-200 hover:border-indigo-500 hover:shadow-lg transition-all p-4"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 bg-gradient-to-br ${card.color} rounded-xl flex items-center justify-center text-white group-hover:scale-110 transition-transform flex-shrink-0`}>
                    {card.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors mb-1">
                      {card.title}
                    </h3>
                    <p className="text-xs text-gray-600 line-clamp-1">{card.description}</p>
                  </div>
                  <svg
                    className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Leaderboard */}
        {teams.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Leaderboard</h2>
              <Link
                href={`/dashboard/committee/fantasy/standings/${leagueId}`}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                View All
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <div className="space-y-3">
              {teams.slice(0, 5).map((team, index) => (
                <div
                  key={team.id}
                  className="flex items-center gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                    index === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg' :
                    index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500 text-white shadow-md' :
                    index === 2 ? 'bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-md' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{team.team_name}</p>
                    <p className="text-sm text-gray-500 truncate">{team.owner_name}</p>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="text-sm text-gray-500">Points</p>
                      <p className="text-lg font-bold text-gray-900">{team.total_points}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Players</p>
                      <p className="text-lg font-bold text-indigo-600">{team.player_count}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
