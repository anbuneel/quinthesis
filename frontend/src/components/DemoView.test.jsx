import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import DemoView from './DemoView'

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
vi.mock('./Masthead', () => ({
  default: ({ children, variant }) => (
    <div data-testid="masthead" data-variant={variant}>
      {children}
    </div>
  ),
}))

vi.mock('./Stage1', () => ({
  default: ({ responses }) => (
    <div data-testid="stage1-mock">
      {responses.length} responses
    </div>
  ),
}))

vi.mock('./Stage2', () => ({
  default: ({ rankings }) => (
    <div data-testid="stage2-mock">
      {rankings.length} rankings
    </div>
  ),
}))

vi.mock('./Stage3', () => ({
  default: ({ finalResponse }) => (
    <div data-testid="stage3-mock">
      {finalResponse.model}
    </div>
  ),
}))

function renderWithRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('DemoView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('demo list view', () => {
    it('renders masthead with full variant', () => {
      renderWithRouter(<DemoView />)

      expect(screen.getByTestId('masthead')).toHaveAttribute('data-variant', 'full')
    })

    it('renders intro section', () => {
      renderWithRouter(<DemoView />)

      expect(screen.getByText('See It In Action')).toBeInTheDocument()
      expect(screen.getByText(/Why trust one AI when three can deliberate/)).toBeInTheDocument()
    })

    it('renders tagline', () => {
      renderWithRouter(<DemoView />)

      expect(screen.getByText('The second opinion your AI answer deserves')).toBeInTheDocument()
    })

    it('renders demo cards', () => {
      renderWithRouter(<DemoView />)

      // Check for at least one demo question
      expect(screen.getByText(/specialize or stay a generalist/i)).toBeInTheDocument()
    })

    it('shows model count on demo cards', () => {
      renderWithRouter(<DemoView />)

      // Each demo shows "3 models"
      const modelCounts = screen.getAllByText('3 models')
      expect(modelCounts.length).toBeGreaterThan(0)
    })

    it('renders Sign Up button', () => {
      renderWithRouter(<DemoView />)

      expect(screen.getByRole('button', { name: 'Sign Up' })).toBeInTheDocument()
    })

    it('renders Get Started button in footer', () => {
      renderWithRouter(<DemoView />)

      expect(screen.getByRole('button', { name: 'Get Started' })).toBeInTheDocument()
    })

    it('navigates to home when Sign Up clicked', async () => {
      const user = userEvent.setup()
      renderWithRouter(<DemoView />)

      await user.click(screen.getByRole('button', { name: 'Sign Up' }))

      expect(mockNavigate).toHaveBeenCalledWith('/')
    })

    it('navigates to home when Get Started clicked', async () => {
      const user = userEvent.setup()
      renderWithRouter(<DemoView />)

      await user.click(screen.getByRole('button', { name: 'Get Started' }))

      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  describe('demo detail view', () => {
    it('shows demo detail when demo card clicked', async () => {
      const user = userEvent.setup()
      renderWithRouter(<DemoView />)

      // Click on first demo card
      await user.click(screen.getByText(/specialize or stay a generalist/i))

      // Should show the question
      expect(screen.getByText(/specialize or stay a generalist/i)).toBeInTheDocument()
    })

    it('shows masthead with minimal variant in detail view', async () => {
      const user = userEvent.setup()
      renderWithRouter(<DemoView />)

      await user.click(screen.getByText(/specialize or stay a generalist/i))

      expect(screen.getByTestId('masthead')).toHaveAttribute('data-variant', 'minimal')
    })

    it('shows View All button in detail view', async () => {
      const user = userEvent.setup()
      renderWithRouter(<DemoView />)

      await user.click(screen.getByText(/specialize or stay a generalist/i))

      expect(screen.getByRole('button', { name: 'View All' })).toBeInTheDocument()
    })

    it('shows model count in detail view', async () => {
      const user = userEvent.setup()
      renderWithRouter(<DemoView />)

      await user.click(screen.getByText(/specialize or stay a generalist/i))

      expect(screen.getByText('3 models consulted')).toBeInTheDocument()
    })

    it('shows Example status badge', async () => {
      const user = userEvent.setup()
      renderWithRouter(<DemoView />)

      await user.click(screen.getByText(/specialize or stay a generalist/i))

      expect(screen.getByText('Example')).toBeInTheDocument()
    })

    it('returns to list when View All clicked', async () => {
      const user = userEvent.setup()
      renderWithRouter(<DemoView />)

      await user.click(screen.getByText(/specialize or stay a generalist/i))
      expect(screen.getByRole('button', { name: 'View All' })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'View All' }))

      // Should be back to list view
      expect(screen.getByText('See It In Action')).toBeInTheDocument()
    })
  })

  describe('response tabs', () => {
    it('shows Quintessence tab by default', async () => {
      const user = userEvent.setup()
      renderWithRouter(<DemoView />)

      await user.click(screen.getByText(/specialize or stay a generalist/i))

      expect(screen.getByRole('tab', { name: 'Quintessence' })).toHaveAttribute('aria-selected', 'true')
    })

    it('renders Stage3 content by default', async () => {
      const user = userEvent.setup()
      renderWithRouter(<DemoView />)

      await user.click(screen.getByText(/specialize or stay a generalist/i))

      expect(screen.getByTestId('stage3-mock')).toBeInTheDocument()
    })

    it('switches to Stage 1 when tab clicked', async () => {
      const user = userEvent.setup()
      renderWithRouter(<DemoView />)

      await user.click(screen.getByText(/specialize or stay a generalist/i))
      await user.click(screen.getByRole('tab', { name: 'Stage 1' }))

      expect(screen.getByRole('tab', { name: 'Stage 1' })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByTestId('stage1-mock')).toBeInTheDocument()
    })

    it('switches to Stage 2 when tab clicked', async () => {
      const user = userEvent.setup()
      renderWithRouter(<DemoView />)

      await user.click(screen.getByText(/specialize or stay a generalist/i))
      await user.click(screen.getByRole('tab', { name: 'Stage 2' }))

      expect(screen.getByRole('tab', { name: 'Stage 2' })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByTestId('stage2-mock')).toBeInTheDocument()
    })

    it('passes correct data to Stage1', async () => {
      const user = userEvent.setup()
      renderWithRouter(<DemoView />)

      await user.click(screen.getByText(/specialize or stay a generalist/i))
      await user.click(screen.getByRole('tab', { name: 'Stage 1' }))

      expect(screen.getByText('3 responses')).toBeInTheDocument()
    })

    it('passes correct data to Stage2', async () => {
      const user = userEvent.setup()
      renderWithRouter(<DemoView />)

      await user.click(screen.getByText(/specialize or stay a generalist/i))
      await user.click(screen.getByRole('tab', { name: 'Stage 2' }))

      expect(screen.getByText('3 rankings')).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has tablist role', async () => {
      const user = userEvent.setup()
      renderWithRouter(<DemoView />)

      await user.click(screen.getByText(/specialize or stay a generalist/i))

      expect(screen.getByRole('tablist')).toBeInTheDocument()
    })

    it('has aria-label on tablist', async () => {
      const user = userEvent.setup()
      renderWithRouter(<DemoView />)

      await user.click(screen.getByText(/specialize or stay a generalist/i))

      expect(screen.getByRole('tablist')).toHaveAttribute('aria-label', 'Response tabs')
    })

    it('tabs have correct aria-selected', async () => {
      const user = userEvent.setup()
      renderWithRouter(<DemoView />)

      await user.click(screen.getByText(/specialize or stay a generalist/i))

      expect(screen.getByRole('tab', { name: 'Quintessence' })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByRole('tab', { name: 'Stage 1' })).toHaveAttribute('aria-selected', 'false')
      expect(screen.getByRole('tab', { name: 'Stage 2' })).toHaveAttribute('aria-selected', 'false')
    })

    it('has tabpanel role for content', async () => {
      const user = userEvent.setup()
      renderWithRouter(<DemoView />)

      await user.click(screen.getByText(/specialize or stay a generalist/i))

      expect(screen.getByRole('tabpanel')).toBeInTheDocument()
    })
  })

  describe('CTA footer in detail view', () => {
    it('shows Sign Up CTA in detail view footer', async () => {
      const user = userEvent.setup()
      renderWithRouter(<DemoView />)

      await user.click(screen.getByText(/specialize or stay a generalist/i))

      expect(screen.getByRole('button', { name: 'Sign Up to Get Started' })).toBeInTheDocument()
    })

    it('navigates to home when footer CTA clicked', async () => {
      const user = userEvent.setup()
      renderWithRouter(<DemoView />)

      await user.click(screen.getByText(/specialize or stay a generalist/i))
      await user.click(screen.getByRole('button', { name: 'Sign Up to Get Started' }))

      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  describe('SEO', () => {
    it('sets document title', () => {
      renderWithRouter(<DemoView />)

      expect(document.title).toBe('Example Deliberations | Quinthesis')
    })
  })
})
