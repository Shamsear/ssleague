import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  increment,
  arrayUnion,
} from 'firebase/firestore';
import { db } from './config';
import { AdminInvite, CreateInviteData, InviteUsage } from '@/types/invite';
import { getSeasonById } from './seasons';

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

// Generate random invite code
const generateInviteCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar looking characters
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
    if ((i + 1) % 4 === 0 && i !== 11) {
      code += '-'; // Add hyphens for readability
    }
  }
  return code;
};

// Create a new admin invite
export const createAdminInvite = async (
  inviteData: CreateInviteData,
  createdBy: string,
  createdByUsername: string
): Promise<AdminInvite> => {
  try {
    // Get season details
    const season = await getSeasonById(inviteData.seasonId);
    if (!season) {
      throw new Error('Season not found');
    }

    // Generate unique code
    let code = generateInviteCode();
    let isUnique = false;
    
    // Ensure code is unique
    while (!isUnique) {
      const existingInvite = await getDoc(doc(db, 'invites', code));
      if (!existingInvite.exists()) {
        isUnique = true;
      } else {
        code = generateInviteCode();
      }
    }

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + inviteData.expiresInHours);

    const inviteRef = doc(db, 'invites', code);
    
    const newInvite = {
      code,
      description: inviteData.description,
      seasonId: inviteData.seasonId,
      seasonName: season.name,
      seasonYear: season.year,
      maxUses: inviteData.maxUses,
      usedCount: 0,
      expiresAt: expiresAt,
      createdAt: serverTimestamp(),
      createdBy,
      createdByUsername,
      isActive: true,
      usedBy: [],
    };

    await setDoc(inviteRef, newInvite);

    // Fetch and return the created invite
    const createdInvite = await getAdminInviteByCode(code);
    if (!createdInvite) {
      throw new Error('Failed to fetch created invite');
    }

    return createdInvite;
  } catch (error: any) {
    console.error('Error creating admin invite:', error);
    throw new Error(error.message || 'Failed to create admin invite');
  }
};

// Get invite by code
export const getAdminInviteByCode = async (code: string): Promise<AdminInvite | null> => {
  try {
    const inviteRef = doc(db, 'invites', code);
    const inviteDoc = await getDoc(inviteRef);

    if (!inviteDoc.exists()) {
      return null;
    }

    const data = inviteDoc.data();
    return {
      id: inviteDoc.id,
      ...data,
      expiresAt: convertTimestamp(data.expiresAt),
      createdAt: convertTimestamp(data.createdAt),
    } as AdminInvite;
  } catch (error: any) {
    console.error('Error getting admin invite:', error);
    throw new Error(error.message || 'Failed to get admin invite');
  }
};

// Get all invites
export const getAllAdminInvites = async (): Promise<AdminInvite[]> => {
  try {
    const invitesRef = collection(db, 'invites');
    const q = query(invitesRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);

    const invites: AdminInvite[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      invites.push({
        id: doc.id,
        ...data,
        expiresAt: convertTimestamp(data.expiresAt),
        createdAt: convertTimestamp(data.createdAt),
      } as AdminInvite);
    });

    return invites;
  } catch (error: any) {
    console.error('Error getting all admin invites:', error);
    throw new Error(error.message || 'Failed to get all admin invites');
  }
};

// Get invites by season
export const getAdminInvitesBySeason = async (seasonId: string): Promise<AdminInvite[]> => {
  try {
    const invitesRef = collection(db, 'invites');
    const q = query(
      invitesRef,
      where('seasonId', '==', seasonId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);

    const invites: AdminInvite[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      invites.push({
        id: doc.id,
        ...data,
        expiresAt: convertTimestamp(data.expiresAt),
        createdAt: convertTimestamp(data.createdAt),
      } as AdminInvite);
    });

    return invites;
  } catch (error: any) {
    console.error('Error getting admin invites by season:', error);
    throw new Error(error.message || 'Failed to get admin invites by season');
  }
};

// Validate invite code
export const validateAdminInvite = async (code: string): Promise<{
  valid: boolean;
  invite?: AdminInvite;
  error?: string;
}> => {
  try {
    const invite = await getAdminInviteByCode(code);

    if (!invite) {
      return { valid: false, error: 'Invalid invite code' };
    }

    if (!invite.isActive) {
      return { valid: false, error: 'This invite has been deactivated' };
    }

    if (invite.usedCount >= invite.maxUses) {
      return { valid: false, error: 'This invite has reached its maximum uses' };
    }

    if (new Date() > invite.expiresAt) {
      return { valid: false, error: 'This invite has expired' };
    }

    return { valid: true, invite };
  } catch (error: any) {
    console.error('Error validating admin invite:', error);
    return { valid: false, error: 'Failed to validate invite code' };
  }
};

// Use an invite (called after user registration)
export const useAdminInvite = async (
  code: string,
  userId: string,
  username: string,
  email: string
): Promise<void> => {
  try {
    // Validate invite first
    const validation = await validateAdminInvite(code);
    if (!validation.valid || !validation.invite) {
      throw new Error(validation.error || 'Invalid invite');
    }

    // Check if user already used this invite
    if (validation.invite.usedBy.includes(userId)) {
      throw new Error('You have already used this invite');
    }

    const inviteRef = doc(db, 'invites', code);

    // Update invite usage
    await updateDoc(inviteRef, {
      usedCount: increment(1),
      usedBy: arrayUnion(userId),
    });

    // Record invite usage
    const usageRef = doc(collection(db, 'inviteUsages'));
    const usage: Omit<InviteUsage, 'id'> = {
      inviteId: code,
      inviteCode: code,
      userId,
      username,
      email,
      usedAt: serverTimestamp() as any,
      seasonId: validation.invite.seasonId,
      seasonName: validation.invite.seasonName,
    };

    await setDoc(usageRef, usage);

    // If invite reached max uses, deactivate it
    if (validation.invite.usedCount + 1 >= validation.invite.maxUses) {
      await updateDoc(inviteRef, {
        isActive: false,
      });
    }
  } catch (error: any) {
    console.error('Error using admin invite:', error);
    throw new Error(error.message || 'Failed to use admin invite');
  }
};

// Delete invite
export const deleteAdminInvite = async (code: string): Promise<void> => {
  try {
    const inviteRef = doc(db, 'invites', code);
    await deleteDoc(inviteRef);
  } catch (error: any) {
    console.error('Error deleting admin invite:', error);
    throw new Error(error.message || 'Failed to delete admin invite');
  }
};

// Deactivate invite
export const deactivateAdminInvite = async (code: string): Promise<void> => {
  try {
    const inviteRef = doc(db, 'invites', code);
    await updateDoc(inviteRef, {
      isActive: false,
    });
  } catch (error: any) {
    console.error('Error deactivating admin invite:', error);
    throw new Error(error.message || 'Failed to deactivate admin invite');
  }
};

// Get invite usages
export const getInviteUsages = async (inviteCode: string): Promise<InviteUsage[]> => {
  try {
    const usagesRef = collection(db, 'inviteUsages');
    const q = query(
      usagesRef,
      where('inviteCode', '==', inviteCode),
      orderBy('usedAt', 'desc')
    );
    const querySnapshot = await getDocs(q);

    const usages: InviteUsage[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      usages.push({
        ...data,
        usedAt: convertTimestamp(data.usedAt),
      } as InviteUsage);
    });

    return usages;
  } catch (error: any) {
    console.error('Error getting invite usages:', error);
    throw new Error(error.message || 'Failed to get invite usages');
  }
};

// Get committee admins by season
export const getCommitteeAdminsBySeason = async (seasonId: string): Promise<any[]> => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('role', '==', 'committee_admin'),
      where('seasonId', '==', seasonId)
    );
    const querySnapshot = await getDocs(q);

    const admins: any[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      admins.push({
        uid: doc.id,
        ...data,
        createdAt: convertTimestamp(data.createdAt),
        updatedAt: convertTimestamp(data.updatedAt),
      });
    });

    return admins;
  } catch (error: any) {
    console.error('Error getting committee admins by season:', error);
    throw new Error(error.message || 'Failed to get committee admins');
  }
};
