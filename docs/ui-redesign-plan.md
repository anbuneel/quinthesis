# UI Redesign Plan - AI Council (Combined)

## Decisions Locked
- Left pane shows prior conversations.
- Stage 1/2 hidden by default.
- Sticky question header stays at the top of the right pane.
- Replace chat format with a light docket/log style.

## Current Problems
1. Excessive nesting of session and stage containers makes the UI hard to scan.
2. Too much scrolling to reach the final answer and key context.
3. Mobile incompatibility due to fixed sidebar and lack of breakpoints.
4. Poor information hierarchy with Stage 3 buried under secondary content.

## Redesign Goals
1. Flatten hierarchy from 4+ levels down to 2-3 levels.
2. Answer-first: Stage 3 is the primary element on first view.
3. Mobile-first with responsive breakpoints and a drawer for the left pane.
4. Progressive disclosure for Stage 1/2 details.
5. Reduce scroll depth by 40-50 percent.

## Proposed IA and Layout
- Desktop: Two-pane layout.
  - Left pane: prior conversations list (search, new conversation, recent items).
  - Right pane: docket view for the current conversation.
- Mobile: One pane with left pane as a drawer.
- Single scroll container in the right pane.
- Sticky question header at the top of the docket.
- Sticky input at the bottom of the right pane.

## Docket Style (Right Pane)
- Docket header (sticky): question, status/progress indicator.
- Final Opinion (Stage 3): top section, prominent styling.
- Deliberation Records (collapsed by default):
  - Stage 1 Summary: compact tabs, preview text, expand for full response.
  - Stage 2 Summary: compact leaderboard, expand for full reviews.
- Metadata as small log entries: models used, timestamps, errors if any.
- No chat bubbles; each section is a docket entry with consistent framing.

## Component Hierarchy (Simplified)
Before:
ChatInterface -> messages -> message row -> session card -> accordion -> stage sections

After:
AppLayout
  Sidebar (ConversationsList)
  MainPane
    DocketHeader (sticky)
    DocketBody
      FinalOpinion (Stage3)
      DeliberationRecords (collapsed)
        Stage1Summary
        Stage2Summary
      DocketMetadata
    DocketInput (sticky)

## Interaction Rules
- Stage 3 is always visible in the first screenful on desktop and mobile.
- Stage 1/2 remain collapsed by default; show counts and top ranking summary.
- Expand/collapse uses a single control with clear labeling.
- Keep progress orbit in the header, aligned with the question.

## Mobile Behavior
- Left pane becomes a slide-in drawer with overlay.
- Right pane becomes full-width with reduced padding.
- Touch targets at least 44px high.
- Horizontal tabs in Stage 1 become scrollable on mobile.

## CSS Architecture (High-Level)
- .app-layout (two-pane grid)
- .sidebar (conversation list)
- .docket-header (sticky)
- .docket-entry (shared log entry style)
- .final-opinion (Stage 3 emphasis)
- .deliberation-records (collapsed container)
- .docket-input (sticky bottom)

## Implementation Details

### File-Level Targets (Frontend)
- `frontend/src/App.jsx`: establish the two-pane layout container and route state for the active conversation.
- `frontend/src/components/Sidebar.jsx`: render prior conversations list, selection state, and empty/loading states.
- `frontend/src/components/RightPanel.jsx`: convert to a docket shell (header, body, input) and remove chat framing.
- `frontend/src/components/ChatInterface.jsx`: flatten structure into docket entries and wire collapsible Stage 1/2.
- `frontend/src/components/Stage1.jsx`: add compact summary mode with preview + expand.
- `frontend/src/components/Stage2.jsx`: add compact leaderboard + expandable reviews.
- `frontend/src/components/Stage3.jsx`: ensure prominent docket entry styling.
- `frontend/src/App.css`, `frontend/src/components/ChatInterface.css`, `frontend/src/components/Sidebar.css`, `frontend/src/components/RightPanel.css`: layout, spacing, sticky regions, drawer behavior.

### Left Pane Data + Behavior
- Data source: existing conversations state in `App.jsx` (or current fetch path used by `Sidebar.jsx`).
- List items show title, timestamp, and a short preview of the last user prompt.
- Empty state: "No conversations yet" with a primary "New conversation" action.
- Loading state: skeleton rows (3-5) to avoid layout shift.
- Selection: clicking a conversation sets it active and refreshes the docket in the right pane.

### Docket Entry Spec (Right Pane)
- Each docket entry is a flat card with a label row, timestamp (if available), and content block.
- Typography: label uses DM Serif Display, body uses Inter; code uses JetBrains Mono.
- Spacing: base vertical rhythm of 12px; docket entry padding 16px (mobile) / 20px (desktop).
- Visual hierarchy: Stage 3 uses a gold accent bar and higher contrast background.

### Stage 1 Summary Behavior
- Default collapsed within "Deliberation Records".
- Tab labels use anonymized names (Expert A/B/C), matching existing de-anonymization logic.
- Preview length: 160 characters with ellipsis.
- Expand reveals full response inline; collapse returns to preview.
- On mobile, tabs become horizontally scrollable.

### Stage 2 Summary Behavior
- Default collapsed within "Deliberation Records".
- Show compact leaderboard (top 3 by aggregate ranking) with "Show all" toggle.
- Individual reviews collapsed by default; expand reveals full evaluation text.

### Mobile Drawer Behavior
- Drawer toggle lives in the sticky docket header (left aligned).
- When open: overlay dims content; body scroll locked; tap overlay closes.
- Drawer width: 80 percent on mobile; fixed 260px on tablet and up.

## Implementation Steps
Phase 1: Structure and layout
1. Refactor ChatInterface to remove chat formatting and nested wrappers.
2. Build docket structure with a single top-level response container.
3. Ensure sticky header and sticky input behavior.

Phase 2: Mobile and responsiveness
4. Add breakpoints and drawer behavior for the left pane.
5. Convert spacing to a mobile-first scale and validate touch targets.

Phase 3: Stage summaries
6. Implement Stage 1 compact summary with previews and expansion.
7. Implement Stage 2 compact leaderboard and expandable reviews.
8. Style Stage 3 as the primary docket entry.

Phase 4: Polish and QA
9. Validate scroll depth and first-view visibility of Stage 3.
10. Test streaming updates and long responses.
11. Verify keyboard navigation and accessibility.

## Success Criteria
- Stage 3 visible on initial view (desktop and mobile).
- Scroll depth reduced by ~40-50 percent.
- No horizontal scroll on mobile; left pane works as a drawer.
- Stage 1/2 accessible via a single expand action.

## Open Questions
- None at this time.
