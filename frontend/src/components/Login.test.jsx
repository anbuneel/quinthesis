import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Login from './Login'

// Mock API
vi.mock('../api', () => ({
  auth: {
    startOAuth: vi.fn(),
  },
}))

import { auth } from '../api'

function renderWithRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders masthead with title', () => {
      renderWithRouter(<Login onLogin={vi.fn()} />)

      expect(screen.getByText('The')).toBeInTheDocument()
      expect(screen.getByText('Quinthesis')).toBeInTheDocument()
    })

    it('renders editorial headline', () => {
      renderWithRouter(<Login onLogin={vi.fn()} />)

      expect(screen.getByText('The second opinion your AI answer deserves')).toBeInTheDocument()
    })

    it('renders tagline', () => {
      renderWithRouter(<Login onLogin={vi.fn()} />)

      expect(screen.getByText(/Multiple AI models deliberate/)).toBeInTheDocument()
    })

    it('renders process steps', () => {
      renderWithRouter(<Login onLogin={vi.fn()} />)

      expect(screen.getByText('First Opinions')).toBeInTheDocument()
      expect(screen.getByText('Peer Review')).toBeInTheDocument()
      expect(screen.getByText('Synthesis')).toBeInTheDocument()
    })

    it('renders model badges', () => {
      renderWithRouter(<Login onLogin={vi.fn()} />)

      expect(screen.getByText('ChatGPT')).toBeInTheDocument()
      expect(screen.getByText('Gemini')).toBeInTheDocument()
      expect(screen.getByText('Claude')).toBeInTheDocument()
    })

    it('renders demo link', () => {
      renderWithRouter(<Login onLogin={vi.fn()} />)

      expect(screen.getByText('See Example Deliberations')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /See Example Deliberations/ })).toHaveAttribute('href', '/demo')
    })

    it('renders legal links', () => {
      renderWithRouter(<Login onLogin={vi.fn()} />)

      expect(screen.getByText('Privacy Policy')).toBeInTheDocument()
      expect(screen.getByText('Terms of Service')).toBeInTheDocument()
    })

    it('renders attribution links', () => {
      renderWithRouter(<Login onLogin={vi.fn()} />)

      const links = screen.getAllByText("Andrej Karpathy's LLM Council")
      expect(links.length).toBeGreaterThan(0)
    })
  })

  describe('OAuth buttons', () => {
    it('renders Google sign-in button', () => {
      renderWithRouter(<Login onLogin={vi.fn()} />)

      expect(screen.getByRole('button', { name: /Continue with Google/i })).toBeInTheDocument()
    })

    it('renders GitHub sign-in button', () => {
      renderWithRouter(<Login onLogin={vi.fn()} />)

      expect(screen.getByRole('button', { name: /Continue with GitHub/i })).toBeInTheDocument()
    })

    it('calls startOAuth with google when Google button clicked', async () => {
      const user = userEvent.setup()
      auth.startOAuth.mockResolvedValue()

      renderWithRouter(<Login onLogin={vi.fn()} />)

      await user.click(screen.getByRole('button', { name: /Continue with Google/i }))

      expect(auth.startOAuth).toHaveBeenCalledWith('google')
    })

    it('calls startOAuth with github when GitHub button clicked', async () => {
      const user = userEvent.setup()
      auth.startOAuth.mockResolvedValue()

      renderWithRouter(<Login onLogin={vi.fn()} />)

      await user.click(screen.getByRole('button', { name: /Continue with GitHub/i }))

      expect(auth.startOAuth).toHaveBeenCalledWith('github')
    })
  })

  describe('loading states', () => {
    it('shows loading state for Google button', async () => {
      const user = userEvent.setup()
      // Make startOAuth hang
      auth.startOAuth.mockReturnValue(new Promise(() => {}))

      renderWithRouter(<Login onLogin={vi.fn()} />)

      await user.click(screen.getByRole('button', { name: /Continue with Google/i }))

      expect(screen.getByText('Connecting...')).toBeInTheDocument()
    })

    it('disables both buttons when loading', async () => {
      const user = userEvent.setup()
      auth.startOAuth.mockReturnValue(new Promise(() => {}))

      renderWithRouter(<Login onLogin={vi.fn()} />)

      await user.click(screen.getByRole('button', { name: /Continue with Google/i }))

      // Both buttons should be disabled
      const buttons = screen.getAllByRole('button')
      buttons.forEach((btn) => {
        expect(btn).toBeDisabled()
      })
    })
  })

  describe('error handling', () => {
    it('shows error message when OAuth fails', async () => {
      const user = userEvent.setup()
      auth.startOAuth.mockRejectedValue(new Error('OAuth failed'))

      renderWithRouter(<Login onLogin={vi.fn()} />)

      await user.click(screen.getByRole('button', { name: /Continue with Google/i }))

      expect(screen.getByText('OAuth failed')).toBeInTheDocument()
    })

    it('shows generic error when no message', async () => {
      const user = userEvent.setup()
      auth.startOAuth.mockRejectedValue(new Error())

      renderWithRouter(<Login onLogin={vi.fn()} />)

      await user.click(screen.getByRole('button', { name: /Continue with Google/i }))

      expect(screen.getByText('Failed to start authentication')).toBeInTheDocument()
    })

    it('re-enables buttons after error', async () => {
      const user = userEvent.setup()
      auth.startOAuth.mockRejectedValue(new Error('Failed'))

      renderWithRouter(<Login onLogin={vi.fn()} />)

      await user.click(screen.getByRole('button', { name: /Continue with Google/i }))

      // Wait for error to show
      expect(screen.getByText('Failed')).toBeInTheDocument()

      // Buttons should be enabled again
      expect(screen.getByRole('button', { name: /Continue with Google/i })).toBeEnabled()
    })
  })

  describe('pricing note', () => {
    it('shows BYOK option', () => {
      renderWithRouter(<Login onLogin={vi.fn()} />)

      expect(screen.getByText(/Bring your own OpenRouter key/)).toBeInTheDocument()
    })

    it('shows pay as you go option', () => {
      renderWithRouter(<Login onLogin={vi.fn()} />)

      expect(screen.getByText('Pay as you go')).toBeInTheDocument()
    })
  })
})
