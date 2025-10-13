# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Application Overview

This is **SS League**, a football auction platform built with Next.js 15, TypeScript, and Firebase. It's a multi-role system supporting super admins, committee admins, and team users with different dashboards and capabilities. The application is in active development, being converted from a Flask/Jinja2 application to a modern Next.js architecture.

## Development Commands

### Core Development
```bash
# Development server with Turbopack
npm run dev

# Production build with Turbopack
npm run build

# Start production server
npm start

# Run ESLint
npm run lint
```

### Testing Individual Features
```bash
# Test specific API routes
curl http://localhost:3000/api/players
curl http://localhost:3000/api/auction-settings

# Test authentication flow
npm run dev
# Navigate to /login, /register, or role-specific dashboards
```

## Architecture & Key Concepts

### Multi-Database Architecture
- **Firebase/Firestore**: Primary database for user data, authentication, and real-time features
- **Neon PostgreSQL**: Secondary database for auction settings and complex queries
- **Hybrid approach**: Uses both databases strategically based on data requirements

### Authentication & Authorization
- **Firebase Auth**: Handles authentication with custom user documents
- **Role-based routing**: Users are automatically redirected to role-specific dashboards:
  - `super_admin` → `/dashboard/superadmin`
  - `committee_admin` → `/dashboard/committee`
  - `team` → `/dashboard/team`
- **Token management**: Automatic token refresh every 50 minutes
- **Context-driven**: Uses AuthContext for global state management

### UI/UX Design System
- **Vision OS inspired**: Glass morphism effects, smooth animations
- **Custom CSS classes**:
  - `.glass` - Glass morphism background
  - `.nav-glass` - Navigation glass effect
  - `.gradient-text` - Brand gradient text
  - `.vision-button` - Vision OS style buttons
  - `.hover-float` - Floating hover animations
- **Color scheme**: Primary (#0066FF), Secondary (#9580FF), Accent (#FF2D55), Golden (#D4AF37)

### Component Architecture
```
components/
├── auth/           # Authentication components
├── home/           # Landing page components
├── layout/         # Navigation and layout components
└── [feature]/      # Feature-specific components
```

### API Route Patterns
- **RESTful endpoints**: `/api/[resource]/route.ts`
- **Consistent response format**: 
  ```json
  { "success": boolean, "data": any, "error"?: string }
  ```
- **Error handling**: Proper HTTP status codes and error messages
- **Database connection pooling**: Uses connection pools for Neon PostgreSQL

## Key Files & Directories

### Core Configuration
- `next.config.ts` - Next.js config with image optimization and webpack settings
- `app/layout.tsx` - Root layout with providers and metadata
- `app/globals.css` - Global styles and Vision OS design system
- `lib/firebase/config.ts` - Firebase configuration and initialization

### Context Providers
- `contexts/AuthContext.tsx` - Authentication state management
- `contexts/QueryProvider.tsx` - React Query configuration

### Database Utilities
- `lib/firebase/` - Firebase/Firestore operations
- `lib/neon/` - Neon PostgreSQL operations  
- `lib/auth-helper.ts` - Server-side authentication helpers

## Development Workflow

### When Adding New Features
1. **Database layer**: Add operations in appropriate `lib/` directory
2. **API routes**: Create `/api/[resource]/route.ts` with proper error handling
3. **Components**: Build reusable components following existing patterns
4. **Types**: Define TypeScript interfaces in `types/` directory
5. **Styling**: Use existing design system classes or extend them consistently

### Authentication Integration
- Always use `useAuth()` hook in components
- Check `user.role` for role-based functionality
- Handle loading states during authentication checks
- Use Firebase Admin SDK patterns for server-side operations

### Database Operations
- Firebase: Use for real-time data, user documents, and authentication
- Neon: Use for complex queries, settings, and structured data
- Always implement connection pooling for Neon operations
- Handle database errors gracefully with proper user feedback

## Environment Requirements

### Required Environment Variables
```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

# Database
NEON_DATABASE_URL=

# Firebase Admin (for server-side operations)
FIREBASE_ADMIN_CREDENTIALS=
```

### Shell Environment
This project runs on Windows with PowerShell, but commands should be cross-platform compatible.

## Current State & Roadmap

### Completed Features
- Landing page with Vision OS design
- Multi-role authentication system
- Basic dashboard structure
- Firebase/Neon hybrid database setup
- Component-based architecture with TypeScript

### Active Development Areas
- Dashboard functionality for each role
- Player management and auction features
- Bulk operations (photo uploads, bidding)
- Real-time auction interface
- Excel import/export capabilities

### Conversion Notes
This is an ongoing conversion from Flask/Jinja2. Many `.md` files in the root contain implementation notes and conversion guides. Refer to `README.md` and `CONVERSION_PLAN.md` for detailed conversion strategy.