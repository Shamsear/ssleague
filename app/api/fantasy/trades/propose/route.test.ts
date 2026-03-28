import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST, GET } from './route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/auth-helper', () => ({
  verifyAuth: vi.fn()
}));

vi.mock('@/lib/fantasy/trade-processor', () => ({
  proposeTrade: vi.fn(),
  validateTradeProposal: vi.fn(),
  calculateTradeValue: vi.fn()
}));

vi.mock('@/lib/neon/fantasy-config', () => ({
  fantasySql: vi.fn()
}));

const { verifyAuth } = await import('@/lib/auth-helper');
const { proposeTrade, validateTradeProposal, calculateTradeValue } = await import('@/lib/fantasy/trade-processor');
const { fantasySql } = await import('@/lib/neon/fantasy-config');

describe('POST /api/fantasy/trades/propose', () => {
  const mockUserId = 'user123';
  const mockTeamA = 'team_a';
  const mockTeamB = 'team_b';
  const mockLeagueId = 'league_1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully propose a trade', async () => {
    // Mock authentication
    vi.mocked(verifyAuth).mockResolvedValue({
      authenticated: true,
      userId: mockUserId,
      error: null
    });

    // Mock database queries
    vi.mocked(fantasySql)
      .mockResolvedValueOnce([{ // Team A
        team_id: mockTeamA,
        owner_uid: mockUserId,
        league_id: mockLeagueId,
        team_name: 'Team A'
      }])
      .mockResolvedValueOnce([{ // Team B
        team_id: mockTeamB,
        league_id: mockLeagueId,
        team_name: 'Team B'
      }])
      .mockResolvedValueOnce([{ real_player_id: 'P1' }]) // Team A players
      .mockResolvedValueOnce([{ real_player_id: 'P2' }]); // Team B players

    // Mock trade proposal
    vi.mocked(proposeTrade).mockResolvedValue({
      success: true,
      trade_id: 'trade_123',
      expires_at: '2026-02-28T00:00:00Z',
      trade_value: {
        team_a_value: 20,
        team_b_value: 25,
        difference: 5,
        fairness_percentage: 88.89
      },
      message: 'Trade proposal sent successfully'
    });

    const request = new NextRequest('http://localhost:3000/api/fantasy/trades/propose', {
      method: 'POST',
      body: JSON.stringify({
        league_id: mockLeagueId,
        team_a_id: mockTeamA,
        team_b_id: mockTeamB,
        trade_type: 'swap',
        team_a_players: ['P1'],
        team_b_players: ['P2'],
        team_a_cash: 0,
        team_b_cash: 0,
        expires_in_hours: 48
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.trade_id).toBe('trade_123');
    expect(data.trade_value).toBeDefined();
  });

  it('should reject unauthenticated requests', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({
      authenticated: false,
      userId: null,
      error: 'Unauthorized'
    });

    const request = new NextRequest('http://localhost:3000/api/fantasy/trades/propose', {
      method: 'POST',
      body: JSON.stringify({
        league_id: mockLeagueId,
        team_a_id: mockTeamA,
        team_b_id: mockTeamB,
        trade_type: 'swap',
        team_a_players: [],
        team_b_players: [],
        team_a_cash: 0,
        team_b_cash: 0,
        expires_in_hours: 48
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Unauthorized');
  });

  it('should reject missing required parameters', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({
      authenticated: true,
      userId: mockUserId,
      error: null
    });

    const request = new NextRequest('http://localhost:3000/api/fantasy/trades/propose', {
      method: 'POST',
      body: JSON.stringify({
        league_id: mockLeagueId,
        // Missing team_a_id
        team_b_id: mockTeamB,
        trade_type: 'swap'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Missing required parameters');
  });

  it('should reject invalid trade type', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({
      authenticated: true,
      userId: mockUserId,
      error: null
    });

    const request = new NextRequest('http://localhost:3000/api/fantasy/trades/propose', {
      method: 'POST',
      body: JSON.stringify({
        league_id: mockLeagueId,
        team_a_id: mockTeamA,
        team_b_id: mockTeamB,
        trade_type: 'invalid',
        team_a_players: [],
        team_b_players: [],
        team_a_cash: 0,
        team_b_cash: 0,
        expires_in_hours: 48
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Invalid trade_type');
  });

  it('should reject if user does not own proposer team', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({
      authenticated: true,
      userId: 'different_user',
      error: null
    });

    vi.mocked(fantasySql).mockResolvedValueOnce([{
      team_id: mockTeamA,
      owner_uid: mockUserId, // Different from authenticated user
      league_id: mockLeagueId,
      team_name: 'Team A'
    }]);

    const request = new NextRequest('http://localhost:3000/api/fantasy/trades/propose', {
      method: 'POST',
      body: JSON.stringify({
        league_id: mockLeagueId,
        team_a_id: mockTeamA,
        team_b_id: mockTeamB,
        trade_type: 'swap',
        team_a_players: [],
        team_b_players: [],
        team_a_cash: 0,
        team_b_cash: 0,
        expires_in_hours: 48
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Forbidden');
  });

  it('should reject if player not in squad', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({
      authenticated: true,
      userId: mockUserId,
      error: null
    });

    vi.mocked(fantasySql)
      .mockResolvedValueOnce([{
        team_id: mockTeamA,
        owner_uid: mockUserId,
        league_id: mockLeagueId,
        team_name: 'Team A'
      }])
      .mockResolvedValueOnce([{
        team_id: mockTeamB,
        league_id: mockLeagueId,
        team_name: 'Team B'
      }])
      .mockResolvedValueOnce([]); // No players found

    const request = new NextRequest('http://localhost:3000/api/fantasy/trades/propose', {
      method: 'POST',
      body: JSON.stringify({
        league_id: mockLeagueId,
        team_a_id: mockTeamA,
        team_b_id: mockTeamB,
        trade_type: 'swap',
        team_a_players: ['P1'],
        team_b_players: [],
        team_a_cash: 0,
        team_b_cash: 0,
        expires_in_hours: 48
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('not in your squad');
  });
});

describe('GET /api/fantasy/trades/propose', () => {
  const mockUserId = 'user123';
  const mockTeamA = 'team_a';
  const mockTeamB = 'team_b';
  const mockLeagueId = 'league_1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should preview trade value', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({
      authenticated: true,
      userId: mockUserId,
      error: null
    });

    vi.mocked(fantasySql).mockResolvedValueOnce([{
      team_id: mockTeamA,
      owner_uid: mockUserId
    }]);

    vi.mocked(validateTradeProposal).mockResolvedValue({
      valid: true
    });

    vi.mocked(calculateTradeValue).mockResolvedValue({
      team_a_value: 20,
      team_b_value: 25,
      difference: 5,
      fairness_percentage: 88.89
    });

    const url = new URL('http://localhost:3000/api/fantasy/trades/propose');
    url.searchParams.set('league_id', mockLeagueId);
    url.searchParams.set('team_a_id', mockTeamA);
    url.searchParams.set('team_b_id', mockTeamB);
    url.searchParams.set('trade_type', 'swap');
    url.searchParams.set('team_a_players', 'P1');
    url.searchParams.set('team_b_players', 'P2');
    url.searchParams.set('team_a_cash', '0');
    url.searchParams.set('team_b_cash', '0');

    const request = new NextRequest(url);
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.validation).toBeDefined();
    expect(data.trade_value).toBeDefined();
  });

  it('should reject unauthenticated preview requests', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({
      authenticated: false,
      userId: null,
      error: 'Unauthorized'
    });

    const url = new URL('http://localhost:3000/api/fantasy/trades/propose');
    url.searchParams.set('league_id', mockLeagueId);
    url.searchParams.set('team_a_id', mockTeamA);
    url.searchParams.set('team_b_id', mockTeamB);
    url.searchParams.set('trade_type', 'swap');

    const request = new NextRequest(url);
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });
});
