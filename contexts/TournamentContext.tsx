'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface TournamentContextType {
  selectedTournamentId: string | null;
  setSelectedTournamentId: (tournamentId: string | null) => void;
  seasonId: string | null;
  setSeasonId: (seasonId: string | null) => void;
}

const TournamentContext = createContext<TournamentContextType | undefined>(undefined);

export function TournamentProvider({ children }: { children: ReactNode }) {
  const [selectedTournamentId, setSelectedTournamentIdState] = useState<string | null>(null);
  const [seasonId, setSeasonIdState] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const storedTournamentId = localStorage.getItem('selectedTournamentId');
    const storedSeasonId = localStorage.getItem('selectedSeasonId');
    
    if (storedTournamentId) {
      setSelectedTournamentIdState(storedTournamentId);
    }
    if (storedSeasonId) {
      setSeasonIdState(storedSeasonId);
    }
  }, []);

  // Persist tournament ID to localStorage
  const setSelectedTournamentId = useCallback((tournamentId: string | null) => {
    setSelectedTournamentIdState(tournamentId);
    if (tournamentId) {
      localStorage.setItem('selectedTournamentId', tournamentId);
    } else {
      localStorage.removeItem('selectedTournamentId');
    }
  }, []);

  // Persist season ID to localStorage
  const setSeasonId = useCallback((newSeasonId: string | null) => {
    setSeasonIdState((prevSeasonId) => {
      // Only update if season actually changed
      if (prevSeasonId === newSeasonId) {
        return prevSeasonId;
      }
      
      if (newSeasonId) {
        localStorage.setItem('selectedSeasonId', newSeasonId);
      } else {
        localStorage.removeItem('selectedSeasonId');
      }
      
      return newSeasonId;
    });
    
    // Reset tournament selection when season changes
    if (newSeasonId) {
      setSelectedTournamentIdState(null);
      localStorage.removeItem('selectedTournamentId');
    }
  }, []);

  return (
    <TournamentContext.Provider
      value={{
        selectedTournamentId,
        setSelectedTournamentId,
        seasonId,
        setSeasonId,
      }}
    >
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournamentContext() {
  const context = useContext(TournamentContext);
  if (context === undefined) {
    throw new Error('useTournamentContext must be used within a TournamentProvider');
  }
  return context;
}
