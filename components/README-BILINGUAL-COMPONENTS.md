# Bilingual UI Components Usage Guide

This document provides examples for using the bilingual news and poll components.

## Setup

### 1. Wrap your app with LanguageProvider

In your root layout (`app/layout.tsx`):

```tsx
import { LanguageProvider } from '@/contexts/LanguageContext';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider defaultLanguage="en">
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
```

## Components

### LanguageToggle

Switch between English and Malayalam.

**Variants:**
- `switch` (default) - Toggle switch with EN/ML labels
- `button` - Single button showing current language
- `dropdown` - Select dropdown with both options

```tsx
import LanguageToggle from '@/components/LanguageToggle';

// Switch variant (default)
<LanguageToggle />

// Button variant
<LanguageToggle variant="button" className="mt-4" />

// Dropdown variant
<LanguageToggle variant="dropdown" className="w-40" />
```

### NewsCard

Display bilingual news articles with automatic language switching.

**Features:**
- Supports both new bilingual schema (`title_en`, `title_ml`) and legacy schema (`title`)
- Displays category badges, reporter info, and publication date
- Optional image display
- Compact mode for lists
- Automatic linking to news detail page

```tsx
import NewsCard from '@/components/NewsCard';

const newsItem = {
  id: 'news_123',
  title_en: 'Team XYZ Wins Championship',
  title_ml: 'ടീം XYZ ചാമ്പ്യൻഷിപ്പ് നേടി',
  summary_en: 'Team XYZ clinched the title after a thrilling final...',
  summary_ml: 'ടീം XYZ ആവേശകരമായ ഫൈനലിന് ശേഷം കിരീടം സ്വന്തമാക്കി...',
  category: 'match',
  event_type: 'finals_result',
  image_url: '/images/news_123.jpg',
  published_at: '2025-01-15T10:00:00Z',
  reporter_en: 'Sarah Johnson',
  reporter_ml: 'സാറാ ജോൺസൺ',
  tone: 'celebratory',
  is_published: true,
  created_at: '2025-01-15T09:45:00Z',
};

// Full card with image
<NewsCard news={newsItem} />

// Compact card without image
<NewsCard news={newsItem} compact showImage={false} />

// Card without link (for modals)
<NewsCard news={newsItem} showLink={false} onClick={() => handleClick()} />
```

### PollWidget

Interactive poll voting and results display.

**Features:**
- Bilingual question, description, and options
- Live voting with percentage visualization
- Results view with progress bars
- Status indicators (Active, Closed, Voted)
- Accessible keyboard navigation

```tsx
import PollWidget from '@/components/PollWidget';

const poll = {
  id: 'poll_123',
  question_en: 'Who will win the match?',
  question_ml: 'ആരാണ് മാച്ച് ജയിക്കുക?',
  description_en: 'Predict the winner of today\'s match',
  description_ml: 'ഇന്നത്തെ മാച്ചിന്റെ വിജയി പ്രവചിക്കുക',
  options: [
    { id: 'opt_1', text_en: 'Team A', text_ml: 'ടീം A', votes: 120 },
    { id: 'opt_2', text_en: 'Team B', text_ml: 'ടീം B', votes: 85 },
    { id: 'opt_3', text_en: 'Draw', text_ml: 'സമനില', votes: 45 },
  ],
  total_votes: 250,
  closes_at: '2025-01-20T18:00:00Z',
  is_closed: false,
  user_vote: null, // or 'opt_1' if user already voted
};

const handleVote = async (pollId: string, optionId: string) => {
  const response = await fetch(`/api/polls/${pollId}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ option_id: optionId }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to submit vote');
  }
};

// Interactive voting widget
<PollWidget poll={poll} onVote={handleVote} />

// Results-only view
<PollWidget poll={poll} showResults />
```

### PollCard

Preview card for poll listings.

**Features:**
- Compact poll preview with status badges
- Shows vote count and option count
- Type labels (Match Prediction, Player of Match, etc.)
- Closing date display
- Automatic linking to poll detail page

```tsx
import PollCard from '@/components/PollCard';

const pollData = {
  id: 'poll_456',
  question_en: 'Best player of the week?',
  question_ml: 'ആഴ്ചയിലെ മികച്ച കളിക്കാരൻ?',
  description_en: 'Vote for the best performing player',
  description_ml: 'മികച്ച പ്രകടനം കാഴ്ചവെച്ച കളിക്കാരന് വോട്ട് ചെയ്യുക',
  poll_type: 'weekly_top_player',
  total_votes: 342,
  closes_at: '2025-01-22T23:59:59Z',
  is_closed: false,
  options_count: 5,
  user_voted: true,
};

// Card with link to poll page
<PollCard poll={pollData} />

// Card with custom click handler
<PollCard poll={pollData} showLink={false} onClick={() => openModal(pollData)} />
```

## Using Language Context

Access and control language anywhere in your app:

```tsx
'use client';

import { useLanguage } from '@/contexts/LanguageContext';

export default function MyComponent() {
  const { language, setLanguage, toggleLanguage } = useLanguage();

  return (
    <div>
      <p>Current language: {language === 'en' ? 'English' : 'Malayalam'}</p>
      
      <button onClick={() => setLanguage('en')}>English</button>
      <button onClick={() => setLanguage('ml')}>മലയാളം</button>
      <button onClick={toggleLanguage}>Toggle</button>
      
      {/* Display content based on language */}
      {language === 'en' ? (
        <p>Welcome to our tournament</p>
      ) : (
        <p>ഞങ്ങളുടെ ടൂർണമെന്റിലേക്ക് സ്വാഗതം</p>
      )}
    </div>
  );
}
```

## Example Layouts

### News Feed Page

```tsx
'use client';

import { useState, useEffect } from 'react';
import LanguageToggle from '@/components/LanguageToggle';
import NewsCard from '@/components/NewsCard';

export default function NewsFeed() {
  const [news, setNews] = useState([]);

  useEffect(() => {
    fetch('/api/news?limit=20')
      .then(res => res.json())
      .then(data => setNews(data.news));
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Tournament News</h1>
        <LanguageToggle />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {news.map(item => (
          <NewsCard key={item.id} news={item} />
        ))}
      </div>
    </div>
  );
}
```

### Polls Page

```tsx
'use client';

import { useState, useEffect } from 'react';
import LanguageToggle from '@/components/LanguageToggle';
import PollCard from '@/components/PollCard';
import PollWidget from '@/components/PollWidget';

export default function PollsPage() {
  const [polls, setPolls] = useState([]);
  const [activePoll, setActivePoll] = useState(null);

  useEffect(() => {
    fetch('/api/polls?status=active')
      .then(res => res.json())
      .then(data => setPolls(data.polls));
  }, []);

  const handleVote = async (pollId, optionId) => {
    const response = await fetch(`/api/polls/${pollId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ option_id: optionId }),
    });
    
    if (response.ok) {
      // Refresh polls
      const data = await fetch('/api/polls?status=active').then(r => r.json());
      setPolls(data.polls);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Active Polls</h1>
        <LanguageToggle variant="button" />
      </div>
      
      {activePoll ? (
        <div className="mb-8">
          <button 
            onClick={() => setActivePoll(null)}
            className="mb-4 text-blue-600 hover:underline"
          >
            ← Back to all polls
          </button>
          <PollWidget poll={activePoll} onVote={handleVote} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {polls.map(poll => (
            <PollCard 
              key={poll.id} 
              poll={poll}
              showLink={false}
              onClick={() => setActivePoll(poll)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

## Styling Notes

All components use Tailwind CSS classes and are fully responsive. You can customize appearance by:

1. **Adding custom className**: All components accept a `className` prop
2. **Modifying Tailwind config**: Update colors, fonts, etc. in `tailwind.config.js`
3. **Component variants**: LanguageToggle offers multiple built-in variants

## Accessibility

All components follow accessibility best practices:

- Semantic HTML elements
- ARIA labels and roles
- Keyboard navigation support
- Focus indicators
- Screen reader friendly
- Proper heading hierarchy
