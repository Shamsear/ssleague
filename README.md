# Football Auction - Next.js Application

A modern, Vision OS-inspired football auction platform built with Next.js, TypeScript, and Tailwind CSS.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager

### Installation & Running

```bash
# Navigate to project directory
cd "C:\Drive d\SS\nosqltest\nextjs-project"

# Install dependencies (already done)
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## 📁 Project Structure

```
nextjs-project/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Landing page (/)
│   └── globals.css        # Global styles
├── components/            # React components
│   └── home/             # Landing page components
│       ├── Hero.tsx
│       ├── Features.tsx
│       ├── HowItWorks.tsx
│       ├── CallToAction.tsx
│       └── SmoothScroll.tsx
├── public/               # Static assets
├── tailwind.config.js    # Tailwind configuration
└── tsconfig.json        # TypeScript configuration
```

## 🎨 Design System

### Colors
- **Primary**: `#0066FF` - Main brand color
- **Secondary**: `#9580FF` - Accent color
- **Accent**: `#FF2D55` - Call-to-action
- **Golden**: `#D4AF37` - Admin/premium features

### Components

#### Custom Classes
- `.glass` - Glass morphism effect
- `.gradient-text` - Gradient text effect
- `.hover-float` - Floating hover animation
- `.vision-button` - Vision OS style button

#### Usage Example
```tsx
<div className="glass p-8 rounded-3xl hover-float">
  <h2 className="gradient-text">Title</h2>
  <button className="vision-button">Click me</button>
</div>
```

## 📄 Pages Completed

✅ **Landing Page** (`/`)
- Hero section with CTAs
- Features showcase (3 cards)
- How It Works (4 steps)
- Call to Action section
- Smooth scroll functionality

## 🔄 Next Pages to Build

### Phase 2: Layout & Navigation
- [ ] Root layout with navbar
- [ ] Footer component
- [ ] Mobile navigation

### Phase 3: Authentication
- [ ] Login page (`/login`)
- [ ] Register page (`/register`)
- [ ] Password reset

### Phase 4: Dashboard
- [ ] User dashboard
- [ ] Admin dashboard
- [ ] Team management

### Phase 5: Features
- [ ] Player listings
- [ ] Auction interface
- [ ] Team profiles
- [ ] Bidding system

## 🛠️ Development Commands

```bash
# Development server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## 📝 Conversion Notes

This project is being systematically converted from a Flask/Jinja2 application. 

**Original Source**: `base.html` and `index.html` in the parent directory

**Conversion Strategy**:
1. Component-based architecture
2. TypeScript for type safety
3. Tailwind for styling (maintaining original design)
4. Next.js App Router for routing
5. Progressive page-by-page conversion

## 🎯 Design Philosophy

- **Vision OS Inspired**: Glass morphism, smooth animations
- **Mobile-First**: Responsive from the ground up
- **Performance**: Optimized components and lazy loading
- **Accessibility**: Semantic HTML and ARIA labels
- **Maintainability**: Clean component separation

## 📚 Documentation

- `CONVERSION_PLAN.md` - Overall conversion strategy and roadmap
- `COMPLETED.md` - Detailed list of completed work
- `README.md` - This file

## 🤝 Contributing

When adding new pages:
1. Create component in appropriate directory
2. Follow TypeScript conventions
3. Use existing design system classes
4. Update documentation
5. Test responsiveness

## 📞 Support

For questions or issues during conversion, refer to:
- Next.js documentation: https://nextjs.org/docs
- Tailwind CSS: https://tailwindcss.com/docs
- TypeScript: https://www.typescriptlang.org/docs

---

**Current Version**: Phase 1 Complete  
**Last Updated**: 2025-10-02
