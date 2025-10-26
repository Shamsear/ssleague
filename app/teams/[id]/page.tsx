'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import Link from 'next/link';
import Image from 'next/image';
import { usePlayerStats, useFixtures } from '@/hooks';

interface TeamData {
  id: string;
  team_id: string;
  team_name: string;
  owner_name?: string;
  logo_url?: string;
  rank?: number;
  points?: number;
  matches_played?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  goals_scored?: number;
  goals_conceded?: number;
}

interface Player {
  id: string;
  player_id: string;
  name: string;
  display_name?: string;
  category?: string;
  photo_url?: string;
  stats?: any;
}

interface Fixture {
  id: string;
  home_team: string;
  away_team: string;
  home_score?: number;
  away_score?: number;
  status: string;
  match_date?: any;
}

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [team, setTeam] = useState<TeamData | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSeasonId, setCurrentSeasonId] = useState<string>('');

  // Use React Query hooks for player stats and fixtures
  const { data: playerStats, isLoading: statsLoading } = usePlayerStats({
    seasonId: currentSeasonId,
    teamId: teamId
  });

  const { data: fixturesData, isLoading: fixturesLoading } = useFixtures({
    seasonId: currentSeasonId,
    teamId: teamId
  });

  const teamId = params.id as string;

  useEffect(() => {
    fetchTeamData();
  }, [teamId]);

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch current season first
      const seasonRes = await fetch('/api/public/current-season');
      const seasonData = await seasonRes.json();
      
      if (!seasonData.success) {
        setError('Could not load season data');
        setLoading(false);
        return;
      }
      
      const seasonId = seasonData.data.id;
      setCurrentSeasonId(seasonId);

      // Fetch team stats for current season
      const teamsRes = await fetch(`/api/team/all?season_id=${seasonId}`);
      const teamsData = await teamsRes.json();
      
      if (teamsData.success && teamsData.data?.teamStats) {
        const teamStat = teamsData.data.teamStats.find((t: TeamData) => t.team_id === teamId);
        if (teamStat) {
          setTeam(teamStat);
        } else {
          setError('Team not found');
        }
      }

      // Note: Player stats and fixtures are now fetched via React Query hooks
      // No direct Firebase queries needed - data is cached automatically!

      setLoading(false);
    } catch (error) {
      console.error('Error fetching team data:', error);
      setError('Failed to load team data');
      setLoading(false);
    }
  };

  // Fetch player details from Firebase (master data) when we have stats
  useEffect(() => {
    const fetchPlayerDetails = async () => {
      if (!playerStats || playerStats.length === 0) return;
      
      const playersData: Player[] = [];
      for (const stat of playerStats) {
        try {
          const playerDoc = await getDoc(doc(db, 'realplayers', stat.player_id));
          if (playerDoc.exists()) {
            playersData.push({
              id: playerDoc.id,
              ...playerDoc.data(),
              stats: stat // Include stats from Neon
            } as Player);
          }
        } catch (err) {
          console.error(`Error fetching player ${stat.player_id}:`, err);
        }
      }
      setPlayers(playersData);
    };
    
    fetchPlayerDetails();
  }, [playerStats]);

  if (loading || statsLoading || fixturesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading team...</p>
        </div>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-900 text-lg font-semibold mb-2">{error}</p>
          <Link href="/teams" className="text-blue-600 hover:text-blue-700">
            ← Back to Teams
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Back Button */}
      <Link
        href="/teams"
        className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6 font-medium"
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Teams
      </Link>

      {/* Team Header */}
      <div className="glass rounded-2xl p-6 sm:p-8 mb-8">
        <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
          {/* Team Logo */}
          {team.logo_url && (
            <div className="w-32 h-32 rounded-xl overflow-hidden bg-white flex-shrink-0 p-4">
              <Image
                src={team.logo_url}
                alt={team.team_name}
                width={128}
                height={128}
                className="object-contain"
              />
            </div>
          )}

          {/* Team Info */}
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-3xl sm:text-4xl font-bold mb-2 gradient-text">
              {team.team_name}
            </h1>
            {team.owner_name && (
              <p className="text-gray-600 mb-3">Owner: {team.owner_name}</p>
            )}
            
            <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
              {team.rank && (
                <span className={`px-4 py-2 rounded-lg font-bold ${
                  team.rank === 1 ? 'bg-amber-500 text-white' :
                  team.rank === 2 ? 'bg-gray-300 text-gray-700' :
                  team.rank === 3 ? 'bg-amber-700 text-white' :
                  'bg-blue-100 text-blue-600'
                }`}>
                  Rank #{team.rank}
                </span>
              )}
              <span className="px-4 py-2 rounded-lg bg-blue-500 text-white font-semibold">
                {team.points || 0} Points
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Current Season Stats */}
      <div className="glass rounded-2xl p-6 sm:p-8 mb-8">
        <h2 className="text-2xl font-bold mb-6 text-gray-900">Current Season Statistics</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <div className="text-2xl sm:text-3xl font-bold text-blue-600 mb-1">
              {team.matches_played || 0}
            </div>
            <div className="text-sm text-gray-600">Matches</div>
          </div>
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <div className="text-2xl sm:text-3xl font-bold text-green-600 mb-1">
              {team.wins || 0}
            </div>
            <div className="text-sm text-gray-600">Wins</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <div className="text-2xl sm:text-3xl font-bold text-gray-600 mb-1">
              {team.draws || 0}
            </div>
            <div className="text-sm text-gray-600">Draws</div>
          </div>
          <div className="bg-red-50 rounded-xl p-4 text-center">
            <div className="text-2xl sm:text-3xl font-bold text-red-600 mb-1">
              {team.losses || 0}
            </div>
            <div className="text-sm text-gray-600">Losses</div>
          </div>
          <div className="bg-purple-50 rounded-xl p-4 text-center">
            <div className="text-2xl sm:text-3xl font-bold text-purple-600 mb-1">
              {team.goals_scored || 0} - {team.goals_conceded || 0}
            </div>
            <div className="text-sm text-gray-600">Goals (F-A)</div>
          </div>
        </div>
      </div>

      {/* Squad Roster */}
      {players.length > 0 && (
        <div className="glass rounded-2xl p-6 sm:p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">Squad Roster ({players.length} Players)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(players || []).map((player) => (
              <Link
                key={player.id}
                href={`/players/${player.id}`}
                className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md transition-all duration-200 hover:scale-105 flex items-center gap-3"
              >
                {player.photo_url ? (
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    <Image
                      src={player.photo_url}
                      alt={player.name}
                      width={48}
                      height={48}
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 truncate">
                    {player.display_name || player.name}
                  </div>
                  {player.category && (
                    <div className={`text-xs font-medium ${
                      player.category === 'Legend' ? 'text-amber-600' : 'text-blue-600'
                    }`}>
                      {player.category}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Fixtures */}
      {fixtures.length > 0 && (
        <div className="glass rounded-2xl p-6 sm:p-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900">Fixtures</h2>
          <div className="space-y-3">
            {fixtures.slice(0, 5).map((fixture) => (
              <div key={fixture.id} className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{fixture.home_team}</div>
                    <div className="text-sm text-gray-600">Home</div>
                  </div>
                  
                  {fixture.status === 'completed' ? (
                    <div className="px-4 py-2 bg-blue-50 rounded-lg font-bold text-blue-600">
                      {fixture.home_score} - {fixture.away_score}
                    </div>
                  ) : (
                    <div className="px-4 py-2 bg-gray-100 rounded-lg text-gray-600 text-sm">
                      {fixture.status}
                    </div>
                  )}
                  
                  <div className="flex-1 text-right">
                    <div className="font-semibold text-gray-900">{fixture.away_team}</div>
                    <div className="text-sm text-gray-600">Away</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
