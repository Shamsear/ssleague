import { adminAuth, adminDb } from '@/lib/firebase/admin';

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: string;
  current_season_id?: string;
  [key: string]: any;
}

export async function getUserFromToken(token: string): Promise<User | null> {
  try {
    // Verify Firebase ID token
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    if (!decodedToken || !decodedToken.uid) {
      return null;
    }

    // Get user from Firestore
    const userDoc = await adminDb
      .collection('users')
      .doc(decodedToken.uid)
      .get();

    if (!userDoc.exists) {
      return null;
    }

    const userData = userDoc.data();
    
    return {
      id: userDoc.id,
      email: userData?.email || '',
      name: userData?.name || '',
      phone: userData?.phone || '',
      role: userData?.role || 'user',
      current_season_id: userData?.current_season_id,
      ...userData,
    };
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}
