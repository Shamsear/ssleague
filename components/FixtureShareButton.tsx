'use client';

import { useState, useRef } from 'react';
import { toPng } from 'html-to-image';

interface Matchup {
  position: number;
  home_player_name: string;
  away_player_name: string;
  home_goals: number | null;
  away_goals: number | null;
}

interface Fixture {
  round_number: number;
  match_number: number;
  home_team_name: string;
  away_team_name: string;
  home_score?: number;
  away_score?: number;
  status: string;
  scheduled_date?: string;
}

interface Props {
  fixture: Fixture;
  matchups: Matchup[];
}

export default function FixtureShareButton({ fixture, matchups }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const generateImage = async () => {
    if (!cardRef.current) return;

    setIsGenerating(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      // Create download link
      const link = document.createElement('a');
      link.download = `fixture-R${fixture.round_number}M${fixture.match_number}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Error generating image:', error);
      alert('Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'TBD';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = () => {
    switch (fixture.status) {
      case 'completed':
        return <span className="text-green-600 font-bold">✓ COMPLETED</span>;
      case 'scheduled':
        return <span className="text-blue-600 font-bold">⏰ SCHEDULED</span>;
      case 'in_progress':
        return <span className="text-orange-600 font-bold">⚽ IN PROGRESS</span>;
      default:
        return <span className="text-gray-600 font-bold">📋 {fixture.status.toUpperCase()}</span>;
    }
  };

  return (
    <>
      <button
        onClick={generateImage}
        disabled={isGenerating}
        className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
            Share Fixture
          </>
        )}
      </button>

      {/* Hidden card for image generation */}
      <div className="fixed -left-[9999px] -top-[9999px]">
        <div
          ref={cardRef}
          className="w-[800px] bg-white p-8"
          style={{ fontFamily: 'Arial, sans-serif' }}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-6 rounded-2xl mb-4">
              <h1 className="text-3xl font-bold">SSPS LEAGUE</h1>
              <p className="text-lg mt-1">Round {fixture.round_number} • Match {fixture.match_number}</p>
            </div>
            <div className="flex justify-center">
              {getStatusBadge()}
            </div>
          </div>

          {/* Teams */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {/* Home Team */}
            <div className="text-center">
              <div className="bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl p-6 h-full flex flex-col justify-center">
                <p className="text-sm text-gray-600 mb-2">HOME</p>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{fixture.home_team_name}</h2>
                {fixture.status === 'completed' && fixture.home_score !== undefined && (
                  <div className="text-5xl font-bold text-blue-600">{fixture.home_score}</div>
                )}
              </div>
            </div>

            {/* VS */}
            <div className="flex items-center justify-center">
              <div className="text-4xl font-bold text-gray-400">VS</div>
            </div>

            {/* Away Team */}
            <div className="text-center">
              <div className="bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl p-6 h-full flex flex-col justify-center">
                <p className="text-sm text-gray-600 mb-2">AWAY</p>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{fixture.away_team_name}</h2>
                {fixture.status === 'completed' && fixture.away_score !== undefined && (
                  <div className="text-5xl font-bold text-purple-600">{fixture.away_score}</div>
                )}
              </div>
            </div>
          </div>

          {/* Date/Time */}
          {fixture.scheduled_date && (
            <div className="text-center mb-8">
              <div className="inline-block bg-gray-100 px-6 py-3 rounded-xl">
                <p className="text-sm text-gray-600">SCHEDULED</p>
                <p className="text-lg font-bold text-gray-900">{formatDate(fixture.scheduled_date)}</p>
              </div>
            </div>
          )}

          {/* Matchups */}
          {matchups.length > 0 && (
            <div className="border-t-2 border-gray-200 pt-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">MATCHUPS</h3>
              <div className="space-y-3">
                {matchups.map((matchup) => (
                  <div key={matchup.position} className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
                    <div className="flex-1 text-right pr-4">
                      <p className="font-semibold text-gray-900">{matchup.home_player_name}</p>
                    </div>
                    
                    <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-lg border-2 border-gray-200">
                      <span className="text-xl font-bold text-blue-600">
                        {matchup.home_goals ?? '-'}
                      </span>
                      <span className="text-gray-400 font-bold">:</span>
                      <span className="text-xl font-bold text-purple-600">
                        {matchup.away_goals ?? '-'}
                      </span>
                    </div>
                    
                    <div className="flex-1 text-left pl-4">
                      <p className="font-semibold text-gray-900">{matchup.away_player_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t-2 border-gray-200 text-center text-gray-500 text-sm">
            <p>Generated from SSPS League Management System</p>
          </div>
        </div>
      </div>
    </>
  );
}
