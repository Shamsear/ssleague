# News Page System - Complete Documentation

## Overview

The News Page System is a bilingual (English + Malayalam) news display platform for the SS Super League tournament. It provides a modern, responsive interface for viewing AI-generated and manually created news articles with real-time language switching, category filtering, and an admin management panel.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Pages Overview](#pages-overview)
3. [Key Features](#key-features)
4. [Components](#components)
5. [Bilingual Support](#bilingual-support)
6. [User Interface](#user-interface)
7. [Admin Panel](#admin-panel)
8. [API Integration](#api-integration)
9. [Styling & Design](#styling--design)
10. [Usage Guide](#usage-guide)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   News Database (Neon)                   │
│  - Bilingual content (EN + ML)                          │
│  - Images, metadata, categories                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              API Layer (/api/news)                       │
│  - Fetch published news                                  │
│  - Filter by category/season                            │
│  - Admin CRUD operations                                │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│  Public News     │    │  Admin Panel     │
│  (/news)         │    │  (/admin/news)   │
│                  │    │                  │
│  - View news     │    │  - Review drafts │
│  - Language      │    │  - Edit content  │
│    toggle        │    │  - Publish/      │
│  - Category      │    │    Unpublish     │
│    filter        │    │  - Delete        │
└──────────────────┘    └──────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│            Language Context Provider                     │
│  - Manages EN/ML state                                   │
│  - Persists to localStorage                             │
│  - Provides toggle function                             │
└─────────────────────────────────────────────────────────┘
```

---

## Pages Overview

### 1. Public News Page (`/news`)
**File**: `app/news/page.tsx`

**Purpose**: Display published news articles to all users

**Features**:
- Bilingual content display (English/Malayalam)
- Category filtering (Registration, Team, Auction, Fantasy, Match, etc.)
- Season filtering
- Featured article showcase
- Responsive grid layout
- Real-time language switching

### 2. Admin News Panel (`/admin/news`)
**File**: `app/admin/news/page.tsx`

**Purpose**: Manage news articles (committee/super admin only)

**Features**:
- Review AI-generated drafts
- Edit news content
- Publish/unpublish articles
- Delete articles
- Filter by status (Drafts/Published/All)
- Inline editing

### 3. Test News Page (`/test/news`)
**File**: `app/test/news/page.tsx`

**Purpose**: Test AI news generation with various event types

**Features**:
- Quick test buttons for different events
- Real-time generation preview
- Image generation testing
- Direct links to public/admin pages

---

## Key Features

### 1. **Bilingual Support**

- **Dual Language Content**: Every news article has both English and Malayalam versions
- **Instant Language Toggle**: Switch between languages without page reload
- **Persistent Preference**: Language choice saved to localStorage
- **Fallback Support**: Gracefully handles missing translations

**Implementation**:
```typescript
// Language Context Hook
const { language, setLanguage } = useLanguage();

// Get localized text
const getLocalizedText = (item: NewsItem, field: 'title' | 'content' | 'summary') => {
  if (language === 'ml') {
    const mlField = `${field}_ml` as keyof NewsItem;
    if (item[mlField]) return item[mlField] as string;
  }
  const enField = `${field}_en` as keyof NewsItem;
  return (item[enField] || item[field] || '') as string;
};
```

### 2. **Category Filtering**

**7 Categories**:
- 👥 **Registration**: Player registration milestones
- 🏆 **Team**: Team formations, roster updates
- 💰 **Auction**: Auction events, player sales
- 🎮 **Fantasy**: Fantasy league updates
- ⚽ **Match**: Match results, highlights
- 📢 **Announcement**: General announcements
- 🎯 **Milestone**: Achievement milestones

**Features**:
- One-click category filter
- Visual category badges with icons
- Color-coded categories
- "All News" option

### 3. **Featured Article Showcase**

The latest news article is displayed prominently with:
- Large hero image
- Full-width layout on desktop
- Enhanced typography
- Hover effects
- Direct link to full article

### 4. **Responsive Design**

**Breakpoints**:
- **Mobile** (< 768px): Single column, stacked layout
- **Tablet** (768px - 1024px): 2-column grid
- **Desktop** (> 1024px): 3-column grid + featured article

### 5. **Image Support**

- AI-generated images from Pollinations.ai
- Lazy loading for performance
- Fallback gradients if no image
- Optimized aspect ratios (16:9)

### 6. **Real-time Updates**

- Fetch latest news on page load
- Refresh on filter change
- Loading states with skeleton screens
- Error handling with retry option

---

## Components

### 1. NewsCard Component

**File**: `components/NewsCard.tsx`

**Purpose**: Reusable card component for displaying news items

**Props**:
```typescript
interface NewsCardProps {
  news: NewsCardData;           // News item data
  onClick?: () => void;          // Optional click handler
  showLink?: boolean;            // Show as link (default: true)
  showImage?: boolean;           // Display image (default: true)
  compact?: boolean;             // Compact mode (default: false)
  className?: string;            // Additional CSS classes
}
```

**Features**:
- Bilingual content support
- Category badge with icon
- Reporter name display
- Formatted date (IST timezone)
- Tone indicator
- Image with lazy loading
- Hover effects
- Responsive sizing

**Usage**:
```typescript
<NewsCard
  news={newsItem}
  showLink={true}
  showImage={true}
  compact={false}
/>
```

### 2. Language Context Provider

**File**: `contexts/LanguageContext.tsx`

**Purpose**: Global language state management

**API**:
```typescript
interface LanguageContextType {
  language: Language;              // Current language ('en' | 'ml')
  setLanguage: (lang: Language) => void;  // Set language
  toggleLanguage: () => void;      // Toggle between EN/ML
}
```

**Features**:
- Persistent storage (localStorage)
- Client-side only (SSR safe)
- Default language: English
- Type-safe language values

**Usage**:
```typescript
import { useLanguage } from '@/contexts/LanguageContext';

function MyComponent() {
  const { language, setLanguage, toggleLanguage } = useLanguage();
  
  return (
    <button onClick={() => setLanguage('ml')}>
      Switch to Malayalam
    </button>
  );
}
```

---

## Bilingual Support

### Database Schema

News items store content in both languages:

```sql
CREATE TABLE news (
  -- English Content
  title_en TEXT NOT NULL,
  content_en TEXT NOT NULL,
  summary_en TEXT,
  reporter_en VARCHAR(100),
  
  -- Malayalam Content
  title_ml TEXT,
  content_ml TEXT,
  summary_ml TEXT,
  reporter_ml VARCHAR(100),
  
  -- Legacy Support (single language)
  title TEXT,
  content TEXT,
  summary TEXT,
  
  -- Other fields...
);
```

### Content Retrieval Logic

```typescript
// Priority: Language-specific field > Legacy field > Empty string
const title = language === 'en'
  ? (news.title_en || news.title || '')
  : (news.title_ml || news.title || '');
```

### Language Toggle UI

```typescript
<div className="flex gap-2">
  <button
    onClick={() => setLanguage('en')}
    className={language === 'en' ? 'active' : 'inactive'}
  >
    English
  </button>
  <button
    onClick={() => setLanguage('ml')}
    className={language === 'ml' ? 'active' : 'inactive'}
  >
    മലയാളം
  </button>
</div>
```

### Reporter Names

Each language has its own reporter persona:
- **English**: Alex Thompson (അലക്സ് തോംസൺ)
- **Malayalam**: Rajesh Nair (രാജേഷ് നായർ)

---

## User Interface

### Public News Page Layout

```
┌─────────────────────────────────────────────────────┐
│  📰 Tournament News & Updates    [EN] [മലയാളം]     │
│  Stay updated with the latest happenings            │
├─────────────────────────────────────────────────────┤
│  [All] [👥 Registration] [🏆 Team] [💰 Auction]    │
│  [🎮 Fantasy] [⚽ Match] [📢 Announcement]          │
├─────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────┐ │
│  │         FEATURED ARTICLE (Latest)             │ │
│  │  ┌─────────────┐  ┌─────────────────────────┐│ │
│  │  │             │  │  Category Badge          ││ │
│  │  │   Image     │  │  Headline (Large)        ││ │
│  │  │             │  │  Summary                 ││ │
│  │  │             │  │  [Read Full Story →]     ││ │
│  │  └─────────────┘  └─────────────────────────┘│ │
│  └───────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│  More News                                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐           │
│  │ Image   │  │ Image   │  │ Image   │           │
│  │ Title   │  │ Title   │  │ Title   │           │
│  │ Summary │  │ Summary │  │ Summary │           │
│  └─────────┘  └─────────┘  └─────────┘           │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐           │
│  │ Image   │  │ Image   │  │ Image   │           │
│  │ Title   │  │ Title   │  │ Title   │           │
│  │ Summary │  │ Summary │  │ Summary │           │
│  └─────────┘  └─────────┘  └─────────┘           │
└─────────────────────────────────────────────────────┘
```

### Admin Panel Layout

```
┌─────────────────────────────────────────────────────┐
│  📰 News Management                                  │
│  Review and publish AI-generated news               │
├─────────────────────────────────────────────────────┤
│  [Drafts (5)] [Published (12)] [All (17)]          │
├─────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────┐ │
│  │  [Image Preview]                              │ │
│  │  [MATCH] [🤖 AI Generated] [📝 Draft]        │ │
│  │  Red Panthers Secure Victory                  │ │
│  │  Summary: Red Panthers won 3-2...            │ │
│  │  Content: In an exciting match...            │ │
│  │  Season: Season 17                            │ │
│  │  [✏️ Edit] [✓ Publish] [🗑️ Delete]          │ │
│  └───────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────┐ │
│  │  [Image Preview]                              │ │
│  │  [REGISTRATION] [🤖 AI] [✓ Published]        │ │
│  │  100 Players Registered!                      │ │
│  │  [✏️ Edit] [📥 Unpublish] [🗑️ Delete]       │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Category Colors & Icons

```typescript
const CATEGORY_COLORS = {
  registration: 'bg-purple-100 text-purple-800',
  team: 'bg-blue-100 text-blue-800',
  auction: 'bg-orange-100 text-orange-800',
  fantasy: 'bg-green-100 text-green-800',
  match: 'bg-red-100 text-red-800',
  announcement: 'bg-gray-100 text-gray-800',
  milestone: 'bg-yellow-100 text-yellow-800',
};

const CATEGORY_ICONS = {
  registration: '👥',
  team: '🏆',
  auction: '💰',
  fantasy: '🎮',
  match: '⚽',
  announcement: '📢',
  milestone: '🎯',
};
```

---

## Admin Panel

### Access Control

**Required Roles**:
- `committee_admin`
- `super_admin`

**Authentication Check**:
```typescript
const { user, loading: authLoading } = useAuth();

useEffect(() => {
  if (!authLoading && user && 
      (user.role === 'committee_admin' || user.role === 'super_admin')) {
    fetchNews();
  }
}, [user, authLoading]);
```

### Features

#### 1. **Draft Review**
- View all unpublished AI-generated news
- Preview content before publishing
- See image previews
- Check metadata (category, season, reporter)

#### 2. **Inline Editing**
- Click "Edit" to enter edit mode
- Modify title, summary, content
- Save changes or cancel
- Mark as edited by admin

**Edit Mode UI**:
```typescript
{editingId === item.id ? (
  <div className="p-6 space-y-4">
    <input
      type="text"
      value={editForm.title}
      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
      placeholder="Title"
    />
    <textarea
      value={editForm.content}
      onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
      rows={8}
      placeholder="Content"
    />
    <button onClick={saveEdit}>Save</button>
    <button onClick={cancelEdit}>Cancel</button>
  </div>
) : (
  // View mode
)}
```

#### 3. **Publishing Workflow**

**Draft → Published**:
1. Review AI-generated content
2. Edit if needed
3. Click "Publish"
4. Confirm action
5. Article goes live on public page

**Published → Draft**:
1. Click "Unpublish"
2. Confirm action
3. Article removed from public view
4. Moved back to drafts

#### 4. **Deletion**
- Permanent deletion with confirmation
- Cannot be undone
- Removes from database

#### 5. **Filter Tabs**

```typescript
const [filter, setFilter] = useState<'all' | 'drafts' | 'published'>('drafts');

// Filter logic
let filtered = data.news || [];
if (filter === 'drafts') {
  filtered = filtered.filter((n: NewsItem) => !n.is_published);
} else if (filter === 'published') {
  filtered = filtered.filter((n: NewsItem) => n.is_published);
}
```

**Tab Counts**:
- Drafts (5) - Shows count of unpublished items
- Published (12) - Shows count of published items
- All (17) - Shows total count

---

## API Integration

### Fetch News (Public)

**Endpoint**: `GET /api/news`

**Query Parameters**:
- `season_id`: Filter by season
- `category`: Filter by category
- `limit`: Number of items (default: 50)

**Request**:
```typescript
const params = new URLSearchParams();
params.append('limit', '100');
if (selectedCategory) params.append('category', selectedCategory);
if (selectedSeason) params.append('season_id', selectedSeason);

const response = await fetch(`/api/news?${params.toString()}`);
const data = await response.json();
```

**Response**:
```json
{
  "success": true,
  "news": [
    {
      "id": "news_123",
      "title_en": "Red Panthers Secure Victory",
      "title_ml": "റെഡ് പാന്തേഴ്സ് വിജയം നേടി",
      "content_en": "...",
      "content_ml": "...",
      "category": "match",
      "image_url": "https://...",
      "is_published": true,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "count": 1
}
```

### Fetch News (Admin)

**Endpoint**: `GET /api/news?include_drafts=true`

**Query Parameters**:
- `include_drafts=true`: Include unpublished items
- `limit`: Number of items

**Request**:
```typescript
const params = new URLSearchParams();
params.append('include_drafts', 'true');
params.append('limit', '100');

const response = await fetch(`/api/news?${params.toString()}`);
```

### Publish News

**Endpoint**: `POST /api/news`

**Request Body**:
```json
{
  "id": "news_123",
  "title": "...",
  "content": "...",
  "is_published": true,
  "published_at": "2024-01-15T10:30:00Z"
}
```

### Delete News

**Endpoint**: `DELETE /api/news?id=news_123`

**Request**:
```typescript
const response = await fetch(`/api/news?id=${id}`, {
  method: 'DELETE',
});
```

---

## Styling & Design

### Design System

**Colors**:
- Primary Blue: `#0066FF`
- Secondary Cyan: `#00D4FF`
- Background: Gradient from blue/5 to cyan/5
- Text: Gray-900 (headings), Gray-700 (body)

**Typography**:
- Headings: Bold, 2xl-4xl
- Body: Regular, base-lg
- Categories: Uppercase, xs-sm, bold

**Spacing**:
- Container: max-w-6xl
- Padding: 4-8 (mobile), 6-10 (desktop)
- Gap: 2-6 between elements

### Responsive Breakpoints

```css
/* Mobile First */
.container {
  padding: 1rem;
}

/* Tablet (md: 768px) */
@media (min-width: 768px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Desktop (lg: 1024px) */
@media (min-width: 1024px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

### Animations

**Loading Skeleton**:
```typescript
<div className="animate-pulse">
  <div className="h-12 bg-gray-200 rounded w-1/3 mb-8"></div>
  <div className="h-6 bg-gray-200 rounded w-2/3 mb-4"></div>
</div>
```

**Hover Effects**:
```css
.card {
  transition: all 0.3s ease;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}
```

**Image Zoom**:
```css
.image-container:hover img {
  transform: scale(1.05);
  transition: transform 0.5s ease;
}
```

---

## Usage Guide

### For End Users

#### Viewing News

1. **Navigate to News Page**:
   - Visit `/news` or click "News" in navigation

2. **Switch Language**:
   - Click "English" or "മലയാളം" button in header
   - Language preference is saved automatically

3. **Filter by Category**:
   - Click category buttons (Registration, Team, Auction, etc.)
   - Click "All News" to clear filter

4. **Read Articles**:
   - Click on any news card to read full article
   - Featured article is displayed at top

#### Language Preference

Your language choice is saved to browser storage:
```typescript
localStorage.setItem('preferred_language', 'ml');
```

Next visit will remember your preference.

### For Admins

#### Accessing Admin Panel

1. **Login** with committee_admin or super_admin role
2. **Navigate** to `/admin/news`
3. **View** drafts, published, or all news

#### Publishing Workflow

**Step 1: Review Draft**
- Check AI-generated content
- Verify title, summary, content
- Check image quality
- Confirm category and season

**Step 2: Edit (Optional)**
- Click "Edit" button
- Modify title, summary, or content
- Click "Save Changes"

**Step 3: Publish**
- Click "Publish" button
- Confirm action in dialog
- Article goes live immediately

#### Unpublishing

1. Find published article
2. Click "Unpublish" button
3. Confirm action
4. Article moved to drafts

#### Deleting

1. Find article to delete
2. Click "Delete" button
3. Confirm permanent deletion
4. Article removed from database

**⚠️ Warning**: Deletion is permanent and cannot be undone!

---

## Code Examples

### Example 1: Fetch and Display News

```typescript
'use client'

import { useState, useEffect } from 'react';
import NewsCard from '@/components/NewsCard';

export default function MyNewsPage() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      const response = await fetch('/api/news?limit=10');
      const data = await response.json();
      setNews(data.news || []);
    } catch (error) {
      console.error('Failed to fetch news:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {news.map((item) => (
        <NewsCard key={item.id} news={item} />
      ))}
    </div>
  );
}
```

### Example 2: Language Toggle Component

```typescript
'use client'

import { useLanguage } from '@/contexts/LanguageContext';

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex gap-2">
      <button
        onClick={() => setLanguage('en')}
        className={`px-4 py-2 rounded ${
          language === 'en' 
            ? 'bg-blue-600 text-white' 
            : 'bg-gray-200 text-gray-700'
        }`}
      >
        English
      </button>
      <button
        onClick={() => setLanguage('ml')}
        className={`px-4 py-2 rounded ${
          language === 'ml' 
            ? 'bg-blue-600 text-white' 
            : 'bg-gray-200 text-gray-700'
        }`}
      >
        മലയാളം
      </button>
    </div>
  );
}
```

### Example 3: Category Filter

```typescript
const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

const categories = [
  'registration', 'team', 'auction', 
  'fantasy', 'match', 'announcement'
];

return (
  <div className="flex gap-2">
    <button onClick={() => setSelectedCategory(null)}>
      All News
    </button>
    {categories.map(cat => (
      <button
        key={cat}
        onClick={() => setSelectedCategory(cat)}
        className={selectedCategory === cat ? 'active' : ''}
      >
        {cat.charAt(0).toUpperCase() + cat.slice(1)}
      </button>
    ))}
  </div>
);
```

### Example 4: Admin Publish Action

```typescript
const handlePublish = async (newsId: string) => {
  if (!confirm('Publish this news item?')) return;

  try {
    const item = news.find(n => n.id === newsId);
    
    const response = await fetch('/api/news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...item,
        is_published: true,
        published_at: new Date(),
      }),
    });

    if (response.ok) {
      alert('News published successfully!');
      fetchNews(); // Refresh list
    } else {
      alert('Failed to publish news');
    }
  } catch (error) {
    console.error('Error publishing:', error);
    alert('Failed to publish news');
  }
};
```

---

## Performance Optimization

### 1. **Lazy Loading Images**

```typescript
<img
  src={news.image_url}
  alt={title}
  loading="lazy"
  className="w-full h-full object-cover"
/>
```

### 2. **Skeleton Loading States**

```typescript
{loading && (
  <div className="animate-pulse">
    <div className="h-12 bg-gray-200 rounded w-1/3 mb-8"></div>
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-xl p-6">
          <div className="h-6 bg-gray-200 rounded w-2/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
        </div>
      ))}
    </div>
  </div>
)}
```

### 3. **Pagination/Limit**

```typescript
// Fetch only what's needed
const params = new URLSearchParams();
params.append('limit', '50'); // Limit to 50 items
```

### 4. **Client-Side Filtering**

```typescript
// Filter in memory instead of new API calls
const filteredNews = news.filter(item => 
  !selectedCategory || item.category === selectedCategory
);
```

---

## Troubleshooting

### Issue: Language not switching

**Cause**: Language context not provided

**Solution**: Wrap app in LanguageProvider
```typescript
// app/layout.tsx
import { LanguageProvider } from '@/contexts/LanguageContext';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
```

### Issue: News not loading

**Cause**: API endpoint not responding

**Solution**: Check API route and database connection
```bash
# Test API endpoint
curl http://localhost:3000/api/news

# Check environment variables
echo $NEON_DATABASE_URL
```

### Issue: Images not displaying

**Cause**: Invalid image URLs or CORS issues

**Solution**: 
1. Check image URL in database
2. Verify Pollinations.ai is accessible
3. Add fallback gradient:
```typescript
{news.image_url ? (
  <img src={news.image_url} alt={title} />
) : (
  <div className="bg-gradient-to-br from-blue-50 to-purple-50" />
)}
```

### Issue: Admin panel not accessible

**Cause**: Insufficient permissions

**Solution**: Check user role
```typescript
// User must have role: 'committee_admin' or 'super_admin'
console.log('User role:', user?.role);
```

---

## Best Practices

### 1. **Content Guidelines**

- Keep titles under 80 characters
- Write clear, concise summaries
- Use proper grammar and punctuation
- Verify facts before publishing
- Include relevant images

### 2. **Admin Workflow**

- Review all AI-generated content before publishing
- Edit for clarity and accuracy
- Check bilingual content matches in meaning
- Verify category and season tags
- Test on mobile before publishing

### 3. **Performance**

- Limit API requests (use pagination)
- Implement lazy loading for images
- Cache frequently accessed data
- Use skeleton loaders for better UX

### 4. **Accessibility**

- Use semantic HTML (`<article>`, `<time>`)
- Add alt text to images
- Ensure sufficient color contrast
- Support keyboard navigation
- Test with screen readers

---

## Future Enhancements

### Planned Features

1. **Individual News Detail Page** (`/news/[id]`)
   - Full article view
   - Social sharing buttons
   - Related news section
   - Comments/reactions

2. **Search Functionality**
   - Full-text search
   - Search by keyword
   - Search filters

3. **Bookmarking**
   - Save favorite articles
   - Reading list
   - User preferences

4. **Push Notifications**
   - Breaking news alerts
   - Category-specific notifications
   - Email digests

5. **Social Sharing**
   - Share to Twitter/Facebook
   - Copy link
   - WhatsApp sharing

6. **Analytics**
   - View counts
   - Popular articles
   - User engagement metrics

---

## File Structure

```
app/
├── news/
│   └── page.tsx              # Public news page
├── admin/
│   └── news/
│       └── page.tsx          # Admin panel
└── test/
    └── news/
        └── page.tsx          # Test page

components/
└── NewsCard.tsx              # Reusable news card

contexts/
└── LanguageContext.tsx       # Language state management

lib/
├── news/
│   ├── trigger.ts            # News generation trigger
│   ├── auto-generate.ts      # AI generation
│   ├── prompts-bilingual.ts  # Bilingual prompts
│   └── types.ts              # TypeScript types
└── images/
    └── generate.ts           # Image generation
```

---

## Related Documentation

- [News AI System Documentation](./NEWS_AI_SYSTEM_DOCUMENTATION.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Database Schema](./DATABASE_SCHEMA.md)

---

## Support

For issues or questions:
- Check console logs for errors
- Verify API endpoints are working
- Test with different browsers
- Check language context is provided
- Verify user permissions for admin panel

---

**Last Updated**: June 1, 2026
**Version**: 2.0.0
**Status**: Production Ready ✅
