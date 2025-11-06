# 🔔 Firebase Cloud Messaging (FCM) Setup Guide

## ✅ What's Been Implemented

Firebase Cloud Messaging has been fully integrated into your app! Here's what was added:

### Files Created:
1. `lib/firebase/messaging.ts` - FCM configuration and token management
2. `public/firebase-messaging-sw.js` - Service worker for background notifications
3. `app/register-sw.tsx` - Service worker registration component
4. `app/api/notifications/subscribe/route.ts` - API to save/remove FCM tokens
5. `app/api/notifications/send/route.ts` - API to send notifications
6. `components/notifications/NotificationButton.tsx` - UI button to enable notifications

### Files Modified:
1. `app/layout.tsx` - Added service worker registration
2. `app/dashboard/team/RegisteredTeamDashboard.tsx` - Added notification button
3. `app/api/team/dashboard/route.ts` - Added fantasy team status check

---

## 🚀 Setup Instructions

### Step 1: Get VAPID Key from Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **eaguedemo**
3. Click the **gear icon** (⚙️) → **Project Settings**
4. Go to **Cloud Messaging** tab
5. Scroll down to **Web configuration**
6. Under **Web Push certificates**, click **Generate key pair**
7. Copy the generated key (starts with "B...")

### Step 2: Add VAPID Key to Environment Variables

Add this to your `.env.local` file:

```env
# Firebase Cloud Messaging VAPID Key (Web Push Certificate)
NEXT_PUBLIC_FIREBASE_VAPID_KEY=YOUR_VAPID_KEY_HERE
```

Replace `YOUR_VAPID_KEY_HERE` with the key you copied from Firebase Console.

### Step 3: Restart Your Development Server

```bash
npm run dev
```

---

## 📱 How It Works

### For Users:
1. Users see an "Enable Notifications" button on their dashboard
2. When clicked, browser asks for notification permission
3. If granted, FCM token is saved to their Firestore document
4. They now receive push notifications even when the browser is closed!

### For You (Sending Notifications):
Committee/admin can send notifications via API:

```typescript
// Send to single user
await fetch('/api/notifications/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user_firebase_uid',
    title: '🎉 Auction Won!',
    body: 'You won Lionel Messi for €5,000',
    url: '/dashboard/team',
    icon: '/logo.png'
  })
});
```

---

## 🎯 Use Cases

### 1. Auction Notifications
Send when:
- New auction round starts
- Player bidding ends
- User wins/loses a bid
- Tiebreaker created

Example:
```typescript
await fetch('/api/notifications/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: winningTeamId,
    title: '🎉 You won the auction!',
    body: `Congratulations! You won ${playerName} for €${amount}`,
    url: '/dashboard/team/squad',
    data: { type: 'auction_won', playerId: player.id }
  })
});
```

### 2. Match Notifications
Send when:
- Match about to start (30 min before)
- Match ends
- Results posted

### 3. Fantasy Notifications
Send when:
- Player scores/assists
- Captain performs well
- Weekly ranking changes

---

## 🧪 Testing

### Test in Development:

1. **Enable Notifications:**
   - Open your app in Chrome/Edge
   - Login as a team
   - Click "Enable Notifications" button
   - Grant permission when prompted

2. **Test Sending (from Postman or another browser tab):**
```bash
curl -X POST http://localhost:3000/api/notifications/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_COMMITTEE_TOKEN" \
  -d '{
    "userId": "TARGET_USER_ID",
    "title": "Test Notification",
    "body": "This is a test message!",
    "url": "/dashboard/team"
  }'
```

3. **Expected Result:**
   - Notification appears on desktop
   - Clicking it opens the app
   - Works even if browser is minimized!

---

## 📋 Notification Data Structure

Notifications saved in Firestore have this structure:

### User Document (`users/{userId}`):
```typescript
{
  fcmToken: "string",              // FCM registration token
  notificationsEnabled: boolean,   // true if subscribed
  fcmTokenUpdatedAt: timestamp,    // Last updated
  fcmTokenRemovedAt: timestamp?    // If unsubscribed
}
```

### Notification History (`notifications/{notificationId}`):
```typescript
{
  userId: "string",
  title: "string",
  body: "string",
  icon: "string",
  url: "string",
  data: object,
  sentAt: timestamp,
  sentBy: "string",              // Committee/admin user ID
  messageId: "string",           // FCM message ID
  status: "sent" | "failed"
}
```

---

## 🛠️ Troubleshooting

### "Service Worker registration failed"
- Make sure you're on **HTTPS** or **localhost**
- Clear browser cache and reload

### "No registration token available"
- Check if VAPID key is correct in `.env.local`
- Verify Firebase project has Cloud Messaging enabled
- Try in incognito mode (no extensions blocking)

### "Invalid FCM token"
- Token expires when user clears browser data
- API automatically removes invalid tokens from database
- User needs to re-enable notifications

### Notifications not showing
- Check browser notification settings
- Ensure user hasn't blocked notifications for your site
- Test in Chrome (best support) first

---

## 🌐 Browser Support

| Browser | Desktop | Mobile | Background |
|---------|---------|--------|------------|
| Chrome  | ✅ | ✅ | ✅ |
| Edge    | ✅ | ✅ | ✅ |
| Firefox | ✅ | ✅ | ✅ |
| Safari  | ✅ | ⚠️ Limited | ❌ |
| Opera   | ✅ | ✅ | ✅ |

**Note:** Safari on iOS has limited support. Consider fallback to in-app notifications.

---

## 🔒 Security

- FCM tokens are sensitive - stored in Firestore with security rules
- Only committee/admin can send notifications (enforced in API)
- Tokens automatically cleaned up when invalid
- HTTPS required in production

---

## 💰 Cost

**FREE!** Firebase Cloud Messaging has no limits on:
- Number of notifications
- Number of users
- API calls

---

## 📚 Additional Resources

- [Firebase Cloud Messaging Docs](https://firebase.google.com/docs/cloud-messaging)
- [Web Push Notifications Guide](https://web.dev/push-notifications-overview/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

---

## ✨ Next Steps

1. **Add VAPID key to `.env.local`**
2. **Restart dev server**
3. **Test with a team account**
4. **Integrate notifications into your auction/match logic**

Need help? Check the code comments in the files listed at the top!
