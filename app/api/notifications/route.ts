import { NextRequest, NextResponse } from 'next/server';
import { getUnreadNotifications, markNotificationAsRead } from '@/lib/lineup-notifications';

/**
 * Get unread notifications for a user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'user_id is required' },
        { status: 400 }
      );
    }

    const result = await getUnreadNotifications(userId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

/**
 * Mark notification as read
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { notification_id } = body;

    if (!notification_id) {
      return NextResponse.json(
        { success: false, error: 'notification_id is required' },
        { status: 400 }
      );
    }

    const result = await markNotificationAsRead(notification_id);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error marking notification as read:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to mark notification as read' },
      { status: 500 }
    );
  }
}
