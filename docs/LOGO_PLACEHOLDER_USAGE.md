# Logo Placeholder Usage Guide

## Overview
The `LogoPlaceholder` component replaces gradient avatar placeholders with the actual club logo (`/logo.png`) throughout the application.

## Usage

### Import
```tsx
import LogoPlaceholder from '@/components/LogoPlaceholder';
```

### Basic Usage
```tsx
// Default (64px, rounded-2xl)
<LogoPlaceholder />

// Small (40px)
<LogoPlaceholder size="sm" />

// Medium (48px)
<LogoPlaceholder size="md" />

// Large (64px) - Default
<LogoPlaceholder size="lg" />

// Extra Large (80px)
<LogoPlaceholder size="xl" />

// Custom size (100px)
<LogoPlaceholder size={100} />

// With custom classes (e.g., make it circular)
<LogoPlaceholder className="rounded-full" />
```

## Replacing Old Placeholders

### Old Pattern (Gradient Placeholder)
```tsx
<div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#9580FF]/20 to-[#9580FF]/10 flex items-center justify-center">
  <span className="text-[#9580FF] font-bold text-lg">
    {teamName?.[0]?.toUpperCase() || 'T'}
  </span>
</div>
```

### New Pattern (Logo Placeholder)
```tsx
<LogoPlaceholder size={48} className="rounded-2xl" />
```

## Common Replacements

### Team Avatar (48px)
**Old:**
```tsx
<div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-500/10 flex items-center justify-center">
  <span className="text-2xl font-bold text-blue-600">{teamName[0]}</span>
</div>
```

**New:**
```tsx
<LogoPlaceholder size="md" />
```

### User Avatar (40px)
**Old:**
```tsx
<div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-purple-500/10 flex items-center justify-center">
  <span className="text-purple-600 font-bold">{username[0]}</span>
</div>
```

**New:**
```tsx
<LogoPlaceholder size="sm" className="rounded-full" />
```

### Large Logo (80px+)
**Old:**
```tsx
<div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#9580FF]/20 to-[#9580FF]/10 flex items-center justify-center">
  <svg className="w-10 h-10 text-[#9580FF]">...</svg>
</div>
```

**New:**
```tsx
<LogoPlaceholder size="xl" className="rounded-3xl" />
```

## Files with Placeholder Avatars

The following files contain gradient placeholder avatars that can be replaced with `<LogoPlaceholder />`:

### Dashboard Pages
- `app/dashboard/committee/teams/[id]/page.tsx`
- `app/dashboard/committee/teams/page.tsx`
- `app/dashboard/team/profile/page.tsx`
- `app/dashboard/team/profile/edit/page.tsx`
- `app/dashboard/team/RegisteredTeamDashboard-old.tsx`

### Fantasy Pages
- `app/dashboard/team/fantasy/players/page.tsx`
- `app/dashboard/team/fantasy/transfers/page.tsx`
- `app/dashboard/team/fantasy/draft/page.tsx`
- `app/dashboard/team/fantasy/my-team/page.tsx`
- `app/dashboard/team/fantasy/all-teams/page.tsx`
- `app/dashboard/team/fantasy/claim/page.tsx`
- `app/dashboard/team/fantasy/leaderboard/page.tsx`
- `app/dashboard/committee/fantasy/*/page.tsx`

### Match/Fixture Pages
- `app/dashboard/team/fixtures/[id]/page.tsx`
- `app/dashboard/team/fixture/[fixtureId]/page.tsx`
- `app/dashboard/committee/rounds/[id]/page.tsx`

### Team Management
- `app/dashboard/committee/team-management/categories/page.tsx`

## Benefits

1. **Consistency**: Same logo everywhere instead of random gradients
2. **Branding**: Reinforces club identity throughout the app
3. **Maintainability**: Single component to update if logo changes
4. **Performance**: Optimized with Next.js Image component
5. **Responsive**: Easy size adjustments with props

## Migration Strategy

To replace all placeholders:

1. Search for: `bg-gradient-to-br from.*rounded.*flex items-center justify-center`
2. Replace with: `<LogoPlaceholder size="XX" />`
3. Adjust `size` prop based on original `w-XX h-XX` classes:
   - `w-10 h-10` → `size="sm"` (40px)
   - `w-12 h-12` → `size="md"` (48px)  
   - `w-16 h-16` → `size="lg"` (64px)
   - `w-20 h-20` → `size="xl"` (80px)
4. Preserve `rounded-*` classes in `className` prop
