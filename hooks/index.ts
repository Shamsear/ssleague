/**
 * Custom Hooks Index
 * Centralized exports for all custom React Query hooks
 */

// Auction hooks
export {
  useAuctionPlayers,
  useAuctionRounds,
  useCreateRound,
  useBids,
  usePlaceBid,
} from './useAuction';

// Tournament hooks
export {
  useFixtures,
  useCreateFixture,
  useMatches,
  useUpdateMatch,
} from './useTournament';

// Stats hooks
export {
  usePlayerStats,
  useUpdatePlayerStats,
  useTeamStats,
  useUpdateTeamStats,
  useLeaderboard,
} from './useStats';

// Player Awards hooks
export {
  usePlayerAwards,
  useSeasonAwards,
} from './usePlayerAwards';
export type { PlayerAward } from './usePlayerAwards';

// Team Data hooks
export {
  useTeamTrophies,
  useTeamSeasonStats,
} from './useTeamData';
export type { TeamTrophy, TeamStats } from './useTeamData';
