'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { getUserDocument } from '@/lib/firebase/auth';
import { User, AuthState } from '@/types/user';
import { setupTokenRefreshInterval } from '@/lib/token-refresh';

interface AuthContextType extends AuthState {
  firebaseUser: FirebaseUser | null;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Safety timeout: stop loading after 10 seconds to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('Auth initialization timeout - stopping loading state');
        setLoading(false);
        setError('Authentication initialization timed out. Please refresh the page.');
      }
    }, 10000);
    
    return () => clearTimeout(timeout);
  }, [loading]);

  const refreshUser = async () => {
    if (firebaseUser) {
      try {
        const userData = await getUserDocument(firebaseUser.uid);
        setUser(userData);
      } catch (err: any) {
        console.error('Error refreshing user:', err);
        setError(err.message);
      }
    }
  };

  // Safety timeout: stop loading after 8 seconds
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('Auth initialization timeout');
        setLoading(false);
      }
    }, 8000);
    return () => clearTimeout(timeout);
  }, [loading]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setError(null);

      if (firebaseUser) {
        setFirebaseUser(firebaseUser);
        try {
          // Get Firebase ID token and store it in a cookie
          // Force refresh to ensure token is not expired
          // IMPORTANT: Wait for token to be set before proceeding
          const idToken = await firebaseUser.getIdToken(true);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
          
          try {
            await fetch('/api/auth/set-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: idToken }),
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            console.log('✅ Auth token cookie set successfully');
          } catch (err) {
            clearTimeout(timeoutId);
            console.warn('Failed to set token cookie:', err);
          }

          // Wait a moment for Firebase Auth state to fully propagate
          // This helps prevent race conditions with Firestore security rules
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const userData = await getUserDocument(firebaseUser.uid);
          setUser(userData);
        } catch (err: any) {
          console.error('Error fetching user data:', err);
          setError(err.message);
          setUser(null);
        }
      } else {
        setFirebaseUser(null);
        setUser(null);
        
        // Clear token cookie on logout
        await fetch('/api/auth/clear-token', { method: 'POST' }).catch(() => {});
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Setup automatic token refresh every 50 minutes
  useEffect(() => {
    if (firebaseUser) {
      const cleanup = setupTokenRefreshInterval();
      return cleanup;
    }
  }, [firebaseUser]);

  // Refresh token when user returns to tab (visibility change)
  useEffect(() => {
    if (!firebaseUser) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab became visible, refreshing token...');
        try {
          const idToken = await firebaseUser.getIdToken(true);
          await fetch('/api/auth/set-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: idToken }),
          });
          console.log('✅ Token refreshed on tab focus');
        } catch (error) {
          console.error('Error refreshing token on visibility change:', error);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [firebaseUser]);

  const value: AuthContextType = {
    user,
    firebaseUser,
    loading,
    error,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
