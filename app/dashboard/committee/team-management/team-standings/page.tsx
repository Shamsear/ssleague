'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useTournamentContext } from '@/contexts/TournamentContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { useTournament } from '@/hooks/useTournaments';
import TournamentSelector from '@/components/TournamentSelector';
import TournamentStandings from '@/components/tournament/TournamentStandings';

export default function TeamStandingsPage() {
  const { user, loading } = useAuth();
  const { selectedTournamentId, seasonId, setSeasonId } = useTournamentContext();
  const router = useRouter();
  
  // Get tournament info for display
  const { data: tournament } = useTournament(selectedTournamentId);

  // Fetch and set active season for committee admin
  useEffect(() => {
    const fetchActiveSeason = async () => {
      if (!user || user.role !== 'committee_admin') return;

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
          
          console.log('📝 [Committee Standings] Found active season:', activeSeasonId);
          setSeasonId(activeSeasonId);
        } else {
          console.log('⚠️ [Committee Standings] No active season found');
        }
      } catch (error) {
        console.error('❌ [Committee Standings] Error fetching active season:', error);
      }
    };

    fetchActiveSeason();
  }, [user, setSeasonId]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'committee_admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading team standings...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'committee_admin') {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">Team Standings</h1>
          <p className="text-gray-500 mt-1">{tournament?.tournament_name || 'Tournament'} - Rankings & Results</p>
          <div className="flex gap-4 mt-2">
            <Link
              href="/dashboard/committee/team-management"
              className="inline-flex items-center text-[#0066FF] hover:text-[#0052CC] text-sm"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Team Management
            </Link>
            <Link
              href="/dashboard/committee/team-management/player-stats"
              className="inline-flex items-center text-purple-600 hover:text-purple-700 text-sm font-medium"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              View Player Stats →
            </Link>
          </div>
        </div>
        <div>
          <TournamentSelector />
        </div>
      </div>

      {/* Tournament Standings - Format-Aware */}
      {selectedTournamentId ? (
        <TournamentStandings tournamentId={selectedTournamentId} />
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <span className="text-4xl mb-2 block">⚠️</span>
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">No Tournament Selected</h3>
          <p className="text-sm text-yellow-600">Please select a tournament to view standings</p>
        </div>
      )}
    </div>
  );
}
