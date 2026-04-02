'use client';

import { useEffect, useState } from 'react';

interface TeamStatisticsProps {
  teamId: string;
  seasonId?: string | null;
  tournamentId?: string | null;
}

interface OverallStats {
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  clean_sheets: number;
  win_percentage: number;
}

interface TournamentStats {
  tournament_id: string;
  tournament_name: string;
  season_id: string;
  season_name: string;
  format: string;
  has_knockout: boolean;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  clean_sheets: number;
  league_position: number | null;
  group_name: string | null;
  group_position: number | null;
  knockout_stage_reached: string | null;
}

interface SeasonSummary {
  season_id: string;
  season_name: string;
  tournaments_played: number;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  clean_sheets: number;
}

interface TeamInfo {
  team_id: string;
  team_name: string;
  team_logo: string | null;
  captain_name?: string;
}

export default function TeamStatistics({ teamId, seasonId, tournamentId }: TeamStatisticsProps) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overall' | 'tournaments' | 'seasons'>('overall');

  useEffect(() => {
    if (!teamId) return;

    const fetchStatistics = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Build URL with optional filters
        const params = new URLSearchParams();
        if (seasonId) params.append('seasonId', seasonId);
        if (tournamentId) params.append('tournamentId', tournamentId);
        
        const url = `/api/teams/${teamId}/statistics${params.toString() ? `?${params.toString()}` : ''}`;
        
        const response = await fetch(url);
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch statistics');
        }

        setData(result);
      } catch (err: any) {
        console.error('Error fetching team statistics:', err);
        setError(err.message || 'Failed to load statistics');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatistics();
  }, [teamId, seasonId, tournamentId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading statistics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <span className="text-4xl mb-2 block">⚠️</span>
        <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Statistics</h3>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-8 text-center">
        <span className="text-6xl mb-4 block">📊</span>
        <h3 className="text-lg font-medium text-gray-600 mb-2">No Statistics Available</h3>
        <p className="text-sm text-gray-500">Statistics will appear once matches are completed</p>
      </div>
    );
  }

  const { team, overall, tournaments, seasons } = data;

  return (
    <div className="space-y-6">
      {/* Team Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6">
        <div className="flex items-center gap-4">
          {team.team_logo ? (
            <img 
              src={team.team_logo} 
              alt={`${team.team_name} logo`}
              className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-lg"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-2xl border-4 border-white shadow-lg">
              {team.team_name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{team.team_name}</h2>
            {team.captain_name && (
              <p className="text-sm text-gray-600">Captain: {team.captain_name}</p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-xl p-4">
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <button
            onClick={() => setActiveTab('overall')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'overall'
                ? 'bg-[#0066FF] text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📊 Overall Stats
          </button>
          <button
            onClick={() => setActiveTab('tournaments')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'tournaments'
                ? 'bg-[#0066FF] text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            🏆 By Tournament
          </button>
          <button
            onClick={() => setActiveTab('seasons')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'seasons'
                ? 'bg-[#0066FF] text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📅 By Season
          </button>
        </div>
      </div>

      {/* Overall Stats View */}
      {activeTab === 'overall' && (
        <OverallStatsView stats={overall} />
      )}

      {/* Tournament Stats View */}
      {activeTab === 'tournaments' && (
        <TournamentStatsView tournaments={tournaments} />
      )}

      {/* Season Stats View */}
      {activeTab === 'seasons' && (
        <SeasonStatsView seasons={seasons} />
      )}
    </div>
  );
}

function OverallStatsView({ stats }: { stats: OverallStats }) {
  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard 
          icon="⚽" 
          label="Matches" 
          value={stats.matches_played} 
          color="blue"
        />
        <MetricCard 
          icon="🏆" 
          label="Wins" 
          value={stats.wins} 
          color="green"
        />
        <MetricCard 
          icon="📊" 
          label="Points" 
          value={stats.points} 
          color="purple"
        />
        <MetricCard 
          icon="📈" 
          label="Win %" 
          value={`${stats.win_percentage}%`} 
          color="indigo"
        />
      </div>

      {/* Detailed Stats */}
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <h3 className="text-xl font-bold text-gray-900">Detailed Statistics</h3>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Match Results */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-500 uppercase">Match Results</h4>
              <StatRow label="Wins" value={stats.wins} icon="✅" color="green" />
              <StatRow label="Draws" value={stats.draws} icon="🤝" color="gray" />
              <StatRow label="Losses" value={stats.losses} icon="❌" color="red" />
              <StatRow label="Clean Sheets" value={stats.clean_sheets} icon="🛡️" color="blue" />
            </div>

            {/* Goals */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-500 uppercase">Goals</h4>
              <StatRow label="Goals For" value={stats.goals_for} icon="⚽" color="green" />
              <StatRow label="Goals Against" value={stats.goals_against} icon="🥅" color="red" />
              <StatRow 
                label="Goal Difference" 
                value={stats.goal_difference > 0 ? `+${stats.goal_difference}` : stats.goal_difference} 
                icon="📊" 
                color={stats.goal_difference > 0 ? 'green' : stats.goal_difference < 0 ? 'red' : 'gray'}
              />
              <StatRow 
                label="Avg Goals/Match" 
                value={(stats.goals_for / (stats.matches_played || 1)).toFixed(2)} 
                icon="🎯" 
                color="blue"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TournamentStatsView({ tournaments }: { tournaments: TournamentStats[] }) {
  if (tournaments.length === 0) {
    return (
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-8 text-center">
        <span className="text-6xl mb-4 block">🏆</span>
        <h3 className="text-lg font-medium text-gray-600 mb-2">No Tournament Data</h3>
        <p className="text-sm text-gray-500">Tournament statistics will appear once you participate</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tournaments.map((tournament) => (
        <div 
          key={tournament.tournament_id}
          className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl overflow-hidden border border-gray-100"
        >
          {/* Tournament Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{tournament.tournament_name}</h3>
                <p className="text-sm text-gray-600">{tournament.season_name}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {tournament.league_position && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                    🏅 Position: {tournament.league_position}
                  </span>
                )}
                {tournament.group_name && tournament.group_position && (
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                    {tournament.group_name} - P{tournament.group_position}
                  </span>
                )}
                {tournament.knockout_stage_reached && (
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">
                    🥇 {tournament.knockout_stage_reached}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Tournament Stats */}
          <div className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
              <MiniStatCard label="MP" value={tournament.matches_played} />
              <MiniStatCard label="W" value={tournament.wins} color="green" />
              <MiniStatCard label="D" value={tournament.draws} color="gray" />
              <MiniStatCard label="L" value={tournament.losses} color="red" />
              <MiniStatCard label="GF" value={tournament.goals_for} color="blue" />
              <MiniStatCard label="GA" value={tournament.goals_against} color="orange" />
              <MiniStatCard 
                label="GD" 
                value={tournament.goal_difference > 0 ? `+${tournament.goal_difference}` : tournament.goal_difference}
                color={tournament.goal_difference > 0 ? 'green' : tournament.goal_difference < 0 ? 'red' : 'gray'}
              />
              <MiniStatCard label="PTS" value={tournament.points} color="purple" />
              <MiniStatCard label="CS" value={tournament.clean_sheets} color="blue" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SeasonStatsView({ seasons }: { seasons: SeasonSummary[] }) {
  if (seasons.length === 0) {
    return (
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-8 text-center">
        <span className="text-6xl mb-4 block">📅</span>
        <h3 className="text-lg font-medium text-gray-600 mb-2">No Season Data</h3>
        <p className="text-sm text-gray-500">Season statistics will appear once you participate</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {seasons.map((season) => (
        <div 
          key={season.season_id}
          className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl overflow-hidden border border-gray-100"
        >
          {/* Season Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{season.season_name}</h3>
                <p className="text-sm text-gray-600">{season.tournaments_played} tournaments played</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                  {season.points} Points
                </span>
              </div>
            </div>
          </div>

          {/* Season Stats */}
          <div className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
              <MiniStatCard label="MP" value={season.matches_played} />
              <MiniStatCard label="W" value={season.wins} color="green" />
              <MiniStatCard label="D" value={season.draws} color="gray" />
              <MiniStatCard label="L" value={season.losses} color="red" />
              <MiniStatCard label="GF" value={season.goals_for} color="blue" />
              <MiniStatCard label="GA" value={season.goals_against} color="orange" />
              <MiniStatCard 
                label="GD" 
                value={season.goal_difference > 0 ? `+${season.goal_difference}` : season.goal_difference}
                color={season.goal_difference > 0 ? 'green' : season.goal_difference < 0 ? 'red' : 'gray'}
              />
              <MiniStatCard label="PTS" value={season.points} color="purple" />
              <MiniStatCard label="CS" value={season.clean_sheets} color="blue" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MetricCard({ icon, label, value, color }: { icon: string; label: string; value: string | number; color: string }) {
  const colorClasses = {
    blue: 'from-blue-50 to-blue-100 border-blue-200',
    green: 'from-green-50 to-green-100 border-green-200',
    purple: 'from-purple-50 to-purple-100 border-purple-200',
    indigo: 'from-indigo-50 to-indigo-100 border-indigo-200',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} border rounded-xl p-4 text-center`}>
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-600 font-medium">{label}</div>
    </div>
  );
}

function StatRow({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  const colorClasses = {
    green: 'text-green-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
    gray: 'text-gray-600',
  };

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      <span className={`text-lg font-bold ${colorClasses[color as keyof typeof colorClasses]}`}>
        {value}
      </span>
    </div>
  );
}

function MiniStatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  const colorClasses = {
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
    orange: 'bg-orange-50 text-orange-700',
    purple: 'bg-purple-50 text-purple-700',
    gray: 'bg-gray-50 text-gray-700',
  };

  const bgClass = color ? colorClasses[color as keyof typeof colorClasses] : 'bg-gray-50 text-gray-700';

  return (
    <div className={`${bgClass} rounded-lg p-3 text-center`}>
      <div className="text-xs font-medium opacity-75">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </div>
  );
}
