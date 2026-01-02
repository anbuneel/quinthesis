# Account Page Design Recommendation

## Decision: Separate Page vs Modal

**Verdict: Settings should be a dedicated Account page, not a modal.**

## Rationale

### Why a Modal Won't Work

The content is too complex for a modal:

| Content | Complexity |
|---------|------------|
| Dollar balance | Simple |
| Deposit options (3 tiers) | Medium - needs clear CTAs |
| Usage history with cost breakdowns | **High** - tabular data, per-query details, scrolling |
| Account settings | Medium |

Modals work for focused, single-purpose interactions (confirm dialogs, quick edits). Once you need scrolling within a modal, the UX degrades significantly. Usage history alone could have dozens of entries with model breakdowns.

## Editorial Design Direction

A dedicated **Account page** aligns with the "Paper of Record" theme. Think of it as the **Financial Section** of the newspaper:

```
┌─────────────────────────────────────────────────────┐
│  THE AI COUNCIL                    [Avatar] [Logout]│
├─────────────────────────────────────────────────────┤
│                                                     │
│  ╔═══════════════════════════════════════════════╗  │
│  ║  A C C O U N T                                ║  │
│  ╠═══════════════════════════════════════════════╣  │
│  ║                                               ║  │
│  ║  ┌─────────────┐    BALANCE                   ║  │
│  ║  │             │    ─────────────────         ║  │
│  ║  │   $4.97     │    Add Funds                 ║  │
│  ║  │             │    [$5] [$20] [$50]          ║  │
│  ║  └─────────────┘                              ║  │
│  ║                                               ║  │
│  ║  ═══════════════════════════════════════════  ║  │
│  ║  TRANSACTION LEDGER                           ║  │
│  ║  ─────────────────────────────────────────    ║  │
│  ║  Jan 1   Query: "What is..."   -$0.026       ║  │
│  ║          └ OpenRouter: $0.024  Margin: $0.002 ║  │
│  ║  Jan 1   Deposit               +$5.00        ║  │
│  ║  ...                                          ║  │
│  ╚═══════════════════════════════════════════════╝  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Typography Hierarchy

Using existing project fonts:

| Element | Font | Usage |
|---------|------|-------|
| Page masthead | Playfair Display | "ACCOUNT" header |
| Section headers | Playfair Display | "BALANCE", "TRANSACTION LEDGER" |
| Transaction descriptions | Source Serif 4 | Query text, descriptions |
| Dollar amounts | IBM Plex Mono | All monetary values (financial precision) |
| Labels/UI | IBM Plex Sans | Buttons, metadata |

## Editorial Design Elements

- **Double-rule borders** around the balance card
- **Ledger style** for transactions (alternating subtle backgrounds)
- **Drop cap or decorative initial** on the balance amount
- **Column layout**: balance/deposit on left, history on right (desktop)
- **Responsive**: Stack vertically on mobile

## Page Sections

### 1. Balance Card
- Large, prominent balance display
- Styled as a "pull quote" or highlighted box
- Last updated timestamp

### 2. Add Funds
- Three deposit options: $5 / $20 / $50
- Styled as elegant "subscription" cards
- Clear CTAs with Stripe integration

### 3. Transaction Ledger
- Chronological list (newest first)
- Each entry shows:
  - Date
  - Description (query preview or "Deposit")
  - Amount (+/- with color coding)
  - Expandable: OpenRouter cost, margin breakdown, models used
- Pagination or infinite scroll for long history

### 4. Account Details (optional section)
- Email address
- OAuth provider (Google/GitHub icon)
- Member since date

## Implementation Changes

### New Files
- `frontend/src/components/Account.jsx` - Main account page
- `frontend/src/components/TransactionLedger.jsx` - Transaction history component
- `frontend/src/components/BalanceCard.jsx` - Balance display with deposit buttons

### Modified Files
- `frontend/src/App.jsx` - Add `/account` route
- `frontend/src/components/AvatarMenu.jsx` - Link to Account page (replace Settings)
- `frontend/src/api.js` - Add `getUsageHistory()` API call

### Deprecated
- `frontend/src/components/Settings.jsx` - Replace with Account page

## Navigation

- Avatar dropdown menu → "Account" link
- Or: Clicking balance indicator in header navigates to Account page
- Back navigation: Logo or browser back

---

*Related: [IMPLEMENTATION_PLAN_usage_based_billing.md](IMPLEMENTATION_PLAN_usage_based_billing.md)*
