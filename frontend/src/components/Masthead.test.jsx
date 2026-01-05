import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Masthead from './Masthead'

// Mock navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock child components
vi.mock('./AvatarMenu', () => ({
  default: ({ userEmail, onLogout }) => (
    <div data-testid="avatar-menu">{userEmail}</div>
  ),
}))

vi.mock('./CreditBalance', () => ({
  default: ({ balance, isByokMode, onClick }) => (
    <button data-testid="credit-balance" onClick={onClick}>
      ${balance}
    </button>
  ),
}))

function renderWithRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('Masthead', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('full variant (default)', () => {
    it('renders title', () => {
      renderWithRouter(<Masthead />)

      expect(screen.getByText('The')).toBeInTheDocument()
      expect(screen.getByText('Quinthesis')).toBeInTheDocument()
    })

    it('renders Archive button when onToggleSidebar provided', () => {
      renderWithRouter(<Masthead onToggleSidebar={vi.fn()} />)

      expect(screen.getByRole('button', { name: /Archive/i })).toBeInTheDocument()
    })

    it('calls onToggleSidebar when Archive clicked', async () => {
      const user = userEvent.setup()
      const onToggle = vi.fn()
      renderWithRouter(<Masthead onToggleSidebar={onToggle} />)

      await user.click(screen.getByRole('button', { name: /Archive/i }))

      expect(onToggle).toHaveBeenCalled()
    })

    it('sets aria-expanded on Archive button', () => {
      renderWithRouter(<Masthead onToggleSidebar={vi.fn()} isSidebarOpen={true} />)

      expect(screen.getByRole('button', { name: /Archive/i })).toHaveAttribute('aria-expanded', 'true')
    })

    it('renders user email via AvatarMenu', () => {
      renderWithRouter(<Masthead userEmail="test@example.com" />)

      expect(screen.getByTestId('avatar-menu')).toHaveTextContent('test@example.com')
    })

    it('renders credit balance', () => {
      renderWithRouter(<Masthead userBalance={5.0} />)

      expect(screen.getByTestId('credit-balance')).toHaveTextContent('$5')
    })

    it('renders New Inquiry button when showNewInquiry is true', () => {
      renderWithRouter(
        <Masthead showNewInquiry={true} onNewInquiry={vi.fn()} />
      )

      expect(screen.getByRole('button', { name: /New Inquiry/i })).toBeInTheDocument()
    })

    it('calls onNewInquiry when New Inquiry clicked', async () => {
      const user = userEvent.setup()
      const onNew = vi.fn()
      renderWithRouter(<Masthead showNewInquiry={true} onNewInquiry={onNew} />)

      await user.click(screen.getByRole('button', { name: /New Inquiry/i }))

      expect(onNew).toHaveBeenCalled()
    })

    it('navigates home when title clicked', async () => {
      const user = userEvent.setup()
      renderWithRouter(<Masthead />)

      await user.click(screen.getByText('Quinthesis'))

      expect(mockNavigate).toHaveBeenCalledWith('/')
    })

    it('navigates to account when balance clicked', async () => {
      const user = userEvent.setup()
      renderWithRouter(<Masthead userBalance={5.0} />)

      await user.click(screen.getByTestId('credit-balance'))

      expect(mockNavigate).toHaveBeenCalledWith('/account')
    })

    it('renders children', () => {
      renderWithRouter(
        <Masthead>
          <button>Custom Button</button>
        </Masthead>
      )

      expect(screen.getByRole('button', { name: 'Custom Button' })).toBeInTheDocument()
    })
  })

  describe('centered variant', () => {
    it('renders title without Archive button', () => {
      renderWithRouter(<Masthead variant="centered" />)

      expect(screen.getByText('Quinthesis')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Archive/i })).not.toBeInTheDocument()
    })

    it('does not render user controls', () => {
      renderWithRouter(
        <Masthead variant="centered" userEmail="test@example.com" userBalance={5.0} />
      )

      expect(screen.queryByTestId('avatar-menu')).not.toBeInTheDocument()
      expect(screen.queryByTestId('credit-balance')).not.toBeInTheDocument()
    })
  })

  describe('minimal variant', () => {
    it('renders clickable title', () => {
      renderWithRouter(<Masthead variant="minimal" />)

      expect(screen.getByText('Quinthesis')).toBeInTheDocument()
      expect(screen.getByRole('link')).toBeInTheDocument()
    })

    it('navigates home when title clicked', async () => {
      const user = userEvent.setup()
      renderWithRouter(<Masthead variant="minimal" />)

      await user.click(screen.getByText('Quinthesis'))

      expect(mockNavigate).toHaveBeenCalledWith('/')
    })

    it('navigates home on Enter key', async () => {
      const user = userEvent.setup()
      renderWithRouter(<Masthead variant="minimal" />)

      const title = screen.getByRole('link')
      title.focus()
      await user.keyboard('{Enter}')

      expect(mockNavigate).toHaveBeenCalledWith('/')
    })

    it('renders children', () => {
      renderWithRouter(
        <Masthead variant="minimal">
          <button>Back Home</button>
        </Masthead>
      )

      expect(screen.getByRole('button', { name: 'Back Home' })).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('Archive button has aria-controls', () => {
      renderWithRouter(<Masthead onToggleSidebar={vi.fn()} />)

      expect(screen.getByRole('button', { name: /Archive/i })).toHaveAttribute('aria-controls', 'sidebar')
    })

    it('title link has tabIndex', () => {
      renderWithRouter(<Masthead variant="minimal" />)

      expect(screen.getByRole('link')).toHaveAttribute('tabIndex', '0')
    })
  })
})
