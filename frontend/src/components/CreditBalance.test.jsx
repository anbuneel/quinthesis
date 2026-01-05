import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import CreditBalance from './CreditBalance'

describe('CreditBalance', () => {
  describe('credits mode', () => {
    it('renders balance button with title', () => {
      render(<CreditBalance balance={5.0} isByokMode={false} onClick={vi.fn()} />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('title', 'View balance')
    })

    it('displays balance with dollar sign', () => {
      render(<CreditBalance balance={5.0} isByokMode={false} onClick={vi.fn()} />)

      expect(screen.getByText('$')).toBeInTheDocument()
      expect(screen.getByText('5.00')).toBeInTheDocument()
    })

    it('formats balance to 2 decimal places', () => {
      render(<CreditBalance balance={10.567} isByokMode={false} onClick={vi.fn()} />)

      expect(screen.getByText('10.57')).toBeInTheDocument()
    })

    it('handles null balance', () => {
      render(<CreditBalance balance={null} isByokMode={false} onClick={vi.fn()} />)

      expect(screen.getByText('0.00')).toBeInTheDocument()
    })

    it('handles undefined balance', () => {
      render(<CreditBalance isByokMode={false} onClick={vi.fn()} />)

      expect(screen.getByText('0.00')).toBeInTheDocument()
    })

    it('calls onClick when clicked', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      render(<CreditBalance balance={5.0} isByokMode={false} onClick={onClick} />)

      await user.click(screen.getByRole('button'))

      expect(onClick).toHaveBeenCalled()
    })
  })

  describe('BYOK mode', () => {
    it('shows key indicator instead of balance', () => {
      render(<CreditBalance balance={5.0} isByokMode={true} onClick={vi.fn()} />)

      expect(screen.getByText('Your Key')).toBeInTheDocument()
      expect(screen.queryByText('5.00')).not.toBeInTheDocument()
    })

    it('has different title for BYOK mode', () => {
      render(<CreditBalance balance={5.0} isByokMode={true} onClick={vi.fn()} />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('title', 'Using your OpenRouter key')
    })

    it('calls onClick when clicked in BYOK mode', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      render(<CreditBalance balance={5.0} isByokMode={true} onClick={onClick} />)

      await user.click(screen.getByRole('button'))

      expect(onClick).toHaveBeenCalled()
    })

    it('renders key icon SVG', () => {
      render(<CreditBalance balance={5.0} isByokMode={true} onClick={vi.fn()} />)

      // Button should contain an SVG element
      const button = screen.getByRole('button')
      expect(button.querySelector('svg')).toBeInTheDocument()
    })
  })
})
