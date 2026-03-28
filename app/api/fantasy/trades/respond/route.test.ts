import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST, GET } from './route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/auth-helper', () => ({
  verifyAuth: vi.fn()
}));

vi.mock('@/lib/fantasy/trade-processor', () => ({
  respondToTrade: vi.fn(),
  getTradeDetails: vi.fn()
}));

vi.mock('@/lib/neon/fantasy-config', () => ({
  fantasySql: vi.fn()
}));

const { verifyAuth } = await import('@/lib/auth-helper');
const { respondToTrade, getTradeDetails } = await import('@/lib/fantasy/trade-processor');
const { fantasySql } = await import('@/lib/neon/fantasy-config');

describe('POST /api/fantasy/trades/respond', () => {
  const mockUserId = 'user123';
  const mockTeamA = 'team_a';
  const mockTeamB = 'team_b';
  const mockLeagueId = 'league_1';
  const mockTradeId = 'trade_123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully accept a trade', async () => {
    // Mock authentication
    vi.mocked(verifyAuth).mockResolvedValue({
      authenticated: true,
      userId: mockUserId,
      error: null
    });

    // Mock database query
    vi.mocked(fantasySql).mockResolvedValueOnce([{
      team_id: mockTeamB,
      owner_uid: mockUserId,
      league_id: mockLeagueId,
      team_name: 'Team B'
    }]);

    // Mock trade details
    vi.mocked(getTradeDetails).mockResolvedValue({
      trade_id: mockTradeId,
      team_a_id: mockTeamA,
      team_b_id: mockTeamB,
      league_id: mockLeagueId,
      status: 'pending'
    });

    // Mock trade response
    vi.mocked(respondToTrade).mockResolvedValue({
      success: true,
      action: 'accepted',
      message: 'Trade executed successfully',
      trade_details: {
        team_a_players: ['P1'],
        team_b_players: ['P2'],
        team_a_cash: 0,
        team_b_cash: 0
      }
    });

    const request = new NextRequest('http://localhost:3000/api/fantasy/trades/respond', {
      method: 'POST',
      body: JSON.stringify({
        trade_id: mockTradeId,
        team_id: mockTeamB,
        action: 'accept'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.action).toBe('accepted');
    expect(data.trade_details).toBeDefined();
  });

  it('should successfully reject a trade', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({
      authenticated: true,
      userId: mockUserId,
      error: null
    });

    vi.mocked(fantasySql).mockResolvedValueOnce([{
      team_id: mockTeamB,
      owner_uid: mockUserId,
      league_id: mockLeagueId,
      team_name: 'Team B'
    }]);

    vi.mocked(getTradeDetails).mockResolvedValue({
      trade_id: mockTradeId,
      team_a_id: mockTeamA,
      team_b_id: mockTeamB,
      league_id: mockLeagueId,
      status: 'pending'
    });

    vi.mocked(respondToTrade).mockResolvedValue({
      success: true,
      action: 'rejected',
      message: 'Trade rejected successfully'
    });

    const request = new NextRequest('http://localhost:3000/api/fantasy/trades/respond', {
      method: 'POST',
      body: JSON.stringify({
        trade_id: mockTradeId,
        team_id: mockTeamB,
        action: 'reject',
        response_message: 'Not interested'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.action).toBe('rejected');
  });

  it('should reject unauthenticated requests', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({
      authenticated: false,
      userId: null,
      error: 'Unauthorized'
    });

    const request = new NextRequest('http://localhost:3000/api/fantasy/trades/respond', {
      method: 'POST',
      body: JSON.stringify({
        trade_id: mockTradeId,
        team_id: mockTeamB,
        action: 'accept'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
  });

  it('should reject missing required parameters', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({
      authenticated: true,
      userId: mockUserId,
      error: null
    });

    const request = new NextRequest('http://localhost:3000/api/fantasy/trades/respond', {
      method: 'POST',
      body: JSON.stringify({
        trade_id: mockTradeId,
        // Missing team_id and action
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Missing required parameters');
  });

  it('should reject invalid action', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({
      authenticated: true,
      userId: mockUserId,
      error: null
    });

    const request = new NextRequest('http://localhost:3000/api/fantasy/trades/respond', {
      method: 'POST',
      body: JSON.stringify({
        trade_id: mockTradeId,
        team_id: mockTeamB,
        action: 'invalid'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Invalid action');
  });

  it('should reject if user does not own receiver team', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({
      authenticated: true,
      userId: 'different_user',
      error: null
    });

    vi.mocked(fantasySql).mockResolvedValueOnce([{
      team_id: mockTeamB,
      owner_uid: mockUserId, // Different from authenticated user
      league_id: mockLeagueId,
      team_name: 'Team B'
    }]);

    const request = new NextRequest('http://localhost:3000/api/fantasy/trades/respond', {
      method: 'POST',
      body: JSON.stringify({
        trade_id: mockTradeId,
        team_id: mockTeamB,
        action: 'accept'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Forbidden');
  });

  it('should reject if team is not the receiver', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({
      authenticated: true,
      userId: mockUserId,
      error: null
    });

    vi.mocked(fantasySql).mockResolvedValueOnce([{
      team_id: mockTeamA,
      owner_uid: mockUserId,
      league_id: mockLeagueId,
      team_name: 'Team A'
    }]);

    vi.mocked(getTradeDetails).mockResolvedValue({
      trade_id: mockTradeId,
      team_a_id: mockTeamA,
      team_b_id: mockTeamB,
      league_id: mockLeagueId,
      status: 'pending'
    });

    const request = new NextRequest('http://localhost:3000/api/fantasy/trades/respond', {
      method: 'POST',
      body: JSON.stringify({
        trade_id: mockTradeId,
        team_id: mockTeamA, // Proposer trying to respond
        action: 'accept'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Only the receiver can respond');
  });

  it('should handle expired trades', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({
      authenticated: true,
      userId: mockUserId,
      error: null
    });

    vi.mocked(fantasySql).mockResolvedValueOnce([{
      team_id: mockTeamB,
      owner_uid: mockUserId,
      league_id: mockLeagueId,
      team_name: 'Team B'
    }]);

    vi.mocked(getTradeDetails).mockResolvedValue({
      trade_id: mockTradeId,
      team_a_id: mockTeamA,
      team_b_id: mockTeamB,
      league_id: mockLeagueId,
      status: 'pending'
    });

    vi.mocked(respondToTrade).mockRejectedValue(new Error('Trade has expired'));

    const request = new NextRequest('http://localhost:3000/api/fantasy/trades/respond', {
      method: 'POST',
      body: JSON.stringify({
        trade_id: mockTradeId,
        team_id: mockTeamB,
        action: 'accept'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(410);
    expect(data.success).toBe(false);
    expect(data.error).toContain('expired');
  });
});

describe('GET /api/fantasy/trades/respond', () => {
  const mockUserId = 'user123';
  const mockTeamB = 'team_b';
  const mockTradeId = 'trade_123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get trade details for review', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({
      authenticated: true,
      userId: mockUserId,
      error: null
    });

    vi.mocked(fantasySql).mockResolvedValueOnce([{
      team_id: mockTeamB,
      owner_uid: mockUserId
    }]);

    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 24);

    vi.mocked(getTradeDetails).mockResolvedValue({
      trade_id: mockTradeId,
      team_a_id: 'team_a',
      team_b_id: mockTeamB,
      team_a_name: 'Team A',
      team_b_name: 'Team B',
      league_id: 'league_1',
      trade_type: 'swap',
      team_a_players: ['P1'],
      team_b_players: ['P2'],
      team_a_cash: '0',
      team_b_cash: '0',
      status: 'pending',
      proposed_at: new Date().toISOString(),
      expires_at: futureDate.toISOString()
    });

    const url = new URL('http://localhost:3000/api/fantasy/trades/respond');
    url.searchParams.set('trade_id', mockTradeId);
    url.searchParams.set('team_id', mockTeamB);

    const request = new NextRequest(url);
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.trade).toBeDefined();
    expect(data.can_respond).toBe(true);
  });

  it('should indicate cannot respond if expired', async () => {
    vi.mocked(verifyAuth).mockResolvedValue({
      authenticated: true,
      userId: mockUserId,
      error: null
    });

    vi.mocked(fantasySql).mockResolvedValueOnce([{
      team_id: mockTeamB,
      owner_uid: mockUserId
    }]);

    const pastDate = new Date();
    pastDate.setHours(pastDate.getHours() - 1);

    vi.mocked(getTradeDetails).mockResolvedValue({
      trade_id: mockTradeId,
      team_a_id: 'team_a',
      team_b_id: mockTeamB,
      team_a_name: 'Team A',
      team_b_name: 'Team B',
      league_id: 'league_1',
      trade_type: 'swap',
      team_a_players: ['P1'],
      team_b_players: ['P2'],
      team_a_cash: '0',
      team_b_cash: '0',
      status: 'pending',
      proposed_at: new Date().toISOString(),
      expires_at: pastDate.toISOString()
    });

    const url = new URL('http://localhost:3000/api/fantasy/trades/respond');
    url.searchParams.set('trade_id', mockTradeId);
    url.searchParams.set('team_id', mockTeamB);

    const request = new NextRequest(url);
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.can_respond).toBe(false);
  });
});
