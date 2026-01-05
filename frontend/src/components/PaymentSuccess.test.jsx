import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import PaymentSuccess from './PaymentSuccess'

// Mock navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock API
vi.mock('../api', () => ({
  billing: {
    getBalance: vi.fn(),
  },
}))

// Mock Masthead
vi.mock('./Masthead', () => ({
  default: ({ variant }) => <div data-testid="masthead" data-variant={variant} />,
}))

import { billing } from '../api'

function renderWithRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('PaymentSuccess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    billing.getBalance.mockResolvedValue({ balance: 10.0 })
  })

  describe('rendering', () => {
    it('renders masthead with minimal variant', () => {
      renderWithRouter(<PaymentSuccess onRefreshBalance={vi.fn()} />)

      expect(screen.getByTestId('masthead')).toHaveAttribute('data-variant', 'minimal')
    })

    it('renders success heading', () => {
      renderWithRouter(<PaymentSuccess onRefreshBalance={vi.fn()} />)

      expect(screen.getByText('Payment Successful')).toBeInTheDocument()
    })

    it('renders continue button', () => {
      renderWithRouter(<PaymentSuccess onRefreshBalance={vi.fn()} />)

      expect(screen.getByRole('button', { name: /Continue to Quinthesis/i })).toBeInTheDocument()
    })
  })

  describe('loading state', () => {
    it('shows loading message initially', () => {
      renderWithRouter(<PaymentSuccess onRefreshBalance={vi.fn()} />)

      expect(screen.getByText('Updating your balance...')).toBeInTheDocument()
    })
  })

  describe('navigation', () => {
    it('navigates to home when continue clicked', async () => {
      const user = userEvent.setup()
      renderWithRouter(<PaymentSuccess onRefreshBalance={vi.fn()} />)

      await user.click(screen.getByRole('button', { name: /Continue to Quinthesis/i }))

      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  describe('balance loading', () => {
    it('calls getBalance API', async () => {
      renderWithRouter(<PaymentSuccess onRefreshBalance={vi.fn()} />)

      // Wait a bit for the timeout to trigger (real timers)
      await waitFor(() => {
        expect(billing.getBalance).toHaveBeenCalled()
      }, { timeout: 3000 })
    })
  })
})
