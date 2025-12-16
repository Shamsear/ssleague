'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useTournamentContext } from '@/contexts/TournamentContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { useTournament } from '@/hooks/useTournaments';
import TournamentSelector from '@/components/TournamentSelector';
import TournamentStandings from '@/components/tournament/TournamentStandings';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

export default function TeamLeaderboardPage() {
  const { user, loading } = useAuth();
  const { selectedTournamentId, seasonId, setSeasonId } = useTournamentContext();
  const router = useRouter();
  
  // Get tournament info for display
  const { data: tournament, isLoading: tournamentLoading } = useTournament(selectedTournamentId);

  // Fetch and set the team's season if not already set
  useEffect(() => {
    const fetchTeamSeason = async () => {
      if (!user || user.role !== 'team' || seasonId) return;

      try {
        // Get active season from Firebase
        const { db } = await import('@/lib/firebase/config');
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        
        const seasonsRef = collection(db, 'seasons');
        const activeSeasonQuery = query(seasonsRef, where('isActive', '==', true));
        const snapshot = await getDocs(activeSeasonQuery);
        
        if (!snapshot.empty) {
          const activeSeason = snapshot.docs[0];
          const activeSeasonId = activeSeason.id;
          
          // Check if team is registered for this season
          const teamSeasonsRef = collection(db, 'team_seasons');
          const teamSeasonQuery = query(
            teamSeasonsRef,
            where('user_id', '==', user.uid),
            where('season_id', '==', activeSeasonId),
            where('status', '==', 'registered')
          );
          const teamSeasonSnapshot = await getDocs(teamSeasonQuery);
          
          if (!teamSeasonSnapshot.empty) {
            console.log('📝 [Leaderboard] Setting team season ID:', activeSeasonId);
            setSeasonId(activeSeasonId);
          } else {
            console.log('⚠️ [Leaderboard] Team not registered for active season');
          }
        } else {
          console.log('⚠️ [Leaderboard] No active season found');
        }
      } catch (error) {
        console.error('❌ [Leaderboard] Error fetching team season:', error);
      }
    };

    fetchTeamSeason();
  }, [user, seasonId, setSeasonId]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'team') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          {/* Back Link */}
          <Link
            href="/dashboard/team"
            className="group inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm text-gray-700 hover:text-indigo-600 mb-4 font-medium transition-all rounded-xl shadow-sm hover:shadow-md border border-gray-200 hover:border-indigo-300"
          >
            <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm sm:text-base">Back to Dashboard</span>
          </Link>

          {/* Title Card */}
          <div className="relative bg-white/90 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-xl border border-white/20 p-5 sm:p-8 overflow-hidden">
            {/* Decorative background */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full blur-3xl opacity-30 -z-10"></div>
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-gray-900 via-indigo-900 to-purple-900 bg-clip-text text-transparent">
                      Team Leaderboard
                    </h1>
                    <p className="text-sm sm:text-base text-gray-600 mt-1">
                      {tournament?.tournament_name || 'Tournament'} Rankings
                    </p>
                  </div>
                </div>
                
                {/* Quick Link */}
                <Link
                  href="/dashboard/team/player-leaderboard"
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-sm font-medium transition-all mt-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  View Player Rankings
                </Link>
              </div>
              
              {/* Tournament Selector */}
              <div className="w-full sm:w-auto">
                <TournamentSelector />
              </div>
            </div>
          </div>
        </div>

        {/* Tournament Standings - Format-Aware */}
        {tournamentLoading ? (
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading tournament data...</p>
          </div>
        ) : selectedTournamentId ? (
          <TournamentStandings 
            tournamentId={selectedTournamentId}
            currentUserId={user.uid}
          />
        ) : (
          <div className="bg-yellow-50/90 backdrop-blur-xl border border-yellow-200 rounded-2xl p-6 text-center shadow-lg">
            <span className="text-4xl mb-2 block">⚠️</span>
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">No Tournament Selected</h3>
            <p className="text-sm text-yellow-600 mb-4">Please select a tournament from the dropdown above to view standings</p>
            <p className="text-xs text-yellow-500">
              If no tournaments appear, make sure your team is registered for the current season
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
