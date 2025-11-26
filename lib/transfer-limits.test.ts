/**
 * Unit Tests for Transfer Limit Tracking and Validation
 * 
 * Tests the transfer limit enforcement system including status checks,
 * validation, and counter incrementation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getTransferLimitStatus,
  validateTransferLimit,
  validateMultipleTeamLimits,
  incrementTransferCount,
  resetTransferCount,
  getMultipleTeamLimitStatuses,
  MAX_TRANSFERS_PER_SEASON,
  type TransferLimitStatus,
  type TransferLimitValidation
} from './transfer-limits';

// Mock Firebase Admin
vi.mock('./firebase/admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      where: vi.fn(() => ({
        get: vi.fn()
      })),
      doc: vi.fn(() => ({
        get: vi.fn(),
        update: vi.fn()
      }))
    })),
    FieldValue: {
      serverTimestamp: vi.fn(() => new Date())
    }
  }
}));

describe('Transfer Limit Tracking', () => {
  describe('getTransferLimitStatus', () => {
    it('should return correct status when no transfers have been made', async () => {
      const { adminDb } = await import('./firebase/admin');
      const mockGet = vi.fn().mockResolvedValue({
        docs: []
      });
      
      vi.mocked(adminDb.collection).mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: mockGet
        })
      } as any);

      const status = await getTransferLimitStatus('SSPSLT0001', 'SSPSLS16');

      expect(status).toEqual({
        teamId: 'SSPSLT0001',
        seasonId: 'SSPSLS16',
        transfersUsed: 0,
        transfersRemaining: 2,
        canTransfer: true
      });
    });

    it('should return correct status when 1 transfer has been made', async () => {
      const { adminDb } = await import('./firebase/admin');
      const mockGet = vi.fn().mockResolvedValue({
        docs: [
          {
            id: 'trans1',
            data: () => ({
              transaction_type: 'transfer',
              season_id: 'SSPSLS16',
              old_team_id: 'SSPSLT0001',
              new_team_id: 'SSPSLT0002'
            })
          }
        ]
      });
      
      vi.mocked(adminDb.collection).mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: mockGet
        })
      } as any);

      const status = await getTransferLimitStatus('SSPSLT0001', 'SSPSLS16');

      expect(status.transfersUsed).toBe(1);
      expect(status.transfersRemaining).toBe(1);
      expect(status.canTransfer).toBe(true);
    });

    it('should return correct status when limit is reached', async () => {
      const { adminDb } = await import('./firebase/admin');
      const mockGet = vi.fn().mockResolvedValue({
        docs: [
          {
            id: 'trans1',
            data: () => ({
              transaction_type: 'transfer',
              season_id: 'SSPSLS16',
              old_team_id: 'SSPSLT0001',
              new_team_id: 'SSPSLT0002'
            })
          },
          {
            id: 'trans2',
            data: () => ({
              transaction_type: 'swap',
              season_id: 'SSPSLS16',
              team_a_id: 'SSPSLT0001',
              team_b_id: 'SSPSLT0003'
            })
          }
        ]
      });
      
      vi.mocked(adminDb.collection).mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: mockGet
        })
      } as any);

      const status = await getTransferLimitStatus('SSPSLT0001', 'SSPSLS16');

      expect(status.transfersUsed).toBe(2);
      expect(status.transfersRemaining).toBe(0);
      expect(status.canTransfer).toBe(false);
    });

    it('should count releases as transfers', async () => {
      const { adminDb } = await import('./firebase/admin');
      const mockGet = vi.fn().mockResolvedValue({
        docs: [
          {
            id: 'trans1',
            data: () => ({
              transaction_type: 'release',
              season_id: 'SSPSLS16',
              old_team_id: 'SSPSLT0001'
            })
          }
        ]
      });
      
      vi.mocked(adminDb.collection).mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: mockGet
        })
      } as any);

      const status = await getTransferLimitStatus('SSPSLT0001', 'SSPSLS16');

      expect(status.transfersUsed).toBe(1);
      expect(status.canTransfer).toBe(true);
    });

    it('should not count transactions from other teams', async () => {
      const { adminDb } = await import('./firebase/admin');
      const mockGet = vi.fn().mockResolvedValue({
        docs: [
          {
            id: 'trans1',
            data: () => ({
              transaction_type: 'transfer',
              season_id: 'SSPSLS16',
              old_team_id: 'SSPSLT0002',
              new_team_id: 'SSPSLT0003'
            })
          }
        ]
      });
      
      vi.mocked(adminDb.collection).mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: mockGet
        })
      } as any);

      const status = await getTransferLimitStatus('SSPSLT0001', 'SSPSLS16');

      expect(status.transfersUsed).toBe(0);
      expect(status.canTransfer).toBe(true);
    });
  });

  describe('validateTransferLimit', () => {
    it('should return valid when team has remaining slots', async () => {
      const { adminDb } = await import('./firebase/admin');
      const mockGet = vi.fn().mockResolvedValue({
        docs: []
      });
      
      vi.mocked(adminDb.collection).mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: mockGet
        })
      } as any);

      const validation = await validateTransferLimit('SSPSLT0001', 'SSPSLS16');

      expect(validation.valid).toBe(true);
      expect(validation.status?.canTransfer).toBe(true);
    });

    it('should return invalid with message when limit is exceeded', async () => {
      const { adminDb } = await import('./firebase/admin');
      const mockGet = vi.fn().mockResolvedValue({
        docs: [
          {
            id: 'trans1',
            data: () => ({
              transaction_type: 'transfer',
              season_id: 'SSPSLS16',
              old_team_id: 'SSPSLT0001',
              new_team_id: 'SSPSLT0002'
            })
          },
          {
            id: 'trans2',
            data: () => ({
              transaction_type: 'transfer',
              season_id: 'SSPSLS16',
              old_team_id: 'SSPSLT0001',
              new_team_id: 'SSPSLT0003'
            })
          }
        ]
      });
      
      vi.mocked(adminDb.collection).mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: mockGet
        })
      } as any);

      const validation = await validateTransferLimit('SSPSLT0001', 'SSPSLS16');

      expect(validation.valid).toBe(false);
      expect(validation.message).toContain('used all 2 transfer slots');
      expect(validation.status?.canTransfer).toBe(false);
    });
  });

  describe('validateMultipleTeamLimits', () => {
    it('should return valid when all teams have remaining slots', async () => {
      const { adminDb } = await import('./firebase/admin');
      const mockGet = vi.fn().mockResolvedValue({
        docs: []
      });
      
      vi.mocked(adminDb.collection).mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: mockGet
        })
      } as any);

      const validation = await validateMultipleTeamLimits(
        ['SSPSLT0001', 'SSPSLT0002'],
        'SSPSLS16'
      );

      expect(validation.valid).toBe(true);
    });

    it('should return invalid if any team has exceeded limit', async () => {
      const { adminDb } = await import('./firebase/admin');
      
      let callCount = 0;
      const mockGet = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First team has no transfers
          return Promise.resolve({ docs: [] });
        } else {
          // Second team has 2 transfers
          return Promise.resolve({
            docs: [
              {
                id: 'trans1',
                data: () => ({
                  transaction_type: 'transfer',
                  season_id: 'SSPSLS16',
                  old_team_id: 'SSPSLT0002',
                  new_team_id: 'SSPSLT0003'
                })
              },
              {
                id: 'trans2',
                data: () => ({
                  transaction_type: 'transfer',
                  season_id: 'SSPSLS16',
                  old_team_id: 'SSPSLT0002',
                  new_team_id: 'SSPSLT0004'
                })
              }
            ]
          });
        }
      });
      
      vi.mocked(adminDb.collection).mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: mockGet
        })
      } as any);

      const validation = await validateMultipleTeamLimits(
        ['SSPSLT0001', 'SSPSLT0002'],
        'SSPSLS16'
      );

      expect(validation.valid).toBe(false);
      expect(validation.message).toContain('used all 2 transfer slots');
    });
  });

  describe('incrementTransferCount', () => {
    it('should increment transfer count from 0 to 1', async () => {
      const { adminDb } = await import('./firebase/admin');
      
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const mockGet = vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({ transfer_count: 0 })
      });
      
      vi.mocked(adminDb.collection).mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: mockGet,
          update: mockUpdate
        })
      } as any);

      const newCount = await incrementTransferCount('SSPSLT0001', 'SSPSLS16');

      expect(newCount).toBe(1);
      expect(mockUpdate).toHaveBeenCalledWith({
        transfer_count: 1,
        updated_at: expect.any(Date)
      });
    });

    it('should increment transfer count from 1 to 2', async () => {
      const { adminDb } = await import('./firebase/admin');
      
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const mockGet = vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({ transfer_count: 1 })
      });
      
      vi.mocked(adminDb.collection).mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: mockGet,
          update: mockUpdate
        })
      } as any);

      const newCount = await incrementTransferCount('SSPSLT0001', 'SSPSLS16');

      expect(newCount).toBe(2);
      expect(mockUpdate).toHaveBeenCalledWith({
        transfer_count: 2,
        updated_at: expect.any(Date)
      });
    });

    it('should handle missing transfer_count field', async () => {
      const { adminDb } = await import('./firebase/admin');
      
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const mockGet = vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({}) // No transfer_count field
      });
      
      vi.mocked(adminDb.collection).mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: mockGet,
          update: mockUpdate
        })
      } as any);

      const newCount = await incrementTransferCount('SSPSLT0001', 'SSPSLS16');

      expect(newCount).toBe(1);
    });

    it('should throw error if document does not exist', async () => {
      const { adminDb } = await import('./firebase/admin');
      
      const mockGet = vi.fn().mockResolvedValue({
        exists: false
      });
      
      vi.mocked(adminDb.collection).mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: mockGet
        })
      } as any);

      await expect(
        incrementTransferCount('SSPSLT0001', 'SSPSLS16')
      ).rejects.toThrow('Team season document not found');
    });
  });

  describe('resetTransferCount', () => {
    it('should reset transfer count to 0', async () => {
      const { adminDb } = await import('./firebase/admin');
      
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      
      vi.mocked(adminDb.collection).mockReturnValue({
        doc: vi.fn().mockReturnValue({
          update: mockUpdate
        })
      } as any);

      await resetTransferCount('SSPSLT0001', 'SSPSLS16');

      expect(mockUpdate).toHaveBeenCalledWith({
        transfer_count: 0,
        updated_at: expect.any(Date)
      });
    });
  });

  describe('getMultipleTeamLimitStatuses', () => {
    it('should return statuses for multiple teams', async () => {
      const { adminDb } = await import('./firebase/admin');
      const mockGet = vi.fn().mockResolvedValue({
        docs: []
      });
      
      vi.mocked(adminDb.collection).mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: mockGet
        })
      } as any);

      const statuses = await getMultipleTeamLimitStatuses(
        ['SSPSLT0001', 'SSPSLT0002'],
        'SSPSLS16'
      );

      expect(statuses).toHaveLength(2);
      expect(statuses[0].teamId).toBe('SSPSLT0001');
      expect(statuses[1].teamId).toBe('SSPSLT0002');
    });
  });

  describe('Constants', () => {
    it('should have correct MAX_TRANSFERS_PER_SEASON value', () => {
      expect(MAX_TRANSFERS_PER_SEASON).toBe(2);
    });
  });
});
