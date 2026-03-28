/**
 * React Hook: useFantasyChatRealtime
 * 
 * Provides real-time chat functionality using Firebase Realtime Database
 * 
 * Features:
 * - Subscribe to new messages in real-time
 * - Automatic message updates
 * - Optimistic UI updates
 * - Automatic cleanup on unmount
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { subscribeToNewMessages, ChatMessage } from '@/lib/fantasy/chat-realtime';

interface UseFantasyChatRealtimeOptions {
  leagueId: string;
  enabled?: boolean;
  onNewMessage?: (message: ChatMessage) => void;
}

interface UseFantasyChatRealtimeReturn {
  isConnected: boolean;
  lastMessage: ChatMessage | null;
  error: string | null;
}

/**
 * Hook for real-time chat updates
 * 
 * @example
 * ```tsx
 * const { isConnected, lastMessage } = useFantasyChatRealtime({
 *   leagueId: 'league_123',
 *   enabled: true,
 *   onNewMessage: (message) => {
 *     console.log('New message:', message);
 *     // Add to messages list, show notification, etc.
 *   }
 * });
 * ```
 */
export function useFantasyChatRealtime({
  leagueId,
  enabled = true,
  onNewMessage
}: UseFantasyChatRealtimeOptions): UseFantasyChatRealtimeReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<ChatMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled || !leagueId) {
      return;
    }

    try {
      setIsConnected(true);
      setError(null);

      // Subscribe to new messages
      const unsubscribe = subscribeToNewMessages(leagueId, (message) => {
        setLastMessage(message);
        
        // Call callback if provided
        if (onNewMessage) {
          onNewMessage(message);
        }
      });

      unsubscribeRef.current = unsubscribe;

      // Cleanup on unmount
      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
        setIsConnected(false);
      };
    } catch (err) {
      console.error('[useFantasyChatRealtime] Subscription error:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setIsConnected(false);
    }
  }, [leagueId, enabled, onNewMessage]);

  return {
    isConnected,
    lastMessage,
    error
  };
}

/**
 * Hook for managing chat messages with real-time updates
 * 
 * Combines initial message loading with real-time updates
 */
interface UseFantasyChatOptions {
  leagueId: string;
  initialLimit?: number;
  enabled?: boolean;
}

interface UseFantasyChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  sendMessage: (text: string, teamId: string, userId: string) => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  refresh: () => Promise<void>;
}

export function useFantasyChat({
  leagueId,
  initialLimit = 50,
  enabled = true
}: UseFantasyChatOptions): UseFantasyChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  // Load initial messages from PostgreSQL
  const loadMessages = useCallback(async (reset = false) => {
    if (!leagueId) return;

    try {
      setIsLoading(true);
      setError(null);

      const currentOffset = reset ? 0 : offset;
      const response = await fetch(
        `/api/fantasy/chat/messages?league_id=${leagueId}&limit=${initialLimit}&offset=${currentOffset}`
      );

      if (!response.ok) {
        throw new Error('Failed to load messages');
      }

      const data = await response.json();

      if (reset) {
        setMessages(data.messages);
        setOffset(0);
      } else {
        setMessages(prev => [...prev, ...data.messages]);
      }

      setHasMore(data.pagination.has_more);
      setOffset(currentOffset + data.messages.length);
    } catch (err) {
      console.error('[useFantasyChat] Load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  }, [leagueId, initialLimit, offset]);

  // Load initial messages
  useEffect(() => {
    if (enabled) {
      loadMessages(true);
    }
  }, [leagueId, enabled]);

  // Subscribe to real-time updates
  const { isConnected } = useFantasyChatRealtime({
    leagueId,
    enabled,
    onNewMessage: useCallback((message: ChatMessage) => {
      // Add new message to the list if not already present
      setMessages(prev => {
        const exists = prev.some(m => m.message_id === message.message_id);
        if (exists) return prev;
        return [...prev, message];
      });
    }, [])
  });

  // Send message
  const sendMessage = useCallback(async (text: string, teamId: string, userId: string) => {
    try {
      const response = await fetch('/api/fantasy/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          league_id: leagueId,
          team_id: teamId,
          user_id: userId,
          message_text: text
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();

      // Optimistically add message to list
      // Real-time update will handle duplicates
      setMessages(prev => [...prev, data.message]);
    } catch (err) {
      console.error('[useFantasyChat] Send error:', err);
      throw err;
    }
  }, [leagueId]);

  // Load more messages
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;
    await loadMessages(false);
  }, [hasMore, isLoading, loadMessages]);

  // Refresh messages
  const refresh = useCallback(async () => {
    await loadMessages(true);
  }, [loadMessages]);

  return {
    messages,
    isLoading,
    isConnected,
    error,
    sendMessage,
    loadMore,
    hasMore,
    refresh
  };
}
