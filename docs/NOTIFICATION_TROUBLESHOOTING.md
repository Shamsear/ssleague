# Push Notification Troubleshooting Guide

## Changes Made

### 1. Multi-Device Support
- Added **"Add This Device"** button in the notification dropdown
- Users can now register multiple devices (iOS, Android, Desktop) for the same account
- Each device is tracked separately in the database with device info (browser, OS, last used)

### 2. Enhanced Error Detection
The system now automatically detects and explains push service errors with specific guidance for:
- **Government/Corporate Network Restrictions** - Most common cause
- **VAPID Key Mismatches**
- **Service Worker Issues**
- **Browser Permission Blocks**

### 3. Automatic Connectivity Testing
When a push service error occurs, the system automatically:
- Tests Firebase Cloud Messaging endpoints
- Detects network restrictions/firewalls
- Provides specific recommendations based on the failure mode
- Logs detailed diagnostics to browser console

## Common Error: "AbortError: Registration failed - push service error"

### Root Causes (in order of likelihood)

#### 1. **Network Firewall Blocking FCM (MOST COMMON)**
Government, corporate, and institutional networks often block Firebase Cloud Messaging.

**Blocked endpoints:**
- `fcm.googleapis.com`
- `fcmtoken.googleapis.com`
- `firebase.googleapis.com`

**Solutions:**
- ✅ Try from a different network (home WiFi, mobile data)
- ✅ Disable VPN temporarily
- ✅ Ask network administrator to whitelist Firebase endpoints
- ✅ Use a different device/location

#### 2. **VAPID Key Mismatch**
The VAPID key in `.env.local` must exactly match Firebase Console.

**Verification steps:**
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project → Project Settings → Cloud Messaging
3. Under "Web Push certificates", find your "Key pair"
4. Copy the key and compare with `NEXT_PUBLIC_FIREBASE_VAPID_KEY` in `.env.local`

**Current VAPID key (first 20 chars):**
```
BP7rhD9-iJgTLqUvBmum...
```

#### 3. **Service Worker Not Ready**
The service worker must be registered before requesting push permissions.

**Solutions:**
- Refresh the page
- Wait a few seconds after page load
- Check browser console for service worker errors

#### 4. **HTTPS Required**
Push notifications require HTTPS (except on localhost).

**Check:**
- URL should start with `https://`
- Certificate should be valid

## How to Use Multi-Device Support

### For Users with Existing Notification Setup

1. Click the **"Notifications On"** button in the navbar
2. Dropdown opens showing current devices
3. Click **"Add This Device"** button at the bottom
4. System checks if notification permission is granted:
   - ✅ Already granted → Registers immediately
   - ❌ Denied → Shows instructions to reset in browser settings
   - ⚪ Not asked → Prompts for permission

### For New Users

1. Click **"Enable Notifications"** button
2. Grant permission when browser asks
3. Device is automatically registered
4. On other devices, click dropdown → "Add This Device"

## Testing Connectivity

### Manual Test (Browser Console)
```javascript
// Open browser console (F12) and run:
import { logDetailedConnectivityInfo } from '@/lib/firebase/connectivity-test';
await logDetailedConnectivityInfo();
```

### Automatic Test
The system automatically runs connectivity tests when push service errors occur. Check the browser console (F12) for:
- `🔍 Firebase Cloud Messaging Connectivity Test`
- Endpoint reachability results
- Specific recommendations

## Debugging Steps

### 1. Check Browser Console
Press `F12` → Console tab. Look for:
- ❌ Red error messages
- Service worker registration status
- FCM token generation logs
- Connectivity test results

### 2. Verify Prerequisites
- [ ] HTTPS connection (or localhost)
- [ ] Browser supports notifications (Chrome, Firefox, Edge, Safari 16.4+)
- [ ] Service worker registered
- [ ] VAPID key configured
- [ ] Not on restricted network

### 3. Test Different Networks
Try enabling notifications from:
- ✅ Home WiFi
- ✅ Mobile data (hotspot)
- ❌ Government/office WiFi (often blocked)
- ❌ School/university network (often blocked)
- ❌ Public WiFi (may be blocked)

### 4. Check Firebase Console
1. Go to Firebase Console → Cloud Messaging
2. Verify Web Push certificate exists
3. Check if API restrictions are enabled
4. Review quota/usage

## Network Administrator Guide

If your organization wants to support push notifications, whitelist these domains:

### Required Domains
```
fcm.googleapis.com
fcmtoken.googleapis.com
firebase.googleapis.com
www.googleapis.com
```

### Ports
- TCP 443 (HTTPS)
- TCP 5228-5230 (FCM alternative ports)

### Testing
```bash
# Test connectivity from server/firewall
curl -I https://fcm.googleapis.com
curl -I https://fcmtoken.googleapis.com
curl -I https://firebase.googleapis.com
```

## Browser-Specific Notes

### Chrome/Edge
- Best support for push notifications
- Works on all platforms (Windows, Mac, Linux, Android)
- iOS not supported (use Safari)

### Firefox
- Good support
- Works on all platforms

### Safari
- iOS: Requires iOS 16.4+
- macOS: Full support
- Must add to home screen on iOS for push support

### Mobile Browsers
- **Android Chrome**: ✅ Full support
- **iOS Safari**: ✅ iOS 16.4+ (must add to home screen)
- **iOS Chrome/Firefox**: ❌ Not supported (use Safari)

## Error Messages Reference

| Error | Cause | Solution |
|-------|-------|----------|
| `AbortError: Registration failed` | Network blocks FCM | Try different network |
| `messaging/permission-blocked` | User denied permission | Reset in browser settings |
| `messaging/token-subscribe-failed` | Network/FCM issue | Check internet, try again |
| `messaging/token-subscribe-no-token` | Service worker not ready | Refresh page, wait 2-3 seconds |
| `No registration token available` | VAPID key issue | Check Firebase Console |

## Support Checklist

When helping users with notification issues:

1. **What's the exact error message?**
   - Check browser console (F12)
   - Note the error name and code

2. **What network are they on?**
   - Government/corporate → Likely blocked
   - Home/mobile → Check other causes

3. **What device/browser?**
   - iOS non-Safari → Won't work
   - Old iOS (<16.4) → Won't work
   - Desktop Chrome → Should work

4. **Can they reach FCM endpoints?**
   - Run connectivity test
   - Check console for test results

5. **Is VAPID key correct?**
   - Compare with Firebase Console
   - Check `.env.local` file

## Files Changed

- `components/notifications/NotificationButton.tsx` - Added "Add This Device" button
- `lib/firebase/messaging.ts` - Added automatic connectivity testing
- `lib/firebase/connectivity-test.ts` - New connectivity test utility
- `app/api/notifications/subscribe/route.ts` - Already supports multiple devices

## Database Schema

The `fcm_tokens` table supports multiple devices:
- `user_id` - Firebase UID (not unique, allows multiple devices)
- `token` - FCM token (unique per device)
- `device_name` - Human-readable name
- `device_type` - mobile/desktop/tablet
- `browser` - Chrome, Safari, Firefox, etc.
- `os` - Windows, macOS, iOS, Android, etc.
- `is_active` - Active/inactive flag
- `last_used_at` - Last notification sent
