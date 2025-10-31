'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import Link from 'next/link';
import Image from 'next/image';

interface Season {
  id: string;
  name: string;
  short_name?: string;
  status: string;
  is_historical: boolean;
  season_start?: any;
  season_end?: any;
  champion_team_name?: string;
  runner_up_team_name?: string;
  total_teams?: number;
  total_players?: number;
}

interface TeamStat {
  team_id: string;
  team_name: string;
  rank: number;
  points: number;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_scored: number;
  goals_conceded: number;
  logo_url?: string;
}

interface PlayerStat {
  player_id: string;
  player_name: string;
  team_id: string;
  team_name: string;
  category?: string;
  star_rating?: number;
  rating?: number;
  matches_played: number;
  goals_scored: number;
  clean_sheets: number;
  points: number;
}

interface PlayerAward {
  id: string;
  player_id: string;
  player_name: string;
  award_category: string;
  award_type: string;
  award_position?: string;
  player_category?: string;
}

interface Trophy {
  id: string;
  team_id: string;
  team_name: string;
  trophy_type: string;
  trophy_name: string;
  trophy_position?: string;
  position?: number;
}

export default function SeasonDetailPage() {
  const params = useParams();
  const seasonId = params.id as string;
  const [season, setSeason] = useState<Season | null>(null);
  const [teams, setTeams] = useState<TeamStat[]>([]);
  const [players, setPlayers] = useState<PlayerStat[]>([]);
  const [playerAwards, setPlayerAwards] = useState<PlayerAward[]>([]);
  const [trophies, setTrophies] = useState<Trophy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'teams' | 'players' | 'awards' | 'trophies'>('teams');

  useEffect(() => {
    fetchSeasonData();
  }, [seasonId]);

  const fetchSeasonData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch season details from Firebase
      const seasonDoc = await getDoc(doc(db, 'seasons', seasonId));
      
      if (!seasonDoc.exists()) {
        setError('Season not found');
        setLoading(false);
        return;
      }

      const seasonData = seasonDoc.data();
      let name = seasonData.name;
      
      // Generate name from ID if missing
      if (!name && seasonId) {
        const seasonNum = seasonId.match(/\d+/);
        if (seasonNum) {
          name = `Season ${seasonNum[0]}`;
        } else {
          name = seasonId;
        }
      }

      setSeason({
        id: seasonDoc.id,
        ...seasonData,
        name
      } as Season);

      // Fetch team and player stats for this season
      const [statsRes, awardsRes, trophiesRes] = await Promise.all([
        fetch(`/api/seasons/${seasonId}/stats`),
        fetch(`/api/player-awards?season_id=${seasonId}`),
        fetch(`/api/trophies?season_id=${seasonId}`)
      ]);
      
      const [statsData, awardsData, trophiesData] = await Promise.all([
        statsRes.json(),
        awardsRes.json(),
        trophiesRes.json()
      ]);
      
      if (statsData.success && statsData.data) {
        setTeams(statsData.data.teams || []);
        setPlayers(statsData.data.players || []);
      }

      if (awardsData.success) {
        setPlayerAwards(awardsData.awards || []);
      }

      if (trophiesData.success) {
        setTrophies(trophiesData.trophies || []);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching season data:', error);
      setError('Failed to load season data');
      setLoading(false);
    }
  };

  const getRankBadgeClass = (rank: number) => {
    if (rank === 1) return 'bg-amber-500 text-white';
    if (rank === 2) return 'bg-gray-300 text-gray-700';
    if (rank === 3) return 'bg-amber-700 text-white';
    return 'bg-blue-100 text-blue-600';
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading season...</p>
        </div>
      </div>
    );
  }

  if (error || !season) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-900 text-lg font-semibold mb-2">{error || 'Season not found'}</p>
          <Link href="/seasons" className="text-blue-600 hover:text-blue-700">
            ← Back to Seasons
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Back Button */}
      <Link
        href="/seasons"
        className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6 font-medium"
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Seasons
      </Link>

      {/* Season Header */}
      <div className="glass rounded-2xl p-6 sm:p-8 mb-8">
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2 gradient-text">
            {season.name}
          </h1>
          {season.short_name && (
            <p className="text-lg text-gray-600 mb-4">{season.short_name}</p>
          )}
          {season.is_historical && (
            <span className="inline-block px-3 py-1 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium">
              📚 Historical Season
            </span>
          )}
        </div>

        {/* Champion Info */}
        {season.champion_team_name && (
          <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-200 max-w-md mx-auto">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-2xl">🏆</span>
              <span className="text-sm font-bold text-amber-700 uppercase">Champion</span>
            </div>
            <p className="font-bold text-amber-900 text-xl text-center">
              {season.champion_team_name}
            </p>
            {season.runner_up_team_name && (
              <p className="text-sm text-amber-700 mt-2 text-center">
                Runner-up: {season.runner_up_team_name}
              </p>
            )}
          </div>
        )}

        {/* Season Stats */}
        {(season.total_teams || season.total_players) && (
          <div className="grid grid-cols-2 gap-4 max-w-md mx-auto mt-6">
            {season.total_teams && (
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-blue-600">{season.total_teams}</div>
                <div className="text-sm text-gray-600 mt-1">Teams</div>
              </div>
            )}
            {season.total_players && (
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-purple-600">{season.total_players}</div>
                <div className="text-sm text-gray-600 mt-1">Players</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Top 3 Podium */}
      {teams.length >= 3 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 text-center">🏆 Top 3 Teams</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {/* Second Place */}
            <Link
              href={`/teams/${teams[1].team_id}?season=${seasonId}`}
              className="glass rounded-2xl p-6 hover:shadow-lg transition-all duration-200 hover:scale-105 sm:order-1"
            >
              <div className="text-center">
                <div className="text-4xl mb-3">🥈</div>
                {teams[1].logo_url && (
                  <div className="w-20 h-20 mx-auto mb-4 rounded-lg overflow-hidden bg-white p-2">
                    <Image
                      src={teams[1].logo_url}
                      alt={teams[1].team_name}
                      width={80}
                      height={80}
                      className="object-contain"
                    />
                  </div>
                )}
                <h3 className="font-bold text-lg text-gray-900 mb-1">{teams[1].team_name}</h3>
                <p className="text-2xl font-bold text-gray-600">{teams[1].points} pts</p>
              </div>
            </Link>

            {/* First Place */}
            <Link
              href={`/teams/${teams[0].team_id}?season=${seasonId}`}
              className="glass rounded-2xl p-6 hover:shadow-lg transition-all duration-200 hover:scale-105 sm:order-2 sm:transform sm:scale-110"
            >
              <div className="text-center">
                <div className="text-5xl mb-3">🥇</div>
                {teams[0].logo_url && (
                  <div className="w-24 h-24 mx-auto mb-4 rounded-lg overflow-hidden bg-white p-2">
                    <Image
                      src={teams[0].logo_url}
                      alt={teams[0].team_name}
                      width={96}
                      height={96}
                      className="object-contain"
                    />
                  </div>
                )}
                <h3 className="font-bold text-xl text-gray-900 mb-1">{teams[0].team_name}</h3>
                <p className="text-3xl font-bold text-amber-600">{teams[0].points} pts</p>
              </div>
            </Link>

            {/* Third Place */}
            <Link
              href={`/teams/${teams[2].team_id}?season=${seasonId}`}
              className="glass rounded-2xl p-6 hover:shadow-lg transition-all duration-200 hover:scale-105 sm:order-3"
            >
              <div className="text-center">
                <div className="text-4xl mb-3">🥉</div>
                {teams[2].logo_url && (
                  <div className="w-20 h-20 mx-auto mb-4 rounded-lg overflow-hidden bg-white p-2">
                    <Image
                      src={teams[2].logo_url}
                      alt={teams[2].team_name}
                      width={80}
                      height={80}
                      className="object-contain"
                    />
                  </div>
                )}
                <h3 className="font-bold text-lg text-gray-900 mb-1">{teams[2].team_name}</h3>
                <p className="text-2xl font-bold text-gray-600">{teams[2].points} pts</p>
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveTab('teams')}
          className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold transition-all text-sm sm:text-base ${
            activeTab === 'teams'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'glass text-gray-700 hover:bg-gray-100'
          }`}
        >
          🏆 Teams ({teams.length})
        </button>
        <button
          onClick={() => setActiveTab('players')}
          className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold transition-all text-sm sm:text-base ${
            activeTab === 'players'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'glass text-gray-700 hover:bg-gray-100'
          }`}
        >
          ⚽ Players ({players.length})
        </button>
        <button
          onClick={() => setActiveTab('awards')}
          className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold transition-all text-sm sm:text-base ${
            activeTab === 'awards'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'glass text-gray-700 hover:bg-gray-100'
          }`}
        >
          ⭐ Awards ({playerAwards.length})
        </button>
        <button
          onClick={() => setActiveTab('trophies')}
          className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold transition-all text-sm sm:text-base ${
            activeTab === 'trophies'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'glass text-gray-700 hover:bg-gray-100'
          }`}
        >
          🏆 Trophies ({trophies.length})
        </button>
      </div>

      {/* Team Standings */}
      {activeTab === 'teams' && teams.length > 0 && (
        <div className="glass rounded-2xl p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Full Standings</h2>

          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Rank</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Team</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">MP</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">W</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">D</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">L</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">GF</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">GA</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">GD</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Pts</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team, index) => (
                  <tr key={team.team_id} className="border-b border-gray-100 hover:bg-blue-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${getRankBadgeClass(team.rank || index + 1)}`}>
                        {getRankIcon(team.rank || index + 1)} {team.rank || index + 1}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Link href={`/teams/${team.team_id}?season=${seasonId}`} className="flex items-center gap-3 hover:text-blue-600 transition-colors">
                        {team.logo_url && (
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-white">
                            <Image
                              src={team.logo_url}
                              alt={team.team_name}
                              width={40}
                              height={40}
                              className="object-contain p-1"
                            />
                          </div>
                        )}
                        <span className="font-semibold">{team.team_name}</span>
                      </Link>
                    </td>
                    <td className="text-center py-3 px-4 text-gray-700">{team.matches_played}</td>
                    <td className="text-center py-3 px-4 text-green-600 font-semibold">{team.wins}</td>
                    <td className="text-center py-3 px-4 text-gray-600">{team.draws}</td>
                    <td className="text-center py-3 px-4 text-red-600 font-semibold">{team.losses}</td>
                    <td className="text-center py-3 px-4 text-gray-700">{team.goals_scored}</td>
                    <td className="text-center py-3 px-4 text-gray-700">{team.goals_conceded}</td>
                    <td className="text-center py-3 px-4 font-semibold text-gray-900">
                      {team.goals_scored - team.goals_conceded > 0 ? '+' : ''}
                      {team.goals_scored - team.goals_conceded}
                    </td>
                    <td className="text-center py-3 px-4 font-bold text-blue-600 text-lg">{team.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-4">
            {teams.map((team, index) => (
              <Link
                key={team.team_id}
                href={`/teams/${team.team_id}?season=${seasonId}`}
                className="block bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${getRankBadgeClass(team.rank || index + 1)}`}>
                    {team.rank || index + 1}
                  </div>
                  {team.logo_url && (
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-white">
                      <Image
                        src={team.logo_url}
                        alt={team.team_name}
                        width={48}
                        height={48}
                        className="object-contain p-1"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="font-bold text-gray-900">{team.team_name}</div>
                    <div className="text-sm text-blue-600 font-semibold">{team.points} pts</div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs text-center">
                  <div>
                    <div className="text-gray-600">MP</div>
                    <div className="font-semibold text-gray-900">{team.matches_played}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">W-D-L</div>
                    <div className="font-semibold text-gray-900">{team.wins}-{team.draws}-{team.losses}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Goals</div>
                    <div className="font-semibold text-gray-900">{team.goals_scored}-{team.goals_conceded}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">GD</div>
                    <div className="font-semibold text-gray-900">
                      {team.goals_scored - team.goals_conceded > 0 ? '+' : ''}
                      {team.goals_scored - team.goals_conceded}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Players Leaderboard */}
      {activeTab === 'players' && players.length > 0 && (
        <div className="glass rounded-2xl p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Player Leaderboard</h2>

          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Rank</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Player</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Team</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Cat</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">MP</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Goals</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">CS</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700">Pts</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player, index) => (
                  <tr key={player.player_id} className="border-b border-gray-100 hover:bg-blue-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                        {index + 1}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Link href={`/players/${player.player_id}`} className="hover:text-blue-600 transition-colors">
                        <span className="font-semibold">{player.player_name}</span>
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-gray-700 text-sm">{player.team_name}</span>
                    </td>
                    <td className="text-center py-3 px-4">
                      {player.category && (
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          player.category.toLowerCase() === 'legend'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {player.category}
                        </span>
                      )}
                    </td>
                    <td className="text-center py-3 px-4 text-gray-700">{player.matches_played}</td>
                    <td className="text-center py-3 px-4 text-purple-600 font-semibold">⚽ {player.goals_scored}</td>
                    <td className="text-center py-3 px-4 text-green-600 font-semibold">🛡️ {player.clean_sheets}</td>
                    <td className="text-center py-3 px-4 font-bold text-blue-600 text-lg">{player.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-4">
            {players.map((player, index) => (
              <Link
                key={player.player_id}
                href={`/players/${player.player_id}`}
                className="block bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-gray-900">{player.player_name}</div>
                    <div className="text-sm text-gray-600">{player.team_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-blue-600">{player.points}</div>
                    <div className="text-xs text-gray-600">pts</div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs text-center">
                  <div>
                    <div className="text-gray-600">MP</div>
                    <div className="font-semibold text-gray-900">{player.matches_played}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Goals</div>
                    <div className="font-semibold text-purple-600">⚽ {player.goals_scored}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">CS</div>
                    <div className="font-semibold text-green-600">🛡️ {player.clean_sheets}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Cat</div>
                    <div className="font-semibold text-gray-900">{player.category || '-'}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Player Awards */}
      {activeTab === 'awards' && playerAwards.length > 0 && (
        <div className="glass rounded-2xl p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">⭐ Player Awards</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {playerAwards.map((award) => {
              const isWinner = award.award_position?.toLowerCase().includes('winner');
              const isRunnerUp = award.award_position?.toLowerCase().includes('runner');
              const isThird = award.award_position?.toLowerCase().includes('third');
              
              return (
                <div
                  key={award.id}
                  className={`bg-white rounded-xl p-4 border-2 hover:shadow-lg transition-all ${
                    isWinner ? 'border-yellow-400' :
                    isRunnerUp ? 'border-gray-300' :
                    isThird ? 'border-orange-300' :
                    'border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="text-3xl flex-shrink-0">⭐</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-1">
                        {award.award_type}
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                          award.award_category === 'individual'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-indigo-100 text-indigo-700'
                        }`}>
                          {award.award_category === 'individual' ? 'Individual' : 'Category'}
                        </span>
                        {award.award_position && (
                          <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                            isWinner ? 'bg-yellow-100 text-yellow-800' :
                            isRunnerUp ? 'bg-gray-200 text-gray-700' :
                            isThird ? 'bg-orange-100 text-orange-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {award.award_position}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={`rounded-lg p-3 ${
                    isWinner ? 'bg-gradient-to-br from-yellow-50 to-amber-50' :
                    isRunnerUp ? 'bg-gradient-to-br from-gray-50 to-slate-50' :
                    isThird ? 'bg-gradient-to-br from-orange-50 to-amber-50' :
                    'bg-gradient-to-br from-blue-50 to-indigo-50'
                  }`}>
                    <div className="font-bold text-lg text-gray-900 mb-1">
                      <Link href={`/players/${award.player_id}`} className="hover:text-blue-600">
                        {award.player_name}
                      </Link>
                    </div>
                    {award.player_category && (
                      <div className="text-xs text-gray-600">{award.player_category}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trophies */}
      {activeTab === 'trophies' && trophies.length > 0 && (
        <div className="glass rounded-2xl p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">🏆 Trophies</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {trophies.map((trophy) => {
              const isChampion = trophy.position === 1 || trophy.trophy_position?.toLowerCase().includes('champion');
              const isRunnerUp = trophy.position === 2 || trophy.trophy_position?.toLowerCase().includes('runner');
              const isThird = trophy.position === 3 || trophy.trophy_position?.toLowerCase().includes('third');
              
              return (
                <div
                  key={trophy.id}
                  className={`bg-white rounded-xl p-4 border-2 hover:shadow-lg transition-all ${
                    isChampion ? 'border-yellow-400' :
                    isRunnerUp ? 'border-gray-300' :
                    isThird ? 'border-orange-300' :
                    'border-blue-200'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="text-3xl flex-shrink-0">🏆</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-1">
                        {trophy.trophy_name}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-md text-xs font-medium capitalize ${
                        trophy.trophy_type === 'league' ? 'bg-yellow-100 text-yellow-800' :
                        trophy.trophy_type === 'runner_up' ? 'bg-gray-200 text-gray-700' :
                        trophy.trophy_type === 'cup' ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {trophy.trophy_type.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div className={`rounded-lg p-3 ${
                    isChampion ? 'bg-gradient-to-br from-yellow-50 to-amber-50' :
                    isRunnerUp ? 'bg-gradient-to-br from-gray-50 to-slate-50' :
                    isThird ? 'bg-gradient-to-br from-orange-50 to-amber-50' :
                    'bg-gradient-to-br from-blue-50 to-indigo-50'
                  }`}>
                    <div className="font-bold text-lg text-gray-900 mb-1">
                      <Link href={`/teams/${trophy.team_id}`} className="hover:text-blue-600">
                        {trophy.team_name}
                      </Link>
                    </div>
                    {trophy.trophy_position && (
                      <div className="text-xs font-semibold text-orange-600">{trophy.trophy_position}</div>
                    )}
                    {trophy.position && (
                      <div className="text-xs text-gray-600">League Position: #{trophy.position}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
