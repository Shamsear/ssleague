'use client';

import { useState, useRef } from 'react';
import { toPng } from 'html-to-image';

interface Fixture {
  id: string;
  round_number: number;
  match_number: number;
  home_team_name: string;
  away_team_name: string;
  home_score?: number;
  away_score?: number;
  status: string;
  scheduled_date?: string;
  leg?: string;
}

interface Props {
  roundNumber: number;
  fixtures: Fixture[];
  tournamentName?: string;
}

export default function RoundFixturesShareButton({ roundNumber, fixtures, tournamentName = "SSPS League" }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const generateImage = async () => {
    if (!cardRef.current || fixtures.length === 0) return;

    setIsGenerating(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      // Create download link
      const link = document.createElement('a');
      link.download = `round-${roundNumber}-fixtures.png`;
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'in_progress':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'scheduled':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  if (fixtures.length === 0) {
    return null;
  }

  return (
    <>
      <button
        onClick={generateImage}
        disabled={isGenerating}
        className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {isGenerating ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            Generating...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share Round {roundNumber}
          </>
        )}
      </button>

      {/* Hidden card for image generation */}
      <div className="fixed -left-[9999px] -top-[9999px]">
        <div
          ref={cardRef}
          className="w-[900px] bg-white p-8"
          style={{ fontFamily: 'Arial, sans-serif' }}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-6 px-8 rounded-2xl mb-4 shadow-lg">
              <h1 className="text-4xl font-bold mb-2">{tournamentName}</h1>
              <div className="flex items-center justify-center gap-3">
                <div className="bg-white/20 backdrop-blur-sm px-6 py-2 rounded-full">
                  <p className="text-2xl font-bold">ROUND {roundNumber}</p>
                </div>
              </div>
            </div>
            <p className="text-gray-600 text-lg">{fixtures.length} Matches</p>
          </div>

          {/* Fixtures Grid */}
          <div className="space-y-4">
            {fixtures.map((fixture) => (
              <div 
                key={fixture.id} 
                className="bg-gradient-to-r from-gray-50 to-white rounded-2xl p-6 border-2 border-gray-200 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Match Number & Status */}
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                      Match {fixture.match_number}
                    </span>
                    {fixture.leg && (
                      <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-xs font-medium">
                        {fixture.leg === 'first' ? '1st Leg' : '2nd Leg'}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(fixture.status)}`}>
                      {fixture.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Teams & Score */}
                <div className="grid grid-cols-3 gap-4 items-center">
                  {/* Home Team */}
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-900">{fixture.home_team_name}</p>
                    <p className="text-sm text-gray-500">HOME</p>
                  </div>

                  {/* Score */}
                  <div className="flex items-center justify-center">
                    <div className="bg-white border-2 border-gray-300 rounded-xl px-6 py-3 shadow-inner">
                      {fixture.status === 'completed' && fixture.home_score !== undefined && fixture.away_score !== undefined ? (
                        <div className="flex items-center gap-3">
                          <span className="text-3xl font-bold text-blue-600">{fixture.home_score}</span>
                          <span className="text-2xl text-gray-400">:</span>
                          <span className="text-3xl font-bold text-purple-600">{fixture.away_score}</span>
                        </div>
                      ) : (
                        <div className="text-2xl font-bold text-gray-400">VS</div>
                      )}
                    </div>
                  </div>

                  {/* Away Team */}
                  <div className="text-left">
                    <p className="text-xl font-bold text-gray-900">{fixture.away_team_name}</p>
                    <p className="text-sm text-gray-500">AWAY</p>
                  </div>
                </div>

                {/* Date/Time */}
                {fixture.scheduled_date && (
                  <div className="mt-4 pt-4 border-t border-gray-200 text-center">
                    <p className="text-sm text-gray-500">Scheduled</p>
                    <p className="text-gray-900 font-medium">{formatDate(fixture.scheduled_date)}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t-2 border-gray-200 text-center">
            <p className="text-gray-500 text-sm mb-2">Generated from SSPS League Management System</p>
            <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              <span>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
