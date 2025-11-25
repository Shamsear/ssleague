/**
 * Unit tests for /api/admin/rounds/[id]/pending-allocations
 * 
 * Tests cover:
 * GET:
 * - Successful retrieval
 * - Empty pending allocations
 * - Authorization checks
 * 
 * DELETE:
 * - Successful cancellation
 * - Authorization checks
 * - Audit logging
 * 
 * Requirements: 4, 5
 * 
 * Note: These tests require proper mocking configuration for @neondatabase/serverless.
 * The neon SQL client uses tagged template literals which require special mocking setup.
 * 
 * To install test dependencies: npm install -D vitest @vitejs/plugin-react @testing-library/react
 * To run: npx vitest run tests/api/admin/rounds/pending-allocations.test.ts
 * 
 * Current Status: Tests are structurally complete but require additional mock configuration
 * to handle the neon SQL client's tagged template literal syntax properly.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, DELETE } from '@/app/api/admin/rounds/[id]/pending-allocations/route';

// Mock dependencies
vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => vi.fn()),
}));

vi.mock('@/lib/auth-helper', () => ({
  verifyAuth: vi.fn(),
}));

describe('GET /api/admin/rounds/[id]/pending-allocations', () => {
  let mockSql: any;
  let mockVerifyAuth: any;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Import mocked modules
    const { neon } = await import('@neondatabase/serverless');
    const { verifyAuth } = await import('@/lib/auth-helper');

    // Create a mock function that handles template literal calls
    // When called as sql`...`, it's actually called as sql(strings, ...values)
    mockSql = vi.fn();
    (neon as any).mockReturnValue(mockSql);
    mockVerifyAuth = verifyAuth as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Authorization', () => {
    it('should reject unauthorized requests', async () => {
      // Arrange
      mockVerifyAuth.mockResolvedValue({
        authenticated: false,
        error: 'Unauthorized',
      });

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/123/pending-allocations', {
        method: 'GET',
      });
      const params = Promise.resolve({ id: '123' });

      // Act
      const response = await GET(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');
      expect(mockVerifyAuth).toHaveBeenCalledWith(['admin', 'committee_admin'], request);
    });

    it('should allow committee_admin role', async () => {
      // Arrange
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { role: 'committee_admin' },
      });

      // First SQL call - get round
      mockSql.mockResolvedValueOnce([
        {
          id: '123',
          season_id: 'S2024',
          status: 'pending_finalization',
        },
      ]);

      // Second SQL call - get pending allocations
      mockSql.mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/123/pending-allocations', {
        method: 'GET',
      });
      const params = Promise.resolve({ id: '123' });

      // Act
      const response = await GET(request, { params });

      // Assert
      expect(response.status).toBe(200);
      expect(mockVerifyAuth).toHaveBeenCalledWith(['admin', 'committee_admin'], request);
    });

    it('should allow admin role', async () => {
      // Arrange
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { role: 'admin' },
      });

      // First SQL call - get round
      mockSql.mockResolvedValueOnce([
        {
          id: '123',
          season_id: 'S2024',
          status: 'pending_finalization',
        },
      ]);

      // Second SQL call - get pending allocations
      mockSql.mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/123/pending-allocations', {
        method: 'GET',
      });
      const params = Promise.resolve({ id: '123' });

      // Act
      const response = await GET(request, { params });

      // Assert
      expect(response.status).toBe(200);
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
      // Arrange
      // First SQL call - get round (returns empty)
      mockSql.mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/999/pending-allocations', {
        method: 'GET',
      });
      const params = Promise.resolve({ id: '999' });

      // Act
      const response = await GET(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Round not found');
    });
  });

  describe('Empty Pending Allocations', () => {
    beforeEach(() => {
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { role: 'committee_admin' },
      });
    });

    it('should return empty result when no pending allocations exist', async () => {
      // Arrange
      // First SQL call - get round
      mockSql.mockResolvedValueOnce([
        {
          id: '123',
          season_id: 'S2024',
          status: 'active',
        },
      ]);

      // Second SQL call - get pending allocations (empty)
      mockSql.mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/123/pending-allocations', {
        method: 'GET',
      });
      const params = Promise.resolve({ id: '123' });

      // Act
      const response = await GET(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.allocations).toEqual([]);
      expect(data.data.summary.total_players).toBe(0);
      expect(data.data.summary.total_spent).toBe(0);
      expect(data.data.summary.average_bid).toBe(0);
      expect(data.message).toBe('No pending allocations found for this round');
    });
  });

  describe('Successful Retrieval', () => {
    beforeEach(() => {
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        user: { role: 'committee_admin' },
      });
    });

    it('should successfully retrieve pending allocations with summary', async () => {
      // First SQL call - get round
      mockSql.mockResolvedValueOnce([
        {
          id: '123',
          season_id: 'S2024',
          status: 'pending_finalization',
        },
      ]);
      // Arrange
      const mockPendingAllocations = [
        {
          id: 1,
          round_id: '123',
          team_id: 'TEAM001',
          team_name: 'Team A',
          player_id: 'PLAYER001',
          player_name: 'Player 1',
          amount: 1500,
          bid_id: 'BID001',
          phase: 'regular',
          created_at: '2024-01-01T10:00:00Z',
        },
        {
          id: 2,
          round_id: '123',
          team_id: 'TEAM002',
          team_name: 'Team B',
          player_id: 'PLAYER002',
          player_name: 'Player 2',
          amount: 1200,
          bid_id: 'BID002',
          phase: 'regular',
          created_at: '2024-01-01T10:00:00Z',
        },
        {
          id: 3,
          round_id: '123',
          team_id: 'TEAM003',
          team_name: 'Team C',
          player_id: 'PLAYER003',
          player_name: 'Player 3',
          amount: 1000,
          bid_id: 'synthetic_123',
          phase: 'incomplete',
          created_at: '2024-01-01T10:00:00Z',
        },
      ];

      // Second SQL call - get pending allocations
      mockSql.mockResolvedValueOnce(mockPendingAllocations);

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/123/pending-allocations', {
        method: 'GET',
      });
      const params = Promise.resolve({ id: '123' });

      // Act
      const response = await GET(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.allocations).toHaveLength(3);
      
      // Verify allocation structure
      expect(data.data.allocations[0]).toEqual({
        id: 1,
        team_id: 'TEAM001',
        team_name: 'Team A',
        player_id: 'PLAYER001',
        player_name: 'Player 1',
        amount: 1500,
        phase: 'regular',
        created_at: '2024-01-01T10:00:00Z',
      });

      // Verify summary statistics
      expect(data.data.summary.total_players).toBe(3);
      expect(data.data.summary.total_spent).toBe(3700);
      expect(data.data.summary.average_bid).toBe(1233); // Math.round(3700 / 3)
    });

    it('should return allocations sorted by amount descending', async () => {
      // Arrange
      // First SQL call - get round
      mockSql.mockResolvedValueOnce([
        {
          id: '123',
          season_id: 'S2024',
          status: 'pending_finalization',
        },
      ]);

      const mockPendingAllocations = [
        {
          id: 1,
          round_id: '123',
          team_id: 'TEAM001',
          team_name: 'Team A',
          player_id: 'PLAYER001',
          player_name: 'Player 1',
          amount: 2000,
          bid_id: 'BID001',
          phase: 'regular',
          created_at: '2024-01-01T10:00:00Z',
        },
        {
          id: 2,
          round_id: '123',
          team_id: 'TEAM002',
          team_name: 'Team B',
          player_id: 'PLAYER002',
          player_name: 'Player 2',
          amount: 1500,
          bid_id: 'BID002',
          phase: 'regular',
          created_at: '2024-01-01T10:00:00Z',
        },
        {
          id: 3,
          round_id: '123',
          team_id: 'TEAM003',
          team_name: 'Team C',
          player_id: 'PLAYER003',
          player_name: 'Player 3',
          amount: 1000,
          bid_id: 'BID003',
          phase: 'regular',
          created_at: '2024-01-01T10:00:00Z',
        },
      ];

      // Second SQL call - get pending allocations
      mockSql.mockResolvedValueOnce(mockPendingAllocations);

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/123/pending-allocations', {
        method: 'GET',
      });
      const params = Promise.resolve({ id: '123' });

      // Act
      const response = await GET(request, { params });
      const data = await response.json();

      // Assert
      expect(data.data.allocations[0].amount).toBe(2000);
      expect(data.data.allocations[1].amount).toBe(1500);
      expect(data.data.allocations[2].amount).toBe(1000);
    });

    it('should handle single allocation correctly', async () => {
      // Arrange
      // First SQL call - get round
      mockSql.mockResolvedValueOnce([
        {
          id: '123',
          season_id: 'S2024',
          status: 'pending_finalization',
        },
      ]);

      const mockPendingAllocations = [
        {
          id: 1,
          round_id: '123',
          team_id: 'TEAM001',
          team_name: 'Team A',
          player_id: 'PLAYER001',
          player_name: 'Player 1',
          amount: 1500,
          bid_id: 'BID001',
          phase: 'regular',
          created_at: '2024-01-01T10:00:00Z',
        },
      ];

      // Second SQL call - get pending allocations
      mockSql.mockResolvedValueOnce(mockPendingAllocations);

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/123/pending-allocations', {
        method: 'GET',
      });
      const params = Promise.resolve({ id: '123' });

      // Act
      const response = await GET(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.allocations).toHaveLength(1);
      expect(data.data.summary.total_players).toBe(1);
      expect(data.data.summary.total_spent).toBe(1500);
      expect(data.data.summary.average_bid).toBe(1500);
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
      // Arrange
      // First SQL call - get round (fails)
      mockSql.mockRejectedValueOnce(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/123/pending-allocations', {
        method: 'GET',
      });
      const params = Promise.resolve({ id: '123' });

      // Act
      const response = await GET(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Internal server error');
    });
  });
});


describe('DELETE /api/admin/rounds/[id]/pending-allocations', () => {
  let mockSql: any;
  let mockVerifyAuth: any;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Import mocked modules
    const { neon } = await import('@neondatabase/serverless');
    const { verifyAuth } = await import('@/lib/auth-helper');

    // Create a mock function that handles template literal calls
    mockSql = vi.fn();
    (neon as any).mockReturnValue(mockSql);
    mockVerifyAuth = verifyAuth as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Authorization', () => {
    it('should reject unauthorized requests', async () => {
      // Arrange
      mockVerifyAuth.mockResolvedValue({
        authenticated: false,
        error: 'Unauthorized',
      });

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/123/pending-allocations', {
        method: 'DELETE',
      });
      const params = Promise.resolve({ id: '123' });

      // Act
      const response = await DELETE(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');
      expect(mockVerifyAuth).toHaveBeenCalledWith(['admin', 'committee_admin'], request);
    });

    it('should allow committee_admin role', async () => {
      // Arrange
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        userId: 'user123',
        user: { role: 'committee_admin' },
      });

      // First SQL call - get round
      mockSql.mockResolvedValueOnce([
        {
          id: '123',
          season_id: 'S2024',
          status: 'pending_finalization',
          finalization_mode: 'manual',
        },
      ]);

      // Second SQL call - count pending allocations
      mockSql.mockResolvedValueOnce([{ count: 5 }]);

      // Third SQL call - delete pending allocations
      mockSql.mockResolvedValueOnce([]);

      // Fourth SQL call - update round status
      mockSql.mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/123/pending-allocations', {
        method: 'DELETE',
      });
      const params = Promise.resolve({ id: '123' });

      // Act
      const response = await DELETE(request, { params });

      // Assert
      expect(response.status).toBe(200);
      expect(mockVerifyAuth).toHaveBeenCalledWith(['admin', 'committee_admin'], request);
    });

    it('should allow admin role', async () => {
      // Arrange
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        userId: 'admin456',
        user: { role: 'admin' },
      });

      // First SQL call - get round
      mockSql.mockResolvedValueOnce([
        {
          id: '123',
          season_id: 'S2024',
          status: 'pending_finalization',
          finalization_mode: 'manual',
        },
      ]);

      // Second SQL call - count pending allocations
      mockSql.mockResolvedValueOnce([{ count: 3 }]);

      // Third SQL call - delete pending allocations
      mockSql.mockResolvedValueOnce([]);

      // Fourth SQL call - update round status
      mockSql.mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/123/pending-allocations', {
        method: 'DELETE',
      });
      const params = Promise.resolve({ id: '123' });

      // Act
      const response = await DELETE(request, { params });

      // Assert
      expect(response.status).toBe(200);
      expect(mockVerifyAuth).toHaveBeenCalledWith(['admin', 'committee_admin'], request);
    });
  });

  describe('Round Validation', () => {
    beforeEach(() => {
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        userId: 'user123',
        user: { role: 'committee_admin' },
      });
    });

    it('should return 404 if round not found', async () => {
      // Arrange
      // First SQL call - get round (returns empty)
      mockSql.mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/999/pending-allocations', {
        method: 'DELETE',
      });
      const params = Promise.resolve({ id: '999' });

      // Act
      const response = await DELETE(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Round not found');
    });

    it('should return 400 if no pending allocations exist', async () => {
      // Arrange
      // First SQL call - get round
      mockSql.mockResolvedValueOnce([
        {
          id: '123',
          season_id: 'S2024',
          status: 'pending_finalization',
          finalization_mode: 'manual',
        },
      ]);

      // Second SQL call - count pending allocations (returns 0)
      mockSql.mockResolvedValueOnce([{ count: 0 }]);

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/123/pending-allocations', {
        method: 'DELETE',
      });
      const params = Promise.resolve({ id: '123' });

      // Act
      const response = await DELETE(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('No pending allocations found for this round');
      expect(data.message).toBe('There are no pending allocations to cancel');
    });
  });

  describe('Successful Cancellation', () => {
    beforeEach(() => {
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        userId: 'user123',
        user: { role: 'committee_admin' },
      });
    });

    it('should successfully cancel pending allocations', async () => {
      // Arrange
      const roundId = '123';
      const allocationsCount = 5;

      // First SQL call - get round
      mockSql.mockResolvedValueOnce([
        {
          id: roundId,
          season_id: 'S2024',
          status: 'pending_finalization',
          finalization_mode: 'manual',
        },
      ]);

      // Second SQL call - count pending allocations
      mockSql.mockResolvedValueOnce([{ count: allocationsCount }]);

      // Third SQL call - delete pending allocations
      mockSql.mockResolvedValueOnce([]);

      // Fourth SQL call - update round status
      mockSql.mockResolvedValueOnce([]);

      const request = new NextRequest(`http://localhost:3000/api/admin/rounds/${roundId}/pending-allocations`, {
        method: 'DELETE',
      });
      const params = Promise.resolve({ id: roundId });

      // Act
      const response = await DELETE(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain(`Successfully canceled ${allocationsCount} pending allocation(s)`);
      expect(data.data.allocations_canceled).toBe(allocationsCount);
      expect(data.data.round_status).toBe('expired_pending_finalization');
    });

    it('should update round status to expired_pending_finalization', async () => {
      // Arrange
      const roundId = '456';

      // First SQL call - get round
      mockSql.mockResolvedValueOnce([
        {
          id: roundId,
          season_id: 'S2024',
          status: 'pending_finalization',
          finalization_mode: 'manual',
        },
      ]);

      // Second SQL call - count pending allocations
      mockSql.mockResolvedValueOnce([{ count: 3 }]);

      // Third SQL call - delete pending allocations
      mockSql.mockResolvedValueOnce([]);

      // Fourth SQL call - update round status
      const updateMock = vi.fn().mockResolvedValueOnce([]);
      mockSql.mockImplementationOnce(updateMock);

      const request = new NextRequest(`http://localhost:3000/api/admin/rounds/${roundId}/pending-allocations`, {
        method: 'DELETE',
      });
      const params = Promise.resolve({ id: roundId });

      // Act
      const response = await DELETE(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.round_status).toBe('expired_pending_finalization');
    });

    it('should handle single allocation cancellation', async () => {
      // Arrange
      const roundId = '789';

      // First SQL call - get round
      mockSql.mockResolvedValueOnce([
        {
          id: roundId,
          season_id: 'S2024',
          status: 'pending_finalization',
          finalization_mode: 'manual',
        },
      ]);

      // Second SQL call - count pending allocations
      mockSql.mockResolvedValueOnce([{ count: 1 }]);

      // Third SQL call - delete pending allocations
      mockSql.mockResolvedValueOnce([]);

      // Fourth SQL call - update round status
      mockSql.mockResolvedValueOnce([]);

      const request = new NextRequest(`http://localhost:3000/api/admin/rounds/${roundId}/pending-allocations`, {
        method: 'DELETE',
      });
      const params = Promise.resolve({ id: roundId });

      // Act
      const response = await DELETE(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.allocations_canceled).toBe(1);
    });

    it('should handle multiple allocations cancellation', async () => {
      // Arrange
      const roundId = '101';
      const largeCount = 25;

      // First SQL call - get round
      mockSql.mockResolvedValueOnce([
        {
          id: roundId,
          season_id: 'S2024',
          status: 'pending_finalization',
          finalization_mode: 'manual',
        },
      ]);

      // Second SQL call - count pending allocations
      mockSql.mockResolvedValueOnce([{ count: largeCount }]);

      // Third SQL call - delete pending allocations
      mockSql.mockResolvedValueOnce([]);

      // Fourth SQL call - update round status
      mockSql.mockResolvedValueOnce([]);

      const request = new NextRequest(`http://localhost:3000/api/admin/rounds/${roundId}/pending-allocations`, {
        method: 'DELETE',
      });
      const params = Promise.resolve({ id: roundId });

      // Act
      const response = await DELETE(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.allocations_canceled).toBe(largeCount);
    });
  });

  describe('Audit Logging', () => {
    let consoleLogSpy: any;

    beforeEach(() => {
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        userId: 'user123',
        user: { role: 'committee_admin' },
      });

      // Spy on console.log to verify audit logging
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it('should log audit trail for cancellation', async () => {
      // Arrange
      const roundId = '123';
      const userId = 'user123';
      const allocationsCount = 5;

      // First SQL call - get round
      mockSql.mockResolvedValueOnce([
        {
          id: roundId,
          season_id: 'S2024',
          status: 'pending_finalization',
          finalization_mode: 'manual',
        },
      ]);

      // Second SQL call - count pending allocations
      mockSql.mockResolvedValueOnce([{ count: allocationsCount }]);

      // Third SQL call - delete pending allocations
      mockSql.mockResolvedValueOnce([]);

      // Fourth SQL call - update round status
      mockSql.mockResolvedValueOnce([]);

      const request = new NextRequest(`http://localhost:3000/api/admin/rounds/${roundId}/pending-allocations`, {
        method: 'DELETE',
      });
      const params = Promise.resolve({ id: roundId });

      // Act
      await DELETE(request, { params });

      // Assert - verify audit logs were created
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Canceling ${allocationsCount} pending allocation(s) for round ${roundId}`)
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Audit: User ${userId}`)
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('canceling pending allocations')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Deleted ${allocationsCount} pending allocation(s)`)
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Round status updated to 'expired_pending_finalization'")
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Audit: Pending allocations canceled successfully')
      );
    });

    it('should log errors in audit trail', async () => {
      // Arrange
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // First SQL call - get round (fails)
      mockSql.mockRejectedValueOnce(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/123/pending-allocations', {
        method: 'DELETE',
      });
      const params = Promise.resolve({ id: '123' });

      // Act
      await DELETE(request, { params });

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error canceling pending allocations:',
        expect.any(Error)
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Audit: Failed to cancel pending allocations:'),
        expect.any(String)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should include timestamp in audit logs', async () => {
      // Arrange
      const roundId = '123';

      // First SQL call - get round
      mockSql.mockResolvedValueOnce([
        {
          id: roundId,
          season_id: 'S2024',
          status: 'pending_finalization',
          finalization_mode: 'manual',
        },
      ]);

      // Second SQL call - count pending allocations
      mockSql.mockResolvedValueOnce([{ count: 3 }]);

      // Third SQL call - delete pending allocations
      mockSql.mockResolvedValueOnce([]);

      // Fourth SQL call - update round status
      mockSql.mockResolvedValueOnce([]);

      const request = new NextRequest(`http://localhost:3000/api/admin/rounds/${roundId}/pending-allocations`, {
        method: 'DELETE',
      });
      const params = Promise.resolve({ id: roundId });

      // Act
      await DELETE(request, { params });

      // Assert - verify timestamp is included in audit log
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockVerifyAuth.mockResolvedValue({
        authenticated: true,
        userId: 'user123',
        user: { role: 'committee_admin' },
      });
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      // First SQL call - get round (fails)
      mockSql.mockRejectedValueOnce(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/123/pending-allocations', {
        method: 'DELETE',
      });
      const params = Promise.resolve({ id: '123' });

      // Act
      const response = await DELETE(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Internal server error while canceling pending allocations');
      expect(data.details).toBe('An unexpected error occurred. Please try again or contact support.');
    });

    it('should handle deletion errors', async () => {
      // Arrange
      // First SQL call - get round
      mockSql.mockResolvedValueOnce([
        {
          id: '123',
          season_id: 'S2024',
          status: 'pending_finalization',
          finalization_mode: 'manual',
        },
      ]);

      // Second SQL call - count pending allocations
      mockSql.mockResolvedValueOnce([{ count: 5 }]);

      // Third SQL call - delete pending allocations (fails)
      mockSql.mockRejectedValueOnce(new Error('Delete operation failed'));

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/123/pending-allocations', {
        method: 'DELETE',
      });
      const params = Promise.resolve({ id: '123' });

      // Act
      const response = await DELETE(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Internal server error while canceling pending allocations');
    });

    it('should handle status update errors', async () => {
      // Arrange
      // First SQL call - get round
      mockSql.mockResolvedValueOnce([
        {
          id: '123',
          season_id: 'S2024',
          status: 'pending_finalization',
          finalization_mode: 'manual',
        },
      ]);

      // Second SQL call - count pending allocations
      mockSql.mockResolvedValueOnce([{ count: 5 }]);

      // Third SQL call - delete pending allocations (succeeds)
      mockSql.mockResolvedValueOnce([]);

      // Fourth SQL call - update round status (fails)
      mockSql.mockRejectedValueOnce(new Error('Update operation failed'));

      const request = new NextRequest('http://localhost:3000/api/admin/rounds/123/pending-allocations', {
        method: 'DELETE',
      });
      const params = Promise.resolve({ id: '123' });

      // Act
      const response = await DELETE(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });
});