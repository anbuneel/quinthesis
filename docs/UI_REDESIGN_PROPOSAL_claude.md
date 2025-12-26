# AI Council UI Redesign Proposal

**Author**: Claude (Opus 4.5)
**Date**: December 26, 2025
**Document Suffix**: claude

---

## Original Prompt

> The UI design and UX for this AI council app is terrible. Understand the purpose of this app and the current implementation. Use the frontend design skill to re-invent the UI. You have full freedom to change the color theme, typography, and the UI layout. Give me a proposal in writing and save it in the docs folder. Add "claude" suffix, author attribution and this prompt in the document. Ask me for any clarifications.

---

## Executive Summary

This proposal reimagines the AI Council UI with a singular focus: **get users to the answer fast**. The current implementation suffers from visual clutter, competing information hierarchies, and excessive navigation. The new design adopts an **Answer-First** philosophy with progressive disclosure, sleek dark mode aesthetics, and a card-based layout that eliminates scrolling friction.

---

## Quick Reference

### Theme: Sleek Dark Mode
```
Background: #0A0A0B (pure near-black)
Cards:      #111113 (subtle elevation)
Accent:     #6366F1 (indigo/violet)
```
Inspired by Linear, Vercel, Raycast - premium, modern feel.

### Layout Changes
- **No persistent sidebar** → Slide-out drawer for conversations
- **Answer card as hero** → Immediately visible, green success badge
- **Inline accordion** → "View Deliberation" expands in-place below answer

### Conversation Management
- Delete button appears on hover (desktop) or swipe-left (mobile)
- Inline confirmation before delete
- Search and organize preserved

### Mobile Responsiveness

| Screen | Behavior |
|--------|----------|
| Mobile (<640px) | Full-screen drawer, swipe gestures, long-press delete, sticky question |
| Tablet (640-1024px) | Half-screen drawer, 2-column expert cards |
| Desktop (≥1024px) | 320px drawer, max-width 800px content |
| Large (≥1280px) | 900px content, optional side-by-side |

### Touch Gestures (Mobile)
- Swipe left → reveal delete
- Swipe right on drawer → close
- Long-press → context menu
- Tap question → expand/collapse

---

## Current Problems

| Issue | Impact |
|-------|--------|
| Tab-based stage navigation | Requires clicking to find information |
| Overlapping question/answer areas | Confusion about what you're reading |
| "Modern Chamber" dark theme | Heavy, dated, bureaucratic feel |
| 260px fixed sidebar always visible | Wastes horizontal space on content |
| Stage 1/2/3 given equal visual weight | Buries the actual answer |
| Nested expandable sections | Scroll depth increases, context lost |

---

## Design Philosophy

### Answer-First Hierarchy

The synthesized answer (Stage 3) is why users are here. Everything else is supporting evidence. The new design treats:

- **Stage 3** as the hero — large, prominent, immediately visible
- **Stage 1 & 2** as footnotes — collapsed by default, expandable for those who want transparency
- **The Question** as context — compact, pinned, never competing with the answer

### Sleek Dark Mode Aesthetic

Moving away from the heavy "deliberation chamber" metaphor toward a modern dark interface inspired by Linear, Vercel, and Raycast:

- **Premium Feel** — Deep blacks with subtle elevation, not muddy grays
- **Focused** — High contrast text, minimal visual noise
- **Modern** — Violet/indigo accents instead of gold, feels like a tool not a courtroom
- **Efficient** — Every element serves a purpose, generous spacing for readability

---

## New Design System

### Color Palette (Sleek Dark Mode)

Inspired by Linear, Vercel, and Raycast - modern dark interfaces that feel premium and reduce eye strain.

```css
:root {
  /* Base - Deep, layered blacks */
  --bg-primary: #0A0A0B;         /* Main background - near black */
  --bg-secondary: #111113;       /* Cards, elevated surfaces */
  --bg-tertiary: #1A1A1D;        /* Hover states, subtle highlights */
  --bg-elevated: #222225;        /* Modals, dropdowns, popovers */

  /* Text - High contrast, legible */
  --text-primary: #FAFAFA;       /* Primary content - almost white */
  --text-secondary: #A1A1A6;     /* Supporting text - soft gray */
  --text-muted: #6B6B70;         /* Timestamps, metadata */

  /* Accents */
  --accent-primary: #6366F1;     /* Primary actions - indigo/violet */
  --accent-primary-hover: #818CF8;
  --accent-success: #22C55E;     /* Positive states, completed */
  --accent-warning: #F59E0B;     /* Rankings, caution */
  --accent-danger: #EF4444;      /* Delete, errors */

  /* Borders & Shadows */
  --border-default: #27272A;     /* Subtle borders */
  --border-hover: #3F3F46;       /* Hover state borders */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.4);
  --shadow-lg: 0 12px 24px rgba(0,0,0,0.5);
  --shadow-glow: 0 0 20px rgba(99,102,241,0.15);  /* Accent glow */

  /* Gradients */
  --gradient-card: linear-gradient(180deg, #111113 0%, #0A0A0B 100%);
  --gradient-header: linear-gradient(90deg, #6366F1 0%, #8B5CF6 100%);
}
```

**Rationale**: Deep blacks with violet/indigo accents create a premium, focused experience. High text contrast ensures readability. Layered elevation through subtle background shifts (not borders) creates depth.

### Typography

```css
:root {
  --font-primary: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Scale */
  --text-xs: 0.75rem;    /* 12px - metadata */
  --text-sm: 0.875rem;   /* 14px - secondary content */
  --text-base: 1rem;     /* 16px - body text */
  --text-lg: 1.125rem;   /* 18px - emphasis */
  --text-xl: 1.25rem;    /* 20px - section headers */
  --text-2xl: 1.5rem;    /* 24px - page titles */

  /* Weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
}
```

**Rationale**: Single font family (Inter) maintains consistency. Hierarchy established through size and weight, not font changes. JetBrains Mono reserved for code/technical content.

---

## Layout Architecture

### Desktop (≥1024px)

```
┌─────────────────────────────────────────────────────────────────┐
│  [Logo]    Search conversations...              [+ New]  [≡]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ QUESTION                                                 │   │
│  │ "What are the implications of quantum computing..."     │   │
│  │ Asked 2 hours ago                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ✓ ANSWER                                    Synthesized  │   │
│  │                                                          │   │
│  │ Quantum computing represents a paradigm shift...         │   │
│  │                                                          │   │
│  │ [Large, readable answer content with full markdown]      │   │
│  │                                                          │   │
│  │ ──────────────────────────────────────────────────────   │   │
│  │ Based on synthesis by Gemini 3 Pro                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ▶ View Deliberation Process (4 experts, 3 reviewers)    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Layout Decisions

1. **No persistent sidebar** — Conversations accessed via header menu/modal
2. **Question as compact header** — Clear context, never overlaps answer
3. **Answer as hero card** — Dominant visual, immediate readability
4. **Deliberation collapsed** — Single expandable row for transparency

### Conversation List (Slide-out Drawer)

Instead of a persistent sidebar, conversations are accessed via a slide-out drawer (from left):

```
┌──────────────────────────────────────┐
│ Conversations                     ✕  │
├──────────────────────────────────────┤
│ ┌────────────────────────────────┐   │
│ │ 🔍 Search conversations...     │   │
│ └────────────────────────────────┘   │
├──────────────────────────────────────┤
│ ┌────────────────────────────────┐   │
│ │ ● Quantum computing implic...  │   │
│ │   4 experts · 2h ago      [🗑] │   │
│ └────────────────────────────────┘   │
│ ┌────────────────────────────────┐   │
│ │ ○ Best practices for React...  │   │
│ │   3 experts · Yesterday   [🗑] │   │
│ └────────────────────────────────┘   │
│ ┌────────────────────────────────┐   │
│ │ ○ Compare MongoDB vs Postgres  │   │
│ │   5 experts · 3 days ago  [🗑] │   │
│ └────────────────────────────────┘   │
└──────────────────────────────────────┘
```

**Conversation Item Features**:
- Active indicator: filled circle (●) for current, empty (○) for others
- Title truncated with ellipsis
- Meta info: expert count + relative time
- **Delete button**: Hidden by default, appears on hover (right side)
- Delete confirmation: Inline "Delete?" / "Cancel" before removal
- Hover state: `--bg-tertiary` background
- Active state: `--accent-primary` left border (2px)

**Delete UX Flow**:
1. Hover row → trash icon appears (opacity fade in)
2. Click trash → row transforms to confirmation: "Delete this conversation?" [Cancel] [Delete]
3. Click Delete → row fades out, conversation removed
4. Click Cancel → returns to normal state

---

## Component Redesign

### 1. Question Card (Compact)

```jsx
<div className="question-card">
  <div className="question-label">QUESTION</div>
  <p className="question-text">{content}</p>
  <div className="question-meta">
    Asked {timeAgo} · {modelCount} experts consulted
  </div>
</div>
```

**Styling**:
- Background: `--bg-tertiary` (#1A1A1D)
- Label: `--text-muted` uppercase, letter-spacing 0.05em
- Question text: `--text-primary`, font-weight 500
- Meta: `--text-muted`, smaller size
- Compact padding (16px), subtle 1px border (`--border-default`)
- Border-radius: 8px

### 2. Answer Card (Hero)

```jsx
<div className="answer-card">
  <div className="answer-header">
    <span className="answer-badge">✓ ANSWER</span>
    <span className="answer-source">Synthesized</span>
  </div>
  <div className="answer-content">
    <ReactMarkdown>{content}</ReactMarkdown>
  </div>
  <div className="answer-footer">
    Based on synthesis by {leadModel}
  </div>
</div>
```

**Styling**:
- Background: `--bg-secondary` (#111113) with `--shadow-md`
- Subtle glow effect: `--shadow-glow` (indigo glow on hover)
- Badge: `--accent-success` background, dark text, pill shape
- Content: `--text-primary`, line-height 1.75, generous padding
- Footer: `--text-muted` with lead model name
- Left border: 2px `--accent-success` (#22C55E)
- Border-radius: 12px

### 3. Deliberation Accordion

```jsx
<details className="deliberation-panel">
  <summary>
    <span className="deliberation-toggle">▶</span>
    <span>View Deliberation Process</span>
    <span className="deliberation-stats">
      {expertCount} experts, {reviewerCount} reviewers
    </span>
  </summary>
  <div className="deliberation-content">
    {/* Stage 1 & 2 content here */}
  </div>
</details>
```

**Styling**:
- Native `<details>` for accessibility
- Subtle border, no background
- Arrow rotates on expand (CSS transform)
- Content fades in smoothly

### 4. Expert Responses (Inside Accordion)

```jsx
<div className="expert-grid">
  {responses.map((response, i) => (
    <div className="expert-card" key={i}>
      <div className="expert-header">
        <span className="expert-badge">{letters[i]}</span>
        <span className="expert-name">{response.model}</span>
        <span className="expert-rank">#{response.rank}</span>
      </div>
      <div className="expert-content">
        <ReactMarkdown>{response.content}</ReactMarkdown>
      </div>
    </div>
  ))}
</div>
```

**Styling**:
- Tabbed navigation for switching between expert responses
- Full content always displayed (no preview/expand toggle)
- Rank badge shows final position (gold/silver/bronze for top 3)

### 5. Rankings Summary (Inside Accordion)

```jsx
<div className="rankings-bar">
  <div className="rankings-title">Expert Rankings</div>
  <div className="rankings-list">
    {rankings.map((r, i) => (
      <div className="ranking-chip" key={i}>
        <span className="rank-position">{i + 1}</span>
        <span className="rank-model">{r.model}</span>
        <span className="rank-score">{r.avgScore}</span>
      </div>
    ))}
  </div>
</div>
```

**Styling**:
- Horizontal scrollable chip layout
- Position numbers with subtle background
- Compact, fits in single row

---

## Interaction Patterns

### New Conversation Flow

1. Click **[+ New]** button in header
2. Minimal modal appears with:
   - Textarea for question
   - "Quick settings" expandable for model selection (defaults pre-selected)
3. Submit → Immediate transition to answer view with streaming

### Streaming Experience

During deliberation:

```
┌─────────────────────────────────────────────────────────────┐
│ QUESTION                                                    │
│ "What are the implications..."                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ◐ GENERATING ANSWER                                         │
│                                                              │
│   Consulting experts...  ████████░░░░░░░░  4 of 4           │
│   Peer review...         ████░░░░░░░░░░░░  2 of 4           │
│   Synthesizing...        ░░░░░░░░░░░░░░░░  Waiting          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Key Points**:
- Clear progress indication without blocking interaction
- No tab switching required
- Answer card replaces progress card when complete

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `Cmd/Ctrl + K` | Open search / conversation list |
| `Cmd/Ctrl + N` | New conversation |
| `Esc` | Close modals / panels |
| `Enter` | In accordion, toggle expand |

---

## Responsive Behavior

### Breakpoints

```css
--breakpoint-sm: 640px;   /* Mobile landscape */
--breakpoint-md: 768px;   /* Tablet */
--breakpoint-lg: 1024px;  /* Desktop */
--breakpoint-xl: 1280px;  /* Large desktop */
```

### Mobile (< 640px)

**Layout**:
- Single column, edge-to-edge cards
- Reduced horizontal padding (12px)
- Header: Logo + hamburger menu only (hide search/new button text)

**Question Card**:
- Sticky at top during scroll
- Collapsed by default (show first 100 chars)
- Tap to expand full question
- Height: max 80px when collapsed

**Answer Card**:
- Full width, no horizontal margins
- Larger touch targets for interactive elements
- "Based on synthesis" footer wraps to 2 lines if needed

**Deliberation Accordion**:
- Full width, sits below answer
- Expert cards: Single column, stacked vertically
- Rankings: Horizontal scroll with snap points

**Conversation Drawer**:
- Full-screen overlay (100vw × 100vh)
- Swipe right to close gesture
- Delete: Long-press to reveal delete option (mobile pattern)
- Large touch targets (min 48px height per row)

**New Conversation Modal**:
- Full-screen on mobile
- Model selection: 2-column grid
- Keyboard avoidance when typing question

### Tablet (640px - 1024px)

**Layout**:
- Centered content area (max-width: 720px)
- Comfortable padding (24px)
- Header shows all elements

**Cards**:
- Same as desktop but slightly reduced padding
- Expert cards: 2-column grid maintained

**Conversation Drawer**:
- Half-screen width (50vw)
- Slides from left with backdrop blur
- Delete button visible on hover (like desktop)

### Desktop (≥ 1024px)

**Layout**:
- Centered content (max-width: 800px)
- Generous padding (32px)
- Full header with search, new button, menu

**Expert Cards**:
- 2-column grid with gap
- Hover states with glow effect

**Conversation Drawer**:
- 320px fixed width
- Slides from left
- Backdrop dims main content

### Large Desktop (≥ 1280px)

**Layout**:
- Max-width increases to 900px
- Optional: Side-by-side view for deliberation details

---

## Touch & Gesture Support (Mobile)

| Gesture | Action |
|---------|--------|
| Swipe left on conversation | Reveal delete button |
| Swipe right on drawer | Close drawer |
| Long-press conversation | Show context menu (delete, rename) |
| Pull down (at top) | Refresh conversation list |
| Tap question card | Expand/collapse |

---

## Animation & Transitions

All transitions use `cubic-bezier(0.4, 0, 0.2, 1)` (ease-out) for smooth, premium feel.

```css
--transition-fast: 150ms;    /* Hover states, small UI */
--transition-normal: 200ms;  /* Accordions, cards */
--transition-slow: 300ms;    /* Drawers, modals */
--transition-spring: 400ms;  /* Complex animations */
```

**Key Animations**:
- **Drawer open**: Slide + backdrop fade (300ms)
- **Card appear**: Fade up from 10px below (200ms)
- **Accordion expand**: Height + opacity (200ms)
- **Delete fade**: Opacity to 0 + height collapse (200ms)
- **Progress bars**: Smooth width transitions during streaming
- **Skeleton loading**: Subtle pulse animation (1.5s loop)

---

## Transition Plan

### Phase 1: Foundation
- Implement new color palette and typography
- Replace dark theme with light professional theme
- Remove unused components (ProgressOrbit, RightPanel)

### Phase 2: Layout Restructure
- Remove persistent sidebar
- Implement header with conversation access
- Restructure main content area

### Phase 3: Component Rebuild
- New question card (compact)
- New answer card (hero)
- Deliberation accordion
- Expert response cards

### Phase 4: Polish
- Streaming progress experience
- Keyboard navigation
- Animations and transitions
- Mobile optimization

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Time to answer visibility | 2-3 clicks | 0 clicks |
| Scroll depth to see answer | 50%+ | 0% (above fold) |
| Visual hierarchy clarity | Poor | Excellent |
| Mobile usability | Fair | Excellent |

---

## Summary

This redesign transforms AI Council from a cluttered, navigation-heavy interface into a sleek, answer-first experience. By:

1. **Elevating the answer** to hero status (immediately visible, no clicks required)
2. **Collapsing deliberation** into inline accordion (transparency on demand)
3. **Adopting sleek dark mode** (Linear/Vercel aesthetic, premium feel)
4. **Replacing sidebar with drawer** (full-width content, conversation access preserved)
5. **Preserving conversation management** (delete, search, organize)
6. **Mobile-first responsive design** (touch gestures, full-screen modals, swipe actions)

Users will get what they came for — the synthesized answer — immediately, with full transparency and conversation management available on demand.

---

## Appendix: Before/After Comparison

### Before (Current)
- Dark "chamber" theme with gold accents (heavy, bureaucratic)
- Persistent 260px sidebar (wastes content space)
- Tab navigation: Final Answer / Stage 1 / Stage 2 (requires clicks)
- Overlapping question/answer areas (confusing hierarchy)
- Multiple scrollable nested sections (deep scroll depth)
- DM Serif Display + Inter fonts (inconsistent)
- Mobile: Drawer works but cramped

### After (Proposed)
- Sleek dark mode with indigo/violet accents (modern, premium)
- Slide-out drawer for conversations (full-width content)
- Answer-first card with inline deliberation accordion (0 clicks to answer)
- Clear question → answer hierarchy (no overlap)
- Single scroll with progressive disclosure (minimal depth)
- Inter only (consistent, clean)
- Mobile: Full-screen overlays, swipe gestures, touch-optimized

### Visual Comparison

**Current Theme**:
```
Background: #050713 (near-black with blue tint)
Cards: #141829 (dark navy)
Accent: #D4AF37 (gold)
Feel: Formal, heavy, "deliberation chamber"
```

**New Theme**:
```
Background: #0A0A0B (pure near-black)
Cards: #111113 (subtle elevation)
Accent: #6366F1 (indigo/violet)
Feel: Modern, sleek, "premium tool"
```

---

## Next Steps

After approval of this proposal:

1. **Restart Claude Code** to load the `frontend-design` plugin
2. **Generate detailed mockups** using the design skill (if needed)
3. **Implement Phase 1** (color palette + typography)
4. **Iterate** on component designs based on user feedback

---

*End of proposal*
