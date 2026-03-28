/**
 * Integration Tests: Fantasy Chat Real-time Updates
 * 
 * Tests the integration between PostgreSQL and Firebase Realtime Database
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as sendMessage } from './send/route';
import { DELETE as deleteMessage } from './delete/route';
import { POST as manageReactions } from './reactions/route';

// Mock dependencies
vi.mock('@/lib/neon/config', () => ({
  sql: vi.fn()
}));

vi.mock('@/lib/fantasy/chat-realtime', () => ({
  syncMessageToFirebase: vi.fn(),
  markMessageDeletedInFirebase: vi.fn(),
  updateMessageReactions: vi.fn()
}));

describe('Fantasy Chat Real-time Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Send Message with Firebase Sync', () => {
    it('should sync message to Firebase after PostgreSQL insert', async () => {
      const { sql } = await import('@/lib/neon/config');
      const { syncMessageToFirebase } = await import('@/lib/fantasy/chat-realtime');

      // Mock team check
      (sql as any).mockResolvedValueOnce([
        { team_id: 'team_1', league_id: 'league_1', team_name: 'Test Team' }
      ]);

      // Mock message insert
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_123',
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

      const response = await sendMessage(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(syncMessageToFirebase).toHaveBeenCalledWith(
        expect.objectContaining({
          message_id: 'msg_123',
          league_id: 'league_1',
          team_id: 'team_1',
          team_name: 'Test Team',
          message_text: 'Hello!'
        })
      );
    });

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
          message_id: 'msg_123',
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

      // Mock Firebase sync failure
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

      const response = await sendMessage(request);
      const data = await response.json();

      // Should still succeed (PostgreSQL is source of truth)
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Delete Message with Firebase Sync', () => {
    it('should sync deletion to Firebase after PostgreSQL update', async () => {
      const { sql } = await import('@/lib/neon/config');
      const { markMessageDeletedInFirebase } = await import('@/lib/fantasy/chat-realtime');

      // Mock message check
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_123',
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          is_deleted: false
        }
      ]);

      // Mock delete update
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_123',
          league_id: 'league_1',
          is_deleted: true,
          updated_at: new Date('2024-01-01')
        }
      ]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/delete', {
        method: 'DELETE',
        body: JSON.stringify({
          message_id: 'msg_123',
          user_id: 'user_1'
        })
      });

      const response = await deleteMessage(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(markMessageDeletedInFirebase).toHaveBeenCalledWith('league_1', 'msg_123');
    });

    it('should succeed even if Firebase sync fails', async () => {
      const { sql } = await import('@/lib/neon/config');
      const { markMessageDeletedInFirebase } = await import('@/lib/fantasy/chat-realtime');

      // Mock message check
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_123',
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          is_deleted: false
        }
      ]);

      // Mock delete update
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_123',
          league_id: 'league_1',
          is_deleted: true,
          updated_at: new Date('2024-01-01')
        }
      ]);

      // Mock Firebase sync failure
      (markMessageDeletedInFirebase as any).mockRejectedValueOnce(new Error('Firebase error'));

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/delete', {
        method: 'DELETE',
        body: JSON.stringify({
          message_id: 'msg_123',
          user_id: 'user_1'
        })
      });

      const response = await deleteMessage(request);
      const data = await response.json();

      // Should still succeed
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Manage Reactions with Firebase Sync', () => {
    it('should sync reactions to Firebase after PostgreSQL update', async () => {
      const { sql } = await import('@/lib/neon/config');
      const { updateMessageReactions } = await import('@/lib/fantasy/chat-realtime');

      // Mock message check
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_123',
          reactions: {},
          is_deleted: false
        }
      ]);

      // Mock reactions update
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_123',
          reactions: { '👍': ['user_1'] },
          updated_at: new Date('2024-01-01')
        }
      ]);

      // Mock league_id fetch
      (sql as any).mockResolvedValueOnce([
        { league_id: 'league_1' }
      ]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/reactions', {
        method: 'POST',
        body: JSON.stringify({
          message_id: 'msg_123',
          user_id: 'user_1',
          emoji: '👍',
          action: 'add'
        })
      });

      const response = await manageReactions(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(updateMessageReactions).toHaveBeenCalledWith(
        'league_1',
        'msg_123',
        { '👍': ['user_1'] }
      );
    });

    it('should succeed even if Firebase sync fails', async () => {
      const { sql } = await import('@/lib/neon/config');
      const { updateMessageReactions } = await import('@/lib/fantasy/chat-realtime');

      // Mock message check
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_123',
          reactions: {},
          is_deleted: false
        }
      ]);

      // Mock reactions update
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_123',
          reactions: { '👍': ['user_1'] },
          updated_at: new Date('2024-01-01')
        }
      ]);

      // Mock league_id fetch
      (sql as any).mockResolvedValueOnce([
        { league_id: 'league_1' }
      ]);

      // Mock Firebase sync failure
      (updateMessageReactions as any).mockRejectedValueOnce(new Error('Firebase error'));

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/reactions', {
        method: 'POST',
        body: JSON.stringify({
          message_id: 'msg_123',
          user_id: 'user_1',
          emoji: '👍',
          action: 'add'
        })
      });

      const response = await manageReactions(request);
      const data = await response.json();

      // Should still succeed
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Data Consistency', () => {
    it('should maintain PostgreSQL as source of truth', async () => {
      // This test verifies that even if Firebase operations fail,
      // the PostgreSQL operations succeed and the API returns success

      const { sql } = await import('@/lib/neon/config');
      const { syncMessageToFirebase } = await import('@/lib/fantasy/chat-realtime');

      // Mock successful PostgreSQL operations
      (sql as any).mockResolvedValueOnce([
        { team_id: 'team_1', league_id: 'league_1', team_name: 'Test Team' }
      ]);
      (sql as any).mockResolvedValueOnce([
        {
          message_id: 'msg_123',
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
      (syncMessageToFirebase as any).mockRejectedValueOnce(new Error('Firebase down'));

      const request = new NextRequest('http://localhost:3000/api/fantasy/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          message_text: 'Hello!'
        })
      });

      const response = await sendMessage(request);
      const data = await response.json();

      // PostgreSQL succeeded, so API should return success
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message.message_id).toBe('msg_123');
    });
  });
});
