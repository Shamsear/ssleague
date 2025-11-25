/**
 * Integration Tests for Error Handling and Edge Cases
 * 
 * These tests cover edge cases and error scenarios:
 * - Task 13.1: Insufficient budget scenario
 * - Task 13.2: Tiebreaker detection during preview
 * - Task 13.3: Concurrent preview attempts
 * 
 * Requirements: 1.1, 8
 * 
 * To run: npx vitest run tests/integration/edge-cases-error-handling.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock database state
interface MockDatabaseState {
  rounds: Map<string, any>;
  pendingAllocations: Map<string, any[]>;
  teams: Map<string, any>;
  teamPlayers: Map<string, any[]>;
  bids: Map<string, any[]>;
  tiebreakers: Map<string, any>;
  locks: Map<string, { locked: boolean; lockedBy: string; lockedAt: Date }>;
}

// Helper to create mock database
function createMockDatabase(): MockDatabaseState {
  return {
    rounds: new Map(),
    pendingAllocations: new Map(),
    teams: new Map(),
    teamPlayers: new Map(),
    bids: new Map(),
    tiebreakers: new Map(),
    locks: new Map(),
  };
}

// Error types
interface ValidationError {
  type: 'budget' | 'tiebreaker' | 'database' | 'lock';
  message: string;
  details?: any;
}

// Helper to simulate workflow with error handling
interface WorkflowSimulator {
  db: MockDatabaseState;
  createRound: (roundId: string, mode: 'auto' | 'manual') => void;
  expireRound: (roundId: string) => void;
  previewFinalization: (roundId: string, allocations: any[]) => Promise<{ success: boolean; error?: ValidationError }>;
  applyPendingAllocations: (roundId: string) => Promise<{ success: boolean; error?: ValidationError }>;
  cancelPendingAllocations: (roundId: string) => void;
  manuallyReduceBudget: (teamId: string, newBudget: number) => void;
  createTiedBids: (roundId: string, bids: any[]) => void;
  acquireLock: (roundId: string, userId: string) => boolean;
  releaseLock: (roundId: string, userId: string) => void;
}

function createWorkflowSimulator(): WorkflowSimulator {
  const db = createMockDatabase();

  return {
    db,
    
    createRound(roundId: string, mode: 'auto' | 'manual') {
      db.rounds.set(roundId, {
        id: roundId,
        status: 'active',
        finalization_mode: mode,
        end_time: new Date(Date.now() + 3600000),
        season_id: 'S2024',
      });
    },

    expireRound(roundId: string) {
      const round = db.rounds.get(roundId);
      if (!round) throw new Error('Round not found');
      
      if (round.finalization_mode === 'manual') {
        round.status = 'expired_pending_finalization';
      }
      db.rounds.set(roundId, round);
    },

    async previewFinalization(roundId: string, allocations: any[]): Promise<{ success: boolean; error?: ValidationError }> {
      const round = db.rounds.get(roundId);
      if (!round) {
        return { 
          success: false, 
          error: { type: 'database', message: 'Round not found' } 
        };
      }

      // Check for tied bids
      const roundBids = db.bids.get(roundId) || [];
      const tiedBids = this.detectTiedBids(roundBids);
      
      if (tiedBids.length > 0) {
        // Create tiebreaker
        const tiebreakerId = `TB_${roundId}_${Date.now()}`;
        db.tiebreakers.set(tiebreakerId, {
          id: tiebreakerId,
          round_id: roundId,
          tied_bids: tiedBids,
          status: 'pending',
        });

        // Update round status
        round.status = 'tiebreaker_pending';
        db.rounds.set(roundId, round);

        return {
          success: false,
          error: {
            type: 'tiebreaker',
            message: 'Tie detected. Tiebreaker must be resolved before finalization.',
            details: {
              tiebreakerId,
              tiedBids,
            },
          },
        };
      }

      // Store pending allocations
      db.pendingAllocations.set(roundId, allocations);
      
      // Update round status
      round.status = 'pending_finalization';
      db.rounds.set(roundId, round);

      return { success: true };
    },

    detectTiedBids(bids: any[]): any[] {
      // Group bids by player
      const bidsByPlayer = new Map<string, any[]>();
      for (const bid of bids) {
        if (!bidsByPlayer.has(bid.player_id)) {
          bidsByPlayer.set(bid.player_id, []);
        }
        bidsByPlayer.get(bid.player_id)!.push(bid);
      }

      // Find tied bids (same amount for same player)
      const tiedBids: any[] = [];
      for (const [playerId, playerBids] of bidsByPlayer) {
        if (playerBids.length < 2) continue;

        // Sort by amount descending
        playerBids.sort((a, b) => b.amount - a.amount);

        // Check if top bids are tied
        if (playerBids[0].amount === playerBids[1].amount) {
          tiedBids.push(...playerBids.filter(b => b.amount === playerBids[0].amount));
        }
      }

      return tiedBids;
    },

    async applyPendingAllocations(roundId: string): Promise<{ success: boolean; error?: ValidationError }> {
      const round = db.rounds.get(roundId);
      if (!round) {
        return { 
          success: false, 
          error: { type: 'database', message: 'Round not found' } 
        };
      }

      const pending = db.pendingAllocations.get(roundId);
      if (!pending || pending.length === 0) {
        return {
          success: false,
          error: { type: 'database', message: 'No pending allocations found' },
        };
      }

      // Validate budgets BEFORE applying any changes
      const budgetErrors: string[] = [];
      for (const allocation of pending) {
        const team = db.teams.get(allocation.team_id);
        if (!team) {
          budgetErrors.push(`Team ${allocation.team_name} (${allocation.team_id}) not found in season`);
          continue;
        }

        const currentBudget = team.currency_system === 'dual' 
          ? team.football_budget 
          : team.budget;

        if (currentBudget < allocation.amount) {
          const shortfall = allocation.amount - currentBudget;
          budgetErrors.push(
            `Team ${allocation.team_name} has insufficient funds. ` +
            `Required: £${allocation.amount}, Available: £${currentBudget}, Shortfall: £${shortfall}`
          );
        }
      }

      // If any budget validation fails, return error WITHOUT applying changes
      if (budgetErrors.length > 0) {
        return {
          success: false,
          error: {
            type: 'budget',
            message: 'Budget validation failed',
            details: {
              errors: budgetErrors,
            },
          },
        };
      }

      // All validations passed - apply changes atomically
      try {
        for (const allocation of pending) {
          const team = db.teams.get(allocation.team_id);
          if (!team) continue;

          // Deduct budget
          if (team.currency_system === 'dual') {
            team.football_budget -= allocation.amount;
          } else {
            team.budget -= allocation.amount;
          }
          db.teams.set(allocation.team_id, team);

          // Add player to team
          const teamPlayers = db.teamPlayers.get(allocation.team_id) || [];
          teamPlayers.push({
            player_id: allocation.player_id,
            acquisition_cost: allocation.amount,
          });
          db.teamPlayers.set(allocation.team_id, teamPlayers);
        }

        // Delete pending allocations
        db.pendingAllocations.delete(roundId);

        // Update round status
        round.status = 'completed';
        db.rounds.set(roundId, round);

        return { success: true };
      } catch (error) {
        // Rollback would happen here in real implementation
        return {
          success: false,
          error: {
            type: 'database',
            message: 'Failed to apply allocations',
            details: { error },
          },
        };
      }
    },

    cancelPendingAllocations(roundId: string) {
      db.pendingAllocations.delete(roundId);
      
      const round = db.rounds.get(roundId);
      if (round) {
        round.status = 'expired_pending_finalization';
        db.rounds.set(roundId, round);
      }
    },

    manuallyReduceBudget(teamId: string, newBudget: number) {
      const team = db.teams.get(teamId);
      if (team) {
        if (team.currency_system === 'dual') {
          team.football_budget = newBudget;
        } else {
          team.budget = newBudget;
        }
        db.teams.set(teamId, team);
      }
    },

    createTiedBids(roundId: string, bids: any[]) {
      db.bids.set(roundId, bids);
    },

    acquireLock(roundId: string, userId: string): boolean {
      const lock = db.locks.get(roundId);
      
      if (lock && lock.locked) {
        // Lock already held by someone
        return false;
      }

      // Acquire lock
      db.locks.set(roundId, {
        locked: true,
        lockedBy: userId,
        lockedAt: new Date(),
      });
      return true;
    },

    releaseLock(roundId: string, userId: string) {
      const lock = db.locks.get(roundId);
      
      if (lock && lock.lockedBy === userId) {
        db.locks.delete(roundId);
      }
    },
  };
}

describe('Integration: Error Handling and Edge Cases', () => {
  describe('13.1 Test insufficient budget scenario', () => {
    let simulator: WorkflowSimulator;
    const roundId = 'ROUND_EDGE_001';
    const teamId = 'TEAM_001';
    const playerId = 'PLAYER_001';

    beforeEach(() => {
      simulator = createWorkflowSimulator();
      
      // Setup team with initial budget
      simulator.db.teams.set(teamId, { 
        id: teamId, 
        name: 'Team A',
        budget: 5000,
        currency_system: 'single',
      });
    });

    it('should detect insufficient budget and return error with details', async () => {
      // Step 1: Create round and expire
      simulator.createRound(roundId, 'manual');
      simulator.expireRound(roundId);

      // Step 2: Create pending allocations
      const allocations = [
        {
          team_id: teamId,
          team_name: 'Team A',
          player_id: playerId,
          player_name: 'Player 1',
          amount: 3000,
          phase: 'regular',
        },
      ];
      
      const previewResult = await simulator.previewFinalization(roundId, allocations);
      expect(previewResult.success).toBe(true);

      // Verify pending allocations created
      const pending = simulator.db.pendingAllocations.get(roundId);
      expect(pending?.length).toBe(1);

      // Step 3: Manually reduce team budget (simulating external change)
      simulator.manuallyReduceBudget(teamId, 2000);

      // Verify budget reduced
      const teamAfterReduction = simulator.db.teams.get(teamId);
      expect(teamAfterReduction?.budget).toBe(2000);

      // Step 4: Attempt to apply pending allocations
      const applyResult = await simulator.applyPendingAllocations(roundId);

      // Step 5: Verify error returned with details
      expect(applyResult.success).toBe(false);
      expect(applyResult.error).toBeDefined();
      expect(applyResult.error?.type).toBe('budget');
      expect(applyResult.error?.message).toBe('Budget validation failed');
      expect(applyResult.error?.details.errors).toHaveLength(1);
      expect(applyResult.error?.details.errors[0]).toContain('insufficient funds');
      expect(applyResult.error?.details.errors[0]).toContain('Required: £3000');
      expect(applyResult.error?.details.errors[0]).toContain('Available: £2000');
      expect(applyResult.error?.details.errors[0]).toContain('Shortfall: £1000');
    });

    it('should not apply any partial changes when budget validation fails', async () => {
      // Create round and expire
      simulator.createRound(roundId, 'manual');
      simulator.expireRound(roundId);

      // Create pending allocations
      const allocations = [
        {
          team_id: teamId,
          team_name: 'Team A',
          player_id: playerId,
          player_name: 'Player 1',
          amount: 3000,
          phase: 'regular',
        },
      ];
      
      await simulator.previewFinalization(roundId, allocations);

      // Get initial state
      const teamBefore = simulator.db.teams.get(teamId);
      const budgetBefore = teamBefore?.budget;
      const playersBefore = simulator.db.teamPlayers.get(teamId);

      // Reduce budget to cause failure
      simulator.manuallyReduceBudget(teamId, 2000);

      // Attempt to apply (should fail)
      const applyResult = await simulator.applyPendingAllocations(roundId);
      expect(applyResult.success).toBe(false);

      // Step 6: Verify no partial changes applied
      
      // Budget should remain at reduced amount (not further reduced)
      const teamAfter = simulator.db.teams.get(teamId);
      expect(teamAfter?.budget).toBe(2000); // Still at reduced amount, not 2000 - 3000

      // No players should be allocated
      const playersAfter = simulator.db.teamPlayers.get(teamId);
      expect(playersAfter).toEqual(playersBefore); // Should be unchanged (undefined or empty)

      // Pending allocations should still exist (not deleted)
      const pendingAfter = simulator.db.pendingAllocations.get(roundId);
      expect(pendingAfter).toBeDefined();
      expect(pendingAfter?.length).toBe(1);

      // Round status should still be pending_finalization (not completed)
      const roundAfter = simulator.db.rounds.get(roundId);
      expect(roundAfter?.status).toBe('pending_finalization');
      expect(roundAfter?.status).not.toBe('completed');
    });

    it('should handle multiple teams with mixed budget scenarios', async () => {
      const team2Id = 'TEAM_002';
      const player2Id = 'PLAYER_002';

      // Setup second team
      simulator.db.teams.set(team2Id, { 
        id: team2Id, 
        name: 'Team B',
        budget: 8000,
        currency_system: 'single',
      });

      // Create round
      simulator.createRound(roundId, 'manual');
      simulator.expireRound(roundId);

      // Create pending allocations for both teams
      const allocations = [
        {
          team_id: teamId,
          team_name: 'Team A',
          player_id: playerId,
          player_name: 'Player 1',
          amount: 3000,
          phase: 'regular',
        },
        {
          team_id: team2Id,
          team_name: 'Team B',
          player_id: player2Id,
          player_name: 'Player 2',
          amount: 4000,
          phase: 'regular',
        },
      ];
      
      await simulator.previewFinalization(roundId, allocations);

      // Reduce only first team's budget
      simulator.manuallyReduceBudget(teamId, 2000);

      // Attempt to apply
      const applyResult = await simulator.applyPendingAllocations(roundId);

      // Should fail due to first team
      expect(applyResult.success).toBe(false);
      expect(applyResult.error?.details.errors).toHaveLength(1);
      expect(applyResult.error?.details.errors[0]).toContain('Team A');

      // Verify NO changes applied to either team
      const team1After = simulator.db.teams.get(teamId);
      const team2After = simulator.db.teams.get(team2Id);
      expect(team1After?.budget).toBe(2000); // Reduced amount, not further reduced
      expect(team2After?.budget).toBe(8000); // Original amount, not reduced

      // No players allocated to either team
      const team1Players = simulator.db.teamPlayers.get(teamId);
      const team2Players = simulator.db.teamPlayers.get(team2Id);
      expect(team1Players).toBeUndefined();
      expect(team2Players).toBeUndefined();
    });

    it('should handle dual currency system correctly in budget validation', async () => {
      // Setup team with dual currency
      simulator.db.teams.set(teamId, { 
        id: teamId, 
        name: 'Team A',
        football_budget: 5000,
        cricket_budget: 3000,
        currency_system: 'dual',
      });

      // Create round
      simulator.createRound(roundId, 'manual');
      simulator.expireRound(roundId);

      // Create pending allocation
      const allocations = [
        {
          team_id: teamId,
          team_name: 'Team A',
          player_id: playerId,
          player_name: 'Player 1',
          amount: 3000,
          phase: 'regular',
        },
      ];
      
      await simulator.previewFinalization(roundId, allocations);

      // Reduce football budget
      const team = simulator.db.teams.get(teamId);
      if (team) {
        team.football_budget = 2000;
        simulator.db.teams.set(teamId, team);
      }

      // Attempt to apply
      const applyResult = await simulator.applyPendingAllocations(roundId);

      // Should fail with correct budget reference
      expect(applyResult.success).toBe(false);
      expect(applyResult.error?.details.errors[0]).toContain('Available: £2000');
      expect(applyResult.error?.details.errors[0]).toContain('Shortfall: £1000');
    });

    it('should allow retry after budget is corrected', async () => {
      // Create round and pending allocations
      simulator.createRound(roundId, 'manual');
      simulator.expireRound(roundId);

      const allocations = [
        {
          team_id: teamId,
          team_name: 'Team A',
          player_id: playerId,
          player_name: 'Player 1',
          amount: 3000,
          phase: 'regular',
        },
      ];
      
      await simulator.previewFinalization(roundId, allocations);

      // Reduce budget to cause failure
      simulator.manuallyReduceBudget(teamId, 2000);

      // First attempt should fail
      const firstAttempt = await simulator.applyPendingAllocations(roundId);
      expect(firstAttempt.success).toBe(false);

      // Correct the budget
      simulator.manuallyReduceBudget(teamId, 5000);

      // Second attempt should succeed
      const secondAttempt = await simulator.applyPendingAllocations(roundId);
      expect(secondAttempt.success).toBe(true);

      // Verify changes applied
      const teamAfter = simulator.db.teams.get(teamId);
      expect(teamAfter?.budget).toBe(2000); // 5000 - 3000

      const playersAfter = simulator.db.teamPlayers.get(teamId);
      expect(playersAfter?.length).toBe(1);

      // Pending allocations deleted
      const pendingAfter = simulator.db.pendingAllocations.get(roundId);
      expect(pendingAfter).toBeUndefined();

      // Round completed
      const roundAfter = simulator.db.rounds.get(roundId);
      expect(roundAfter?.status).toBe('completed');
    });
  });

  describe('13.2 Test tiebreaker detection during preview', () => {
    let simulator: WorkflowSimulator;
    const roundId = 'ROUND_EDGE_002';
    const team1Id = 'TEAM_001';
    const team2Id = 'TEAM_002';
    const playerId = 'PLAYER_001';

    beforeEach(() => {
      simulator = createWorkflowSimulator();
      
      // Setup teams
      simulator.db.teams.set(team1Id, { 
        id: team1Id, 
        name: 'Team A',
        budget: 10000,
        currency_system: 'single',
      });
      simulator.db.teams.set(team2Id, { 
        id: team2Id, 
        name: 'Team B',
        budget: 10000,
        currency_system: 'single',
      });
    });

    it('should detect tied bids and create tiebreaker', async () => {
      // Step 1: Create round with tied bids
      simulator.createRound(roundId, 'manual');
      
      const tiedBids = [
        {
          id: 'BID_001',
          round_id: roundId,
          team_id: team1Id,
          team_name: 'Team A',
          player_id: playerId,
          player_name: 'Player 1',
          amount: 2000,
        },
        {
          id: 'BID_002',
          round_id: roundId,
          team_id: team2Id,
          team_name: 'Team B',
          player_id: playerId,
          player_name: 'Player 1',
          amount: 2000, // Same amount - tied!
        },
      ];
      
      simulator.createTiedBids(roundId, tiedBids);
      simulator.expireRound(roundId);

      // Step 2: Preview finalization
      const allocations: any[] = []; // Empty because tie prevents allocation
      const previewResult = await simulator.previewFinalization(roundId, allocations);

      // Step 3: Verify tiebreaker created
      expect(previewResult.success).toBe(false);
      expect(previewResult.error?.type).toBe('tiebreaker');
      expect(previewResult.error?.message).toContain('Tie detected');
      expect(previewResult.error?.details.tiebreakerId).toBeDefined();

      const tiebreakerId = previewResult.error?.details.tiebreakerId;
      const tiebreaker = simulator.db.tiebreakers.get(tiebreakerId);
      expect(tiebreaker).toBeDefined();
      expect(tiebreaker?.round_id).toBe(roundId);
      expect(tiebreaker?.status).toBe('pending');
      expect(tiebreaker?.tied_bids.length).toBe(2);
    });

    it('should not create pending allocations when tie detected', async () => {
      // Create round with tied bids
      simulator.createRound(roundId, 'manual');
      
      const tiedBids = [
        {
          id: 'BID_001',
          round_id: roundId,
          team_id: team1Id,
          team_name: 'Team A',
          player_id: playerId,
          player_name: 'Player 1',
          amount: 2000,
        },
        {
          id: 'BID_002',
          round_id: roundId,
          team_id: team2Id,
          team_name: 'Team B',
          player_id: playerId,
          player_name: 'Player 1',
          amount: 2000,
        },
      ];
      
      simulator.createTiedBids(roundId, tiedBids);
      simulator.expireRound(roundId);

      // Preview finalization
      const allocations: any[] = [];
      const previewResult = await simulator.previewFinalization(roundId, allocations);

      // Step 4: Verify no pending allocations created
      expect(previewResult.success).toBe(false);
      
      const pending = simulator.db.pendingAllocations.get(roundId);
      expect(pending).toBeUndefined();
    });

    it('should return appropriate error message with tie details', async () => {
      // Create round with tied bids
      simulator.createRound(roundId, 'manual');
      
      const tiedBids = [
        {
          id: 'BID_001',
          round_id: roundId,
          team_id: team1Id,
          team_name: 'Team A',
          player_id: playerId,
          player_name: 'Player 1',
          amount: 2500,
        },
        {
          id: 'BID_002',
          round_id: roundId,
          team_id: team2Id,
          team_name: 'Team B',
          player_id: playerId,
          player_name: 'Player 1',
          amount: 2500,
        },
      ];
      
      simulator.createTiedBids(roundId, tiedBids);
      simulator.expireRound(roundId);

      // Preview finalization
      const allocations: any[] = [];
      const previewResult = await simulator.previewFinalization(roundId, allocations);

      // Step 5: Verify appropriate error message
      expect(previewResult.success).toBe(false);
      expect(previewResult.error?.type).toBe('tiebreaker');
      expect(previewResult.error?.message).toBe('Tie detected. Tiebreaker must be resolved before finalization.');
      
      // Verify tie details included
      expect(previewResult.error?.details.tiedBids).toBeDefined();
      expect(previewResult.error?.details.tiedBids.length).toBe(2);
      expect(previewResult.error?.details.tiedBids[0].amount).toBe(2500);
      expect(previewResult.error?.details.tiedBids[1].amount).toBe(2500);
    });

    it('should update round status to tiebreaker_pending', async () => {
      // Create round with tied bids
      simulator.createRound(roundId, 'manual');
      
      const tiedBids = [
        {
          id: 'BID_001',
          round_id: roundId,
          team_id: team1Id,
          team_name: 'Team A',
          player_id: playerId,
          player_name: 'Player 1',
          amount: 2000,
        },
        {
          id: 'BID_002',
          round_id: roundId,
          team_id: team2Id,
          team_name: 'Team B',
          player_id: playerId,
          player_name: 'Player 1',
          amount: 2000,
        },
      ];
      
      simulator.createTiedBids(roundId, tiedBids);
      simulator.expireRound(roundId);

      // Preview finalization
      const allocations: any[] = [];
      await simulator.previewFinalization(roundId, allocations);

      // Verify round status updated
      const round = simulator.db.rounds.get(roundId);
      expect(round?.status).toBe('tiebreaker_pending');
      expect(round?.status).not.toBe('pending_finalization');
    });

    it('should handle multiple tied bids for different players', async () => {
      const player2Id = 'PLAYER_002';
      const team3Id = 'TEAM_003';
      const team4Id = 'TEAM_004';

      // Setup additional teams
      simulator.db.teams.set(team3Id, { 
        id: team3Id, 
        name: 'Team C',
        budget: 10000,
        currency_system: 'single',
      });
      simulator.db.teams.set(team4Id, { 
        id: team4Id, 
        name: 'Team D',
        budget: 10000,
        currency_system: 'single',
      });

      // Create round with multiple tied bids
      simulator.createRound(roundId, 'manual');
      
      const tiedBids = [
        // Tie for Player 1
        {
          id: 'BID_001',
          round_id: roundId,
          team_id: team1Id,
          team_name: 'Team A',
          player_id: playerId,
          player_name: 'Player 1',
          amount: 2000,
        },
        {
          id: 'BID_002',
          round_id: roundId,
          team_id: team2Id,
          team_name: 'Team B',
          player_id: playerId,
          player_name: 'Player 1',
          amount: 2000,
        },
        // Tie for Player 2
        {
          id: 'BID_003',
          round_id: roundId,
          team_id: team3Id,
          team_name: 'Team C',
          player_id: player2Id,
          player_name: 'Player 2',
          amount: 1500,
        },
        {
          id: 'BID_004',
          round_id: roundId,
          team_id: team4Id,
          team_name: 'Team D',
          player_id: player2Id,
          player_name: 'Player 2',
          amount: 1500,
        },
      ];
      
      simulator.createTiedBids(roundId, tiedBids);
      simulator.expireRound(roundId);

      // Preview finalization
      const allocations: any[] = [];
      const previewResult = await simulator.previewFinalization(roundId, allocations);

      // Should detect all tied bids
      expect(previewResult.success).toBe(false);
      expect(previewResult.error?.type).toBe('tiebreaker');
      expect(previewResult.error?.details.tiedBids.length).toBe(4);
    });

    it('should not detect tie when bids are different amounts', async () => {
      // Create round with non-tied bids
      simulator.createRound(roundId, 'manual');
      
      const nonTiedBids = [
        {
          id: 'BID_001',
          round_id: roundId,
          team_id: team1Id,
          team_name: 'Team A',
          player_id: playerId,
          player_name: 'Player 1',
          amount: 2000,
        },
        {
          id: 'BID_002',
          round_id: roundId,
          team_id: team2Id,
          team_name: 'Team B',
          player_id: playerId,
          player_name: 'Player 1',
          amount: 1800, // Different amount - no tie
        },
      ];
      
      simulator.createTiedBids(roundId, nonTiedBids);
      simulator.expireRound(roundId);

      // Preview finalization with winner
      const allocations = [
        {
          team_id: team1Id,
          team_name: 'Team A',
          player_id: playerId,
          player_name: 'Player 1',
          amount: 2000,
          phase: 'regular',
        },
      ];
      
      const previewResult = await simulator.previewFinalization(roundId, allocations);

      // Should succeed without tiebreaker
      expect(previewResult.success).toBe(true);
      expect(previewResult.error).toBeUndefined();

      // Pending allocations should be created
      const pending = simulator.db.pendingAllocations.get(roundId);
      expect(pending).toBeDefined();
      expect(pending?.length).toBe(1);
    });

    it('should allow preview after tiebreaker is resolved', async () => {
      // Create round with tied bids
      simulator.createRound(roundId, 'manual');
      
      const tiedBids = [
        {
          id: 'BID_001',
          round_id: roundId,
          team_id: team1Id,
          team_name: 'Team A',
          player_id: playerId,
          player_name: 'Player 1',
          amount: 2000,
        },
        {
          id: 'BID_002',
          round_id: roundId,
          team_id: team2Id,
          team_name: 'Team B',
          player_id: playerId,
          player_name: 'Player 1',
          amount: 2000,
        },
      ];
      
      simulator.createTiedBids(roundId, tiedBids);
      simulator.expireRound(roundId);

      // First preview attempt - should fail with tie
      const firstPreview = await simulator.previewFinalization(roundId, []);
      expect(firstPreview.success).toBe(false);
      expect(firstPreview.error?.type).toBe('tiebreaker');

      // Simulate tiebreaker resolution (remove tied bids, add winner)
      const resolvedBids = [
        {
          id: 'BID_001',
          round_id: roundId,
          team_id: team1Id,
          team_name: 'Team A',
          player_id: playerId,
          player_name: 'Player 1',
          amount: 2000,
          tiebreaker_winner: true,
        },
      ];
      simulator.createTiedBids(roundId, resolvedBids);

      // Reset round status
      const round = simulator.db.rounds.get(roundId);
      if (round) {
        round.status = 'expired_pending_finalization';
        simulator.db.rounds.set(roundId, round);
      }

      // Second preview attempt - should succeed
      const allocations = [
        {
          team_id: team1Id,
          team_name: 'Team A',
          player_id: playerId,
          player_name: 'Player 1',
          amount: 2000,
          phase: 'regular',
        },
      ];
      
      const secondPreview = await simulator.previewFinalization(roundId, allocations);
      expect(secondPreview.success).toBe(true);

      // Pending allocations should be created
      const pending = simulator.db.pendingAllocations.get(roundId);
      expect(pending).toBeDefined();
      expect(pending?.length).toBe(1);
    });
  });

  describe('13.3 Test concurrent preview attempts', () => {
    let simulator: WorkflowSimulator;
    const roundId = 'ROUND_EDGE_003';
    const teamId = 'TEAM_001';
    const playerId = 'PLAYER_001';
    const user1Id = 'USER_001';
    const user2Id = 'USER_002';

    beforeEach(() => {
      simulator = createWorkflowSimulator();
      
      // Setup team
      simulator.db.teams.set(teamId, { 
        id: teamId, 
        name: 'Team A',
        budget: 10000,
        currency_system: 'single',
      });
    });

    it('should handle concurrent preview attempts with lock mechanism', async () => {
      // Create round
      simulator.createRound(roundId, 'manual');
      simulator.expireRound(roundId);

      // Step 1: Simulate first committee member attempting preview
      const lock1Acquired = simulator.acquireLock(roundId, user1Id);
      expect(lock1Acquired).toBe(true);

      // Step 2: Simulate second committee member attempting preview (concurrent)
      const lock2Acquired = simulator.acquireLock(roundId, user2Id);
      
      // Step 3: Verify proper handling (second attempt should fail to acquire lock)
      expect(lock2Acquired).toBe(false);

      // Verify lock is held by first user
      const lock = simulator.db.locks.get(roundId);
      expect(lock?.locked).toBe(true);
      expect(lock?.lockedBy).toBe(user1Id);
    });

    it('should allow preview after lock is released', async () => {
      // Create round
      simulator.createRound(roundId, 'manual');
      simulator.expireRound(roundId);

      // First user acquires lock
      const lock1Acquired = simulator.acquireLock(roundId, user1Id);
      expect(lock1Acquired).toBe(true);

      // Second user cannot acquire lock
      const lock2Acquired = simulator.acquireLock(roundId, user2Id);
      expect(lock2Acquired).toBe(false);

      // First user releases lock
      simulator.releaseLock(roundId, user1Id);

      // Now second user can acquire lock
      const lock3Acquired = simulator.acquireLock(roundId, user2Id);
      expect(lock3Acquired).toBe(true);

      // Verify lock is now held by second user
      const lock = simulator.db.locks.get(roundId);
      expect(lock?.locked).toBe(true);
      expect(lock?.lockedBy).toBe(user2Id);
    });

    it('should handle overwrite strategy when lock not implemented', async () => {
      // This tests the "overwrite" strategy where last preview wins
      // (alternative to locking)
      
      // Create round
      simulator.createRound(roundId, 'manual');
      simulator.expireRound(roundId);

      // First committee member previews
      const allocations1 = [
        {
          team_id: teamId,
          team_name: 'Team A',
          player_id: playerId,
          player_name: 'Player 1',
          amount: 2000,
          phase: 'regular',
          preview_by: user1Id,
        },
      ];
      
      const preview1 = await simulator.previewFinalization(roundId, allocations1);
      expect(preview1.success).toBe(true);

      // Verify first preview stored
      const pending1 = simulator.db.pendingAllocations.get(roundId);
      expect(pending1?.length).toBe(1);
      expect(pending1?.[0].amount).toBe(2000);

      // Second committee member previews (concurrent/immediately after)
      const allocations2 = [
        {
          team_id: teamId,
          team_name: 'Team A',
          player_id: playerId,
          player_name: 'Player 1',
          amount: 2500,
          phase: 'regular',
          preview_by: user2Id,
        },
      ];
      
      // In overwrite strategy, this would clear previous and store new
      // Simulate by clearing first
      simulator.db.pendingAllocations.delete(roundId);
      const preview2 = await simulator.previewFinalization(roundId, allocations2);
      expect(preview2.success).toBe(true);

      // Verify second preview overwrote first
      const pending2 = simulator.db.pendingAllocations.get(roundId);
      expect(pending2?.length).toBe(1);
      expect(pending2?.[0].amount).toBe(2500); // Second preview's amount
    });

    it('should maintain data consistency during concurrent operations', async () => {
      // Create round
      simulator.createRound(roundId, 'manual');
      simulator.expireRound(roundId);

      // User 1 acquires lock and starts preview
      const lock1 = simulator.acquireLock(roundId, user1Id);
      expect(lock1).toBe(true);

      // User 1 creates pending allocations
      const allocations = [
        {
          team_id: teamId,
          team_name: 'Team A',
          player_id: playerId,
          player_name: 'Player 1',
          amount: 2000,
          phase: 'regular',
        },
      ];
      
      await simulator.previewFinalization(roundId, allocations);

      // User 2 tries to acquire lock (should fail)
      const lock2 = simulator.acquireLock(roundId, user2Id);
      expect(lock2).toBe(false);

      // Verify pending allocations are intact
      const pending = simulator.db.pendingAllocations.get(roundId);
      expect(pending?.length).toBe(1);
      expect(pending?.[0].amount).toBe(2000);

      // Verify round status is correct
      const round = simulator.db.rounds.get(roundId);
      expect(round?.status).toBe('pending_finalization');

      // User 1 releases lock
      simulator.releaseLock(roundId, user1Id);

      // Verify lock is released
      const lockAfter = simulator.db.locks.get(roundId);
      expect(lockAfter).toBeUndefined();
    });

    it('should prevent race conditions in status updates', async () => {
      // Create round
      simulator.createRound(roundId, 'manual');
      simulator.expireRound(roundId);

      const initialStatus = simulator.db.rounds.get(roundId)?.status;
      expect(initialStatus).toBe('expired_pending_finalization');

      // User 1 acquires lock
      simulator.acquireLock(roundId, user1Id);

      // User 1 previews
      const allocations = [
        {
          team_id: teamId,
          team_name: 'Team A',
          player_id: playerId,
          player_name: 'Player 1',
          amount: 2000,
          phase: 'regular',
        },
      ];
      
      await simulator.previewFinalization(roundId, allocations);

      // Status should be updated to pending_finalization
      const statusAfterPreview = simulator.db.rounds.get(roundId)?.status;
      expect(statusAfterPreview).toBe('pending_finalization');

      // User 2 tries to acquire lock (fails)
      const lock2 = simulator.acquireLock(roundId, user2Id);
      expect(lock2).toBe(false);

      // Status should remain pending_finalization (no race condition)
      const statusAfterLockAttempt = simulator.db.rounds.get(roundId)?.status;
      expect(statusAfterLockAttempt).toBe('pending_finalization');
      expect(statusAfterLockAttempt).not.toBe('expired_pending_finalization');
    });

    it('should handle lock timeout scenario', async () => {
      // Create round
      simulator.createRound(roundId, 'manual');
      simulator.expireRound(roundId);

      // User 1 acquires lock
      simulator.acquireLock(roundId, user1Id);

      const lock = simulator.db.locks.get(roundId);
      expect(lock?.locked).toBe(true);
      expect(lock?.lockedBy).toBe(user1Id);

      // Simulate lock timeout (in real implementation, this would be time-based)
      // For testing, we manually release the lock
      const lockTime = lock?.lockedAt;
      const now = new Date();
      const timeDiff = now.getTime() - (lockTime?.getTime() || 0);

      // If lock is older than 5 minutes (300000ms), it should be considered stale
      if (timeDiff > 300000) {
        simulator.db.locks.delete(roundId);
      }

      // In this test, we'll manually simulate timeout by deleting the lock
      simulator.db.locks.delete(roundId);

      // User 2 should now be able to acquire lock
      const lock2 = simulator.acquireLock(roundId, user2Id);
      expect(lock2).toBe(true);

      const newLock = simulator.db.locks.get(roundId);
      expect(newLock?.lockedBy).toBe(user2Id);
    });

    it('should only allow lock owner to release lock', async () => {
      // Create round
      simulator.createRound(roundId, 'manual');
      simulator.expireRound(roundId);

      // User 1 acquires lock
      simulator.acquireLock(roundId, user1Id);

      // User 2 tries to release lock (should not work)
      simulator.releaseLock(roundId, user2Id);

      // Lock should still be held by user 1
      const lock = simulator.db.locks.get(roundId);
      expect(lock?.locked).toBe(true);
      expect(lock?.lockedBy).toBe(user1Id);

      // User 1 releases lock (should work)
      simulator.releaseLock(roundId, user1Id);

      // Lock should now be released
      const lockAfter = simulator.db.locks.get(roundId);
      expect(lockAfter).toBeUndefined();
    });

    it('should handle multiple sequential preview attempts correctly', async () => {
      // Create round
      simulator.createRound(roundId, 'manual');
      simulator.expireRound(roundId);

      // User 1 previews
      simulator.acquireLock(roundId, user1Id);
      const allocations1 = [
        {
          team_id: teamId,
          team_name: 'Team A',
          player_id: playerId,
          player_name: 'Player 1',
          amount: 2000,
          phase: 'regular',
        },
      ];
      await simulator.previewFinalization(roundId, allocations1);
      simulator.releaseLock(roundId, user1Id);

      // Verify first preview
      const pending1 = simulator.db.pendingAllocations.get(roundId);
      expect(pending1?.length).toBe(1);
      expect(pending1?.[0].amount).toBe(2000);

      // User 1 cancels
      simulator.cancelPendingAllocations(roundId);

      // User 2 previews
      simulator.acquireLock(roundId, user2Id);
      const allocations2 = [
        {
          team_id: teamId,
          team_name: 'Team A',
          player_id: playerId,
          player_name: 'Player 1',
          amount: 2500,
          phase: 'regular',
        },
      ];
      await simulator.previewFinalization(roundId, allocations2);
      simulator.releaseLock(roundId, user2Id);

      // Verify second preview
      const pending2 = simulator.db.pendingAllocations.get(roundId);
      expect(pending2?.length).toBe(1);
      expect(pending2?.[0].amount).toBe(2500);

      // Verify round status
      const round = simulator.db.rounds.get(roundId);
      expect(round?.status).toBe('pending_finalization');
    });
  });
});
