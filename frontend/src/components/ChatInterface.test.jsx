import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ChatInterface from './ChatInterface'

// Mock scrollTo for jsdom
Element.prototype.scrollTo = vi.fn()

// Mock child components to isolate ChatInterface tests
vi.mock('./Stage1', () => ({
  default: ({ responses }) => (
    <div data-testid="stage1-mock">Stage1: {responses?.length || 0} responses</div>
  ),
}))

vi.mock('./Stage2', () => ({
  default: ({ rankings }) => (
    <div data-testid="stage2-mock">Stage2: {rankings?.length || 0} rankings</div>
  ),
}))

vi.mock('./Stage3', () => ({
  default: ({ finalResponse }) => (
    <div data-testid="stage3-mock">Stage3: {finalResponse?.response || 'none'}</div>
  ),
}))

vi.mock('./InquiryComposer', () => ({
  default: ({ onSubmit }) => (
    <div data-testid="inquiry-composer-mock">
      <button onClick={() => onSubmit('Test question', [], 'lead-model')}>
        Submit Inquiry
      </button>
    </div>
  ),
}))

vi.mock('./Masthead', () => ({
  default: ({ onToggleSidebar, onNewInquiry, showNewInquiry }) => (
    <div data-testid="masthead-mock">
      <button onClick={onToggleSidebar}>Toggle Sidebar</button>
      {showNewInquiry && <button onClick={onNewInquiry}>New Inquiry</button>}
    </div>
  ),
}))

const mockConversation = {
  id: 'conv-123',
  created_at: '2026-01-05T10:00:00Z',
  messages: [
    { role: 'user', content: 'What is the meaning of life?' },
    {
      role: 'assistant',
      stage1: [
        { model: 'openai/gpt-4', response: 'Response 1' },
        { model: 'anthropic/claude-3', response: 'Response 2' },
      ],
      stage2: [
        { model: 'openai/gpt-4', ranking: '1. A\n2. B' },
      ],
      stage3: { model: 'google/gemini-pro', response: 'Final answer' },
      metadata: {
        label_to_model: { 'Response A': 'openai/gpt-4' },
        aggregate_rankings: [{ model: 'openai/gpt-4', average_rank: 1.5 }],
      },
      updated_at: '2026-01-05T10:05:00Z',
    },
  ],
}

const mockLoadingConversation = {
  id: 'conv-456',
  messages: [
    { role: 'user', content: 'Test question' },
    {
      role: 'assistant',
      loading: { stage1: true },
    },
  ],
}

const defaultProps = {
  conversation: null,
  onSendMessage: vi.fn(),
  isLoading: false,
  onToggleSidebar: vi.fn(),
  isSidebarOpen: false,
  availableModels: ['openai/gpt-4', 'anthropic/claude-3'],
  defaultModels: ['openai/gpt-4'],
  defaultLeadModel: 'google/gemini-pro',
  isLoadingModels: false,
  modelsError: null,
  onCreateAndSubmit: vi.fn(),
  isCreating: false,
  createError: null,
  userEmail: 'test@example.com',
  userBalance: 5.0,
  isByokMode: false,
  onLogout: vi.fn(),
  onNewInquiry: vi.fn(),
}

describe('ChatInterface', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('no conversation state', () => {
    it('renders InquiryComposer when no conversation', () => {
      render(<ChatInterface {...defaultProps} conversation={null} />)

      expect(screen.getByTestId('inquiry-composer-mock')).toBeInTheDocument()
      expect(screen.getByTestId('masthead-mock')).toBeInTheDocument()
    })

    it('calls onCreateAndSubmit when InquiryComposer submits', async () => {
      const user = userEvent.setup()
      render(<ChatInterface {...defaultProps} conversation={null} />)

      await user.click(screen.getByText('Submit Inquiry'))

      expect(defaultProps.onCreateAndSubmit).toHaveBeenCalledWith(
        'Test question',
        [],
        'lead-model'
      )
    })
  })

  describe('with conversation', () => {
    it('renders question display when conversation has messages', () => {
      render(<ChatInterface {...defaultProps} conversation={mockConversation} />)

      expect(screen.getByText('What is the meaning of life?')).toBeInTheDocument()
    })

    it('renders response tabs when there is a response', () => {
      render(<ChatInterface {...defaultProps} conversation={mockConversation} />)

      expect(screen.getByRole('tab', { name: 'Quintessence' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Stage 1' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Stage 2' })).toBeInTheDocument()
    })

    it('shows Stage3 content in Quintessence tab by default', () => {
      render(<ChatInterface {...defaultProps} conversation={mockConversation} />)

      expect(screen.getByTestId('stage3-mock')).toBeInTheDocument()
      expect(screen.getByText(/Final answer/)).toBeInTheDocument()
    })

    it('shows Finalized status when stage3 is complete', () => {
      render(<ChatInterface {...defaultProps} conversation={mockConversation} />)

      expect(screen.getByText('Finalized')).toBeInTheDocument()
    })

    it('shows New Inquiry button when onNewInquiry is provided', () => {
      render(<ChatInterface {...defaultProps} conversation={mockConversation} />)

      expect(screen.getByText('New Inquiry')).toBeInTheDocument()
    })
  })

  describe('tab switching', () => {
    it('switches to Stage 1 tab when clicked', async () => {
      const user = userEvent.setup()
      render(<ChatInterface {...defaultProps} conversation={mockConversation} />)

      await user.click(screen.getByRole('tab', { name: 'Stage 1' }))

      expect(screen.getByTestId('stage1-mock')).toBeInTheDocument()
      expect(screen.getByText('Stage1: 2 responses')).toBeInTheDocument()
    })

    it('switches to Stage 2 tab when clicked', async () => {
      const user = userEvent.setup()
      render(<ChatInterface {...defaultProps} conversation={mockConversation} />)

      await user.click(screen.getByRole('tab', { name: 'Stage 2' }))

      expect(screen.getByTestId('stage2-mock')).toBeInTheDocument()
      expect(screen.getByText('Stage2: 1 rankings')).toBeInTheDocument()
    })

    it('updates aria-selected on tab switch', async () => {
      const user = userEvent.setup()
      render(<ChatInterface {...defaultProps} conversation={mockConversation} />)

      const quintessenceTab = screen.getByRole('tab', { name: 'Quintessence' })
      const stage1Tab = screen.getByRole('tab', { name: 'Stage 1' })

      // Quintessence active by default
      expect(quintessenceTab).toHaveAttribute('aria-selected', 'true')
      expect(stage1Tab).toHaveAttribute('aria-selected', 'false')

      await user.click(stage1Tab)

      expect(quintessenceTab).toHaveAttribute('aria-selected', 'false')
      expect(stage1Tab).toHaveAttribute('aria-selected', 'true')
    })
  })

  describe('loading states', () => {
    it('shows skeleton and status when stage1 is loading', () => {
      render(<ChatInterface {...defaultProps} conversation={mockLoadingConversation} />)

      // Tab should switch to stage1 during loading
      expect(screen.getByText('Gathering responses')).toBeInTheDocument()
    })

    it('shows skeleton and status when stage2 is loading', () => {
      const stage2Loading = {
        ...mockLoadingConversation,
        messages: [
          { role: 'user', content: 'Test' },
          {
            role: 'assistant',
            stage1: [{ model: 'test', response: 'Test' }],
            loading: { stage2: true },
          },
        ],
      }
      render(<ChatInterface {...defaultProps} conversation={stage2Loading} />)

      expect(screen.getByText('Reviewing responses')).toBeInTheDocument()
    })

    it('shows skeleton and status when stage3 is loading', () => {
      const stage3Loading = {
        ...mockLoadingConversation,
        messages: [
          { role: 'user', content: 'Test' },
          {
            role: 'assistant',
            stage1: [{ model: 'test', response: 'Test' }],
            stage2: [{ model: 'test', ranking: '1. A' }],
            loading: { stage3: true },
          },
        ],
      }
      render(<ChatInterface {...defaultProps} conversation={stage3Loading} />)

      expect(screen.getByText('Final answer')).toBeInTheDocument()
    })
  })

  describe('empty response state', () => {
    it('shows empty state when no assistant message', () => {
      const noResponse = {
        id: 'conv-789',
        messages: [{ role: 'user', content: 'Test question' }],
      }
      render(<ChatInterface {...defaultProps} conversation={noResponse} />)

      expect(screen.getByText('Responses will appear here')).toBeInTheDocument()
      expect(screen.getByText('Submit a question to start the run.')).toBeInTheDocument()
    })
  })

  describe('question form', () => {
    it('shows form when conversation exists but no user message', () => {
      const emptyConversation = { id: 'conv-new', messages: [] }
      render(<ChatInterface {...defaultProps} conversation={emptyConversation} />)

      expect(screen.getByPlaceholderText(/Ask a question/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
    })

    it('submits on Enter key (without Shift)', async () => {
      const user = userEvent.setup()
      const emptyConversation = { id: 'conv-new', messages: [] }
      render(<ChatInterface {...defaultProps} conversation={emptyConversation} />)

      const input = screen.getByPlaceholderText(/Ask a question/)
      await user.type(input, 'My question')
      await user.keyboard('{Enter}')

      expect(defaultProps.onSendMessage).toHaveBeenCalledWith('My question')
    })

    it('does not submit on Shift+Enter', async () => {
      const user = userEvent.setup()
      const emptyConversation = { id: 'conv-new', messages: [] }
      render(<ChatInterface {...defaultProps} conversation={emptyConversation} />)

      const input = screen.getByPlaceholderText(/Ask a question/)
      await user.type(input, 'My question')
      await user.keyboard('{Shift>}{Enter}{/Shift}')

      expect(defaultProps.onSendMessage).not.toHaveBeenCalled()
    })

    it('disables Send button when input is empty', () => {
      const emptyConversation = { id: 'conv-new', messages: [] }
      render(<ChatInterface {...defaultProps} conversation={emptyConversation} />)

      expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    })

    it('disables Send button when loading', () => {
      const emptyConversation = { id: 'conv-new', messages: [] }
      render(
        <ChatInterface
          {...defaultProps}
          conversation={emptyConversation}
          isLoading={true}
        />
      )

      expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
      expect(screen.getByPlaceholderText(/Ask a question/)).toBeDisabled()
    })

    it('clears input after submission', async () => {
      const user = userEvent.setup()
      const emptyConversation = { id: 'conv-new', messages: [] }
      render(<ChatInterface {...defaultProps} conversation={emptyConversation} />)

      const input = screen.getByPlaceholderText(/Ask a question/)
      await user.type(input, 'My question')
      await user.click(screen.getByRole('button', { name: 'Send' }))

      expect(input).toHaveValue('')
    })
  })

  describe('error display', () => {
    it('shows createError when present', () => {
      render(
        <ChatInterface
          {...defaultProps}
          conversation={{ id: 'conv', messages: [] }}
          createError="Something went wrong"
        />
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })
  })

  describe('masthead interactions', () => {
    it('calls onToggleSidebar when toggle button clicked', async () => {
      const user = userEvent.setup()
      render(<ChatInterface {...defaultProps} conversation={null} />)

      await user.click(screen.getByText('Toggle Sidebar'))

      expect(defaultProps.onToggleSidebar).toHaveBeenCalled()
    })

    it('calls onNewInquiry when New Inquiry button clicked', async () => {
      const user = userEvent.setup()
      render(<ChatInterface {...defaultProps} conversation={mockConversation} />)

      await user.click(screen.getByText('New Inquiry'))

      expect(defaultProps.onNewInquiry).toHaveBeenCalled()
    })
  })

  describe('date formatting', () => {
    it('formats updated_at correctly', () => {
      render(<ChatInterface {...defaultProps} conversation={mockConversation} />)

      // Should show formatted date like "Jan 5, 10:05 AM"
      expect(screen.getByText(/Jan 5/)).toBeInTheDocument()
    })

    it('handles missing updated_at gracefully', () => {
      const noTimestamp = {
        id: 'conv',
        messages: [
          { role: 'user', content: 'Test' },
          { role: 'assistant', stage1: [{ model: 'test', response: 'Test' }] },
        ],
      }
      render(<ChatInterface {...defaultProps} conversation={noTimestamp} />)

      // Should not crash, question should still render
      expect(screen.getByText('Test')).toBeInTheDocument()
    })
  })

  describe('pending tabs', () => {
    it('shows pending message when stage1 not available but tab selected', async () => {
      const user = userEvent.setup()
      const partialConversation = {
        id: 'conv',
        messages: [
          { role: 'user', content: 'Test' },
          {
            role: 'assistant',
            stage3: { model: 'test', response: 'Final' },
          },
        ],
      }
      render(<ChatInterface {...defaultProps} conversation={partialConversation} />)

      await user.click(screen.getByRole('tab', { name: 'Stage 1' }))

      expect(screen.getByText('Stage 1 responses are pending.')).toBeInTheDocument()
    })

    it('shows pending message when stage2 not available but tab selected', async () => {
      const user = userEvent.setup()
      const partialConversation = {
        id: 'conv',
        messages: [
          { role: 'user', content: 'Test' },
          {
            role: 'assistant',
            stage3: { model: 'test', response: 'Final' },
          },
        ],
      }
      render(<ChatInterface {...defaultProps} conversation={partialConversation} />)

      await user.click(screen.getByRole('tab', { name: 'Stage 2' }))

      expect(screen.getByText('Stage 2 reviews are pending.')).toBeInTheDocument()
    })

    it('shows pending message when final not available but tab selected', async () => {
      const partialConversation = {
        id: 'conv',
        messages: [
          { role: 'user', content: 'Test' },
          {
            role: 'assistant',
            stage1: [{ model: 'test', response: 'Test' }],
          },
        ],
      }
      render(<ChatInterface {...defaultProps} conversation={partialConversation} />)

      // Click Quintessence tab
      const user = userEvent.setup()
      await user.click(screen.getByRole('tab', { name: 'Quintessence' }))

      expect(screen.getByText('Final answer is pending.')).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has proper tablist role on response tabs', () => {
      render(<ChatInterface {...defaultProps} conversation={mockConversation} />)

      expect(screen.getByRole('tablist')).toHaveAttribute('aria-label', 'Response tabs')
    })

    it('has tabpanel role on response content', () => {
      render(<ChatInterface {...defaultProps} conversation={mockConversation} />)

      expect(screen.getByRole('tabpanel')).toBeInTheDocument()
    })
  })
})
