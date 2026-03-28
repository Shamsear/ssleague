/**
 * Tests for useFantasyChatRealtime hooks
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useFantasyChatRealtime, useFantasyChat } from './useFantasyChatRealtime';

// Mock Firebase real-time module
vi.mock('@/lib/fantasy/chat-realtime', () => ({
  subscribeToNewMessages: vi.fn((leagueId, callback) => {
    // Return unsubscribe function
    return () => {};
  }),
  ChatMessage: {}
}));

// Mock fetch
global.fetch = vi.fn();

describe('useFantasyChatRealtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useFantasyChatRealtime hook', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() =>
        useFantasyChatRealtime({
          leagueId: 'league_1',
          enabled: true
        })
      );

      expect(result.current.isConnected).toBe(true);
      expect(result.current.lastMessage).toBe(null);
      expect(result.current.error).toBe(null);
    });

    it('should not connect when disabled', () => {
      const { result } = renderHook(() =>
        useFantasyChatRealtime({
          leagueId: 'league_1',
          enabled: false
        })
      );

      expect(result.current.isConnected).toBe(false);
    });

    it('should call onNewMessage callback when message received', async () => {
      const { subscribeToNewMessages } = await import('@/lib/fantasy/chat-realtime');
      const onNewMessage = vi.fn();

      const mockMessage = {
        message_id: 'msg_123',
        league_id: 'league_1',
        team_id: 'team_1',
        user_id: 'user_1',
        message_text: 'Hello!',
        reactions: {},
        is_deleted: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      // Mock subscribeToNewMessages to call callback immediately
      (subscribeToNewMessages as any).mockImplementation((leagueId: string, callback: any) => {
        callback(mockMessage);
        return () => {};
      });

      const { result } = renderHook(() =>
        useFantasyChatRealtime({
          leagueId: 'league_1',
          enabled: true,
          onNewMessage
        })
      );

      await waitFor(() => {
        expect(onNewMessage).toHaveBeenCalledWith(mockMessage);
      });
    });

    it('should update lastMessage when new message received', async () => {
      const { subscribeToNewMessages } = await import('@/lib/fantasy/chat-realtime');

      const mockMessage = {
        message_id: 'msg_123',
        league_id: 'league_1',
        team_id: 'team_1',
        user_id: 'user_1',
        message_text: 'Hello!',
        reactions: {},
        is_deleted: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      (subscribeToNewMessages as any).mockImplementation((leagueId: string, callback: any) => {
        callback(mockMessage);
        return () => {};
      });

      const { result } = renderHook(() =>
        useFantasyChatRealtime({
          leagueId: 'league_1',
          enabled: true
        })
      );

      await waitFor(() => {
        expect(result.current.lastMessage).toEqual(mockMessage);
      });
    });

    it('should cleanup subscription on unmount', () => {
      const { subscribeToNewMessages } = require('@/lib/fantasy/chat-realtime');
      const unsubscribe = vi.fn();

      (subscribeToNewMessages as any).mockReturnValue(unsubscribe);

      const { unmount } = renderHook(() =>
        useFantasyChatRealtime({
          leagueId: 'league_1',
          enabled: true
        })
      );

      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe('useFantasyChat hook', () => {
    beforeEach(() => {
      (global.fetch as any).mockClear();
    });

    it('should initialize with default state', () => {
      const { result } = renderHook(() =>
        useFantasyChat({
          leagueId: 'league_1',
          enabled: true
        })
      );

      expect(result.current.messages).toEqual([]);
      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBe(null);
      expect(result.current.hasMore).toBe(false);
    });

    it('should load initial messages on mount', async () => {
      const mockMessages = [
        {
          message_id: 'msg_1',
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          message_text: 'Hello!',
          reactions: {},
          is_deleted: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: mockMessages,
          pagination: {
            limit: 50,
            offset: 0,
            total: 1,
            has_more: false
          }
        })
      });

      const { result } = renderHook(() =>
        useFantasyChat({
          leagueId: 'league_1',
          enabled: true
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.messages).toEqual(mockMessages);
      expect(result.current.hasMore).toBe(false);
    });

    it('should handle load error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const { result } = renderHook(() =>
        useFantasyChat({
          leagueId: 'league_1',
          enabled: true
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.messages).toEqual([]);
    });

    it('should send message successfully', async () => {
      // Mock initial load
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: [],
          pagination: { limit: 50, offset: 0, total: 0, has_more: false }
        })
      });

      const { result } = renderHook(() =>
        useFantasyChat({
          leagueId: 'league_1',
          enabled: true
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Mock send message
      const newMessage = {
        message_id: 'msg_new',
        league_id: 'league_1',
        team_id: 'team_1',
        user_id: 'user_1',
        message_text: 'New message!',
        reactions: {},
        is_deleted: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: newMessage
        })
      });

      await act(async () => {
        await result.current.sendMessage('New message!', 'team_1', 'user_1');
      });

      expect(result.current.messages).toContainEqual(newMessage);
    });

    it('should handle send message error', async () => {
      // Mock initial load
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: [],
          pagination: { limit: 50, offset: 0, total: 0, has_more: false }
        })
      });

      const { result } = renderHook(() =>
        useFantasyChat({
          leagueId: 'league_1',
          enabled: true
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Mock send message failure
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      await expect(
        result.current.sendMessage('New message!', 'team_1', 'user_1')
      ).rejects.toThrow();
    });

    it('should load more messages', async () => {
      const initialMessages = [
        {
          message_id: 'msg_1',
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          message_text: 'Message 1',
          reactions: {},
          is_deleted: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];

      const moreMessages = [
        {
          message_id: 'msg_2',
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          message_text: 'Message 2',
          reactions: {},
          is_deleted: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];

      // Mock initial load
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: initialMessages,
          pagination: { limit: 50, offset: 0, total: 2, has_more: true }
        })
      });

      const { result } = renderHook(() =>
        useFantasyChat({
          leagueId: 'league_1',
          enabled: true
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasMore).toBe(true);

      // Mock load more
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: moreMessages,
          pagination: { limit: 50, offset: 1, total: 2, has_more: false }
        })
      });

      await act(async () => {
        await result.current.loadMore();
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.hasMore).toBe(false);
    });

    it('should refresh messages', async () => {
      const initialMessages = [
        {
          message_id: 'msg_1',
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          message_text: 'Message 1',
          reactions: {},
          is_deleted: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];

      const refreshedMessages = [
        {
          message_id: 'msg_2',
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          message_text: 'Message 2',
          reactions: {},
          is_deleted: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];

      // Mock initial load
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: initialMessages,
          pagination: { limit: 50, offset: 0, total: 1, has_more: false }
        })
      });

      const { result } = renderHook(() =>
        useFantasyChat({
          leagueId: 'league_1',
          enabled: true
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Mock refresh
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: refreshedMessages,
          pagination: { limit: 50, offset: 0, total: 1, has_more: false }
        })
      });

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.messages).toEqual(refreshedMessages);
    });

    it('should add new messages from real-time updates', async () => {
      const { subscribeToNewMessages } = await import('@/lib/fantasy/chat-realtime');

      const initialMessages = [
        {
          message_id: 'msg_1',
          league_id: 'league_1',
          team_id: 'team_1',
          user_id: 'user_1',
          message_text: 'Message 1',
          reactions: {},
          is_deleted: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];

      // Mock initial load
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: initialMessages,
          pagination: { limit: 50, offset: 0, total: 1, has_more: false }
        })
      });

      const { result } = renderHook(() =>
        useFantasyChat({
          leagueId: 'league_1',
          enabled: true
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Simulate real-time message
      const newMessage = {
        message_id: 'msg_2',
        league_id: 'league_1',
        team_id: 'team_1',
        user_id: 'user_1',
        message_text: 'Real-time message!',
        reactions: {},
        is_deleted: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      // Get the callback passed to subscribeToNewMessages
      const subscribeCall = (subscribeToNewMessages as any).mock.calls[0];
      const callback = subscribeCall[1];

      act(() => {
        callback(newMessage);
      });

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2);
      });

      expect(result.current.messages).toContainEqual(newMessage);
    });

    it('should not add duplicate messages from real-time updates', async () => {
      const { subscribeToNewMessages } = await import('@/lib/fantasy/chat-realtime');

      const message = {
        message_id: 'msg_1',
        league_id: 'league_1',
        team_id: 'team_1',
        user_id: 'user_1',
        message_text: 'Message 1',
        reactions: {},
        is_deleted: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      // Mock initial load
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          messages: [message],
          pagination: { limit: 50, offset: 0, total: 1, has_more: false }
        })
      });

      const { result } = renderHook(() =>
        useFantasyChat({
          leagueId: 'league_1',
          enabled: true
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Try to add same message via real-time
      const subscribeCall = (subscribeToNewMessages as any).mock.calls[0];
      const callback = subscribeCall[1];

      act(() => {
        callback(message);
      });

      // Should still have only 1 message
      expect(result.current.messages).toHaveLength(1);
    });
  });
});
