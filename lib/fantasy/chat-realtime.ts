/**
 * Fantasy Chat Real-time Updates (Firebase Realtime Database)
 * 
 * This module handles real-time synchronization of chat messages
 * between PostgreSQL (source of truth) and Firebase Realtime Database
 * (real-time updates for clients).
 * 
 * Architecture:
 * - PostgreSQL: Persistent storage, source of truth
 * - Firebase RT DB: Real-time sync layer for active chats
 * - Messages written to both systems
 * - Clients listen to Firebase for real-time updates
 */

import { realtimeDb } from '@/lib/firebase/config';
import { ref, set, push, onValue, off, query, orderByChild, limitToLast, get } from 'firebase/database';

export interface ChatMessage {
  message_id: string;
  league_id: string;
  team_id: string;
  team_name?: string;
  user_id: string;
  message_text: string;
  reactions?: Record<string, string[]>; // emoji -> array of user_ids
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Sync a message to Firebase Realtime Database
 * Called after successfully storing in PostgreSQL
 */
export async function syncMessageToFirebase(message: ChatMessage): Promise<void> {
  if (!realtimeDb) {
    console.warn('[Chat RT] Firebase Realtime DB not initialized');
    return;
  }

  try {
    const messageRef = ref(realtimeDb, `fantasy_chat/${message.league_id}/messages/${message.message_id}`);
    
    await set(messageRef, {
      message_id: message.message_id,
      league_id: message.league_id,
      team_id: message.team_id,
      team_name: message.team_name || '',
      user_id: message.user_id,
      message_text: message.message_text,
      reactions: message.reactions || {},
      is_deleted: message.is_deleted,
      created_at: message.created_at,
      updated_at: message.updated_at,
      timestamp: Date.now() // For ordering
    });

    console.log(`[Chat RT] Message synced to Firebase: ${message.message_id}`);
  } catch (error) {
    console.error('[Chat RT] Failed to sync message to Firebase:', error);
    // Don't throw - PostgreSQL is source of truth
  }
}

/**
 * Subscribe to new messages in a league
 * Returns unsubscribe function
 */
export function subscribeToMessages(
  leagueId: string,
  onNewMessage: (message: ChatMessage) => void,
  limit: number = 50
): () => void {
  if (!realtimeDb) {
    console.warn('[Chat RT] Firebase Realtime DB not initialized');
    return () => {};
  }

  const messagesRef = ref(realtimeDb, `fantasy_chat/${leagueId}/messages`);
  const messagesQuery = query(messagesRef, orderByChild('timestamp'), limitToLast(limit));

  const unsubscribe = onValue(messagesQuery, (snapshot) => {
    if (snapshot.exists()) {
      const messages = snapshot.val();
      
      // Convert to array and sort by timestamp
      const messageArray = Object.values(messages) as ChatMessage[];
      messageArray.sort((a: any, b: any) => a.timestamp - b.timestamp);
      
      // Call callback for each message
      messageArray.forEach(message => {
        if (!message.is_deleted) {
          onNewMessage(message);
        }
      });
    }
  });

  return () => {
    off(messagesQuery);
  };
}

/**
 * Subscribe to a single new message (for real-time notifications)
 * Only triggers for messages created after subscription
 */
export function subscribeToNewMessages(
  leagueId: string,
  onNewMessage: (message: ChatMessage) => void
): () => void {
  if (!realtimeDb) {
    console.warn('[Chat RT] Firebase Realtime DB not initialized');
    return () => {};
  }

  const messagesRef = ref(realtimeDb, `fantasy_chat/${leagueId}/messages`);
  const messagesQuery = query(messagesRef, orderByChild('timestamp'), limitToLast(1));

  let isFirstLoad = true;

  const unsubscribe = onValue(messagesQuery, (snapshot) => {
    // Skip first load (existing messages)
    if (isFirstLoad) {
      isFirstLoad = false;
      return;
    }

    if (snapshot.exists()) {
      const messages = snapshot.val();
      const messageArray = Object.values(messages) as ChatMessage[];
      
      // Only process the latest message
      if (messageArray.length > 0) {
        const latestMessage = messageArray[messageArray.length - 1];
        if (!latestMessage.is_deleted) {
          onNewMessage(latestMessage);
        }
      }
    }
  });

  return () => {
    off(messagesQuery);
  };
}

/**
 * Update message reactions in Firebase
 */
export async function updateMessageReactions(
  leagueId: string,
  messageId: string,
  reactions: Record<string, string[]>
): Promise<void> {
  if (!realtimeDb) {
    console.warn('[Chat RT] Firebase Realtime DB not initialized');
    return;
  }

  try {
    const reactionsRef = ref(realtimeDb, `fantasy_chat/${leagueId}/messages/${messageId}/reactions`);
    await set(reactionsRef, reactions);
    
    // Update timestamp
    const timestampRef = ref(realtimeDb, `fantasy_chat/${leagueId}/messages/${messageId}/updated_at`);
    await set(timestampRef, new Date().toISOString());

    console.log(`[Chat RT] Reactions updated for message: ${messageId}`);
  } catch (error) {
    console.error('[Chat RT] Failed to update reactions in Firebase:', error);
  }
}

/**
 * Mark message as deleted in Firebase
 */
export async function markMessageDeletedInFirebase(
  leagueId: string,
  messageId: string
): Promise<void> {
  if (!realtimeDb) {
    console.warn('[Chat RT] Firebase Realtime DB not initialized');
    return;
  }

  try {
    const deletedRef = ref(realtimeDb, `fantasy_chat/${leagueId}/messages/${messageId}/is_deleted`);
    await set(deletedRef, true);
    
    // Update timestamp
    const timestampRef = ref(realtimeDb, `fantasy_chat/${leagueId}/messages/${messageId}/updated_at`);
    await set(timestampRef, new Date().toISOString());

    console.log(`[Chat RT] Message marked as deleted: ${messageId}`);
  } catch (error) {
    console.error('[Chat RT] Failed to mark message as deleted in Firebase:', error);
  }
}

/**
 * Get recent messages from Firebase (for quick initial load)
 */
export async function getRecentMessagesFromFirebase(
  leagueId: string,
  limit: number = 50
): Promise<ChatMessage[]> {
  if (!realtimeDb) {
    console.warn('[Chat RT] Firebase Realtime DB not initialized');
    return [];
  }

  try {
    const messagesRef = ref(realtimeDb, `fantasy_chat/${leagueId}/messages`);
    const messagesQuery = query(messagesRef, orderByChild('timestamp'), limitToLast(limit));
    
    const snapshot = await get(messagesQuery);
    
    if (snapshot.exists()) {
      const messages = snapshot.val();
      const messageArray = Object.values(messages) as ChatMessage[];
      
      // Filter out deleted messages and sort
      return messageArray
        .filter(m => !m.is_deleted)
        .sort((a: any, b: any) => a.timestamp - b.timestamp);
    }
    
    return [];
  } catch (error) {
    console.error('[Chat RT] Failed to get messages from Firebase:', error);
    return [];
  }
}

/**
 * Clear old messages from Firebase (cleanup)
 * Keep only last N messages to prevent database bloat
 */
export async function cleanupOldMessages(
  leagueId: string,
  keepLast: number = 100
): Promise<void> {
  if (!realtimeDb) {
    console.warn('[Chat RT] Firebase Realtime DB not initialized');
    return;
  }

  try {
    const messagesRef = ref(realtimeDb, `fantasy_chat/${leagueId}/messages`);
    const snapshot = await get(messagesRef);
    
    if (snapshot.exists()) {
      const messages = snapshot.val();
      const messageArray = Object.entries(messages).map(([id, msg]: [string, any]) => ({
        id,
        timestamp: msg.timestamp
      }));
      
      // Sort by timestamp
      messageArray.sort((a, b) => a.timestamp - b.timestamp);
      
      // Delete old messages
      if (messageArray.length > keepLast) {
        const toDelete = messageArray.slice(0, messageArray.length - keepLast);
        
        for (const msg of toDelete) {
          const msgRef = ref(realtimeDb, `fantasy_chat/${leagueId}/messages/${msg.id}`);
          await set(msgRef, null); // Delete
        }
        
        console.log(`[Chat RT] Cleaned up ${toDelete.length} old messages from Firebase`);
      }
    }
  } catch (error) {
    console.error('[Chat RT] Failed to cleanup old messages:', error);
  }
}
