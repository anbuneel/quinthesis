# New Inquiry UX Redesign

## Status: Completed

## Problem Statement

The current "New Inquiry" flow is clunky and requires too many steps:

1. User sees empty state with "Start New Inquiry" button
2. Clicks button → Modal opens (jarring context switch)
3. Selects models from checkbox grid
4. Picks lead model from dropdown
5. Clicks "Create" → Empty conversation created
6. Types question in textarea
7. Clicks "Send"

### Issues
- **Modal interruption**: Breaks flow, feels like filling out a form before you can ask a question
- **Premature commitment**: Creates empty conversation before user even knows what to ask
- **Disconnected steps**: Model selection feels unrelated to the question
- **Too many clicks**: 4+ actions before the actual inquiry begins
- **Cognitive overhead**: User must understand model selection before they can just ask

---

## Solution: "The Editorial Desk"

Transform the home page into an integrated inquiry composer where the question is the hero and model configuration is secondary (but accessible).

### New Flow (2 Steps)
1. User types question directly on home page
2. (Optional) Adjusts council configuration
3. Submits → Conversation created AND question sent in one action

### Design Principles
1. **Question-first**: The textarea is the hero, front and center
2. **Smart defaults**: Pre-select models, let users override if they want
3. **Progressive disclosure**: Model config is collapsed by default, expandable
4. **Single action**: One "Convene the Council" button that creates + submits
5. **Editorial aesthetic**: Feels like drafting an article, not filling a form

---

## Wireframe

### Default State (Config Collapsed)
```
┌──────────────────────────────────────────────────────────────┐
│  THE AI COUNCIL                                    [Archive] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│            ┌─────────────────────────────────────┐           │
│            │                                     │           │
│            │   "What would you like to ask       │           │
│            │    the Council?"                    │           │
│            │                                     │           │
│            │   ┌─────────────────────────────┐   │           │
│            │   │                             │   │           │
│            │   │  [Large textarea for        │   │           │
│            │   │   question input]           │   │           │
│            │   │                             │   │           │
│            │   └─────────────────────────────┘   │           │
│            │                                     │           │
│            │   ▸ Configure Council (4 models)    │           │
│            │                                     │           │
│            │   ┌─────────────────────────────┐   │           │
│            │   │   Convene the Council  →    │   │           │
│            │   └─────────────────────────────┘   │           │
│            └─────────────────────────────────────┘           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Config Expanded
```
│            │   ▾ Configure Council (4 models)    │           │
│            │   ┌─────────────────────────────┐   │           │
│            │   │ [chip] gpt-5.1  ✓           │   │           │
│            │   │ [chip] gemini-3-pro  ✓      │   │           │
│            │   │ [chip] claude-sonnet  ✓     │   │           │
│            │   │ [chip] grok-4  ✓            │   │           │
│            │   │                             │   │           │
│            │   │ Lead: [gemini-3-pro ▼]      │   │           │
│            │   └─────────────────────────────┘   │           │
```

---

## Technical Implementation

### New Component: `InquiryComposer`

Replaces:
- Empty state in `ChatInterface.jsx`
- `NewConversationModal.jsx` (can be removed after)

Features:
- Loads models on mount (not on button click)
- Shows question input immediately
- Has collapsible model configuration
- Single submit action that creates conversation + sends message

### API Changes

The current flow:
1. `POST /api/conversations` → creates empty conversation
2. `POST /api/conversations/{id}/message` → sends question

New flow option A (preferred):
- Modify `POST /api/conversations` to accept optional `initial_message` field
- If provided, creates conversation AND processes the message in one request

New flow option B (no backend changes):
- Frontend chains the two API calls
- User sees seamless single action, but two requests happen under the hood

### Files to Modify
- `frontend/src/components/InquiryComposer.jsx` (new)
- `frontend/src/components/InquiryComposer.css` (new)
- `frontend/src/components/ChatInterface.jsx` (use new component)
- `frontend/src/App.jsx` (pass required props, remove modal trigger)
- `frontend/src/components/NewConversationModal.jsx` (can be removed later)
- `frontend/src/components/NewConversationModal.css` (can be removed later)

---

## Design Tokens

Using existing "Paper of Record" theme:
- Fonts: Playfair Display (display), Source Serif 4 (body), IBM Plex Sans (UI)
- Colors: paper-cream (#FAF8F5), ink-black (#1A1614), accent-vermillion (#C43D2E)
- Editorial aesthetic with warm, authoritative feel

---

## Acceptance Criteria

- [x] User can type question directly on home page without clicking any buttons first
- [x] Models are pre-selected with smart defaults
- [x] Model configuration is collapsible (collapsed by default)
- [x] Single "Convene the Council" button creates conversation and submits question
- [x] Maintains editorial "Paper of Record" aesthetic
- [x] Mobile responsive
- [x] Keyboard accessible (Cmd/Ctrl+Enter to submit, proper focus management)

## Implementation Notes

### Files Created
- `frontend/src/components/InquiryComposer.jsx` - New unified inquiry composer component
- `frontend/src/components/InquiryComposer.css` - Styling for the composer

### Files Modified
- `frontend/src/components/ChatInterface.jsx` - Uses InquiryComposer for empty state
- `frontend/src/App.jsx` - Loads models on auth, added `handleCreateAndSubmit` handler

### Key Changes
1. Models are now loaded when user authenticates (not when modal opens)
2. `Cmd/Ctrl + N` now goes to the composer (clears current conversation)
3. Sidebar "New Inquiry" button goes to composer instead of opening modal
4. Modal still exists as fallback but is not the primary flow
