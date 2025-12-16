# Leaderboard Share Feature

## Overview
Added a feature to share tournament leaderboards as beautiful, shareable images with team logos and professional UI/UX.

## Features

### 1. **Image Generation**
- Converts the current tournament standings into a high-quality PNG image
- Includes team logos, rankings, and key statistics
- Professional gradient design with medals for top 3 teams
- Shows top 10 teams in the leaderboard

### 2. **Share Options**
- **Download Image**: Save the leaderboard as a PNG file
- **Share Image**: Use native device sharing (mobile/desktop)
- **Preview**: View the image before downloading/sharing

### 3. **Design Elements**
- 🥇 Gold medal for 1st place
- 🥈 Silver medal for 2nd place  
- 🥉 Bronze medal for 3rd place
- Team logos displayed prominently
- Gradient backgrounds for top 3 positions
- Tournament name and format displayed
- Generation timestamp included

## Usage

### For Committee Admins
1. Navigate to: `/dashboard/committee/team-management/team-standings`
2. Select a tournament from the dropdown
3. Look for the "Share Leaderboard" section (purple gradient box)
4. Click "Preview Image" to see how it will look
5. Click "Download Image" to save locally
6. Click "Share Image" to share via native sharing options

## Technical Implementation

### Components
- **ShareableLeaderboard.tsx**: Main component for image generation
- **TournamentStandings.tsx**: Updated to include share feature
- **LeagueStandingsTable.tsx**: Existing standings display

### Libraries Used
- `html-to-image`: Converts HTML/React components to PNG images
- Native Web Share API for sharing functionality

### API Updates
- Updated `/api/tournaments/[id]/standings` to return `tournament_name`

## Image Specifications
- **Format**: PNG
- **Quality**: High (pixelRatio: 2)
- **Width**: 800px (responsive)
- **Background**: White
- **File naming**: `{tournament-name}-leaderboard.png`

## Browser Compatibility
- **Download**: Works on all modern browsers
- **Share**: Falls back to download if Web Share API is not available
- **Image Generation**: Requires modern browser with Canvas API support

## Future Enhancements
- Add customization options (colors, layout)
- Include more statistics (recent form, head-to-head)
- Support for group stage standings
- Social media optimized dimensions
- Watermark/branding options
