'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface Award {
  id: string;
  award_type: string;
  tournament_id: string;
  season_id: string;
  round_number?: number;
  week_number?: number;
  player_id?: string;
  player_name?: string;
  team_id?: string;
  team_name?: string;
  performance_stats: any;
  selected_at: string;
  selected_by_name?: string;
  notes?: string;
}

interface Tournament {
  id: string;
  name: string;
}

interface Season {
  id: string;
  name: string;
}

export default function PublicAwardsPage() {
  const searchParams = useSearchParams();
  const [awards, setAwards] = useState<Award[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedTournament, setSelectedTournament] = useState<string>(
    searchParams?.get('tournament') || ''
  );
  const [selectedSeason, setSelectedSeason] = useState<string>(
    searchParams?.get('season') || ''
  );
  const [selectedAwardType, setSelectedAwardType] = useState<string>('');

  const awardTypes = [
    { value: '', label: 'All Awards' },
    { value: 'POTD', label: 'Player of the Day' },
    { value: 'POTW', label: 'Player of the Week' },
    { value: 'POTS', label: 'Player of the Season' },
    { value: 'TOD', label: 'Team of the Day' },
    { value: 'TOW', label: 'Team of the Week' },
    { value: 'TOTS', label: 'Team of the Season' },
  ];

  // Fetch tournaments
  useEffect(() => {
    async function fetchTournaments() {
      try {
        const response = await fetch('/api/tournaments');
        const data = await response.json();
        if (data.success) {
          setTournaments(data.data || []);
        }
      } catch (error) {
        console.error('Error fetching tournaments:', error);
      }
    }
    fetchTournaments();
  }, []);

  // Fetch seasons
  useEffect(() => {
    async function fetchSeasons() {
      try {
        const response = await fetch('/api/seasons');
        const data = await response.json();
        if (data.success) {
          setSeasons(data.data || []);
        }
      } catch (error) {
        console.error('Error fetching seasons:', error);
      }
    }
    fetchSeasons();
  }, []);

  // Fetch awards
  useEffect(() => {
    async function fetchAwards() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedTournament) params.append('tournament_id', selectedTournament);
        if (selectedSeason) params.append('season_id', selectedSeason);
        if (selectedAwardType) params.append('award_type', selectedAwardType);

        const response = await fetch(`/api/awards?${params.toString()}`);
        const data = await response.json();
        
        if (data.success) {
          setAwards(data.data || []);
        }
      } catch (error) {
        console.error('Error fetching awards:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchAwards();
  }, [selectedTournament, selectedSeason, selectedAwardType]);

  const getAwardIcon = (type: string) => {
    switch (type) {
      case 'POTD':
      case 'POTW':
      case 'POTS':
        return '⭐';
      case 'TOD':
      case 'TOW':
      case 'TOTS':
        return '🏆';
      default:
        return '🎖️';
    }
  };

  const getAwardLabel = (type: string) => {
    const award = awardTypes.find(a => a.value === type);
    return award?.label || type;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Group awards by type for hall of fame
  const hallOfFame = Array.isArray(awards) ? awards.reduce((acc, award) => {
    const key = award.award_type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(award);
    return acc;
  }, {} as Record<string, Award[]>) : {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 py-8 px-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent mb-3 leading-tight">
            🏆 Awards Hall of Fame
          </h1>
          <p className="text-gray-600 text-lg">
            Celebrating excellence in performance - Players and Teams of distinction
          </p>
        </header>

        {/* Filters */}
        <div className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl p-6 shadow-lg mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Filter Awards</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tournament Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tournament
              </label>
              <select
                value={selectedTournament}
                onChange={(e) => setSelectedTournament(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Tournaments</option>
                {tournaments.map((tournament) => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Season Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Season
              </label>
              <select
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Seasons</option>
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Award Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Award Type
              </label>
              <select
                value={selectedAwardType}
                onChange={(e) => setSelectedAwardType(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {awardTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-transparent border-t-blue-500 border-r-purple-500"></div>
          </div>
        )}

        {/* Awards Grid */}
        {!loading && awards.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {awards.map((award) => (
              <div
                key={award.id}
                className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                {/* Award Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-4xl">{getAwardIcon(award.award_type)}</div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-lg">
                      {getAwardLabel(award.award_type)}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {award.round_number && `Round ${award.round_number}`}
                      {award.week_number && `Week ${award.week_number}`}
                      {!award.round_number && !award.week_number && 'Season Award'}
                    </p>
                  </div>
                </div>

                {/* Winner Info */}
                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-4 mb-4">
                  <div className="font-bold text-2xl text-gray-900 mb-1">
                    {award.player_name || award.team_name}
                  </div>
                  {award.team_name && award.player_name && (
                    <div className="text-sm text-gray-600">{award.team_name}</div>
                  )}
                </div>

                {/* Performance Stats */}
                {award.performance_stats && (
                  <div className="space-y-2 mb-4">
                    {typeof award.performance_stats === 'string' 
                      ? JSON.parse(award.performance_stats)
                      : award.performance_stats
                    }
                    {Object.entries(
                      typeof award.performance_stats === 'string'
                        ? JSON.parse(award.performance_stats)
                        : award.performance_stats
                    ).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-gray-600 capitalize">
                          {key.replace(/_/g, ' ')}:
                        </span>
                        <span className="font-semibold text-gray-900">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Award Date */}
                <div className="text-xs text-gray-500 pt-3 border-t border-gray-200">
                  Selected on {formatDate(award.selected_at)}
                </div>

                {/* Notes */}
                {award.notes && (
                  <div className="mt-3 text-sm text-gray-700 italic">
                    "{award.notes}"
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && awards.length === 0 && (
          <div className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl p-12 text-center shadow-lg">
            <div className="text-6xl mb-4">🏆</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Awards Yet</h3>
            <p className="text-gray-600">
              Awards will appear here once they are selected by the committee.
            </p>
          </div>
        )}

        {/* Hall of Fame Stats */}
        {!loading && Object.keys(hallOfFame).length > 0 && (
          <div className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl p-8 shadow-lg">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">📊 Awards Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {Object.entries(hallOfFame).map(([type, awardsList]) => (
                <div key={type} className="text-center p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl">
                  <div className="text-3xl mb-2">{getAwardIcon(type)}</div>
                  <div className="text-2xl font-bold text-gray-900">{awardsList.length}</div>
                  <div className="text-xs text-gray-600">{getAwardLabel(type)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Back to Dashboard */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
