# Username Login - Complete Guide

## ✅ **Username Login is Now Active!**

Your application now supports **true username-based authentication**. Users can login with their username instead of email!

---

## 🎯 **How It Works**

### Registration Flow:
```
1. User enters username: "superadmin"
2. System creates email: "superadmin@ssleague.com" (auto-generated)
3. Creates Firebase Auth user with email
4. Creates Firestore user document
5. Reserves username in "usernames" collection
```

### Login Flow:
```
1. User enters: "superadmin"
2. System checks if it's email (contains @)
3. If username: Look up in "usernames" collection
4. Get UID → Get email from "users" document
5. Login with Firebase Auth using email
6. Success! ✅
```

---

## 📝 **Creating Super Admin**

### Method 1: Firebase Console (With Username Login)

**Step 1: Create Auth User**
```
Go to: Firebase Authentication
Email: superadmin@ssleague.com
Password: YourSecurePassword123!
→ Copy UID
```

**Step 2: Create Firestore Documents**

**users/{uid}:**
```javascript
{
  uid: "abc123...",
  email: "superadmin@ssleague.com",
  username: "superadmin",
  role: "super_admin",
  permissions: ["all"],
  isActive: true,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

**usernames/superadmin:**
```javascript
{
  uid: "abc123...",
  createdAt: timestamp
}
```

**Step 3: Login**
```
Username: superadmin  ← Just the username!
Password: YourSecurePassword123!
✅ Logs in successfully
```

---

### Method 2: Register Through App (Recommended)

**Step 1: Register**
```
1. Go to: http://localhost:3000/register
2. Username: superadmin
3. Password: YourSecurePassword123!
4. Team Name: Admin Team
5. Submit
```

**Step 2: Update Role in Firestore**
```
1. Go to Firestore Database
2. Find user in "users" collection
3. Change role: team → super_admin
4. Add permissions: ["all"]
5. Delete team fields (optional)
```

**Step 3: Re-login**
```
Username: superadmin
Password: YourSecurePassword123!
✅ Now a Super Admin!
```

---

## 🔐 **Login Examples**

### Login with Username (Recommended)
```
Username: superadmin
Password: ***
→ System looks up username
→ Gets email: superadmin@ssleague.com
→ Logs in with email
✅ Success!
```

### Login with Email (Also Works)
```
Username: superadmin@ssleague.com
Password: ***
→ System detects @ symbol
→ Uses email directly
✅ Success!
```

### Both methods work! Use whichever you prefer.

---

## 📊 **Database Structure**

### Collection: users
```javascript
{
  "abc123": {  // Document ID = UID
    uid: "abc123",
    email: "superadmin@ssleague.com",
    username: "superadmin",
    role: "super_admin",
    // ...
  }
}
```

### Collection: usernames
```javascript
{
  "superadmin": {  // Document ID = username (lowercase)
    uid: "abc123",
    createdAt: timestamp
  }
}
```

**Why two collections?**
- `users` stores full user data
- `usernames` maps username → UID for fast lookup

---

## ✨ **Features**

### ✅ Username Uniqueness
- Usernames are automatically checked during registration
- Case-insensitive (stored as lowercase)
- Error shown if username is taken

### ✅ Flexible Login
- Login with username: `superadmin`
- Or login with email: `superadmin@ssleague.com`
- Both methods work!

### ✅ Better Error Messages
```
"Username not found. Please check your username or register."
"Invalid username or password."
"Username is already taken. Please choose another."
```

### ✅ Automatic Email Generation
- Username: `johndoe`
- Auto-generates: `johndoe@ssleague.com`
- Users never see or need to remember the email!

---

## 🎭 **All User Types Work**

### Super Admin
```
Username: superadmin
Email: superadmin@ssleague.com (auto)
Login with: superadmin
```

### Committee Admin
```
Username: committeeboss
Email: committeeboss@ssleague.com (auto)
Login with: committeeboss
```

### Team
```
Username: teamwarriors
Email: teamwarriors@ssleague.com (auto)
Login with: teamwarriors
```

---

## 🔧 **Testing Username Login**

### Test 1: Register New User
```bash
1. Go to: http://localhost:3000/register
2. Username: testuser
3. Fill other fields
4. Submit
→ Should create account successfully
```

### Test 2: Login with Username
```bash
1. Go to: http://localhost:3000/login
2. Username: testuser
3. Password: [your password]
4. Submit
→ Should login successfully
```

### Test 3: Login with Email
```bash
1. Go to: http://localhost:3000/login
2. Username: testuser@ssleague.com
3. Password: [your password]
4. Submit
→ Should also work!
```

### Test 4: Try Invalid Username
```bash
1. Go to: http://localhost:3000/login
2. Username: nonexistent
3. Password: anything
4. Submit
→ Should show: "Username not found"
```

---

## ⚠️ **Important Notes**

### Username Rules
- ✅ Case-insensitive (stored lowercase)
- ✅ Unique across all users
- ✅ Can contain letters, numbers, underscores
- ❌ No spaces or special characters (recommended)

### Email Generation
- Email is auto-generated: `{username}@ssleague.com`
- Users don't need to know their email
- Email is only used internally by Firebase

### Existing Users
- If you created users before this update
- They might not have usernames reserved
- You need to manually create username documents

---

## 🔄 **Migrating Existing Users**

If you have existing users without username reservations:

### For Each User:
```javascript
// 1. Get user data from Firestore
users/{uid} → username: "johndoe"

// 2. Create username document
usernames/johndoe → { uid: "{uid}", createdAt: timestamp }
```

### Script (if needed):
```javascript
// You can create a migration script if you have many users
// For now, manually create username docs in Firebase Console
```

---

## 📚 **Related Files**

- `lib/firebase/auth.ts` - Username lookup logic
- `components/auth/Login.tsx` - Updated login component
- `components/auth/Register.tsx` - Username reservation
- `CREATE_SUPER_ADMIN.md` - Super admin creation guide

---

## 🎯 **Quick Reference**

### Create Super Admin with Username Login:

**Option 1: Via Register**
1. Register at `/register` with username `superadmin`
2. Change role to `super_admin` in Firestore
3. Login with username `superadmin`

**Option 2: Manual Creation**
1. Create in Firebase Auth: `superadmin@ssleague.com`
2. Create in Firestore: `users/{uid}` with username `superadmin`
3. Create in Firestore: `usernames/superadmin` with UID
4. Login with username `superadmin`

---

## ✅ **Verification**

After creating Super Admin, verify:

- [ ] Can login with username (e.g., `superadmin`)
- [ ] Can also login with email (e.g., `superadmin@ssleague.com`)
- [ ] Dashboard shows "Super Admin" badge
- [ ] Role and permissions are correct

---

**Your username login system is ready!** 🎉

Users can now login with memorable usernames instead of emails!
