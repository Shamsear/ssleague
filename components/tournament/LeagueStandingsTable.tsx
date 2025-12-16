'use client';

interface TeamStats {
  team_id: string;
  team_name: string;
  team_logo?: string;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
}

interface LeagueStandingsTableProps {
  standings: TeamStats[];
  currentUserId?: string;
  showPlayoffIndicator?: boolean;
  playoffSpots?: number;
}

export default function LeagueStandingsTable({ 
  standings, 
  currentUserId,
  showPlayoffIndicator = false,
  playoffSpots = 4
}: LeagueStandingsTableProps) {
  if (standings.length === 0) {
    return (
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-8 text-center">
        <span className="text-6xl mb-4 block">⚽</span>
        <h3 className="text-lg font-medium text-gray-600 mb-2">No Team Statistics Available</h3>
        <p className="text-sm text-gray-500">Team standings will appear once matches are completed</p>
      </div>
    );
  }

  const topTeam = standings[0];

  return (
    <div className="space-y-6">
      {/* League Table */}
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl overflow-hidden border border-gray-100/20">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚽</span>
            <div>
              <h3 className="text-xl font-bold text-gray-900">League Table</h3>
              <p className="text-sm text-gray-600">{standings.length} teams competing</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Team
                </th>
                <th className="hidden md:table-cell px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  MP
                </th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  W
                </th>
                <th className="hidden sm:table-cell px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  D
                </th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  L
                </th>
                <th className="hidden lg:table-cell px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  GF
                </th>
                <th className="hidden lg:table-cell px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  GA
                </th>
                <th className="hidden md:table-cell px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  GD
                </th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  PTS
                </th>
              </tr>
            </thead>
            <tbody className="bg-white/60 divide-y divide-gray-200/50">
              {standings.map((team, index) => {
                const isPlayoffSpot = showPlayoffIndicator && index < playoffSpots;
                const isCurrentUser = currentUserId && team.team_id === currentUserId;

                return (
                  <tr 
                    key={team.team_id} 
                    className={`hover:bg-blue-50/50 transition-colors ${
                      index < 3 ? 'bg-green-50/30' : ''
                    } ${
                      isPlayoffSpot ? 'border-l-4 border-l-blue-500' : ''
                    } ${
                      isCurrentUser ? 'ring-2 ring-blue-400' : ''
                    }`}
                  >
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                      {index === 0 && <span className="text-xl sm:text-2xl">🥇</span>}
                      {index === 1 && <span className="text-xl sm:text-2xl">🥈</span>}
                      {index === 2 && <span className="text-xl sm:text-2xl">🥉</span>}
                      {index > 2 && <span className="text-xs sm:text-sm">{`#${index + 1}`}</span>}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="flex items-center gap-2 sm:gap-3">
                        {/* Team Logo */}
                        {team.team_logo ? (
                          <img 
                            src={team.team_logo} 
                            alt={`${team.team_name} logo`}
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-gray-200 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-xs sm:text-sm flex-shrink-0">
                            {team.team_name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                            {team.team_name}
                          </div>
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {isCurrentUser && (
                              <span className="text-[10px] sm:text-xs bg-blue-100 text-blue-700 px-1.5 sm:px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                                You
                              </span>
                            )}
                            {isPlayoffSpot && (
                              <span className="text-[10px] sm:text-xs bg-green-50 text-green-600 px-1.5 sm:px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                                🎯 Playoff
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center text-sm text-gray-600">
                      {team.matches_played}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center text-xs sm:text-sm font-semibold text-green-600">
                      {team.wins}
                    </td>
                    <td className="hidden sm:table-cell px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center text-xs sm:text-sm text-gray-600">
                      {team.draws}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center text-xs sm:text-sm font-semibold text-red-600">
                      {team.losses}
                    </td>
                    <td className="hidden lg:table-cell px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center text-sm text-gray-600">
                      {team.goals_for}
                    </td>
                    <td className="hidden lg:table-cell px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center text-sm text-gray-600">
                      {team.goals_against}
                    </td>
                    <td className="hidden md:table-cell px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center">
                      <span className={`text-xs sm:text-sm font-medium ${
                        team.goal_difference > 0 ? 'text-green-600' :
                        team.goal_difference < 0 ? 'text-red-600' :
                        'text-gray-600'
                      }`}>
                        {team.goal_difference > 0 ? '+' : ''}{team.goal_difference}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-blue-100 text-blue-800">
                        {team.points}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📊</span>
          <div>
            <h3 className="text-sm font-semibold text-blue-800 mb-2">League Table Legend</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs text-blue-700">
              <div><strong>MP:</strong> Matches Played</div>
              <div><strong>W:</strong> Wins</div>
              <div><strong>D:</strong> Draws</div>
              <div><strong>L:</strong> Losses</div>
              <div><strong>GF:</strong> Goals For</div>
              <div><strong>GA:</strong> Goals Against</div>
              <div><strong>GD:</strong> Goal Difference</div>
              <div><strong>PTS:</strong> Points (3 for win, 1 for draw)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Current Leader */}
      {topTeam && topTeam.matches_played > 0 && (
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🏆</span>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Current Leader</h3>
              <p className="text-2xl font-extrabold text-yellow-600 mt-1">{topTeam.team_name}</p>
              <p className="text-sm text-gray-600 mt-1">
                {topTeam.points} points • {topTeam.wins} wins • GD: {topTeam.goal_difference > 0 ? '+' : ''}{topTeam.goal_difference}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
