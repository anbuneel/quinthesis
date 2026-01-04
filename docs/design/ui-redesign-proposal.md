# Quinthesis UI Redesign Proposal: "The Paper of Record"

**Author**: Claude (Opus 4.5)
**Date**: December 26, 2025
**Document Suffix**: claude

---

## Original Prompt

> Use the frontend design skill to come up with a new UI design concept for AI council. This app provides synthesized knowledge for questions asked of the AI council using the power of multiple LLMs. The UI design and UX for this AI council app is terrible. Understand the purpose of this app and the current implementation. You have full freedom to change the color theme, typography, and the UI layout to come up with something unique that's not standard SaaS and typical UI designs. Review the docs\UI_REDESIGN_PROPOSAL_claude.md document as well. I am not convinced that proposal hits the mark. Give me your proposal in writing and save it in the docs folder. Add "claude" suffix, author attribution and this prompt in the document. Ask me for any clarifications. Additionally, this app should be responsive and should work on mobile.

---

## Executive Summary

The previous proposal missed the mark by copying Linear/Vercel's aesthetic - essentially replacing one dark SaaS look with another. This proposal takes a radically different approach: **"The Paper of Record"** - treating Quinthesis as a prestigious editorial publication rather than a software tool.

Think: *The Economist* meets *The New York Times* meets a scholarly journal. Warm, paper-textured backgrounds. Rich typographic hierarchy. Authoritative yet approachable. The synthesized answer presented like a front-page headline, with deliberation details available like diving into the full article.

This isn't just visual differentiation - it's a conceptual reframe that makes the app **memorable** and reinforces the metaphor of expert voices coming together to form a considered opinion.

---

## The Core Concept: Editorial Authority

### Why This Works

1. **Metaphor Alignment**: A "council" issuing opinions maps perfectly to editorial boards and op-ed sections. The final answer is "the position of the council" - like a newspaper editorial.

2. **Natural Hierarchy**: Print publications have perfected information hierarchy over centuries. Headlines draw the eye. Subheads contextualize. Body text provides depth. This maps directly to Stage 3 → Stage 2 → Stage 1.

3. **Distinctiveness**: Zero chance of confusion with any other SaaS tool. Users will remember "the app that looks like The Economist."

4. **Trust & Authority**: Editorial design conventions signal thoughtfulness, consideration, and expertise - exactly what a council of AI experts should convey.

5. **Warmth**: Light, warm backgrounds reduce eye strain and feel more human than the cold dark themes dominating AI tools.

---

## Color Palette: Ink & Paper

```css
:root {
  /* Paper Tones - Warm, textured base */
  --paper-cream: #FAF8F5;        /* Primary background - warm white */
  --paper-aged: #F5F0E8;          /* Cards, elevated surfaces - slight yellow */
  --paper-shadow: #EDE8DE;        /* Hover states, borders */
  --paper-dark: #E8E2D6;          /* Pressed states */

  /* Ink Tones - Rich, readable blacks */
  --ink-black: #1A1614;           /* Primary text - warm black */
  --ink-dark: #2D2926;            /* Headers, emphasis */
  --ink-medium: #5C5652;          /* Secondary text */
  --ink-light: #8A8580;           /* Captions, metadata */
  --ink-faint: #B8B4AF;           /* Disabled, borders */

  /* Editorial Accents */
  --accent-vermillion: #C43D2E;   /* Primary accent - classic editorial red */
  --accent-vermillion-light: #E85A4A;  /* Hover states */
  --accent-vermillion-dark: #9A2E22;   /* Active states */

  --accent-forest: #2D5A3D;       /* Secondary accent - rich green */
  --accent-navy: #1E3A5F;         /* Tertiary - for variety */
  --accent-ochre: #C4943D;        /* Warning, rankings */

  /* Status Colors */
  --status-complete: var(--accent-forest);
  --status-pending: var(--accent-ochre);
  --status-error: var(--accent-vermillion);

  /* Shadows - Subtle, print-inspired */
  --shadow-sm: 0 1px 3px rgba(26, 22, 20, 0.08);
  --shadow-md: 0 4px 12px rgba(26, 22, 20, 0.12);
  --shadow-lg: 0 8px 24px rgba(26, 22, 20, 0.16);
  --shadow-inset: inset 0 1px 2px rgba(26, 22, 20, 0.06);

  /* Paper Texture Overlay (optional, subtle) */
  --texture-grain: url("data:image/svg+xml,..."); /* Subtle noise texture */
}
```

### Color Rationale

- **Warm Paper Base**: FAF8F5 is a barely-there cream that feels like quality paper stock. Reduces harshness of pure white while maintaining readability.
- **Vermillion Accent**: Classic editorial red (think *The Economist* masthead). Used sparingly for maximum impact.
- **Forest Green**: For positive states - completed deliberations, success indicators. Evokes ink stamps of approval.
- **Rich Blacks**: Warm undertones (#1A1614 vs pure #000000) create depth without harshness.

---

## Typography: The Heart of Editorial Design

```css
:root {
  /* Display Font - Commanding headlines */
  --font-display: 'Playfair Display', 'Georgia', serif;

  /* Body Font - Readable at length */
  --font-body: 'Source Serif 4', 'Charter', 'Georgia', serif;

  /* UI Font - Clean interface elements */
  --font-ui: 'IBM Plex Sans', 'SF Pro Display', system-ui, sans-serif;

  /* Mono Font - Technical content */
  --font-mono: 'IBM Plex Mono', 'JetBrains Mono', monospace;

  /* Type Scale - Based on perfect fourth (1.333) */
  --text-xs: 0.75rem;      /* 12px - micro labels */
  --text-sm: 0.875rem;     /* 14px - captions, metadata */
  --text-base: 1rem;       /* 16px - body text */
  --text-lg: 1.125rem;     /* 18px - emphasized body */
  --text-xl: 1.333rem;     /* ~21px - section heads */
  --text-2xl: 1.777rem;    /* ~28px - subheadings */
  --text-3xl: 2.369rem;    /* ~38px - page titles */
  --text-4xl: 3.157rem;    /* ~50px - hero headlines */

  /* Line Heights */
  --leading-tight: 1.2;    /* Headlines */
  --leading-snug: 1.4;     /* Subheads */
  --leading-normal: 1.6;   /* Body text */
  --leading-relaxed: 1.75; /* Long-form reading */

  /* Letter Spacing */
  --tracking-tight: -0.02em;  /* Large headlines */
  --tracking-normal: 0;       /* Body */
  --tracking-wide: 0.02em;    /* Small caps, labels */
  --tracking-wider: 0.08em;   /* Section labels */
}
```

### Typography Rationale

- **Playfair Display**: A modern take on 18th-century transitional serifs. Dramatic, authoritative, perfect for headlines. The italics are stunning.
- **Source Serif 4**: Designed specifically for extended reading. Open apertures, generous x-height, optimized for screens. The perfect workhorse.
- **IBM Plex Sans**: A humanist sans-serif for UI elements. Distinctive enough to not be generic, readable enough for buttons and labels.
- **IBM Plex Mono**: Matches the Plex family for code blocks, maintaining visual coherence.

---

## Layout Architecture: The Broadsheet

### Desktop Layout (≥1024px)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ THE AI COUNCIL                                         [Archive] [+ New Inquiry]
│ ═══════════════════════════════════════════════════════════════════════════│
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                                                                     │   │
│   │  "What are the long-term implications of quantum                   │   │
│   │   computing for current encryption standards?"                     │   │
│   │                                                                     │   │
│   │   Filed Dec 26, 2025 · 4 Experts Consulted · Deliberation Complete │   │
│   │                                                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                                                                     │   │
│   │   THE COUNCIL'S POSITION                                           │   │
│   │   ─────────────────────────────────────────────────────            │   │
│   │                                                                     │   │
│   │   Quantum computing poses an existential threat to current         │   │
│   │   RSA and ECC encryption within the next 10-15 years.             │   │
│   │   Organizations should begin transitioning to post-quantum         │   │
│   │   cryptography standards (NIST PQC) immediately...                 │   │
│   │                                                                     │   │
│   │   [Full, beautifully typeset synthesis with proper columns,        │   │
│   │    pull quotes, and emphasis where appropriate]                    │   │
│   │                                                                     │   │
│   │   ─────────────────────────────────────────────────────            │   │
│   │   Synthesized by gemini-3-pro-preview                              │   │
│   │                                                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │ DELIBERATION RECORD                                          [▼]   │   │
│   │ The following expert opinions informed the Council's position.     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   [Expanded state shows a 2-column grid of expert cards]                   │
│                                                                             │
│   ┌─────────────────────────┐   ┌─────────────────────────┐               │
│   │ EXPERT A                │   │ EXPERT B                │               │
│   │ gpt-5.1                 │   │ claude-sonnet-4.5       │               │
│   │ ───────────────         │   │ ───────────────         │               │
│   │ Preview of response...  │   │ Preview of response...  │               │
│   │ [Read Full Opinion →]   │   │ [Read Full Opinion →]   │               │
│   └─────────────────────────┘   └─────────────────────────┘               │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │ PEER REVIEW SUMMARY                                                 │   │
│   │ ┌────┬────────────────────────────┬──────────────────┐              │   │
│   │ │ #  │ Expert                     │ Avg. Position    │              │   │
│   │ ├────┼────────────────────────────┼──────────────────┤              │   │
│   │ │ 1  │ Expert C (grok-4)          │ 1.5              │              │   │
│   │ │ 2  │ Expert A (gpt-5.1)         │ 2.0              │              │   │
│   │ └────┴────────────────────────────┴──────────────────┘              │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  © 2025 Quinthesis · About · Privacy                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Layout Decisions

1. **No Persistent Sidebar**: Conversations accessed via "Archive" drawer. Full-width content area.
2. **Centered Content Column**: Max-width 720px for optimal reading (like newspaper columns).
3. **Question as Pull Quote**: Treated as the "headline" that sets context.
4. **Council's Position as Hero**: Large, well-typeset, impossible to miss.
5. **Deliberation as Footnotes**: Collapsed by default, expandable for transparency.
6. **Editorial Footer**: Grounds the page, adds legitimacy.

### Mobile Layout (<768px)

```
┌───────────────────────────────┐
│ ☰  THE AI COUNCIL      + New │
├───────────────────────────────┤
│                               │
│ ┌───────────────────────────┐ │
│ │ "What are the long-term   │ │
│ │  implications of quantum  │ │
│ │  computing for..."        │ │
│ │                           │ │
│ │ Dec 26 · 4 Experts        │ │
│ └───────────────────────────┘ │
│                               │
│ ┌───────────────────────────┐ │
│ │ THE COUNCIL'S POSITION    │ │
│ │ ─────────────────────     │ │
│ │                           │ │
│ │ Quantum computing poses   │ │
│ │ an existential threat to  │ │
│ │ current RSA and ECC       │ │
│ │ encryption within the     │ │
│ │ next 10-15 years...       │ │
│ │                           │ │
│ │ [Continue reading...]     │ │
│ │                           │ │
│ │ ─────────────────────     │ │
│ │ Synthesized by gemini-3   │ │
│ └───────────────────────────┘ │
│                               │
│ ┌───────────────────────────┐ │
│ │ DELIBERATION RECORD    ▼  │ │
│ └───────────────────────────┘ │
│                               │
│ [Experts in single column]    │
│                               │
│ ┌───────────────────────────┐ │
│ │ EXPERT A · gpt-5.1        │ │
│ │ Preview text...           │ │
│ │ [Read Full Opinion →]     │ │
│ └───────────────────────────┘ │
│                               │
└───────────────────────────────┘
```

### Mobile-Specific Behaviors

1. **Hamburger Menu**: Opens full-screen Archive drawer with all conversations.
2. **Condensed Question**: Shows first 100 chars, tap to expand.
3. **Stacked Cards**: Single-column layout for all content.
4. **Swipe Gestures**: Left on conversation to reveal delete. Right to go back.
5. **Sticky Header**: App name + New button always accessible.
6. **Bottom Sheet for Full Opinions**: Expert responses open as bottom sheet modals.

---

## Component Designs

### 1. The Masthead (Header)

```css
.masthead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
  border-bottom: 3px solid var(--ink-black);
}

.masthead-title {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: 700;
  letter-spacing: var(--tracking-tight);
  color: var(--ink-black);
  text-transform: uppercase;
}

.masthead-rule {
  height: 1px;
  background: linear-gradient(
    to right,
    transparent,
    var(--ink-faint) 10%,
    var(--ink-faint) 90%,
    transparent
  );
}
```

**Design Notes**:
- Classic newspaper masthead with the app name prominent
- Double or triple rule below (a signature of serious publications)
- Navigation subtle, content-first

### 2. The Inquiry Card (Question)

```css
.inquiry-card {
  background: var(--paper-aged);
  border: 1px solid var(--paper-shadow);
  border-left: 4px solid var(--accent-vermillion);
  padding: 1.5rem 2rem;
  margin: 2rem 0;
}

.inquiry-label {
  font-family: var(--font-ui);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  color: var(--ink-light);
  margin-bottom: 0.75rem;
}

.inquiry-text {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-style: italic;
  line-height: var(--leading-snug);
  color: var(--ink-dark);
}

.inquiry-meta {
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  color: var(--ink-medium);
  margin-top: 1rem;
  display: flex;
  gap: 1rem;
}

.inquiry-status {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.inquiry-status::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--status-complete);
}
```

**Design Notes**:
- Pull-quote styling makes the question feel like an editorial hook
- Red left border anchors it visually
- Italic Playfair is striking and memorable

### 3. The Council's Position (Stage 3 - Hero)

```css
.position-card {
  background: var(--paper-cream);
  border-top: 2px solid var(--ink-black);
  border-bottom: 2px solid var(--ink-black);
  padding: 3rem 2rem;
  margin: 2rem 0;
}

.position-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 1.5rem;
}

.position-title {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: 700;
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  color: var(--ink-black);
}

.position-content {
  font-family: var(--font-body);
  font-size: var(--text-lg);
  line-height: var(--leading-relaxed);
  color: var(--ink-dark);

  /* Editorial column styling */
  column-count: 1;
  column-gap: 2rem;
}

@media (min-width: 1024px) {
  .position-content {
    column-count: 2;
  }
}

.position-content p:first-of-type::first-letter {
  font-family: var(--font-display);
  font-size: 3.5em;
  float: left;
  line-height: 0.8;
  padding-right: 0.1em;
  color: var(--accent-vermillion);
}

.position-footer {
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid var(--ink-faint);
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  color: var(--ink-light);
}

.synthesizer-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  background: var(--paper-aged);
  border: 1px solid var(--paper-shadow);
  border-radius: 2px;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}
```

**Design Notes**:
- Double-rule top and bottom is a classic editorial frame
- Drop cap on first paragraph adds gravitas
- Two-column layout on desktop for that newspaper feel
- The lead model is credited subtly in footer

### 4. Deliberation Record (Collapsible Section)

```css
.deliberation-section {
  margin: 2rem 0;
}

.deliberation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: var(--paper-aged);
  border: 1px solid var(--paper-shadow);
  cursor: pointer;
  transition: background 150ms ease;
}

.deliberation-header:hover {
  background: var(--paper-shadow);
}

.deliberation-title {
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  color: var(--ink-dark);
}

.deliberation-subtitle {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-style: italic;
  color: var(--ink-medium);
  margin-top: 0.25rem;
}

.deliberation-toggle {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink-medium);
  transition: transform 200ms ease;
}

.deliberation-section[open] .deliberation-toggle {
  transform: rotate(180deg);
}

.deliberation-content {
  padding: 1.5rem;
  border: 1px solid var(--paper-shadow);
  border-top: none;
  animation: slideDown 200ms ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### 5. Expert Opinion Card (Stage 1)

```css
.expert-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-top: 1.5rem;
}

.expert-card {
  background: var(--paper-cream);
  border: 1px solid var(--paper-shadow);
  padding: 1.5rem;
  position: relative;
}

.expert-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.expert-badge {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--ink-black);
  line-height: 1;
}

.expert-model {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--ink-light);
  text-align: right;
}

.expert-rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  font-family: var(--font-ui);
  font-size: var(--text-xs);
  font-weight: 600;
  border-radius: 50%;
  margin-top: 0.25rem;
}

.expert-rank.rank-1 {
  background: #FFD700;
  color: var(--ink-black);
}

.expert-rank.rank-2 {
  background: #C0C0C0;
  color: var(--ink-black);
}

.expert-rank.rank-3 {
  background: #CD7F32;
  color: white;
}

.expert-preview {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
  color: var(--ink-medium);
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.expert-expand {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: 1rem;
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  color: var(--accent-vermillion);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-decoration: none;
}

.expert-expand:hover {
  text-decoration: underline;
}

.expert-expand::after {
  content: '→';
  transition: transform 150ms ease;
}

.expert-expand:hover::after {
  transform: translateX(3px);
}
```

### 6. Peer Review Table (Stage 2)

```css
.review-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-body);
  margin-top: 1.5rem;
}

.review-table thead {
  border-bottom: 2px solid var(--ink-black);
}

.review-table th {
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  text-align: left;
  padding: 0.75rem 1rem;
  color: var(--ink-dark);
}

.review-table tbody tr {
  border-bottom: 1px solid var(--paper-shadow);
  transition: background 150ms ease;
}

.review-table tbody tr:hover {
  background: var(--paper-aged);
}

.review-table td {
  padding: 0.75rem 1rem;
  font-size: var(--text-sm);
}

.review-table .position-cell {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--ink-black);
  width: 3rem;
}

.review-table .score-cell {
  font-family: var(--font-mono);
  color: var(--ink-medium);
  text-align: right;
}
```

### 7. Archive Drawer (Conversation List)

```css
.archive-drawer {
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: 360px;
  background: var(--paper-cream);
  border-right: 1px solid var(--paper-shadow);
  transform: translateX(-100%);
  transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 100;
  display: flex;
  flex-direction: column;
}

.archive-drawer.open {
  transform: translateX(0);
}

.archive-header {
  padding: 1.5rem;
  border-bottom: 2px solid var(--ink-black);
}

.archive-title {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: var(--tracking-tight);
}

.archive-search {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  width: 100%;
  font-family: var(--font-body);
  font-size: var(--text-sm);
  border: 1px solid var(--paper-shadow);
  background: var(--paper-aged);
  color: var(--ink-dark);
}

.archive-search::placeholder {
  color: var(--ink-light);
  font-style: italic;
}

.archive-list {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.archive-item {
  padding: 1rem;
  border-bottom: 1px solid var(--paper-shadow);
  cursor: pointer;
  transition: background 150ms ease;
  position: relative;
}

.archive-item:hover {
  background: var(--paper-aged);
}

.archive-item.active {
  background: var(--paper-shadow);
  border-left: 3px solid var(--accent-vermillion);
  margin-left: -3px;
}

.archive-item-title {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--ink-dark);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.archive-item-meta {
  font-family: var(--font-ui);
  font-size: var(--text-xs);
  color: var(--ink-light);
  margin-top: 0.5rem;
}

.archive-item-delete {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0;
  transition: opacity 150ms ease;
  background: none;
  border: none;
  color: var(--ink-light);
  cursor: pointer;
  padding: 0.5rem;
}

.archive-item:hover .archive-item-delete {
  opacity: 1;
}

.archive-item-delete:hover {
  color: var(--accent-vermillion);
}

/* Mobile: Full-screen drawer */
@media (max-width: 767px) {
  .archive-drawer {
    width: 100%;
  }
}
```

### 8. New Inquiry Modal

```css
.inquiry-modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(26, 22, 20, 0.6);
  z-index: 200;
  opacity: 0;
  pointer-events: none;
  transition: opacity 200ms ease;
}

.inquiry-modal.open {
  opacity: 1;
  pointer-events: auto;
}

.inquiry-modal-content {
  background: var(--paper-cream);
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  border: 2px solid var(--ink-black);
  animation: modalSlideUp 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes modalSlideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.inquiry-modal-header {
  padding: 1.5rem 2rem;
  border-bottom: 2px solid var(--ink-black);
}

.inquiry-modal-title {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: 700;
  text-transform: uppercase;
}

.inquiry-modal-body {
  padding: 2rem;
}

.inquiry-textarea {
  width: 100%;
  min-height: 150px;
  padding: 1rem;
  font-family: var(--font-body);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  border: 1px solid var(--paper-shadow);
  background: var(--paper-aged);
  color: var(--ink-dark);
  resize: vertical;
}

.inquiry-textarea:focus {
  outline: none;
  border-color: var(--accent-vermillion);
  box-shadow: 0 0 0 3px rgba(196, 61, 46, 0.1);
}

.inquiry-modal-footer {
  padding: 1.5rem 2rem;
  border-top: 1px solid var(--paper-shadow);
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}

.btn-primary {
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  padding: 0.75rem 1.5rem;
  background: var(--ink-black);
  color: var(--paper-cream);
  border: none;
  cursor: pointer;
  transition: background 150ms ease;
}

.btn-primary:hover {
  background: var(--ink-dark);
}

.btn-secondary {
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  font-weight: 500;
  padding: 0.75rem 1.5rem;
  background: transparent;
  color: var(--ink-medium);
  border: 1px solid var(--paper-shadow);
  cursor: pointer;
  transition: all 150ms ease;
}

.btn-secondary:hover {
  border-color: var(--ink-light);
  color: var(--ink-dark);
}

/* Mobile: Full-screen modal */
@media (max-width: 767px) {
  .inquiry-modal-content {
    max-width: 100%;
    height: 100%;
    max-height: 100%;
    border: none;
    animation: modalSlideUp 300ms cubic-bezier(0.4, 0, 0.2, 1);
  }
}
```

### 9. Loading States

```css
/* Skeleton loader for position card */
.position-skeleton {
  animation: shimmer 2s infinite;
  background: linear-gradient(
    90deg,
    var(--paper-aged) 0%,
    var(--paper-shadow) 50%,
    var(--paper-aged) 100%
  );
  background-size: 200% 100%;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Progress indicator during deliberation */
.deliberation-progress {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 2rem;
  background: var(--paper-aged);
  border: 1px solid var(--paper-shadow);
}

.progress-stage {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.progress-indicator {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-weight: 700;
  transition: all 300ms ease;
}

.progress-indicator.pending {
  background: var(--paper-shadow);
  color: var(--ink-light);
}

.progress-indicator.active {
  background: var(--accent-vermillion);
  color: white;
  animation: pulse 1.5s infinite;
}

.progress-indicator.complete {
  background: var(--accent-forest);
  color: white;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.progress-label {
  font-family: var(--font-ui);
  font-size: var(--text-sm);
}

.progress-label.active {
  font-weight: 600;
  color: var(--ink-dark);
}

.progress-label.pending {
  color: var(--ink-light);
}
```

---

## Interactions & Animations

### Page Load Sequence

```css
/* Staggered reveal on page load */
.page-content > * {
  opacity: 0;
  transform: translateY(15px);
  animation: revealUp 500ms ease-out forwards;
}

.page-content > *:nth-child(1) { animation-delay: 0ms; }
.page-content > *:nth-child(2) { animation-delay: 100ms; }
.page-content > *:nth-child(3) { animation-delay: 200ms; }
.page-content > *:nth-child(4) { animation-delay: 300ms; }

@keyframes revealUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Hover States

- Cards: Subtle lift with shadow (`transform: translateY(-2px)`)
- Links: Underline slides in from left
- Buttons: Background color transitions smoothly
- Expert cards: Border gains vermillion accent on hover

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `Cmd/Ctrl + K` | Open Archive drawer |
| `Cmd/Ctrl + N` | New Inquiry |
| `Esc` | Close modals/drawers |
| `Tab` | Navigate interactive elements |
| `Enter` | Expand/collapse sections |

---

## Responsive Breakpoints

```css
/* Mobile-first approach */
:root {
  --container-padding: 1rem;
  --content-max-width: 100%;
}

@media (min-width: 640px) {
  :root {
    --container-padding: 1.5rem;
    --content-max-width: 100%;
  }
}

@media (min-width: 768px) {
  :root {
    --container-padding: 2rem;
    --content-max-width: 680px;
  }
}

@media (min-width: 1024px) {
  :root {
    --container-padding: 2rem;
    --content-max-width: 720px;
  }

  /* Enable two-column layouts */
  .position-content { column-count: 2; }
  .expert-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1280px) {
  :root {
    --content-max-width: 800px;
  }
}
```

---

## Touch Gestures (Mobile)

| Gesture | Action |
|---------|--------|
| Swipe left on archive item | Reveal delete button |
| Swipe right on main content | Open Archive drawer |
| Long-press archive item | Context menu (delete, copy link) |
| Pull down at top | Refresh |
| Tap question card | Expand/collapse |

---

## Before/After Comparison

### Current Design
```
Theme: Dark "chamber" with gold accents (#050713, #D4AF37)
Feel: Bureaucratic, dated, trying too hard
Layout: Persistent sidebar, tab navigation
Hierarchy: All stages equal weight
Typography: Mixed fonts, inconsistent
Memorable: No - generic dark SaaS
```

### Previous Proposal (Rejected)
```
Theme: Sleek dark mode with indigo (#0A0A0B, #6366F1)
Feel: Linear/Vercel clone, generic premium SaaS
Layout: Slide-out drawer, answer-first
Hierarchy: Good (answer as hero)
Typography: Inter only
Memorable: No - looks like every other modern SaaS
```

### This Proposal
```
Theme: Warm paper with ink & vermillion (#FAF8F5, #1A1614, #C43D2E)
Feel: Editorial, authoritative, unique, trustworthy
Layout: Full-width content, Archive drawer, print-inspired
Hierarchy: Excellent (headline → article → footnotes)
Typography: Playfair Display + Source Serif 4 (editorial)
Memorable: YES - "the app that looks like The Economist"
```

---

## Implementation Phases

### Phase 1: Foundation ✅ COMPLETE
- [x] Set up new color palette and typography CSS variables
- [x] Replace dark theme with paper/ink theme
- [x] Import Google Fonts (Playfair Display, Source Serif 4, IBM Plex Sans/Mono)

### Phase 2: Layout Restructure ✅ COMPLETE
- [x] Remove persistent sidebar → implement Archive drawer
- [x] Create centered content column with proper max-width
- [x] Implement responsive container

### Phase 3: Component Rebuild ✅ COMPLETE
- [x] Masthead (header) with editorial styling
- [x] Inquiry Card (question) with pull-quote styling
- [x] Position Card (Stage 3) with drop cap and columns
- [x] Expert cards with ranking badges (tab-based navigation)
- [x] Review table for Stage 2 (leaderboard + accordion reviews)
- [ ] ~~Deliberation section with accordion~~ *See Design Decision below*

### Phase 4: Polish ✅ COMPLETE
- [x] Loading states with skeleton screens
- [x] Page load animations (staggered reveal)
- [x] Hover states and micro-interactions
- [x] Keyboard navigation (Ctrl+K archive, Ctrl+N new, Escape close)
- [ ] Mobile touch gestures (deferred - not critical)

---

## Design Decision: Tab-Based Navigation

**Decision Date**: December 26, 2025

The original proposal suggested an "answer-first" hierarchy where Stage 3 (Council's Position) would always be visible at the top, with Stage 1/2 in a collapsible "DELIBERATION RECORD" accordion below.

**Chosen Approach**: Keep tab-based navigation between "Final Answer", "Stage 1", and "Stage 2".

**Rationale**:
- Simpler UX for switching between views
- Cleaner mobile experience
- Users can quickly compare stages without scrolling
- Tab interface is more familiar and intuitive

The editorial styling (typography, colors, drop caps) is still applied to all stages, maintaining the "Paper of Record" aesthetic while using a more practical navigation pattern.

### Two-Column Layout (Stage 3)

**Proposal**: Two-column newspaper-style layout for Stage 3 content on desktop.

**Implementation Decision (2026-01-02)**: Single column layout retained.

**Rationale**:
- Single column provides better readability for technical content
- Two-column layout can break awkwardly with code blocks, lists, and varied content lengths
- Mobile-first approach means the single column is the primary experience
- Users scroll vertically anyway; two columns add horizontal eye movement without clear benefit

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Visual distinctiveness | Low (generic SaaS) | High (memorable editorial) |
| Time to synthesized answer | 2-3 clicks | 0 clicks (immediately visible) |
| Mobile usability | Fair | Excellent |
| Brand recall | "some dark AI app" | "the newspaper-style AI council" |

---

## Alternative Directions (Not Recommended, But Available)

If the editorial direction doesn't resonate, here are other unique approaches to consider:

1. **Brutalist/Raw**: Stark white backgrounds, black text, bold geometric shapes, intentionally "undesigned" feel. Think: Balenciaga website.

2. **Retro-Futurism**: 1960s space-age aesthetic, orbs, gradients, curved shapes. Think: NASA meets Jony Ive.

3. **Glassmorphism Garden**: Frosted glass cards floating over an animated gradient mesh background. Colorful, playful, modern.

4. **Terminal/Hacker**: Green-on-black terminal aesthetic, monospace everything, command-line inspired. For a very technical audience.

Each of these would be distinctive. The editorial direction was chosen because it best aligns with the "council of experts deliberating" metaphor and creates natural information hierarchy.

---

## Summary

**"The Paper of Record"** transforms Quinthesis from a generic dark-mode SaaS tool into a distinctive, memorable experience that:

1. **Looks like nothing else** - Warm paper, rich typography, editorial layouts
2. **Reinforces the metaphor** - Expert council issuing considered opinions
3. **Creates natural hierarchy** - Headline (answer) → Article (details) → Footnotes (process)
4. **Feels trustworthy** - Print conventions signal authority and thoughtfulness
5. **Works beautifully on mobile** - Newspapers have done responsive for centuries

Users will remember "the AI app that looks like The Economist" - and that memorability is marketing gold.

---

*End of proposal*
