import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Sidebar from './Sidebar'

// Helper to create conversations with specific dates
function createConversation(id, title, daysAgo) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return {
    id,
    title,
    created_at: date.toISOString(),
  }
}

const mockConversations = [
  createConversation('today-1', 'Today Inquiry 1', 0),
  createConversation('today-2', 'Today Inquiry 2', 0),
  createConversation('yesterday-1', 'Yesterday Inquiry', 1),
  createConversation('week-1', 'This Week Inquiry', 3),
  createConversation('month-1', 'This Month Inquiry', 15),
  createConversation('older-1', 'Older Inquiry', 60),
]

const defaultProps = {
  conversations: mockConversations,
  currentConversationId: null,
  onSelectConversation: vi.fn(),
  onNewConversation: vi.fn(),
  onDeleteConversation: vi.fn(),
  isOpen: false,
  onClose: vi.fn(),
}

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders Archive title', () => {
      render(<Sidebar {...defaultProps} />)

      expect(screen.getByText('Archive')).toBeInTheDocument()
    })

    it('renders search input', () => {
      render(<Sidebar {...defaultProps} />)

      expect(screen.getByPlaceholderText('Search inquiries...')).toBeInTheDocument()
    })

    it('shows "No inquiries yet" when conversations is empty', () => {
      render(<Sidebar {...defaultProps} conversations={[]} />)

      expect(screen.getByText('No inquiries yet')).toBeInTheDocument()
    })

    it('has open class when isOpen is true', () => {
      const { container } = render(<Sidebar {...defaultProps} isOpen={true} />)

      expect(container.querySelector('.sidebar')).toHaveClass('open')
    })

    it('has aria-label on sidebar', () => {
      render(<Sidebar {...defaultProps} />)

      expect(screen.getByRole('complementary')).toHaveAttribute('aria-label', 'Inquiry list')
    })
  })

  describe('date grouping', () => {
    it('shows Today section with correct count', () => {
      render(<Sidebar {...defaultProps} />)

      const todaySection = screen.getByText('Today').closest('.date-section')
      expect(within(todaySection).getByText('2')).toBeInTheDocument()
    })

    it('shows Yesterday section with correct count', () => {
      render(<Sidebar {...defaultProps} />)

      const yesterdaySection = screen.getByText('Yesterday').closest('.date-section')
      expect(within(yesterdaySection).getByText('1')).toBeInTheDocument()
    })

    it('groups conversations into date sections', () => {
      render(<Sidebar {...defaultProps} />)

      // All sections that have items should be rendered
      // At minimum we should have Today and Yesterday based on our mock data
      expect(screen.getByText('Today')).toBeInTheDocument()
      expect(screen.getByText('Yesterday')).toBeInTheDocument()

      // Other sections may or may not appear depending on current date
      // Just verify the total count of rendered items matches
      const caseItems = document.querySelectorAll('.case-item')
      expect(caseItems.length).toBe(mockConversations.length)
    })

    it('displays conversation titles', () => {
      render(<Sidebar {...defaultProps} />)

      expect(screen.getByText('Today Inquiry 1')).toBeInTheDocument()
      expect(screen.getByText('Yesterday Inquiry')).toBeInTheDocument()
    })

    it('shows "Untitled Inquiry" for conversations without title', () => {
      const noTitleConv = [{ id: '1', title: null, created_at: new Date().toISOString() }]
      render(<Sidebar {...defaultProps} conversations={noTitleConv} />)

      expect(screen.getByText('Untitled Inquiry')).toBeInTheDocument()
    })
  })

  describe('search functionality', () => {
    it('filters conversations by title', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search inquiries...')
      await user.type(searchInput, 'Yesterday')

      expect(screen.getByText('Yesterday Inquiry')).toBeInTheDocument()
      expect(screen.queryByText('Today Inquiry 1')).not.toBeInTheDocument()
    })

    it('shows "No matches found" when search has no results', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search inquiries...')
      await user.type(searchInput, 'nonexistent query')

      expect(screen.getByText('No matches found')).toBeInTheDocument()
    })

    it('shows clear button when search has text', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search inquiries...')
      await user.type(searchInput, 'test')

      expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument()
    })

    it('clears search when clear button clicked', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search inquiries...')
      await user.type(searchInput, 'test')
      await user.click(screen.getByRole('button', { name: 'Clear search' }))

      expect(searchInput).toHaveValue('')
    })

    it('search is case insensitive', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      const searchInput = screen.getByPlaceholderText('Search inquiries...')
      await user.type(searchInput, 'TODAY')

      expect(screen.getByText('Today Inquiry 1')).toBeInTheDocument()
    })
  })

  describe('section collapsing', () => {
    it('collapses section when header clicked', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      // Initially items are visible
      expect(screen.getByText('Today Inquiry 1')).toBeInTheDocument()

      // Click to collapse
      await user.click(screen.getByText('Today'))

      // Items should be hidden
      expect(screen.queryByText('Today Inquiry 1')).not.toBeInTheDocument()
    })

    it('expands section when collapsed header clicked', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      // Collapse
      await user.click(screen.getByText('Today'))
      expect(screen.queryByText('Today Inquiry 1')).not.toBeInTheDocument()

      // Expand
      await user.click(screen.getByText('Today'))
      expect(screen.getByText('Today Inquiry 1')).toBeInTheDocument()
    })

    it('updates aria-expanded on collapse', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      const todayHeader = screen.getByText('Today').closest('button')

      expect(todayHeader).toHaveAttribute('aria-expanded', 'true')

      await user.click(todayHeader)

      expect(todayHeader).toHaveAttribute('aria-expanded', 'false')
    })

    it('adds collapsed class to header when collapsed', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      const todayHeader = screen.getByText('Today').closest('button')

      expect(todayHeader).not.toHaveClass('collapsed')

      await user.click(todayHeader)

      expect(todayHeader).toHaveClass('collapsed')
    })
  })

  describe('conversation selection', () => {
    it('calls onSelectConversation when item clicked', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      await user.click(screen.getByText('Today Inquiry 1'))

      expect(defaultProps.onSelectConversation).toHaveBeenCalledWith('today-1')
    })

    it('calls onClose when item clicked', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      await user.click(screen.getByText('Today Inquiry 1'))

      expect(defaultProps.onClose).toHaveBeenCalled()
    })

    it('selects on Enter key', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      const item = screen.getByText('Today Inquiry 1').closest('[role="button"]')
      item.focus()
      await user.keyboard('{Enter}')

      expect(defaultProps.onSelectConversation).toHaveBeenCalledWith('today-1')
    })

    it('selects on Space key', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      const item = screen.getByText('Today Inquiry 1').closest('[role="button"]')
      item.focus()
      await user.keyboard(' ')

      expect(defaultProps.onSelectConversation).toHaveBeenCalledWith('today-1')
    })

    it('shows active class on current conversation', () => {
      render(<Sidebar {...defaultProps} currentConversationId="today-1" />)

      const item = screen.getByText('Today Inquiry 1').closest('.case-item')
      expect(item).toHaveClass('active')
    })

    it('sets aria-current on active conversation', () => {
      render(<Sidebar {...defaultProps} currentConversationId="today-1" />)

      const item = screen.getByText('Today Inquiry 1').closest('[role="button"]')
      expect(item).toHaveAttribute('aria-current', 'true')
    })
  })

  describe('delete functionality', () => {
    it('calls onDeleteConversation when delete button clicked', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      const item = screen.getByText('Today Inquiry 1').closest('.case-item')
      const deleteBtn = within(item).getByTitle('Delete inquiry')
      await user.click(deleteBtn)

      expect(defaultProps.onDeleteConversation).toHaveBeenCalledWith('today-1')
    })

    it('does not select conversation when delete clicked', async () => {
      const user = userEvent.setup()
      render(<Sidebar {...defaultProps} />)

      const item = screen.getByText('Today Inquiry 1').closest('.case-item')
      const deleteBtn = within(item).getByTitle('Delete inquiry')
      await user.click(deleteBtn)

      // Delete should be called but not select
      expect(defaultProps.onDeleteConversation).toHaveBeenCalled()
      expect(defaultProps.onSelectConversation).not.toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    it('items have role="button"', () => {
      render(<Sidebar {...defaultProps} />)

      const items = screen.getAllByRole('button', { name: /Inquiry/i })
      expect(items.length).toBeGreaterThan(0)
    })

    it('items have tabIndex=0', () => {
      render(<Sidebar {...defaultProps} />)

      const item = screen.getByText('Today Inquiry 1').closest('[role="button"]')
      expect(item).toHaveAttribute('tabIndex', '0')
    })

    it('search input has aria-label', () => {
      render(<Sidebar {...defaultProps} />)

      expect(screen.getByRole('textbox')).toHaveAttribute('aria-label', 'Search inquiries')
    })
  })

  describe('timestamp formatting', () => {
    it('shows time for today conversations', () => {
      const todayConv = [createConversation('1', 'Today Test', 0)]
      render(<Sidebar {...defaultProps} conversations={todayConv} />)

      // Should show time format like "10:30 AM"
      const metaText = screen.getByText('Today Test').closest('.case-item').querySelector('.case-meta')
      expect(metaText.textContent).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)?/i)
    })

    it('shows date for older conversations', () => {
      const olderConv = [createConversation('1', 'Older Test', 60)]
      render(<Sidebar {...defaultProps} conversations={olderConv} />)

      // Should show date format like "Nov 5"
      const metaText = screen.getByText('Older Test').closest('.case-item').querySelector('.case-meta')
      expect(metaText.textContent).toMatch(/[A-Z][a-z]{2,}\s+\d{1,2}/i)
    })
  })
})
