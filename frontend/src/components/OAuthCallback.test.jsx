import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import OAuthCallback from './OAuthCallback'

// Mock navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock API
vi.mock('../api', () => ({
  auth: {
    completeOAuth: vi.fn(),
  },
}))

import { auth } from '../api'

function renderWithRouter(provider = 'google', searchParams = '?code=test-code&state=test-state') {
  return render(
    <MemoryRouter initialEntries={[`/auth/callback/${provider}${searchParams}`]}>
      <Routes>
        <Route path="/auth/callback/:provider" element={<OAuthCallback onLogin={vi.fn()} />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('OAuthCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loading state', () => {
    it('shows loading spinner initially', () => {
      auth.completeOAuth.mockReturnValue(new Promise(() => {})) // Never resolves
      renderWithRouter()

      expect(screen.getByText('Completing sign in...')).toBeInTheDocument()
    })
  })

  describe('successful authentication', () => {
    it('calls completeOAuth with provider, code, and state', async () => {
      auth.completeOAuth.mockResolvedValue({})
      const onLogin = vi.fn()

      render(
        <MemoryRouter initialEntries={['/auth/callback/google?code=abc123&state=xyz789']}>
          <Routes>
            <Route path="/auth/callback/:provider" element={<OAuthCallback onLogin={onLogin} />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(auth.completeOAuth).toHaveBeenCalledWith('google', 'abc123', 'xyz789')
      })
    })

    it('calls onLogin on success', async () => {
      auth.completeOAuth.mockResolvedValue({})
      const onLogin = vi.fn()

      render(
        <MemoryRouter initialEntries={['/auth/callback/google?code=test&state=test']}>
          <Routes>
            <Route path="/auth/callback/:provider" element={<OAuthCallback onLogin={onLogin} />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(onLogin).toHaveBeenCalled()
      })
    })

    it('navigates to home on success', async () => {
      auth.completeOAuth.mockResolvedValue({})

      render(
        <MemoryRouter initialEntries={['/auth/callback/google?code=test&state=test']}>
          <Routes>
            <Route path="/auth/callback/:provider" element={<OAuthCallback onLogin={vi.fn()} />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
      })
    })
  })

  describe('error handling', () => {
    it('shows error when code is missing', async () => {
      render(
        <MemoryRouter initialEntries={['/auth/callback/google?state=test']}>
          <Routes>
            <Route path="/auth/callback/:provider" element={<OAuthCallback onLogin={vi.fn()} />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('No authorization code received')).toBeInTheDocument()
      })
    })

    it('shows error when OAuth provider returns error', async () => {
      render(
        <MemoryRouter initialEntries={['/auth/callback/google?error=access_denied']}>
          <Routes>
            <Route path="/auth/callback/:provider" element={<OAuthCallback onLogin={vi.fn()} />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Authentication was cancelled or failed/)).toBeInTheDocument()
      })
    })

    it('shows error when completeOAuth fails', async () => {
      auth.completeOAuth.mockRejectedValue(new Error('Invalid state'))

      render(
        <MemoryRouter initialEntries={['/auth/callback/google?code=test&state=test']}>
          <Routes>
            <Route path="/auth/callback/:provider" element={<OAuthCallback onLogin={vi.fn()} />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('Invalid state')).toBeInTheDocument()
      })
    })

    it('shows generic error when completeOAuth fails without message', async () => {
      auth.completeOAuth.mockRejectedValue(new Error())

      render(
        <MemoryRouter initialEntries={['/auth/callback/google?code=test&state=test']}>
          <Routes>
            <Route path="/auth/callback/:provider" element={<OAuthCallback onLogin={vi.fn()} />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText('Authentication failed')).toBeInTheDocument()
      })
    })

    it('shows retry button on error', async () => {
      render(
        <MemoryRouter initialEntries={['/auth/callback/google?error=access_denied']}>
          <Routes>
            <Route path="/auth/callback/:provider" element={<OAuthCallback onLogin={vi.fn()} />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Return to login' })).toBeInTheDocument()
      })
    })

    it('navigates to home when retry clicked', async () => {
      const user = userEvent.setup()

      render(
        <MemoryRouter initialEntries={['/auth/callback/google?error=access_denied']}>
          <Routes>
            <Route path="/auth/callback/:provider" element={<OAuthCallback onLogin={vi.fn()} />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Return to login' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: 'Return to login' }))

      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  describe('different providers', () => {
    it('works with github provider', async () => {
      auth.completeOAuth.mockResolvedValue({})

      render(
        <MemoryRouter initialEntries={['/auth/callback/github?code=gh-code&state=gh-state']}>
          <Routes>
            <Route path="/auth/callback/:provider" element={<OAuthCallback onLogin={vi.fn()} />} />
          </Routes>
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(auth.completeOAuth).toHaveBeenCalledWith('github', 'gh-code', 'gh-state')
      })
    })
  })
})
