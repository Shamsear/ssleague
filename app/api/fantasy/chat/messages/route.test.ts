/**
 * Unit Tests: Get Chat Messages API
 * 
 * Tests the /api/fantasy/chat/messages endpoint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

// Mock dependencies
vi.mock('@/lib/neon/config', () => ({
  sql: vi.fn()
}));

describe('GET /api/fantasy/chat/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Validation', () => {
    it('should return 400 if league_id is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/messages');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('league_id is required');
    });

    it('should return 400 if limit is less than 1', async () => {
      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/messages?league_id=league_1&limit=0');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('limit must be between 1 and 100');
    });

    it('should return 400 if limit exceeds 100', async () => {
      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/messages?league_id=league_1&limit=101');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('limit must be between 1 and 100');
    });

    it('should return 400 if offset is negative', async () => {
      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/messages?league_id=league_1&offset=-1');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('offset must be non-negative');
    });

    it('should return 404 if league not found', async () => {
      const { sql } = await import('@/lib/neon/config');
      
      // Mock empty league check
      (sql as any).mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/messages?league_id=league_999');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('League not found');
    });
  });

  describe('Standard Pagination', () => {
    it('should return messages with default pagination', async () => {
      const { sql } = await import('@/lib/neon/config');

      // Mock league check
      (sql as any).mockResolvedValueOnce([{ league_id: 'league_1' }]);

      // Mock messages query
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_1',
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          message_text: 'Hello',
          reactions: {},
          is_deleted: false,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01')
        }
      ]);

      // Mock count query
      (sql as any).mockResolvedValueOnce([{ total: '1' }]);

      // Mock team names query
      (sql as any).mockResolvedValueOnce([
        { team_id: 'team_1', team_name: 'Test Team' }
      ]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/messages?league_id=league_1');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.messages).toHaveLength(1);
      expect(data.messages[0].team_name).toBe('Test Team');
      expect(data.pagination.limit).toBe(50);
      expect(data.pagination.offset).toBe(0);
      expect(data.pagination.total).toBe(1);
    });

    it('should respect custom limit and offset', async () => {
      const { sql } = await import('@/lib/neon/config');

      // Mock league check
      (sql as any).mockResolvedValueOnce([{ league_id: 'league_1' }]);

      // Mock messages query
      (sql as any).mockResolvedValueOnce([]);

      // Mock count query
      (sql as any).mockResolvedValueOnce([{ total: '100' }]);

      // Mock team names query
      (sql as any).mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/messages?league_id=league_1&limit=10&offset=20');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.limit).toBe(10);
      expect(data.pagination.offset).toBe(20);
      expect(data.pagination.has_more).toBe(true);
    });
  });

  describe('Cursor-based Pagination', () => {
    it('should return messages before a specific message', async () => {
      const { sql } = await import('@/lib/neon/config');

      // Mock league check
      (sql as any).mockResolvedValueOnce([{ league_id: 'league_1' }]);

      // Mock before message check
      (sql as any).mockResolvedValueOnce([
        { created_at: new Date('2024-01-02') }
      ]);

      // Mock messages query
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_1',
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          message_text: 'Older message',
          reactions: {},
          is_deleted: false,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01')
        }
      ]);

      // Mock count query
      (sql as any).mockResolvedValueOnce([{ total: '2' }]);

      // Mock team names query
      (sql as any).mockResolvedValueOnce([
        { team_id: 'team_1', team_name: 'Test Team' }
      ]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/messages?league_id=league_1&before_message_id=msg_2');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.messages).toHaveLength(1);
      expect(data.messages[0].message_text).toBe('Older message');
    });

    it('should return 404 if before_message_id not found', async () => {
      const { sql } = await import('@/lib/neon/config');

      // Mock league check
      (sql as any).mockResolvedValueOnce([{ league_id: 'league_1' }]);

      // Mock empty before message check
      (sql as any).mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/messages?league_id=league_1&before_message_id=msg_999');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Reference message not found');
    });

    it('should return messages after a specific message', async () => {
      const { sql } = await import('@/lib/neon/config');

      // Mock league check
      (sql as any).mockResolvedValueOnce([{ league_id: 'league_1' }]);

      // Mock after message check
      (sql as any).mockResolvedValueOnce([
        { created_at: new Date('2024-01-01') }
      ]);

      // Mock messages query
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_2',
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          message_text: 'Newer message',
          reactions: {},
          is_deleted: false,
          created_at: new Date('2024-01-02'),
          updated_at: new Date('2024-01-02')
        }
      ]);

      // Mock count query
      (sql as any).mockResolvedValueOnce([{ total: '2' }]);

      // Mock team names query
      (sql as any).mockResolvedValueOnce([
        { team_id: 'team_1', team_name: 'Test Team' }
      ]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/messages?league_id=league_1&after_message_id=msg_1');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.messages).toHaveLength(1);
      expect(data.messages[0].message_text).toBe('Newer message');
    });

    it('should return 404 if after_message_id not found', async () => {
      const { sql } = await import('@/lib/neon/config');

      // Mock league check
      (sql as any).mockResolvedValueOnce([{ league_id: 'league_1' }]);

      // Mock empty after message check
      (sql as any).mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/messages?league_id=league_1&after_message_id=msg_999');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Reference message not found');
    });
  });

  describe('Team Name Enrichment', () => {
    it('should enrich messages with team names', async () => {
      const { sql } = await import('@/lib/neon/config');

      // Mock league check
      (sql as any).mockResolvedValueOnce([{ league_id: 'league_1' }]);

      // Mock messages query
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_1',
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          message_text: 'Hello',
          reactions: {},
          is_deleted: false,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01')
        },
        {
          message_id: 'msg_2',
          league_id: 'league_1',
          team_id: 'team_2',
          user_id: 'user_2',
          message_text: 'Hi',
          reactions: {},
          is_deleted: false,
          created_at: new Date('2024-01-02'),
          updated_at: new Date('2024-01-02')
        }
      ]);

      // Mock count query
      (sql as any).mockResolvedValueOnce([{ total: '2' }]);

      // Mock team names query
      (sql as any).mockResolvedValueOnce([
        { team_id: 'team_1', team_name: 'Team A' },
        { team_id: 'team_2', team_name: 'Team B' }
      ]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/messages?league_id=league_1');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.messages[0].team_name).toBe('Team A');
      expect(data.messages[1].team_name).toBe('Team B');
    });

    it('should use "Unknown Team" for missing team names', async () => {
      const { sql } = await import('@/lib/neon/config');

      // Mock league check
      (sql as any).mockResolvedValueOnce([{ league_id: 'league_1' }]);

      // Mock messages query
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_1',
          league_id: 'league_1',
          team_id: 'team_999',
          user_id: 'user_1',
          message_text: 'Hello',
          reactions: {},
          is_deleted: false,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01')
        }
      ]);

      // Mock count query
      (sql as any).mockResolvedValueOnce([{ total: '1' }]);

      // Mock empty team names query
      (sql as any).mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/messages?league_id=league_1');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.messages[0].team_name).toBe('Unknown Team');
    });
  });

  describe('Pagination Info', () => {
    it('should indicate has_more when there are more messages', async () => {
      const { sql } = await import('@/lib/neon/config');

      // Mock league check
      (sql as any).mockResolvedValueOnce([{ league_id: 'league_1' }]);

      // Mock messages query (10 messages)
      const messages = Array.from({ length: 10 }, (_, i) => ({
        message_id: `msg_${i}`,
        league_id: 'league_1',
        team_id: 'team_1',
        user_id: 'user_1',
        message_text: `Message ${i}`,
        reactions: {},
        is_deleted: false,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01')
      }));
      (sql as any).mockResolvedValueOnce(messages);

      // Mock count query (100 total)
      (sql as any).mockResolvedValueOnce([{ total: '100' }]);

      // Mock team names query
      (sql as any).mockResolvedValueOnce([
        { team_id: 'team_1', team_name: 'Test Team' }
      ]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/messages?league_id=league_1&limit=10&offset=0');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.has_more).toBe(true);
      expect(data.pagination.total).toBe(100);
    });

    it('should indicate no more messages when at end', async () => {
      const { sql } = await import('@/lib/neon/config');

      // Mock league check
      (sql as any).mockResolvedValueOnce([{ league_id: 'league_1' }]);

      // Mock messages query (5 messages)
      const messages = Array.from({ length: 5 }, (_, i) => ({
        message_id: `msg_${i}`,
        league_id: 'league_1',
        team_id: 'team_1',
        user_id: 'user_1',
        message_text: `Message ${i}`,
        reactions: {},
        is_deleted: false,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01')
      }));
      (sql as any).mockResolvedValueOnce(messages);

      // Mock count query (15 total)
      (sql as any).mockResolvedValueOnce([{ total: '15' }]);

      // Mock team names query
      (sql as any).mockResolvedValueOnce([
        { team_id: 'team_1', team_name: 'Test Team' }
      ]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/messages?league_id=league_1&limit=10&offset=10');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.has_more).toBe(false);
    });
  });
});
