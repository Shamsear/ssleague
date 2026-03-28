/**
 * Tests for Fantasy League - Weekly Challenges System
 */

import { describe, it, expect } from 'vitest';
import {
  getChallengeTemplate,
  getWeeklyChallengeType,
  checkCaptainMasterclass,
  checkUnderdogHero,
  checkPerfectLineup,
  checkDifferentialPick,
  checkBudgetGenius,
  checkCleanSweep,
  checkComebackKing,
  checkChallengeCompletion,
  CHALLENGE_TEMPLATES,
  type LineupData,
  type PlayerPerformance,
  type TeamStanding,
  type SquadData
} from './challenges';

describe('Weekly Challenges System', () => {
  // ============================================================================
  // Challenge Templates
  // ============================================================================

  describe('Challenge Templates', () => {
    it('should have 7 challenge templates', () => {
      expect(CHALLENGE_TEMPLATES).toHaveLength(7);
    });

    it('should get challenge template by type', () => {
      const template = getChallengeTemplate('captain_masterclass');
      
      expect(template).toBeDefined();
      expect(template?.name).toBe('Captain Masterclass');
      expect(template?.bonus_points).toBe(20);
    });

    it('should rotate challenges weekly', () => {
      const week1 = getWeeklyChallengeType(1);
      const week2 = getWeeklyChallengeType(2);
      const week8 = getWeeklyChallengeType(8); // Should wrap around
      
      expect(week1).toBe('captain_masterclass');
      expect(week2).toBe('underdog_hero');
      expect(week8).toBe('captain_masterclass'); // 7 templates, so week 8 = week 1
    });
  });

  // ============================================================================
  // Captain Masterclass
  // ============================================================================

  describe('Captain Masterclass Challenge', () => {
    const mockLineup: LineupData = {
      lineup_id: 'lineup_1',
      team_id: 'team_1',
      round_id: 'round_1',
      starting_players: ['p1', 'p2', 'p3', 'p4', 'p5'],
      captain_id: 'p1',
      vice_captain_id: 'p2',
      total_points: 100,
      captain_points: 30
    };

    it('should complete when captain scores 25+ points', () => {
      const result = checkCaptainMasterclass(mockLineup, { min_captain_points: 25 });
      
      expect(result.completed).toBe(true);
      expect(result.details?.captain_points).toBe(30);
    });

    it('should not complete when captain scores less than 25 points', () => {
      const lineup = { ...mockLineup, captain_points: 20 };
      const result = checkCaptainMasterclass(lineup, { min_captain_points: 25 });
      
      expect(result.completed).toBe(false);
      expect(result.reason).toContain('20 points');
    });
  });

  // ============================================================================
  // Underdog Hero
  // ============================================================================

  describe('Underdog Hero Challenge', () => {
    const mockLineup: LineupData = {
      lineup_id: 'lineup_1',
      team_id: 'team_1',
      round_id: 'round_1',
      starting_players: ['p1', 'p2', 'p3', 'p4', 'p5'],
      captain_id: 'p1',
      vice_captain_id: 'p2',
      total_points: 100,
      captain_points: 30
    };

    const mockPerformances: PlayerPerformance[] = [
      { player_id: 'p1', points: 10, team_id: 'real_team_1', ownership_percentage: 50 },
      { player_id: 'p2', points: 18, team_id: 'real_team_20', ownership_percentage: 30 },
      { player_id: 'p3', points: 12, team_id: 'real_team_2', ownership_percentage: 40 },
      { player_id: 'p4', points: 15, team_id: 'real_team_3', ownership_percentage: 25 },
      { player_id: 'p5', points: 8, team_id: 'real_team_19', ownership_percentage: 20 }
    ];

    const mockStandings: TeamStanding[] = [
      { team_id: 'real_team_1', position: 1, total_points: 500 },
      { team_id: 'real_team_2', position: 2, total_points: 480 },
      { team_id: 'real_team_19', position: 19, total_points: 200 },
      { team_id: 'real_team_20', position: 20, total_points: 180 }
    ];

    it('should complete when player from bottom 3 teams scores 15+ points', () => {
      const result = checkUnderdogHero(
        mockLineup,
        mockPerformances,
        mockStandings,
        { min_player_points: 15, team_position_max: 3 }
      );
      
      expect(result.completed).toBe(true);
      expect(result.details?.player_id).toBe('p2'); // From team_20 (position 20)
      expect(result.details?.player_points).toBe(18);
    });

    it('should not complete when no bottom team player scores enough', () => {
      const performances = mockPerformances.map(p => 
        p.player_id === 'p2' ? { ...p, points: 10 } : p
      );
      
      const result = checkUnderdogHero(
        mockLineup,
        performances,
        mockStandings,
        { min_player_points: 15, team_position_max: 3 }
      );
      
      expect(result.completed).toBe(false);
    });
  });

  // ============================================================================
  // Perfect Lineup
  // ============================================================================

  describe('Perfect Lineup Challenge', () => {
    const mockLineup: LineupData = {
      lineup_id: 'lineup_1',
      team_id: 'team_1',
      round_id: 'round_1',
      starting_players: ['p1', 'p2', 'p3', 'p4', 'p5'],
      captain_id: 'p1',
      vice_captain_id: 'p2',
      total_points: 100,
      captain_points: 30
    };

    it('should complete when all 5 starters score 10+ points', () => {
      const performances: PlayerPerformance[] = [
        { player_id: 'p1', points: 15, team_id: 'team_a', ownership_percentage: 50 },
        { player_id: 'p2', points: 12, team_id: 'team_b', ownership_percentage: 40 },
        { player_id: 'p3', points: 10, team_id: 'team_c', ownership_percentage: 30 },
        { player_id: 'p4', points: 18, team_id: 'team_d', ownership_percentage: 60 },
        { player_id: 'p5', points: 11, team_id: 'team_e', ownership_percentage: 45 }
      ];
      
      const result = checkPerfectLineup(mockLineup, performances, { min_points_per_player: 10 });
      
      expect(result.completed).toBe(true);
      expect(result.details?.player_scores).toBeDefined();
    });

    it('should not complete when any starter scores less than 10 points', () => {
      const performances: PlayerPerformance[] = [
        { player_id: 'p1', points: 15, team_id: 'team_a', ownership_percentage: 50 },
        { player_id: 'p2', points: 12, team_id: 'team_b', ownership_percentage: 40 },
        { player_id: 'p3', points: 8, team_id: 'team_c', ownership_percentage: 30 }, // Below threshold
        { player_id: 'p4', points: 18, team_id: 'team_d', ownership_percentage: 60 },
        { player_id: 'p5', points: 11, team_id: 'team_e', ownership_percentage: 45 }
      ];
      
      const result = checkPerfectLineup(mockLineup, performances, { min_points_per_player: 10 });
      
      expect(result.completed).toBe(false);
      expect(result.reason).toContain('Not all starters');
    });
  });

  // ============================================================================
  // Differential Pick
  // ============================================================================

  describe('Differential Pick Challenge', () => {
    const mockLineup: LineupData = {
      lineup_id: 'lineup_1',
      team_id: 'team_1',
      round_id: 'round_1',
      starting_players: ['p1', 'p2', 'p3', 'p4', 'p5'],
      captain_id: 'p1',
      vice_captain_id: 'p2',
      total_points: 100,
      captain_points: 30
    };

    it('should complete when player with <20% ownership scores 20+ points', () => {
      const performances: PlayerPerformance[] = [
        { player_id: 'p1', points: 15, team_id: 'team_a', ownership_percentage: 50 },
        { player_id: 'p2', points: 12, team_id: 'team_b', ownership_percentage: 40 },
        { player_id: 'p3', points: 22, team_id: 'team_c', ownership_percentage: 15 }, // Differential!
        { player_id: 'p4', points: 18, team_id: 'team_d', ownership_percentage: 60 },
        { player_id: 'p5', points: 11, team_id: 'team_e', ownership_percentage: 45 }
      ];
      
      const result = checkDifferentialPick(
        mockLineup,
        performances,
        { max_ownership_percentage: 20, min_player_points: 20 }
      );
      
      expect(result.completed).toBe(true);
      expect(result.details?.player_id).toBe('p3');
      expect(result.details?.ownership_percentage).toBe(15);
    });

    it('should not complete when no low-ownership player scores enough', () => {
      const performances: PlayerPerformance[] = [
        { player_id: 'p1', points: 15, team_id: 'team_a', ownership_percentage: 50 },
        { player_id: 'p2', points: 12, team_id: 'team_b', ownership_percentage: 40 },
        { player_id: 'p3', points: 10, team_id: 'team_c', ownership_percentage: 15 }, // Low ownership but not enough points
        { player_id: 'p4', points: 18, team_id: 'team_d', ownership_percentage: 60 },
        { player_id: 'p5', points: 11, team_id: 'team_e', ownership_percentage: 45 }
      ];
      
      const result = checkDifferentialPick(
        mockLineup,
        performances,
        { max_ownership_percentage: 20, min_player_points: 20 }
      );
      
      expect(result.completed).toBe(false);
    });
  });

  // ============================================================================
  // Budget Genius
  // ============================================================================

  describe('Budget Genius Challenge', () => {
    const mockLineup: LineupData = {
      lineup_id: 'lineup_1',
      team_id: 'team_1',
      round_id: 'round_1',
      starting_players: ['p1', 'p2', 'p3', 'p4', 'p5'],
      captain_id: 'p1',
      vice_captain_id: 'p2',
      total_points: 100,
      captain_points: 30
    };

    const mockSquad: SquadData = {
      team_id: 'team_1',
      total_value: 35000000, // €35M
      players: [
        { player_id: 'p1', purchase_price: 8000000 },
        { player_id: 'p2', purchase_price: 7000000 },
        { player_id: 'p3', purchase_price: 6000000 },
        { player_id: 'p4', purchase_price: 7000000 },
        { player_id: 'p5', purchase_price: 7000000 }
      ]
    };

    const mockStandings: TeamStanding[] = [
      { team_id: 'team_1', position: 1, total_points: 500 },
      { team_id: 'team_2', position: 2, total_points: 480 }
    ];

    it('should complete when squad value under €40M and wins round', () => {
      const result = checkBudgetGenius(
        mockLineup,
        mockSquad,
        mockStandings,
        { max_squad_value: 40000000, must_win_round: true }
      );
      
      expect(result.completed).toBe(true);
      expect(result.details?.squad_value).toBe(35000000);
    });

    it('should not complete when squad value exceeds limit', () => {
      const expensiveSquad = { ...mockSquad, total_value: 45000000 };
      
      const result = checkBudgetGenius(
        mockLineup,
        expensiveSquad,
        mockStandings,
        { max_squad_value: 40000000, must_win_round: true }
      );
      
      expect(result.completed).toBe(false);
      expect(result.reason).toContain('exceeds');
    });

    it('should not complete when did not win round', () => {
      const standings = [
        { team_id: 'team_2', position: 1, total_points: 510 },
        { team_id: 'team_1', position: 2, total_points: 500 }
      ];
      
      const result = checkBudgetGenius(
        mockLineup,
        mockSquad,
        standings,
        { max_squad_value: 40000000, must_win_round: true }
      );
      
      expect(result.completed).toBe(false);
      expect(result.reason).toContain('Did not win');
    });
  });

  // ============================================================================
  // Clean Sweep
  // ============================================================================

  describe('Clean Sweep Challenge', () => {
    const mockLineup: LineupData = {
      lineup_id: 'lineup_1',
      team_id: 'team_1',
      round_id: 'round_1',
      starting_players: ['p1', 'p2', 'p3', 'p4', 'p5'],
      captain_id: 'p1',
      vice_captain_id: 'p2',
      total_points: 100,
      captain_points: 30
    };

    it('should complete when all 5 starters score 15+ points', () => {
      const performances: PlayerPerformance[] = [
        { player_id: 'p1', points: 20, team_id: 'team_a', ownership_percentage: 50 },
        { player_id: 'p2', points: 18, team_id: 'team_b', ownership_percentage: 40 },
        { player_id: 'p3', points: 15, team_id: 'team_c', ownership_percentage: 30 },
        { player_id: 'p4', points: 22, team_id: 'team_d', ownership_percentage: 60 },
        { player_id: 'p5', points: 16, team_id: 'team_e', ownership_percentage: 45 }
      ];
      
      const result = checkCleanSweep(mockLineup, performances, { min_points_per_player: 15 });
      
      expect(result.completed).toBe(true);
    });

    it('should not complete when any starter scores less than 15 points', () => {
      const performances: PlayerPerformance[] = [
        { player_id: 'p1', points: 20, team_id: 'team_a', ownership_percentage: 50 },
        { player_id: 'p2', points: 18, team_id: 'team_b', ownership_percentage: 40 },
        { player_id: 'p3', points: 12, team_id: 'team_c', ownership_percentage: 30 }, // Below threshold
        { player_id: 'p4', points: 22, team_id: 'team_d', ownership_percentage: 60 },
        { player_id: 'p5', points: 16, team_id: 'team_e', ownership_percentage: 45 }
      ];
      
      const result = checkCleanSweep(mockLineup, performances, { min_points_per_player: 15 });
      
      expect(result.completed).toBe(false);
    });
  });

  // ============================================================================
  // Comeback King
  // ============================================================================

  describe('Comeback King Challenge', () => {
    const mockLineup: LineupData = {
      lineup_id: 'lineup_1',
      team_id: 'team_1',
      round_id: 'round_1',
      starting_players: ['p1', 'p2', 'p3', 'p4', 'p5'],
      captain_id: 'p1',
      vice_captain_id: 'p2',
      total_points: 100,
      captain_points: 30
    };

    const previousStandings: TeamStanding[] = [
      { team_id: 'team_1', position: 18, total_points: 200 }, // Bottom 5
      { team_id: 'team_2', position: 1, total_points: 500 }
    ];

    const currentStandings: TeamStanding[] = [
      { team_id: 'team_1', position: 1, total_points: 300 }, // Won!
      { team_id: 'team_2', position: 2, total_points: 510 }
    ];

    it('should complete when team was in bottom 5 and wins round', () => {
      const result = checkComebackKing(
        mockLineup,
        currentStandings,
        previousStandings,
        { previous_position_min: 16, must_win_round: true }
      );
      
      expect(result.completed).toBe(true);
      expect(result.details?.previous_position).toBe(18);
      expect(result.details?.current_position).toBe(1);
    });

    it('should not complete when team was not in bottom 5', () => {
      const goodPreviousStandings = [
        { team_id: 'team_1', position: 5, total_points: 400 },
        { team_id: 'team_2', position: 1, total_points: 500 }
      ];
      
      const result = checkComebackKing(
        mockLineup,
        currentStandings,
        goodPreviousStandings,
        { previous_position_min: 16, must_win_round: true }
      );
      
      expect(result.completed).toBe(false);
      expect(result.reason).toContain('not in bottom 5');
    });

    it('should not complete when team did not win round', () => {
      const standings = [
        { team_id: 'team_2', position: 1, total_points: 310 },
        { team_id: 'team_1', position: 2, total_points: 300 }
      ];
      
      const result = checkComebackKing(
        mockLineup,
        standings,
        previousStandings,
        { previous_position_min: 16, must_win_round: true }
      );
      
      expect(result.completed).toBe(false);
      expect(result.reason).toContain('Did not win');
    });
  });

  // ============================================================================
  // Main Challenge Checker
  // ============================================================================

  describe('Main Challenge Checker', () => {
    const mockLineup: LineupData = {
      lineup_id: 'lineup_1',
      team_id: 'team_1',
      round_id: 'round_1',
      starting_players: ['p1', 'p2', 'p3', 'p4', 'p5'],
      captain_id: 'p1',
      vice_captain_id: 'p2',
      total_points: 100,
      captain_points: 30
    };

    const mockPerformances: PlayerPerformance[] = [
      { player_id: 'p1', points: 15, team_id: 'team_a', ownership_percentage: 50 },
      { player_id: 'p2', points: 12, team_id: 'team_b', ownership_percentage: 40 },
      { player_id: 'p3', points: 10, team_id: 'team_c', ownership_percentage: 30 },
      { player_id: 'p4', points: 18, team_id: 'team_d', ownership_percentage: 60 },
      { player_id: 'p5', points: 11, team_id: 'team_e', ownership_percentage: 45 }
    ];

    const mockStandings: TeamStanding[] = [
      { team_id: 'team_1', position: 1, total_points: 500 },
      { team_id: 'team_2', position: 2, total_points: 480 }
    ];

    const mockSquad: SquadData = {
      team_id: 'team_1',
      total_value: 35000000,
      players: [
        { player_id: 'p1', purchase_price: 7000000 },
        { player_id: 'p2', purchase_price: 7000000 },
        { player_id: 'p3', purchase_price: 7000000 },
        { player_id: 'p4', purchase_price: 7000000 },
        { player_id: 'p5', purchase_price: 7000000 }
      ]
    };

    it('should route to correct checker for captain_masterclass', () => {
      const result = checkChallengeCompletion(
        'captain_masterclass',
        { min_captain_points: 25 },
        {
          lineup: mockLineup,
          playerPerformances: mockPerformances,
          teamStandings: mockStandings,
          squad: mockSquad
        }
      );
      
      expect(result.completed).toBe(true);
    });

    it('should route to correct checker for perfect_lineup', () => {
      const result = checkChallengeCompletion(
        'perfect_lineup',
        { min_points_per_player: 10 },
        {
          lineup: mockLineup,
          playerPerformances: mockPerformances,
          teamStandings: mockStandings,
          squad: mockSquad
        }
      );
      
      expect(result.completed).toBe(true);
    });

    it('should handle unknown challenge type', () => {
      const result = checkChallengeCompletion(
        'unknown_challenge' as any,
        {},
        {
          lineup: mockLineup,
          playerPerformances: mockPerformances,
          teamStandings: mockStandings,
          squad: mockSquad
        }
      );
      
      expect(result.completed).toBe(false);
      expect(result.reason).toContain('Unknown challenge type');
    });

    it('should handle comeback_king without previous standings', () => {
      const result = checkChallengeCompletion(
        'comeback_king',
        { previous_position_min: 16, must_win_round: true },
        {
          lineup: mockLineup,
          playerPerformances: mockPerformances,
          teamStandings: mockStandings,
          squad: mockSquad
          // No previousStandings provided
        }
      );
      
      expect(result.completed).toBe(false);
      expect(result.reason).toContain('Previous standings not available');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty player performances', () => {
      const mockLineup: LineupData = {
        lineup_id: 'lineup_1',
        team_id: 'team_1',
        round_id: 'round_1',
        starting_players: ['p1', 'p2', 'p3', 'p4', 'p5'],
        captain_id: 'p1',
        vice_captain_id: 'p2',
        total_points: 0,
        captain_points: 0
      };

      const result = checkPerfectLineup(mockLineup, [], { min_points_per_player: 10 });
      
      expect(result.completed).toBe(false);
    });

    it('should handle missing player in performances', () => {
      const mockLineup: LineupData = {
        lineup_id: 'lineup_1',
        team_id: 'team_1',
        round_id: 'round_1',
        starting_players: ['p1', 'p2', 'p3', 'p4', 'p5'],
        captain_id: 'p1',
        vice_captain_id: 'p2',
        total_points: 100,
        captain_points: 30
      };

      const performances: PlayerPerformance[] = [
        { player_id: 'p1', points: 15, team_id: 'team_a', ownership_percentage: 50 },
        { player_id: 'p2', points: 12, team_id: 'team_b', ownership_percentage: 40 }
        // p3, p4, p5 missing
      ];

      const result = checkPerfectLineup(mockLineup, performances, { min_points_per_player: 10 });
      
      expect(result.completed).toBe(false);
    });

    it('should handle zero ownership percentage', () => {
      const mockLineup: LineupData = {
        lineup_id: 'lineup_1',
        team_id: 'team_1',
        round_id: 'round_1',
        starting_players: ['p1', 'p2', 'p3', 'p4', 'p5'],
        captain_id: 'p1',
        vice_captain_id: 'p2',
        total_points: 100,
        captain_points: 30
      };

      const performances: PlayerPerformance[] = [
        { player_id: 'p1', points: 25, team_id: 'team_a', ownership_percentage: 0 }, // Unique pick!
        { player_id: 'p2', points: 12, team_id: 'team_b', ownership_percentage: 40 },
        { player_id: 'p3', points: 10, team_id: 'team_c', ownership_percentage: 30 },
        { player_id: 'p4', points: 18, team_id: 'team_d', ownership_percentage: 60 },
        { player_id: 'p5', points: 11, team_id: 'team_e', ownership_percentage: 45 }
      ];

      const result = checkDifferentialPick(
        mockLineup,
        performances,
        { max_ownership_percentage: 20, min_player_points: 20 }
      );
      
      expect(result.completed).toBe(true);
      expect(result.details?.ownership_percentage).toBe(0);
    });

    it('should handle exact threshold values', () => {
      const mockLineup: LineupData = {
        lineup_id: 'lineup_1',
        team_id: 'team_1',
        round_id: 'round_1',
        starting_players: ['p1', 'p2', 'p3', 'p4', 'p5'],
        captain_id: 'p1',
        vice_captain_id: 'p2',
        total_points: 100,
        captain_points: 25 // Exactly 25
      };

      const result = checkCaptainMasterclass(mockLineup, { min_captain_points: 25 });
      
      expect(result.completed).toBe(true);
    });

    it('should handle squad value exactly at limit', () => {
      const mockLineup: LineupData = {
        lineup_id: 'lineup_1',
        team_id: 'team_1',
        round_id: 'round_1',
        starting_players: ['p1', 'p2', 'p3', 'p4', 'p5'],
        captain_id: 'p1',
        vice_captain_id: 'p2',
        total_points: 100,
        captain_points: 30
      };

      const mockSquad: SquadData = {
        team_id: 'team_1',
        total_value: 40000000, // Exactly €40M
        players: []
      };

      const mockStandings: TeamStanding[] = [
        { team_id: 'team_1', position: 1, total_points: 500 }
      ];

      const result = checkBudgetGenius(
        mockLineup,
        mockSquad,
        mockStandings,
        { max_squad_value: 40000000, must_win_round: true }
      );
      
      // Should NOT complete (>= limit, not < limit)
      expect(result.completed).toBe(false);
    });
  });
});