/**
 * API: Delete Chat Message
 * 
 * DELETE /api/fantasy/chat/delete
 * 
 * Soft delete a chat message (mark as deleted).
 * Only the message author can delete their own messages.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/neon/config';
import { markMessageDeletedInFirebase } from '@/lib/fantasy/chat-realtime';

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { message_id, user_id } = body;

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

    // Get the message to verify ownership
    const messageCheck = await sql`
      SELECT 
        message_id,
        league_id,
        team_id,
        user_id,
        is_deleted
      FROM fantasy_chat_messages
      WHERE message_id = ${message_id}
    `;

    if (messageCheck.length === 0) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    const message = messageCheck[0];

    // Check if already deleted
    if (message.is_deleted) {
      return NextResponse.json(
        { error: 'Message already deleted' },
        { status: 400 }
      );
    }

    // Verify user owns this message
    if (message.user_id !== user_id) {
      return NextResponse.json(
        { error: 'Forbidden: You can only delete your own messages' },
        { status: 403 }
      );
    }

    // Soft delete the message (mark as deleted)
    const result = await sql`
      UPDATE fantasy_chat_messages
      SET 
        is_deleted = true,
        updated_at = NOW()
      WHERE message_id = ${message_id}
      RETURNING 
        message_id,
        league_id,
        is_deleted,
        updated_at
    `;

    if (result.length === 0) {
      throw new Error('Failed to delete message');
    }

    const deletedMessage = result[0];

    // Sync deletion to Firebase Realtime Database
    try {
      await markMessageDeletedInFirebase(
        deletedMessage.league_id,
        deletedMessage.message_id
      );
    } catch (firebaseError) {
      // Log but don't fail - PostgreSQL is source of truth
      console.error('[Chat] Firebase deletion sync failed:', firebaseError);
    }

    return NextResponse.json({
      success: true,
      message: 'Message deleted successfully',
      message_id: deletedMessage.message_id,
      deleted_at: deletedMessage.updated_at
    });

  } catch (error) {
    console.error('Chat message deletion error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to delete message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
