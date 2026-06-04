# Table-to-Image Generation & Sharing

## Overview
This document describes how the **admin** and **team** pages generate an image of a table (leaderboard, fixture, etc.) that can be downloaded or shared via the native **Web Share API**. The implementation relies on the **`html-to-image`** library and a hidden DOM element that mimics the on-screen table.

---

## Key Components
| Component | Path | Purpose |
|-----------|------|---------|
| **`ShareableLeaderboard.tsx`** | `components/tournament/ShareableLeaderboard.tsx` | Renders a hidden version of the leaderboard and triggers `toPng` to capture it. |
| **`FixtureShareButton.tsx`** | `components/FixtureShareButton.tsx` | Wraps the share button UI, calls the image‑generation helper, then either downloads or calls `navigator.share`. |
| **`html-to-image`** | npm package | Converts a DOM node to a PNG data URL (`toPng`) with optional width/height scaling. |
| **`styles/hidden-share.scss`** | `styles/hidden-share.scss` | CSS class that hides the off‑screen rendering while keeping layout intact (`position: absolute; left: -9999px;`). |
---

## Rendering a Hidden Table
```tsx
// Example snippet from ShareableLeaderboard.tsx
<div className="hidden-share" ref={shareRef}>
  <LeaderboardTable data={data} />
</div>
```
* `shareRef` points to the hidden element.
* The component is **not** displayed (`display: none` would break layout calculations, so we use `position: absolute` off‑screen).
* The table is rendered at a fixed width (e.g., `1200px`) to guarantee a consistent image size regardless of screen width.

---

## Capturing the Image
```ts
import { toPng } from 'html-to-image';

export async function captureTableAsPng(ref: HTMLDivElement): Promise<string> {
  // Ensure the element is fully painted before capture
  const dataUrl = await toPng(ref, { cacheBust: true, width: 1200, quality: 1 });
  return dataUrl; // Base64‑encoded PNG
}
```
* `cacheBust` forces a repaint.
* `width` defines the output resolution.
* The function returns a **data URL** ready for download or sharing.

---

## Download vs. Share
```tsx
const dataUrl = await captureTableAsPng(shareRef.current!);

if (navigator.canShare && navigator.canShare({ files: [blob] })) {
  // iOS/Android native share sheet
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], 'leaderboard.png', { type: 'image/png' });
  await navigator.share({ files: [file], title: 'Leaderboard' });
} else {
  // Fallback – trigger a download
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = 'leaderboard.png';
  link.click();
}
```
* **Web Share API** is used when supported (mobile browsers, PWA installed).
* A **fallback download** works on all desktop browsers.

---

## Integration Points
1. **Admin → Teams Page** – Both pages import the same `captureTableAsPng` helper, keeping the logic DRY.
2. **Button UI** – `FixtureShareButton` renders an icon that calls the helper on click.
3. **Error Handling** – Any exceptions are caught and displayed via a toast notification, ensuring the UI remains responsive.

---

## Styling for Consistency
```scss
/* hidden-share.scss */
.hidden-share {
  position: absolute;
  left: -9999px;
  top: 0;
  width: 1200px; // matches the capture width
  // Ensure fonts and colors match the visible table
  font-family: var(--font-sans);
}
```
* The hidden element uses the same CSS variables as the visible component, guaranteeing pixel‑perfect screenshots.

---

## Accessibility & Performance
* **Lazy Loading** – The hidden element is only rendered when the share button is pressed.
* **Memory Management** – The generated PNG blob is released after sharing/downloading.
* **Screen Reader** – The hidden div is marked with `aria-hidden="true"` so it does not interfere with accessibility trees.

---

## Future Enhancements
* **SVG Export** – Provide an SVG version for infinite scaling.
* **Batch Export** – Allow multiple tables to be merged into a single image.
* **Server‑Side Rendering** – For very large tables, offload rendering to a serverless function.

---

*This markdown can be placed in any documentation repository (e.g., `docs/image_sharing_implementation.md`) and linked from the developer onboarding guide.*
