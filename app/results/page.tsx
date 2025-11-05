'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

interface Fixture {
  id: string;
  round_number: number;
  match_number: number;
  home_team_id: string;
  home_team_name: string;
  away_team_id: string;
  away_team_name: string;
  home_score?: number;
  away_score?: number;
  status: string;
  scheduled_date?: string;
  leg: string;
  season_id: string;
  tournament_id: string;
  motm_player_name?: string;
}

export default function PublicResultsPage() {
  const [results, setResults] = useState<Fixture[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [seasonName, setSeasonName] = useState('');

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    try {
      setIsLoading(true);

      // Get active season
      const seasonsRef = collection(db, 'seasons');
      const seasonsQuery = query(
        seasonsRef,
        where('isActive', '==', true),
        orderBy('created_at', 'desc'),
        limit(1)
      );
      const seasonsSnapshot = await getDocs(seasonsQuery);

      if (seasonsSnapshot.empty) {
        console.log('No active season found');
        setIsLoading(false);
        return;
      }

      const seasonDoc = seasonsSnapshot.docs[0];
      const seasonData = seasonDoc.data();
      const seasonId = seasonDoc.id;
      setSeasonName(seasonData.name || seasonData.short_name || 'Current Season');

      // Fetch fixtures from Neon API
      const response = await fetch(`/api/fixtures/season?season_id=${seasonId}`);
      if (!response.ok) {
        console.error('Failed to fetch fixtures');
        setIsLoading(false);
        return;
      }

      const { fixtures: fixturesList } = await response.json();
      
      // Filter only completed matches
      const completedMatches = fixturesList.filter((f: Fixture) => f.status === 'completed');
      
      // Sort by round number (descending) to show latest results first
      completedMatches.sort((a: Fixture, b: Fixture) => {
        if (b.round_number !== a.round_number) {
          return b.round_number - a.round_number;
        }
        return b.match_number - a.match_number;
      });

      setResults(completedMatches);
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getWinner = (fixture: Fixture) => {
    const homeScore = fixture.home_score ?? 0;
    const awayScore = fixture.away_score ?? 0;
    
    if (homeScore > awayScore) return 'home';
    if (awayScore > homeScore) return 'away';
    return 'draw';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading results...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 rounded-2xl text-gray-700 glass backdrop-blur-md border border-white/20 hover:shadow-lg transition-all duration-300 mb-4"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>

          <div className="glass rounded-3xl p-8 shadow-xl backdrop-blur-md border border-white/20">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-[#0066FF] via-blue-500 to-[#0066FF] bg-clip-text text-transparent mb-2">
                  Match Results
                </h1>
                <p className="text-gray-600">
                  {seasonName} - {results.length} Completed Matches
                </p>
              </div>
              <Link
                href="/fixtures"
                className="mt-4 md:mt-0 inline-flex items-center px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors shadow-lg"
              >
                View Fixtures
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>

        {/* Results List */}
        {results.length === 0 ? (
          <div className="glass rounded-3xl p-12 text-center shadow-xl backdrop-blur-md border border-white/20">
            <div className="text-6xl mb-4">🏆</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Results Yet</h3>
            <p className="text-gray-600">
              No matches have been completed in this season.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Group by round */}
            {Object.entries(
              results.reduce((acc, fixture) => {
                const roundKey = `Round ${fixture.round_number} - ${fixture.leg === 'first' ? '1st' : '2nd'} Leg`;
                if (!acc[roundKey]) {
                  acc[roundKey] = [];
                }
                acc[roundKey].push(fixture);
                return acc;
              }, {} as Record<string, Fixture[]>)
            ).map(([roundName, roundResults]) => (
              <div key={roundName} className="glass rounded-3xl p-6 shadow-xl backdrop-blur-md border border-white/20">
                <h2 className="text-xl font-bold text-gray-900 mb-4">{roundName}</h2>
                <div className="space-y-3">
                  {roundResults.map((fixture) => {
                    const winner = getWinner(fixture);
                    
                    return (
                      <Link
                        key={fixture.id}
                        href={`/fixtures/${fixture.id}`}
                        className="block group"
                      >
                        <div className="bg-white/60 rounded-2xl p-5 hover:bg-white hover:shadow-lg transition-all duration-300 border border-white/40">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex-1">
                              <div className="grid grid-cols-3 gap-4 items-center">
                                {/* Home Team */}
                                <div className={`text-right ${winner === 'home' ? 'scale-105' : ''} transition-transform`}>
                                  <p className={`font-bold ${winner === 'home' ? 'text-green-600' : 'text-gray-900'} group-hover:text-blue-600 transition-colors`}>
                                    {fixture.home_team_name}
                                  </p>
                                  <p className={`text-3xl font-bold ${winner === 'home' ? 'text-green-600' : 'text-gray-900'}`}>
                                    {fixture.home_score ?? 0}
                                  </p>
                                </div>
                                
                                {/* VS / Winner Badge */}
                                <div className="text-center">
                                  {winner === 'draw' ? (
                                    <span className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-xl font-bold text-sm">
                                      DRAW
                                    </span>
                                  ) : (
                                    <div className="flex flex-col items-center">
                                      <span className="text-sm font-semibold text-gray-500 mb-1">FINAL</span>
                                      {winner !== 'draw' && (
                                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">
                                          {winner === 'home' ? '🏆 HOME' : '🏆 AWAY'}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                
                                {/* Away Team */}
                                <div className={`text-left ${winner === 'away' ? 'scale-105' : ''} transition-transform`}>
                                  <p className={`font-bold ${winner === 'away' ? 'text-green-600' : 'text-gray-900'} group-hover:text-blue-600 transition-colors`}>
                                    {fixture.away_team_name}
                                  </p>
                                  <p className={`text-3xl font-bold ${winner === 'away' ? 'text-green-600' : 'text-gray-900'}`}>
                                    {fixture.away_score ?? 0}
                                  </p>
                                </div>
                              </div>
                            </div>
                            
                            <svg className="w-5 h-5 ml-4 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                          
                          {/* MOTM */}
                          {fixture.motm_player_name && (
                            <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-center gap-2">
                              <span className="text-yellow-500 text-lg">⭐</span>
                              <span className="text-sm font-semibold text-gray-700">
                                Man of the Match: {fixture.motm_player_name}
                              </span>
                            </div>
                          )}
                          
                          {/* Date */}
                          {fixture.scheduled_date && (
                            <div className="mt-2 text-center">
                              <span className="text-xs text-gray-500">
                                {new Date(fixture.scheduled_date).toLocaleDateString('en-US', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </span>
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
