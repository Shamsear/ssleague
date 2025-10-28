import { adminDb as db } from '@/lib/firebase/admin';

interface LineupNotification {
  id: string;
  user_id: string;
  team_id: string;
  team_name: string;
  fixture_id: string;
  round_number: number;
  match_number: number;
  type: 'warning' | 'opponent_can_select' | 'deadline_reminder';
  message: string;
  read: boolean;
  created_at: string;
}

/**
 * Create notification for missing lineup warning
 */
export async function sendLineupWarning(
  teamId: string,
  teamName: string,
  fixtureId: string,
  roundNumber: number,
  matchNumber: number,
  userId: string
) {
  try {
    const notificationRef = db.collection('notifications').doc();
    
    await notificationRef.set({
      user_id: userId,
      team_id: teamId,
      team_name: teamName,
      fixture_id: fixtureId,
      round_number: roundNumber,
      match_number: matchNumber,
      type: 'warning',
      message: `⚠️ Your team "${teamName}" has not submitted a lineup for Round ${roundNumber}, Match #${matchNumber}. Please submit before the deadline.`,
      read: false,
      created_at: new Date().toISOString()
    });

    // Update lineup with warning flag
    const lineupSnapshot = await db
      .collection('lineups')
      .where('fixture_id', '==', fixtureId)
      .where('team_id', '==', teamId)
      .get();

    if (!lineupSnapshot.empty) {
      await lineupSnapshot.docs[0].ref.update({
        warning_given: true,
        warning_at: new Date().toISOString()
      });
    }

    return { success: true, notification_id: notificationRef.id };
  } catch (error: any) {
    console.error('Error sending lineup warning:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Notify opponent they can select lineup after second failure
 */
export async function notifyOpponentCanSelect(
  opponentUserId: string,
  opponentTeamId: string,
  opponentTeamName: string,
  failedTeamName: string,
  fixtureId: string,
  roundNumber: number,
  matchNumber: number
) {
  try {
    const notificationRef = db.collection('notifications').doc();
    
    await notificationRef.set({
      user_id: opponentUserId,
      team_id: opponentTeamId,
      team_name: opponentTeamName,
      fixture_id: fixtureId,
      round_number: roundNumber,
      match_number: matchNumber,
      type: 'opponent_can_select',
      message: `🎯 ${failedTeamName} has failed to submit their lineup for Round ${roundNumber}, Match #${matchNumber}. You may now select their lineup on their behalf.`,
      read: false,
      created_at: new Date().toISOString()
    });

    return { success: true, notification_id: notificationRef.id };
  } catch (error: any) {
    console.error('Error notifying opponent:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send deadline reminder notification
 */
export async function sendDeadlineReminder(
  userId: string,
  teamId: string,
  teamName: string,
  fixtureId: string,
  roundNumber: number,
  matchNumber: number,
  deadline: string
) {
  try {
    const notificationRef = db.collection('notifications').doc();
    
    const deadlineDate = new Date(deadline);
    const formattedDeadline = deadlineDate.toLocaleString();

    await notificationRef.set({
      user_id: userId,
      team_id: teamId,
      team_name: teamName,
      fixture_id: fixtureId,
      round_number: roundNumber,
      match_number: matchNumber,
      type: 'deadline_reminder',
      message: `⏰ Reminder: Submit lineup for "${teamName}" Round ${roundNumber}, Match #${matchNumber} by ${formattedDeadline}`,
      read: false,
      created_at: new Date().toISOString()
    });

    return { success: true, notification_id: notificationRef.id };
  } catch (error: any) {
    console.error('Error sending deadline reminder:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get unread notifications for a user
 */
export async function getUnreadNotifications(userId: string) {
  try {
    const notificationsSnapshot = await db
      .collection('notifications')
      .where('user_id', '==', userId)
      .where('read', '==', false)
      .orderBy('created_at', 'desc')
      .limit(50)
      .get();

    const notifications: LineupNotification[] = [];
    notificationsSnapshot.forEach(doc => {
      notifications.push({
        id: doc.id,
        ...doc.data()
      } as LineupNotification);
    });

    return { success: true, notifications };
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return { success: false, error: error.message, notifications: [] };
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string) {
  try {
    await db.collection('notifications').doc(notificationId).update({
      read: true,
      read_at: new Date().toISOString()
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error marking notification as read:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send manual warning from committee dashboard
 */
export async function sendManualWarning(
  fixtureId: string,
  teamId: string,
  teamName: string,
  roundNumber: number,
  matchNumber: number
) {
  try {
    // Get team owner
    const teamDoc = await db.collection('teams').doc(teamId).get();
    if (!teamDoc.exists) {
      return { success: false, error: 'Team not found' };
    }

    const team = teamDoc.data();
    const userId = team?.user_id || team?.owner_id;

    if (!userId) {
      return { success: false, error: 'Team owner not found' };
    }

    return await sendLineupWarning(
      teamId,
      teamName,
      fixtureId,
      roundNumber,
      matchNumber,
      userId
    );
  } catch (error: any) {
    console.error('Error sending manual warning:', error);
    return { success: false, error: error.message };
  }
}
