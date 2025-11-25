/**
 * Audit Logger
 * 
 * Centralized system to log administrative actions for compliance and security
 * Logs committee admin actions like finalization previews, applications, and cancellations
 */

import { getFirestore } from 'firebase-admin/firestore';

export type AuditActionType = 
  | 'preview_finalization'      // Committee previewed finalization results
  | 'apply_pending_allocations' // Committee applied pending allocations
  | 'cancel_pending_allocations'// Committee canceled pending allocations
  | 'finalize_immediately'      // Committee finalized round immediately (skip preview)
  | 'create_round'              // Committee created auction round
  | 'update_round'              // Committee updated auction round
  | 'delete_round';             // Committee deleted auction round

export interface AuditLogData {
  action_type: AuditActionType;
  user_id: string;
  user_email?: string;
  resource_type: 'round' | 'season' | 'team' | 'player';
  resource_id: string;
  season_id?: string;
  description: string;
  metadata?: {
    round_id?: string;
    allocations_count?: number;
    success?: boolean;
    error_message?: string;
    [key: string]: any;
  };
}

/**
 * Log an administrative action to Firestore
 */
export async function logAuditAction(data: AuditLogData): Promise<void> {
  try {
    const db = getFirestore();
    
    // Filter out undefined values from metadata
    const cleanMetadata = data.metadata ? 
      Object.fromEntries(
        Object.entries(data.metadata).filter(([_, v]) => v !== undefined)
      ) : {};
    
    await db.collection('audit_logs').add({
      ...data,
      metadata: Object.keys(cleanMetadata).length > 0 ? cleanMetadata : undefined,
      timestamp: new Date(),
      created_at: new Date(),
    });
    
    console.log(`📋 Audit logged: ${data.action_type} by ${data.user_id} on ${data.resource_type} ${data.resource_id}`);
  } catch (error) {
    console.error('❌ Failed to log audit action:', error);
    // Don't throw - audit logging should not block main operation
  }
}

/**
 * Log preview finalization action
 */
export async function logPreviewFinalization(
  userId: string,
  roundId: string,
  seasonId: string,
  allocationsCount: number,
  userEmail?: string
): Promise<void> {
  await logAuditAction({
    action_type: 'preview_finalization',
    user_id: userId,
    user_email: userEmail,
    resource_type: 'round',
    resource_id: roundId,
    season_id: seasonId,
    description: `Previewed finalization for round ${roundId} - ${allocationsCount} allocation(s) created`,
    metadata: {
      round_id: roundId,
      allocations_count: allocationsCount,
      success: true,
    }
  });
}

/**
 * Log apply pending allocations action
 */
export async function logApplyPendingAllocations(
  userId: string,
  roundId: string,
  seasonId: string,
  allocationsCount: number,
  success: boolean,
  errorMessage?: string,
  userEmail?: string
): Promise<void> {
  await logAuditAction({
    action_type: 'apply_pending_allocations',
    user_id: userId,
    user_email: userEmail,
    resource_type: 'round',
    resource_id: roundId,
    season_id: seasonId,
    description: success 
      ? `Applied ${allocationsCount} pending allocation(s) for round ${roundId}`
      : `Failed to apply pending allocations for round ${roundId}: ${errorMessage}`,
    metadata: {
      round_id: roundId,
      allocations_count: allocationsCount,
      success,
      error_message: errorMessage,
    }
  });
}

/**
 * Log cancel pending allocations action
 */
export async function logCancelPendingAllocations(
  userId: string,
  roundId: string,
  seasonId: string,
  allocationsCount: number,
  userEmail?: string
): Promise<void> {
  await logAuditAction({
    action_type: 'cancel_pending_allocations',
    user_id: userId,
    user_email: userEmail,
    resource_type: 'round',
    resource_id: roundId,
    season_id: seasonId,
    description: `Canceled ${allocationsCount} pending allocation(s) for round ${roundId}`,
    metadata: {
      round_id: roundId,
      allocations_count: allocationsCount,
      success: true,
    }
  });
}
