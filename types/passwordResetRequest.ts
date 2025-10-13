export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'completed';

export interface PasswordResetRequest {
  id: string; // Firestore document ID
  userId: string; // UID of the user requesting reset
  userEmail: string; // Email of the user
  username: string; // Username for display
  teamName?: string; // Team name if user is a team
  reason?: string; // Optional reason for password reset
  status: RequestStatus;
  
  // Request tracking
  requestedAt: Date;
  
  // Admin approval
  reviewedBy?: string; // UID of super admin who reviewed
  reviewedAt?: Date;
  adminNotes?: string; // Admin's notes on the request
  
  // Reset link
  resetToken?: string; // Unique token for password reset
  resetLink?: string; // Full reset link provided to user
  resetLinkExpiresAt?: Date; // Expiration time for reset link
  
  // Completion
  completedAt?: Date; // When password was actually reset
}

export interface CreatePasswordResetRequestData {
  userId: string;
  userEmail: string;
  username: string;
  teamName?: string;
  reason?: string;
}

export interface ApproveResetRequestData {
  reviewedBy: string; // UID of super admin
  adminNotes?: string;
  resetLinkExpiresAt?: Date; // Optional custom expiration
}

export interface RejectResetRequestData {
  reviewedBy: string; // UID of super admin
  adminNotes: string; // Reason for rejection
}
