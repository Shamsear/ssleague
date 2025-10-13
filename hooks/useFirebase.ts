import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  signIn as firebaseSignIn,
  signUp as firebaseSignUp,
  signOut as firebaseSignOut,
  resetPassword as firebaseResetPassword,
  uploadTeamLogo,
} from '@/lib/firebase/auth';
import { UserRole } from '@/types/user';

export const useFirebaseAuth = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refreshUser } = useAuth();

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await firebaseSignIn(email, password);
      await refreshUser();
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    username: string,
    role: UserRole = 'team',
    additionalData?: any
  ) => {
    setLoading(true);
    setError(null);
    try {
      const result = await firebaseSignUp(email, password, username, role, additionalData);
      await refreshUser();
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    setError(null);
    try {
      await firebaseSignOut();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      await firebaseResetPassword(email);
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    signIn,
    signUp,
    signOut,
    resetPassword,
    loading,
    error,
  };
};

export const useTeamLogo = () => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refreshUser } = useAuth();

  const upload = async (uid: string, file: File) => {
    setUploading(true);
    setError(null);
    try {
      const url = await uploadTeamLogo(uid, file);
      await refreshUser();
      return url;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setUploading(false);
    }
  };

  return {
    upload,
    uploading,
    error,
  };
};
