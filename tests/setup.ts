/**
 * Vitest Setup File
 * Global test configuration and mocks
 */

import { vi } from 'vitest';

// Mock environment variables
process.env.NEON_DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-api-key';
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'test.firebaseapp.com';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'test-project';

// Mock Firebase Admin
vi.mock('firebase-admin', () => ({
  default: {
    apps: [],
    initializeApp: vi.fn(),
    credential: {
      cert: vi.fn()
    },
    firestore: vi.fn(() => ({
      collection: vi.fn(),
      doc: vi.fn()
    }))
  }
}));

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn()
  })),
  useParams: vi.fn(() => ({})),
  useSearchParams: vi.fn(() => new URLSearchParams())
}));

// Global test utilities
global.testUtils = {
  createMockTeam: (overrides = {}) => ({
    team_id: 'team_test_123',
    team_name: 'Test Team',
    owner_uid: 'user_123',
    budget_remaining: 100000000,
    total_points: 0,
    ...overrides
  }),
  
  createMockPlayer: (overrides = {}) => ({
    player_id: 'player_test_123',
    player_name: 'Test Player',
    position: 'Forward',
    current_price: 5000000,
    is_available: true,
    ...overrides
  }),
  
  createMockLineup: (overrides = {}) => ({
    lineup_id: 'lineup_test_123',
    team_id: 'team_test_123',
    round_id: 'round_1',
    starting_11: Array(11).fill('player_'),
    bench: Array(4).fill('player_'),
    captain_id: 'player_1',
    ...overrides
  })
};

declare global {
  var testUtils: {
    createMockTeam: (overrides?: any) => any;
    createMockPlayer: (overrides?: any) => any;
    createMockLineup: (overrides?: any) => any;
  };
}
