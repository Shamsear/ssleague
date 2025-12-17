'use client';

import { useEffect, useState } from 'react';
import LeagueStandingsTable from './LeagueStandingsTable';
import GroupStageStandings from './GroupStageStandings';
import KnockoutBracket from './KnockoutBracket';
import ShareableLeaderboard from './ShareableLeaderboard';

interface TournamentStandingsProps {
  tournamentId: string;
  currentUserId?: string;
}

export default function TournamentStandings({ tournamentId, currentUserId }: TournamentStandingsProps) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'standings' | 'knockout'>('standings');
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [availableRounds, setAvailableRounds] = useState<number[]>([]);

  useEffect(() => {
    if (!tournamentId) return;

    const fetchStandings = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Build URL with optional round filter
        const url = selectedRound 
          ? `/api/tournaments/${tournamentId}/standings?upToRound=${selectedRound}`
          : `/api/tournaments/${tournamentId}/standings`;
        
        const response = await fetch(url);
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch standings');
        }

        setData(result);
        
        // Set default tab based on format
        if (result.format === 'knockout') {
          setActiveTab('knockout');
        } else {
          setActiveTab('standings');
        }
      } catch (err: any) {
        console.error('Error fetching tournament standings:', err);
        setError(err.message || 'Failed to load standings');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStandings();
  }, [tournamentId, selectedRound]);

  // Fetch available rounds for the tournament
  useEffect(() => {
    if (!tournamentId) return;

    const fetchRounds = async () => {
      try {
        const response = await fetch(`/api/tournaments/${tournamentId}/rounds`);
        const result = await response.json();
        
        if (result.success && result.rounds) {
          const roundNumbers = result.rounds
            .map((r: any) => r.round_number)
            .filter((n: number) => n !== null && n !== undefined)
            .sort((a: number, b: number) => a - b);
          
          setAvailableRounds(roundNumbers);
        }
      } catch (err) {
        console.error('Error fetching rounds:', err);
      }
    };

    fetchRounds();
  }, [tournamentId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading standings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <span className="text-4xl mb-2 block">⚠️</span>
        <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Standings</h3>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-8 text-center">
        <span className="text-6xl mb-4 block">📊</span>
        <h3 className="text-lg font-medium text-gray-600 mb-2">No Standings Available</h3>
        <p className="text-sm text-gray-500">Standings will appear once matches are completed</p>
      </div>
    );
  }

  const { format, has_knockout, standings, groupStandings, knockoutFixtures, playoff_spots, tournament_name, season_name } = data;

  // Determine what to show based on format
  const showLeagueStandings = format === 'league' && standings;
  const showGroupStandings = format === 'group_stage' && groupStandings;
  const showKnockout = (format === 'knockout' || has_knockout) && knockoutFixtures;
  const hasBothStages = (showLeagueStandings || showGroupStandings) && showKnockout;

  return (
    <div className="space-y-6">
      {/* Round Selector - Only show for league standings */}
      {showLeagueStandings && availableRounds.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3 lg:gap-4">
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-2xl">🎯</span>
              <label className="text-sm font-semibold text-gray-800 whitespace-nowrap">Filter by Round:</label>
            </div>
            
            {/* Dropdown for mobile/small screens */}
            <div className="w-full lg:hidden">
              <select
                value={selectedRound === null ? 'all' : selectedRound}
                onChange={(e) => setSelectedRound(e.target.value === 'all' ? null : Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-white border-2 border-blue-300 rounded-lg font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
              >
                <option value="all">📊 All Rounds (Current Standings)</option>
                {availableRounds.map((roundNum) => (
                  <option key={roundNum} value={roundNum}>
                    Round {roundNum}
                  </option>
                ))}
              </select>
            </div>

            {/* Buttons for larger screens */}
            <div className="hidden lg:flex flex-wrap items-center gap-2 flex-1">
              <button
                onClick={() => setSelectedRound(null)}
                className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                  selectedRound === null
                    ? 'bg-[#0066FF] text-white shadow-lg scale-105'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 hover:border-blue-300'
                }`}
              >
                📊 All Rounds
              </button>
              <div className="h-6 w-px bg-gray-300 mx-1"></div>
              {availableRounds.map((roundNum) => (
                <button
                  key={roundNum}
                  onClick={() => setSelectedRound(roundNum)}
                  className={`px-3.5 py-2 rounded-lg font-medium transition-all text-sm ${
                    selectedRound === roundNum
                      ? 'bg-[#0066FF] text-white shadow-lg scale-105'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 hover:border-blue-300'
                  }`}
                >
                  R{roundNum}
                </button>
              ))}
            </div>
          </div>
          
          {/* Info text */}
          {selectedRound !== null && (
            <div className="mt-3 pt-3 border-t border-blue-200">
              <p className="text-xs text-gray-600 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Showing standings after Round {selectedRound} (includes only matches up to this round)
              </p>
            </div>
          )}
        </div>
      )}

      {/* Share Leaderboard Feature - Only show for league standings */}
      {showLeagueStandings && standings && standings.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">📸</span>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Share Leaderboard</h3>
              <p className="text-sm text-gray-600">Generate and share a beautiful image of the current standings</p>
            </div>
          </div>
          <ShareableLeaderboard 
            standings={standings}
            tournamentName={tournament_name || 'Tournament'}
            seasonName={season_name}
            format={format}
            selectedRound={selectedRound}
            availableRounds={availableRounds}
          />
        </div>
      )}
      {/* Tabs for combined formats (League+Knockout or Group+Knockout) */}
      {hasBothStages && (
        <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-xl p-4">
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setActiveTab('standings')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'standings'
                  ? 'bg-[#0066FF] text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {format === 'group_stage' ? '🏆 Group Stage' : '⚽ League Standings'}
            </button>
            <button
              onClick={() => setActiveTab('knockout')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'knockout'
                  ? 'bg-[#0066FF] text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🥇 Knockout Stage
            </button>
          </div>
        </div>
      )}

      {/* Render appropriate view based on format and active tab */}
      {activeTab === 'standings' && (
        <>
          {showLeagueStandings && (
            <LeagueStandingsTable 
              standings={standings} 
              currentUserId={currentUserId}
              showPlayoffIndicator={has_knockout}
              playoffSpots={playoff_spots || 4}
            />
          )}
          
          {showGroupStandings && (
            <GroupStageStandings 
              groupStandings={groupStandings}
              currentUserId={currentUserId}
            />
          )}
        </>
      )}

      {activeTab === 'knockout' && showKnockout && (
        <KnockoutBracket knockoutFixtures={knockoutFixtures} />
      )}

      {/* Format Info Badge */}
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-full">
          <span className="text-sm font-medium text-blue-700">
            {format === 'league' && has_knockout && '⚽ League + 🥇 Knockout Format'}
            {format === 'league' && !has_knockout && '⚽ League Format'}
            {format === 'group_stage' && has_knockout && '🏆 Group Stage + 🥇 Knockout Format'}
            {format === 'group_stage' && !has_knockout && '🏆 Group Stage Format'}
            {format === 'knockout' && '🥇 Knockout Format'}
          </span>
        </div>
      </div>
    </div>
  );
}
