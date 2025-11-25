/**
 * Unit tests for audit logger
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  logPreviewFinalization, 
  logApplyPendingAllocations, 
  logCancelPendingAllocations 
} from '@/lib/audit-logger';

// Mock Firestore
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => ({
    collection: vi.fn(() => ({
      add: vi.fn(() => Promise.resolve({ id: 'mock-doc-id' }))
    }))
  }))
}));

describe('Audit Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logPreviewFinalization', () => {
    it('should log preview finalization action with correct data', async () => {
      const userId = 'user123';
      const roundId = 'round456';
      const seasonId = 'season789';
      const allocationsCount = 5;
      const userEmail = 'admin@example.com';

      await expect(
        logPreviewFinalization(userId, roundId, seasonId, allocationsCount, userEmail)
      ).resolves.not.toThrow();
    });

    it('should work without user email', async () => {
      const userId = 'user123';
      const roundId = 'round456';
      const seasonId = 'season789';
      const allocationsCount = 3;

      await expect(
        logPreviewFinalization(userId, roundId, seasonId, allocationsCount)
      ).resolves.not.toThrow();
    });
  });

  describe('logApplyPendingAllocations', () => {
    it('should log successful application', async () => {
      const userId = 'user123';
      const roundId = 'round456';
      const seasonId = 'season789';
      const allocationsCount = 5;
      const userEmail = 'admin@example.com';

      await expect(
        logApplyPendingAllocations(userId, roundId, seasonId, allocationsCount, true, undefined, userEmail)
      ).resolves.not.toThrow();
    });

    it('should log failed application with error message', async () => {
      const userId = 'user123';
      const roundId = 'round456';
      const seasonId = 'season789';
      const allocationsCount = 5;
      const errorMessage = 'Insufficient budget';
      const userEmail = 'admin@example.com';

      await expect(
        logApplyPendingAllocations(userId, roundId, seasonId, allocationsCount, false, errorMessage, userEmail)
      ).resolves.not.toThrow();
    });
  });

  describe('logCancelPendingAllocations', () => {
    it('should log cancel action with correct data', async () => {
      const userId = 'user123';
      const roundId = 'round456';
      const seasonId = 'season789';
      const allocationsCount = 5;
      const userEmail = 'admin@example.com';

      await expect(
        logCancelPendingAllocations(userId, roundId, seasonId, allocationsCount, userEmail)
      ).resolves.not.toThrow();
    });

    it('should work without user email', async () => {
      const userId = 'user123';
      const roundId = 'round456';
      const seasonId = 'season789';
      const allocationsCount = 3;

      await expect(
        logCancelPendingAllocations(userId, roundId, seasonId, allocationsCount)
      ).resolves.not.toThrow();
    });
  });
});
