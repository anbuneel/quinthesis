import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Account from './Account'

// Mock react-router-dom navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock API modules
vi.mock('../api', () => ({
  billing: {
    getBalance: vi.fn(),
    getDepositOptions: vi.fn(),
    getUsageHistory: vi.fn(),
    getApiMode: vi.fn(),
    purchaseDeposit: vi.fn(),
    setBYOKKey: vi.fn(),
    deleteBYOKKey: vi.fn(),
  },
  auth: {
    getMe: vi.fn(),
    deleteAccount: vi.fn(),
    exportData: vi.fn(),
  },
}))

// Mock child components
vi.mock('./ConfirmDialog', () => ({
  default: ({ isOpen, onConfirm, onCancel, confirmLabel }) =>
    isOpen ? (
      <div data-testid="confirm-dialog">
        <button onClick={onConfirm}>{confirmLabel}</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null,
}))

vi.mock('./Masthead', () => ({
  default: ({ children }) => <div data-testid="masthead-mock">{children}</div>,
}))

import { billing, auth } from '../api'

const mockBalance = {
  balance: 5.0,
  total_deposited: 10.0,
  total_spent: 5.0,
}

const mockDepositOptions = [
  { id: 'opt-1', name: '$1 Try It', amount_cents: 100 },
  { id: 'opt-2', name: '$5 Deposit', amount_cents: 500 },
]

const mockUsageHistory = [
  {
    id: 'usage-1',
    created_at: '2026-01-05T12:00:00Z',
    total_cost: 0.15,
    openrouter_cost: 0.14,
    margin_cost: 0.01,
  },
]

const mockApiMode = {
  mode: 'credits',
  has_byok_key: false,
  byok_key_preview: null,
  has_provisioned_key: true,
  balance: 5.0,
}

const mockUserInfo = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  oauth_provider: 'google',
  created_at: '2025-01-01T00:00:00Z',
}

const defaultProps = {
  userEmail: 'test@example.com',
  userBalance: 5.0,
  isByokMode: false,
  onLogout: vi.fn(),
  onRefreshBalance: vi.fn(),
  onToggleSidebar: vi.fn(),
  isSidebarOpen: false,
}

function renderWithRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('Account', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Set up default mock returns
    auth.getMe.mockResolvedValue(mockUserInfo)
    billing.getBalance.mockResolvedValue(mockBalance)
    billing.getDepositOptions.mockResolvedValue(mockDepositOptions)
    billing.getUsageHistory.mockResolvedValue(mockUsageHistory)
    billing.getApiMode.mockResolvedValue(mockApiMode)
  })

  describe('loading state', () => {
    it('shows loading spinner initially', () => {
      // Make API calls hang
      auth.getMe.mockReturnValue(new Promise(() => {}))

      renderWithRouter(<Account {...defaultProps} />)

      expect(screen.getByText('Loading account...')).toBeInTheDocument()
    })
  })

  describe('after loading', () => {
    it('renders Account Balance section', async () => {
      renderWithRouter(<Account {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Account Balance')).toBeInTheDocument()
      })
      expect(screen.getByText('5.00')).toBeInTheDocument()
      expect(screen.getByText('available')).toBeInTheDocument()
    })

    it('renders balance stats', async () => {
      renderWithRouter(<Account {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('$10.00')).toBeInTheDocument()
      })
      expect(screen.getByText('deposited')).toBeInTheDocument()
      expect(screen.getByText('$5.00')).toBeInTheDocument()
      expect(screen.getByText('spent')).toBeInTheDocument()
    })

    it('renders deposit options', async () => {
      renderWithRouter(<Account {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Add Funds')).toBeInTheDocument()
      })
      expect(screen.getByText('$1')).toBeInTheDocument()
      expect(screen.getByText('$5')).toBeInTheDocument()
    })

    it('renders pricing explainer', async () => {
      renderWithRouter(<Account {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('How Pricing Works')).toBeInTheDocument()
      })
      expect(screen.getByText(/actual AI provider costs \+ 5% service fee/)).toBeInTheDocument()
    })

    it('renders member info footer', async () => {
      renderWithRouter(<Account {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/Member since/)).toBeInTheDocument()
      })
      expect(screen.getByText(/via google/)).toBeInTheDocument()
    })
  })

  describe('tab navigation', () => {
    it('shows Account tab active by default', async () => {
      renderWithRouter(<Account {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Account' })).toHaveAttribute('aria-selected', 'true')
      })
    })

    it('switches to History tab when clicked', async () => {
      const user = userEvent.setup()
      renderWithRouter(<Account {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'History' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('tab', { name: 'History' }))

      expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByText('Usage History')).toBeInTheDocument()
    })

    it('has correct ARIA attributes on tabs', async () => {
      renderWithRouter(<Account {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('tablist')).toHaveAttribute('aria-label', 'Account sections')
      })
    })
  })

  describe('usage history', () => {
    it('shows usage history in History tab', async () => {
      const user = userEvent.setup()
      renderWithRouter(<Account {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'History' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('tab', { name: 'History' }))

      expect(screen.getByText('Usage History')).toBeInTheDocument()
      expect(screen.getByText('−$0.1500')).toBeInTheDocument()
    })

    it('shows summary stats when history exists', async () => {
      const user = userEvent.setup()
      renderWithRouter(<Account {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'History' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('tab', { name: 'History' }))

      expect(screen.getByText('1')).toBeInTheDocument() // queries count
      expect(screen.getByText('queries')).toBeInTheDocument()
    })

    it('expands transaction details on click', async () => {
      const user = userEvent.setup()
      renderWithRouter(<Account {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'History' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('tab', { name: 'History' }))

      // Click to expand
      await user.click(screen.getByText('Query'))

      expect(screen.getByText('API Cost')).toBeInTheDocument()
      expect(screen.getByText('Service Fee (5%)')).toBeInTheDocument()
    })

    it('shows empty message when no history', async () => {
      billing.getUsageHistory.mockResolvedValue([])
      const user = userEvent.setup()

      renderWithRouter(<Account {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'History' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('tab', { name: 'History' }))

      expect(screen.getByText(/No usage yet/)).toBeInTheDocument()
    })
  })

  describe('BYOK functionality', () => {
    it('shows BYOK input when not in BYOK mode', async () => {
      renderWithRouter(<Account {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('API Settings')).toBeInTheDocument()
      })
      expect(screen.getByPlaceholderText('sk-or-v1-...')).toBeInTheDocument()
      expect(screen.getByText('Save Key')).toBeInTheDocument()
    })

    it('shows active BYOK key when in BYOK mode', async () => {
      billing.getApiMode.mockResolvedValue({
        ...mockApiMode,
        mode: 'byok',
        has_byok_key: true,
        byok_key_preview: '...abc123',
      })

      renderWithRouter(<Account {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Your OpenRouter API Key')).toBeInTheDocument()
      })
      expect(screen.getByText('...abc123')).toBeInTheDocument()
      expect(screen.getByText('Remove Key')).toBeInTheDocument()
    })

    it('saves BYOK key when submitted', async () => {
      const user = userEvent.setup()
      billing.setBYOKKey.mockResolvedValue({
        mode: 'byok',
        has_byok_key: true,
        byok_key_preview: '...newkey',
      })

      renderWithRouter(<Account {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('sk-or-v1-...')).toBeInTheDocument()
      })

      await user.type(screen.getByPlaceholderText('sk-or-v1-...'), 'sk-or-v1-testkey')
      await user.click(screen.getByText('Save Key'))

      await waitFor(() => {
        expect(billing.setBYOKKey).toHaveBeenCalledWith('sk-or-v1-testkey')
      })
    })

    it('shows error when key validation fails', async () => {
      const user = userEvent.setup()
      billing.setBYOKKey.mockRejectedValue(new Error('Invalid API key'))

      renderWithRouter(<Account {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('sk-or-v1-...')).toBeInTheDocument()
      })

      await user.type(screen.getByPlaceholderText('sk-or-v1-...'), 'invalid-key')
      await user.click(screen.getByText('Save Key'))

      await waitFor(() => {
        expect(screen.getByText('Invalid API key')).toBeInTheDocument()
      })
    })
  })

  describe('account deletion', () => {
    it('shows delete account section', async () => {
      renderWithRouter(<Account {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Data & Privacy')).toBeInTheDocument()
      })
      // Multiple elements with "Delete Account" - heading and button
      expect(screen.getAllByText('Delete Account').length).toBe(2)
    })

    it('opens confirmation dialog when delete clicked', async () => {
      const user = userEvent.setup()
      renderWithRouter(<Account {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Delete Account' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Delete Account' }))

      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    })

    it('calls deleteAccount and logout on confirm', async () => {
      const user = userEvent.setup()
      auth.deleteAccount.mockResolvedValue({})

      renderWithRouter(<Account {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Delete Account' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Delete Account' }))
      await user.click(screen.getByText('Delete My Account'))

      await waitFor(() => {
        expect(auth.deleteAccount).toHaveBeenCalled()
        expect(defaultProps.onLogout).toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('/')
      })
    })
  })

  describe('data export', () => {
    it('shows export data button', async () => {
      renderWithRouter(<Account {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Export Your Data')).toBeInTheDocument()
      })
      expect(screen.getByRole('button', { name: /Download/i })).toBeInTheDocument()
    })

    it('calls exportData when clicked', async () => {
      const user = userEvent.setup()
      auth.exportData.mockResolvedValue()

      renderWithRouter(<Account {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Download/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /Download/i }))

      await waitFor(() => {
        expect(auth.exportData).toHaveBeenCalled()
      })
    })
  })

  describe('deposit functionality', () => {
    it('calls purchaseDeposit when deposit option clicked', async () => {
      const user = userEvent.setup()
      billing.purchaseDeposit.mockResolvedValue()

      renderWithRouter(<Account {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('$1')).toBeInTheDocument()
      })

      await user.click(screen.getByText('$1').closest('button'))

      await waitFor(() => {
        expect(billing.purchaseDeposit).toHaveBeenCalledWith('opt-1')
      })
    })
  })

  describe('navigation', () => {
    it('renders Home button', async () => {
      renderWithRouter(<Account {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Home')).toBeInTheDocument()
      })
    })

    it('navigates home when Home button clicked', async () => {
      const user = userEvent.setup()
      renderWithRouter(<Account {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Home')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Home'))

      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  describe('error handling', () => {
    it('shows error when data loading fails', async () => {
      auth.getMe.mockRejectedValue(new Error('Network error'))

      renderWithRouter(<Account {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/Failed to load account data/)).toBeInTheDocument()
      })
    })
  })
})
