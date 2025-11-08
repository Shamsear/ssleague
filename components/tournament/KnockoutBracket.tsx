'use client';

interface KnockoutMatch {
  id: string;
  round: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  result: string | null;
}

interface KnockoutBracketProps {
  knockoutFixtures: Record<string, KnockoutMatch[]>;
}

const ROUND_ORDER = ['Final', 'Semi-Final', 'Quarter-Final', 'Round of 16', 'Round of 32'];

export default function KnockoutBracket({ knockoutFixtures }: KnockoutBracketProps) {
  if (!knockoutFixtures || Object.keys(knockoutFixtures).length === 0) {
    return (
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-8 text-center">
        <span className="text-6xl mb-4 block">🥇</span>
        <h3 className="text-lg font-medium text-gray-600 mb-2">No Knockout Stage Data</h3>
        <p className="text-sm text-gray-500">Knockout bracket will appear once set up</p>
      </div>
    );
  }

  // Sort rounds in proper order
  const sortedRounds = Object.keys(knockoutFixtures).sort((a, b) => {
    const indexA = ROUND_ORDER.indexOf(a);
    const indexB = ROUND_ORDER.indexOf(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">🥇</span>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Knockout Stage</h2>
            <p className="text-sm text-gray-600">Single-elimination playoff bracket</p>
          </div>
        </div>

        {/* Rounds */}
        <div className="space-y-8">
          {sortedRounds.map((round) => {
            const matches = knockoutFixtures[round];
            
            return (
              <div key={round} className="space-y-4">
                {/* Round Header */}
                <div className="flex items-center gap-3">
                  <div className="h-1 flex-1 bg-gradient-to-r from-transparent via-[#0066FF]/30 to-[#0066FF]/30 rounded-full"></div>
                  <h3 className="text-lg font-bold text-gray-900 px-4 py-2 bg-[#0066FF]/10 rounded-lg">
                    {round}
                  </h3>
                  <div className="h-1 flex-1 bg-gradient-to-r from-[#0066FF]/30 via-[#0066FF]/30 to-transparent rounded-full"></div>
                </div>

                {/* Matches */}
                <div className={`grid gap-4 ${
                  matches.length === 1 ? 'grid-cols-1 max-w-2xl mx-auto' :
                  matches.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
                  matches.length === 4 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' :
                  'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                }`}>
                  {matches.map((match, index) => {
                    const isCompleted = match.status === 'completed';
                    const homeWon = match.result === 'home_win';
                    const awayWon = match.result === 'away_win';
                    const isPending = match.status === 'pending' || match.home_team?.includes('Winner') || match.home_team?.includes('TBD');

                    return (
                      <div 
                        key={match.id}
                        className={`bg-white border-2 rounded-xl overflow-hidden shadow-md transition-all hover:shadow-lg ${
                          isCompleted ? 'border-green-200' :
                          isPending ? 'border-gray-200' :
                          'border-blue-200'
                        }`}
                      >
                        {/* Match Number */}
                        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                          <p className="text-xs font-semibold text-gray-600 uppercase">
                            Match {index + 1}
                          </p>
                        </div>

                        {/* Teams */}
                        <div className="p-4 space-y-2">
                          {/* Home Team */}
                          <div className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                            homeWon ? 'bg-green-50 border-2 border-green-300' :
                            isCompleted ? 'bg-gray-50' :
                            'bg-blue-50/30'
                          }`}>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {homeWon && <span className="text-lg">🏆</span>}
                              <span className={`font-medium truncate ${
                                isPending ? 'text-gray-400 italic' : 'text-gray-900'
                              }`}>
                                {match.home_team}
                              </span>
                            </div>
                            {isCompleted && (
                              <span className={`text-xl font-bold ml-2 ${
                                homeWon ? 'text-green-600' : 'text-gray-600'
                              }`}>
                                {match.home_score}
                              </span>
                            )}
                          </div>

                          {/* VS or Score separator */}
                          <div className="flex items-center justify-center">
                            <span className="text-xs font-semibold text-gray-400">VS</span>
                          </div>

                          {/* Away Team */}
                          <div className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                            awayWon ? 'bg-green-50 border-2 border-green-300' :
                            isCompleted ? 'bg-gray-50' :
                            'bg-blue-50/30'
                          }`}>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {awayWon && <span className="text-lg">🏆</span>}
                              <span className={`font-medium truncate ${
                                isPending ? 'text-gray-400 italic' : 'text-gray-900'
                              }`}>
                                {match.away_team}
                              </span>
                            </div>
                            {isCompleted && (
                              <span className={`text-xl font-bold ml-2 ${
                                awayWon ? 'text-green-600' : 'text-gray-600'
                              }`}>
                                {match.away_score}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="px-4 pb-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium w-full justify-center ${
                            isCompleted ? 'bg-green-100 text-green-700' :
                            isPending ? 'bg-gray-100 text-gray-600' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {isCompleted ? '✓ Completed' :
                             isPending ? '⏳ To Be Determined' :
                             '📅 Scheduled'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">ℹ️</span>
          <div>
            <h3 className="text-sm font-semibold text-purple-800 mb-2">Knockout Stage Info</h3>
            <ul className="text-xs text-purple-700 space-y-1">
              <li>• Single-elimination format - lose and you're out</li>
              <li>• Winners advance to the next round</li>
              <li>• Matches marked "TBD" will be determined by earlier round results</li>
              <li>• 🏆 indicates the winner of a completed match</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
