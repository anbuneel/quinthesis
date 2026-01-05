import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import PrivacyPolicy from './PrivacyPolicy'

// Mock Masthead
vi.mock('./Masthead', () => ({
  default: ({ variant }) => <div data-testid="masthead" data-variant={variant} />,
}))

// Mock LEGAL_CONFIG
vi.mock('../legalConfig', () => ({
  LEGAL_CONFIG: {
    privacyPolicyLastUpdated: 'January 1, 2026',
    repositoryUrl: 'https://github.com/test/repo',
  },
}))

function renderWithRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('PrivacyPolicy', () => {
  describe('rendering', () => {
    it('renders masthead with minimal variant', () => {
      renderWithRouter(<PrivacyPolicy />)

      expect(screen.getByTestId('masthead')).toHaveAttribute('data-variant', 'minimal')
    })

    it('renders page title', () => {
      renderWithRouter(<PrivacyPolicy />)

      expect(screen.getByText('Privacy Policy')).toBeInTheDocument()
    })

    it('renders last updated date', () => {
      renderWithRouter(<PrivacyPolicy />)

      expect(screen.getByText(/Last updated: January 1, 2026/)).toBeInTheDocument()
    })
  })

  describe('content sections', () => {
    it('renders Overview section', () => {
      renderWithRouter(<PrivacyPolicy />)

      expect(screen.getByText('Overview')).toBeInTheDocument()
    })

    it('renders Data We Collect section', () => {
      renderWithRouter(<PrivacyPolicy />)

      expect(screen.getByText('Data We Collect')).toBeInTheDocument()
    })

    it('renders Account Information subsection', () => {
      renderWithRouter(<PrivacyPolicy />)

      expect(screen.getByText('Account Information')).toBeInTheDocument()
    })

    it('renders Conversation Data subsection', () => {
      renderWithRouter(<PrivacyPolicy />)

      expect(screen.getByText('Conversation Data')).toBeInTheDocument()
    })

    it('renders Financial Data subsection', () => {
      renderWithRouter(<PrivacyPolicy />)

      expect(screen.getByText('Financial Data')).toBeInTheDocument()
    })

    it('renders Third-Party Data Sharing section', () => {
      renderWithRouter(<PrivacyPolicy />)

      expect(screen.getByText('Third-Party Data Sharing')).toBeInTheDocument()
    })

    it('renders Data Retention section', () => {
      renderWithRouter(<PrivacyPolicy />)

      expect(screen.getByText('Data Retention')).toBeInTheDocument()
    })

    it('renders Data Security section', () => {
      renderWithRouter(<PrivacyPolicy />)

      expect(screen.getByText('Data Security')).toBeInTheDocument()
    })

    it('renders Your Rights section', () => {
      renderWithRouter(<PrivacyPolicy />)

      expect(screen.getByText('Your Rights')).toBeInTheDocument()
    })

    it('renders What We Don\'t Collect section', () => {
      renderWithRouter(<PrivacyPolicy />)

      expect(screen.getByText("What We Don't Collect")).toBeInTheDocument()
    })

    it('renders Data Location section', () => {
      renderWithRouter(<PrivacyPolicy />)

      expect(screen.getByText('Data Location')).toBeInTheDocument()
    })

    it('renders Contact section', () => {
      renderWithRouter(<PrivacyPolicy />)

      expect(screen.getByText('Contact')).toBeInTheDocument()
    })
  })

  describe('footer links', () => {
    it('renders Terms of Service link', () => {
      renderWithRouter(<PrivacyPolicy />)

      expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms')
    })

    it('renders Return to Quinthesis link', () => {
      renderWithRouter(<PrivacyPolicy />)

      expect(screen.getByRole('link', { name: 'Return to Quinthesis' })).toHaveAttribute('href', '/')
    })
  })

  describe('external links', () => {
    it('renders OpenRouter link', () => {
      renderWithRouter(<PrivacyPolicy />)

      expect(screen.getByRole('link', { name: 'OpenRouter' })).toHaveAttribute('href', 'https://openrouter.ai')
    })

    it('renders Stripe link', () => {
      renderWithRouter(<PrivacyPolicy />)

      expect(screen.getByRole('link', { name: 'Stripe' })).toHaveAttribute('href', 'https://stripe.com')
    })

    it('renders GitHub repository link', () => {
      renderWithRouter(<PrivacyPolicy />)

      expect(screen.getByRole('link', { name: 'GitHub repository' })).toHaveAttribute('href', 'https://github.com/test/repo')
    })
  })

  describe('rights table', () => {
    it('renders rights table', () => {
      renderWithRouter(<PrivacyPolicy />)

      expect(screen.getByRole('table')).toBeInTheDocument()
    })

    it('shows View your data right', () => {
      renderWithRouter(<PrivacyPolicy />)

      expect(screen.getByText('View your data')).toBeInTheDocument()
    })

    it('shows Export your data right', () => {
      renderWithRouter(<PrivacyPolicy />)

      expect(screen.getByText('Export your data')).toBeInTheDocument()
    })

    it('shows Delete your account right', () => {
      renderWithRouter(<PrivacyPolicy />)

      expect(screen.getByText('Delete your account')).toBeInTheDocument()
    })
  })
})
