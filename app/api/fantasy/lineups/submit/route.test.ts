import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/auth-helper', () => ({
  verifyAuth: vi.fn()
}));

vi.mock('@/lib/neon/fantasy-config', () => ({
  fantasySql: vi.fn()
}));

const { verifyAuth } = await import('@/lib/auth-helper');
const { fantasySql } = await import('@/lib/neon/fantasy-config');

describe('POST /api/fantasy/lineups/submit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAuth = { authenticated: true, userId: 'user123' };
  const mockTeam = {
    team_id: 'team123',
    owner_uid: 'user123',
    league_id: 'league123'
  };

  const validLineup = {
    team_id: 'team123',
    league_id: 'league123',
    round_id: 'round123',
    round_number: 1,
    starting_players: ['P1', 'P2', 'P3', 'P4', 'P5'],
    captain_id: 'P1',
    vice_captain_id: 'P2',
    bench_players: ['P6', 'P7'],
    lock_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };

  const mockSquad = [
    { real_player_id: 'P1' },
    { real_player_id: 'P2' },
    { real_player_id: 'P3' },
    { real_player_id: 'P4' },
    { real_player_id: 'P5' },
    { real_player_id: 'P6' },
    { real_player_id: 'P7' }
  ];

  it('should submit lineup successfully', async () => {
    vi.mocked(verifyAuth).mockResolvedValue(mockAuth);
    vi.mocked(fantasySql).mockResolvedValueOnce([mockTeam]); // Team query
    vi.mocked(fantasySql).mockResolvedValueOnce(mockSquad); // Squad query
    vi.mocked(fantasySql).mockResolvedValueOnce([{ lineup_id: 'lineup123' }]); // Insert query

    const request = new NextRequest('http://localhost/api/fantasy/lineups/submit', {
      method: 'POST',
      body: JSON.stringify(validLineup)
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.lineup_id).toBeDefined();
    expect(data.is_locked).toBe(false);
  });

  it('should return 401 if user not authenticated', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({ authenticated: false, error: 'Unauthorized' });

    const request = new NextRequest('http://localhost/api/fantasy/lineups/submit', {
      method: 'POST',
      body: JSON.stringify(validLineup)
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 if missing required fields', async () => {
    vi.mocked(verifyAuth).mockResolvedValue(mockAuth);

    const invalidLineup = { ...validLineup };
    delete (invalidLineup as any).team_id;

    const request = new NextRequest('http://localhost/api/fantasy/lineups/submit', {
      method: 'POST',
      body: JSON.stringify(invalidLineup)
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing required fields');
  });

  it('should return 404 if team not found', async () => {
    vi.mocked(verifyAuth).mockResolvedValue(mockAuth);
    vi.mocked(fantasySql).mockResolvedValueOnce([]); // Team not found

    const request = new NextRequest('http://localhost/api/fantasy/lineups/submit', {
      method: 'POST',
      body: JSON.stringify(validLineup)
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Team not found');
  });

  it('should return 403 if user does not own team', async () => {
    vi.mocked(verifyAuth).mockResolvedValue(mockAuth);
    vi.mocked(fantasySql).mockResolvedValueOnce([{ ...mockTeam, owner_uid: 'other_user' }]);

    const request = new NextRequest('http://localhost/api/fantasy/lineups/submit', {
      method: 'POST',
      body: JSON.stringify(validLineup)
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden: Not your team');
  });

  it('should return 400 if not exactly 5 starting players', async () => {
    vi.mocked(verifyAuth).mockResolvedValue(mockAuth);
    vi.mocked(fantasySql).mockResolvedValueOnce([mockTeam]);

    const invalidLineup = {
      ...validLineup,
      starting_players: ['P1', 'P2', 'P3'] // Only 3 players
    };

    const request = new NextRequest('http://localhost/api/fantasy/lineups/submit', {
      method: 'POST',
      body: JSON.stringify(invalidLineup)
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
    expect(data.details).toContain('Must select exactly 5 starting players');
  });

  it('should return 400 if not exactly 2 bench players', async () => {
    vi.mocked(verifyAuth).mockResolvedValue(mockAuth);
    vi.mocked(fantasySql).mockResolvedValueOnce([mockTeam]);

    const invalidLineup = {
      ...validLineup,
      bench_players: ['P6'] // Only 1 player
    };

    const request = new NextRequest('http://localhost/api/fantasy/lineups/submit', {
      method: 'POST',
      body: JSON.stringify(invalidLineup)
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
    expect(data.details).toContain('Must have exactly 2 bench players');
  });

  it('should return 400 if captain not in starting lineup', async () => {
    vi.mocked(verifyAuth).mockResolvedValue(mockAuth);
    vi.mocked(fantasySql).mockResolvedValueOnce([mockTeam]);

    const invalidLineup = {
      ...validLineup,
      captain_id: 'P6' // P6 is on bench
    };

    const request = new NextRequest('http://localhost/api/fantasy/lineups/submit', {
      method: 'POST',
      body: JSON.stringify(invalidLineup)
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
    expect(data.details).toContain('Captain must be in starting lineup');
  });

  it('should return 400 if vice-captain not in starting lineup', async () => {
    vi.mocked(verifyAuth).mockResolvedValue(mockAuth);
    vi.mocked(fantasySql).mockResolvedValueOnce([mockTeam]);

    const invalidLineup = {
      ...validLineup,
      vice_captain_id: 'P7' // P7 is on bench
    };

    const request = new NextRequest('http://localhost/api/fantasy/lineups/submit', {
      method: 'POST',
      body: JSON.stringify(invalidLineup)
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
    expect(data.details).toContain('Vice-captain must be in starting lineup');
  });

  it('should return 400 if captain and vice-captain are same', async () => {
    vi.mocked(verifyAuth).mockResolvedValue(mockAuth);
    vi.mocked(fantasySql).mockResolvedValueOnce([mockTeam]);

    const invalidLineup = {
      ...validLineup,
      captain_id: 'P1',
      vice_captain_id: 'P1' // Same as captain
    };

    const request = new NextRequest('http://localhost/api/fantasy/lineups/submit', {
      method: 'POST',
      body: JSON.stringify(invalidLineup)
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
    expect(data.details).toContain('Captain and vice-captain must be different players');
  });

  it('should return 400 if duplicate players selected', async () => {
    vi.mocked(verifyAuth).mockResolvedValue(mockAuth);
    vi.mocked(fantasySql).mockResolvedValueOnce([mockTeam]);

    const invalidLineup = {
      ...validLineup,
      starting_players: ['P1', 'P2', 'P3', 'P4', 'P5'],
      bench_players: ['P5', 'P6'] // P5 is duplicate
    };

    const request = new NextRequest('http://localhost/api/fantasy/lineups/submit', {
      method: 'POST',
      body: JSON.stringify(invalidLineup)
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
    expect(data.details).toContain('Cannot select same player multiple times');
  });

  it('should return 400 if player not in squad', async () => {
    vi.mocked(verifyAuth).mockResolvedValue(mockAuth);
    vi.mocked(fantasySql).mockResolvedValueOnce([mockTeam]);
    vi.mocked(fantasySql).mockResolvedValueOnce(mockSquad);

    const invalidLineup = {
      ...validLineup,
      starting_players: ['P1', 'P2', 'P3', 'P4', 'P99'] // P99 not in squad
    };

    const request = new NextRequest('http://localhost/api/fantasy/lineups/submit', {
      method: 'POST',
      body: JSON.stringify(invalidLineup)
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid players');
    expect(data.details).toContain('P99');
  });

  it('should return 400 if deadline has passed', async () => {
    vi.mocked(verifyAuth).mockResolvedValue(mockAuth);
    vi.mocked(fantasySql).mockResolvedValueOnce([mockTeam]);
    vi.mocked(fantasySql).mockResolvedValueOnce(mockSquad);

    const expiredLineup = {
      ...validLineup,
      lock_deadline: new Date(Date.now() - 1000).toISOString() // Past deadline
    };

    const request = new NextRequest('http://localhost/api/fantasy/lineups/submit', {
      method: 'POST',
      body: JSON.stringify(expiredLineup)
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Lineup deadline has passed');
  });

  it('should update existing lineup if not locked', async () => {
    vi.mocked(verifyAuth).mockResolvedValue(mockAuth);
    vi.mocked(fantasySql).mockResolvedValueOnce([mockTeam]);
    vi.mocked(fantasySql).mockResolvedValueOnce(mockSquad);
    vi.mocked(fantasySql).mockResolvedValueOnce([{ lineup_id: 'lineup123' }]);

    const request = new NextRequest('http://localhost/api/fantasy/lineups/submit', {
      method: 'POST',
      body: JSON.stringify(validLineup)
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(vi.mocked(fantasySql)).toHaveBeenCalledTimes(3);
  });

  it('should calculate hours until lock correctly', async () => {
    vi.mocked(verifyAuth).mockResolvedValue(mockAuth);
    vi.mocked(fantasySql).mockResolvedValueOnce([mockTeam]);
    vi.mocked(fantasySql).mockResolvedValueOnce(mockSquad);
    vi.mocked(fantasySql).mockResolvedValueOnce([{ lineup_id: 'lineup123' }]);

    const futureDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
    const lineupWith48Hours = {
      ...validLineup,
      lock_deadline: futureDeadline.toISOString()
    };

    const request = new NextRequest('http://localhost/api/fantasy/lineups/submit', {
      method: 'POST',
      body: JSON.stringify(lineupWith48Hours)
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.hours_until_lock).toBeGreaterThan(47);
    expect(data.hours_until_lock).toBeLessThan(49);
  });
});
