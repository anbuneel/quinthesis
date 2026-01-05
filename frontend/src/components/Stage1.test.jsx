import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import Stage1 from './Stage1'

const mockResponses = [
  { model: 'openai/gpt-4', response: 'This is the **first** response.' },
  { model: 'anthropic/claude-3', response: 'This is the second response.' },
  { model: 'google/gemini-pro', response: 'This is the third response.' },
]

describe('Stage1', () => {
  describe('rendering', () => {
    it('renders null when responses is undefined', () => {
      const { container } = render(<Stage1 responses={undefined} />)
      expect(container.firstChild).toBeNull()
    })

    it('renders null when responses is empty', () => {
      const { container } = render(<Stage1 responses={[]} />)
      expect(container.firstChild).toBeNull()
    })

    it('renders tabs for each response', () => {
      render(<Stage1 responses={mockResponses} />)

      expect(screen.getByRole('tab', { name: /Model A/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /Model B/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /Model C/i })).toBeInTheDocument()
    })

    it('renders stage heading and description', () => {
      render(<Stage1 responses={mockResponses} />)

      expect(screen.getByText('Stage 1: Responses')).toBeInTheDocument()
      expect(screen.getByText('Initial responses from each model')).toBeInTheDocument()
    })

    it('shows first model response by default', () => {
      render(<Stage1 responses={mockResponses} />)

      expect(screen.getByText('openai/gpt-4')).toBeInTheDocument()
      expect(screen.getByText(/first/i)).toBeInTheDocument()
    })

    it('renders markdown content correctly', () => {
      render(<Stage1 responses={mockResponses} />)

      // The **first** should render as bold
      const boldText = screen.getByText('first')
      expect(boldText.tagName).toBe('STRONG')
    })
  })

  describe('tab interaction', () => {
    it('switches content when clicking different tabs', async () => {
      const user = userEvent.setup()
      render(<Stage1 responses={mockResponses} />)

      // Initially shows first response
      expect(screen.getByText('openai/gpt-4')).toBeInTheDocument()

      // Click second tab
      await user.click(screen.getByRole('tab', { name: /Model B/i }))

      expect(screen.getByText('anthropic/claude-3')).toBeInTheDocument()
      expect(screen.getByText('This is the second response.')).toBeInTheDocument()
    })

    it('updates aria-selected on tab click', async () => {
      const user = userEvent.setup()
      render(<Stage1 responses={mockResponses} />)

      const tabA = screen.getByRole('tab', { name: /Model A/i })
      const tabB = screen.getByRole('tab', { name: /Model B/i })

      expect(tabA).toHaveAttribute('aria-selected', 'true')
      expect(tabB).toHaveAttribute('aria-selected', 'false')

      await user.click(tabB)

      expect(tabA).toHaveAttribute('aria-selected', 'false')
      expect(tabB).toHaveAttribute('aria-selected', 'true')
    })
  })

  describe('keyboard navigation', () => {
    it('moves to next tab on ArrowRight', async () => {
      const user = userEvent.setup()
      render(<Stage1 responses={mockResponses} />)

      const tabA = screen.getByRole('tab', { name: /Model A/i })
      tabA.focus()

      await user.keyboard('{ArrowRight}')

      expect(screen.getByRole('tab', { name: /Model B/i })).toHaveFocus()
      expect(screen.getByText('anthropic/claude-3')).toBeInTheDocument()
    })

    it('moves to previous tab on ArrowLeft', async () => {
      const user = userEvent.setup()
      render(<Stage1 responses={mockResponses} />)

      // First switch to tab B
      await user.click(screen.getByRole('tab', { name: /Model B/i }))

      const tabB = screen.getByRole('tab', { name: /Model B/i })
      tabB.focus()

      await user.keyboard('{ArrowLeft}')

      expect(screen.getByRole('tab', { name: /Model A/i })).toHaveFocus()
    })

    it('wraps from last to first on ArrowRight', async () => {
      const user = userEvent.setup()
      render(<Stage1 responses={mockResponses} />)

      // Go to last tab (Model C)
      await user.click(screen.getByRole('tab', { name: /Model C/i }))

      const tabC = screen.getByRole('tab', { name: /Model C/i })
      tabC.focus()

      await user.keyboard('{ArrowRight}')

      expect(screen.getByRole('tab', { name: /Model A/i })).toHaveFocus()
    })

    it('goes to first tab on Home', async () => {
      const user = userEvent.setup()
      render(<Stage1 responses={mockResponses} />)

      // Go to tab C
      await user.click(screen.getByRole('tab', { name: /Model C/i }))

      const tabC = screen.getByRole('tab', { name: /Model C/i })
      tabC.focus()

      await user.keyboard('{Home}')

      expect(screen.getByRole('tab', { name: /Model A/i })).toHaveFocus()
    })

    it('goes to last tab on End', async () => {
      const user = userEvent.setup()
      render(<Stage1 responses={mockResponses} />)

      const tabA = screen.getByRole('tab', { name: /Model A/i })
      tabA.focus()

      await user.keyboard('{End}')

      expect(screen.getByRole('tab', { name: /Model C/i })).toHaveFocus()
    })
  })

  describe('accessibility', () => {
    it('has proper ARIA attributes on tablist', () => {
      render(<Stage1 responses={mockResponses} />)

      const tablist = screen.getByRole('tablist')
      expect(tablist).toHaveAttribute('aria-label', 'Stage 1 responses')
    })

    it('has proper ARIA controls linking tab to panel', () => {
      render(<Stage1 responses={mockResponses} />)

      const tab = screen.getByRole('tab', { name: /Model A/i })
      const panelId = tab.getAttribute('aria-controls')

      expect(panelId).toBe('stage1-panel-0')
      expect(screen.getByRole('tabpanel')).toHaveAttribute('id', panelId)
    })

    it('only active tab has tabIndex 0', () => {
      render(<Stage1 responses={mockResponses} />)

      const tabs = screen.getAllByRole('tab')

      expect(tabs[0]).toHaveAttribute('tabIndex', '0')
      expect(tabs[1]).toHaveAttribute('tabIndex', '-1')
      expect(tabs[2]).toHaveAttribute('tabIndex', '-1')
    })
  })
})
