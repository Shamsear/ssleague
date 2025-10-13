'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface PlayerStats {
  id: string;
  player_id: string;
  player_name: string;
  position: string;
  overall_rating: number;
  team_name?: string;
  team_code?: string;
  price_paid?: number;
  auction_date?: Date;
  season_name: string;
  matches_played: number;
  goals: number;
  assists: number;
  clean_sheets: number;
  yellow_cards: number;
  red_cards: number;
  minutes_played: number;
  is_sold: boolean;
}

export default function SeasonPlayerStats() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Mock data - Replace with actual API calls
  const [players, setPlayers] = useState<PlayerStats[]>([
    {
      id: '1',
      player_id: 'sspslpsl001',
      player_name: 'Cristiano Ronaldo',
      position: 'CF',
      overall_rating: 91,
      team_name: 'Manchester United FC',
      team_code: 'MUN',
      price_paid: 5000000,
      auction_date: new Date('2024-02-01'),
      season_name: 'Season 2024',
      matches_played: 25,
      goals: 18,
      assists: 7,
      clean_sheets: 0,
      yellow_cards: 3,
      red_cards: 0,
      minutes_played: 2150,
      is_sold: true,
    },
    {
      id: '2',
      player_id: 'sspslpsl002',
      player_name: 'Bruno Fernandes',
      position: 'AMF',
      overall_rating: 88,
      team_name: 'Manchester United FC',
      team_code: 'MUN',
      price_paid: 4000000,
      auction_date: new Date('2024-02-02'),
      season_name: 'Season 2024',
      matches_played: 28,
      goals: 12,
      assists: 15,
      clean_sheets: 0,
      yellow_cards: 5,
      red_cards: 1,
      minutes_played: 2480,
      is_sold: true,
    },
    {
      id: '3',
      player_id: 'sspslpsl003',
      player_name: 'David de Gea',
      position: 'GK',
      overall_rating: 87,
      team_name: 'Manchester United FC',
      team_code: 'MUN',
      price_paid: 3500000,
      auction_date: new Date('2024-02-03'),
      season_name: 'Season 2024',
      matches_played: 30,
      goals: 0,
      assists: 0,
      clean_sheets: 12,
      yellow_cards: 2,
      red_cards: 0,
      minutes_played: 2700,
      is_sold: true,
    },
    {
      id: '4',
      player_id: 'sspslpsl004',
      player_name: 'Kevin De Bruyne',
      position: 'AMF',
      overall_rating: 92,
      team_name: 'Manchester City FC',
      team_code: 'MCI',
      price_paid: 5500000,
      auction_date: new Date('2024-02-04'),
      season_name: 'Season 2024',
      matches_played: 26,
      goals: 10,
      assists: 20,
      clean_sheets: 0,
      yellow_cards: 4,
      red_cards: 0,
      minutes_played: 2340,
      is_sold: true,
    },
    {
      id: '5',
      player_id: 'sspslpsl005',
      player_name: 'Mohamed Salah',
      position: 'RWF',
      overall_rating: 90,
      team_name: 'Liverpool FC',
      team_code: 'LIV',
      price_paid: 4800000,
      auction_date: new Date('2024-02-05'),
      season_name: 'Season 2024',
      matches_played: 29,
      goals: 22,
      assists: 11,
      clean_sheets: 0,
      yellow_cards: 2,
      red_cards: 0,
      minutes_played: 2610,
      is_sold: true,
    },
    {
      id: '6',
      player_id: 'sspslpsl006',
      player_name: 'Lionel Messi',
      position: 'RWF',
      overall_rating: 93,
      team_name: undefined,
      team_code: undefined,
      price_paid: undefined,
      auction_date: undefined,
      season_name: 'Season 2024',
      matches_played: 0,
      goals: 0,
      assists: 0,
      clean_sheets: 0,
      yellow_cards: 0,
      red_cards: 0,
      minutes_played: 0,
      is_sold: false,
    },
  ]);

  const [stats] = useState({
    totalPlayers: 150,
    soldPlayers: 145,
    unsoldPlayers: 5,
    totalGoals: 245,
    totalAssists: 180,
    totalMatches: 350,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeason, setFilterSeason] = useState('all');
  const [filterPosition, setFilterPosition] = useState('all');
  const [filterTeam, setFilterTeam] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState<'goals' | 'assists' | 'rating' | 'price'>('goals');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'super_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleExportData = () => {
    alert('Export data functionality - Backend to be implemented');
  };

  const filteredPlayers = players.filter(player => {
    const matchesSearch = player.player_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         player.player_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         player.team_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeason = filterSeason === 'all' || player.season_name === filterSeason;
    const matchesPosition = filterPosition === 'all' || player.position === filterPosition;
    const matchesTeam = filterTeam === 'all' || player.team_code === filterTeam;
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'sold' && player.is_sold) ||
                         (filterStatus === 'unsold' && !player.is_sold);
    return matchesSearch && matchesSeason && matchesPosition && matchesTeam && matchesStatus;
  });

  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'goals':
        comparison = a.goals - b.goals;
        break;
      case 'assists':
        comparison = a.assists - b.assists;
        break;
      case 'rating':
        comparison = a.overall_rating - b.overall_rating;
        break;
      case 'price':
        comparison = (a.price_paid || 0) - (b.price_paid || 0);
        break;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const topScorers = [...players].filter(p => p.is_sold).sort((a, b) => b.goals - a.goals).slice(0, 5);
  const topAssists = [...players].filter(p => p.is_sold).sort((a, b) => b.assists - a.assists).slice(0, 5);
  const mostExpensive = [...players].filter(p => p.is_sold && p.price_paid).sort((a, b) => (b.price_paid || 0) - (a.price_paid || 0)).slice(0, 5);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'super_admin') {
    return null;
  }

  return (
    <div className="min-h-screen py-4 sm:py-8 px-4">
      <div className="container mx-auto max-w-screen-2xl">
        {/* Page Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => router.push('/dashboard/superadmin')}
              className="p-2 rounded-xl hover:bg-white/50 transition-colors"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-3xl md:text-4xl font-bold gradient-text">Season Player Statistics</h1>
          </div>
          <p className="text-gray-600 text-sm md:text-base ml-14">Analyze player performance and auction data</p>
        </header>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="glass rounded-2xl p-4 shadow-lg backdrop-blur-md border border-white/20">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Total Players</p>
              <p className="text-2xl font-bold text-[#0066FF]">{stats.totalPlayers}</p>
            </div>
          </div>

          <div className="glass rounded-2xl p-4 shadow-lg backdrop-blur-md border border-white/20">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Sold Players</p>
              <p className="text-2xl font-bold text-green-600">{stats.soldPlayers}</p>
            </div>
          </div>

          <div className="glass rounded-2xl p-4 shadow-lg backdrop-blur-md border border-white/20">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Unsold</p>
              <p className="text-2xl font-bold text-gray-600">{stats.unsoldPlayers}</p>
            </div>
          </div>

          <div className="glass rounded-2xl p-4 shadow-lg backdrop-blur-md border border-white/20">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Total Goals</p>
              <p className="text-2xl font-bold text-purple-600">{stats.totalGoals}</p>
            </div>
          </div>

          <div className="glass rounded-2xl p-4 shadow-lg backdrop-blur-md border border-white/20">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Total Assists</p>
              <p className="text-2xl font-bold text-orange-600">{stats.totalAssists}</p>
            </div>
          </div>

          <div className="glass rounded-2xl p-4 shadow-lg backdrop-blur-md border border-white/20">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Total Matches</p>
              <p className="text-2xl font-bold text-blue-600">{stats.totalMatches}</p>
            </div>
          </div>
        </div>

        {/* Top Players Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Top Scorers */}
          <div className="glass rounded-3xl p-6 shadow-lg backdrop-blur-md border border-white/20">
            <h3 className="text-lg font-bold gradient-text mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Top Scorers
            </h3>
            <div className="space-y-3">
              {topScorers.map((player, index) => (
                <div key={player.id} className="flex items-center justify-between p-3 rounded-xl bg-white/20 hover:bg-white/30 transition-colors">
                  <div className="flex items-center flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mr-3 ${
                      index === 0 ? 'bg-yellow-400 text-yellow-900' :
                      index === 1 ? 'bg-gray-300 text-gray-700' :
                      index === 2 ? 'bg-orange-400 text-orange-900' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{player.player_name}</p>
                      <p className="text-xs text-gray-600">{player.team_code}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-[#0066FF]">{player.goals}</p>
                    <p className="text-xs text-gray-500">goals</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Assists */}
          <div className="glass rounded-3xl p-6 shadow-lg backdrop-blur-md border border-white/20">
            <h3 className="text-lg font-bold gradient-text mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Top Assists
            </h3>
            <div className="space-y-3">
              {topAssists.map((player, index) => (
                <div key={player.id} className="flex items-center justify-between p-3 rounded-xl bg-white/20 hover:bg-white/30 transition-colors">
                  <div className="flex items-center flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mr-3 ${
                      index === 0 ? 'bg-green-400 text-green-900' :
                      index === 1 ? 'bg-gray-300 text-gray-700' :
                      index === 2 ? 'bg-orange-400 text-orange-900' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{player.player_name}</p>
                      <p className="text-xs text-gray-600">{player.team_code}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">{player.assists}</p>
                    <p className="text-xs text-gray-500">assists</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Most Expensive */}
          <div className="glass rounded-3xl p-6 shadow-lg backdrop-blur-md border border-white/20">
            <h3 className="text-lg font-bold gradient-text mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Most Expensive
            </h3>
            <div className="space-y-3">
              {mostExpensive.map((player, index) => (
                <div key={player.id} className="flex items-center justify-between p-3 rounded-xl bg-white/20 hover:bg-white/30 transition-colors">
                  <div className="flex items-center flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mr-3 ${
                      index === 0 ? 'bg-purple-400 text-purple-900' :
                      index === 1 ? 'bg-gray-300 text-gray-700' :
                      index === 2 ? 'bg-orange-400 text-orange-900' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{player.player_name}</p>
                      <p className="text-xs text-gray-600">{player.team_code}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-purple-600">{formatCurrency(player.price_paid || 0)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="glass rounded-3xl p-6 mb-8 shadow-lg backdrop-blur-md border border-white/20">
          <div className="flex flex-col gap-4">
            {/* Search and Export */}
            <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
              <div className="flex-1 w-full lg:max-w-md">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search players, teams, or IDs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all"
                  />
                  <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              <button
                onClick={handleExportData}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export to Excel
              </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <select
                value={filterSeason}
                onChange={(e) => setFilterSeason(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all text-sm"
              >
                <option value="all">All Seasons</option>
                <option value="Season 2024">Season 2024</option>
                <option value="Season 2023">Season 2023</option>
              </select>

              <select
                value={filterPosition}
                onChange={(e) => setFilterPosition(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all text-sm"
              >
                <option value="all">All Positions</option>
                <option value="GK">Goalkeeper (GK)</option>
                <option value="CB">Center Back (CB)</option>
                <option value="LB">Left Back (LB)</option>
                <option value="RB">Right Back (RB)</option>
                <option value="DMF">Defensive Mid (DMF)</option>
                <option value="CMF">Central Mid (CMF)</option>
                <option value="AMF">Attacking Mid (AMF)</option>
                <option value="LWF">Left Wing (LWF)</option>
                <option value="RWF">Right Wing (RWF)</option>
                <option value="CF">Center Forward (CF)</option>
              </select>

              <select
                value={filterTeam}
                onChange={(e) => setFilterTeam(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all text-sm"
              >
                <option value="all">All Teams</option>
                <option value="MUN">Manchester United (MUN)</option>
                <option value="MCI">Manchester City (MCI)</option>
                <option value="LIV">Liverpool (LIV)</option>
                <option value="CHE">Chelsea (CHE)</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all text-sm"
              >
                <option value="all">All Status</option>
                <option value="sold">Sold</option>
                <option value="unsold">Unsold</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] outline-none transition-all text-sm"
              >
                <option value="goals">Sort by Goals</option>
                <option value="assists">Sort by Assists</option>
                <option value="rating">Sort by Rating</option>
                <option value="price">Sort by Price</option>
              </select>

              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-4 py-2 border border-gray-200 rounded-xl hover:bg-white/50 transition-colors text-sm font-medium"
                title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
              >
                {sortOrder === 'asc' ? '↑' : '↓'} {sortOrder === 'asc' ? 'Asc' : 'Desc'}
              </button>
            </div>
          </div>
        </div>

        {/* Players Table */}
        <div className="glass rounded-3xl shadow-lg backdrop-blur-md border border-white/20 overflow-hidden">
          <div className="px-6 py-5 bg-gradient-to-r from-[#0066FF]/5 to-[#0066FF]/10 border-b border-[#0066FF]/20">
            <h3 className="text-xl font-semibold text-[#0066FF] flex items-center justify-between">
              <span className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Player Statistics
              </span>
              {sortedPlayers.length > 0 && (
                <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#0066FF]/20 text-[#0066FF]">
                  {sortedPlayers.length} {sortedPlayers.length === 1 ? 'Player' : 'Players'}
                </span>
              )}
            </h3>
          </div>

          {sortedPlayers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Player ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Position</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Rating</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Team</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Price</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Matches</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Goals</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Assists</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Clean Sheets</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Cards</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Minutes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white/30">
                  {sortedPlayers.map((player) => (
                    <tr key={player.id} className="hover:bg-white/60 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-mono text-[#0066FF] font-medium">{player.player_id}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">{player.player_name}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {player.position}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-sm font-semibold text-gray-900">{player.overall_rating}</span>
                          <svg className="w-4 h-4 text-yellow-500 ml-1" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {player.team_code ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {player.team_code}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Unsold</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-semibold text-gray-900">
                          {player.price_paid ? formatCurrency(player.price_paid) : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-gray-700">{player.matches_played}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-semibold text-green-600">{player.goals}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-semibold text-blue-600">{player.assists}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-gray-700">{player.clean_sheets}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {player.yellow_cards > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              {player.yellow_cards} 🟨
                            </span>
                          )}
                          {player.red_cards > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                              {player.red_cards} 🟥
                            </span>
                          )}
                          {player.yellow_cards === 0 && player.red_cards === 0 && (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-gray-700">{player.minutes_played}'</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-8 py-16 text-center">
              <div className="max-w-sm mx-auto">
                <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-[#0066FF]/20 to-[#0066FF]/10 flex items-center justify-center">
                  <svg className="w-10 h-10 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Players Found</h3>
                <p className="text-gray-500 mb-6">
                  {searchQuery || filterSeason !== 'all' || filterPosition !== 'all' || filterTeam !== 'all' || filterStatus !== 'all'
                    ? 'No players match your search criteria. Try adjusting your filters.'
                    : 'No player statistics available yet.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
