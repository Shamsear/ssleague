/**
 * Tests for Fantasy League Power-Ups System
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { neon } from '@neondatabase/serverless';
import {
  getPowerUpInventory,
  initializePowerUps,
  isPowerUpAvailable,
  isPowerUpActive,
  activatePowerUp,
  deactivatePowerUp,
  getPowerUpUsageHistory,
  getActivePowerUps,
  getCaptainMultiplier,
  isBenchBoostActive,
  isFreeHitActive,
  isWildcardActive,
  getPowerUpDisplayName,
  getPowerUpDescription,
  getPowerUpEmoji,
  validatePowerUpActivation,
  getTeamsWithActivePowerUps,
  PowerUpType
} from './power-ups';

const sql = neon(process.env.FANTASY_DATABASE_URL || process.env.NEON_DATABASE_URL!);

// Test data
const testLeagueId = `test_league_${Date.now()}`;
const testTeamId = `test_team_${Date.now()}`;
const testRoundId = `test_round_${Date.now()}`;

describe('Power-Ups System', () => {
  beforeEach(async () => {
    // Clean up any existing test data
    await sql`DELETE FROM fantasy_power_up_usage WHERE team_id = ${testTeamId}`;
    await sql`DELETE FROM fantasy_power_ups WHERE team_id = ${testTeamId}`;
  });

  afterEach(async () => {
    // Clean up test data
    await sql`DELETE FROM fantasy_power_up_usage WHERE team_id = ${testTeamId}`;
    await sql`DELETE FROM fantasy_power_ups WHERE team_id = ${testTeamId}`;
  });

  describe('Initialization', () => {
    test('should initialize power-ups for a team', async () => {
      const inventory = await initializePowerUps(testTeamId, testLeagueId);

      expect(inventory).toBeDefined();
      expect(inventory.team_id).toBe(testTeamId);
      expect(inventory.league_id).toBe(testLeagueId);
      expect(inventory.triple_captain_remaining).toBe(1);
      expect(inventory.bench_boost_remaining).toBe(2);
      expect(inventory.free_hit_remaining).toBe(1);
      expect(inventory.wildcard_remaining).toBe(2);
    });

    test('should not duplicate inventory on re-initialization', async () => {
      await initializePowerUps(testTeamId, testLeagueId);
      await initializePowerUps(testTeamId, testLeagueId);

      const results = await sql`
        SELECT COUNT(*) as count
        FROM fantasy_power_ups
        WHERE team_id = ${testTeamId}
      `;

      expect(parseInt(results[0].count)).toBe(1);
    });

    test('should get power-up inventory', async () => {
      await initializePowerUps(testTeamId, testLeagueId);
      const inventory = await getPowerUpInventory(testTeamId, testLeagueId);

      expect(inventory).toBeDefined();
      expect(inventory!.triple_captain_remaining).toBe(1);
    });

    test('should return null for non-existent inventory', async () => {
      const inventory = await getPowerUpInventory('non_existent', testLeagueId);
      expect(inventory).toBeNull();
    });
  });

  describe('Availability Checks', () => {
    beforeEach(async () => {
      await initializePowerUps(testTeamId, testLeagueId);
    });

    test('should check if power-up is available', async () => {
      const available = await isPowerUpAvailable(testTeamId, testLeagueId, 'triple_captain');
      expect(available).toBe(true);
    });

    test('should return false for unavailable power-up', async () => {
      // Use up all triple captains
      await sql`
        UPDATE fantasy_power_ups
        SET triple_captain_remaining = 0
        WHERE team_id = ${testTeamId}
      `;

      const available = await isPowerUpAvailable(testTeamId, testLeagueId, 'triple_captain');
      expect(available).toBe(false);
    });

    test('should check if power-up is active for a round', async () => {
      const active = await isPowerUpActive(testTeamId, 'triple_captain', testRoundId);
      expect(active).toBe(false);
    });
  });

  describe('Activation', () => {
    beforeEach(async () => {
      await initializePowerUps(testTeamId, testLeagueId);
    });

    test('should activate Triple Captain', async () => {
      const result = await activatePowerUp(
        testTeamId,
        testLeagueId,
        testRoundId,
        'triple_captain'
      );

      expect(result.success).toBe(true);
      expect(result.usage_id).toBeDefined();
      expect(result.remaining).toBe(0);

      const active = await isPowerUpActive(testTeamId, 'triple_captain', testRoundId);
      expect(active).toBe(true);
    });

    test('should activate Bench Boost', async () => {
      const result = await activatePowerUp(
        testTeamId,
        testLeagueId,
        testRoundId,
        'bench_boost'
      );

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(1);
    });

    test('should activate Free Hit', async () => {
      const result = await activatePowerUp(
        testTeamId,
        testLeagueId,
        testRoundId,
        'free_hit'
      );

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(0);
    });

    test('should activate Wildcard', async () => {
      const result = await activatePowerUp(
        testTeamId,
        testLeagueId,
        testRoundId,
        'wildcard'
      );

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(1);
    });

    test('should fail to activate when none remaining', async () => {
      // Use up all triple captains
      await sql`
        UPDATE fantasy_power_ups
        SET triple_captain_remaining = 0
        WHERE team_id = ${testTeamId}
      `;

      const result = await activatePowerUp(
        testTeamId,
        testLeagueId,
        testRoundId,
        'triple_captain'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('No triple captain remaining');
    });

    test('should fail to activate twice in same round', async () => {
      await activatePowerUp(testTeamId, testLeagueId, testRoundId, 'triple_captain');
      
      const result = await activatePowerUp(
        testTeamId,
        testLeagueId,
        testRoundId,
        'triple_captain'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('already active');
    });

    test('should decrement inventory on activation', async () => {
      await activatePowerUp(testTeamId, testLeagueId, testRoundId, 'bench_boost');

      const inventory = await getPowerUpInventory(testTeamId, testLeagueId);
      expect(inventory!.bench_boost_remaining).toBe(1);
    });
  });

  describe('Deactivation', () => {
    beforeEach(async () => {
      await initializePowerUps(testTeamId, testLeagueId);
      await activatePowerUp(testTeamId, testLeagueId, testRoundId, 'triple_captain');
    });

    test('should deactivate power-up', async () => {
      const result = await deactivatePowerUp(
        testTeamId,
        testLeagueId,
        testRoundId,
        'triple_captain'
      );

      expect(result.success).toBe(true);

      const active = await isPowerUpActive(testTeamId, 'triple_captain', testRoundId);
      expect(active).toBe(false);
    });

    test('should restore inventory on deactivation', async () => {
      await deactivatePowerUp(testTeamId, testLeagueId, testRoundId, 'triple_captain');

      const inventory = await getPowerUpInventory(testTeamId, testLeagueId);
      expect(inventory!.triple_captain_remaining).toBe(1);
    });

    test('should fail to deactivate inactive power-up', async () => {
      const result = await deactivatePowerUp(
        testTeamId,
        testLeagueId,
        testRoundId,
        'bench_boost'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('not active');
    });
  });

  describe('Usage History', () => {
    beforeEach(async () => {
      await initializePowerUps(testTeamId, testLeagueId);
    });

    test('should track usage history', async () => {
      await activatePowerUp(testTeamId, testLeagueId, testRoundId, 'triple_captain');
      await activatePowerUp(testTeamId, testLeagueId, `${testRoundId}_2`, 'bench_boost');

      const history = await getPowerUpUsageHistory(testTeamId, testLeagueId);

      expect(history.length).toBe(2);
      expect(history[0].power_up_type).toBe('bench_boost'); // Most recent first
      expect(history[1].power_up_type).toBe('triple_captain');
    });

    test('should get active power-ups for a round', async () => {
      await activatePowerUp(testTeamId, testLeagueId, testRoundId, 'triple_captain');
      await activatePowerUp(testTeamId, testLeagueId, testRoundId, 'bench_boost');

      const active = await getActivePowerUps(testTeamId, testRoundId);

      expect(active.length).toBe(2);
      expect(active).toContain('triple_captain');
      expect(active).toContain('bench_boost');
    });
  });

  describe('Helper Functions', () => {
    beforeEach(async () => {
      await initializePowerUps(testTeamId, testLeagueId);
    });

    test('should get captain multiplier (normal)', async () => {
      const multiplier = await getCaptainMultiplier(testTeamId, testRoundId);
      expect(multiplier).toBe(2.0);
    });

    test('should get captain multiplier (triple captain)', async () => {
      await activatePowerUp(testTeamId, testLeagueId, testRoundId, 'triple_captain');
      
      const multiplier = await getCaptainMultiplier(testTeamId, testRoundId);
      expect(multiplier).toBe(3.0);
    });

    test('should check bench boost active', async () => {
      expect(await isBenchBoostActive(testTeamId, testRoundId)).toBe(false);

      await activatePowerUp(testTeamId, testLeagueId, testRoundId, 'bench_boost');
      
      expect(await isBenchBoostActive(testTeamId, testRoundId)).toBe(true);
    });

    test('should check free hit active', async () => {
      expect(await isFreeHitActive(testTeamId, testRoundId)).toBe(false);

      await activatePowerUp(testTeamId, testLeagueId, testRoundId, 'free_hit');
      
      expect(await isFreeHitActive(testTeamId, testRoundId)).toBe(true);
    });

    test('should check wildcard active', async () => {
      expect(await isWildcardActive(testTeamId, testRoundId)).toBe(false);

      await activatePowerUp(testTeamId, testLeagueId, testRoundId, 'wildcard');
      
      expect(await isWildcardActive(testTeamId, testRoundId)).toBe(true);
    });
  });

  describe('Display Functions', () => {
    test('should get display names', () => {
      expect(getPowerUpDisplayName('triple_captain')).toBe('Triple Captain');
      expect(getPowerUpDisplayName('bench_boost')).toBe('Bench Boost');
      expect(getPowerUpDisplayName('free_hit')).toBe('Free Hit');
      expect(getPowerUpDisplayName('wildcard')).toBe('Wildcard');
    });

    test('should get descriptions', () => {
      expect(getPowerUpDescription('triple_captain')).toContain('3x points');
      expect(getPowerUpDescription('bench_boost')).toContain('bench players earn points');
      expect(getPowerUpDescription('free_hit')).toContain('unlimited lineup changes');
      expect(getPowerUpDescription('wildcard')).toContain('unlimited transfers');
    });

    test('should get emojis', () => {
      expect(getPowerUpEmoji('triple_captain')).toBe('⚡');
      expect(getPowerUpEmoji('bench_boost')).toBe('🔋');
      expect(getPowerUpEmoji('free_hit')).toBe('🎯');
      expect(getPowerUpEmoji('wildcard')).toBe('🃏');
    });
  });

  describe('Validation', () => {
    beforeEach(async () => {
      await initializePowerUps(testTeamId, testLeagueId);
    });

    test('should validate available power-up', async () => {
      const validation = await validatePowerUpActivation(
        testTeamId,
        testLeagueId,
        testRoundId,
        'triple_captain'
      );

      expect(validation.valid).toBe(true);
      expect(validation.error).toBeUndefined();
    });

    test('should fail validation for unavailable power-up', async () => {
      await sql`
        UPDATE fantasy_power_ups
        SET triple_captain_remaining = 0
        WHERE team_id = ${testTeamId}
      `;

      const validation = await validatePowerUpActivation(
        testTeamId,
        testLeagueId,
        testRoundId,
        'triple_captain'
      );

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('no Triple Captain remaining');
    });

    test('should fail validation for already active power-up', async () => {
      await activatePowerUp(testTeamId, testLeagueId, testRoundId, 'triple_captain');

      const validation = await validatePowerUpActivation(
        testTeamId,
        testLeagueId,
        testRoundId,
        'triple_captain'
      );

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('already active');
    });

    test('should fail validation for Triple Captain with Free Hit', async () => {
      await activatePowerUp(testTeamId, testLeagueId, testRoundId, 'free_hit');

      const validation = await validatePowerUpActivation(
        testTeamId,
        testLeagueId,
        testRoundId,
        'triple_captain'
      );

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('Cannot use Triple Captain with Free Hit');
    });
  });

  describe('League-wide Queries', () => {
    const testTeamId2 = `test_team_2_${Date.now()}`;

    beforeEach(async () => {
      await initializePowerUps(testTeamId, testLeagueId);
      await initializePowerUps(testTeamId2, testLeagueId);
    });

    afterEach(async () => {
      await sql`DELETE FROM fantasy_power_up_usage WHERE team_id = ${testTeamId2}`;
      await sql`DELETE FROM fantasy_power_ups WHERE team_id = ${testTeamId2}`;
    });

    test('should get teams with active power-ups', async () => {
      await activatePowerUp(testTeamId, testLeagueId, testRoundId, 'triple_captain');
      await activatePowerUp(testTeamId2, testLeagueId, testRoundId, 'bench_boost');

      const teamsMap = await getTeamsWithActivePowerUps(testLeagueId, testRoundId);

      expect(teamsMap.size).toBe(2);
      expect(teamsMap.get(testTeamId)).toContain('triple_captain');
      expect(teamsMap.get(testTeamId2)).toContain('bench_boost');
    }, 15000); // 15 second timeout

    test('should handle team with multiple active power-ups', async () => {
      await activatePowerUp(testTeamId, testLeagueId, testRoundId, 'triple_captain');
      await activatePowerUp(testTeamId, testLeagueId, testRoundId, 'bench_boost');

      const teamsMap = await getTeamsWithActivePowerUps(testLeagueId, testRoundId);

      expect(teamsMap.get(testTeamId)?.length).toBe(2);
    });
  });
});
