'use client';

import { useState } from 'react';

interface HallOfFameProps {
  hallOfFame: {
    topScorers: any[];
    topAssisters: any[];
    cleanSheetKings: any[];
    mostAppearances: any[];
    mostPoints: any[];
    bestWinRate: any[];
  };
}

export default function HallOfFameSelector({ hallOfFame }: HallOfFameProps) {
  const [selectedHallCategory, setSelectedHallCategory] = useState('topScorers');

  return (
    <div className="glass rounded-2xl p-6 sm:p-8 mb-8">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 flex items-center">
        🏛️ Hall of Fame
      </h2>
      
      {/* Category Selector */}
      <div className="flex flex-wrap gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { key: 'topScorers', label: '⚽ Top Scorers', icon: '⚽' },
          { key: 'cleanSheetKings', label: '🧤 Clean Sheets', icon: '🧤' },
          { key: 'mostAppearances', label: '👕 Most Matches', icon: '👕' },
          { key: 'mostPoints', label: '⭐ Most Points', icon: '⭐' },
          { key: 'bestWinRate', label: '🏆 Best Win Rate', icon: '🏆' },
        ].map((cat) => (
          <button
            key={cat.key}
            onClick={() => setSelectedHallCategory(cat.key)}
            className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
              selectedHallCategory === cat.key
                ? 'bg-blue-500 text-white shadow-md'
                : 'glass text-gray-700 hover:shadow-md'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Hall of Fame List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {hallOfFame[selectedHallCategory as keyof typeof hallOfFame]?.slice(0, 6).map((player: any, index: number) => (
          <div key={player.player_id} className="glass rounded-xl p-4 hover:shadow-lg transition-all">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                index === 0 ? 'bg-yellow-500' :
                index === 1 ? 'bg-gray-400' :
                index === 2 ? 'bg-amber-600' : 'bg-blue-500'
              }`}>
                {index + 1}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900">{player.player_name}</h3>
                <div className="text-2xl font-bold text-blue-600 mt-1">
                  {selectedHallCategory === 'topScorers' && `${player.total_goals} goals`}
                  {selectedHallCategory === 'cleanSheetKings' && `${player.total_clean_sheets} clean sheets`}
                  {selectedHallCategory === 'mostAppearances' && `${player.total_matches} matches`}
                  {selectedHallCategory === 'mostPoints' && `${parseFloat(player.total_points).toFixed(0)} points`}
                  {selectedHallCategory === 'bestWinRate' && `${player.win_rate}% win rate`}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {player.seasons_played} season{player.seasons_played > 1 ? 's' : ''}
                  {player.total_matches && ` • ${player.total_matches} matches`}
                  {player.goals_per_game && ` • ${player.goals_per_game} goals/game`}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
