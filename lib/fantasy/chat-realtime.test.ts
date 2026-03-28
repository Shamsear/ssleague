/**
 * Unit Tests: Chat Real-time Library
 * 
 * Tests the Firebase Realtime Database integration functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  syncMessageToFirebase,
  updateMessageReactions,
  markMessageDeletedInFirebase,
  ChatMessage
} from './chat-realtime';

// Mock Firebase
vi.mock('@/lib/firebase/config', () => ({
  realtimeDb: {
    ref: vi.fn()
  }
}));

vi.mock('firebase/database', () => ({
  ref: vi.fn(),
  set: vi.fn(),
  push: vi.fn(),
  onValue: vi.fn(),
  off: vi.fn(),
  query: vi.fn(),
  orderByChild: vi.fn(),
  limitToLast: vi.fn(),
  get: vi.fn()
}));

describe('Chat Real-time Library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('syncMessageToFirebase', () => {
    it('should sync message to Firebase', async () => {
      const { set } = await import('firebase/database');

      const message: ChatMessage = {
        message_id: 'msg_1',
        league_id: 'league_1',
        team_id: 'team_1',
        team_name: 'Test Team',
        user_id: 'user_1',
        message_text: 'Hello!',
        reactions: {},
        is_deleted: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      await syncMessageToFirebase(message);

      expect(set).toHaveBeenCalled();
    });

    it('should handle Firebase errors gracefully', async () => {
      const { set } = await import('firebase/database');
      (set as any).mockRejectedValueOnce(new Error('Firebase error'));

      const message: ChatMessage = {
        message_id: 'msg_1',
        league_id: 'league_1',
        team_id: 'team_1',
        user_id: 'user_1',
        message_text: 'Hello!',
        reactions: {},
        is_deleted: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      // Should not throw
      await expect(syncMessageToFirebase(message)).resolves.not.toThrow();
    });

    it('should include timestamp for ordering', async () => {
      const { set } = await import('firebase/database');
      let capturedData: any;
      (set as any).mockImplementation((_ref: any, data: any) => {
        capturedData = data;
        return Promise.resolve();
      });

      const message: ChatMessage = {
        message_id: 'msg_1',
        league_id: 'league_1',
        team_id: 'team_1',
        user_id: 'user_1',
        message_text: 'Hello!',
        reactions: {},
        is_deleted: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      await syncMessageToFirebase(message);

      expect(capturedData).toHaveProperty('timestamp');
      expect(typeof capturedData.timestamp).toBe('number');
    });
  });

  describe('updateMessageReactions', () => {
    it('should update reactions in Firebase', async () => {
      const { set } = await import('firebase/database');

      const reactions = { '👍': ['user_1', 'user_2'] };

      await updateMessageReactions('league_1', 'msg_1', reactions);

      // Should be called twice (reactions + updated_at)
      expect(set).toHaveBeenCalledTimes(2);
    });

    it('should handle Firebase errors gracefully', async () => {
      const { set } = await import('firebase/database');
      (set as any).mockRejectedValueOnce(new Error('Firebase error'));

      const reactions = { '👍': ['user_1'] };

      // Should not throw
      await expect(updateMessageReactions('league_1', 'msg_1', reactions)).resolves.not.toThrow();
    });

    it('should update timestamp when updating reactions', async () => {
      const { set } = await import('firebase/database');
      const calls: any[] = [];
      (set as any).mockImplementation((_ref: any, data: any) => {
        calls.push(data);
        return Promise.resolve();
      });

      const reactions = { '👍': ['user_1'] };

      await updateMessageReactions('league_1', 'msg_1', reactions);

      // Second call should be timestamp update
      expect(calls[1]).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO date format
    });
  });

  describe('markMessageDeletedInFirebase', () => {
    it('should mark message as deleted in Firebase', async () => {
      const { set } = await import('firebase/database');

      await markMessageDeletedInFirebase('league_1', 'msg_1');

      // Should be called twice (is_deleted + updated_at)
      expect(set).toHaveBeenCalledTimes(2);
    });

    it('should handle Firebase errors gracefully', async () => {
      const { set } = await import('firebase/database');
      (set as any).mockRejectedValueOnce(new Error('Firebase error'));

      // Should not throw
      await expect(markMessageDeletedInFirebase('league_1', 'msg_1')).resolves.not.toThrow();
    });

    it('should set is_deleted to true', async () => {
      const { set } = await import('firebase/database');
      const calls: any[] = [];
      (set as any).mockImplementation((_ref: any, data: any) => {
        calls.push(data);
        return Promise.resolve();
      });

      await markMessageDeletedInFirebase('league_1', 'msg_1');

      // First call should set is_deleted to true
      expect(calls[0]).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle null realtimeDb gracefully', async () => {
      // Mock null realtimeDb
      vi.doMock('@/lib/firebase/config', () => ({
        realtimeDb: null
      }));

      const message: ChatMessage = {
        message_id: 'msg_1',
        league_id: 'league_1',
        team_id: 'team_1',
        user_id: 'user_1',
        message_text: 'Hello!',
        reactions: {},
        is_deleted: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      // Should not throw
      await expect(syncMessageToFirebase(message)).resolves.not.toThrow();
      await expect(updateMessageReactions('league_1', 'msg_1', {})).resolves.not.toThrow();
      await expect(markMessageDeletedInFirebase('league_1', 'msg_1')).resolves.not.toThrow();
    });
  });

  describe('Data Structure', () => {
    it('should store messages with correct structure', async () => {
      const { set } = await import('firebase/database');
      let capturedData: any;
      (set as any).mockImplementation((_ref: any, data: any) => {
        capturedData = data;
        return Promise.resolve();
      });

      const message: ChatMessage = {
        message_id: 'msg_1',
        league_id: 'league_1',
        team_id: 'team_1',
        team_name: 'Test Team',
        user_id: 'user_1',
        message_text: 'Hello!',
        reactions: { '👍': ['user_1'] },
        is_deleted: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      await syncMessageToFirebase(message);

      expect(capturedData).toMatchObject({
        message_id: 'msg_1',
        league_id: 'league_1',
        team_id: 'team_1',
        team_name: 'Test Team',
        user_id: 'user_1',
        message_text: 'Hello!',
        reactions: { '👍': ['user_1'] },
        is_deleted: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      });
      expect(capturedData).toHaveProperty('timestamp');
    });

    it('should handle missing team_name', async () => {
      const { set } = await import('firebase/database');
      let capturedData: any;
      (set as any).mockImplementation((_ref: any, data: any) => {
        capturedData = data;
        return Promise.resolve();
      });

      const message: ChatMessage = {
        message_id: 'msg_1',
        league_id: 'league_1',
        team_id: 'team_1',
        user_id: 'user_1',
        message_text: 'Hello!',
        reactions: {},
        is_deleted: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      await syncMessageToFirebase(message);

      expect(capturedData.team_name).toBe('');
    });

    it('should handle missing reactions', async () => {
      const { set } = await import('firebase/database');
      let capturedData: any;
      (set as any).mockImplementation((_ref: any, data: any) => {
        capturedData = data;
        return Promise.resolve();
      });

      const message: ChatMessage = {
        message_id: 'msg_1',
        league_id: 'league_1',
        team_id: 'team_1',
        user_id: 'user_1',
        message_text: 'Hello!',
        is_deleted: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      await syncMessageToFirebase(message);

      expect(capturedData.reactions).toEqual({});
    });
  });
});
