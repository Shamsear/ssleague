'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface TeamRegistrationContextType {
  isRegistered: boolean;
  setIsRegistered: (registered: boolean) => void;
}

const TeamRegistrationContext = createContext<TeamRegistrationContextType>({
  isRegistered: true, // Default to true to avoid hiding menu during initial load
  setIsRegistered: () => {},
});

export function TeamRegistrationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isRegistered, setIsRegistered] = useState(true);

  // Reset to true when user changes (to avoid hiding menu during loading)
  useEffect(() => {
    if (!user || user.role !== 'team') {
      setIsRegistered(true); // Non-team users always see full menu
    }
  }, [user]);

  return (
    <TeamRegistrationContext.Provider value={{ isRegistered, setIsRegistered }}>
      {children}
    </TeamRegistrationContext.Provider>
  );
}

export function useTeamRegistration() {
  return useContext(TeamRegistrationContext);
}
