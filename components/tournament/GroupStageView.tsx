'use client';

import { useState, useEffect } from 'react';
import { GroupFixture, GroupStanding } from '@/lib/firebase/groupStage';

interface GroupStageViewProps {
  seasonId: string;
  tournamentId: string;
}

export default function GroupStageView({ seasonId, tournamentId }: GroupStageViewProps) {
  const [groupFixtures, setGroupFixtures] = useState<Record<string, GroupFixture[]>>({});
  const [groupStandings, setGroupStandings] = useState<Record<string, GroupStanding[]>>({});
  const [selectedGroup, setSelectedGroup] = useState<string>('A');
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState<'fixtures' | 'standings'>('standings');

  useEffect(() => {
    loadGroupData();
  }, [seasonId, tournamentId]);

  const loadGroupData = async () => {
    try {
      setIsLoading(true);

      // Load fixtures
      const fixturesRes = await fetch(`/api/groups/fixtures?season_id=${seasonId}&tournament_id=${tournamentId}`);
      const fixturesData = await fixturesRes.json();
      
      if (fixturesData.success) {
        setGroupFixtures(fixturesData.fixtures);
        // Set first group as selected
        const groups = Object.keys(fixturesData.fixtures);
        if (groups.length > 0) {
          setSelectedGroup(groups[0]);
        }
      }

      // Load standings
      const standingsRes = await fetch(`/api/groups/standings?season_id=${seasonId}&tournament_id=${tournamentId}`);
      const standingsData = await standingsRes.json();
      
      if (standingsData.success) {
        setGroupStandings(standingsData.standings);
      }
    } catch (error) {
      console.error('Error loading group data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const groups = Object.keys(groupFixtures).sort();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF]"></div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-8 text-center">
        <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <h3 className="text-lg font-medium text-gray-700 mb-2">No Group Fixtures</h3>
        <p className="text-sm text-gray-500">Generate group stage fixtures to see groups here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Group Tabs */}
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Group Stage</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveView('standings')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeView === 'standings'
                  ? 'bg-[#0066FF] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Standings
            </button>
            <button
              onClick={() => setActiveView('fixtures')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeView === 'fixtures'
                  ? 'bg-[#0066FF] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Fixtures
            </button>
          </div>
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

      {/* Content */}
      {activeView === 'standings' && groupStandings[selectedGroup] && (
        <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-[#0066FF]/10 to-purple-500/10">
            <h3 className="text-lg font-bold text-gray-900">Group {selectedGroup} Standings</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pos</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">MP</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">W</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">D</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">L</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">GF</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">GA</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">GD</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Pts</th>
                </tr>
              </thead>
              <tbody className="bg-white/60 divide-y divide-gray-200/50">
                {groupStandings[selectedGroup].map((team) => (
                  <tr 
                    key={team.team_id} 
                    className={`hover:bg-gray-50/80 transition-colors ${
                      team.position <= 2 ? 'bg-green-50/30' : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className={`text-sm font-bold ${
                          team.position === 1 ? 'text-yellow-600' :
                          team.position === 2 ? 'text-gray-500' :
                          'text-gray-900'
                        }`}>
                          {team.position}
                        </span>
                        {team.position <= 2 && (
                          <span className="ml-2 text-xs text-green-600">↑</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {team.team_name}
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
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-gray-900">
                      {team.goal_difference > 0 ? '+' : ''}{team.goal_difference}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-[#0066FF]">
                      {team.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
            <p className="text-xs text-gray-500 flex items-center">
              <span className="text-green-600 mr-1">↑</span>
              Teams in qualification positions advance to knockout stage
            </p>
          </div>
        </div>
      )}

      {activeView === 'fixtures' && groupFixtures[selectedGroup] && (
        <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Group {selectedGroup} Fixtures</h3>
          <div className="space-y-4">
            {groupFixtures[selectedGroup].map((fixture) => (
              <div key={fixture.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-[#0066FF]/30 transition-colors">
                <div className="flex-1 text-right">
                  <span className={`font-medium ${
                    fixture.status === 'completed' && fixture.result === 'home_win' ? 'text-green-600' : 'text-gray-900'
                  }`}>
                    {fixture.home_team_name}
                  </span>
                </div>
                <div className="flex items-center gap-4 px-6">
                  {fixture.status === 'completed' ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-gray-900">{fixture.home_score}</span>
                      <span className="text-gray-400">-</span>
                      <span className="text-xl font-bold text-gray-900">{fixture.away_score}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">vs</span>
                  )}
                </div>
                <div className="flex-1 text-left">
                  <span className={`font-medium ${
                    fixture.status === 'completed' && fixture.result === 'away_win' ? 'text-green-600' : 'text-gray-900'
                  }`}>
                    {fixture.away_team_name}
                  </span>
                </div>
                <div className="ml-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    fixture.status === 'completed' ? 'bg-green-100 text-green-700' :
                    fixture.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {fixture.status === 'completed' ? 'Completed' :
                     fixture.status === 'in_progress' ? 'Live' : 'Scheduled'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
