/**
 * Unit tests for committee fee reporting functions
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  getCommitteeFeesBySeason,
  getCommitteeFeesByTeam,
  getCommitteeFeeBreakdown,
  CommitteeFeesBySeason,
  CommitteeFeesByTeam,
  CommitteeFeeBreakdown
} from '../lib/committee-fee-reports';

// Mock Firebase admin
vi.mock('../lib/firebase/admin', () => ({
  adminDb: {
    collection: vi.fn()
  }
}));

describe('Committee Fee Reports', () => {
  describe('getCommitteeFeesBySeason', () => {
    test('calculates total fees from transfers and swaps', async () => {
      const { adminDb } = await import('../lib/firebase/admin');
      
      // Mock Firestore data
      const mockTransactions = [
        {
          id: 'trans1',
          data: () => ({
            transaction_type: 'transfer',
            season_id: 'SSPSLS16',
            committee_fee: 28.13
          })
        },
        {
          id: 'trans2',
          data: () => ({
            transaction_type: 'transfer',
            season_id: 'SSPSLS16',
            committee_fee: 35.50
          })
        },
        {
          id: 'swap1',
          data: () => ({
            transaction_type: 'swap',
            season_id: 'SSPSLS16',
            total_committee_fees: 110
          })
        }
      ];
      
      const mockSnapshot = {
        forEach: (callback: any) => mockTransactions.forEach(callback)
      };
      
      const mockGet = vi.fn().mockResolvedValue(mockSnapshot);
      const mockWhere = vi.fn().mockReturnValue({ get: mockGet });
      const mockCollection = vi.fn().mockReturnValue({ where: mockWhere });
      
      (adminDb.collection as any) = mockCollection;
      
      const result = await getCommitteeFeesBySeason('SSPSLS16');
      
      expect(result.seasonId).toBe('SSPSLS16');
      expect(result.totalTransferFees).toBe(63.63);
      expect(result.totalSwapFees).toBe(110);
      expect(result.totalFees).toBe(173.63);
      expect(result.transferCount).toBe(2);
      expect(result.swapCount).toBe(1);
    });
    
    test('returns zero fees when no transactions exist', async () => {
      const { adminDb } = await import('../lib/firebase/admin');
      
      const mockSnapshot = {
        forEach: (callback: any) => {}
      };
      
      const mockGet = vi.fn().mockResolvedValue(mockSnapshot);
      const mockWhere = vi.fn().mockReturnValue({ get: mockGet });
      const mockCollection = vi.fn().mockReturnValue({ where: mockWhere });
      
      (adminDb.collection as any) = mockCollection;
      
      const result = await getCommitteeFeesBySeason('SSPSLS17');
      
      expect(result.totalFees).toBe(0);
      expect(result.transferCount).toBe(0);
      expect(result.swapCount).toBe(0);
    });
    
    test('handles missing committee_fee fields gracefully', async () => {
      const { adminDb } = await import('../lib/firebase/admin');
      
      const mockTransactions = [
        {
          id: 'trans1',
          data: () => ({
            transaction_type: 'transfer',
            season_id: 'SSPSLS16'
            // Missing committee_fee
          })
        }
      ];
      
      const mockSnapshot = {
        forEach: (callback: any) => mockTransactions.forEach(callback)
      };
      
      const mockGet = vi.fn().mockResolvedValue(mockSnapshot);
      const mockWhere = vi.fn().mockReturnValue({ get: mockGet });
      const mockCollection = vi.fn().mockReturnValue({ where: mockWhere });
      
      (adminDb.collection as any) = mockCollection;
      
      const result = await getCommitteeFeesBySeason('SSPSLS16');
      
      expect(result.totalTransferFees).toBe(0);
      expect(result.transferCount).toBe(1);
    });
  });
  
  describe('getCommitteeFeesByTeam', () => {
    test('aggregates fees by team correctly', async () => {
      const { adminDb } = await import('../lib/firebase/admin');
      
      const mockTransactions = [
        {
          id: 'trans1',
          data: () => ({
            transaction_type: 'transfer',
            season_id: 'SSPSLS16',
            new_team_id: 'SSPSLT0001',
            committee_fee: 28.13
          })
        },
        {
          id: 'trans2',
          data: () => ({
            transaction_type: 'transfer',
            season_id: 'SSPSLS16',
            new_team_id: 'SSPSLT0001',
            committee_fee: 35.50
          })
        },
        {
          id: 'swap1',
          data: () => ({
            transaction_type: 'swap',
            season_id: 'SSPSLS16',
            team_a_id: 'SSPSLT0001',
            team_b_id: 'SSPSLT0002',
            team_a_fee: 50,
            team_b_fee: 60,
            total_committee_fees: 110
          })
        }
      ];
      
      const mockSnapshot = {
        forEach: (callback: any) => mockTransactions.forEach(callback)
      };
      
      const mockGet = vi.fn().mockResolvedValue(mockSnapshot);
      const mockWhere = vi.fn().mockReturnValue({ get: mockGet });
      const mockCollection = vi.fn().mockReturnValue({ where: mockWhere });
      
      (adminDb.collection as any) = mockCollection;
      
      const result = await getCommitteeFeesByTeam('SSPSLS16');
      
      expect(result).toHaveLength(2);
      
      // Team 1 should have highest fees (2 transfers + 1 swap)
      const team1 = result.find(t => t.teamId === 'SSPSLT0001');
      expect(team1).toBeDefined();
      expect(team1!.transferFeesPaid).toBe(63.63);
      expect(team1!.swapFeesPaid).toBe(50);
      expect(team1!.totalFeesPaid).toBe(113.63);
      expect(team1!.transferCount).toBe(2);
      expect(team1!.swapCount).toBe(1);
      
      // Team 2 should have only swap fees
      const team2 = result.find(t => t.teamId === 'SSPSLT0002');
      expect(team2).toBeDefined();
      expect(team2!.transferFeesPaid).toBe(0);
      expect(team2!.swapFeesPaid).toBe(60);
      expect(team2!.totalFeesPaid).toBe(60);
      expect(team2!.swapCount).toBe(1);
    });
    
    test('sorts teams by total fees paid descending', async () => {
      const { adminDb } = await import('../lib/firebase/admin');
      
      const mockTransactions = [
        {
          id: 'trans1',
          data: () => ({
            transaction_type: 'transfer',
            season_id: 'SSPSLS16',
            new_team_id: 'SSPSLT0001',
            committee_fee: 10
          })
        },
        {
          id: 'trans2',
          data: () => ({
            transaction_type: 'transfer',
            season_id: 'SSPSLS16',
            new_team_id: 'SSPSLT0002',
            committee_fee: 50
          })
        }
      ];
      
      const mockSnapshot = {
        forEach: (callback: any) => mockTransactions.forEach(callback)
      };
      
      const mockGet = vi.fn().mockResolvedValue(mockSnapshot);
      const mockWhere = vi.fn().mockReturnValue({ get: mockGet });
      const mockCollection = vi.fn().mockReturnValue({ where: mockWhere });
      
      (adminDb.collection as any) = mockCollection;
      
      const result = await getCommitteeFeesByTeam('SSPSLS16');
      
      expect(result[0].teamId).toBe('SSPSLT0002');
      expect(result[0].totalFeesPaid).toBe(50);
      expect(result[1].teamId).toBe('SSPSLT0001');
      expect(result[1].totalFeesPaid).toBe(10);
    });
  });
  
  describe('getCommitteeFeeBreakdown', () => {
    test('provides detailed breakdown of all transactions', async () => {
      const { adminDb } = await import('../lib/firebase/admin');
      
      const mockDate = new Date('2025-01-15');
      
      const mockTransactions = [
        {
          id: 'trans1',
          data: () => ({
            transaction_type: 'transfer',
            season_id: 'SSPSLS16',
            player_name: 'John Doe',
            old_team_id: 'SSPSLT0001',
            new_team_id: 'SSPSLT0002',
            committee_fee: 28.13,
            processed_by_name: 'Admin User',
            created_at: { toDate: () => mockDate }
          })
        },
        {
          id: 'swap1',
          data: () => ({
            transaction_type: 'swap',
            season_id: 'SSPSLS16',
            player_a_name: 'Player A',
            player_b_name: 'Player B',
            team_a_id: 'SSPSLT0001',
            team_b_id: 'SSPSLT0003',
            team_a_fee: 50,
            team_b_fee: 60,
            total_committee_fees: 110,
            processed_by_name: 'Committee Admin',
            created_at: { toDate: () => mockDate }
          })
        }
      ];
      
      const mockSnapshot = {
        forEach: (callback: any) => mockTransactions.forEach(callback)
      };
      
      const mockGet = vi.fn().mockResolvedValue(mockSnapshot);
      const mockOrderBy = vi.fn().mockReturnValue({ get: mockGet });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockCollection = vi.fn().mockReturnValue({ where: mockWhere });
      
      (adminDb.collection as any) = mockCollection;
      
      const result = await getCommitteeFeeBreakdown('SSPSLS16');
      
      expect(result.seasonId).toBe('SSPSLS16');
      expect(result.totalFees).toBe(138.13);
      
      // Check transfers
      expect(result.transfers.count).toBe(1);
      expect(result.transfers.totalFees).toBe(28.13);
      expect(result.transfers.transactions).toHaveLength(1);
      expect(result.transfers.transactions[0].playerName).toBe('John Doe');
      expect(result.transfers.transactions[0].committeeFee).toBe(28.13);
      expect(result.transfers.transactions[0].processedBy).toBe('Admin User');
      
      // Check swaps
      expect(result.swaps.count).toBe(1);
      expect(result.swaps.totalFees).toBe(110);
      expect(result.swaps.transactions).toHaveLength(1);
      expect(result.swaps.transactions[0].playerAName).toBe('Player A');
      expect(result.swaps.transactions[0].playerBName).toBe('Player B');
      expect(result.swaps.transactions[0].teamAFee).toBe(50);
      expect(result.swaps.transactions[0].teamBFee).toBe(60);
      expect(result.swaps.transactions[0].totalFees).toBe(110);
    });
    
    test('handles empty transaction list', async () => {
      const { adminDb } = await import('../lib/firebase/admin');
      
      const mockSnapshot = {
        forEach: (callback: any) => {}
      };
      
      const mockGet = vi.fn().mockResolvedValue(mockSnapshot);
      const mockOrderBy = vi.fn().mockReturnValue({ get: mockGet });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockCollection = vi.fn().mockReturnValue({ where: mockWhere });
      
      (adminDb.collection as any) = mockCollection;
      
      const result = await getCommitteeFeeBreakdown('SSPSLS17');
      
      expect(result.totalFees).toBe(0);
      expect(result.transfers.count).toBe(0);
      expect(result.swaps.count).toBe(0);
      expect(result.transfers.transactions).toHaveLength(0);
      expect(result.swaps.transactions).toHaveLength(0);
    });
  });
});
