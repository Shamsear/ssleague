/**
 * API: Send Chat Message
 * 
 * POST /api/fantasy/chat/send
 * 
 * Send a message to the league chat.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/neon/config';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { league_id, team_id, user_id, message_text } = body;

    // Validate required fields
    if (!league_id) {
      return NextResponse.json(
        { error: 'league_id is required' },
        { status: 400 }
      );
    }

    if (!team_id) {
      return NextResponse.json(
        { error: 'team_id is required' },
        { status: 400 }
      );
    }

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id is required' },
        { status: 400 }
      );
    }

    if (!message_text || typeof message_text !== 'string') {
      return NextResponse.json(
        { error: 'message_text is required and must be a string' },
        { status: 400 }
      );
    }

    // Validate message length
    if (message_text.trim().length === 0) {
      return NextResponse.json(
        { error: 'message_text cannot be empty' },
        { status: 400 }
      );
    }

    if (message_text.length > 2000) {
      return NextResponse.json(
        { error: 'message_text cannot exceed 2000 characters' },
        { status: 400 }
      );
    }

    // Verify team exists and belongs to league
    const teamCheck = await sql`
      SELECT team_id, league_id, team_name
      FROM fantasy_teams
      WHERE team_id = ${team_id}
      AND league_id = ${league_id}
    `;

    if (teamCheck.length === 0) {
      return NextResponse.json(
        { error: 'Team not found in this league' },
        { status: 404 }
      );
    }

    // Generate message ID
    const messageId = `msg_${uuidv4()}`;

    // Insert message into database
    const result = await sql`
      INSERT INTO fantasy_chat_messages (
        message_id,
        league_id,
        team_id,
        user_id,
        message_text,
        reactions,
        is_deleted,
        created_at,
        updated_at
      ) VALUES (
        ${messageId},
        ${league_id},
        ${team_id},
        ${user_id},
        ${message_text},
        '{}'::jsonb,
        false,
        NOW(),
        NOW()
      )
      RETURNING 
        message_id,
        league_id,
        team_id,
        user_id,
        message_text,
        reactions,
        is_deleted,
        created_at,
        updated_at
    `;

    if (result.length === 0) {
      throw new Error('Failed to insert message');
    }

    const message = result[0];

    // Get team name for Firebase sync
    const teamName = teamCheck[0].team_name || 'Unknown Team';

    // Sync to Firebase Realtime Database for real-time updates
    try {
      const { syncMessageToFirebase } = await import('@/lib/fantasy/chat-realtime');
      await syncMessageToFirebase({
        message_id: message.message_id,
        league_id: message.league_id,
        team_id: message.team_id,
        team_name: teamName,
        user_id: message.user_id,
        message_text: message.message_text,
        reactions: message.reactions,
        is_deleted: message.is_deleted,
        created_at: message.created_at.toISOString(),
        updated_at: message.updated_at.toISOString()
      });
    } catch (firebaseError) {
      // Log but don't fail - PostgreSQL is source of truth
      console.error('[Chat] Firebase sync failed:', firebaseError);
    }

    return NextResponse.json({
      success: true,
      message: {
        message_id: message.message_id,
        league_id: message.league_id,
        team_id: message.team_id,
        user_id: message.user_id,
        message_text: message.message_text,
        reactions: message.reactions,
        is_deleted: message.is_deleted,
        created_at: message.created_at,
        updated_at: message.updated_at
      }
    });

  } catch (error) {
    console.error('Chat message send error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to send message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
