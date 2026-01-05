import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Settings from './Settings'

// Mock API
vi.mock('../api', () => ({
  billing: {
    getDepositOptions: vi.fn(),
    getUsageHistory: vi.fn(),
    purchaseDeposit: vi.fn(),
  },
}))

import { billing } from '../api'

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

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  userEmail: 'test@example.com',
  userBalance: 5.0,
  onRefreshBalance: vi.fn(),
}

describe('Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    billing.getDepositOptions.mockResolvedValue(mockDepositOptions)
    billing.getUsageHistory.mockResolvedValue(mockUsageHistory)
  })

  describe('rendering', () => {
    it('renders nothing when isOpen is false', () => {
      render(<Settings {...defaultProps} isOpen={false} />)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('renders dialog when isOpen is true', () => {
      render(<Settings {...defaultProps} />)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('renders title', () => {
      render(<Settings {...defaultProps} />)

      expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    it('renders user email', async () => {
      render(<Settings {...defaultProps} />)

      expect(screen.getByText('test@example.com')).toBeInTheDocument()
    })

    it('renders balance', () => {
      render(<Settings {...defaultProps} />)

      expect(screen.getByText('$5.00')).toBeInTheDocument()
      expect(screen.getByText('available')).toBeInTheDocument()
    })

    it('renders close button', () => {
      render(<Settings {...defaultProps} />)

      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
    })
  })

  describe('deposit options', () => {
    it('loads deposit options on open', async () => {
      render(<Settings {...defaultProps} />)

      await waitFor(() => {
        expect(billing.getDepositOptions).toHaveBeenCalled()
      })
    })

    it('shows deposit options after loading', async () => {
      render(<Settings {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('$1 Try It')).toBeInTheDocument()
      })
      expect(screen.getByText('$5 Deposit')).toBeInTheDocument()
    })

    it('shows loading state', () => {
      billing.getDepositOptions.mockReturnValue(new Promise(() => {}))
      render(<Settings {...defaultProps} />)

      expect(screen.getByText('Loading options...')).toBeInTheDocument()
    })

    it('shows error when loading fails', async () => {
      billing.getDepositOptions.mockRejectedValue(new Error('Failed'))
      render(<Settings {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Failed to load deposit options')).toBeInTheDocument()
      })
    })
  })

  describe('deposit purchase', () => {
    it('calls purchaseDeposit when option clicked', async () => {
      const user = userEvent.setup()
      billing.purchaseDeposit.mockResolvedValue()
      render(<Settings {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('$1.00')).toBeInTheDocument()
      })

      await user.click(screen.getByText('$1.00'))

      expect(billing.purchaseDeposit).toHaveBeenCalledWith('opt-1')
    })
  })

  describe('usage history', () => {
    it('shows usage history toggle', async () => {
      render(<Settings {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Usage History')).toBeInTheDocument()
      })
    })

    it('loads history when toggle clicked', async () => {
      const user = userEvent.setup()
      render(<Settings {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Usage History')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Usage History'))

      await waitFor(() => {
        expect(billing.getUsageHistory).toHaveBeenCalled()
      })
    })

    it('shows empty message when no history', async () => {
      billing.getUsageHistory.mockResolvedValue([])
      const user = userEvent.setup()
      render(<Settings {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Usage History')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Usage History'))

      await waitFor(() => {
        expect(screen.getByText('No usage yet')).toBeInTheDocument()
      })
    })
  })

  describe('interactions', () => {
    it('calls onClose when close button clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<Settings {...defaultProps} onClose={onClose} />)

      await user.click(screen.getByRole('button', { name: 'Close' }))

      expect(onClose).toHaveBeenCalled()
    })

    it('calls onClose when overlay clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<Settings {...defaultProps} onClose={onClose} />)

      // Click the overlay (the element with role="presentation")
      const overlay = document.querySelector('.settings-overlay')
      await user.click(overlay)

      expect(onClose).toHaveBeenCalled()
    })

    it('calls onClose on Escape key', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<Settings {...defaultProps} onClose={onClose} />)

      await user.keyboard('{Escape}')

      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    it('has aria-modal attribute', () => {
      render(<Settings {...defaultProps} />)

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    })

    it('has aria-labelledby pointing to title', () => {
      render(<Settings {...defaultProps} />)

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'settings-title')
    })

    it('usage history toggle has aria-expanded', async () => {
      render(<Settings {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Usage History/i })).toHaveAttribute('aria-expanded', 'false')
      })
    })
  })
})
