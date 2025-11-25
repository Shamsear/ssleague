/**
 * Unit tests for POST /api/admin/rounds/[id]/apply-pending-allocations
 * 
 * Tests cover:
 * - Successful application
 * - Budget validation
 * - Rollback on error
 * - Authorization checks
 * 
 * Requirements: 2, 8
 * 
 * Note: These tests require proper mocking configuration for @neondatabase/serverless.
 * The neon SQL client uses tagged template literals which require special mocking setup.
 * 
 * To install test dependencies: npm install -D vitest @vitejs/plugin-react @testing-library/react
 * To run: npx vitest run tests/api/admin/rounds/apply-pending-allocations.test.ts
 * 
 * Current Status: Tests are structurally complete but require additional mock configuration
 * to handle the neon SQL client's tagged template literal syntax properly.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/admin/rounds/[id]/apply-pending-allocations/route';

// Mock dependencies
vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => vi.fn()),
}));

vi.mock('@/lib/auth-helper', () => ({
  verifyAuth: vi.fn(),
}));

vi.mock('@/lib/finalize-round', () => ({
  applyFinalizationResults: vi.fn(),
  AllocationResult: {},
}));

vi.mock('@/lib/realtime/broadcast', () => ({
  broadcastRoundUpdate: vi.fn(),
}));

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn(),
      })),
    })),
  },
}));

describe('POST /api/admin/rounds/[id]/apply-pending-allocations', () => {
  let mockSql: any;
  let mockVerifyAuth: any;
  let mockApplyFinalizationResults: any;
  let mockBroadcastRoundUpdate: any;
  let mockAdminDb: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { neon } = await import('@neondatabase/serverless');
    const { verifyAuth } = await import('@/lib/auth-helper');
    const { applyFinalizationResults } = await import('@/lib/finalize-round');
    const { broadcastRoundUpdate } = await import('@/lib/realtime/broadcast');
    const { adminDb } = await import('@/lib/firebase/admin');

    mockSql = vi.fn();
    (neon as any).mockReturnValue(mockSql);
    mockVerifyAuth = verifyAuth as any;
    mockApplyFinalizationResults = applyFinalizationResults as any;
    mockBroadcastRoundUpdate = broadcastRoundUpdate as any;
    mockAdminDb = adminDb as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Authorization', () => {
    it('should reject unauthorized requests', async () => {
      mockVerifyAuth.mockResolvedValue({
        authenticated: false,
        error: 'Unauthorized',
      });

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/123/apply-pending-allocations', {
        method: 'POST',
      });
      const params = Promise.resolve({ id: '123' });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');
      expect(mockVerifyAuth).toHaveBeenCalledWith(['admin', 'committee_admin'], request);
    });

    it('should allow committee_admin role', async () => {
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { role: 'committee_admin' },
      });

      mockSql.mockResolvedValueOnce([
        { id: '123', season_id: 'S2024', status: 'pending_finalization', finalization_mode: 'manual' },
      ]);
      mockSql.mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/123/apply-pending-allocations', {
        method: 'POST',
      });
      const params = Promise.resolve({ id: '123' });

      const response = await POST(request, { params });

      expect(mockVerifyAuth).toHaveBeenCalledWith(['admin', 'committee_admin'], request);
    });
  });

  describe('Round Validation', () => {
    beforeEach(() => {
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { role: 'committee_admin' },
      });
    });

    it('should return 404 if round not found', async () => {
      mockSql.mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/999/apply-pending-allocations', {
        method: 'POST',
      });
      const params = Promise.resolve({ id: '999' });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Round not found');
    });

    it('should reject if round is already completed', async () => {
      mockSql.mockResolvedValueOnce([
        { id: '123', season_id: 'S2024', status: 'completed', finalization_mode: 'manual' },
      ]);

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/123/apply-pending-allocations', {
        method: 'POST',
      });
      const params = Promise.resolve({ id: '123' });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Round is already finalized');
    });

    it('should reject if round status is not pending_finalization', async () => {
      mockSql.mockResolvedValueOnce([
        { id: '123', season_id: 'S2024', status: 'active', finalization_mode: 'manual' },
      ]);

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/123/apply-pending-allocations', {
        method: 'POST',
      });
      const params = Promise.resolve({ id: '123' });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Expected 'pending_finalization'");
    });

    it('should reject if no pending allocations found', async () => {
      mockSql.mockResolvedValueOnce([
        { id: '123', season_id: 'S2024', status: 'pending_finalization', finalization_mode: 'manual' },
      ]);
      mockSql.mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/123/apply-pending-allocations', {
        method: 'POST',
      });
      const params = Promise.resolve({ id: '123' });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('No pending allocations found for this round');
    });
  });

  describe('Budget Validation', () => {
    beforeEach(() => {
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { role: 'committee_admin' },
      });
    });

    it('should reject if team has insufficient budget', async () => {
      mockSql.mockResolvedValueOnce([
        { id: '123', season_id: 'S2024', status: 'pending_finalization', finalization_mode: 'manual' },
      ]);
      
      const mockPendingAllocations = [
        {
          team_id: 'TEAM001',
          team_name: 'Team A',
          player_id: 'PLAYER001',
          player_name: 'Player 1',
          amount: 2000,
          bid_id: 'BID001',
          phase: 'regular',
        },
      ];
      mockSql.mockResolvedValueOnce(mockPendingAllocations);

      const mockTeamDoc = {
        exists: true,
        data: () => ({
          currency_system: 'single',
          budget: 1000,
        }),
      };

      mockAdminDb.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(mockTeamDoc),
        })),
      });

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/123/apply-pending-allocations', {
        method: 'POST',
      });
      const params = Promise.resolve({ id: '123' });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Budget validation failed');
      expect(data.details.type).toBe('budget');
      expect(data.details.errors).toHaveLength(1);
      expect(data.details.errors[0]).toContain('insufficient funds');
      expect(data.details.errors[0]).toContain('Shortfall: £1000');
    });

    it('should handle dual currency system correctly', async () => {
      mockSql.mockResolvedValueOnce([
        { id: '123', season_id: 'S2024', status: 'pending_finalization', finalization_mode: 'manual' },
      ]);
      
      const mockPendingAllocations = [
        {
          team_id: 'TEAM001',
          team_name: 'Team A',
          player_id: 'PLAYER001',
          player_name: 'Player 1',
          amount: 1500,
          bid_id: 'BID001',
          phase: 'regular',
        },
      ];
      mockSql.mockResolvedValueOnce(mockPendingAllocations);

      const mockTeamDoc = {
        exists: true,
        data: () => ({
          currency_system: 'dual',
          football_budget: 2000,
        }),
      };

      mockAdminDb.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(mockTeamDoc),
        })),
      });

      mockApplyFinalizationResults.mockResolvedValue({ success: true });
      mockSql.mockResolvedValueOnce(undefined);
      mockSql.mockResolvedValueOnce([{ status: 'completed' }]);

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/123/apply-pending-allocations', {
        method: 'POST',
      });
      const params = Promise.resolve({ id: '123' });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Successful Application', () => {
    beforeEach(() => {
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { role: 'committee_admin' },
      });
    });

    it('should successfully apply pending allocations', async () => {
      mockSql.mockResolvedValueOnce([
        { id: '123', season_id: 'S2024', status: 'pending_finalization', finalization_mode: 'manual' },
      ]);
      
      const mockPendingAllocations = [
        {
          team_id: 'TEAM001',
          team_name: 'Team A',
          player_id: 'PLAYER001',
          player_name: 'Player 1',
          amount: 1500,
          bid_id: 'BID001',
          phase: 'regular',
        },
        {
          team_id: 'TEAM002',
          team_name: 'Team B',
          player_id: 'PLAYER002',
          player_name: 'Player 2',
          amount: 1200,
          bid_id: 'BID002',
          phase: 'regular',
        },
      ];
      mockSql.mockResolvedValueOnce(mockPendingAllocations);

      const mockTeamDoc = {
        exists: true,
        data: () => ({
          currency_system: 'single',
          budget: 5000,
        }),
      };

      mockAdminDb.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(mockTeamDoc),
        })),
      });

      mockApplyFinalizationResults.mockResolvedValue({ success: true });
      mockSql.mockResolvedValueOnce(undefined);
      mockSql.mockResolvedValueOnce([{ status: 'completed' }]);

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/123/apply-pending-allocations', {
        method: 'POST',
      });
      const params = Promise.resolve({ id: '123' });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('Successfully finalized round');
      expect(data.data.allocations_count).toBe(2);
      expect(data.data.round_status).toBe('completed');
      
      expect(mockApplyFinalizationResults).toHaveBeenCalledWith('123', expect.arrayContaining([
        expect.objectContaining({
          team_id: 'TEAM001',
          player_id: 'PLAYER001',
          amount: 1500,
        }),
      ]));
    });

    it('should delete pending allocations after successful application', async () => {
      mockSql.mockResolvedValueOnce([
        { id: '123', season_id: 'S2024', status: 'pending_finalization', finalization_mode: 'manual' },
      ]);
      
      const mockPendingAllocations = [
        {
          team_id: 'TEAM001',
          team_name: 'Team A',
          player_id: 'PLAYER001',
          player_name: 'Player 1',
          amount: 1500,
          bid_id: 'BID001',
          phase: 'regular',
        },
      ];
      mockSql.mockResolvedValueOnce(mockPendingAllocations);

      const mockTeamDoc = {
        exists: true,
        data: () => ({
          currency_system: 'single',
          budget: 5000,
        }),
      };

      mockAdminDb.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(mockTeamDoc),
        })),
      });

      mockApplyFinalizationResults.mockResolvedValue({ success: true });
      mockSql.mockResolvedValueOnce(undefined);
      mockSql.mockResolvedValueOnce([{ status: 'completed' }]);

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/123/apply-pending-allocations', {
        method: 'POST',
      });
      const params = Promise.resolve({ id: '123' });

      await POST(request, { params });

      expect(mockSql).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('DELETE FROM pending_allocations')])
      );
    });

    it('should broadcast real-time update to teams', async () => {
      mockSql.mockResolvedValueOnce([
        { id: '123', season_id: 'S2024', status: 'pending_finalization', finalization_mode: 'manual' },
      ]);
      
      const mockPendingAllocations = [
        {
          team_id: 'TEAM001',
          team_name: 'Team A',
          player_id: 'PLAYER001',
          player_name: 'Player 1',
          amount: 1500,
          bid_id: 'BID001',
          phase: 'regular',
        },
      ];
      mockSql.mockResolvedValueOnce(mockPendingAllocations);

      const mockTeamDoc = {
        exists: true,
        data: () => ({
          currency_system: 'single',
          budget: 5000,
        }),
      };

      mockAdminDb.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(mockTeamDoc),
        })),
      });

      mockApplyFinalizationResults.mockResolvedValue({ success: true });
      mockSql.mockResolvedValueOnce(undefined);
      mockSql.mockResolvedValueOnce([{ status: 'completed' }]);

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/123/apply-pending-allocations', {
        method: 'POST',
      });
      const params = Promise.resolve({ id: '123' });

      await POST(request, { params });

      expect(mockBroadcastRoundUpdate).toHaveBeenCalledWith('S2024', '123', {
        status: 'completed',
        finalized: true,
        allocations_count: 1,
      });
    });
  });

  describe('Rollback on Error', () => {
    beforeEach(() => {
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { role: 'committee_admin' },
      });
    });

    it('should not delete pending allocations if applyFinalizationResults fails', async () => {
      mockSql.mockResolvedValueOnce([
        { id: '123', season_id: 'S2024', status: 'pending_finalization', finalization_mode: 'manual' },
      ]);
      
      const mockPendingAllocations = [
        {
          team_id: 'TEAM001',
          team_name: 'Team A',
          player_id: 'PLAYER001',
          player_name: 'Player 1',
          amount: 1500,
          bid_id: 'BID001',
          phase: 'regular',
        },
      ];
      mockSql.mockResolvedValueOnce(mockPendingAllocations);

      const mockTeamDoc = {
        exists: true,
        data: () => ({
          currency_system: 'single',
          budget: 5000,
        }),
      };

      mockAdminDb.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(mockTeamDoc),
        })),
      });

      mockApplyFinalizationResults.mockResolvedValue({ 
        success: false, 
        error: 'Database error' 
      });

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/123/apply-pending-allocations', {
        method: 'POST',
      });
      const params = Promise.resolve({ id: '123' });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Failed to apply pending allocations');
      expect(data.details.type).toBe('database');
      
      const deleteCalls = mockSql.mock.calls.filter((call: any) => 
        call[0] && call[0][0] && call[0][0].includes('DELETE FROM pending_allocations')
      );
      expect(deleteCalls).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { role: 'committee_admin' },
      });
    });

    it('should handle database errors gracefully', async () => {
      mockSql.mockRejectedValueOnce(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/123/apply-pending-allocations', {
        method: 'POST',
      });
      const params = Promise.resolve({ id: '123' });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Internal server error while applying pending allocations');
    });

    it('should handle team not found in season', async () => {
      mockSql.mockResolvedValueOnce([
        { id: '123', season_id: 'S2024', status: 'pending_finalization', finalization_mode: 'manual' },
      ]);
      
      const mockPendingAllocations = [
        {
          team_id: 'TEAM001',
          team_name: 'Team A',
          player_id: 'PLAYER001',
          player_name: 'Player 1',
          amount: 1500,
          bid_id: 'BID001',
          phase: 'regular',
        },
      ];
      mockSql.mockResolvedValueOnce(mockPendingAllocations);

      const mockTeamDoc = {
        exists: false,
      };

      mockAdminDb.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(mockTeamDoc),
        })),
      });

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/123/apply-pending-allocations', {
        method: 'POST',
      });
      const params = Promise.resolve({ id: '123' });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Budget validation failed');
      expect(data.details.errors[0]).toContain('not found in season');
    });

    it('should continue on broadcast failure (non-critical)', async () => {
      mockSql.mockResolvedValueOnce([
        { id: '123', season_id: 'S2024', status: 'pending_finalization', finalization_mode: 'manual' },
      ]);
      
      const mockPendingAllocations = [
        {
          team_id: 'TEAM001',
          team_name: 'Team A',
          player_id: 'PLAYER001',
          player_name: 'Player 1',
          amount: 1500,
          bid_id: 'BID001',
          phase: 'regular',
        },
      ];
      mockSql.mockResolvedValueOnce(mockPendingAllocations);

      const mockTeamDoc = {
        exists: true,
        data: () => ({
          currency_system: 'single',
          budget: 5000,
        }),
      };

      mockAdminDb.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(mockTeamDoc),
        })),
      });

      mockApplyFinalizationResults.mockResolvedValue({ success: true });
      mockSql.mockResolvedValueOnce(undefined);
      mockSql.mockResolvedValueOnce([{ status: 'completed' }]);
      mockBroadcastRoundUpdate.mockRejectedValue(new Error('Broadcast failed'));

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/123/apply-pending-allocations', {
        method: 'POST',
      });
      const params = Promise.resolve({ id: '123' });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
