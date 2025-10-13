# Next.js Football Auction - Conversion Plan

## Project Overview
Converting a Flask-based Football Auction application to Next.js with TypeScript and Tailwind CSS.

## Pages Identified from Original HTML

### Public Pages
1. **Landing Page (index.html)** ✓ STARTING HERE
   - Hero section
   - Features showcase (Team Management, Live Bidding, Secure Platform)
   - How It Works section
   - Call to Action

2. **Base Layout (base.html)**
   - Navigation (Desktop & Mobile)
   - Header with season information
   - Footer
   - Global styles and themes

### Future Pages to Convert
- Login
- Register
- Dashboard (Admin & User)
- Teams Management
- Player Management
- Auction/Bidding Interface
- Profile/Settings
- etc.

## Tech Stack
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Context / Zustand (TBD)
- **API**: Next.js API Routes
- **Database**: MongoDB (based on nosqltest folder name)

## Project Structure
```
nextjs-project/
├── app/
│   ├── layout.tsx          # Root layout (replaces base.html)
│   ├── page.tsx            # Landing page (index.html)
│   ├── login/
│   ├── register/
│   ├── dashboard/
│   └── ...
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── MobileNav.tsx
│   │   └── Navbar.tsx
│   ├── home/
│   │   ├── Hero.tsx
│   │   ├── Features.tsx
│   │   ├── HowItWorks.tsx
│   │   └── CallToAction.tsx
│   └── ui/              # Reusable UI components
├── lib/
│   ├── mongodb.ts
│   └── utils.ts
├── public/
│   └── images/
├── styles/
│   └── globals.css
└── types/
    └── index.ts
```

## Conversion Steps

### Phase 1: Foundation (Current)
1. ✓ Create Next.js project
2. ✓ Analyze existing HTML structure
3. → Convert Landing Page (index.html)
4. → Create Base Layout (base.html → layout.tsx)
5. → Set up Tailwind configuration with custom theme

### Phase 2: Core Pages
6. Login page
7. Register page
8. Dashboard (user view)
9. Dashboard (admin view)

### Phase 3: Feature Pages
10. Teams list and detail pages
11. Players list and detail pages
12. Auction/Bidding interface
13. Profile management

### Phase 4: Advanced Features
14. Real-time updates (WebSocket/Server-Sent Events)
15. Authentication & Authorization
16. Admin features
17. Responsive optimizations

## Current Status
**Phase 1, Step 3**: Converting Landing Page

## Notes
- Original app uses Flask with Jinja2 templating
- Heavy use of Tailwind CSS with custom Vision OS-inspired design
- Mobile-first responsive design
- Glass morphism effects throughout
- Admin vs. User role differentiation
