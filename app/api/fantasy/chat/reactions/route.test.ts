/**
 * Unit Tests: Chat Reactions API
 * 
 * Tests the /api/fantasy/chat/reactions endpoint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

// Mock dependencies
vi.mock('@/lib/neon/config', () => ({
  sql: vi.fn()
}));

vi.mock('@/lib/fantasy/chat-realtime', () => ({
  updateMessageReactions: vi.fn()
}));

describe('POST /api/fantasy/chat/reactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Validation', () => {
    it('should return 400 if message_id is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/reactions', {
        method: 'POST',
        body: JSON.stringify({
          user_id: 'user_1',
          emoji: '👍',
          action: 'add'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('message_id is required');
    });

    it('should return 400 if user_id is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/reactions', {
        method: 'POST',
        body: JSON.stringify({
          message_id: 'msg_1',
          emoji: '👍',
          action: 'add'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('user_id is required');
    });

    it('should return 400 if emoji is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/reactions', {
        method: 'POST',
        body: JSON.stringify({
          message_id: 'msg_1',
          user_id: 'user_1',
          action: 'add'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('emoji is required and must be a string');
    });

    it('should return 400 if emoji is not a string', async () => {
      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/reactions', {
        method: 'POST',
        body: JSON.stringify({
          message_id: 'msg_1',
          user_id: 'user_1',
          emoji: 123,
          action: 'add'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('emoji is required and must be a string');
    });

    it('should return 400 if action is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/reactions', {
        method: 'POST',
        body: JSON.stringify({
          message_id: 'msg_1',
          user_id: 'user_1',
          emoji: '👍'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('action must be either "add" or "remove"');
    });

    it('should return 400 if action is invalid', async () => {
      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/reactions', {
        method: 'POST',
        body: JSON.stringify({
          message_id: 'msg_1',
          user_id: 'user_1',
          emoji: '👍',
          action: 'invalid'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('action must be either "add" or "remove"');
    });

    it('should return 400 if emoji is too long', async () => {
      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/reactions', {
        method: 'POST',
        body: JSON.stringify({
          message_id: 'msg_1',
          user_id: 'user_1',
          emoji: 'a'.repeat(11),
          action: 'add'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('emoji is too long');
    });

    it('should return 404 if message not found', async () => {
      const { sql } = await import('@/lib/neon/config');
      
      // Mock empty message check
      (sql as any).mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/reactions', {
        method: 'POST',
        body: JSON.stringify({
          message_id: 'msg_999',
          user_id: 'user_1',
          emoji: '👍',
          action: 'add'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Message not found');
    });

    it('should return 400 if message is deleted', async () => {
      const { sql } = await import('@/lib/neon/config');
      
      // Mock message check (deleted)
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_1',
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          reactions: {},
          is_deleted: true
        }
      ]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/reactions', {
        method: 'POST',
        body: JSON.stringify({
          message_id: 'msg_1',
          user_id: 'user_1',
          emoji: '👍',
          action: 'add'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Cannot react to deleted messages');
    });
  });

  describe('Add Reaction', () => {
    it('should add a new reaction to a message', async () => {
      const { sql } = await import('@/lib/neon/config');
      const { updateMessageReactions } = await import('@/lib/fantasy/chat-realtime');

      // Mock message check
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_1',
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          reactions: {},
          is_deleted: false
        }
      ]);

      // Mock reactions update
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_1',
          league_id: 'league_1',
          reactions: { '👍': ['user_1'] },
          updated_at: new Date('2024-01-01')
        }
      ]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/reactions', {
        method: 'POST',
        body: JSON.stringify({
          message_id: 'msg_1',
          user_id: 'user_1',
          emoji: '👍',
          action: 'add'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.reactions['👍']).toContain('user_1');
      expect(updateMessageReactions).toHaveBeenCalledWith('league_1', 'msg_1', { '👍': ['user_1'] });
    });

    it('should add user to existing emoji reaction', async () => {
      const { sql } = await import('@/lib/neon/config');

      // Mock message check (already has one reaction)
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_1',
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          reactions: { '👍': ['user_2'] },
          is_deleted: false
        }
      ]);

      // Mock reactions update
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_1',
          league_id: 'league_1',
          reactions: { '👍': ['user_2', 'user_1'] },
          updated_at: new Date('2024-01-01')
        }
      ]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/reactions', {
        method: 'POST',
        body: JSON.stringify({
          message_id: 'msg_1',
          user_id: 'user_1',
          emoji: '👍',
          action: 'add'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.reactions['👍']).toHaveLength(2);
      expect(data.reactions['👍']).toContain('user_1');
      expect(data.reactions['👍']).toContain('user_2');
    });

    it('should not duplicate user in reaction list', async () => {
      const { sql } = await import('@/lib/neon/config');

      // Mock message check (user already reacted)
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_1',
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          reactions: { '👍': ['user_1'] },
          is_deleted: false
        }
      ]);

      // Mock reactions update (no change)
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_1',
          league_id: 'league_1',
          reactions: { '👍': ['user_1'] },
          updated_at: new Date('2024-01-01')
        }
      ]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/reactions', {
        method: 'POST',
        body: JSON.stringify({
          message_id: 'msg_1',
          user_id: 'user_1',
          emoji: '👍',
          action: 'add'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.reactions['👍']).toHaveLength(1);
    });
  });

  describe('Remove Reaction', () => {
    it('should remove user from reaction list', async () => {
      const { sql } = await import('@/lib/neon/config');
      const { updateMessageReactions } = await import('@/lib/fantasy/chat-realtime');

      // Mock message check
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_1',
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          reactions: { '👍': ['user_1', 'user_2'] },
          is_deleted: false
        }
      ]);

      // Mock reactions update
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_1',
          league_id: 'league_1',
          reactions: { '👍': ['user_2'] },
          updated_at: new Date('2024-01-01')
        }
      ]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/reactions', {
        method: 'POST',
        body: JSON.stringify({
          message_id: 'msg_1',
          user_id: 'user_1',
          emoji: '👍',
          action: 'remove'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.reactions['👍']).not.toContain('user_1');
      expect(data.reactions['👍']).toContain('user_2');
      expect(updateMessageReactions).toHaveBeenCalled();
    });

    it('should remove emoji key when last user is removed', async () => {
      const { sql } = await import('@/lib/neon/config');

      // Mock message check
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_1',
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          reactions: { '👍': ['user_1'] },
          is_deleted: false
        }
      ]);

      // Mock reactions update
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_1',
          league_id: 'league_1',
          reactions: {},
          updated_at: new Date('2024-01-01')
        }
      ]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/reactions', {
        method: 'POST',
        body: JSON.stringify({
          message_id: 'msg_1',
          user_id: 'user_1',
          emoji: '👍',
          action: 'remove'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.reactions['👍']).toBeUndefined();
    });

    it('should handle removing non-existent reaction gracefully', async () => {
      const { sql } = await import('@/lib/neon/config');

      // Mock message check (no reactions)
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_1',
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          reactions: {},
          is_deleted: false
        }
      ]);

      // Mock reactions update (no change)
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_1',
          league_id: 'league_1',
          reactions: {},
          updated_at: new Date('2024-01-01')
        }
      ]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/reactions', {
        method: 'POST',
        body: JSON.stringify({
          message_id: 'msg_1',
          user_id: 'user_1',
          emoji: '👍',
          action: 'remove'
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
      const { updateMessageReactions } = await import('@/lib/fantasy/chat-realtime');

      // Mock message check
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_1',
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          reactions: {},
          is_deleted: false
        }
      ]);

      // Mock reactions update
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_1',
          league_id: 'league_1',
          reactions: { '👍': ['user_1'] },
          updated_at: new Date('2024-01-01')
        }
      ]);

      // Mock Firebase failure
      (updateMessageReactions as any).mockRejectedValueOnce(new Error('Firebase error'));

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/reactions', {
        method: 'POST',
        body: JSON.stringify({
          message_id: 'msg_1',
          user_id: 'user_1',
          emoji: '👍',
          action: 'add'
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
