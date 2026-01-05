import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ConfirmDialog from './ConfirmDialog'

const defaultProps = {
  isOpen: true,
  title: 'Confirm Action',
  message: 'Are you sure you want to proceed?',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
  variant: 'default',
  icon: null,
}

describe('ConfirmDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.style.overflow = ''
  })

  describe('rendering', () => {
    it('renders nothing when isOpen is false', () => {
      render(<ConfirmDialog {...defaultProps} isOpen={false} />)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('renders dialog when isOpen is true', () => {
      render(<ConfirmDialog {...defaultProps} />)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('renders title', () => {
      render(<ConfirmDialog {...defaultProps} />)

      expect(screen.getByText('Confirm Action')).toBeInTheDocument()
    })

    it('renders message', () => {
      render(<ConfirmDialog {...defaultProps} />)

      expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument()
    })

    it('renders confirm and cancel buttons', () => {
      render(<ConfirmDialog {...defaultProps} />)

      expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    })

    it('renders custom button labels', () => {
      render(
        <ConfirmDialog
          {...defaultProps}
          confirmLabel="Delete"
          cancelLabel="Keep"
        />
      )

      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument()
    })
  })

  describe('icons', () => {
    it('renders warning icon', () => {
      render(<ConfirmDialog {...defaultProps} icon="warning" />)

      expect(screen.getByText('⚠')).toBeInTheDocument()
    })

    it('renders info icon', () => {
      render(<ConfirmDialog {...defaultProps} icon="info" />)

      expect(screen.getByText('ℹ')).toBeInTheDocument()
    })

    it('renders no icon by default', () => {
      render(<ConfirmDialog {...defaultProps} />)

      expect(screen.queryByText('⚠')).not.toBeInTheDocument()
      expect(screen.queryByText('ℹ')).not.toBeInTheDocument()
    })
  })

  describe('variants', () => {
    it('renders alert variant without cancel button', () => {
      render(<ConfirmDialog {...defaultProps} variant="alert" />)

      expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
    })

    it('renders danger variant with danger class on confirm', () => {
      render(<ConfirmDialog {...defaultProps} variant="danger" />)

      const confirmBtn = screen.getByRole('button', { name: 'Confirm' })
      expect(confirmBtn).toHaveClass('danger')
    })
  })

  describe('button interactions', () => {
    it('calls onConfirm when confirm button clicked', async () => {
      const user = userEvent.setup()
      render(<ConfirmDialog {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: 'Confirm' }))

      expect(defaultProps.onConfirm).toHaveBeenCalled()
    })

    it('calls onCancel when cancel button clicked', async () => {
      const user = userEvent.setup()
      render(<ConfirmDialog {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(defaultProps.onCancel).toHaveBeenCalled()
    })

    it('calls onCancel when overlay clicked', async () => {
      const user = userEvent.setup()
      render(<ConfirmDialog {...defaultProps} />)

      // Click the overlay (the dialog container)
      await user.click(screen.getByRole('dialog'))

      expect(defaultProps.onCancel).toHaveBeenCalled()
    })
  })

  describe('keyboard interactions', () => {
    it('calls onCancel on Escape key', async () => {
      const user = userEvent.setup()
      render(<ConfirmDialog {...defaultProps} />)

      await user.keyboard('{Escape}')

      expect(defaultProps.onCancel).toHaveBeenCalled()
    })

    it('calls onConfirm on Enter key for non-danger variant', async () => {
      const user = userEvent.setup()
      render(<ConfirmDialog {...defaultProps} />)

      await user.keyboard('{Enter}')

      expect(defaultProps.onConfirm).toHaveBeenCalled()
    })

    it('does not call onConfirm on Enter key for danger variant', async () => {
      const user = userEvent.setup()
      render(<ConfirmDialog {...defaultProps} variant="danger" />)

      await user.keyboard('{Enter}')

      expect(defaultProps.onConfirm).not.toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    it('has aria-modal attribute', () => {
      render(<ConfirmDialog {...defaultProps} />)

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    })

    it('has aria-labelledby pointing to title', () => {
      render(<ConfirmDialog {...defaultProps} />)

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-labelledby', 'confirm-dialog-title')
    })

    it('has aria-describedby pointing to message', () => {
      render(<ConfirmDialog {...defaultProps} />)

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-describedby', 'confirm-dialog-message')
    })

    it('focuses cancel button by default', () => {
      render(<ConfirmDialog {...defaultProps} />)

      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    })

    it('focuses confirm button for alert variant', () => {
      render(<ConfirmDialog {...defaultProps} variant="alert" />)

      expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus()
    })

    it('prevents body scroll when open', () => {
      render(<ConfirmDialog {...defaultProps} />)

      expect(document.body.style.overflow).toBe('hidden')
    })

    it('restores body scroll when closed', () => {
      const { rerender } = render(<ConfirmDialog {...defaultProps} />)

      expect(document.body.style.overflow).toBe('hidden')

      rerender(<ConfirmDialog {...defaultProps} isOpen={false} />)

      expect(document.body.style.overflow).toBe('')
    })
  })
})
