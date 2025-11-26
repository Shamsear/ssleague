/**
 * Integration test for rollback when budget update fails
 * 
 * This test verifies that when player updates succeed but budget updates fail,
 * the rollback mechanism properly restores all player season records.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { 
  executeTransferV2, 
  TransferRequest
} from '../../lib/player-transfers-v2';

// Mock the dependencies
vi.mock('../../lib/neon/tournament-config', () => ({
  getTournamentDb: vi.fn(() => ({
    query: vi.fn()
  }))
}));

vi.mock('../../lib/firebase/admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn(),
        set: vi.fn(),
        update: vi.fn()
      })),
      where: vi.fn(() => ({
        get: vi.fn()
      }))
    }))
  }
}));

vi.mock('firebase-admin', () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: vi.fn(() => new Date()),
        increment: vi.fn((value: number) => ({ _increment: value }))
      }
    }
  }
}));

vi.mock('../../lib/transfer-limits', () => ({
  validateTransferLimit: vi.fn(),
  validateMultipleTeamLimits: vi.fn()
}));

vi.mock('../../lib/transaction-logger', () => ({
  logTransferPayment: vi.fn(),
  logTransferCompensation: vi.fn()
}));

describe('Rollback when budget update fails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should rollback all player updates when budget update fails', async () => {
    const { getTournamentDb } = await import('../../lib/neon/tournament-config');
    const { adminDb } = await import('../../lib/firebase/admin');
    const { validateTransferLimit } = await import('../../lib/transfer-limits');
    
    let updateCallCount = 0;
    
    // Mock successful player data fetch and updates
    const mockQuery = vi.fn()
      .mockResolvedValueOnce([{ // Fetch current season player
        id: '1',
        player_id: 'SSPSPL0001',
        player_name: 'Test Player',
        team_id: 'SSPSLT0001',
        auction_value: 225,
        star_rating: 5,
        points: 180,
        salary_per_match: 5.0,
        season_id: 'SSPSLS16'
      }])
      .mockResolvedValueOnce([{ // Fetch future seasons
        id: '1',
        player_id: 'SSPSPL0001',
        player_name: 'Test Player',
        team_id: 'SSPSLT0001',
        auction_value: 225,
        star_rating: 5,
        points: 180,
        salary_per_match: 5.0,
        season_id: 'SSPSLS16'
      }, {
        id: '2',
        player_id: 'SSPSPL0001',
        player_name: 'Test Player',
        team_id: 'SSPSLT0001',
        auction_value: 225,
        star_rating: 5,
        points: 180,
        salary_per_match: 5.0,
        season_id: 'SSPSLS17'
      }])
      .mockResolvedValueOnce(undefined) // BEGIN transaction
      .mockResolvedValueOnce(undefined) // UPDATE S16
      .mockResolvedValueOnce(undefined) // UPDATE S17
      .mockResolvedValueOnce(undefined) // COMMIT transaction
      // Rollback queries
      .mockResolvedValueOnce(undefined) // UPDATE S16 rollback
      .mockResolvedValueOnce(undefined); // UPDATE S17 rollback
    
    (getTournamentDb as any).mockReturnValue({ query: mockQuery });
    
    // Mock team balance checks (successful)
    const mockGet = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        real_player_budget: 1000,
        real_player_spent: 0
      })
    });
    
    // Mock budget update to fail
    const mockUpdate = vi.fn().mockImplementation(() => {
      updateCallCount++;
      if (updateCallCount <= 2) {
        // First two calls are for budget update (both teams) - fail these
        return Promise.reject(new Error('Firestore update failed'));
      }
      // Subsequent calls are for rollback - succeed
      return Promise.resolve(undefined);
    });
    
    (adminDb.collection as any).mockReturnValue({
      doc: vi.fn(() => ({
        get: mockGet,
        update: mockUpdate,
        set: vi.fn().mockResolvedValue(undefined)
      })),
      where: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({ docs: [] })
      }))
    });
    
    // Mock transfer limit validation
    (validateTransferLimit as any).mockResolvedValue({
      valid: true,
      message: 'Transfer allowed'
    });
    
    const consoleSpy = vi.spyOn(console, 'log');
    const consoleErrorSpy = vi.spyOn(console, 'error');
    
    const request: TransferRequest = {
      playerId: 'SSPSPL0001',
      playerType: 'real',
      newTeamId: 'SSPSLT0002',
      seasonId: 'SSPSLS16',
      transferredBy: 'admin',
      transferredByName: 'Admin'
    };
    
    const result = await executeTransferV2(request);
    
    // Transfer should fail
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('SYSTEM_ERROR');
    
    // Verify rollback was initiated
    const rollbackLogs = consoleSpy.mock.calls
      .map(call => call[0])
      .filter(log => typeof log === 'string' && log.includes('Rolling back'));
    
    expect(rollbackLogs.length).toBeGreaterThan(0);
    
    // Verify affected seasons were logged
    const affectedSeasonsLog = consoleSpy.mock.calls
      .map(call => call[0])
      .find(log => typeof log === 'string' && log.includes('Affected seasons'));
    
    expect(affectedSeasonsLog).toBeDefined();
    expect(affectedSeasonsLog).toContain('SSPSLS16');
    expect(affectedSeasonsLog).toContain('SSPSLS17');
    
    // Verify rollback completion was logged
    const rollbackCompletionLog = consoleSpy.mock.calls
      .map(call => call[0])
      .find(log => typeof log === 'string' && log.includes('Rollback completed'));
    
    expect(rollbackCompletionLog).toBeDefined();
  });
});
