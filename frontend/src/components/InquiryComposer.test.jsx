import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import InquiryComposer from './InquiryComposer'

const mockModels = [
  'openai/gpt-4',
  'anthropic/claude-3',
  'google/gemini-pro',
  'x-ai/grok',
]

const defaultProps = {
  availableModels: mockModels,
  defaultModels: ['openai/gpt-4', 'anthropic/claude-3'],
  defaultLeadModel: 'google/gemini-pro',
  isLoadingModels: false,
  modelsError: null,
  onSubmit: vi.fn(),
  isSubmitting: false,
  submitError: null,
}

describe('InquiryComposer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders heading', () => {
      render(<InquiryComposer {...defaultProps} />)

      expect(screen.getByText('What would you like to ask?')).toBeInTheDocument()
    })

    it('renders textarea with placeholder', () => {
      render(<InquiryComposer {...defaultProps} />)

      expect(screen.getByPlaceholderText('Enter your question here...')).toBeInTheDocument()
    })

    it('renders config toggle with model count', () => {
      render(<InquiryComposer {...defaultProps} />)

      expect(screen.getByText(/Configure Models/)).toBeInTheDocument()
      expect(screen.getByText(/\(2\)/)).toBeInTheDocument()
    })

    it('renders submit button', () => {
      render(<InquiryComposer {...defaultProps} />)

      expect(screen.getByRole('button', { name: /Begin Deliberation/i })).toBeInTheDocument()
    })

    it('renders keyboard hint', () => {
      render(<InquiryComposer {...defaultProps} />)

      expect(screen.getByText(/⌘\/Ctrl \+ Enter to submit/)).toBeInTheDocument()
    })

    it('renders privacy disclosure with links', () => {
      render(<InquiryComposer {...defaultProps} />)

      expect(screen.getByText(/OpenRouter/)).toBeInTheDocument()
      expect(screen.getByText(/Privacy Policy/)).toBeInTheDocument()
    })
  })

  describe('model configuration', () => {
    it('opens config panel when toggle clicked', async () => {
      const user = userEvent.setup()
      render(<InquiryComposer {...defaultProps} />)

      await user.click(screen.getByText(/Configure Models/))

      expect(screen.getByText('Select experts')).toBeInTheDocument()
      expect(screen.getByText('Lead expert (synthesizes final answer)')).toBeInTheDocument()
    })

    it('shows model chips when config open', async () => {
      const user = userEvent.setup()
      render(<InquiryComposer {...defaultProps} />)

      await user.click(screen.getByText(/Configure Models/))

      expect(screen.getByTitle('openai/gpt-4')).toBeInTheDocument()
      expect(screen.getByTitle('anthropic/claude-3')).toBeInTheDocument()
      expect(screen.getByTitle('google/gemini-pro')).toBeInTheDocument()
    })

    it('shows selected state on default models', async () => {
      const user = userEvent.setup()
      render(<InquiryComposer {...defaultProps} />)

      await user.click(screen.getByText(/Configure Models/))

      const gpt4Chip = screen.getByTitle('openai/gpt-4')
      const claudeChip = screen.getByTitle('anthropic/claude-3')

      expect(gpt4Chip).toHaveClass('selected')
      expect(claudeChip).toHaveClass('selected')
    })

    it('toggles model selection on chip click', async () => {
      const user = userEvent.setup()
      render(<InquiryComposer {...defaultProps} />)

      await user.click(screen.getByText(/Configure Models/))

      const geminiChip = screen.getByTitle('google/gemini-pro')
      expect(geminiChip).not.toHaveClass('selected')

      await user.click(geminiChip)

      expect(geminiChip).toHaveClass('selected')
    })

    it('shows warning when less than 2 models selected', async () => {
      const user = userEvent.setup()
      render(<InquiryComposer {...defaultProps} />)

      await user.click(screen.getByText(/Configure Models/))

      // Deselect one model (leaving only 1)
      await user.click(screen.getByTitle('openai/gpt-4'))

      expect(screen.getByText(/Select at least 2 models/)).toBeInTheDocument()
    })

    it('changes lead model via dropdown', async () => {
      const user = userEvent.setup()
      render(<InquiryComposer {...defaultProps} />)

      await user.click(screen.getByText(/Configure Models/))

      const select = screen.getByRole('combobox')
      await user.selectOptions(select, 'openai/gpt-4')

      expect(select).toHaveValue('openai/gpt-4')
    })

    it('updates aria-expanded on toggle', async () => {
      const user = userEvent.setup()
      render(<InquiryComposer {...defaultProps} />)

      const toggle = screen.getByRole('button', { name: /Configure Models/ })

      expect(toggle).toHaveAttribute('aria-expanded', 'false')

      await user.click(toggle)

      expect(toggle).toHaveAttribute('aria-expanded', 'true')
    })
  })

  describe('form submission', () => {
    it('disables submit when question is empty', () => {
      render(<InquiryComposer {...defaultProps} />)

      expect(screen.getByRole('button', { name: /Begin Deliberation/i })).toBeDisabled()
    })

    it('enables submit when question entered and models valid', async () => {
      const user = userEvent.setup()
      render(<InquiryComposer {...defaultProps} />)

      await user.type(screen.getByPlaceholderText('Enter your question here...'), 'Test question')

      expect(screen.getByRole('button', { name: /Begin Deliberation/i })).toBeEnabled()
    })

    it('calls onSubmit with correct data', async () => {
      const user = userEvent.setup()
      render(<InquiryComposer {...defaultProps} />)

      await user.type(screen.getByPlaceholderText('Enter your question here...'), 'What is AI?')
      await user.click(screen.getByRole('button', { name: /Begin Deliberation/i }))

      expect(defaultProps.onSubmit).toHaveBeenCalledWith({
        question: 'What is AI?',
        models: ['openai/gpt-4', 'anthropic/claude-3'],
        lead_model: 'google/gemini-pro',
      })
    })

    it('submits on Ctrl+Enter', async () => {
      const user = userEvent.setup()
      render(<InquiryComposer {...defaultProps} />)

      const textarea = screen.getByPlaceholderText('Enter your question here...')
      await user.type(textarea, 'Test question')
      await user.keyboard('{Control>}{Enter}{/Control}')

      expect(defaultProps.onSubmit).toHaveBeenCalled()
    })

    it('submits on Meta+Enter (Mac)', async () => {
      const user = userEvent.setup()
      render(<InquiryComposer {...defaultProps} />)

      const textarea = screen.getByPlaceholderText('Enter your question here...')
      await user.type(textarea, 'Test question')
      await user.keyboard('{Meta>}{Enter}{/Meta}')

      expect(defaultProps.onSubmit).toHaveBeenCalled()
    })

    it('trims question whitespace', async () => {
      const user = userEvent.setup()
      render(<InquiryComposer {...defaultProps} />)

      await user.type(screen.getByPlaceholderText('Enter your question here...'), '  Test question  ')
      await user.click(screen.getByRole('button', { name: /Begin Deliberation/i }))

      expect(defaultProps.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ question: 'Test question' })
      )
    })
  })

  describe('loading states', () => {
    it('shows loading text when models loading', () => {
      render(<InquiryComposer {...defaultProps} isLoadingModels={true} />)

      expect(screen.getByText('Loading models...')).toBeInTheDocument()
    })

    it('disables textarea when models loading', () => {
      render(<InquiryComposer {...defaultProps} isLoadingModels={true} />)

      expect(screen.getByPlaceholderText('Enter your question here...')).toBeDisabled()
    })

    it('disables config toggle when models loading', () => {
      render(<InquiryComposer {...defaultProps} isLoadingModels={true} />)

      expect(screen.getByRole('button', { name: /Loading models/ })).toBeDisabled()
    })

    it('shows spinner when submitting', () => {
      render(<InquiryComposer {...defaultProps} isSubmitting={true} />)

      expect(screen.getByText('Asking...')).toBeInTheDocument()
    })

    it('disables form when submitting', () => {
      render(<InquiryComposer {...defaultProps} isSubmitting={true} />)

      expect(screen.getByPlaceholderText('Enter your question here...')).toBeDisabled()
    })
  })

  describe('error states', () => {
    it('shows models error', () => {
      render(<InquiryComposer {...defaultProps} modelsError="Failed to load models" />)

      expect(screen.getByText('Failed to load models')).toBeInTheDocument()
    })

    it('shows submit error', () => {
      render(<InquiryComposer {...defaultProps} submitError="Network error" />)

      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  describe('model initialization', () => {
    it('initializes with default models', () => {
      render(<InquiryComposer {...defaultProps} />)

      // Count should show 2 (the default models)
      expect(screen.getByText(/\(2\)/)).toBeInTheDocument()
    })

    it('falls back to first N models when no defaults', () => {
      render(
        <InquiryComposer
          {...defaultProps}
          defaultModels={[]}
          defaultLeadModel=""
        />
      )

      // Should still show 2 models (MIN_MODELS)
      expect(screen.getByText(/\(2\)/)).toBeInTheDocument()
    })
  })

  describe('model label display', () => {
    it('shows short model names without provider prefix', async () => {
      const user = userEvent.setup()
      render(<InquiryComposer {...defaultProps} />)

      await user.click(screen.getByText(/Configure Models/))

      // Should show "gpt-4" not "openai/gpt-4" (appears in chips and dropdown)
      expect(screen.getAllByText('gpt-4').length).toBeGreaterThan(0)
      expect(screen.getAllByText('claude-3').length).toBeGreaterThan(0)
    })
  })
})
