'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

interface TeamProfile {
  id: string;
  name: string;
  logoUrl?: string;
  budget: number;
  totalSpent: number;
  playersCount: number;
  positionCounts: { [key: string]: number };
  averageRating: number;
  // Contract info
  contractId?: string;
  contractStartSeason?: string;
  contractEndSeason?: string;
  isAutoRegistered?: boolean;
  skippedSeasons?: number;
  penaltyAmount?: number;
}

interface PlayerData {
  id: string;
  name: string;
  position: string;
  rating: number;
  purchasePrice: number;
  imageUrl?: string;
}

interface FixtureData {
  id: string;
  roundNumber: number;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  homeScore?: number;
  awayScore?: number;
  status: string;
  scheduledDate?: string;
}

interface StandingsData {
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export default function TeamSquadPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const unwrappedParams = use(params);
  const teamId = unwrappedParams.teamId;
  const [teamProfile, setTeamProfile] = useState<TeamProfile | null>(null);
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [fixtures, setFixtures] = useState<FixtureData[]>([]);
  const [standings, setStandings] = useState<StandingsData | null>(null);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [seasonName, setSeasonName] = useState('');
  const [activeTab, setActiveTab] = useState<'squad' | 'fixtures' | 'stats'>('squad');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Get active season
  useEffect(() => {
    const fetchActiveSeason = async () => {
      if (!user || user.role !== 'team') return;

      try {
        const seasonsQuery = query(collection(db, 'seasons'));
        const seasonsSnapshot = await getDocs(seasonsQuery);
        
        let targetSeasonId = null;
        let targetSeasonName = '';
        
        // Find first non-completed season
        for (const docSnap of seasonsSnapshot.docs) {
          const data = docSnap.data();
          if (data.status !== 'completed') {
            targetSeasonId = docSnap.id;
            targetSeasonName = data.name || `Season ${data.season_number || 'Unknown'}`;
            break;
          }
        }

        if (!targetSeasonId && seasonsSnapshot.size > 0) {
          const firstDoc = seasonsSnapshot.docs[0];
          targetSeasonId = firstDoc.id;
          targetSeasonName = firstDoc.data().name || 'Season';
        }

        if (!targetSeasonId) {
          setError('No active season found');
          setIsLoading(false);
          return;
        }

        setSeasonId(targetSeasonId);
        setSeasonName(targetSeasonName);
      } catch (error) {
        console.error('Error fetching active season:', error);
        setError('Failed to load active season');
        setIsLoading(false);
      }
    };

    fetchActiveSeason();
  }, [user]);

  // Fetch team profile and data
  useEffect(() => {
    const fetchTeamData = async () => {
      if (!seasonId || !teamId) return;

      try {
        setIsLoading(true);

        // Fetch team_season data
        const teamSeasonId = `${teamId}_${seasonId}`;
        const teamSeasonRef = doc(db, 'team_seasons', teamSeasonId);
        const teamSeasonDoc = await getDoc(teamSeasonRef);

        if (!teamSeasonDoc.exists()) {
          setError('Team not found in this season');
          setIsLoading(false);
          return;
        }

        const teamSeasonData = teamSeasonDoc.data();

        setTeamProfile({
          id: teamId,
          name: teamSeasonData.team_name || 'Unknown Team',
          logoUrl: teamSeasonData.team_logo,
          budget: teamSeasonData.budget || 0,
          totalSpent: teamSeasonData.total_spent || 0,
          playersCount: teamSeasonData.players_count || 0,
          positionCounts: teamSeasonData.position_counts || {},
          averageRating: teamSeasonData.average_rating || 0,
          contractId: teamSeasonData.contract_id,
          contractStartSeason: teamSeasonData.contract_start_season,
          contractEndSeason: teamSeasonData.contract_end_season,
          isAutoRegistered: teamSeasonData.is_auto_registered,
          skippedSeasons: teamSeasonData.skipped_seasons,
          penaltyAmount: teamSeasonData.penalty_amount,
        });

        // Fetch players, fixtures, and standings from API
        const [playersRes, fixturesRes, standingsRes] = await Promise.all([
          fetch(`/api/team/${teamId}/players`),
          fetch(`/api/team/${teamId}/fixtures?seasonId=${seasonId}`),
          fetch(`/api/team/${teamId}/standings?seasonId=${seasonId}`)
        ]);

        if (playersRes.ok) {
          const playersData = await playersRes.json();
          setPlayers(playersData.players || []);
        }

        if (fixturesRes.ok) {
          const fixturesData = await fixturesRes.json();
          setFixtures(fixturesData.fixtures || []);
        }

        if (standingsRes.ok) {
          const standingsData = await standingsRes.json();
          if (standingsData.standings) {
            setStandings(standingsData.standings);
          }
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching team data:', error);
        setError('Failed to load team data');
        setIsLoading(false);
      }
    };

    fetchTeamData();
  }, [seasonId, teamId]);

  const getPositionColor = (position: string) => {
    const colors: { [key: string]: string } = {
      GK: 'bg-yellow-100 text-yellow-800',
      CB: 'bg-red-100 text-red-800',
      LB: 'bg-orange-100 text-orange-800',
      RB: 'bg-orange-100 text-orange-800',
      DMF: 'bg-blue-100 text-blue-800',
      CMF: 'bg-sky-100 text-sky-800',
      AMF: 'bg-cyan-100 text-cyan-800',
      LMF: 'bg-teal-100 text-teal-800',
      RMF: 'bg-teal-100 text-teal-800',
      LWF: 'bg-green-100 text-green-800',
      RWF: 'bg-green-100 text-green-800',
      SS: 'bg-purple-100 text-purple-800',
      CF: 'bg-pink-100 text-pink-800',
    };
    return colors[position] || 'bg-gray-100 text-gray-800';
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading team profile...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'team') {
    return null;
  }

  if (error || !teamProfile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="glass rounded-3xl p-8 max-w-2xl mx-auto text-center">
          <div className="text-red-600 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-dark mb-2">Team Not Found</h2>
          <p className="text-gray-600 mb-4">{error || 'This team does not exist in the current season'}</p>
          <Link href="/dashboard/team/all-teams" className="text-[#0066FF] hover:underline">
            Back to All Teams
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="glass rounded-3xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <Link 
              href="/dashboard/team/all-teams" 
              className="flex items-center text-gray-600 hover:text-[#0066FF] transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to All Teams</span>
            </Link>
            <span className="text-sm text-gray-600">Season: <span className="font-semibold text-[#0066FF]">{seasonName}</span></span>
          </div>

          {/* Team Header */}
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 flex-shrink-0 bg-[#0066FF]/10 rounded-xl flex items-center justify-center overflow-hidden">
              {teamProfile.logoUrl ? (
                <Image 
                  src={teamProfile.logoUrl} 
                  alt={teamProfile.name} 
                  width={80}
                  height={80}
                  className="object-contain"
                />
              ) : (
                <svg className="w-10 h-10 text-[#0066FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-dark mb-2">{teamProfile.name}</h1>
              <div className="flex flex-wrap gap-3">
                {standings && (
                  <span className="inline-flex items-center rounded-full bg-gradient-to-r from-blue-100 to-blue-200 px-4 py-1.5 text-sm font-bold text-blue-800">
                    #{standings.position} in League
                  </span>
                )}
                <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                  £{teamProfile.totalSpent.toLocaleString()} Spent
                </span>
                <span className="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800">
                  £{teamProfile.budget.toLocaleString()} Left
                </span>
                <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                  {teamProfile.playersCount} Players
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="glass rounded-2xl p-2 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('squad')}
              className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                activeTab === 'squad'
                  ? 'bg-[#0066FF] text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Squad ({players.length})
            </button>
            <button
              onClick={() => setActiveTab('fixtures')}
              className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                activeTab === 'fixtures'
                  ? 'bg-[#0066FF] text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Fixtures
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                activeTab === 'stats'
                  ? 'bg-[#0066FF] text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Stats
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'squad' && (
          <div className="glass rounded-3xl p-6">
            <h2 className="text-2xl font-bold mb-6">Squad</h2>
            {players.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {players.map((player) => (
                  <div key={player.id} className="glass rounded-xl p-4 hover:shadow-lg transition-all">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-12 w-12 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                        {player.imageUrl ? (
                          <Image 
                            src={player.imageUrl} 
                            alt={player.name} 
                            width={48}
                            height={48}
                            className="object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-gray-300 text-gray-600 font-bold">
                            {player.name.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-dark truncate">{player.name}</h3>
                        <div className="flex items-center gap-2">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${getPositionColor(player.position)}`}>
                            {player.position}
                          </span>
                          <span className="text-sm font-semibold text-orange-600">{player.rating}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Price:</span> £{player.purchasePrice.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">No players in squad</p>
            )}
          </div>
        )}

        {activeTab === 'fixtures' && (
          <div className="glass rounded-3xl p-6">
            <h2 className="text-2xl font-bold mb-6">Fixtures</h2>
            {fixtures.length > 0 ? (
              <div className="space-y-3">
                {fixtures.map((fixture) => {
                  const isHome = fixture.homeTeamId === teamId;
                  const opponent = isHome ? fixture.awayTeamName : fixture.homeTeamName;
                  const result = fixture.homeScore !== null && fixture.awayScore !== null
                    ? isHome 
                      ? fixture.homeScore > fixture.awayScore ? 'W' : fixture.homeScore < fixture.awayScore ? 'L' : 'D'
                      : fixture.awayScore > fixture.homeScore ? 'W' : fixture.awayScore < fixture.homeScore ? 'L' : 'D'
                    : null;

                  return (
                    <div key={fixture.id} className="glass rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-gray-500">R{fixture.roundNumber}</span>
                          <span className="text-sm text-gray-600">{isHome ? 'vs' : '@'} {opponent}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {fixture.status === 'completed' ? (
                            <>
                              <span className="text-lg font-bold">
                                {isHome ? fixture.homeScore : fixture.awayScore} - {isHome ? fixture.awayScore : fixture.homeScore}
                              </span>
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                result === 'W' ? 'bg-green-100 text-green-800' :
                                result === 'L' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {result}
                              </span>
                            </>
                          ) : (
                            <span className="text-sm text-gray-500">{fixture.status}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">No fixtures scheduled</p>
            )}
          </div>
        )}

        {activeTab === 'stats' && standings && (
          <div className="space-y-6">
            <div className="glass rounded-3xl p-6">
              <h2 className="text-2xl font-bold mb-6">League Statistics</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 glass rounded-xl">
                  <div className="text-3xl font-bold text-[#0066FF]">{standings.position}</div>
                  <div className="text-sm text-gray-600 mt-1">Position</div>
                </div>
                <div className="text-center p-4 glass rounded-xl">
                  <div className="text-3xl font-bold text-green-600">{standings.points}</div>
                  <div className="text-sm text-gray-600 mt-1">Points</div>
                </div>
                <div className="text-center p-4 glass rounded-xl">
                  <div className="text-3xl font-bold text-orange-600">{standings.played}</div>
                  <div className="text-sm text-gray-600 mt-1">Played</div>
                </div>
                <div className="text-center p-4 glass rounded-xl">
                  <div className="text-3xl font-bold text-purple-600">{teamProfile.averageRating.toFixed(1)}</div>
                  <div className="text-sm text-gray-600 mt-1">Avg Rating</div>
                </div>
              </div>
            </div>

            <div className="glass rounded-3xl p-6">
              <h3 className="text-xl font-bold mb-4">Match Record</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-xl">
                  <div className="text-2xl font-bold text-green-600">{standings.won}</div>
                  <div className="text-sm text-green-700">Wins</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-xl">
                  <div className="text-2xl font-bold text-gray-600">{standings.drawn}</div>
                  <div className="text-sm text-gray-700">Draws</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-xl">
                  <div className="text-2xl font-bold text-red-600">{standings.lost}</div>
                  <div className="text-sm text-red-700">Losses</div>
                </div>
              </div>
            </div>

            <div className="glass rounded-3xl p-6">
              <h3 className="text-xl font-bold mb-4">Goals</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 glass rounded-xl">
                  <div className="text-2xl font-bold text-green-600">{standings.goalsFor}</div>
                  <div className="text-sm text-gray-600">Scored</div>
                </div>
                <div className="text-center p-4 glass rounded-xl">
                  <div className="text-2xl font-bold text-red-600">{standings.goalsAgainst}</div>
                  <div className="text-sm text-gray-600">Conceded</div>
                </div>
                <div className="text-center p-4 glass rounded-xl">
                  <div className={`text-2xl font-bold ${standings.goalDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {standings.goalDifference >= 0 ? '+' : ''}{standings.goalDifference}
                  </div>
                  <div className="text-sm text-gray-600">Difference</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
