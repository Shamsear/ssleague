import { useEffect, useState } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  where, 
  Timestamp,
  QueryConstraint 
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Season } from '@/types/season';
import { AdminInvite } from '@/types/invite';
import { User } from '@/types/user';

// Helper to convert Firestore timestamps
const convertTimestamp = (timestamp: any): Date => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }
  if (timestamp?.toDate) {
    return timestamp.toDate();
  }
  if (timestamp?.seconds) {
    return new Date(timestamp.seconds * 1000);
  }
  return new Date();
};

/**
 * Hook for real-time seasons data
 */
export const useRealtimeSeasons = (user?: any, userLoading?: boolean) => {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('useRealtimeSeasons effect called:', { userLoading, user: user ? `${user.role} (${user.uid})` : 'null' });
    
    // Don't start listening until user is loaded and authenticated
    if (userLoading) {
      console.log('⏳ User still loading, waiting...');
      return;
    }
    
    if (!user) {
      console.log('⏳ No user authenticated, waiting...');
      return;
    }

    // Only allow super admins to access seasons real-time data
    if (user.role !== 'super_admin') {
      console.warn('❌ Access denied: Super admin role required, user role:', user.role);
      setError('Access denied: Super admin role required');
      setLoading(false);
      return;
    }

    console.log('✅ Starting real-time seasons listener for authenticated super admin...');
    
    const seasonsQuery = query(
      collection(db, 'seasons'),
      orderBy('created_at', 'desc') // Use created_at to match API
    );

    const unsubscribe = onSnapshot(
      seasonsQuery,
      (snapshot) => {
        console.log(`✅ Received ${snapshot.size} seasons from real-time listener`);
        const seasonsData: Season[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          seasonsData.push({
            id: doc.id,
            ...data,
            startDate: data.startDate ? convertTimestamp(data.startDate) : undefined,
            endDate: data.endDate ? convertTimestamp(data.endDate) : undefined,
            createdAt: convertTimestamp(data.created_at || data.createdAt),
            updatedAt: convertTimestamp(data.updated_at || data.updatedAt),
          } as Season);
        });
        setSeasons(seasonsData);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching real-time seasons:', err);
        setError(err.message || 'Failed to fetch seasons');
        setLoading(false);
      }
    );

    return () => {
      console.log('Cleaning up real-time seasons listener...');
      unsubscribe();
    };
  }, [user, userLoading]);

  return { seasons, loading, error };
};

/**
 * Hook for real-time invites data
 */
export const useRealtimeInvites = () => {
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const invitesQuery = query(
      collection(db, 'invites'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      invitesQuery,
      (snapshot) => {
        const invitesData: AdminInvite[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          invitesData.push({
            id: doc.id,
            ...data,
            expiresAt: convertTimestamp(data.expiresAt),
            createdAt: convertTimestamp(data.createdAt),
          } as AdminInvite);
        });
        setInvites(invitesData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching real-time invites:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { invites, loading, error };
};

/**
 * Hook for real-time users data with optional filtering
 */
export const useRealtimeUsers = (role?: string, user?: any, userLoading?: boolean) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Don't start listening until user is loaded and authenticated
    if (userLoading || !user) {
      return;
    }

    // Only allow authenticated users to access users data
    if (!user.uid) {
      setError('Authentication required');
      setLoading(false);
      return;
    }

    console.log('Starting real-time users listener for authenticated user...');
    
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
    
    if (role) {
      constraints.unshift(where('role', '==', role));
    }

    const usersQuery = query(collection(db, 'users'), ...constraints);

    const unsubscribe = onSnapshot(
      usersQuery,
      (snapshot) => {
        console.log(`✅ Received ${snapshot.size} users from real-time listener`);
        const usersData: User[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          usersData.push({
            ...data,
            createdAt: convertTimestamp(data.createdAt),
            updatedAt: convertTimestamp(data.updatedAt),
          } as User);
        });
        setUsers(usersData);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching real-time users:', err);
        setError(err.message || 'Failed to fetch users');
        setLoading(false);
      }
    );

    return () => {
      console.log('Cleaning up real-time users listener...');
      unsubscribe();
    };
  }, [role, user, userLoading]);

  return { users, loading, error };
};

/**
 * Hook for real-time committee admins by season
 */
export const useRealtimeCommitteeAdmins = (seasonId?: string) => {
  const [admins, setAdmins] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!seasonId) {
      setLoading(false);
      return;
    }

    const adminsQuery = query(
      collection(db, 'users'),
      where('role', '==', 'committee_admin'),
      where('seasonId', '==', seasonId)
    );

    const unsubscribe = onSnapshot(
      adminsQuery,
      (snapshot) => {
        const adminsData: User[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          adminsData.push({
            ...data,
            createdAt: convertTimestamp(data.createdAt),
            updatedAt: convertTimestamp(data.updatedAt),
          } as User);
        });
        setAdmins(adminsData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching real-time committee admins:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [seasonId]);

  return { admins, loading, error };
};

/**
 * Hook for real-time teams data
 */
export const useRealtimeTeams = (seasonId?: string) => {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
    
    if (seasonId) {
      constraints.unshift(where('seasonId', '==', seasonId));
    }

    const teamsQuery = query(collection(db, 'teams'), ...constraints);

    const unsubscribe = onSnapshot(
      teamsQuery,
      (snapshot) => {
        const teamsData: any[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          teamsData.push({
            id: doc.id,
            ...data,
            createdAt: convertTimestamp(data.createdAt),
            updatedAt: convertTimestamp(data.updatedAt),
          });
        });
        setTeams(teamsData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching real-time teams:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [seasonId]);

  return { teams, loading, error };
};

/**
 * Hook for real-time players data
 */
export const useRealtimePlayers = (seasonId?: string) => {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
    
    if (seasonId) {
      constraints.unshift(where('seasonId', '==', seasonId));
    }

    const playersQuery = query(collection(db, 'footballPlayers'), ...constraints);

    const unsubscribe = onSnapshot(
      playersQuery,
      (snapshot) => {
        const playersData: any[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          playersData.push({
            id: doc.id,
            ...data,
            createdAt: convertTimestamp(data.createdAt),
            updatedAt: convertTimestamp(data.updatedAt),
          });
        });
        setPlayers(playersData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching real-time players:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [seasonId]);

  return { players, loading, error };
};

/**
 * Generic hook for any Firestore collection with real-time updates
 */
export const useRealtimeCollection = <T = any>(
  collectionName: string,
  constraints: QueryConstraint[] = []
) => {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const collectionQuery = query(
      collection(db, collectionName),
      ...constraints
    );

    const unsubscribe = onSnapshot(
      collectionQuery,
      (snapshot) => {
        const items: T[] = [];
        snapshot.forEach((doc) => {
          const docData = doc.data();
          items.push({
            id: doc.id,
            ...docData,
            createdAt: docData.createdAt ? convertTimestamp(docData.createdAt) : undefined,
            updatedAt: docData.updatedAt ? convertTimestamp(docData.updatedAt) : undefined,
          } as T);
        });
        setData(items);
        setLoading(false);
      },
      (err) => {
        console.error(`Error fetching real-time ${collectionName}:`, err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName, JSON.stringify(constraints)]);

  return { data, loading, error };
};
