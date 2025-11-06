# 🔔 Multi-Device Push Notifications - Setup Guide

## ✅ What's New

**Multi-device support has been added!** Users can now enable notifications on multiple devices and receive push notifications on ALL of them simultaneously.

---

## 🎯 **Key Features**

### ✅ **Multi-Device Support**
- User A on Phone 1 ✅
- User B on Phone 2 ✅  
- User A on Desktop ✅
- **All receive notifications!** 🔔🔔🔔

### ✅ **Device Management**
- View all registered devices
- See device info (browser, OS, last used)
- Remove individual devices
- Auto-detect device names

### ✅ **Smart Token Management**
- Tokens stored in Neon database
- Auto-cleanup of invalid tokens
- Track device activity
- Backward compatible with Firestore

---

## 🗄️ **Database Setup**

### **Step 1: Run SQL Migration**

Connect to your Neon (Tournament) database and run:

```bash
# Using psql
psql "postgresql://neondb_owner:...@ep-twilight-union-a1ee67rr-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require" < migrations/create_fcm_tokens_table.sql
```

Or execute this SQL directly:

```sql
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  token TEXT NOT NULL UNIQUE,
  device_name VARCHAR(255),
  device_type VARCHAR(50),
  browser VARCHAR(100),
  os VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_fcm_tokens_user_id ON fcm_tokens(user_id);
CREATE INDEX idx_fcm_tokens_active ON fcm_tokens(is_active);
CREATE INDEX idx_fcm_tokens_user_active ON fcm_tokens(user_id, is_active);
```

---

## 📱 **How It Works**

### **For Users:**

1. **Enable on Device 1:**
   - Click "Enable Notifications"
   - Grant permission
   - Device saved as "Chrome on Windows"

2. **Enable on Device 2:**
   - Login on iPhone
   - Click "Enable Notifications"
   - Device saved as "iPhone"

3. **Receive Everywhere:**
   - Notification sent → Both devices get it! 🔔🔔

4. **Manage Devices:**
   - Click "Notifications On (2)" button
   - See list of all devices
   - Remove any device with trash icon

---

## 🔧 **Technical Changes**

### **Files Created:**
1. `migrations/create_fcm_tokens_table.sql` - Database table
2. `lib/device-detector.ts` - Device info detection
3. `app/api/notifications/devices/route.ts` - Device management API

### **Files Modified:**
1. `app/api/notifications/subscribe/route.ts` - Now saves to Neon
2. `app/api/notifications/send/route.ts` - Sends to all devices
3. `components/notifications/NotificationButton.tsx` - Device management UI

---

## 💾 **Database Structure**

### **fcm_tokens Table:**
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `user_id` | VARCHAR(255) | Firebase UID |
| `token` | TEXT | FCM token (unique) |
| `device_name` | VARCHAR(255) | "iPhone", "Chrome on Windows" |
| `device_type` | VARCHAR(50) | "mobile", "desktop", "tablet" |
| `browser` | VARCHAR(100) | "Chrome", "Safari", "Firefox" |
| `os` | VARCHAR(100) | "iOS", "Windows", "Android" |
| `is_active` | BOOLEAN | false if token expired |
| `created_at` | TIMESTAMP | When device was registered |
| `last_used_at` | TIMESTAMP | Last notification sent |
| `updated_at` | TIMESTAMP | Last token update |

---

## 📊 **API Changes**

### **1. Subscribe (POST /api/notifications/subscribe)**

**Before:**
- Saved 1 token to Firestore
- Overwrote previous token

**After:**
- Saves to Neon database
- Supports multiple devices
- Auto-detects device info
- Also updates Firestore (backward compatibility)

**Response:**
```json
{
  "success": true,
  "message": "Notification token saved successfully",
  "device": {
    "deviceName": "Chrome on Windows",
    "deviceType": "desktop",
    "browser": "Chrome",
    "os": "Windows"
  }
}
```

### **2. Send (POST /api/notifications/send)**

**Before:**
- Got 1 token from Firestore
- Sent to 1 device

**After:**
- Gets all active tokens from Neon
- Sends to ALL devices
- Auto-marks invalid tokens as inactive
- Updates last_used_at

**Response:**
```json
{
  "success": true,
  "sentToDevices": 3,
  "failedDevices": 0,
  "message": "Notification sent to 3 device(s)"
}
```

### **3. Devices (GET /api/notifications/devices) - NEW!**

**Purpose:** List all user's devices

**Response:**
```json
{
  "success": true,
  "devices": [
    {
      "id": 1,
      "deviceName": "iPhone",
      "deviceType": "mobile",
      "browser": "Safari",
      "os": "iOS",
      "isActive": true,
      "createdAt": "2025-01-06T10:00:00Z",
      "lastUsedAt": "2025-01-06T12:30:00Z",
      "tokenPreview": "f9Kx2abc123..."
    },
    {
      "id": 2,
      "deviceName": "Chrome on Windows",
      "deviceType": "desktop",
      "browser": "Chrome",
      "os": "Windows",
      "isActive": true,
      "createdAt": "2025-01-06T09:00:00Z",
      "lastUsedAt": "2025-01-06T11:45:00Z",
      "tokenPreview": "d7Mn9xyz789..."
    }
  ]
}
```

### **4. Remove Device (DELETE /api/notifications/devices?deviceId=123) - NEW!**

**Purpose:** Remove a specific device

**Response:**
```json
{
  "success": true,
  "message": "Device removed successfully"
}
```

---

## 🎨 **UI Changes**

### **Notification Button:**

**Before:**
- Simple button: "Notifications On"

**After:**
- Shows device count: "Notifications On (3)"
- Click to expand device list
- Each device shows:
  - Device name
  - Browser and OS
  - Last used date
  - Remove button (trash icon)
  - Inactive badge (if token expired)

---

## 🧪 **Testing Multi-Device**

### **Test Scenario:**

1. **Device 1 (Chrome Desktop):**
   ```
   - Login as Team A
   - Enable notifications
   - See: "Notifications enabled on Chrome on Windows"
   ```

2. **Device 2 (iPhone):**
   ```
   - Login as Team A (same account)
   - Enable notifications
   - See: "Notifications enabled on iPhone"
   ```

3. **Send Test Notification:**
   ```bash
   curl -X POST http://localhost:3000/api/notifications/send \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer COMMITTEE_TOKEN" \
     -d '{
       "userId": "TEAM_A_USER_ID",
       "title": "Test Multi-Device",
       "body": "This should appear on both devices!"
     }'
   ```

4. **Expected Result:**
   - ✅ Chrome desktop shows notification
   - ✅ iPhone shows notification
   - ✅ API response: `"sentToDevices": 2`

---

## 🔒 **Security**

- ✅ Tokens stored securely in Neon database
- ✅ Users can only view/delete their own devices
- ✅ Full token not exposed in API (only preview)
- ✅ Invalid tokens auto-marked as inactive
- ✅ HTTPS required in production

---

## 🐛 **Troubleshooting**

### **"User has not enabled notifications on any device"**
- Check if `fcm_tokens` table exists
- Verify user has enabled notifications
- Check `is_active` column (should be `true`)

### **Notification sent to 0 devices**
- All tokens might be invalid/expired
- User may have cleared browser data
- Check `is_active = false` in database

### **Device not showing in list**
- Refresh the page
- Check console for API errors
- Verify Neon connection string

### **SQL Error: relation "fcm_tokens" does not exist**
- Run the migration SQL script
- Verify `NEON_TOURNAMENT_DB_URL` environment variable

---

## 📈 **Monitoring**

### **Useful Queries:**

```sql
-- Total active devices per user
SELECT user_id, COUNT(*) as device_count
FROM fcm_tokens
WHERE is_active = true
GROUP BY user_id
ORDER BY device_count DESC;

-- Inactive tokens (need cleanup)
SELECT COUNT(*)
FROM fcm_tokens
WHERE is_active = false;

-- Most active devices
SELECT device_name, device_type, browser, last_used_at
FROM fcm_tokens
WHERE is_active = true
ORDER BY last_used_at DESC
LIMIT 10;

-- Devices not used in 30 days
SELECT user_id, device_name, last_used_at
FROM fcm_tokens
WHERE last_used_at < NOW() - INTERVAL '30 days'
  AND is_active = true;
```

---

## 🚀 **Next Steps**

1. ✅ Run SQL migration
2. ✅ Restart app
3. ✅ Test on multiple devices
4. ✅ Monitor device registrations

---

## 💡 **Benefits Over Previous Version**

| Feature | Before | After |
|---------|--------|-------|
| Multiple devices | ❌ No | ✅ Yes |
| Device management | ❌ No | ✅ Yes |
| Token cleanup | ⚠️ Manual | ✅ Automatic |
| Device info | ❌ No | ✅ Yes |
| Database | Firestore | Neon (faster, cheaper) |
| Cost per notification | 💰 Read + Write | ✅ Just sending |

---

**All devices now supported! 🎉**
