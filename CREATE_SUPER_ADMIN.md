# How to Create a Super Admin in Firebase

This guide explains how to manually create the first Super Admin user in Firebase.

## 📋 Prerequisites

Before creating a Super Admin:
- ✅ Firebase project created
- ✅ Authentication enabled (Email/Password)
- ✅ Firestore Database created
- ✅ `.env.local` configured
- ✅ Dev server running

## 🎯 Two Methods to Create Super Admin

### Method 1: Using Firebase Console (Recommended)

#### Step 1: Create Authentication User

1. **Go to Firebase Authentication**
   - Visit: https://console.firebase.google.com/project/eague-92e4f/authentication/users
   - Click **"Add user"** button

2. **Enter User Details**
   ```
   Email:    admin@ssleague.com
   Password: YourSecurePassword123!
   ```
   - Click **"Add user"**

3. **Copy the User UID**
   - After creation, you'll see the new user in the list
   - **Copy the UID** (looks like: `kB3xYz9QmNPdS7tU2vW1XyZ4`)
   - Keep this UID - you'll need it in the next step!

#### Step 2: Create Firestore User Document

1. **Go to Firestore Database**
   - Visit: https://console.firebase.google.com/project/eague-92e4f/firestore/data
   - Click **"Start collection"**

2. **Create the Users Collection**
   ```
   Collection ID: users
   ```
   - Click **"Next"**

3. **Create the Super Admin Document**
   - **Document ID**: Paste the UID you copied (e.g., `kB3xYz9QmNPdS7tU2vW1XyZ4`)
   - Click **"Add field"** for each field below:

   | Field Name | Type | Value |
   |------------|------|-------|
   | `uid` | string | `kB3xYz9QmNPdS7tU2vW1XyZ4` (your copied UID) |
   | `email` | string | `admin@ssleague.com` |
   | `username` | string | `superadmin` |
   | `role` | string | `super_admin` |
   | `permissions` | array | Click "+" then add string: `all` |
   | `isActive` | boolean | `true` |
   | `createdAt` | timestamp | Click "Insert default value" |
   | `updatedAt` | timestamp | Click "Insert default value" |

4. **Click "Save"**

#### Step 3: Create Username Document (for uniqueness)

1. **Still in Firestore, create another collection**
   - Click **"Start collection"**
   - Collection ID: `usernames`
   - Click **"Next"**

2. **Create Username Document**
   - **Document ID**: `superadmin` (the username you chose)
   - Add fields:
   
   | Field Name | Type | Value |
   |------------|------|-------|
   | `uid` | string | `kB3xYz9QmNPdS7tU2vW1XyZ4` (your UID) |
   | `createdAt` | timestamp | Click "Insert default value" |

3. **Click "Save"**

#### Step 4: Test Super Admin Login

1. **Go to your app's login page**
   ```
   http://localhost:3000/login
   ```

2. **Login with Super Admin credentials**
   ```
   Username: admin@ssleague.com
   Password: YourSecurePassword123!
   ```

3. **You should see the dashboard with "Super Admin" role badge!**

---

## 🖼️ Visual Step-by-Step (Firebase Console)

### Creating Authentication User:

```
Firebase Console
└── Authentication
    └── Users
        └── [Add user] Button
            ├── Email: admin@ssleague.com
            ├── Password: ●●●●●●●●●●●●
            └── [Add user] Button
                → Copy the generated UID!
```

### Creating Firestore Document:

```
Firestore Database
└── [Start collection]
    ├── Collection ID: "users"
    └── [Next]
        ├── Document ID: [Paste UID here]
        └── Fields:
            ├── uid: string → [Your UID]
            ├── email: string → admin@ssleague.com
            ├── username: string → superadmin
            ├── role: string → super_admin
            ├── permissions: array → ["all"]
            ├── isActive: boolean → true
            ├── createdAt: timestamp → [auto]
            └── updatedAt: timestamp → [auto]
```

---

## 🔧 Method 2: Using Your App's Register Page (Quick)

You can also create a Super Admin through the registration page, then manually change the role:

#### Step 1: Register a Normal User

1. Go to: `http://localhost:3000/register`
2. Fill in the form:
   ```
   Username: superadmin
   Password: YourSecurePassword123!
   Team Name: Admin Team
   ```
3. Click "Create Account"

#### Step 2: Change Role in Firestore

1. Go to Firestore Database in Firebase Console
2. Navigate to: `users` → [Find your user document]
3. Edit the `role` field:
   - Change from: `team`
   - Change to: `super_admin`
4. Add `permissions` field:
   - Type: `array`
   - Add string: `all`
5. Remove team-specific fields (optional):
   - Delete `teamName`
   - Delete `balance`
   - Delete `players`
   - Delete `teamLogo`

#### Step 3: Logout and Login Again

1. Logout from the app
2. Login again with the same credentials
3. You should now see "Super Admin" role!

---

## 📊 Complete Super Admin Document Structure

Here's what a complete Super Admin document looks like in Firestore:

```javascript
// Collection: users
// Document ID: kB3xYz9QmNPdS7tU2vW1XyZ4 (the UID)

{
  uid: "kB3xYz9QmNPdS7tU2vW1XyZ4",
  email: "admin@ssleague.com",
  username: "superadmin",
  role: "super_admin",
  permissions: ["all"],
  isActive: true,
  createdAt: Timestamp (auto-generated),
  updatedAt: Timestamp (auto-generated)
}
```

---

## 🔐 Multiple Admins

You can create multiple Super Admins by repeating the process:

### Admin 1 (Main):
```javascript
{
  uid: "abc123...",
  email: "admin@ssleague.com",
  username: "superadmin",
  role: "super_admin",
  permissions: ["all"],
  isActive: true
}
```

### Admin 2 (Backup):
```javascript
{
  uid: "def456...",
  email: "admin2@ssleague.com",
  username: "admin2",
  role: "super_admin",
  permissions: ["all"],
  isActive: true
}
```

---

## 🎭 Different User Roles Comparison

### Super Admin Document:
```javascript
{
  role: "super_admin",
  permissions: ["all"],
  // No team-specific fields
}
```

### Committee Admin Document:
```javascript
{
  role: "committee_admin",
  committeeId: "committee_123",
  committeeName: "Premier League",
  permissions: ["manage_teams", "manage_auctions"],
  canManageTeams: true,
  canManageAuctions: true
}
```

### Team Document:
```javascript
{
  role: "team",
  teamName: "Manchester United",
  teamLogo: "data:image/png;base64,...",
  balance: 100000,
  players: [],
  committeeId: "committee_123"
}
```

---

## ✅ Verification Checklist

After creating Super Admin, verify:

- [ ] User exists in **Authentication** section
- [ ] User document exists in **Firestore** → `users` collection
- [ ] Username reserved in **Firestore** → `usernames` collection
- [ ] Can login at `/login`
- [ ] Dashboard shows "Super Admin" badge
- [ ] Role displayed correctly in dashboard

---

## 🐛 Troubleshooting

### Problem: Can't login with Super Admin

**Solution:**
- Check that email in Authentication matches email in Firestore
- Verify UID in Firestore document matches UID in Authentication
- Check that `role` field is exactly `super_admin` (case-sensitive)

### Problem: Shows as "Team" instead of "Super Admin"

**Solution:**
- Check Firestore document's `role` field
- Must be `super_admin` not `super-admin` or `superadmin`
- Logout and login again after changing role

### Problem: "User document not found"

**Solution:**
- Ensure you created the Firestore document
- Document ID must match the UID from Authentication
- Check collection name is exactly `users`

### Problem: Can't find UID in Firebase Console

**Solution:**
1. Go to Authentication → Users
2. Click on the user row
3. UID is shown at the top: "User UID: abc123..."
4. Or hover over the UID column in the list

---

## 🔗 Quick Links

- **Authentication**: https://console.firebase.google.com/project/eague-92e4f/authentication/users
- **Firestore**: https://console.firebase.google.com/project/eague-92e4f/firestore/data
- **Login Page**: http://localhost:3000/login
- **Register Page**: http://localhost:3000/register

---

## 📝 Example: Complete Creation Process

```bash
# 1. Firebase Console → Authentication
Add user:
  Email: admin@ssleague.com
  Password: Admin123!@#
  → Copy UID: kB3xYz9QmNPdS7tU2vW1XyZ4

# 2. Firebase Console → Firestore
Create collection: users
Create document: kB3xYz9QmNPdS7tU2vW1XyZ4
Add fields:
  uid: kB3xYz9QmNPdS7tU2vW1XyZ4
  email: admin@ssleague.com
  username: superadmin
  role: super_admin
  permissions: ["all"]
  isActive: true
  createdAt: [timestamp]
  updatedAt: [timestamp]

# 3. Firebase Console → Firestore
Create collection: usernames
Create document: superadmin
Add fields:
  uid: kB3xYz9QmNPdS7tU2vW1XyZ4
  createdAt: [timestamp]

# 4. Test
Visit: http://localhost:3000/login
Login with: admin@ssleague.com / Admin123!@#
✅ Should see Super Admin dashboard!
```

---

## 💡 Pro Tips

1. **Use a strong password** for Super Admin (min 12 characters)
2. **Don't use personal email** - use a team email
3. **Create backup admin** in case you lose access
4. **Document credentials** securely (use password manager)
5. **Test immediately** after creation to verify it works

---

**Need help?** Check the troubleshooting section or see `FIREBASE_SETUP.md` for more details!
