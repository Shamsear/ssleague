'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useTournament } from '@/hooks/useTournaments';
import TournamentSelector from '@/components/TournamentSelector';
import TeamStatistics from '@/components/team/TeamStatistics';

export default function TeamStatisticsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'all' | 'season' | 'tournament'>('all');
  
  const { tournament: selectedTournament } = useTournament(selectedTournamentId);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (selectedTournament) {
      setSelectedSeasonId(selectedTournament.season_id);
    }
  }, [selectedTournament]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-6 border border-gray-100/20">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">📊</span>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Team Statistics</h1>
              <p className="text-sm text-gray-600">View your team's performance across tournaments and seasons</p>
            </div>
          </div>

          {/* View Mode Selector */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-gray-700">View:</span>
            <button
              onClick={() => {
                setViewMode('all');
                setSelectedTournamentId('');
                setSelectedSeasonId('');
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                viewMode === 'all'
                  ? 'bg-[#0066FF] text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🌍 All Time
            </button>
            <button
              onClick={() => setViewMode('season')}
              className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                viewMode === 'season'
                  ? 'bg-[#0066FF] text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📅 By Season
            </button>
            <button
              onClick={() => setViewMode('tournament')}
              className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                viewMode === 'tournament'
                  ? 'bg-[#0066FF] text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🏆 By Tournament
            </button>
          </div>
        </div>

        {/* Tournament Selector (only show when tournament mode is selected) */}
        {viewMode === 'tournament' && (
          <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-6 border border-gray-100/20">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🎯</span>
              <h2 className="text-xl font-bold text-gray-900">Select Tournament</h2>
            </div>
            <TournamentSelector
              selectedTournamentId={selectedTournamentId}
              onTournamentChange={setSelectedTournamentId}
              label="Choose a tournament to view specific statistics"
            />
          </div>
        )}

        {/* Statistics Display */}
        {viewMode === 'all' && (
          <TeamStatistics 
            teamId={user.uid}
            seasonId={null}
            tournamentId={null}
          />
        )}

        {viewMode === 'season' && selectedSeasonId && (
          <TeamStatistics 
            teamId={user.uid}
            seasonId={selectedSeasonId}
            tournamentId={null}
          />
        )}

        {viewMode === 'tournament' && selectedTournamentId && (
          <TeamStatistics 
            teamId={user.uid}
            seasonId={selectedSeasonId}
            tournamentId={selectedTournamentId}
          />
        )}

        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h3 className="text-sm font-semibold text-blue-800 mb-2">About Statistics</h3>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• All Time: View your complete performance history</li>
                <li>• By Season: Filter statistics for a specific season</li>
                <li>• By Tournament: View detailed stats for individual tournaments</li>
                <li>• Statistics are calculated from completed matches only</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
