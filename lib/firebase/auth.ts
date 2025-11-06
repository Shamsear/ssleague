import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updatePassword,
  User as FirebaseUser,
  UserCredential,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  collection,
  getDocs,
  query,
  where,
  deleteDoc,
} from 'firebase/firestore';
import { auth, db } from './config';
import { User, UserRole, Team, CommitteeAdmin, SuperAdmin } from '@/types/user';

// Convert Firestore timestamp to Date
const convertTimestamp = (timestamp: any): Date => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }
  if (timestamp?.toDate) {
    return timestamp.toDate();
  }
  return new Date();
};

// Create a new user in Firestore
export const createUserDocument = async (
  uid: string,
  email: string,
  username: string,
  role: UserRole,
  additionalData?: any
): Promise<User> => {
  const userRef = doc(db, 'users', uid);
  
  const baseUserData = {
    uid,
    email,
    username,
    role,
    isActive: true,
    // Approval System:
    // - Teams (role='team'): isApproved = false (require super admin approval)
    // - Committee Admins & Super Admins: isApproved = true (auto-approved)
    isApproved: role !== 'team',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  let userData: any = { ...baseUserData };

  // Add role-specific data
  switch (role) {
    case 'super_admin':
      userData.permissions = additionalData?.permissions || ['all'];
      break;
    case 'committee_admin':
      userData.seasonId = additionalData?.seasonId || '';
      userData.seasonName = additionalData?.seasonName || '';
      userData.seasonYear = additionalData?.seasonYear || '';
      userData.committeeId = additionalData?.committeeId || '';
      userData.committeeName = additionalData?.committeeName || '';
      userData.permissions = additionalData?.permissions || ['manage_teams', 'manage_auctions'];
      userData.canManageTeams = additionalData?.canManageTeams ?? true;
      userData.canManageAuctions = additionalData?.canManageAuctions ?? true;
      break;
    case 'team':
      userData.teamName = additionalData?.teamName || '';
      userData.teamLogo = additionalData?.teamLogo || '';
      userData.players = additionalData?.players || [];
      userData.committeeId = additionalData?.committeeId || '';
      break;
  }

  await setDoc(userRef, userData);

  // Fetch and return the created user
  const userDoc = await getDoc(userRef);
  const data = userDoc.data();
  
  return {
    ...data,
    createdAt: convertTimestamp(data?.createdAt),
    updatedAt: convertTimestamp(data?.updatedAt),
  } as User;
};

// Get user document from Firestore with retry logic
export const getUserDocument = async (uid: string, retryCount = 0): Promise<User | null> => {
  const maxRetries = 3;
  const retryDelay = 1000; // 1 second
  
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return null;
    }

    const data = userDoc.data();
    return {
      ...data,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt),
    } as User;
  } catch (error: any) {
    // Handle permission-denied errors with retry logic
    if (error.code === 'permission-denied' && retryCount < maxRetries) {
      console.warn(`Permission denied for user ${uid}, retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      
      // Retry with exponential backoff
      return getUserDocument(uid, retryCount + 1);
    }
    
    // Log non-permission errors or exhausted retries
    if (!error.code?.includes('permission-denied') || retryCount >= maxRetries) {
      console.error('Error getting user document:', {
        uid,
        error: error.message,
        code: error.code,
        retryCount
      });
    }
    
    return null;
  }
};

// Sign up a new user
export const signUp = async (
  email: string,
  password: string,
  username: string,
  role: UserRole = 'team',
  additionalData?: any
): Promise<{ user: User; firebaseUser: FirebaseUser }> => {
  try {
    // Check if username is available
    const usernameAvailable = await isUsernameAvailable(username);
    if (!usernameAvailable) {
      throw new Error('Username is already taken. Please choose another.');
    }

    // Create Firebase auth user
    const userCredential: UserCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    // Reserve username
    await reserveUsername(username, userCredential.user.uid);

    // Create user document in Firestore
    const user = await createUserDocument(
      userCredential.user.uid,
      email,
      username,
      role,
      additionalData
    );

    // Note: Team document creation in teams collection is handled by
    // /api/teams/create endpoint called from Register component
    // This ensures proper server-side execution and prevents race conditions

    return {
      user,
      firebaseUser: userCredential.user,
    };
  } catch (error: any) {
    console.error('Error signing up:', error);
    throw new Error(error.message || 'Failed to sign up');
  }
};

// Sign in an existing user
export const signIn = async (
  email: string,
  password: string,
  rememberMe: boolean = false
): Promise<{ user: User; firebaseUser: FirebaseUser }> => {
  try {
    // Always use local persistence to keep users logged in across tabs
    // The rememberMe parameter is kept for backwards compatibility but doesn't affect persistence
    const { setPersistence, browserLocalPersistence } = await import('firebase/auth');
    await setPersistence(auth, browserLocalPersistence);
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = await getUserDocument(userCredential.user.uid);

    if (!user) {
      throw new Error('User document not found');
    }

    if (!user.isActive) {
      throw new Error('Account is deactivated. Please contact support.');
    }

    // Check approval status (only teams need approval, admins are auto-approved)
    if (user.role === 'team' && !user.isApproved) {
      throw new Error('Your account is pending approval from the super admin. Please wait for approval before logging in.');
    }

    // Update last login (non-blocking for faster login)
    updateDoc(doc(db, 'users', user.uid), {
      lastLogin: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).catch(err => console.error('Error updating last login:', err));

    return {
      user,
      firebaseUser: userCredential.user,
    };
  } catch (error: any) {
    console.error('Error signing in:', error);
    throw new Error(error.message || 'Failed to sign in');
  }
};

// Sign out
export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (error: any) {
    console.error('Error signing out:', error);
    throw new Error(error.message || 'Failed to sign out');
  }
};

// Send password reset email
export const resetPassword = async (email: string): Promise<void> => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    console.error('Error sending password reset email:', error);
    throw new Error(error.message || 'Failed to send password reset email');
  }
};

// Update user password
export const changePassword = async (newPassword: string): Promise<void> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No user logged in');
    }
    await updatePassword(user, newPassword);
  } catch (error: any) {
    console.error('Error updating password:', error);
    throw new Error(error.message || 'Failed to update password');
  }
};

// Convert file to Base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

// Upload team logo as Base64
export const uploadTeamLogo = async (
  uid: string,
  file: File
): Promise<string> => {
  try {
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      throw new Error('File size must be less than 2MB');
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    // Convert to Base64
    const base64String = await fileToBase64(file);
    
    // Update user document with Base64 string
    await updateDoc(doc(db, 'users', uid), {
      teamLogo: base64String,
      updatedAt: serverTimestamp(),
    });

    return base64String;
  } catch (error: any) {
    console.error('Error uploading team logo:', error);
    throw new Error(error.message || 'Failed to upload team logo');
  }
};

// Update user profile
export const updateUserProfile = async (
  uid: string,
  data: Partial<User>
): Promise<void> => {
  try {
    await updateDoc(doc(db, 'users', uid), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error: any) {
    console.error('Error updating user profile:', error);
    throw new Error(error.message || 'Failed to update user profile');
  }
};

// Get email from username
export const getEmailFromUsername = async (username: string): Promise<string | null> => {
  try {
    const usernameDoc = await getDoc(doc(db, 'usernames', username.toLowerCase()));
    if (!usernameDoc.exists()) {
      return null;
    }
    
    // Get the UID from username document
    const uid = usernameDoc.data().uid;
    
    // Get user document to get email
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) {
      return null;
    }
    
    return userDoc.data().email;
  } catch (error) {
    console.error('Error getting email from username:', error);
    return null;
  }
};

// Check if username is available
export const isUsernameAvailable = async (username: string): Promise<boolean> => {
  try {
    // This is a simple check - in production, you might want to use a more efficient method
    // like maintaining a separate collection of usernames or using Cloud Functions
    const usersRef = doc(db, 'usernames', username.toLowerCase());
    const docSnap = await getDoc(usersRef);
    return !docSnap.exists();
  } catch (error) {
    console.error('Error checking username availability:', error);
    return false;
  }
};

// Reserve username
export const reserveUsername = async (username: string, uid: string): Promise<void> => {
  try {
    await setDoc(doc(db, 'usernames', username.toLowerCase()), {
      uid,
      createdAt: serverTimestamp(),
    });
  } catch (error: any) {
    console.error('Error reserving username:', error);
    throw new Error(error.message || 'Failed to reserve username');
  }
};

// Get all users (Super Admin only)
export const getAllUsers = async (): Promise<User[]> => {
  try {
    const usersRef = collection(db, 'users');
    const querySnapshot = await getDocs(usersRef);
    
    const users: User[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      users.push({
        ...data,
        createdAt: convertTimestamp(data.createdAt),
        updatedAt: convertTimestamp(data.updatedAt),
      } as User);
    });
    
    return users;
  } catch (error: any) {
    console.error('Error getting all users:', error);
    throw new Error(error.message || 'Failed to get all users');
  }
};

// Update user role (Super Admin only)
export const updateUserRole = async (uid: string, newRole: UserRole): Promise<void> => {
  try {
    await updateDoc(doc(db, 'users', uid), {
      role: newRole,
      updatedAt: serverTimestamp(),
    });
  } catch (error: any) {
    console.error('Error updating user role:', error);
    throw new Error(error.message || 'Failed to update user role');
  }
};

// Toggle user active status (Super Admin only)
export const toggleUserStatus = async (uid: string, isActive: boolean): Promise<void> => {
  try {
    await updateDoc(doc(db, 'users', uid), {
      isActive,
      updatedAt: serverTimestamp(),
    });
  } catch (error: any) {
    console.error('Error toggling user status:', error);
    throw new Error(error.message || 'Failed to toggle user status');
  }
};

// Delete user (Super Admin only)
export const deleteUser = async (uid: string): Promise<void> => {
  try {
    // Get username before deleting user document
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      const username = userDoc.data().username;
      
      // Delete user document
      await deleteDoc(doc(db, 'users', uid));
      
      // Delete username reservation
      if (username) {
        await deleteDoc(doc(db, 'usernames', username.toLowerCase()));
      }
    }
  } catch (error: any) {
    console.error('Error deleting user:', error);
    throw new Error(error.message || 'Failed to delete user');
  }
};

// Get pending users (users waiting for approval)
export const getPendingUsers = async (): Promise<User[]> => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('isApproved', '==', false));
    const querySnapshot = await getDocs(q);
    
    const users: User[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      users.push({
        ...data,
        createdAt: convertTimestamp(data.createdAt),
        updatedAt: convertTimestamp(data.updatedAt),
        approvedAt: data.approvedAt ? convertTimestamp(data.approvedAt) : undefined,
      } as User);
    });
    
    return users;
  } catch (error: any) {
    console.error('Error getting pending users:', error);
    throw new Error(error.message || 'Failed to get pending users');
  }
};

// Approve user (Super Admin only)
export const approveUser = async (uid: string, approvedBy: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'users', uid), {
      isApproved: true,
      approvedBy,
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error: any) {
    console.error('Error approving user:', error);
    throw new Error(error.message || 'Failed to approve user');
  }
};

// Reject/decline user registration (Super Admin only)
export const rejectUser = async (uid: string): Promise<void> => {
  try {
    // Instead of deleting, we could mark as rejected
    // For now, we'll delete the user account
    await deleteUser(uid);
  } catch (error: any) {
    console.error('Error rejecting user:', error);
    throw new Error(error.message || 'Failed to reject user');
  }
};
