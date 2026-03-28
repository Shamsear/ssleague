'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
import { subscribeToNewMessages, ChatMessage, updateMessageReactions } from '@/lib/fantasy/chat-realtime';

interface FantasyTeam {
  id: string;
  team_name: string;
  league_id: string;
}

const EMOJI_OPTIONS = ['👍', '❤️', '😂', '🎉', '🔥', '👏', '😮', '😢'];

export default function FantasyChatPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [fantasyTeam, setFantasyTeam] = useState<FantasyTeam | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  // Redirect if not authenticated or not a team
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && user.role !== 'team') {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Load fantasy team and messages
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      try {
        // Get fantasy team
        const teamResponse = await fetchWithTokenRefresh(`/api/fantasy/teams/my-team?user_id=${user.uid}`);
        
        if (!teamResponse.ok) {
          throw new Error('Failed to load fantasy team');
        }

        const teamData = await teamResponse.json();
        setFantasyTeam({
          id: teamData.team.id,
          team_name: teamData.team.team_name,
          league_id: teamData.team.fantasy_league_id
        });

        // Load initial messages
        const messagesResponse = await fetchWithTokenRefresh(
          `/api/fantasy/chat/messages?league_id=${teamData.team.fantasy_league_id}&limit=50`
        );

        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json();
          setMessages(messagesData.messages || []);
        }

      } catch (error) {
        console.error('Error loading chat data:', error);
        setError('Failed to load chat');
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      loadData();
    }
  }, [user]);

  // Subscribe to real-time messages
  useEffect(() => {
    if (!fantasyTeam?.league_id) return;

    const unsubscribe = subscribeToNewMessages(
      fantasyTeam.league_id,
      (newMessage) => {
        setMessages(prev => {
          // Avoid duplicates
          if (prev.some(m => m.message_id === newMessage.message_id)) {
            return prev;
          }
          return [...prev, newMessage];
        });
      }
    );

    return () => {
      unsubscribe();
    };
  }, [fantasyTeam?.league_id]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!messageText.trim() || !fantasyTeam || !user) return;
    
    setIsSending(true);
    setError(null);

    try {
      const response = await fetchWithTokenRefresh('/api/fantasy/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          league_id: fantasyTeam.league_id,
          team_id: fantasyTeam.id,
          user_id: user.uid,
          message_text: messageText.trim()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      // Clear input
      setMessageText('');
      messageInputRef.current?.focus();

    } catch (error) {
      console.error('Error sending message:', error);
      setError(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e as any);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user || !fantasyTeam) return;

    const message = messages.find(m => m.message_id === messageId);
    if (!message) return;

    const reactions = { ...message.reactions } || {};
    const userIds = reactions[emoji] || [];

    // Toggle reaction
    if (userIds.includes(user.uid)) {
      // Remove reaction
      reactions[emoji] = userIds.filter(id => id !== user.uid);
      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
    } else {
      // Add reaction
      reactions[emoji] = [...userIds, user.uid];
    }

    // Update locally first for instant feedback
    setMessages(prev => prev.map(m => 
      m.message_id === messageId ? { ...m, reactions } : m
    ));

    // Update in Firebase
    try {
      await updateMessageReactions(fantasyTeam.league_id, messageId, reactions);
    } catch (error) {
      console.error('Error updating reaction:', error);
      // Revert on error
      setMessages(prev => prev.map(m => 
        m.message_id === messageId ? message : m
      ));
    }

    setShowEmojiPicker(null);
  };

  const getReactionCount = (reactions: Record<string, string[]> | undefined, emoji: string): number => {
    if (!reactions || !reactions[emoji]) return 0;
    return reactions[emoji].length;
  };

  const hasUserReacted = (reactions: Record<string, string[]> | undefined, emoji: string): boolean => {
    if (!reactions || !reactions[emoji] || !user) return false;
    return reactions[emoji].includes(user.uid);
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading chat...</p>
        </div>
      </div>
    );
  }

  if (!fantasyTeam) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">You need to join a fantasy league to access chat.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <h1 className="text-2xl font-bold text-gray-900">League Chat</h1>
          <p className="text-sm text-gray-600 mt-1">
            Chat with other teams in your league
          </p>
        </div>

        {/* Chat Container */}
        <div className="bg-white rounded-lg shadow-sm flex flex-col" style={{ height: 'calc(100vh - 250px)' }}>
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((message) => {
                const isOwnMessage = message.team_id === fantasyTeam.id;
                const reactions = message.reactions || {};
                const hasReactions = Object.keys(reactions).length > 0;
                
                return (
                  <div
                    key={message.message_id}
                    className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[70%] ${isOwnMessage ? 'order-2' : 'order-1'}`}>
                      {/* Team Name */}
                      {!isOwnMessage && (
                        <div className="text-xs font-semibold text-gray-700 mb-1">
                          {message.team_name || 'Unknown Team'}
                        </div>
                      )}
                      
                      {/* Message Bubble */}
                      <div
                        className={`rounded-lg px-4 py-2 ${
                          isOwnMessage
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{message.message_text}</p>
                      </div>
                      
                      {/* Reactions */}
                      {hasReactions && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {Object.entries(reactions).map(([emoji, userIds]) => (
                            <button
                              key={emoji}
                              onClick={() => handleReaction(message.message_id, emoji)}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm transition-colors ${
                                hasUserReacted(reactions, emoji)
                                  ? 'bg-blue-100 border-2 border-blue-500'
                                  : 'bg-gray-100 border-2 border-transparent hover:border-gray-300'
                              }`}
                            >
                              <span>{emoji}</span>
                              <span className="text-xs font-medium text-gray-700">
                                {userIds.length}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Add Reaction Button & Timestamp */}
                      <div className="flex items-center justify-between mt-1">
                        <div className="relative">
                          <button
                            onClick={() => setShowEmojiPicker(
                              showEmojiPicker === message.message_id ? null : message.message_id
                            )}
                            className="text-gray-400 hover:text-gray-600 text-sm"
                            title="Add reaction"
                          >
                            😊+
                          </button>
                          
                          {/* Emoji Picker */}
                          {showEmojiPicker === message.message_id && (
                            <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 flex gap-1 z-10">
                              {EMOJI_OPTIONS.map(emoji => (
                                <button
                                  key={emoji}
                                  onClick={() => handleReaction(message.message_id, emoji)}
                                  className="text-2xl hover:scale-125 transition-transform"
                                  title={`React with ${emoji}`}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        {/* Timestamp */}
                        <div
                          className={`text-xs text-gray-500 ${
                            isOwnMessage ? 'text-right' : 'text-left'
                          }`}
                        >
                          {formatTimestamp(message.created_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-4 py-2 bg-red-50 border-t border-red-200">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Input Area */}
          <form onSubmit={handleSendMessage} className="border-t border-gray-200 p-4">
            <div className="flex gap-2">
              <textarea
                ref={messageInputRef}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message... (Press Enter to send, Shift+Enter for new line)"
                className="flex-1 resize-none rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={2}
                maxLength={2000}
                disabled={isSending}
              />
              <button
                type="submit"
                disabled={!messageText.trim() || isSending}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isSending ? 'Sending...' : 'Send'}
              </button>
            </div>
            <div className="mt-2 text-xs text-gray-500 text-right">
              {messageText.length}/2000 characters
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
