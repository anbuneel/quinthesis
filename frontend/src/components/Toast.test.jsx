import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Toast from './Toast'

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('rendering', () => {
    it('renders nothing when show is false', () => {
      render(<Toast message="Test" show={false} onClose={vi.fn()} />)

      expect(screen.queryByText('Test')).not.toBeInTheDocument()
    })

    it('renders toast when show is true', () => {
      render(<Toast message="Success!" show={true} onClose={vi.fn()} />)

      expect(screen.getByText('Success!')).toBeInTheDocument()
    })

    it('renders checkmark icon', () => {
      render(<Toast message="Success!" show={true} onClose={vi.fn()} />)

      expect(screen.getByText('✓')).toBeInTheDocument()
    })

    it('renders in document.body via portal', () => {
      render(<Toast message="Success!" show={true} onClose={vi.fn()} />)

      // The toast should be a direct child of body
      const toasts = document.body.querySelectorAll('.toast')
      expect(toasts.length).toBe(1)
    })
  })

  describe('auto-close behavior', () => {
    it('calls onClose after default duration', async () => {
      const onClose = vi.fn()
      render(<Toast message="Test" show={true} onClose={onClose} />)

      // Default duration is 2500ms + 300ms for fade animation
      vi.advanceTimersByTime(2500 + 300)

      expect(onClose).toHaveBeenCalled()
    })

    it('uses custom duration', async () => {
      const onClose = vi.fn()
      render(<Toast message="Test" show={true} onClose={onClose} duration={1000} />)

      // Should not have called yet
      vi.advanceTimersByTime(500)
      expect(onClose).not.toHaveBeenCalled()

      // Now it should call
      vi.advanceTimersByTime(500 + 300)
      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('visibility states', () => {
    it('has visible class when shown', () => {
      render(<Toast message="Test" show={true} onClose={vi.fn()} />)

      const toast = document.querySelector('.toast')
      expect(toast).toHaveClass('toast-visible')
    })

    it('has correct class name structure', () => {
      render(<Toast message="Test" show={true} onClose={vi.fn()} />)

      const toast = document.querySelector('.toast')
      expect(toast).toHaveClass('toast')
    })
  })
})
