import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import Stage2 from './Stage2'

const mockRankings = [
  {
    model: 'openai/gpt-4',
    ranking: 'FINAL RANKING:\n1. Response A\n2. Response B\n3. Response C',
    parsed_ranking: ['Response A', 'Response B', 'Response C'],
  },
  {
    model: 'anthropic/claude-3',
    ranking: 'FINAL RANKING:\n1. Response B\n2. Response A\n3. Response C',
    parsed_ranking: ['Response B', 'Response A', 'Response C'],
  },
  {
    model: 'google/gemini-pro',
    ranking: 'FINAL RANKING:\n1. Response A\n2. Response C\n3. Response B',
    parsed_ranking: ['Response A', 'Response C', 'Response B'],
  },
]

const mockLabelToModel = {
  'Response A': 'openai/gpt-4',
  'Response B': 'anthropic/claude-3',
  'Response C': 'google/gemini-pro',
}

const mockAggregateRankings = [
  { model: 'openai/gpt-4', average_rank: 1.33, rankings_count: 3 },
  { model: 'anthropic/claude-3', average_rank: 2.0, rankings_count: 3 },
  { model: 'google/gemini-pro', average_rank: 2.67, rankings_count: 3 },
]

// Extended mock with more than 3 items for toggle testing
const mockAggregateRankingsExtended = [
  ...mockAggregateRankings,
  { model: 'meta/llama-3', average_rank: 3.5, rankings_count: 2 },
]

describe('Stage2', () => {
  describe('rendering', () => {
    it('renders null when rankings is undefined', () => {
      const { container } = render(<Stage2 rankings={undefined} />)
      expect(container.firstChild).toBeNull()
    })

    it('renders null when rankings is empty', () => {
      const { container } = render(<Stage2 rankings={[]} />)
      expect(container.firstChild).toBeNull()
    })

    it('renders stage heading and description', () => {
      render(<Stage2 rankings={mockRankings} />)

      expect(screen.getByText('Stage 2: Review')).toBeInTheDocument()
      expect(screen.getByText(/Each model evaluated all responses/i)).toBeInTheDocument()
    })

    it('renders tabs for each ranking', () => {
      render(<Stage2 rankings={mockRankings} />)

      expect(screen.getByRole('tab', { name: /Model A/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /Model B/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /Model C/i })).toBeInTheDocument()
    })

    it('shows first ranking by default', () => {
      render(<Stage2 rankings={mockRankings} labelToModel={mockLabelToModel} />)

      expect(screen.getByText('openai/gpt-4')).toBeInTheDocument()
    })
  })

  describe('aggregate rankings (leaderboard)', () => {
    it('renders aggregate rankings when provided', () => {
      render(
        <Stage2
          rankings={mockRankings}
          labelToModel={mockLabelToModel}
          aggregateRankings={mockAggregateRankings}
        />
      )

      expect(screen.getByText('Rankings')).toBeInTheDocument()
      // Use selector to target leaderboard specifically
      const standingModels = document.querySelectorAll('.standing-model')
      expect(standingModels[0].textContent).toBe('gpt-4')
      expect(screen.getByText('1.33')).toBeInTheDocument()
      // Check votes exist (multiple items may have same count)
      const votes = screen.getAllByText('3 votes')
      expect(votes.length).toBeGreaterThan(0)
    })

    it('shows position badges with correct styling', () => {
      render(
        <Stage2
          rankings={mockRankings}
          labelToModel={mockLabelToModel}
          aggregateRankings={mockAggregateRankings}
        />
      )

      const badges = document.querySelectorAll('.position-badge')
      expect(badges[0]).toHaveClass('gold')
      expect(badges[1]).toHaveClass('silver')
      expect(badges[2]).toHaveClass('bronze')
    })

    it('shows top 3 by default when more than 3 rankings', () => {
      render(
        <Stage2
          rankings={mockRankings}
          labelToModel={mockLabelToModel}
          aggregateRankings={mockAggregateRankingsExtended}
        />
      )

      // Should show top 3 in the standings list
      const standingModels = document.querySelectorAll('.standing-model')
      expect(standingModels.length).toBe(3)
      expect(standingModels[0].textContent).toBe('gpt-4')
      expect(standingModels[1].textContent).toBe('claude-3')
      expect(standingModels[2].textContent).toBe('gemini-pro')

      // 4th item should be hidden (llama-3 not in standings)
      expect(screen.queryByText('llama-3')).not.toBeInTheDocument()
    })

    it('shows toggle button when more than 3 rankings', () => {
      render(
        <Stage2
          rankings={mockRankings}
          labelToModel={mockLabelToModel}
          aggregateRankings={mockAggregateRankingsExtended}
        />
      )

      expect(screen.getByRole('button', { name: /Show all/i })).toBeInTheDocument()
    })

    it('toggles between showing all and top 3', async () => {
      const user = userEvent.setup()
      render(
        <Stage2
          rankings={mockRankings}
          labelToModel={mockLabelToModel}
          aggregateRankings={mockAggregateRankingsExtended}
        />
      )

      // Initially hidden
      expect(screen.queryByText('llama-3')).not.toBeInTheDocument()

      // Click to show all
      await user.click(screen.getByRole('button', { name: /Show all/i }))

      // Now visible
      expect(screen.getByText('llama-3')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Show top 3/i })).toBeInTheDocument()

      // Click to hide again
      await user.click(screen.getByRole('button', { name: /Show top 3/i }))
      expect(screen.queryByText('llama-3')).not.toBeInTheDocument()
    })

    it('does not show toggle when exactly 3 or fewer rankings', () => {
      render(
        <Stage2
          rankings={mockRankings}
          labelToModel={mockLabelToModel}
          aggregateRankings={mockAggregateRankings}
        />
      )

      expect(screen.queryByRole('button', { name: /Show all/i })).not.toBeInTheDocument()
    })

    it('does not render leaderboard when aggregateRankings is empty', () => {
      render(
        <Stage2
          rankings={mockRankings}
          labelToModel={mockLabelToModel}
          aggregateRankings={[]}
        />
      )

      expect(screen.queryByText('Rankings')).not.toBeInTheDocument()
    })
  })

  describe('de-anonymization', () => {
    it('replaces Response labels with model names in bold', () => {
      render(
        <Stage2
          rankings={mockRankings}
          labelToModel={mockLabelToModel}
        />
      )

      // The ranking text should have model names in bold
      // "Response A" should become "**gpt-4**" which renders as bold
      const strongElements = document.querySelectorAll('strong')
      const strongTexts = Array.from(strongElements).map(el => el.textContent)

      // Should contain de-anonymized model names
      expect(strongTexts.some(text => text.includes('gpt-4'))).toBe(true)
    })

    it('shows parsed ranking with de-anonymized model names', () => {
      render(
        <Stage2
          rankings={mockRankings}
          labelToModel={mockLabelToModel}
        />
      )

      expect(screen.getByText('Extracted Ranking:')).toBeInTheDocument()

      // Check the ordered list has model names
      const listItems = document.querySelectorAll('.extracted-list li')
      expect(listItems[0].textContent).toBe('gpt-4')
      expect(listItems[1].textContent).toBe('claude-3')
      expect(listItems[2].textContent).toBe('gemini-pro')
    })
  })

  describe('tab interaction', () => {
    it('switches content when clicking different tabs', async () => {
      const user = userEvent.setup()
      render(
        <Stage2
          rankings={mockRankings}
          labelToModel={mockLabelToModel}
        />
      )

      // Initially shows first model
      expect(screen.getByText('openai/gpt-4')).toBeInTheDocument()

      // Click second tab
      await user.click(screen.getByRole('tab', { name: /Model B/i }))

      expect(screen.getByText('anthropic/claude-3')).toBeInTheDocument()
    })

    it('updates aria-selected on tab click', async () => {
      const user = userEvent.setup()
      render(<Stage2 rankings={mockRankings} />)

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
      render(<Stage2 rankings={mockRankings} />)

      const tabA = screen.getByRole('tab', { name: /Model A/i })
      tabA.focus()

      await user.keyboard('{ArrowRight}')

      expect(screen.getByRole('tab', { name: /Model B/i })).toHaveFocus()
    })

    it('moves to previous tab on ArrowLeft', async () => {
      const user = userEvent.setup()
      render(<Stage2 rankings={mockRankings} />)

      // First switch to tab B
      await user.click(screen.getByRole('tab', { name: /Model B/i }))

      const tabB = screen.getByRole('tab', { name: /Model B/i })
      tabB.focus()

      await user.keyboard('{ArrowLeft}')

      expect(screen.getByRole('tab', { name: /Model A/i })).toHaveFocus()
    })

    it('wraps from last to first on ArrowRight', async () => {
      const user = userEvent.setup()
      render(<Stage2 rankings={mockRankings} />)

      // Go to last tab (Model C)
      await user.click(screen.getByRole('tab', { name: /Model C/i }))

      const tabC = screen.getByRole('tab', { name: /Model C/i })
      tabC.focus()

      await user.keyboard('{ArrowRight}')

      expect(screen.getByRole('tab', { name: /Model A/i })).toHaveFocus()
    })

    it('wraps from first to last on ArrowLeft', async () => {
      const user = userEvent.setup()
      render(<Stage2 rankings={mockRankings} />)

      const tabA = screen.getByRole('tab', { name: /Model A/i })
      tabA.focus()

      await user.keyboard('{ArrowLeft}')

      expect(screen.getByRole('tab', { name: /Model C/i })).toHaveFocus()
    })

    it('goes to first tab on Home', async () => {
      const user = userEvent.setup()
      render(<Stage2 rankings={mockRankings} />)

      // Go to tab C
      await user.click(screen.getByRole('tab', { name: /Model C/i }))

      const tabC = screen.getByRole('tab', { name: /Model C/i })
      tabC.focus()

      await user.keyboard('{Home}')

      expect(screen.getByRole('tab', { name: /Model A/i })).toHaveFocus()
    })

    it('goes to last tab on End', async () => {
      const user = userEvent.setup()
      render(<Stage2 rankings={mockRankings} />)

      const tabA = screen.getByRole('tab', { name: /Model A/i })
      tabA.focus()

      await user.keyboard('{End}')

      expect(screen.getByRole('tab', { name: /Model C/i })).toHaveFocus()
    })

    it('supports ArrowDown as alternative to ArrowRight', async () => {
      const user = userEvent.setup()
      render(<Stage2 rankings={mockRankings} />)

      const tabA = screen.getByRole('tab', { name: /Model A/i })
      tabA.focus()

      await user.keyboard('{ArrowDown}')

      expect(screen.getByRole('tab', { name: /Model B/i })).toHaveFocus()
    })

    it('supports ArrowUp as alternative to ArrowLeft', async () => {
      const user = userEvent.setup()
      render(<Stage2 rankings={mockRankings} />)

      await user.click(screen.getByRole('tab', { name: /Model B/i }))

      const tabB = screen.getByRole('tab', { name: /Model B/i })
      tabB.focus()

      await user.keyboard('{ArrowUp}')

      expect(screen.getByRole('tab', { name: /Model A/i })).toHaveFocus()
    })
  })

  describe('accessibility', () => {
    it('has proper ARIA attributes on tablist', () => {
      render(<Stage2 rankings={mockRankings} />)

      const tablist = screen.getByRole('tablist')
      expect(tablist).toHaveAttribute('aria-label', 'Stage 2 evaluations')
    })

    it('has proper ARIA controls linking tab to panel', () => {
      render(<Stage2 rankings={mockRankings} />)

      const tab = screen.getByRole('tab', { name: /Model A/i })
      const panelId = tab.getAttribute('aria-controls')

      expect(panelId).toBe('stage2-panel-0')
      expect(screen.getByRole('tabpanel')).toHaveAttribute('id', panelId)
    })

    it('only active tab has tabIndex 0', () => {
      render(<Stage2 rankings={mockRankings} />)

      const tabs = screen.getAllByRole('tab')

      expect(tabs[0]).toHaveAttribute('tabIndex', '0')
      expect(tabs[1]).toHaveAttribute('tabIndex', '-1')
      expect(tabs[2]).toHaveAttribute('tabIndex', '-1')
    })

    it('toggle button has aria-expanded attribute', () => {
      render(
        <Stage2
          rankings={mockRankings}
          aggregateRankings={mockAggregateRankingsExtended}
        />
      )

      const toggleBtn = screen.getByRole('button', { name: /Show all/i })
      expect(toggleBtn).toHaveAttribute('aria-expanded', 'false')
    })

    it('toggle button aria-expanded updates on click', async () => {
      const user = userEvent.setup()
      render(
        <Stage2
          rankings={mockRankings}
          aggregateRankings={mockAggregateRankingsExtended}
        />
      )

      const toggleBtn = screen.getByRole('button', { name: /Show all/i })
      await user.click(toggleBtn)

      expect(screen.getByRole('button', { name: /Show top 3/i })).toHaveAttribute('aria-expanded', 'true')
    })
  })
})
