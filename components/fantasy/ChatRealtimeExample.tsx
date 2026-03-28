/**
 * Fantasy Chat Real-time Example Component
 * 
 * Demonstrates how to use the real-time chat functionality
 * This is a reference implementation for the full chat UI
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useFantasyChat } from '@/hooks/useFantasyChatRealtime';

interface ChatRealtimeExampleProps {
  leagueId: string;
  teamId: string;
  userId: string;
  teamName: string;
}

export default function ChatRealtimeExample({
  leagueId,
  teamId,
  userId,
  teamName
}: ChatRealtimeExampleProps) {
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isLoading,
    isConnected,
    error,
    sendMessage,
    loadMore,
    hasMore,
    refresh
  } = useFantasyChat({
    leagueId,
    enabled: true
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!messageText.trim() || isSending) return;

    try {
      setIsSending(true);
      await sendMessage(messageText, teamId, userId);
      setMessageText('');
    } catch (err) {
      console.error('Failed to send message:', err);
      alert('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] border border-gray-300 rounded-lg bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">League Chat</h2>
          <p className="text-sm text-gray-600">
            {isConnected ? (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                Disconnected
              </span>
            )}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400"
        >
          Refresh
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">Loading messages...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-red-500">Error: {error}</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">No messages yet. Start the conversation!</div>
          </div>
        ) : (
          <>
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={isLoading}
                className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400"
              >
                {isLoading ? 'Loading...' : 'Load older messages'}
              </button>
            )}

            {messages.map((message) => {
              const isOwnMessage = message.team_id === teamId;

              return (
                <div
                  key={message.message_id}
                  className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      isOwnMessage
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    {!isOwnMessage && (
                      <div className="text-xs font-semibold mb-1 opacity-75">
                        {message.team_name || 'Unknown Team'}
                      </div>
                    )}
                    <div className="text-sm whitespace-pre-wrap break-words">
                      {message.message_text}
                    </div>
                    <div
                      className={`text-xs mt-1 ${
                        isOwnMessage ? 'text-blue-100' : 'text-gray-500'
                      }`}
                    >
                      {new Date(message.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>

                    {/* Reactions */}
                    {message.reactions && Object.keys(message.reactions).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(message.reactions).map(([emoji, users]) => (
                          <span
                            key={emoji}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                              isOwnMessage
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            {emoji} {(users as string[]).length}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex gap-2">
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Type a message..."
            disabled={isSending || !isConnected}
            maxLength={2000}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
          />
          <button
            type="submit"
            disabled={!messageText.trim() || isSending || !isConnected}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          {messageText.length}/2000 characters
        </div>
      </form>
    </div>
  );
}
