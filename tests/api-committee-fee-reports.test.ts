/**
 * API tests for committee fee reports endpoint
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { GET } from '../app/api/committee/fee-reports/route';
import { NextRequest } from 'next/server';

// Mock the committee fee reports module
vi.mock('../lib/committee-fee-reports', () => ({
  getCommitteeFeesBySeason: vi.fn(),
  getCommitteeFeesByTeam: vi.fn(),
  getCommitteeFeeBreakdown: vi.fn()
}));

describe('Committee Fee Reports API', () => {
  describe('GET /api/committee/fee-reports', () => {
    test('returns 400 when season_id is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/committee/fee-reports');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('season_id is required');
    });
    
    test('returns 400 when report_type is invalid', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/committee/fee-reports?season_id=SSPSLS16&report_type=invalid'
      );
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid report_type');
    });
    
    test('returns by_season report when report_type is by_season', async () => {
      const { getCommitteeFeesBySeason } = await import('../lib/committee-fee-reports');
      
      const mockData = {
        seasonId: 'SSPSLS16',
        totalTransferFees: 100,
        totalSwapFees: 200,
        totalFees: 300,
        transferCount: 5,
        swapCount: 3
      };
      
      (getCommitteeFeesBySeason as any).mockResolvedValue(mockData);
      
      const request = new NextRequest(
        'http://localhost:3000/api/committee/fee-reports?season_id=SSPSLS16&report_type=by_season'
      );
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.report_type).toBe('by_season');
      expect(data.season_id).toBe('SSPSLS16');
      expect(data.data).toEqual(mockData);
      expect(getCommitteeFeesBySeason).toHaveBeenCalledWith('SSPSLS16');
    });
    
    test('returns by_team report when report_type is by_team', async () => {
      const { getCommitteeFeesByTeam } = await import('../lib/committee-fee-reports');
      
      const mockData = [
        {
          teamId: 'SSPSLT0001',
          seasonId: 'SSPSLS16',
          transferFeesPaid: 50,
          swapFeesPaid: 60,
          totalFeesPaid: 110,
          transferCount: 2,
          swapCount: 1
        }
      ];
      
      (getCommitteeFeesByTeam as any).mockResolvedValue(mockData);
      
      const request = new NextRequest(
        'http://localhost:3000/api/committee/fee-reports?season_id=SSPSLS16&report_type=by_team'
      );
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.report_type).toBe('by_team');
      expect(data.data).toEqual(mockData);
      expect(getCommitteeFeesByTeam).toHaveBeenCalledWith('SSPSLS16');
    });
    
    test('returns breakdown report when report_type is breakdown', async () => {
      const { getCommitteeFeeBreakdown } = await import('../lib/committee-fee-reports');
      
      const mockData = {
        seasonId: 'SSPSLS16',
        totalFees: 300,
        transfers: {
          count: 2,
          totalFees: 100,
          transactions: []
        },
        swaps: {
          count: 1,
          totalFees: 200,
          transactions: []
        }
      };
      
      (getCommitteeFeeBreakdown as any).mockResolvedValue(mockData);
      
      const request = new NextRequest(
        'http://localhost:3000/api/committee/fee-reports?season_id=SSPSLS16&report_type=breakdown'
      );
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.report_type).toBe('breakdown');
      expect(data.data).toEqual(mockData);
      expect(getCommitteeFeeBreakdown).toHaveBeenCalledWith('SSPSLS16');
    });
    
    test('defaults to by_season when report_type is not specified', async () => {
      const { getCommitteeFeesBySeason } = await import('../lib/committee-fee-reports');
      
      const mockData = {
        seasonId: 'SSPSLS16',
        totalTransferFees: 100,
        totalSwapFees: 200,
        totalFees: 300,
        transferCount: 5,
        swapCount: 3
      };
      
      (getCommitteeFeesBySeason as any).mockResolvedValue(mockData);
      
      const request = new NextRequest(
        'http://localhost:3000/api/committee/fee-reports?season_id=SSPSLS16'
      );
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.report_type).toBe('by_season');
      expect(getCommitteeFeesBySeason).toHaveBeenCalledWith('SSPSLS16');
    });
    
    test('returns 500 when an error occurs', async () => {
      const { getCommitteeFeesBySeason } = await import('../lib/committee-fee-reports');
      
      (getCommitteeFeesBySeason as any).mockRejectedValue(new Error('Database error'));
      
      const request = new NextRequest(
        'http://localhost:3000/api/committee/fee-reports?season_id=SSPSLS16'
      );
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Database error');
    });
  });
});
