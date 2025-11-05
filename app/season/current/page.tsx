'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface Season {
  id: string;
  name: string;
  status: string;
  season_start?: any;
  season_end?: any;
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

export default function CurrentSeasonPage() {
  const [season, setSeason] = useState<Season | null>(null);
  const [teams, setTeams] = useState<TeamStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'rank' | 'points' | 'goals'>('rank');

  useEffect(() => {
    fetchSeasonData();
  }, []);

  const fetchSeasonData = async () => {
    try {
      setLoading(true);
      
      // Fetch current season
      const seasonRes = await fetch('/api/public/current-season');
      const seasonData = await seasonRes.json();
      
      if (seasonData.success) {
        setSeason(seasonData.data);
        
        // Fetch teams for this season using public stats API
        const statsRes = await fetch(`/api/seasons/${seasonData.data.id}/stats`);
        const statsData = await statsRes.json();
        
        if (statsData.success && statsData.data?.teams) {
          setTeams(statsData.data.teams);
        }
      }
    } catch (error) {
      console.error('Error fetching season data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSortedTeams = () => {
    const sorted = [...teams];
    switch (sortBy) {
      case 'rank':
        return sorted.sort((a, b) => a.rank - b.rank);
      case 'points':
        return sorted.sort((a, b) => b.points - a.points);
      case 'goals':
        return sorted.sort((a, b) => b.goals_scored - a.goals_scored);
      default:
        return sorted;
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

  if (!season) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-900 text-lg font-semibold mb-2">No active season found</p>
          <Link href="/" className="text-blue-600 hover:text-blue-700">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const sortedTeams = getSortedTeams();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Season Header */}
      <div className="glass rounded-2xl p-6 sm:p-8 mb-8">
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2 gradient-text">
            {season.name}
          </h1>
          <p className="text-lg text-gray-600 mb-4">
            {season.status === 'active' ? '🟢 Currently Active' : `Status: ${season.status}`}
          </p>
          
          <div className="flex flex-wrap gap-4 justify-center items-center">
            <Link
              href={`/players?season=${season.id}`}
              className="glass px-6 py-2 rounded-lg text-blue-600 font-medium hover:shadow-md transition-all duration-200 hover:scale-105"
            >
              View All Players
            </Link>
            <Link
              href={`/teams?season=${season.id}`}
              className="glass px-6 py-2 rounded-lg text-blue-600 font-medium hover:shadow-md transition-all duration-200 hover:scale-105"
            >
              View All Teams
            </Link>
          </div>
        </div>
      </div>

      {/* Top 3 Podium */}
      {teams.length >= 3 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 text-center">🏆 Top 3 Teams</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {/* Second Place */}
            <Link
              href={`/teams/${teams[1].team_id}?season=${season.id}`}
              className="glass rounded-2xl p-6 hover:shadow-lg transition-all duration-200 hover:scale-105 sm:order-1"
            >
              <div className="text-center">
                <div className="text-4xl mb-3">🥈</div>
                {sortedTeams[1].logo_url && (
                  <div className="w-20 h-20 mx-auto mb-4 rounded-lg overflow-hidden bg-white p-2">
                    <Image
                      src={sortedTeams[1].logo_url}
                      alt={sortedTeams[1].team_name}
                      width={80}
                      height={80}
                      className="object-contain"
                    />
                  </div>
                )}
                <h3 className="font-bold text-lg text-gray-900 mb-1">{sortedTeams[1].team_name}</h3>
                <p className="text-2xl font-bold text-gray-600">{sortedTeams[1].points} pts</p>
              </div>
            </Link>

            {/* First Place */}
            <Link
              href={`/teams/${teams[0].team_id}?season=${season.id}`}
              className="glass rounded-2xl p-6 hover:shadow-lg transition-all duration-200 hover:scale-105 sm:order-2 sm:transform sm:scale-110"
            >
              <div className="text-center">
                <div className="text-5xl mb-3">🥇</div>
                {sortedTeams[0].logo_url && (
                  <div className="w-24 h-24 mx-auto mb-4 rounded-lg overflow-hidden bg-white p-2">
                    <Image
                      src={sortedTeams[0].logo_url}
                      alt={sortedTeams[0].team_name}
                      width={96}
                      height={96}
                      className="object-contain"
                    />
                  </div>
                )}
                <h3 className="font-bold text-xl text-gray-900 mb-1">{sortedTeams[0].team_name}</h3>
                <p className="text-3xl font-bold text-amber-600">{sortedTeams[0].points} pts</p>
              </div>
            </Link>

            {/* Third Place */}
            <Link
              href={`/teams/${teams[2].team_id}?season=${season.id}`}
              className="glass rounded-2xl p-6 hover:shadow-lg transition-all duration-200 hover:scale-105 sm:order-3"
            >
              <div className="text-center">
                <div className="text-4xl mb-3">🥉</div>
                {sortedTeams[2].logo_url && (
                  <div className="w-20 h-20 mx-auto mb-4 rounded-lg overflow-hidden bg-white p-2">
                    <Image
                      src={sortedTeams[2].logo_url}
                      alt={sortedTeams[2].team_name}
                      width={80}
                      height={80}
                      className="object-contain"
                    />
                  </div>
                )}
                <h3 className="font-bold text-lg text-gray-900 mb-1">{sortedTeams[2].team_name}</h3>
                <p className="text-2xl font-bold text-gray-600">{sortedTeams[2].points} pts</p>
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* Full Standings Table */}
      <div className="glass rounded-2xl p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Full Standings</h2>
          
          {/* Sort Options */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'rank' | 'points' | 'goals')}
            className="px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="rank">Sort by Rank</option>
            <option value="points">Sort by Points</option>
            <option value="goals">Sort by Goals</option>
          </select>
        </div>

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
              {sortedTeams.map((team) => (
                <tr key={team.team_id} className="border-b border-gray-100 hover:bg-blue-50 transition-colors">
                  <td className="py-3 px-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${getRankBadgeClass(team.rank)}`}>
                      {getRankIcon(team.rank)} {team.rank}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Link href={`/teams/${team.team_id}?season=${season.id}`} className="flex items-center gap-3 hover:text-blue-600 transition-colors">
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
          {sortedTeams.map((team) => (
            <Link
              key={team.team_id}
              href={`/teams/${team.team_id}?season=${season.id}`}
              className="block bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${getRankBadgeClass(team.rank)}`}>
                  {team.rank}
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
    </div>
  );
}
