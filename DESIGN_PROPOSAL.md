# AI Council - "The Modern Chamber" Design

## Implementation Status: Complete

This document describes the frontend redesign of the AI Council application, implementing "The Modern Chamber" aesthetic - a deliberative dark mode design evoking a high-stakes deliberation room.

---

## Design Philosophy

**Theme: The Modern Chamber**

The application feels like entering a high-stakes deliberation room:
- **Authoritative** - Dark, resonant tones suggest a dimly lit mahogany chamber
- **Process-oriented** - Clear visual progression through deliberation stages
- **Collaborative** - Multiple voices contributing to consensus

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-chamber` | `#050713` | Main background (deepest navy/black) |
| `--bg-card` | `#141829` | Elevated cards/panels |
| `--bg-input` | `#1F2436` | Input fields |
| `--accent-gold` | `#D4AF37` | Authority, Chairman, CTAs |
| `--accent-info` | `#6C7A9C` | Deliberation phases (Stage 1 & 2) |
| `--text-primary` | `#EAEAEA` | Main text |
| `--text-secondary` | `#9CA3AF` | Muted text |

### Typography

- **Headlines**: DM Serif Display (authority)
- **Body**: Inter (clarity)
- **Data/Code**: JetBrains Mono (evidence)

---

## Component Architecture

### Three-Panel Layout
- **Left**: Sidebar ("The Docket") - Case list with status indicators
- **Center**: Main chamber - Deliberation feed (max-width 900px)
- **Right**: Collapsible panel - Council composition & settings

### New Components Created
- `RightPanel.jsx/css` - Council member list, blind mode toggle
- `ProgressOrbit.jsx/css` - Stage stepper: `[ I ] Opinions — [ II ] Review — [ III ] Ruling`

### Redesigned Components
- `Login` - Dark chamber with golden emblem
- `Sidebar` - "The Docket" with pulsing status dots
- `ChatInterface` - Dark theme with ProgressOrbit integration
- `Stage1` - "First Opinions" with Councilor A/B/C tabs
- `Stage2` - "The Review" with Council Standing leaderboard
- `Stage3` - "Final Resolution" with golden glow hero card

---

## Key UI Features

### Progress Orbit
Shows deliberation progress:
- Active stage: pulsing glow
- Completed stages: solid gold
- Pending stages: muted steel blue

### Case Status Indicators
- Pulsing blue dot = In Deliberation
- Solid gold dot = Resolved

### The Chairman's Decree
Stage 3 features:
- Golden glow (box-shadow)
- Left border accent
- Gradient background
- Entrance animation

---

## Files Modified

| File | Changes |
|------|---------|
| `frontend/index.html` | Google Fonts added |
| `frontend/src/index.css` | CSS variables, global styles, animations |
| `frontend/src/App.jsx` | Three-panel layout, RightPanel integration |
| `frontend/src/App.css` | Dark theme layout |
| `frontend/src/components/RightPanel.jsx` | **NEW** - Council composition panel |
| `frontend/src/components/RightPanel.css` | **NEW** - Right panel styling |
| `frontend/src/components/ProgressOrbit.jsx` | **NEW** - Stage stepper |
| `frontend/src/components/ProgressOrbit.css` | **NEW** - Stepper styling |
| `frontend/src/components/Sidebar.jsx` | "The Docket" terminology |
| `frontend/src/components/Sidebar.css` | Dark navy theme |
| `frontend/src/components/Login.jsx` | Council branding |
| `frontend/src/components/Login.css` | Dark chamber styling |
| `frontend/src/components/ChatInterface.jsx` | ProgressOrbit, terminology |
| `frontend/src/components/ChatInterface.css` | Dark theme |
| `frontend/src/components/Stage1.jsx` | Councilor labels |
| `frontend/src/components/Stage1.css` | Steel blue theme |
| `frontend/src/components/Stage2.jsx` | Council Standing |
| `frontend/src/components/Stage2.css` | Purple theme |
| `frontend/src/components/Stage3.jsx` | Golden verdict |
| `frontend/src/components/Stage3.css` | Hero card with glow |

---

## UX Principles Applied

1. **Slow & Deliberate**: All animations 300ms+ to feel like thought unfolding
2. **Progressive Revelation**: Interface brightens as stages complete (gold accents)
3. **Gold = Authority**: Chairman's answer and completed states use gold
4. **Anonymity First**: Councilor A/B/C labels, real model names on hover

---

## Running the Application

```bash
# Backend
uv run python -m backend.main

# Frontend
cd frontend
npm install
npm run dev
```

Open http://localhost:5173
