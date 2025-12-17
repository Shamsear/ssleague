'use client';

import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';

interface FantasyTeam {
  rank: number;
  team_name: string;
  total_points: number;
  player_count: number;
  last_round_points?: number;
  team_logo?: string;
}

interface ShareableFantasyLeaderboardProps {
  teams: FantasyTeam[];
  leagueName: string;
}

export default function ShareableFantasyLeaderboard({ 
  teams, 
  leagueName
}: ShareableFantasyLeaderboardProps) {
  const leaderboardRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const generateImage = async () => {
    if (!leaderboardRef.current) return;

    try {
      setIsGenerating(true);
      
      const dataUrl = await toPng(leaderboardRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      const link = document.createElement('a');
      link.download = `${leagueName.replace(/\s+/g, '-')}-fantasy-leaderboard.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Error generating image:', error);
      alert('Failed to generate image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const shareImage = async () => {
    if (!leaderboardRef.current) return;

    try {
      setIsGenerating(true);
      
      const dataUrl = await toPng(leaderboardRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `${leagueName}-fantasy-leaderboard.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `${leagueName} - Fantasy Leaderboard`,
          text: `Check out the current fantasy standings!`,
          files: [file],
        });
      } else {
        generateImage();
      }
    } catch (error) {
      console.error('Error sharing image:', error);
      generateImage();
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors shadow-md"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          {showPreview ? 'Hide Preview' : 'Preview Image'}
        </button>

        <button
          onClick={generateImage}
          disabled={isGenerating}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Generating...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Image
            </>
          )}
        </button>

        <button
          onClick={shareImage}
          disabled={isGenerating}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Generating...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share Image
            </>
          )}
        </button>
      </div>

      {/* Preview/Hidden Leaderboard for Image Generation */}
      <div style={{ 
        position: showPreview ? 'relative' : 'fixed', 
        left: showPreview ? '0' : '-9999px', 
        top: '0',
        width: showPreview ? '100%' : '1200px',
        overflow: showPreview ? 'auto' : 'hidden'
      }}>
        <div 
          ref={leaderboardRef}
          className="bg-white"
          style={{ width: '1200px' }}
        >
          {/* Header with Gradient Background */}
          <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-center py-8 px-6">
            <h1 className="text-5xl font-black text-white uppercase tracking-wider mb-2" style={{ fontFamily: 'Arial Black, sans-serif' }}>
              {leagueName}
            </h1>
            <p className="text-2xl text-yellow-300 font-bold uppercase tracking-wide">
              ⚡ FANTASY LEAGUE ⚡
            </p>
          </div>

          {/* Leaderboard Title */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-6 py-4 text-center">
            <h2 className="text-3xl font-bold uppercase tracking-wide">🏆 STANDINGS 🏆</h2>
          </div>

          {/* Table */}
          <div className="px-6 pb-6 pt-4">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-purple-100 to-indigo-100 text-gray-800 text-sm font-bold uppercase">
                  <th className="py-4 px-3 text-center border-2 border-purple-300">Rank</th>
                  <th className="py-4 px-6 text-left border-2 border-purple-300">Team Name</th>
                  <th className="py-4 px-4 text-center border-2 border-purple-300">Players</th>
                  <th className="py-4 px-4 text-center border-2 border-purple-300">Last Round</th>
                  <th className="py-4 px-4 text-center border-2 border-purple-300">Total Points</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team, index) => {
                  const isTop3 = index < 3;
                  const bgColor = 
                    index === 0 ? 'bg-gradient-to-r from-yellow-100 to-yellow-200' :
                    index === 1 ? 'bg-gradient-to-r from-gray-100 to-gray-200' :
                    index === 2 ? 'bg-gradient-to-r from-orange-100 to-orange-200' :
                    index % 2 === 0 ? 'bg-purple-50' : 'bg-white';
                  
                  return (
                    <tr key={index} className={bgColor}>
                      {/* Rank */}
                      <td className="py-4 px-3 text-center border-2 border-purple-200">
                        <div className="flex items-center justify-center">
                          {index === 0 && (
                            <span className="text-4xl">🥇</span>
                          )}
                          {index === 1 && (
                            <span className="text-4xl">🥈</span>
                          )}
                          {index === 2 && (
                            <span className="text-4xl">🥉</span>
                          )}
                          {index > 2 && (
                            <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold px-4 py-2 rounded-lg text-lg">
                              {index + 1}
                            </span>
                          )}
                        </div>
                      </td>
                      
                      {/* Team Name */}
                      <td className="py-4 px-6 border-2 border-purple-200">
                        <div className="flex items-center gap-3">
                          {team.team_logo ? (
                            <img 
                              src={team.team_logo} 
                              alt={`${team.team_name} logo`}
                              className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                              crossOrigin="anonymous"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                              {team.team_name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className={`font-bold uppercase text-lg ${isTop3 ? 'text-gray-900' : 'text-gray-800'}`}>
                            {team.team_name}
                          </span>
                        </div>
                      </td>
                      
                      {/* Players */}
                      <td className="py-4 px-4 text-center border-2 border-purple-200">
                        <span className="inline-block bg-blue-500 text-white font-bold px-4 py-2 rounded-lg text-base">
                          {team.player_count}
                        </span>
                      </td>
                      
                      {/* Last Round */}
                      <td className="py-4 px-4 text-center border-2 border-purple-200">
                        <span className={`font-bold text-lg ${
                          (team.last_round_points || 0) > 0 ? 'text-green-600' : 
                          (team.last_round_points || 0) < 0 ? 'text-red-600' : 
                          'text-gray-600'
                        }`}>
                          {team.last_round_points !== undefined && team.last_round_points !== 0
                            ? `${team.last_round_points > 0 ? '+' : ''}${team.last_round_points}`
                            : '-'}
                        </span>
                      </td>
                      
                      {/* Total Points */}
                      <td className="py-4 px-4 text-center border-2 border-purple-200 bg-gradient-to-r from-indigo-100 to-purple-100">
                        <span className="font-black text-2xl text-indigo-700">
                          {team.total_points}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white px-6 py-4 text-center">
            <p className="text-lg font-bold uppercase tracking-wide">
              🎮 {teams.length} Teams Competing • Fantasy League
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
