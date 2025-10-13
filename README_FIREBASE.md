# Firebase Integration - SS League Auction

Firebase has been successfully integrated into your Next.js application with full authentication support for three user types: **Super Admin**, **Committee Admin**, and **Team**.

## 🎉 What's Been Set Up

### ✅ Firebase Installation & Configuration
- Firebase SDK installed and configured
- Environment variables template created (`.env.local.example`)
- Firebase config with Auth, Firestore, and Storage

### ✅ User Types & Authentication
Three distinct user roles with different permissions:

1. **Super Admin**
   - Full system access
   - Can manage all users and committees
   - Permissions: `['all']`

2. **Committee Admin**
   - Manages teams within their committee
   - Can create and manage auctions
   - Permissions: `['manage_teams', 'manage_auctions']`

3. **Team**
   - Participates in auctions
   - Manages their team and players
   - Default balance: 100,000

### ✅ Authentication Components
All authentication pages have been updated with Firebase:

- **Login** (`/login`) - Email/password authentication with role-based access
- **Register** (`/register`) - User registration with team logo upload
- **Reset Password** (`/reset-password`) - Password change functionality
- **Dashboard** (`/dashboard`) - Role-specific dashboard after login

### ✅ Context & Hooks
- `AuthContext` - Global authentication state management
- `useAuth()` - Access current user and auth state
- `useFirebaseAuth()` - Sign in, sign up, sign out functions
- `useTeamLogo()` - Team logo upload functionality

### ✅ Firebase Services
Complete authentication and data management:
- User creation with role assignment
- Email/password authentication
- Password reset
- File upload (team logos)
- User profile management
- Username uniqueness validation

## 📁 Project Structure

```
nextjs-project/
├── app/
│   ├── login/page.tsx          # Login page
│   ├── register/page.tsx       # Registration page
│   ├── reset-password/page.tsx # Password reset
│   ├── dashboard/page.tsx      # User dashboard
│   └── layout.tsx              # Root layout with AuthProvider
├── components/
│   └── auth/
│       ├── Login.tsx           # Login component
│       ├── Register.tsx        # Registration component
│       └── ResetPassword.tsx   # Password reset component
├── contexts/
│   └── AuthContext.tsx         # Auth context provider
├── hooks/
│   └── useFirebase.ts          # Custom Firebase hooks
├── lib/
│   └── firebase/
│       ├── config.ts           # Firebase initialization
│       └── auth.ts             # Auth service functions
├── types/
│   └── user.ts                 # User type definitions
├── .env.local.example          # Environment template
├── FIREBASE_SETUP.md           # Detailed setup guide
└── README_FIREBASE.md          # This file
```

## 🚀 Quick Start

### 1. Set Up Firebase Project

Follow the detailed instructions in [`FIREBASE_SETUP.md`](./FIREBASE_SETUP.md) to:
- Create a Firebase project
- Enable Authentication
- Set up Firestore Database
- Configure Storage
- Set security rules

### 2. Configure Environment Variables

```bash
# Copy the example file
cp .env.local.example .env.local

# Edit .env.local with your Firebase credentials
```

Your `.env.local` should contain:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### 3. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` and test the authentication!

## 📝 Usage Examples

### Accessing Current User

```tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';

export default function MyComponent() {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Please log in</div>;

  return (
    <div>
      <h1>Welcome, {user.username}!</h1>
      <p>Role: {user.role}</p>
      {user.role === 'team' && <p>Balance: ₹{user.balance}</p>}
    </div>
  );
}
```

### Sign In

```tsx
import { useFirebaseAuth } from '@/hooks/useFirebase';

export default function LoginExample() {
  const { signIn, loading, error } = useFirebaseAuth();

  const handleLogin = async () => {
    try {
      await signIn('user@example.com', 'password123');
      // Redirect or handle success
    } catch (err) {
      console.error(err);
    }
  };

  return <button onClick={handleLogin}>Sign In</button>;
}
```

### Create User

```tsx
import { useFirebaseAuth } from '@/hooks/useFirebase';

export default function RegisterExample() {
  const { signUp } = useFirebaseAuth();

  const handleRegister = async () => {
    try {
      await signUp(
        'user@example.com',
        'password123',
        'username',
        'team',
        {
          teamName: 'My Team',
          balance: 100000,
          players: []
        }
      );
    } catch (err) {
      console.error(err);
    }
  };

  return <button onClick={handleRegister}>Register</button>;
}
```

### Protected Routes

```tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ProtectedPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) return <div>Loading...</div>;
  if (!user) return null;

  return <div>Protected Content</div>;
}
```

### Role-Based Access

```tsx
import { useAuth } from '@/contexts/AuthContext';

export default function AdminPanel() {
  const { user } = useAuth();

  if (user?.role !== 'super_admin' && user?.role !== 'committee_admin') {
    return <div>Access Denied</div>;
  }

  return <div>Admin Panel</div>;
}
```

## 🔐 Security Rules

Make sure to set up proper Firestore and Storage security rules as described in `FIREBASE_SETUP.md`.

## 📊 Firestore Collections

### users/
Stores all user data with role-specific fields:
```javascript
{
  uid: string,
  email: string,
  username: string,
  role: 'super_admin' | 'committee_admin' | 'team',
  isActive: boolean,
  createdAt: timestamp,
  updatedAt: timestamp,
  // Role-specific fields
  teamName?: string,      // For teams
  balance?: number,       // For teams
  players?: array,        // For teams
  committeeId?: string,   // For admins & teams
  permissions?: array     // For admins
}
```

### usernames/
Ensures username uniqueness:
```javascript
{
  uid: string,
  createdAt: timestamp
}
```

## 🎨 Features

- ✅ Email/Password Authentication
- ✅ Role-based Access Control (RBAC)
- ✅ Team Logo Upload
- ✅ Password Reset
- ✅ User Profile Management
- ✅ Real-time Auth State
- ✅ Protected Routes
- ✅ Loading States
- ✅ Error Handling
- ✅ Responsive Design

## 🔧 Customization

### Adding New User Fields

Edit `types/user.ts`:
```typescript
export interface Team extends BaseUser {
  role: 'team';
  teamName: string;
  teamLogo?: string;
  balance: number;
  players: string[];
  // Add your custom fields here
  customField?: string;
}
```

### Adding New Authentication Methods

Edit `lib/firebase/auth.ts` to add functions like:
- Google Sign-In
- Phone Authentication
- Email Verification
- Anonymous Authentication

## 📚 Documentation

- [Firebase Setup Guide](./FIREBASE_SETUP.md) - Complete Firebase configuration
- [Firebase Docs](https://firebase.google.com/docs)
- [Next.js Docs](https://nextjs.org/docs)

## 🐛 Troubleshooting

See the Troubleshooting section in [`FIREBASE_SETUP.md`](./FIREBASE_SETUP.md#troubleshooting)

## 🎯 Next Steps

1. **Set up Firebase project** following `FIREBASE_SETUP.md`
2. **Configure environment variables**
3. **Test authentication flow**
4. **Add more features**:
   - Email verification
   - Profile picture upload
   - Admin user management
   - Auction functionality
   - Real-time bidding

## 📞 Support

If you encounter issues:
1. Check the browser console for errors
2. Verify Firebase configuration
3. Review security rules
4. Check environment variables

---

**Your authentication system is ready to use!** 🎉

All you need to do is:
1. Create a Firebase project
2. Add your credentials to `.env.local`
3. Start building your auction features!
