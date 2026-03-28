/**
 * Unit Tests: Delete Chat Message API
 * 
 * Tests the /api/fantasy/chat/delete endpoint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE } from './route';

// Mock dependencies
vi.mock('@/lib/neon/config', () => ({
  sql: vi.fn()
}));

vi.mock('@/lib/fantasy/chat-realtime', () => ({
  markMessageDeletedInFirebase: vi.fn()
}));

describe('DELETE /api/fantasy/chat/delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Validation', () => {
    it('should return 400 if message_id is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/delete', {
        method: 'DELETE',
        body: JSON.stringify({
          user_id: 'user_1'
        })
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('message_id is required');
    });

    it('should return 400 if user_id is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/delete', {
        method: 'DELETE',
        body: JSON.stringify({
          message_id: 'msg_1'
        })
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('user_id is required');
    });

    it('should return 404 if message not found', async () => {
      const { sql } = await import('@/lib/neon/config');
      
      // Mock empty message check
      (sql as any).mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/delete', {
        method: 'DELETE',
        body: JSON.stringify({
          message_id: 'msg_999',
          user_id: 'user_1'
        })
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Message not found');
    });

    it('should return 400 if message already deleted', async () => {
      const { sql } = await import('@/lib/neon/config');
      
      // Mock message check (already deleted)
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_1',
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          is_deleted: true
        }
      ]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/delete', {
        method: 'DELETE',
        body: JSON.stringify({
          message_id: 'msg_1',
          user_id: 'user_1'
        })
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Message already deleted');
    });
  });

  describe('Authorization', () => {
    it('should return 403 if user does not own the message', async () => {
      const { sql } = await import('@/lib/neon/config');
      
      // Mock message check (different user)
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_1',
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_2',
          is_deleted: false
        }
      ]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/delete', {
        method: 'DELETE',
        body: JSON.stringify({
          message_id: 'msg_1',
          user_id: 'user_1'
        })
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden: You can only delete your own messages');
    });
  });

  describe('Success Cases', () => {
    it('should successfully delete a message', async () => {
      const { sql } = await import('@/lib/neon/config');
      const { markMessageDeletedInFirebase } = await import('@/lib/fantasy/chat-realtime');

      // Mock message check
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_1',
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          is_deleted: false
        }
      ]);

      // Mock delete update
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_1',
          league_id: 'league_1',
          is_deleted: true,
          updated_at: new Date('2024-01-01')
        }
      ]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/delete', {
        method: 'DELETE',
        body: JSON.stringify({
          message_id: 'msg_1',
          user_id: 'user_1'
        })
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Message deleted successfully');
      expect(data.message_id).toBe('msg_1');
      expect(markMessageDeletedInFirebase).toHaveBeenCalledWith('league_1', 'msg_1');
    });

    it('should succeed even if Firebase sync fails', async () => {
      const { sql } = await import('@/lib/neon/config');
      const { markMessageDeletedInFirebase } = await import('@/lib/fantasy/chat-realtime');

      // Mock message check
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_1',
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          is_deleted: false
        }
      ]);

      // Mock delete update
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_1',
          league_id: 'league_1',
          is_deleted: true,
          updated_at: new Date('2024-01-01')
        }
      ]);

      // Mock Firebase failure
      (markMessageDeletedInFirebase as any).mockRejectedValueOnce(new Error('Firebase error'));

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/delete', {
        method: 'DELETE',
        body: JSON.stringify({
          message_id: 'msg_1',
          user_id: 'user_1'
        })
      });

      const response = await DELETE(request);
      const data = await response.json();

      // Should still succeed (PostgreSQL is source of truth)
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
