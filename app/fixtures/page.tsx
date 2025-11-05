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
}

export default function PublicFixturesPage() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [seasonName, setSeasonName] = useState('');
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'live'>('upcoming');

  useEffect(() => {
    fetchFixtures();
  }, []);

  const fetchFixtures = async () => {
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
      
      // Sort by round number and match number
      fixturesList.sort((a: Fixture, b: Fixture) => {
        if (a.round_number !== b.round_number) {
          return a.round_number - b.round_number;
        }
        return a.match_number - b.match_number;
      });

      setFixtures(fixturesList);
    } catch (error) {
      console.error('Error fetching fixtures:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getFilteredFixtures = () => {
    if (filter === 'upcoming') {
      return fixtures.filter(f => f.status === 'scheduled' || f.status === 'pending');
    } else if (filter === 'live') {
      return fixtures.filter(f => f.status === 'in_progress' || f.status === 'live');
    }
    return fixtures;
  };

  const filteredFixtures = getFilteredFixtures();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Completed</span>;
      case 'in_progress':
      case 'live':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 animate-pulse">Live</span>;
      case 'scheduled':
      case 'pending':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Upcoming</span>;
      default:
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading fixtures...</p>
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
                  Match Fixtures
                </h1>
                <p className="text-gray-600">
                  {seasonName} - {filteredFixtures.length} {filter === 'all' ? 'Total' : filter === 'upcoming' ? 'Upcoming' : 'Live'} Matches
                </p>
              </div>
              <div className="mt-4 md:mt-0 flex gap-2">
                <button
                  onClick={() => setFilter('upcoming')}
                  className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
                    filter === 'upcoming'
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-white/70 text-gray-700 hover:bg-white'
                  }`}
                >
                  Upcoming
                </button>
                <button
                  onClick={() => setFilter('live')}
                  className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
                    filter === 'live'
                      ? 'bg-red-600 text-white shadow-lg'
                      : 'bg-white/70 text-gray-700 hover:bg-white'
                  }`}
                >
                  Live
                </button>
                <button
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
                    filter === 'all'
                      ? 'bg-gray-800 text-white shadow-lg'
                      : 'bg-white/70 text-gray-700 hover:bg-white'
                  }`}
                >
                  All
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Fixtures List */}
        {filteredFixtures.length === 0 ? (
          <div className="glass rounded-3xl p-12 text-center shadow-xl backdrop-blur-md border border-white/20">
            <div className="text-6xl mb-4">📅</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Fixtures Found</h3>
            <p className="text-gray-600">
              {filter === 'upcoming' ? 'No upcoming matches at the moment.' : 
               filter === 'live' ? 'No live matches right now.' : 
               'No fixtures available for this season.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Group by round */}
            {Object.entries(
              filteredFixtures.reduce((acc, fixture) => {
                const roundKey = `Round ${fixture.round_number} - ${fixture.leg === 'first' ? '1st' : '2nd'} Leg`;
                if (!acc[roundKey]) {
                  acc[roundKey] = [];
                }
                acc[roundKey].push(fixture);
                return acc;
              }, {} as Record<string, Fixture[]>)
            ).map(([roundName, roundFixtures]) => (
              <div key={roundName} className="glass rounded-3xl p-6 shadow-xl backdrop-blur-md border border-white/20">
                <h2 className="text-xl font-bold text-gray-900 mb-4">{roundName}</h2>
                <div className="space-y-3">
                  {roundFixtures.map((fixture) => (
                    <Link
                      key={fixture.id}
                      href={`/fixtures/${fixture.id}`}
                      className="block group"
                    >
                      <div className="bg-white/60 rounded-2xl p-4 hover:bg-white hover:shadow-lg transition-all duration-300 border border-white/40">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-4">
                              <div className="flex-1 text-right">
                                <p className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                                  {fixture.home_team_name}
                                </p>
                                {fixture.status === 'completed' && (
                                  <p className="text-2xl font-bold text-gray-900">{fixture.home_score ?? 0}</p>
                                )}
                              </div>
                              
                              <div className="px-4 py-2 bg-gray-100 rounded-xl">
                                <span className="text-sm font-semibold text-gray-600">VS</span>
                              </div>
                              
                              <div className="flex-1">
                                <p className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                                  {fixture.away_team_name}
                                </p>
                                {fixture.status === 'completed' && (
                                  <p className="text-2xl font-bold text-gray-900">{fixture.away_score ?? 0}</p>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="ml-4 flex flex-col items-end gap-2">
                            {getStatusBadge(fixture.status)}
                            {fixture.scheduled_date && (
                              <span className="text-xs text-gray-500">
                                {new Date(fixture.scheduled_date).toLocaleDateString()}
                              </span>
                            )}
                            <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
