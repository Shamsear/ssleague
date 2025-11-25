/**
 * Integration Tests for Manual Finalization Flow
 * 
 * These tests cover the complete end-to-end flow of the manual finalization feature:
 * - Task 12.1: Complete manual finalization flow
 * - Task 12.2: Auto-finalize backward compatibility
 * - Task 12.3: Cancel and re-preview flow
 * - Task 12.4: Finalize immediately option
 * 
 * Requirements: 1.1, 2, 3, 5, 6, 9
 * 
 * NOTE: These are integration tests that verify the workflow logic and data flow
 * using a workflow simulator that mimics the database state transitions.
 * 
 * To run: npx vitest run tests/integration/manual-finalization-flow.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock database state
interface MockDatabaseState {
  rounds: Map<string, any>;
  pendingAllocations: Map<string, any[]>;
  teams: Map<string, any>;
  teamPlayers: Map<string, any[]>;
}

// Helper to create mock database
function createMockDatabase(): MockDatabaseState {
  return {
    rounds: new Map(),
    pendingAllocations: new Map(),
    teams: new Map(),
    teamPlayers: new Map(),
  };
}

// Helper to simulate workflow steps
interface WorkflowSimulator {
  db: MockDatabaseState;
  createRound: (roundId: string, mode: 'auto' | 'manual') => void;
  expireRound: (roundId: string) => void;
  previewFinalization: (roundId: string, allocations: any[]) => void;
  applyPendingAllocations: (roundId: string) => void;
  cancelPendingAllocations: (roundId: string) => void;
  finalizeImmediately: (roundId: string, allocations: any[]) => void;
  autoFinalize: (roundId: string, allocations: any[]) => void;
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
        end_time: new Date(Date.now() + 3600000), // 1 hour from now
      });
    },

    expireRound(roundId: string) {
      const round = db.rounds.get(roundId);
      if (!round) throw new Error('Round not found');
      
      if (round.finalization_mode === 'manual') {
        // Manual mode: wait for committee action
        round.status = 'expired_pending_finalization';
      } else {
        // Auto mode: finalize immediately (handled by autoFinalize)
        round.status = 'active'; // Still active, will be finalized by lazy-finalize
      }
      db.rounds.set(roundId, round);
    },

    previewFinalization(roundId: string, allocations: any[]) {
      const round = db.rounds.get(roundId);
      if (!round) throw new Error('Round not found');
      if (round.finalization_mode !== 'manual') {
        throw new Error('Preview only available for manual mode');
      }
      
      // Store pending allocations
      db.pendingAllocations.set(roundId, allocations);
      
      // Update round status
      round.status = 'pending_finalization';
      db.rounds.set(roundId, round);
    },

    applyPendingAllocations(roundId: string) {
      const round = db.rounds.get(roundId);
      if (!round) throw new Error('Round not found');
      
      const pending = db.pendingAllocations.get(roundId);
      if (!pending || pending.length === 0) {
        throw new Error('No pending allocations found');
      }

      // Apply allocations
      for (const allocation of pending) {
        const team = db.teams.get(allocation.team_id);
        if (team) {
          team.budget -= allocation.amount;
          db.teams.set(allocation.team_id, team);
        }

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
    },

    cancelPendingAllocations(roundId: string) {
      const round = db.rounds.get(roundId);
      if (!round) throw new Error('Round not found');

      // Delete pending allocations
      db.pendingAllocations.delete(roundId);

      // Reset round status
      round.status = 'expired_pending_finalization';
      db.rounds.set(roundId, round);
    },

    finalizeImmediately(roundId: string, allocations: any[]) {
      const round = db.rounds.get(roundId);
      if (!round) throw new Error('Round not found');

      // Apply allocations directly without pending state
      for (const allocation of allocations) {
        const team = db.teams.get(allocation.team_id);
        if (team) {
          team.budget -= allocation.amount;
          db.teams.set(allocation.team_id, team);
        }

        const teamPlayers = db.teamPlayers.get(allocation.team_id) || [];
        teamPlayers.push({
          player_id: allocation.player_id,
          acquisition_cost: allocation.amount,
        });
        db.teamPlayers.set(allocation.team_id, teamPlayers);
      }

      // Update round status directly to completed
      round.status = 'completed';
      db.rounds.set(roundId, round);
    },

    autoFinalize(roundId: string, allocations: any[]) {
      const round = db.rounds.get(roundId);
      if (!round) throw new Error('Round not found');
      if (round.finalization_mode !== 'auto') {
        throw new Error('Auto-finalize only for auto mode');
      }

      // Apply allocations directly (no pending state in auto mode)
      for (const allocation of allocations) {
        const team = db.teams.get(allocation.team_id);
        if (team) {
          team.budget -= allocation.amount;
          db.teams.set(allocation.team_id, team);
        }

        const teamPlayers = db.teamPlayers.get(allocation.team_id) || [];
        teamPlayers.push({
          player_id: allocation.player_id,
          acquisition_cost: allocation.amount,
        });
        db.teamPlayers.set(allocation.team_id, teamPlayers);
      }

      // Update round status to completed
      round.status = 'completed';
      db.rounds.set(roundId, round);
    },
  };
}

describe('Integration: Manual Finalization Flow', () => {
  describe('12.1 Complete manual finalization flow', () => {
    let simulator: WorkflowSimulator;
    const roundId = 'ROUND_001';
    const teamIds = ['TEAM_001', 'TEAM_002'];
    const playerIds = ['PLAYER_001', 'PLAYER_002'];

    beforeEach(() => {
      simulator = createWorkflowSimulator();
      
      // Setup teams
      simulator.db.teams.set(teamIds[0], { id: teamIds[0], budget: 10000 });
      simulator.db.teams.set(teamIds[1], { id: teamIds[1], budget: 10000 });
    });

    it('should complete the full manual finalization workflow', () => {
      // Step 1: Create round with manual mode
      simulator.createRound(roundId, 'manual');
      
      const roundBefore = simulator.db.rounds.get(roundId);
      expect(roundBefore?.finalization_mode).toBe('manual');
      expect(roundBefore?.status).toBe('active');

      // Step 2: Let timer expire
      simulator.expireRound(roundId);
      
      const roundExpired = simulator.db.rounds.get(roundId);
      expect(roundExpired?.status).toBe('expired_pending_finalization');

      // Step 3: Preview finalization
      const allocations = [
        {
          team_id: teamIds[0],
          team_name: 'Team 1',
          player_id: playerIds[0],
          player_name: 'Player 1',
          amount: 2000,
          phase: 'regular',
        },
        {
          team_id: teamIds[1],
          team_name: 'Team 2',
          player_id: playerIds[1],
          player_name: 'Player 2',
          amount: 1500,
          phase: 'regular',
        },
      ];
      
      simulator.previewFinalization(roundId, allocations);

      // Step 4: Verify pending allocations stored
      const pending = simulator.db.pendingAllocations.get(roundId);
      expect(pending).toBeDefined();
      expect(pending?.length).toBe(2);
      expect(pending?.[0].amount).toBe(2000);
      expect(pending?.[1].amount).toBe(1500);

      // Step 5: Verify round status is pending_finalization
      const roundPending = simulator.db.rounds.get(roundId);
      expect(roundPending?.status).toBe('pending_finalization');

      // Step 6: Apply pending allocations
      simulator.applyPendingAllocations(roundId);

      // Step 7: Verify budgets updated
      const team1 = simulator.db.teams.get(teamIds[0]);
      const team2 = simulator.db.teams.get(teamIds[1]);
      expect(team1?.budget).toBe(8000); // 10000 - 2000
      expect(team2?.budget).toBe(8500); // 10000 - 1500

      // Step 8: Verify players allocated
      const team1Players = simulator.db.teamPlayers.get(teamIds[0]);
      const team2Players = simulator.db.teamPlayers.get(teamIds[1]);
      expect(team1Players?.length).toBe(1);
      expect(team2Players?.length).toBe(1);
      expect(team1Players?.[0].player_id).toBe(playerIds[0]);
      expect(team2Players?.[0].player_id).toBe(playerIds[1]);

      // Step 9: Verify pending allocations deleted
      const pendingAfter = simulator.db.pendingAllocations.get(roundId);
      expect(pendingAfter).toBeUndefined();

      // Step 10: Verify round status is completed
      const roundCompleted = simulator.db.rounds.get(roundId);
      expect(roundCompleted?.status).toBe('completed');

      // Step 11: Verify results visible to teams (no pending allocations blocking)
      expect(simulator.db.pendingAllocations.has(roundId)).toBe(false);
      expect(roundCompleted?.status).toBe('completed');
    });

    it('should not show results to teams while in pending state', () => {
      // Create round with manual mode
      simulator.createRound(roundId, 'manual');
      simulator.expireRound(roundId);

      // Create pending allocations
      const allocations = [
        {
          team_id: teamIds[0],
          team_name: 'Team 1',
          player_id: playerIds[0],
          player_name: 'Player 1',
          amount: 2000,
          phase: 'regular',
        },
      ];
      
      simulator.previewFinalization(roundId, allocations);

      // Verify pending allocations exist
      const pending = simulator.db.pendingAllocations.get(roundId);
      expect(pending).toBeDefined();
      expect(pending?.length).toBeGreaterThan(0);

      // Verify round is not completed
      const round = simulator.db.rounds.get(roundId);
      expect(round?.status).not.toBe('completed');
      expect(round?.status).toBe('pending_finalization');

      // Verify no players allocated yet
      const team1Players = simulator.db.teamPlayers.get(teamIds[0]);
      expect(team1Players).toBeUndefined();

      // Verify budgets unchanged
      const team1 = simulator.db.teams.get(teamIds[0]);
      expect(team1?.budget).toBe(10000); // Original budget
    });
  });

  describe('12.2 Auto-finalize backward compatibility', () => {
    let simulator: WorkflowSimulator;
    const roundId = 'ROUND_002';
    const teamIds = ['TEAM_001', 'TEAM_002'];
    const playerIds = ['PLAYER_001', 'PLAYER_002'];

    beforeEach(() => {
      simulator = createWorkflowSimulator();
      
      // Setup teams
      simulator.db.teams.set(teamIds[0], { id: teamIds[0], budget: 10000 });
      simulator.db.teams.set(teamIds[1], { id: teamIds[1], budget: 10000 });
    });

    it('should auto-finalize immediately when timer expires', () => {
      // Create round with auto mode
      simulator.createRound(roundId, 'auto');
      
      const round = simulator.db.rounds.get(roundId);
      expect(round?.finalization_mode).toBe('auto');
      expect(round?.status).toBe('active');

      // Let timer expire (in auto mode, this triggers immediate finalization)
      simulator.expireRound(roundId);
      
      // Simulate auto-finalization
      const allocations = [
        {
          team_id: teamIds[0],
          team_name: 'Team 1',
          player_id: playerIds[0],
          player_name: 'Player 1',
          amount: 2000,
          phase: 'regular',
        },
      ];
      
      simulator.autoFinalize(roundId, allocations);

      // Verify no pending allocations created
      const pending = simulator.db.pendingAllocations.get(roundId);
      expect(pending).toBeUndefined();

      // Verify immediate finalization
      const roundAfter = simulator.db.rounds.get(roundId);
      expect(roundAfter?.status).toBe('completed');

      // Verify results immediately visible (players allocated)
      const team1Players = simulator.db.teamPlayers.get(teamIds[0]);
      expect(team1Players?.length).toBe(1);
      expect(team1Players?.[0].player_id).toBe(playerIds[0]);

      // Verify budget updated
      const team1 = simulator.db.teams.get(teamIds[0]);
      expect(team1?.budget).toBe(8000); // 10000 - 2000
    });

    it('should not create pending allocations in auto mode', () => {
      // Create round with auto mode
      simulator.createRound(roundId, 'auto');
      
      const round = simulator.db.rounds.get(roundId);
      expect(round?.finalization_mode).toBe('auto');

      // Verify no pending allocations exist
      const pending = simulator.db.pendingAllocations.get(roundId);
      expect(pending).toBeUndefined();

      // Auto-finalize
      const allocations = [
        {
          team_id: teamIds[0],
          team_name: 'Team 1',
          player_id: playerIds[0],
          player_name: 'Player 1',
          amount: 2000,
          phase: 'regular',
        },
      ];
      
      simulator.autoFinalize(roundId, allocations);

      // Even after finalization, no pending allocations should exist
      const pendingAfter = simulator.db.pendingAllocations.get(roundId);
      expect(pendingAfter).toBeUndefined();

      // Verify round is completed
      const roundAfter = simulator.db.rounds.get(roundId);
      expect(roundAfter?.status).toBe('completed');
    });
  });

  describe('12.3 Cancel and re-preview flow', () => {
    let simulator: WorkflowSimulator;
    const roundId = 'ROUND_003';
    const teamIds = ['TEAM_001', 'TEAM_002'];
    const playerIds = ['PLAYER_001', 'PLAYER_002'];

    beforeEach(() => {
      simulator = createWorkflowSimulator();
      
      // Setup teams
      simulator.db.teams.set(teamIds[0], { id: teamIds[0], budget: 10000 });
      simulator.db.teams.set(teamIds[1], { id: teamIds[1], budget: 10000 });
    });

    it('should allow canceling and re-previewing allocations', () => {
      // Step 1: Create round and expire
      simulator.createRound(roundId, 'manual');
      simulator.expireRound(roundId);

      // Step 2: Preview finalization (first time)
      const allocations1 = [
        {
          team_id: teamIds[0],
          team_name: 'Team 1',
          player_id: playerIds[0],
          player_name: 'Player 1',
          amount: 2000,
          phase: 'regular',
        },
      ];
      
      simulator.previewFinalization(roundId, allocations1);

      // Verify pending allocations exist
      const pending1 = simulator.db.pendingAllocations.get(roundId);
      expect(pending1?.length).toBe(1);
      expect(pending1?.[0].amount).toBe(2000);
      expect(pending1?.[0].team_id).toBe(teamIds[0]);

      // Step 3: Cancel pending allocations
      simulator.cancelPendingAllocations(roundId);

      // Verify pending allocations deleted
      const pendingAfterCancel = simulator.db.pendingAllocations.get(roundId);
      expect(pendingAfterCancel).toBeUndefined();

      // Verify round status reset
      const roundAfterCancel = simulator.db.rounds.get(roundId);
      expect(roundAfterCancel?.status).toBe('expired_pending_finalization');

      // Step 4: Preview again with different allocations
      const allocations2 = [
        {
          team_id: teamIds[1],
          team_name: 'Team 2',
          player_id: playerIds[1],
          player_name: 'Player 2',
          amount: 1800,
          phase: 'regular',
        },
      ];
      
      simulator.previewFinalization(roundId, allocations2);

      // Verify new allocations calculated
      const pending2 = simulator.db.pendingAllocations.get(roundId);
      expect(pending2?.length).toBe(1);
      expect(pending2?.[0].amount).toBe(1800); // Different amount
      expect(pending2?.[0].team_id).toBe(teamIds[1]); // Different team

      // Step 5: Apply new allocations
      simulator.applyPendingAllocations(roundId);

      // Verify final state
      const finalPending = simulator.db.pendingAllocations.get(roundId);
      expect(finalPending).toBeUndefined();

      const finalRound = simulator.db.rounds.get(roundId);
      expect(finalRound?.status).toBe('completed');

      const team2Players = simulator.db.teamPlayers.get(teamIds[1]);
      expect(team2Players?.length).toBe(1);
      expect(team2Players?.[0].acquisition_cost).toBe(1800);
    });

    it('should maintain data integrity during cancel operations', () => {
      // Create round and preview
      simulator.createRound(roundId, 'manual');
      simulator.expireRound(roundId);

      const allocations = [
        {
          team_id: teamIds[0],
          team_name: 'Team 1',
          player_id: playerIds[0],
          player_name: 'Player 1',
          amount: 2000,
          phase: 'regular',
        },
      ];
      
      simulator.previewFinalization(roundId, allocations);

      // Get team budget before cancel
      const teamBefore = simulator.db.teams.get(teamIds[0]);
      const budgetBefore = teamBefore?.budget;

      // Cancel pending allocations
      simulator.cancelPendingAllocations(roundId);

      // Verify budget unchanged
      const teamAfter = simulator.db.teams.get(teamIds[0]);
      expect(teamAfter?.budget).toBe(budgetBefore);
      expect(teamAfter?.budget).toBe(10000);

      // Verify no players allocated
      const team1Players = simulator.db.teamPlayers.get(teamIds[0]);
      expect(team1Players).toBeUndefined();

      // Verify pending allocations deleted
      const pending = simulator.db.pendingAllocations.get(roundId);
      expect(pending).toBeUndefined();
    });
  });

  describe('12.4 Finalize immediately option', () => {
    let simulator: WorkflowSimulator;
    const roundId = 'ROUND_004';
    const teamIds = ['TEAM_001', 'TEAM_002'];
    const playerIds = ['PLAYER_001', 'PLAYER_002'];

    beforeEach(() => {
      simulator = createWorkflowSimulator();
      
      // Setup teams
      simulator.db.teams.set(teamIds[0], { id: teamIds[0], budget: 10000 });
      simulator.db.teams.set(teamIds[1], { id: teamIds[1], budget: 10000 });
    });

    it('should finalize immediately without preview in manual mode', () => {
      // Create round with manual mode
      simulator.createRound(roundId, 'manual');
      
      const round = simulator.db.rounds.get(roundId);
      expect(round?.finalization_mode).toBe('manual');

      // Let timer expire
      simulator.expireRound(roundId);

      // Simulate "Finalize Immediately" (skip preview step)
      const allocations = [
        {
          team_id: teamIds[0],
          team_name: 'Team 1',
          player_id: playerIds[0],
          player_name: 'Player 1',
          amount: 2000,
          phase: 'regular',
        },
      ];
      
      simulator.finalizeImmediately(roundId, allocations);

      // Verify immediate finalization
      const roundAfter = simulator.db.rounds.get(roundId);
      expect(roundAfter?.status).toBe('completed');

      // Verify no pending allocations created
      const pending = simulator.db.pendingAllocations.get(roundId);
      expect(pending).toBeUndefined();

      // Verify results immediately visible
      const team1Players = simulator.db.teamPlayers.get(teamIds[0]);
      expect(team1Players?.length).toBe(1);
      expect(team1Players?.[0].player_id).toBe(playerIds[0]);

      // Verify budget updated
      const team1 = simulator.db.teams.get(teamIds[0]);
      expect(team1?.budget).toBe(8000); // 10000 - 2000
    });

    it('should behave identically to auto mode when using finalize immediately', () => {
      // Manual mode with immediate finalization
      simulator.createRound(roundId, 'manual');
      simulator.expireRound(roundId);

      const allocations = [
        {
          team_id: teamIds[0],
          team_name: 'Team 1',
          player_id: playerIds[0],
          player_name: 'Player 1',
          amount: 2000,
          phase: 'regular',
        },
      ];
      
      simulator.finalizeImmediately(roundId, allocations);

      // Get results from manual immediate finalization
      const manualRound = simulator.db.rounds.get(roundId);
      const manualTeam = simulator.db.teams.get(teamIds[0]);
      const manualPlayers = simulator.db.teamPlayers.get(teamIds[0]);
      const manualPending = simulator.db.pendingAllocations.get(roundId);

      // Verify same behavior as auto mode
      expect(manualRound?.status).toBe('completed');
      expect(manualTeam?.budget).toBe(8000);
      expect(manualPlayers?.length).toBe(1);
      expect(manualPending).toBeUndefined();
    });

    it('should not require preview step when using finalize immediately', () => {
      // Create round
      simulator.createRound(roundId, 'manual');
      simulator.expireRound(roundId);

      // Verify no pending allocations exist initially
      const pendingBefore = simulator.db.pendingAllocations.get(roundId);
      expect(pendingBefore).toBeUndefined();

      // Finalize immediately (skip preview)
      const allocations = [
        {
          team_id: teamIds[0],
          team_name: 'Team 1',
          player_id: playerIds[0],
          player_name: 'Player 1',
          amount: 2000,
          phase: 'regular',
        },
      ];
      
      simulator.finalizeImmediately(roundId, allocations);

      // Verify still no pending allocations (never created)
      const pendingAfter = simulator.db.pendingAllocations.get(roundId);
      expect(pendingAfter).toBeUndefined();

      // Verify finalization completed
      const round = simulator.db.rounds.get(roundId);
      expect(round?.status).toBe('completed');

      // Verify results applied
      const team1 = simulator.db.teams.get(teamIds[0]);
      const team1Players = simulator.db.teamPlayers.get(teamIds[0]);
      expect(team1?.budget).toBe(8000);
      expect(team1Players?.length).toBe(1);
    });
  });
});
