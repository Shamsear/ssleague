import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';
import { verifyAuth } from '@/lib/auth-helper';

/**
 * GET /api/fantasy/chat/messages
 * Get chat messages for a league
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth([], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('league_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before'); // For pagination

    if (!leagueId) {
      return NextResponse.json(
        { error: 'league_id is required' },
        { status: 400 }
      );
    }

    let messages;
    
    if (before) {
      // Get messages before a specific timestamp (for pagination)
      messages = await fantasySql`
        SELECT 
          m.message_id,
          m.team_id,
          m.message_text,
          m.created_at,
          m.edited_at,
          m.is_deleted,
          t.team_name,
          t.owner_name,
          COALESCE(
            json_agg(
              json_build_object(
                'reaction', r.reaction,
                'team_id', r.team_id,
                'team_name', rt.team_name
              )
            ) FILTER (WHERE r.reaction_id IS NOT NULL),
            '[]'
          ) as reactions
        FROM fantasy_chat_messages m
        JOIN fantasy_teams t ON m.team_id = t.team_id
        LEFT JOIN fantasy_chat_reactions r ON m.message_id = r.message_id
        LEFT JOIN fantasy_teams rt ON r.team_id = rt.team_id
        WHERE m.league_id = ${leagueId}
          AND m.created_at < ${before}
        GROUP BY m.message_id, m.team_id, m.message_text, m.created_at, m.edited_at, m.is_deleted, t.team_name, t.owner_name
        ORDER BY m.created_at DESC
        LIMIT ${limit}
      `;
    } else {
      // Get latest messages
      messages = await fantasySql`
        SELECT 
          m.message_id,
          m.team_id,
          m.message_text,
          m.created_at,
          m.edited_at,
          m.is_deleted,
          t.team_name,
          t.owner_name,
          COALESCE(
            json_agg(
              json_build_object(
                'reaction', r.reaction,
                'team_id', r.team_id,
                'team_name', rt.team_name
              )
            ) FILTER (WHERE r.reaction_id IS NOT NULL),
            '[]'
          ) as reactions
        FROM fantasy_chat_messages m
        JOIN fantasy_teams t ON m.team_id = t.team_id
        LEFT JOIN fantasy_chat_reactions r ON m.message_id = r.message_id
        LEFT JOIN fantasy_teams rt ON r.team_id = rt.team_id
        WHERE m.league_id = ${leagueId}
        GROUP BY m.message_id, m.team_id, m.message_text, m.created_at, m.edited_at, m.is_deleted, t.team_name, t.owner_name
        ORDER BY m.created_at DESC
        LIMIT ${limit}
      `;
    }

    // Reverse to show oldest first
    messages.reverse();

    return NextResponse.json({
      success: true,
      messages
    });

  } catch (error) {
    console.error('Error fetching chat messages:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch chat messages',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fantasy/chat/messages
 * Send a chat message
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth([], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { league_id, team_id, message_text } = body;

    if (!league_id || !team_id || !message_text) {
      return NextResponse.json(
        { error: 'league_id, team_id, and message_text are required' },
        { status: 400 }
      );
    }

    // Validate message length
    if (message_text.length > 1000) {
      return NextResponse.json(
        { error: 'Message too long (max 1000 characters)' },
        { status: 400 }
      );
    }

    // Verify team ownership
    const teams = await fantasySql`
      SELECT team_id, owner_uid
      FROM fantasy_teams
      WHERE team_id = ${team_id} AND league_id = ${league_id}
    `;

    if (teams.length === 0) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    if (teams[0].owner_uid !== auth.userId) {
      return NextResponse.json(
        { error: 'You do not own this team' },
        { status: 403 }
      );
    }

    // Create message
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await fantasySql`
      INSERT INTO fantasy_chat_messages (
        message_id, league_id, team_id, message_text
      ) VALUES (
        ${messageId}, ${league_id}, ${team_id}, ${message_text}
      )
    `;

    // Get the created message with team info
    const [message] = await fantasySql`
      SELECT 
        m.message_id,
        m.team_id,
        m.message_text,
        m.created_at,
        t.team_name,
        t.owner_name
      FROM fantasy_chat_messages m
      JOIN fantasy_teams t ON m.team_id = t.team_id
      WHERE m.message_id = ${messageId}
    `;

    return NextResponse.json({
      success: true,
      message
    });

  } catch (error) {
    console.error('Error sending chat message:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send chat message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/fantasy/chat/messages
 * Delete a chat message (soft delete)
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAuth([], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('message_id');

    if (!messageId) {
      return NextResponse.json(
        { error: 'message_id is required' },
        { status: 400 }
      );
    }

    // Get message and verify ownership
    const messages = await fantasySql`
      SELECT m.message_id, m.team_id, t.owner_uid
      FROM fantasy_chat_messages m
      JOIN fantasy_teams t ON m.team_id = t.team_id
      WHERE m.message_id = ${messageId}
    `;

    if (messages.length === 0) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    if (messages[0].owner_uid !== auth.userId) {
      return NextResponse.json(
        { error: 'You can only delete your own messages' },
        { status: 403 }
      );
    }

    // Soft delete
    await fantasySql`
      UPDATE fantasy_chat_messages
      SET is_deleted = true, message_text = '[deleted]'
      WHERE message_id = ${messageId}
    `;

    return NextResponse.json({
      success: true,
      message: 'Message deleted'
    });

  } catch (error) {
    console.error('Error deleting chat message:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete chat message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
