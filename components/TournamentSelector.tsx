'use client';

import React from 'react';
import { useTournaments, getTournamentIcon, getTournamentColor } from '@/hooks/useTournaments';
import { useTournamentContext } from '@/contexts/TournamentContext';
import { usePermissions } from '@/hooks/usePermissions';

export default function TournamentSelector() {
  const { userSeasonId, user } = usePermissions();
  const { selectedTournamentId, setSelectedTournamentId, seasonId, setSeasonId } = useTournamentContext();
  
  // For team users, get their registered season from context/localStorage
  // For committee admins, use userSeasonId from permissions
  const effectiveSeasonId = user?.role === 'team' ? seasonId : userSeasonId;
  
  // Load tournaments for current season
  const { data: tournaments, isLoading } = useTournaments({
    seasonId: effectiveSeasonId || undefined,
    enabled: !!effectiveSeasonId,
  });

  // Debug logging
  React.useEffect(() => {
    console.log('🔍 TournamentSelector Debug:', {
      userRole: user?.role,
      userSeasonId,
      seasonId,
      effectiveSeasonId,
      tournamentsCount: tournaments?.length || 0,
      selectedTournamentId,
      isLoading
    });
  }, [user?.role, userSeasonId, seasonId, effectiveSeasonId, tournaments, selectedTournamentId, isLoading]);

  // Set season ID in context when userSeasonId changes (only if different)
  React.useEffect(() => {
    if (userSeasonId && userSeasonId !== seasonId) {
      console.log('📝 Setting season ID in context:', userSeasonId);
      setSeasonId(userSeasonId);
    }
  }, [userSeasonId, seasonId, setSeasonId]);

  // Auto-select primary tournament if none selected
  React.useEffect(() => {
    if (tournaments && tournaments.length > 0 && !selectedTournamentId) {
      const primaryTournament = tournaments.find(t => t.is_primary);
      if (primaryTournament) {
        console.log('🏆 Auto-selecting primary tournament:', primaryTournament.tournament_name);
        setSelectedTournamentId(primaryTournament.id);
      } else {
        console.log('🏆 Auto-selecting first tournament:', tournaments[0].tournament_name);
        setSelectedTournamentId(tournaments[0].id);
      }
    }
  }, [tournaments, selectedTournamentId, setSelectedTournamentId]);

  if (isLoading) {
    return (
      <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-10 w-48 rounded-lg"></div>
    );
  }

  if (!tournaments || tournaments.length === 0) {
    return null;
  }

  // If only one tournament, show it as a badge (not a selector)
  if (tournaments.length === 1) {
    const tournament = tournaments[0];
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <span className="text-2xl">{getTournamentIcon(tournament.tournament_type)}</span>
        <span className="font-semibold text-blue-900 dark:text-blue-100">
          {tournament.tournament_name}
        </span>
        {tournament.status === 'active' && (
          <span className="px-2 py-0.5 text-xs bg-green-500 text-white rounded-full">
            Active
          </span>
        )}
      </div>
    );
  }

  // Multiple tournaments - show selector dropdown
  const selectedTournament = tournaments.find(t => t.id === selectedTournamentId);

  return (
    <div className="relative">
      <select
        value={selectedTournamentId || ''}
        onChange={(e) => setSelectedTournamentId(e.target.value)}
        className="appearance-none flex items-center gap-2 px-4 py-2 pr-10 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:border-blue-500 dark:hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all cursor-pointer"
      >
        {tournaments.map((tournament) => (
          <option key={tournament.id} value={tournament.id}>
            {getTournamentIcon(tournament.tournament_type)} {tournament.tournament_name}
            {tournament.status === 'active' ? ' • Active' : ''}
          </option>
        ))}
      </select>

      {/* Custom dropdown arrow */}
      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
        <svg
          className="w-5 h-5 text-gray-400"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      {/* Tournament status badge */}
      {selectedTournament && selectedTournament.status === 'active' && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
      )}
    </div>
  );
}
