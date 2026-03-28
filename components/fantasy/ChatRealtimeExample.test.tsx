/**
 * Tests for ChatRealtimeExample component
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChatRealtimeExample from './ChatRealtimeExample';

// Mock the hook
vi.mock('@/hooks/useFantasyChatRealtime', () => ({
  useFantasyChat: vi.fn()
}));

describe('ChatRealtimeExample', () => {
  const defaultProps = {
    leagueId: 'league_1',
    teamId: 'team_1',
    userId: 'user_1',
    teamName: 'Test Team'
  };

  const mockMessages = [
    {
      message_id: 'msg_1',
      league_id: 'league_1',
      team_id: 'team_1',
      team_name: 'Test Team',
      user_id: 'user_1',
      message_text: 'Hello from my team!',
      reactions: { '👍': ['user_2'] },
      is_deleted: false,
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-01T10:00:00Z'
    },
    {
      message_id: 'msg_2',
      league_id: 'league_1',
      team_id: 'team_2',
      team_name: 'Other Team',
      user_id: 'user_2',
      message_text: 'Hello from other team!',
      reactions: {},
      is_deleted: false,
      created_at: '2024-01-01T10:01:00Z',
      updated_at: '2024-01-01T10:01:00Z'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render chat interface', () => {
    const { useFantasyChat } = require('@/hooks/useFantasyChatRealtime');
    
    useFantasyChat.mockReturnValue({
      messages: [],
      isLoading: false,
      isConnected: true,
      error: null,
      sendMessage: vi.fn(),
      loadMore: vi.fn(),
      hasMore: false,
      refresh: vi.fn()
    });

    render(<ChatRealtimeExample {...defaultProps} />);

    expect(screen.getByText('League Chat')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
    expect(screen.getByText('Send')).toBeInTheDocument();
  });

  it('should show connected status', () => {
    const { useFantasyChat } = require('@/hooks/useFantasyChatRealtime');
    
    useFantasyChat.mockReturnValue({
      messages: [],
      isLoading: false,
      isConnected: true,
      error: null,
      sendMessage: vi.fn(),
      loadMore: vi.fn(),
      hasMore: false,
      refresh: vi.fn()
    });

    render(<ChatRealtimeExample {...defaultProps} />);

    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('should show disconnected status', () => {
    const { useFantasyChat } = require('@/hooks/useFantasyChatRealtime');
    
    useFantasyChat.mockReturnValue({
      messages: [],
      isLoading: false,
      isConnected: false,
      error: null,
      sendMessage: vi.fn(),
      loadMore: vi.fn(),
      hasMore: false,
      refresh: vi.fn()
    });

    render(<ChatRealtimeExample {...defaultProps} />);

    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    const { useFantasyChat } = require('@/hooks/useFantasyChatRealtime');
    
    useFantasyChat.mockReturnValue({
      messages: [],
      isLoading: true,
      isConnected: true,
      error: null,
      sendMessage: vi.fn(),
      loadMore: vi.fn(),
      hasMore: false,
      refresh: vi.fn()
    });

    render(<ChatRealtimeExample {...defaultProps} />);

    expect(screen.getByText('Loading messages...')).toBeInTheDocument();
  });

  it('should show error state', () => {
    const { useFantasyChat } = require('@/hooks/useFantasyChatRealtime');
    
    useFantasyChat.mockReturnValue({
      messages: [],
      isLoading: false,
      isConnected: true,
      error: 'Failed to load messages',
      sendMessage: vi.fn(),
      loadMore: vi.fn(),
      hasMore: false,
      refresh: vi.fn()
    });

    render(<ChatRealtimeExample {...defaultProps} />);

    expect(screen.getByText(/Error: Failed to load messages/)).toBeInTheDocument();
  });

  it('should show empty state', () => {
    const { useFantasyChat } = require('@/hooks/useFantasyChatRealtime');
    
    useFantasyChat.mockReturnValue({
      messages: [],
      isLoading: false,
      isConnected: true,
      error: null,
      sendMessage: vi.fn(),
      loadMore: vi.fn(),
      hasMore: false,
      refresh: vi.fn()
    });

    render(<ChatRealtimeExample {...defaultProps} />);

    expect(screen.getByText('No messages yet. Start the conversation!')).toBeInTheDocument();
  });

  it('should display messages', () => {
    const { useFantasyChat } = require('@/hooks/useFantasyChatRealtime');
    
    useFantasyChat.mockReturnValue({
      messages: mockMessages,
      isLoading: false,
      isConnected: true,
      error: null,
      sendMessage: vi.fn(),
      loadMore: vi.fn(),
      hasMore: false,
      refresh: vi.fn()
    });

    render(<ChatRealtimeExample {...defaultProps} />);

    expect(screen.getByText('Hello from my team!')).toBeInTheDocument();
    expect(screen.getByText('Hello from other team!')).toBeInTheDocument();
  });

  it('should show team name for other teams messages', () => {
    const { useFantasyChat } = require('@/hooks/useFantasyChatRealtime');
    
    useFantasyChat.mockReturnValue({
      messages: mockMessages,
      isLoading: false,
      isConnected: true,
      error: null,
      sendMessage: vi.fn(),
      loadMore: vi.fn(),
      hasMore: false,
      refresh: vi.fn()
    });

    render(<ChatRealtimeExample {...defaultProps} />);

    expect(screen.getByText('Other Team')).toBeInTheDocument();
  });

  it('should display reactions', () => {
    const { useFantasyChat } = require('@/hooks/useFantasyChatRealtime');
    
    useFantasyChat.mockReturnValue({
      messages: mockMessages,
      isLoading: false,
      isConnected: true,
      error: null,
      sendMessage: vi.fn(),
      loadMore: vi.fn(),
      hasMore: false,
      refresh: vi.fn()
    });

    render(<ChatRealtimeExample {...defaultProps} />);

    expect(screen.getByText(/👍 1/)).toBeInTheDocument();
  });

  it('should show load more button when hasMore is true', () => {
    const { useFantasyChat } = require('@/hooks/useFantasyChatRealtime');
    
    useFantasyChat.mockReturnValue({
      messages: mockMessages,
      isLoading: false,
      isConnected: true,
      error: null,
      sendMessage: vi.fn(),
      loadMore: vi.fn(),
      hasMore: true,
      refresh: vi.fn()
    });

    render(<ChatRealtimeExample {...defaultProps} />);

    expect(screen.getByText('Load older messages')).toBeInTheDocument();
  });

  it('should call loadMore when button clicked', async () => {
    const { useFantasyChat } = require('@/hooks/useFantasyChatRealtime');
    const loadMore = vi.fn();
    
    useFantasyChat.mockReturnValue({
      messages: mockMessages,
      isLoading: false,
      isConnected: true,
      error: null,
      sendMessage: vi.fn(),
      loadMore,
      hasMore: true,
      refresh: vi.fn()
    });

    render(<ChatRealtimeExample {...defaultProps} />);

    const loadMoreButton = screen.getByText('Load older messages');
    fireEvent.click(loadMoreButton);

    expect(loadMore).toHaveBeenCalled();
  });

  it('should call refresh when refresh button clicked', () => {
    const { useFantasyChat } = require('@/hooks/useFantasyChatRealtime');
    const refresh = vi.fn();
    
    useFantasyChat.mockReturnValue({
      messages: [],
      isLoading: false,
      isConnected: true,
      error: null,
      sendMessage: vi.fn(),
      loadMore: vi.fn(),
      hasMore: false,
      refresh
    });

    render(<ChatRealtimeExample {...defaultProps} />);

    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    expect(refresh).toHaveBeenCalled();
  });

  it('should update message input', () => {
    const { useFantasyChat } = require('@/hooks/useFantasyChatRealtime');
    
    useFantasyChat.mockReturnValue({
      messages: [],
      isLoading: false,
      isConnected: true,
      error: null,
      sendMessage: vi.fn(),
      loadMore: vi.fn(),
      hasMore: false,
      refresh: vi.fn()
    });

    render(<ChatRealtimeExample {...defaultProps} />);

    const input = screen.getByPlaceholderText('Type a message...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Test message' } });

    expect(input.value).toBe('Test message');
  });

  it('should send message on form submit', async () => {
    const { useFantasyChat } = require('@/hooks/useFantasyChatRealtime');
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    
    useFantasyChat.mockReturnValue({
      messages: [],
      isLoading: false,
      isConnected: true,
      error: null,
      sendMessage,
      loadMore: vi.fn(),
      hasMore: false,
      refresh: vi.fn()
    });

    render(<ChatRealtimeExample {...defaultProps} />);

    const input = screen.getByPlaceholderText('Type a message...') as HTMLInputElement;
    const sendButton = screen.getByText('Send');

    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('Test message', 'team_1', 'user_1');
    });

    // Input should be cleared after sending
    expect(input.value).toBe('');
  });

  it('should not send empty message', () => {
    const { useFantasyChat } = require('@/hooks/useFantasyChatRealtime');
    const sendMessage = vi.fn();
    
    useFantasyChat.mockReturnValue({
      messages: [],
      isLoading: false,
      isConnected: true,
      error: null,
      sendMessage,
      loadMore: vi.fn(),
      hasMore: false,
      refresh: vi.fn()
    });

    render(<ChatRealtimeExample {...defaultProps} />);

    const sendButton = screen.getByText('Send');
    fireEvent.click(sendButton);

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('should disable send button when disconnected', () => {
    const { useFantasyChat } = require('@/hooks/useFantasyChatRealtime');
    
    useFantasyChat.mockReturnValue({
      messages: [],
      isLoading: false,
      isConnected: false,
      error: null,
      sendMessage: vi.fn(),
      loadMore: vi.fn(),
      hasMore: false,
      refresh: vi.fn()
    });

    render(<ChatRealtimeExample {...defaultProps} />);

    const sendButton = screen.getByText('Send') as HTMLButtonElement;
    expect(sendButton.disabled).toBe(true);
  });

  it('should show character count', () => {
    const { useFantasyChat } = require('@/hooks/useFantasyChatRealtime');
    
    useFantasyChat.mockReturnValue({
      messages: [],
      isLoading: false,
      isConnected: true,
      error: null,
      sendMessage: vi.fn(),
      loadMore: vi.fn(),
      hasMore: false,
      refresh: vi.fn()
    });

    render(<ChatRealtimeExample {...defaultProps} />);

    const input = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(input, { target: { value: 'Hello' } });

    expect(screen.getByText('5/2000 characters')).toBeInTheDocument();
  });

  it('should enforce max length', () => {
    const { useFantasyChat } = require('@/hooks/useFantasyChatRealtime');
    
    useFantasyChat.mockReturnValue({
      messages: [],
      isLoading: false,
      isConnected: true,
      error: null,
      sendMessage: vi.fn(),
      loadMore: vi.fn(),
      hasMore: false,
      refresh: vi.fn()
    });

    render(<ChatRealtimeExample {...defaultProps} />);

    const input = screen.getByPlaceholderText('Type a message...') as HTMLInputElement;
    expect(input.maxLength).toBe(2000);
  });

  it('should apply correct styling for own messages', () => {
    const { useFantasyChat } = require('@/hooks/useFantasyChatRealtime');
    
    useFantasyChat.mockReturnValue({
      messages: mockMessages,
      isLoading: false,
      isConnected: true,
      error: null,
      sendMessage: vi.fn(),
      loadMore: vi.fn(),
      hasMore: false,
      refresh: vi.fn()
    });

    const { container } = render(<ChatRealtimeExample {...defaultProps} />);

    // Own message should have blue background
    const ownMessage = container.querySelector('.bg-blue-600');
    expect(ownMessage).toBeInTheDocument();
    expect(ownMessage?.textContent).toContain('Hello from my team!');
  });

  it('should apply correct styling for other messages', () => {
    const { useFantasyChat } = require('@/hooks/useFantasyChatRealtime');
    
    useFantasyChat.mockReturnValue({
      messages: mockMessages,
      isLoading: false,
      isConnected: true,
      error: null,
      sendMessage: vi.fn(),
      loadMore: vi.fn(),
      hasMore: false,
      refresh: vi.fn()
    });

    const { container } = render(<ChatRealtimeExample {...defaultProps} />);

    // Other message should have gray background
    const otherMessage = container.querySelector('.bg-gray-100');
    expect(otherMessage).toBeInTheDocument();
    expect(otherMessage?.textContent).toContain('Hello from other team!');
  });
});
