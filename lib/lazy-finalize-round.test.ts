import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock sql function
const mockSql = vi.fn();

// Mock the neon database before importing the module
vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => mockSql),
}));

// Mock the finalize-round module
vi.mock('./finalize-round', () => ({
  finalizeRound: vi.fn(),
  applyFinalizationResults: vi.fn(),
}));

// Import after mocks are set up
const { checkAndFinalizeExpiredRound } = await import('./lazy-finalize-round');
const finalizeRound = await import('./finalize-round');

describe('checkAndFinalizeExpiredRound', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSql.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Auto mode - backward compatibility', () => {
    it('should auto-finalize expired round with auto mode', async () => {
      const roundId = '123';
      const pastTime = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      
      // Mock round query - expired round with auto mode
      mockSql.mockResolvedValueOnce([
        {
          id: roundId,
          status: 'active',
          end_time: pastTime,
          position: 'GK',
          finalization_mode: 'auto',
        },
      ]);
      
      // Mock lock acquisition
      mockSql.mockResolvedValueOnce([{ id: roundId }]);
      
      // Mock finalization success
      vi.mocked(finalizeRound.finalizeRound).mockResolvedValueOnce({
        success: true,
        allocations: [
          {
            teamId: 'team1',
            teamName: 'Team 1',
            playerId: 'player1',
            playerName: 'Player 1',
            amount: 100,
            bidId: 'bid1',
            phase: 'regular',
          },
        ],
      });
      
      // Mock apply finalization success
      vi.mocked(finalizeRound.applyFinalizationResults).mockResolvedValueOnce({
        success: true,
      });
      
      const result = await checkAndFinalizeExpiredRound(roundId);
      
      expect(result.finalized).toBe(true);
      expect(result.alreadyFinalized).toBe(false);
      expect(result.pendingManualFinalization).toBe(false);
      expect(result.error).toBeUndefined();
      
      // Verify finalization was called
      expect(finalizeRound.finalizeRound).toHaveBeenCalledWith(roundId);
      expect(finalizeRound.applyFinalizationResults).toHaveBeenCalled();
    });

    it('should not finalize non-expired round with auto mode', async () => {
      const roundId = '123';
      const futureTime = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
      
      // Mock round query - active round with auto mode, not expired
      mockSql.mockResolvedValueOnce([
        {
          id: roundId,
          status: 'active',
          end_time: futureTime,
          position: 'GK',
          finalization_mode: 'auto',
        },
      ]);
      
      const result = await checkAndFinalizeExpiredRound(roundId);
      
      expect(result.finalized).toBe(false);
      expect(result.alreadyFinalized).toBe(false);
      expect(result.pendingManualFinalization).toBe(false);
      
      // Verify finalization was not called
      expect(finalizeRound.finalizeRound).not.toHaveBeenCalled();
    });

    it('should handle already completed round with auto mode', async () => {
      const roundId = '123';
      
      // Mock round query - completed round
      mockSql.mockResolvedValueOnce([
        {
          id: roundId,
          status: 'completed',
          end_time: new Date().toISOString(),
          position: 'GK',
          finalization_mode: 'auto',
        },
      ]);
      
      const result = await checkAndFinalizeExpiredRound(roundId);
      
      expect(result.finalized).toBe(false);
      expect(result.alreadyFinalized).toBe(true);
      expect(result.pendingManualFinalization).toBe(false);
      
      // Verify finalization was not called
      expect(finalizeRound.finalizeRound).not.toHaveBeenCalled();
    });
  });

  describe('Manual mode - prevents auto-finalization', () => {
    it('should not auto-finalize expired round with manual mode', async () => {
      const roundId = '456';
      const pastTime = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      
      // Mock round query - expired round with manual mode
      mockSql.mockResolvedValueOnce([
        {
          id: roundId,
          status: 'active',
          end_time: pastTime,
          position: 'DEF',
          finalization_mode: 'manual',
        },
      ]);
      
      // Mock status update
      mockSql.mockResolvedValueOnce([]);
      
      const result = await checkAndFinalizeExpiredRound(roundId);
      
      expect(result.finalized).toBe(false);
      expect(result.alreadyFinalized).toBe(false);
      expect(result.pendingManualFinalization).toBe(true);
      expect(result.error).toBeUndefined();
      
      // Verify finalization was NOT called
      expect(finalizeRound.finalizeRound).not.toHaveBeenCalled();
      expect(finalizeRound.applyFinalizationResults).not.toHaveBeenCalled();
    });

    it('should not finalize non-expired round with manual mode', async () => {
      const roundId = '456';
      const futureTime = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
      
      // Mock round query - active round with manual mode, not expired
      mockSql.mockResolvedValueOnce([
        {
          id: roundId,
          status: 'active',
          end_time: futureTime,
          position: 'DEF',
          finalization_mode: 'manual',
        },
      ]);
      
      const result = await checkAndFinalizeExpiredRound(roundId);
      
      expect(result.finalized).toBe(false);
      expect(result.alreadyFinalized).toBe(false);
      expect(result.pendingManualFinalization).toBe(false);
      
      // Verify finalization was not called
      expect(finalizeRound.finalizeRound).not.toHaveBeenCalled();
    });
  });

  describe('Status updates for manual mode', () => {
    it('should update status to expired_pending_finalization for expired manual round', async () => {
      const roundId = '789';
      const pastTime = new Date(Date.now() - 3600000).toISOString();
      
      // Mock round query
      mockSql.mockResolvedValueOnce([
        {
          id: roundId,
          status: 'active',
          end_time: pastTime,
          position: 'MID',
          finalization_mode: 'manual',
        },
      ]);
      
      // Mock status update
      mockSql.mockResolvedValueOnce([]);
      
      await checkAndFinalizeExpiredRound(roundId);
      
      // Verify the status update was called with correct parameters
      expect(mockSql).toHaveBeenCalledTimes(2);
      // The second call should be the UPDATE query
      const updateCall = mockSql.mock.calls[1];
      expect(updateCall).toBeDefined();
    });

    it('should recognize expired_pending_finalization status', async () => {
      const roundId = '789';
      
      // Mock round query - round already in expired_pending_finalization status
      mockSql.mockResolvedValueOnce([
        {
          id: roundId,
          status: 'expired_pending_finalization',
          end_time: new Date().toISOString(),
          position: 'MID',
          finalization_mode: 'manual',
        },
      ]);
      
      const result = await checkAndFinalizeExpiredRound(roundId);
      
      expect(result.finalized).toBe(false);
      expect(result.alreadyFinalized).toBe(false);
      expect(result.pendingManualFinalization).toBe(true);
      
      // Verify finalization was not called
      expect(finalizeRound.finalizeRound).not.toHaveBeenCalled();
    });

    it('should recognize pending_finalization status', async () => {
      const roundId = '789';
      
      // Mock round query - round in pending_finalization status
      mockSql.mockResolvedValueOnce([
        {
          id: roundId,
          status: 'pending_finalization',
          end_time: new Date().toISOString(),
          position: 'MID',
          finalization_mode: 'manual',
        },
      ]);
      
      const result = await checkAndFinalizeExpiredRound(roundId);
      
      expect(result.finalized).toBe(false);
      expect(result.alreadyFinalized).toBe(false);
      expect(result.pendingManualFinalization).toBe(true);
      
      // Verify finalization was not called
      expect(finalizeRound.finalizeRound).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle round not found', async () => {
      const roundId = '999';
      
      // Mock empty result
      mockSql.mockResolvedValueOnce([]);
      
      const result = await checkAndFinalizeExpiredRound(roundId);
      
      expect(result.finalized).toBe(false);
      expect(result.alreadyFinalized).toBe(false);
      expect(result.pendingManualFinalization).toBe(false);
      expect(result.error).toBe('Round not found');
    });

    it('should handle database errors gracefully', async () => {
      const roundId = '123';
      
      // Mock database error
      mockSql.mockRejectedValueOnce(new Error('Database connection failed'));
      
      const result = await checkAndFinalizeExpiredRound(roundId);
      
      expect(result.finalized).toBe(false);
      expect(result.alreadyFinalized).toBe(false);
      expect(result.pendingManualFinalization).toBe(false);
      expect(result.error).toBe('Internal error during finalization');
    });

    it('should handle concurrent finalization attempts', async () => {
      const roundId = '123';
      const pastTime = new Date(Date.now() - 3600000).toISOString();
      
      // Mock round query
      mockSql.mockResolvedValueOnce([
        {
          id: roundId,
          status: 'active',
          end_time: pastTime,
          position: 'GK',
          finalization_mode: 'auto',
        },
      ]);
      
      // Mock lock acquisition failure (another request got it first)
      mockSql.mockResolvedValueOnce([]);
      
      const result = await checkAndFinalizeExpiredRound(roundId);
      
      expect(result.finalized).toBe(false);
      expect(result.alreadyFinalized).toBe(true);
      expect(result.pendingManualFinalization).toBe(false);
      
      // Verify finalization was not called
      expect(finalizeRound.finalizeRound).not.toHaveBeenCalled();
    });

    it('should handle tiebreaker detection in auto mode', async () => {
      const roundId = '123';
      const pastTime = new Date(Date.now() - 3600000).toISOString();
      
      // Mock round query
      mockSql.mockResolvedValueOnce([
        {
          id: roundId,
          status: 'active',
          end_time: pastTime,
          position: 'GK',
          finalization_mode: 'auto',
        },
      ]);
      
      // Mock lock acquisition
      mockSql.mockResolvedValueOnce([{ id: roundId }]);
      
      // Mock tiebreaker detection
      vi.mocked(finalizeRound.finalizeRound).mockResolvedValueOnce({
        success: false,
        tieDetected: true,
        tiebreakerId: 'tiebreaker123',
      });
      
      // Mock status update for tiebreaker
      mockSql.mockResolvedValueOnce([]);
      
      const result = await checkAndFinalizeExpiredRound(roundId);
      
      expect(result.finalized).toBe(true);
      expect(result.alreadyFinalized).toBe(false);
      expect(result.pendingManualFinalization).toBe(false);
      expect(result.error).toBe('Tiebreaker required');
    });
  });

  describe('Default finalization mode', () => {
    it('should treat missing finalization_mode as auto', async () => {
      const roundId = '123';
      const pastTime = new Date(Date.now() - 3600000).toISOString();
      
      // Mock round query - no finalization_mode field (old data)
      mockSql.mockResolvedValueOnce([
        {
          id: roundId,
          status: 'active',
          end_time: pastTime,
          position: 'GK',
          // finalization_mode is undefined/null
        },
      ]);
      
      // Mock lock acquisition
      mockSql.mockResolvedValueOnce([{ id: roundId }]);
      
      // Mock finalization success
      vi.mocked(finalizeRound.finalizeRound).mockResolvedValueOnce({
        success: true,
        allocations: [],
      });
      
      // Mock apply finalization success
      vi.mocked(finalizeRound.applyFinalizationResults).mockResolvedValueOnce({
        success: true,
      });
      
      const result = await checkAndFinalizeExpiredRound(roundId);
      
      // Should auto-finalize (backward compatibility)
      expect(result.finalized).toBe(true);
      expect(result.pendingManualFinalization).toBe(false);
      expect(finalizeRound.finalizeRound).toHaveBeenCalled();
    });
  });
});
