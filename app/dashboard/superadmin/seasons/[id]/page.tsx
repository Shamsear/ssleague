'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getSeasonById } from '@/lib/firebase/seasons';
import { Season } from '@/types/season';

export default function SeasonDetails() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const seasonId = params.id as string;
  
  const [season, setSeason] = useState<Season | null>(null);
  const [loadingSeason, setLoadingSeason] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mock data - Replace with actual API calls later
  const [seasonStats] = useState({
    totalTeams: 12,
    newTeams: 3,
    continuingTeams: 9,
    totalRounds: 5,
    activeRounds: 2,
    completedRounds: 3,
    totalBids: 156,
    teamsParticipated: 12,
    highestBid: 50000,
    averageBid: 15234,
    lowestBid: 5000,
  });

  const [teams] = useState([
    { id: '1', name: 'Mumbai Warriors', owner: 'John Doe', isNew: false, balance: 45000, bids: 15, totalSpent: 55000 },
    { id: '2', name: 'Delhi Dynamos', owner: 'Jane Smith', isNew: true, balance: 38000, bids: 12, totalSpent: 62000 },
    { id: '3', name: 'Bangalore Blasters', owner: 'Mike Johnson', isNew: false, balance: 42000, bids: 18, totalSpent: 58000 },
  ]);

  const [rounds] = useState([
    { id: '1', position: 'Round 1', isActive: false, status: 'completed', startTime: new Date('2024-01-15'), bids: 45, teams: 12, players: 15 },
    { id: '2', position: 'Round 2', isActive: true, status: 'active', startTime: new Date('2024-01-20'), bids: 38, teams: 12, players: 12 },
    { id: '3', position: 'Round 3', isActive: false, status: 'pending', startTime: null, bids: 0, teams: 0, players: 0 },
  ]);

  const [topBids] = useState([
    { playerName: 'Virat Kohli', position: 'Batsman', originalTeam: 'RCB', biddingTeam: 'Mumbai Warriors', amount: 50000, round: 'Round 1' },
    { playerName: 'Jasprit Bumrah', position: 'Bowler', originalTeam: 'MI', biddingTeam: 'Delhi Dynamos', amount: 48000, round: 'Round 1' },
    { playerName: 'MS Dhoni', position: 'Wicket Keeper', originalTeam: 'CSK', biddingTeam: 'Bangalore Blasters', amount: 45000, round: 'Round 2' },
  ]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && user.role === 'super_admin' && seasonId) {
      fetchSeason();
    }
  }, [user, seasonId]);

  const fetchSeason = async () => {
    try {
      setLoadingSeason(true);
      const seasonData = await getSeasonById(seasonId);
      setSeason(seasonData);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch season');
      console.error('Error fetching season:', err);
    } finally {
      setLoadingSeason(false);
    }
  };

  const formatDate = (date?: Date | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (date?: Date | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading || loadingSeason) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading season details...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'super_admin') {
    return null;
  }

  if (error || !season) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Season Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'The requested season could not be found.'}</p>
          <button
            onClick={() => router.push('/dashboard/superadmin/seasons')}
            className="inline-flex items-center px-4 py-2 bg-[#9580FF] text-white rounded-xl hover:bg-[#9580FF]/90 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Seasons
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-4 sm:py-8 px-4">
      <div className="container mx-auto max-w-screen-2xl">
        {/* Page Header */}
        <div className="glass rounded-3xl p-6 mb-8 shadow-lg backdrop-blur-md border border-white/20">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#9580FF]/20 to-[#9580FF]/10 text-[#9580FF]">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">{season.name} Details</h1>
                <p className="text-gray-600 text-sm md:text-base flex items-center flex-wrap gap-3">
                  Comprehensive statistics and information
                  {season.isActive ? (
                    <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Active Season
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-semibold">
                      {season.status.charAt(0).toUpperCase() + season.status.slice(1)}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => alert('Player stats feature - To be implemented')}
                className="inline-flex items-center px-4 py-2 border border-purple-300 text-sm font-medium rounded-2xl text-purple-600 bg-purple-50 hover:bg-purple-100 hover:border-purple-400 transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                Player Stats & Awards
              </button>
              <button
                onClick={() => router.push('/dashboard/superadmin/seasons')}
                className="inline-flex items-center px-4 py-2 border-2 border-gray-300 text-sm font-medium rounded-2xl text-gray-700 bg-white/80 backdrop-blur-sm hover:bg-white hover:border-gray-400 transition-all duration-200 shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Seasons
              </button>
            </div>
          </div>
        </div>

        {/* Season Info Card */}
        <div className="glass rounded-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden mb-8">
          <div className="px-6 py-5 bg-gradient-to-r from-[#9580FF]/5 to-[#9580FF]/10 border-b border-[#9580FF]/20">
            <h2 className="text-xl font-semibold text-[#9580FF] flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Season Information
            </h2>
          </div>
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <dt className="text-sm font-semibold text-gray-600 mb-1">Year</dt>
                <dd className="text-xl font-bold text-gray-900">{season.year}</dd>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-green-500/20 to-green-600/20 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <dt className="text-sm font-semibold text-gray-600 mb-1">Created</dt>
                <dd className="text-xl font-bold text-gray-900">{formatDate(season.createdAt)}</dd>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <dt className="text-sm font-semibold text-gray-600 mb-1">Last Updated</dt>
                <dd className="text-xl font-bold text-gray-900">{formatDate(season.updatedAt)}</dd>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Teams Stats */}
          <div className="glass rounded-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 715.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="text-right">
                  <dt className="text-sm font-semibold text-gray-600">Total Teams</dt>
                  <dd className="text-3xl font-bold text-gray-900">{seasonStats.totalTeams}</dd>
                </div>
              </div>
              <div className="text-xs text-gray-500 bg-gray-50/50 rounded-xl p-2">
                {seasonStats.newTeams} new • {seasonStats.continuingTeams} continuing
              </div>
            </div>
          </div>

          {/* Rounds Stats */}
          <div className="glass rounded-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-600/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-right">
                  <dt className="text-sm font-semibold text-gray-600">Rounds</dt>
                  <dd className="text-3xl font-bold text-gray-900">{seasonStats.totalRounds}</dd>
                </div>
              </div>
              <div className="text-xs text-gray-500 bg-gray-50/50 rounded-xl p-2">
                {seasonStats.activeRounds} active • {seasonStats.completedRounds} completed
              </div>
            </div>
          </div>

          {/* Bids Stats */}
          <div className="glass rounded-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                </div>
                <div className="text-right">
                  <dt className="text-sm font-semibold text-gray-600">Total Bids</dt>
                  <dd className="text-3xl font-bold text-gray-900">{seasonStats.totalBids}</dd>
                </div>
              </div>
              <div className="text-xs text-gray-500 bg-gray-50/50 rounded-xl p-2">
                {seasonStats.teamsParticipated} teams participated
              </div>
            </div>
          </div>

          {/* Average Bid */}
          <div className="glass rounded-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="text-right">
                  <dt className="text-sm font-semibold text-gray-600">Average Bid</dt>
                  <dd className="text-3xl font-bold text-gray-900">{seasonStats.averageBid.toLocaleString()}</dd>
                </div>
              </div>
              <div className="text-xs text-gray-500 bg-gray-50/50 rounded-xl p-2">
                Max: {seasonStats.highestBid.toLocaleString()} • Min: {seasonStats.lowestBid.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Teams Section */}
        <div className="glass rounded-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden mb-8">
          <div className="px-6 py-4 bg-gradient-to-r from-[#9580FF]/5 to-[#9580FF]/10 border-b border-[#9580FF]/20">
            <h3 className="text-lg font-semibold text-[#9580FF]">Teams ({teams.length})</h3>
          </div>
          <div className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bids</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Spent</th>
                  </tr>
                </thead>
                <tbody className="bg-white/50 divide-y divide-gray-200">
                  {teams.map((team) => (
                    <tr key={team.id} className="hover:bg-white/80 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => alert(`Team details for ${team.name} - To be implemented`)}
                          className="font-medium text-[#0066FF] hover:text-[#9580FF] transition-colors"
                        >
                          {team.name}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{team.owner}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {team.isNew ? (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">New</span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">Continuing</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{team.balance.toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{team.bids}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{team.totalSpent.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Rounds Section */}
        <div className="glass rounded-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden mb-8">
          <div className="px-6 py-4 bg-gradient-to-r from-[#9580FF]/5 to-[#9580FF]/10 border-b border-[#9580FF]/20">
            <h3 className="text-lg font-semibold text-[#9580FF]">Rounds ({rounds.length})</h3>
          </div>
          <div className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bids</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teams</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Players</th>
                  </tr>
                </thead>
                <tbody className="bg-white/50 divide-y divide-gray-200">
                  {rounds.map((round) => (
                    <tr key={round.id} className="hover:bg-white/80 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => alert(`Round details for ${round.position} - To be implemented`)}
                          className="font-medium text-[#0066FF] hover:text-[#9580FF] transition-colors"
                        >
                          {round.position}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {round.isActive ? (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Active</span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                            {round.status.charAt(0).toUpperCase() + round.status.slice(1)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{formatDateTime(round.startTime)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{round.bids}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{round.teams}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{round.players}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Top Bids Section */}
        {topBids.length > 0 && (
          <div className="glass rounded-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-[#9580FF]/5 to-[#9580FF]/10 border-b border-[#9580FF]/20">
              <h3 className="text-lg font-semibold text-[#9580FF]">Top Bids</h3>
            </div>
            <div className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Original Team</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bidding Team</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Round</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white/50 divide-y divide-gray-200">
                    {topBids.map((bid, index) => (
                      <tr key={index} className="hover:bg-white/80 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{bid.playerName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{bid.position}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{bid.originalTeam}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{bid.biddingTeam}</td>
                        <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900">
                          {bid.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{bid.round}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
