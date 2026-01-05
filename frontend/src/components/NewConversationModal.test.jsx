import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import NewConversationModal from './NewConversationModal'

const mockModels = [
  'openai/gpt-4',
  'anthropic/claude-3',
  'google/gemini-pro',
  'x-ai/grok',
]

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onCreate: vi.fn(),
  availableModels: mockModels,
  defaultModels: ['openai/gpt-4', 'anthropic/claude-3'],
  defaultLeadModel: 'google/gemini-pro',
  isLoading: false,
  loadError: null,
  submitError: null,
  isSubmitting: false,
}

describe('NewConversationModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders nothing when isOpen is false', () => {
      render(<NewConversationModal {...defaultProps} isOpen={false} />)

      expect(screen.queryByText('New Inquiry')).not.toBeInTheDocument()
    })

    it('renders modal when isOpen is true', () => {
      render(<NewConversationModal {...defaultProps} />)

      expect(screen.getByText('New Inquiry')).toBeInTheDocument()
    })

    it('renders Models section', () => {
      render(<NewConversationModal {...defaultProps} />)

      expect(screen.getByText('Models')).toBeInTheDocument()
      expect(screen.getByText(/Select at least 2 models/)).toBeInTheDocument()
    })

    it('renders Lead model section', () => {
      render(<NewConversationModal {...defaultProps} />)

      expect(screen.getByText('Lead model')).toBeInTheDocument()
      expect(screen.getByText(/synthesize the final answer/)).toBeInTheDocument()
    })

    it('renders model checkboxes', () => {
      render(<NewConversationModal {...defaultProps} />)

      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes).toHaveLength(4)
    })

    it('renders lead model dropdown', () => {
      render(<NewConversationModal {...defaultProps} />)

      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('renders Cancel and Create buttons', () => {
      render(<NewConversationModal {...defaultProps} />)

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
    })

    it('shows selection count', () => {
      render(<NewConversationModal {...defaultProps} />)

      expect(screen.getByText('2 of 4 selected')).toBeInTheDocument()
    })
  })

  describe('model selection', () => {
    it('initializes with default models selected', () => {
      render(<NewConversationModal {...defaultProps} />)

      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes[0]).toBeChecked() // gpt-4
      expect(checkboxes[1]).toBeChecked() // claude-3
      expect(checkboxes[2]).not.toBeChecked() // gemini-pro
      expect(checkboxes[3]).not.toBeChecked() // grok
    })

    it('toggles model selection on click', async () => {
      const user = userEvent.setup()
      render(<NewConversationModal {...defaultProps} />)

      const geminiCheckbox = screen.getAllByRole('checkbox')[2]
      expect(geminiCheckbox).not.toBeChecked()

      await user.click(geminiCheckbox)

      expect(geminiCheckbox).toBeChecked()
      expect(screen.getByText('3 of 4 selected')).toBeInTheDocument()
    })

    it('shows warning when less than 2 models selected', async () => {
      const user = userEvent.setup()
      render(<NewConversationModal {...defaultProps} />)

      // Deselect one model
      await user.click(screen.getAllByRole('checkbox')[0])

      expect(screen.getByText('Choose at least 2 models to continue.')).toBeInTheDocument()
    })

    it('disables Create when less than 2 models selected', async () => {
      const user = userEvent.setup()
      render(<NewConversationModal {...defaultProps} />)

      await user.click(screen.getAllByRole('checkbox')[0])

      expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
    })
  })

  describe('lead model selection', () => {
    it('initializes with default lead model', () => {
      render(<NewConversationModal {...defaultProps} />)

      expect(screen.getByRole('combobox')).toHaveValue('google/gemini-pro')
    })

    it('changes lead model via dropdown', async () => {
      const user = userEvent.setup()
      render(<NewConversationModal {...defaultProps} />)

      await user.selectOptions(screen.getByRole('combobox'), 'openai/gpt-4')

      expect(screen.getByRole('combobox')).toHaveValue('openai/gpt-4')
    })

    it('shows note when lead not in selection', async () => {
      const user = userEvent.setup()
      render(<NewConversationModal {...defaultProps} />)

      // Lead model is gemini-pro which is not in the default selection
      expect(screen.getByText('Lead model is not in the selected list.')).toBeInTheDocument()
    })
  })

  describe('form submission', () => {
    it('calls onCreate with selected models and lead', async () => {
      const user = userEvent.setup()
      const onCreate = vi.fn()
      render(<NewConversationModal {...defaultProps} onCreate={onCreate} />)

      await user.click(screen.getByRole('button', { name: 'Create' }))

      expect(onCreate).toHaveBeenCalledWith({
        models: ['openai/gpt-4', 'anthropic/claude-3'],
        lead_model: 'google/gemini-pro',
      })
    })

    it('shows Creating... when submitting', () => {
      render(<NewConversationModal {...defaultProps} isSubmitting={true} />)

      expect(screen.getByRole('button', { name: 'Creating...' })).toBeInTheDocument()
    })

    it('disables buttons when submitting', () => {
      render(<NewConversationModal {...defaultProps} isSubmitting={true} />)

      expect(screen.getByRole('button', { name: 'Creating...' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    })
  })

  describe('loading state', () => {
    it('shows loading message when loading', () => {
      render(<NewConversationModal {...defaultProps} isLoading={true} />)

      expect(screen.getByText('Loading models...')).toBeInTheDocument()
    })

    it('hides model grid when loading', () => {
      render(<NewConversationModal {...defaultProps} isLoading={true} />)

      expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    })
  })

  describe('error states', () => {
    it('shows load error', () => {
      render(<NewConversationModal {...defaultProps} loadError="Failed to load models" />)

      expect(screen.getByText('Failed to load models')).toBeInTheDocument()
    })

    it('shows submit error', () => {
      render(<NewConversationModal {...defaultProps} submitError="Creation failed" />)

      expect(screen.getByText('Creation failed')).toBeInTheDocument()
    })
  })

  describe('close behavior', () => {
    it('calls onClose when Cancel clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<NewConversationModal {...defaultProps} onClose={onClose} />)

      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(onClose).toHaveBeenCalled()
    })

    it('calls onClose when Close button clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<NewConversationModal {...defaultProps} onClose={onClose} />)

      await user.click(screen.getByRole('button', { name: 'Close' }))

      expect(onClose).toHaveBeenCalled()
    })

    it('calls onClose when overlay clicked', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<NewConversationModal {...defaultProps} onClose={onClose} />)

      const overlay = document.querySelector('.new-conversation-overlay')
      await user.click(overlay)

      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('empty state', () => {
    it('shows empty message when no models available', () => {
      render(<NewConversationModal {...defaultProps} availableModels={[]} />)

      expect(screen.getAllByText('No models available.')).toHaveLength(2) // In grid and dropdown
    })
  })
})
