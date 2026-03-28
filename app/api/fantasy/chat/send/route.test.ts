/**
 * Unit Tests: Send Chat Message API
 * 
 * Tests the /api/fantasy/chat/send endpoint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

// Mock dependencies
vi.mock('@/lib/neon/config', () => ({
  sql: vi.fn()
}));

vi.mock('@/lib/fantasy/chat-realtime', () => ({
  syncMessageToFirebase: vi.fn()
}));

vi.mock('uuid', () => ({
  v4: () => 'test-uuid-123'
}));

describe('POST /api/fantasy/chat/send', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Validation', () => {
    it('should return 400 if league_id is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          team_id: 'team_1',
          user_id: 'user_1',
          message_text: 'Hello'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('league_id is required');
    });

    it('should return 400 if team_id is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          league_id: 'league_1',
          user_id: 'user_1',
          message_text: 'Hello'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('team_id is required');
    });

    it('should return 400 if user_id is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          league_id: 'league_1',
          team_id: 'team_1',
          message_text: 'Hello'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('user_id is required');
    });

    it('should return 400 if message_text is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('message_text is required and must be a string');
    });

    it('should return 400 if message_text is not a string', async () => {
      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          message_text: 123
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('message_text is required and must be a string');
    });

    it('should return 400 if message_text is empty', async () => {
      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          message_text: '   '
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('message_text cannot be empty');
    });

    it('should return 400 if message_text exceeds 2000 characters', async () => {
      const longMessage = 'a'.repeat(2001);
      
      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          message_text: longMessage
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('message_text cannot exceed 2000 characters');
    });
  });

  describe('Authorization', () => {
    it('should return 404 if team not found in league', async () => {
      const { sql } = await import('@/lib/neon/config');
      
      // Mock empty team check
      (sql as any).mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          league_id: 'league_1',
          team_id: 'team_999',
          user_id: 'user_1',
          message_text: 'Hello'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Team not found in this league');
    });
  });

  describe('Success Cases', () => {
    it('should successfully send a message', async () => {
      const { sql } = await import('@/lib/neon/config');
      const { syncMessageToFirebase } = await import('@/lib/fantasy/chat-realtime');

      // Mock team check
      (sql as any).mockResolvedValueOnce([
        { team_id: 'team_1', league_id: 'league_1', team_name: 'Test Team' }
      ]);

      // Mock message insert
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_test-uuid-123',
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          message_text: 'Hello!',
          reactions: {},
          is_deleted: false,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01')
        }
      ]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          message_text: 'Hello!'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message.message_id).toBe('msg_test-uuid-123');
      expect(data.message.message_text).toBe('Hello!');
      expect(syncMessageToFirebase).toHaveBeenCalled();
    });

    it('should accept message with exactly 2000 characters', async () => {
      const { sql } = await import('@/lib/neon/config');

      const maxMessage = 'a'.repeat(2000);

      // Mock team check
      (sql as any).mockResolvedValueOnce([
        { team_id: 'team_1', league_id: 'league_1', team_name: 'Test Team' }
      ]);

      // Mock message insert
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_test-uuid-123',
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          message_text: maxMessage,
          reactions: {},
          is_deleted: false,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01')
        }
      ]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          message_text: maxMessage
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Firebase Sync', () => {
    it('should succeed even if Firebase sync fails', async () => {
      const { sql } = await import('@/lib/neon/config');
      const { syncMessageToFirebase } = await import('@/lib/fantasy/chat-realtime');

      // Mock team check
      (sql as any).mockResolvedValueOnce([
        { team_id: 'team_1', league_id: 'league_1', team_name: 'Test Team' }
      ]);

      // Mock message insert
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_test-uuid-123',
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          message_text: 'Hello!',
          reactions: {},
          is_deleted: false,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01')
        }
      ]);

      // Mock Firebase failure
      (syncMessageToFirebase as any).mockRejectedValueOnce(new Error('Firebase error'));

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          message_text: 'Hello!'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      // Should still succeed (PostgreSQL is source of truth)
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
