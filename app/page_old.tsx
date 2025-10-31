'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
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
  logo_url?: string;
}

interface Champion {
  team_id: string;
  team_name: string;
  championship_count: number;
  seasons_won: string[];
  best_points: number;
  total_wins: number;
  total_goals: number;
}

interface PlayerAwardWinner {
  player_id: string;
  player_name: string;
  times_won: number;
  wins: Array<{ season_id: string; position: string; value: number }>;
  total_value: number;
}

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [topTeams, setTopTeams] = useState<TeamStat[]>([]);
  const [champions, setChampions] = useState<Champion[]>([]);
  const [awardWinners, setAwardWinners] = useState<Record<string, PlayerAwardWinner[]>>({});
  const [loadingData, setLoadingData] = useState(true);

  // Get the appropriate dashboard URL based on user role
  const getDashboardUrl = (userRole: string) => {
    switch (userRole) {
      case 'super_admin':
        return '/dashboard/superadmin';
      case 'committee_admin':
        return '/dashboard/committee';
      case 'team':
        return '/dashboard/team';
      default:
        return '/dashboard';
    }
  };

  // Fetch current season, top teams, champions, and award winners
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingData(true);
        
        // Fetch all data in parallel
        const [seasonRes, championsRes, awardsRes] = await Promise.all([
          fetch('/api/public/current-season'),
          fetch('/api/public/champions'),
          fetch('/api/public/award-winners')
        ]);
        
        const [seasonData, championsData, awardsData] = await Promise.all([
          seasonRes.json(),
          championsRes.json(),
          awardsRes.json()
        ]);
        
        // Set current season
        if (seasonData.success) {
          setCurrentSeason(seasonData.data);
          
          // Fetch top teams for this season
          const teamsRes = await fetch(`/api/team/all?season_id=${seasonData.data.id}`);
          const teamsData = await teamsRes.json();
          
          if (teamsData.success && teamsData.data?.teamStats) {
            // Sort by rank and take top 3
            const sorted = teamsData.data.teamStats
              .sort((a: TeamStat, b: TeamStat) => a.rank - b.rank)
              .slice(0, 3);
            setTopTeams(sorted);
          }
        }
        
        // Set champions
        if (championsData.success) {
          setChampions(championsData.data.champions);
        }
        
        // Set award winners
        if (awardsData.success) {
          setAwardWinners(awardsData.data.awardWinners);
        }
      } catch (error) {
        console.error('Error fetching homepage data:', error);
      } finally {
        setLoadingData(false);
      }
    };
    
    fetchData();
  }, []);

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 gradient-text">
          Welcome to SS League
        </h1>
        <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Experience the thrill of building your dream football team through strategic bidding and competitive auctions
        </p>
        
        {user ? (
          <Link
            href={getDashboardUrl(user.role)}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-200 hover:scale-105"
          >
            Go to Dashboard
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-200 hover:scale-105"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 glass px-8 py-3 rounded-xl font-semibold text-blue-600 hover:shadow-lg transition-all duration-200 hover:scale-105"
            >
              Register
            </Link>
          </div>
        )}
      </div>

      {/* Current Season Highlight */}
      {currentSeason && (
        <div className="glass rounded-2xl p-6 sm:p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                {currentSeason.name}
              </h2>
              <p className="text-gray-600">
                {currentSeason.status === 'active' ? '🟢 Currently Active' : '📅 Season Info'}
              </p>
            </div>
            <Link
              href="/season/current"
              className="glass px-4 py-2 rounded-lg text-blue-600 font-medium hover:shadow-md transition-all duration-200 hover:scale-105"
            >
              View Details →
            </Link>
          </div>

          {/* Top 3 Teams */}
          {!loadingData && topTeams.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">🏆 Current Standings</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {topTeams.map((team, index) => (
                  <Link
                    key={team.team_id}
                    href={`/teams/${team.team_id}`}
                    className="glass rounded-xl p-4 hover:shadow-lg transition-all duration-200 hover:scale-105"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-2xl font-bold text-gray-400">#{index + 1}</div>
                      {team.logo_url && (
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-white">
                          <Image
                            src={team.logo_url}
                            alt={team.team_name}
                            width={40}
                            height={40}
                            className="object-contain"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 truncate">{team.team_name}</div>
                        <div className="text-sm text-gray-600">{team.points} pts</div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {team.wins}W - {team.draws}D - {team.losses}L
                    </div>
                  </Link>
                ))}
              </div>
              <div className="mt-4 text-center">
                <Link
                  href="/season/current"
                  className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                >
                  View Full Standings →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Links Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Link
          href="/players"
          className="glass rounded-2xl p-6 hover:shadow-lg transition-all duration-200 hover:scale-105 group"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Browse Players</h3>
          <p className="text-gray-600 text-sm">Explore all players, stats, and performance</p>
        </Link>

        <Link
          href="/teams"
          className="glass rounded-2xl p-6 hover:shadow-lg transition-all duration-200 hover:scale-105 group"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">View Teams</h3>
          <p className="text-gray-600 text-sm">Check out team rosters and standings</p>
        </Link>

        <Link
          href="/seasons"
          className="glass rounded-2xl p-6 hover:shadow-lg transition-all duration-200 hover:scale-105 group"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Season Archive</h3>
          <p className="text-gray-600 text-sm">Explore past seasons and champions</p>
        </Link>
      </div>

      {/* Trophy Cabinet - League Champions */}
      {!loadingData && champions.length > 0 && (
        <div className="glass rounded-2xl p-6 sm:p-8 mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 flex items-center">
            🏆 Trophy Cabinet - League Champions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {champions.slice(0, 6).map((champion) => (
              <div
                key={champion.team_id}
                className="glass rounded-xl p-5 hover:shadow-lg transition-all duration-200 hover:scale-105 border-2 border-yellow-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold text-lg text-gray-900 flex-1">{champion.team_name}</h3>
                  <div className="text-3xl">
                    {'🏆'.repeat(Math.min(champion.championship_count, 5))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-yellow-600">
                    {champion.championship_count}× League Winner
                  </p>
                  <p className="text-sm text-gray-600">
                    Seasons: {champion.seasons_won.join(', ')}
                  </p>
                  <div className="text-xs text-gray-500 pt-2 border-t">
                    <span>Best: {champion.best_points} pts</span>
                    <span className="mx-2">•</span>
                    <span>{champion.total_wins} wins</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {champions.length > 6 && (
            <div className="mt-4 text-center">
              <Link
                href="/seasons"
                className="text-blue-600 hover:text-blue-700 font-medium text-sm"
              >
                View All Champions →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Player Awards */}
      {!loadingData && Object.keys(awardWinners).length > 0 && (
        <div className="space-y-8 mb-8">
          {Object.entries(awardWinners).slice(0, 5).map(([awardName, winners]) => (
            <div key={awardName} className="glass rounded-2xl p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <span className="text-3xl mr-3">
                  {awardName.includes('Golden Boot') || awardName.includes('Top Scorer') ? '⚽' :
                   awardName.includes('Assist') ? '🎯' :
                   awardName.includes('Goalkeeper') ? '🧤' :
                   awardName.includes('Defender') ? '🛡️' :
                   awardName.includes('Midfielder') ? '⭐' :
                   awardName.includes('Attacker') ? '🔥' :
                   awardName.includes('MVP') || awardName.includes('Player of the Season') ? '👑' :
                   awardName.includes('Young Player') ? '🌟' :
                   awardName.includes('Clean Sheet') ? '🥅' : '🏅'}
                </span>
                {awardName}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {winners.slice(0, 6).map((winner) => (
                  <div
                    key={winner.player_id}
                    className="glass rounded-xl p-4 hover:shadow-lg transition-all duration-200 hover:scale-105"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 flex-1">{winner.player_name}</h3>
                      <span className="text-2xl font-bold text-blue-600">×{winner.times_won}</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      Won {winner.times_won} time{winner.times_won > 1 ? 's' : ''}
                    </p>
                    <div className="text-xs text-gray-500">
                      Seasons: {winner.wins.map((w: any) => w.season_id).join(', ')}
                    </div>
                    {winner.total_value > 0 && (
                      <div className="text-xs font-semibold text-green-600 mt-2">
                        Total: {winner.total_value} {awardName.includes('Goal') ? 'goals' : awardName.includes('Assist') ? 'assists' : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Features */}
      <div className="glass rounded-2xl p-6 sm:p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Why SS League?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Strategic Bidding</h3>
            <p className="text-gray-600 text-sm">Build your dream team through competitive auctions</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Live Stats</h3>
            <p className="text-gray-600 text-sm">Track performance with real-time statistics</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Community</h3>
            <p className="text-gray-600 text-sm">Join a vibrant community of football enthusiasts</p>
          </div>
        </div>
      </div>
    </div>
  );
}
