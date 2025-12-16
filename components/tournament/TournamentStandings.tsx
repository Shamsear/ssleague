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

  useEffect(() => {
    if (!tournamentId) return;

    const fetchStandings = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/tournaments/${tournamentId}/standings`);
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
