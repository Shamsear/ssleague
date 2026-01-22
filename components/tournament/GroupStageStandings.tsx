'use client';

import { useState } from 'react';

interface GroupTeam {
  team_id: string;
  team_name: string;
  team_logo?: string;
  group: string;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  position: number;
  qualifies: boolean;
}

interface GroupStageStandingsProps {
  groupStandings: Record<string, GroupTeam[]>;
  currentUserId?: string;
}

export default function GroupStageStandings({ groupStandings, currentUserId }: GroupStageStandingsProps) {
  const groups = Object.keys(groupStandings).sort();
  const [selectedGroup, setSelectedGroup] = useState<string>(groups[0] || 'A');

  if (groups.length === 0) {
    return (
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-8 text-center">
        <span className="text-6xl mb-4 block">🏆</span>
        <h3 className="text-lg font-medium text-gray-600 mb-2">No Group Stage Data Available</h3>
        <p className="text-sm text-gray-500">Group standings will appear once matches are completed</p>
      </div>
    );
  }

  const currentGroupStandings = groupStandings[selectedGroup] || [];

  return (
    <div className="space-y-6">
      {/* Group Tabs */}
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-4">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Group Stage</h2>
          <p className="text-sm text-gray-600">Select a group to view standings</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {groups.map((group) => (
            <button
              key={group}
              onClick={() => setSelectedGroup(group)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedGroup === group
                  ? 'bg-[#0066FF] text-white shadow-md scale-105'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Group {group}
            </button>
          ))}
        </div>
      </div>

      {/* Group Standings Table */}
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl overflow-hidden border border-gray-100/20">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏆</span>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Group {selectedGroup} Standings</h3>
              <p className="text-sm text-gray-600">{currentGroupStandings.length} teams</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pos
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Team
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  MP
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  W
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  D
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  L
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  GF
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  GA
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  GD
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  PTS
                </th>
              </tr>
            </thead>
            <tbody className="bg-white/60 divide-y divide-gray-200/50">
              {currentGroupStandings.map((team) => {
                const isCurrentUser = currentUserId && team.team_id === currentUserId;
                const qualifyColor = team.qualifies ? 'border-l-4 border-l-green-500 bg-green-50/30' : '';

                return (
                  <tr 
                    key={team.team_id} 
                    className={`hover:bg-blue-50/50 transition-colors ${qualifyColor} ${
                      isCurrentUser ? 'ring-2 ring-blue-400' : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${
                          team.position === 1 ? 'text-yellow-600' :
                          team.position === 2 ? 'text-gray-600' :
                          'text-gray-900'
                        }`}>
                          {team.position}
                        </span>
                        {team.qualifies && (
                          <span className="text-sm text-green-600" title="Qualifies for knockout stage">
                            ↑
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        {/* Team Logo */}
                        {team.team_logo ? (
                          <img 
                            src={team.team_logo} 
                            alt={`${team.team_name} logo`}
                            className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {team.team_name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        
                        <div>
                          <div className="text-sm font-bold text-gray-900">
                            {team.team_name}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {isCurrentUser && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                Your Team
                              </span>
                            )}
                            {team.qualifies && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                                Qualified
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                      {team.matches_played}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-green-600">
                      {team.wins}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                      {team.draws}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-red-600">
                      {team.losses}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                      {team.goals_for}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                      {team.goals_against}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`text-sm font-medium ${
                        team.goal_difference > 0 ? 'text-green-600' :
                        team.goal_difference < 0 ? 'text-red-600' :
                        'text-gray-600'
                      }`}>
                        {team.goal_difference > 0 ? '+' : ''}{team.goal_difference}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-800">
                        {team.points}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-600 flex items-center">
            <span className="text-green-600 mr-1 font-bold">↑</span>
            Teams in green qualify for the knockout stage
          </p>
        </div>
      </div>

      {/* All Groups Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map((group) => {
          const teams = groupStandings[group];
          const topTeam = teams[0];
          
          return (
            <div 
              key={group}
              className={`bg-white/90 backdrop-blur-md shadow-lg rounded-xl p-4 border-2 cursor-pointer transition-all ${
                selectedGroup === group 
                  ? 'border-[#0066FF] shadow-xl' 
                  : 'border-gray-100/20 hover:border-[#0066FF]/30'
              }`}
              onClick={() => setSelectedGroup(group)}
            >
              <h4 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <span className="text-2xl">🏆</span>
                Group {group}
              </h4>
              <div className="space-y-2">
                {teams.slice(0, 4).map((team, index) => (
                  <div 
                    key={team.team_id}
                    className={`flex items-center justify-between p-2 rounded-lg ${
                      team.qualifies ? 'bg-green-50' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-500 w-4">{index + 1}</span>
                      <span className="text-sm font-medium text-gray-900 truncate max-w-[120px]">
                        {team.team_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#0066FF]">{team.points}</span>
                      {team.qualifies && <span className="text-green-600 text-xs">✓</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📊</span>
          <div>
            <h3 className="text-sm font-semibold text-blue-800 mb-2">Group Stage Legend</h3>
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
    </div>
  );
}
