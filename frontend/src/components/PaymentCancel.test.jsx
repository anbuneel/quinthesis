import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import PaymentCancel from './PaymentCancel'

// Mock navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock Masthead
vi.mock('./Masthead', () => ({
  default: ({ variant }) => <div data-testid="masthead" data-variant={variant} />,
}))

function renderWithRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('PaymentCancel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders masthead with minimal variant', () => {
      renderWithRouter(<PaymentCancel />)

      expect(screen.getByTestId('masthead')).toHaveAttribute('data-variant', 'minimal')
    })

    it('renders cancelled heading', () => {
      renderWithRouter(<PaymentCancel />)

      expect(screen.getByText('Payment Cancelled')).toBeInTheDocument()
    })

    it('renders cancellation message', () => {
      renderWithRouter(<PaymentCancel />)

      expect(screen.getByText('Your payment was cancelled. No charges were made.')).toBeInTheDocument()
    })

    it('renders return button', () => {
      renderWithRouter(<PaymentCancel />)

      expect(screen.getByRole('button', { name: /Return to Quinthesis/i })).toBeInTheDocument()
    })
  })

  describe('navigation', () => {
    it('navigates to home when return button clicked', async () => {
      const user = userEvent.setup()
      renderWithRouter(<PaymentCancel />)

      await user.click(screen.getByRole('button', { name: /Return to Quinthesis/i }))

      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })
})
