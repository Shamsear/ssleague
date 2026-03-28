/**
 * API: Add/Remove Emoji Reactions to Chat Messages
 * 
 * POST /api/fantasy/chat/reactions
 * 
 * Add or remove emoji reactions to chat messages.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/neon/config';
import { updateMessageReactions } from '@/lib/fantasy/chat-realtime';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message_id, user_id, emoji, action } = body;

    // Validate required fields
    if (!message_id) {
      return NextResponse.json(
        { error: 'message_id is required' },
        { status: 400 }
      );
    }

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id is required' },
        { status: 400 }
      );
    }

    if (!emoji || typeof emoji !== 'string') {
      return NextResponse.json(
        { error: 'emoji is required and must be a string' },
        { status: 400 }
      );
    }

    if (!action || !['add', 'remove'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be either "add" or "remove"' },
        { status: 400 }
      );
    }

    // Validate emoji (basic check - should be 1-4 characters)
    if (emoji.length > 10) {
      return NextResponse.json(
        { error: 'emoji is too long' },
        { status: 400 }
      );
    }

    // Get the message
    const messageResult = await sql`
      SELECT 
        message_id,
        league_id,
        team_id,
        user_id as message_user_id,
        reactions,
        is_deleted
      FROM fantasy_chat_messages
      WHERE message_id = ${message_id}
    `;

    if (messageResult.length === 0) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    const message = messageResult[0];

    // Cannot react to deleted messages
    if (message.is_deleted) {
      return NextResponse.json(
        { error: 'Cannot react to deleted messages' },
        { status: 400 }
      );
    }

    // Get current reactions
    let reactions: Record<string, string[]> = message.reactions || {};

    // Add or remove reaction
    if (action === 'add') {
      // Initialize emoji array if it doesn't exist
      if (!reactions[emoji]) {
        reactions[emoji] = [];
      }

      // Add user_id if not already present
      if (!reactions[emoji].includes(user_id)) {
        reactions[emoji].push(user_id);
      }
    } else if (action === 'remove') {
      // Remove user_id from emoji array
      if (reactions[emoji]) {
        reactions[emoji] = reactions[emoji].filter(id => id !== user_id);

        // Remove emoji key if no users left
        if (reactions[emoji].length === 0) {
          delete reactions[emoji];
        }
      }
    }

    // Update reactions in database
    const updateResult = await sql`
      UPDATE fantasy_chat_messages
      SET 
        reactions = ${JSON.stringify(reactions)}::jsonb,
        updated_at = NOW()
      WHERE message_id = ${message_id}
      RETURNING 
        message_id,
        league_id,
        reactions,
        updated_at
    `;

    if (updateResult.length === 0) {
      throw new Error('Failed to update reactions');
    }

    const updatedMessage = updateResult[0];

    // Sync to Firebase for real-time updates
    try {
      await updateMessageReactions(
        updatedMessage.league_id,
        updatedMessage.message_id,
        updatedMessage.reactions
      );
    } catch (firebaseError) {
      // Log but don't fail - PostgreSQL is source of truth
      console.error('[Chat Reactions] Firebase sync failed:', firebaseError);
    }

    return NextResponse.json({
      success: true,
      message_id: updatedMessage.message_id,
      reactions: updatedMessage.reactions,
      action,
      emoji,
      user_id
    });

  } catch (error) {
    console.error('Chat reaction error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to update reaction',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
