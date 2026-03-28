'use client';

/**
 * League Chat Component
 * 
 * Real-time chat interface for fantasy league members
 */

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface Message {
  message_id: string;
  league_id: string;
  team_id: string;
  team_name: string;
  user_id: string;
  message_text: string;
  reactions: Record<string, string[]>;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

interface ReactionSummary {
  emoji: string;
  count: number;
  users: string[];
}

interface LeagueChatProps {
  leagueId: string;
  teamId: string;
  teamName: string;
}

export default function LeagueChat({ leagueId, teamId, teamName }: LeagueChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch messages
  const fetchMessages = async () => {
    try {
      const response = await fetch(
        `/api/fantasy/chat/messages?league_id=${leagueId}&limit=50`
      );