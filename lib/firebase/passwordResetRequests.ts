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
} from 'firebase/firestore';
import { db } from './config';
import {
  PasswordResetRequest,
  CreatePasswordResetRequestData,
  ApproveResetRequestData,
  RejectResetRequestData,
} from '@/types/passwordResetRequest';
import { nanoid } from 'nanoid';

// Convert Firestore timestamp to Date
const convertTimestamp = (timestamp: unknown): Date => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }
  if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
    return (timestamp as Timestamp).toDate();
  }
  return new Date();
};

// Generate unique reset token
const generateResetToken = (): string => {
  return nanoid(32); // 32 character unique token
};

// Create a new password reset request
export const createPasswordResetRequest = async (
  requestData: CreatePasswordResetRequestData
): Promise<PasswordResetRequest> => {
  try {
    // Check if user already has a pending request
    const existingRequest = await getPendingRequestByUserId(requestData.userId);
    if (existingRequest) {
      throw new Error('You already have a pending password reset request');
    }

    const requestRef = doc(collection(db, 'passwordResetRequests'));
    
    const newRequest = {
      userId: requestData.userId,
      userEmail: requestData.userEmail,
      username: requestData.username,
      teamName: requestData.teamName || null,
      reason: requestData.reason || null,
      status: 'pending',
      requestedAt: serverTimestamp(),
    };

    await setDoc(requestRef, newRequest);

    // Fetch and return the created request
    const createdRequest = await getPasswordResetRequest(requestRef.id);
    if (!createdRequest) {
      throw new Error('Failed to fetch created request');
    }

    return createdRequest;
  } catch (error) {
    console.error('Error creating password reset request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create password reset request';
    throw new Error(errorMessage);
  }
};

// Get a password reset request by ID
export const getPasswordResetRequest = async (
  requestId: string
): Promise<PasswordResetRequest | null> => {
  try {
    const requestRef = doc(db, 'passwordResetRequests', requestId);
    const requestDoc = await getDoc(requestRef);

    if (!requestDoc.exists()) {
      return null;
    }

    const data = requestDoc.data();
    return {
      id: requestDoc.id,
      ...data,
      requestedAt: convertTimestamp(data.requestedAt),
      reviewedAt: data.reviewedAt ? convertTimestamp(data.reviewedAt) : undefined,
      resetLinkExpiresAt: data.resetLinkExpiresAt ? convertTimestamp(data.resetLinkExpiresAt) : undefined,
      completedAt: data.completedAt ? convertTimestamp(data.completedAt) : undefined,
    } as PasswordResetRequest;
  } catch (error) {
    console.error('Error getting password reset request:', error);
    throw new Error('Failed to get password reset request');
  }
};

// Get a pending request by user ID
export const getPendingRequestByUserId = async (
  userId: string
): Promise<PasswordResetRequest | null> => {
  try {
    const requestsRef = collection(db, 'passwordResetRequests');
    const q = query(
      requestsRef,
      where('userId', '==', userId),
      where('status', '==', 'pending')
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const data = querySnapshot.docs[0].data();
    return {
      id: querySnapshot.docs[0].id,
      ...data,
      requestedAt: convertTimestamp(data.requestedAt),
      reviewedAt: data.reviewedAt ? convertTimestamp(data.reviewedAt) : undefined,
      resetLinkExpiresAt: data.resetLinkExpiresAt ? convertTimestamp(data.resetLinkExpiresAt) : undefined,
      completedAt: data.completedAt ? convertTimestamp(data.completedAt) : undefined,
    } as PasswordResetRequest;
  } catch (error) {
    console.error('Error getting pending request:', error);
    return null;
  }
};

// Get all password reset requests (for super admin)
export const getAllPasswordResetRequests = async (): Promise<PasswordResetRequest[]> => {
  try {
    const requestsRef = collection(db, 'passwordResetRequests');
    const q = query(requestsRef, orderBy('requestedAt', 'desc'));
    const querySnapshot = await getDocs(q);

    const requests: PasswordResetRequest[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      requests.push({
        id: doc.id,
        ...data,
        requestedAt: convertTimestamp(data.requestedAt),
        reviewedAt: data.reviewedAt ? convertTimestamp(data.reviewedAt) : undefined,
        resetLinkExpiresAt: data.resetLinkExpiresAt ? convertTimestamp(data.resetLinkExpiresAt) : undefined,
        completedAt: data.completedAt ? convertTimestamp(data.completedAt) : undefined,
      } as PasswordResetRequest);
    });

    return requests;
  } catch (error) {
    console.error('Error getting all password reset requests:', error);
    throw new Error('Failed to get password reset requests');
  }
};

// Get pending password reset requests
export const getPendingResetRequests = async (): Promise<PasswordResetRequest[]> => {
  try {
    const requestsRef = collection(db, 'passwordResetRequests');
    const q = query(
      requestsRef,
      where('status', '==', 'pending'),
      orderBy('requestedAt', 'desc')
    );
    const querySnapshot = await getDocs(q);

    const requests: PasswordResetRequest[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      requests.push({
        id: doc.id,
        ...data,
        requestedAt: convertTimestamp(data.requestedAt),
        reviewedAt: data.reviewedAt ? convertTimestamp(data.reviewedAt) : undefined,
        resetLinkExpiresAt: data.resetLinkExpiresAt ? convertTimestamp(data.resetLinkExpiresAt) : undefined,
        completedAt: data.completedAt ? convertTimestamp(data.completedAt) : undefined,
      } as PasswordResetRequest);
    });

    return requests;
  } catch (error) {
    console.error('Error getting pending reset requests:', error);
    throw new Error('Failed to get pending reset requests');
  }
};

// Approve a password reset request (Super admin only)
export const approveResetRequest = async (
  requestId: string,
  approvalData: ApproveResetRequestData
): Promise<string> => {
  try {
    const requestRef = doc(db, 'passwordResetRequests', requestId);
    const requestDoc = await getDoc(requestRef);

    if (!requestDoc.exists()) {
      throw new Error('Request not found');
    }

    const resetToken = generateResetToken();
    const expiresAt = approvalData.resetLinkExpiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours default
    const resetLink = `${window.location.origin}/reset-password?token=${resetToken}`;

    await updateDoc(requestRef, {
      status: 'approved',
      reviewedBy: approvalData.reviewedBy,
      reviewedAt: serverTimestamp(),
      adminNotes: approvalData.adminNotes || null,
      resetToken: resetToken,
      resetLink: resetLink,
      resetLinkExpiresAt: expiresAt,
    });

    return resetLink;
  } catch (error) {
    console.error('Error approving reset request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to approve reset request';
    throw new Error(errorMessage);
  }
};

// Reject a password reset request (Super admin only)
export const rejectResetRequest = async (
  requestId: string,
  rejectionData: RejectResetRequestData
): Promise<void> => {
  try {
    const requestRef = doc(db, 'passwordResetRequests', requestId);
    const requestDoc = await getDoc(requestRef);

    if (!requestDoc.exists()) {
      throw new Error('Request not found');
    }

    await updateDoc(requestRef, {
      status: 'rejected',
      reviewedBy: rejectionData.reviewedBy,
      reviewedAt: serverTimestamp(),
      adminNotes: rejectionData.adminNotes,
    });
  } catch (error) {
    console.error('Error rejecting reset request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to reject reset request';
    throw new Error(errorMessage);
  }
};

// Mark a reset request as completed (when password is actually reset)
export const completeResetRequest = async (resetToken: string): Promise<void> => {
  try {
    const requestsRef = collection(db, 'passwordResetRequests');
    const q = query(requestsRef, where('resetToken', '==', resetToken));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      throw new Error('Invalid reset token');
    }

    const requestRef = doc(db, 'passwordResetRequests', querySnapshot.docs[0].id);
    await updateDoc(requestRef, {
      status: 'completed',
      completedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error completing reset request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to complete reset request';
    throw new Error(errorMessage);
  }
};

// Validate reset token
export const validateResetToken = async (
  resetToken: string
): Promise<PasswordResetRequest | null> => {
  try {
    const requestsRef = collection(db, 'passwordResetRequests');
    const q = query(
      requestsRef,
      where('resetToken', '==', resetToken),
      where('status', '==', 'approved')
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const data = querySnapshot.docs[0].data();
    const request = {
      id: querySnapshot.docs[0].id,
      ...data,
      requestedAt: convertTimestamp(data.requestedAt),
      reviewedAt: data.reviewedAt ? convertTimestamp(data.reviewedAt) : undefined,
      resetLinkExpiresAt: data.resetLinkExpiresAt ? convertTimestamp(data.resetLinkExpiresAt) : undefined,
      completedAt: data.completedAt ? convertTimestamp(data.completedAt) : undefined,
    } as PasswordResetRequest;

    // Check if token is expired
    if (request.resetLinkExpiresAt && request.resetLinkExpiresAt < new Date()) {
      return null;
    }

    return request;
  } catch (error) {
    console.error('Error validating reset token:', error);
    return null;
  }
};

// Delete a password reset request
export const deleteResetRequest = async (requestId: string): Promise<void> => {
  try {
    const requestRef = doc(db, 'passwordResetRequests', requestId);
    await deleteDoc(requestRef);
  } catch (error) {
    console.error('Error deleting reset request:', error);
    throw new Error('Failed to delete reset request');
  }
};
