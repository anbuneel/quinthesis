# Account Page Tab Separation Design

**Date:** 2026-01-05
**Status:** Implemented
**Author:** Claude (Opus 4.5, frontend-design skill)

---

## Problem Statement

The Account page currently displays all content on a single scrolling page:
- Balance card
- Add Funds (deposit options)
- Pricing Explainer
- API Settings (BYOK)
- Usage History
- Data & Privacy
- Member info footer

As users make more queries, the **Usage History** table grows unbounded, pushing important content down and creating a cluttered experience.

---

## Proposed Solution

Split the Account page into **two tabs**:

| Tab | Content |
|-----|---------|
| **Account** (default) | Balance, Add Funds, Pricing, API Settings, Data & Privacy, Member footer |
| **History** | Full usage history ledger with summary stats |

---

## Design Pattern: Editorial Section Headers

For the "Paper of Record" theme, we recommend **underline tabs** styled like newspaper section markers rather than modern pill/card tabs. This maintains the editorial gravitas while providing clear navigation.

### Visual Concept

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│     ACCOUNT                        HISTORY                  │
│     ════════                       ───────                  │
│     (active: double-rule)          (inactive: subtle)       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Design Specifications

### Tab Container

- Positioned below masthead, above content
- Centered alignment with generous horizontal spacing (2.5rem gap)
- Subtle bottom border (single rule) to separate from content
- Background: `--paper-cream`

### Tab Labels

| Property | Value |
|----------|-------|
| Font | `--font-ui` (IBM Plex Sans) |
| Size | `--text-sm` (0.875rem) |
| Weight | 600 |
| Transform | uppercase |
| Letter-spacing | `--tracking-wider` (0.08em) |
| Color (active) | `--ink-black` |
| Color (inactive) | `--ink-light` |
| Color (hover) | `--ink-medium` |

### Active Indicator

- Double-rule underline (editorial flourish) using vermillion accent
- 3px total height with 1px gap between rules
- Smooth transition on tab switch (200ms ease)

### Hover State

- Color shifts to `--ink-medium`
- Subtle underline preview appears (optional)

---

## CSS Implementation

```css
/* Editorial Tab Navigation */
.account-tabs {
  display: flex;
  justify-content: center;
  gap: 2.5rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--paper-border);
  background: var(--paper-cream);
}

.account-tab {
  position: relative;
  padding: 0.5rem 0;
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  color: var(--ink-light);
  background: none;
  border: none;
  cursor: pointer;
  transition: color var(--transition-fast);
}

.account-tab:hover {
  color: var(--ink-medium);
}

.account-tab[aria-selected="true"] {
  color: var(--ink-black);
}

/* Double-rule underline for active tab */
.account-tab[aria-selected="true"]::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 3px;
  background:
    linear-gradient(var(--accent-vermillion), var(--accent-vermillion)) top/100% 1px no-repeat,
    linear-gradient(var(--accent-vermillion), var(--accent-vermillion)) bottom/100% 1px no-repeat;
}
```

---

## Content Organization

### Tab 1: "Account" (default)

1. **Balance Card** - Current balance display with deposited/spent stats
2. **Add Funds** - Deposit options ($1, $2, $5, $10)
3. **Pricing Explainer** - How pricing works
4. **API Settings** - BYOK key management
5. **Data & Privacy** - Export data, delete account
6. **Member Footer** - Member since date, OAuth provider

### Tab 2: "History"

1. **Summary Stats** (new) - "Total queries: X · Total spent: $X.XX"
2. **Usage Ledger** - Full-height, remove 320px max-height constraint
3. **Future:** Date range filter (optional enhancement)

---

## Accessibility

| Requirement | Implementation |
|-------------|----------------|
| ARIA roles | `role="tablist"`, `role="tab"`, `role="tabpanel"` |
| Selection state | `aria-selected="true/false"` |
| Panel labeling | `aria-labelledby` referencing tab id |
| Keyboard nav | Arrow keys between tabs, Enter/Space to select |
| Focus visible | Maintained via existing `:focus-visible` styles |

### Keyboard Interactions

| Key | Action |
|-----|--------|
| `Tab` | Move focus to/from tab list |
| `←` `→` | Navigate between tabs |
| `Home` | Focus first tab |
| `End` | Focus last tab |
| `Enter` / `Space` | Activate focused tab |

---

## Mobile Considerations

- Tabs remain horizontal (only 2 tabs, fits easily)
- Full-width touch targets (min 44px height)
- Tab labels stay visible (short text: "Account", "History")
- No horizontal scroll needed

---

## Benefits

| Benefit | Description |
|---------|-------------|
| **Cleaner UX** | Account actions stay focused, history is separate |
| **Scalability** | History tab can grow without affecting main view |
| **Performance** | Only active tab content renders (lazy loading optional) |
| **Future-proof** | Easy to add "Settings" or "Notifications" tabs later |

---

## Implementation Checklist

- [x] Add `activeTab` state to Account.jsx
- [x] Create tab navigation component
- [x] Split content into tab panels
- [x] Add ARIA attributes for accessibility
- [x] Implement keyboard navigation (arrow keys)
- [x] Remove 320px max-height from history ledger (via `history-ledger-full` class)
- [x] Add summary stats header to History tab
- [x] Update Account.css with tab styles
- [ ] Test on mobile viewports

---

## Related Documents

- [account-page.md](account-page.md) - Original account page design
- [ui-redesign-proposal.md](ui-redesign-proposal.md) - "Paper of Record" theme reference
