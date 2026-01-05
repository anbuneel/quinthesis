import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import TermsOfService from './TermsOfService'

// Mock Masthead
vi.mock('./Masthead', () => ({
  default: ({ variant }) => <div data-testid="masthead" data-variant={variant} />,
}))

// Mock LEGAL_CONFIG
vi.mock('../legalConfig', () => ({
  LEGAL_CONFIG: {
    termsOfServiceLastUpdated: 'January 1, 2026',
    repositoryUrl: 'https://github.com/test/repo',
  },
}))

function renderWithRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('TermsOfService', () => {
  describe('rendering', () => {
    it('renders masthead with minimal variant', () => {
      renderWithRouter(<TermsOfService />)

      expect(screen.getByTestId('masthead')).toHaveAttribute('data-variant', 'minimal')
    })

    it('renders page title', () => {
      renderWithRouter(<TermsOfService />)

      expect(screen.getByText('Terms of Service')).toBeInTheDocument()
    })

    it('renders last updated date', () => {
      renderWithRouter(<TermsOfService />)

      expect(screen.getByText(/Last updated: January 1, 2026/)).toBeInTheDocument()
    })
  })

  describe('content sections', () => {
    it('renders Acceptance of Terms section', () => {
      renderWithRouter(<TermsOfService />)

      expect(screen.getByText('1. Acceptance of Terms')).toBeInTheDocument()
    })

    it('renders Description of Service section', () => {
      renderWithRouter(<TermsOfService />)

      expect(screen.getByText('2. Description of Service')).toBeInTheDocument()
    })

    it('renders Account Registration section', () => {
      renderWithRouter(<TermsOfService />)

      expect(screen.getByText('3. Account Registration')).toBeInTheDocument()
    })

    it('renders Payment and Billing section', () => {
      renderWithRouter(<TermsOfService />)

      expect(screen.getByText('4. Payment and Billing')).toBeInTheDocument()
    })

    it('renders Acceptable Use section', () => {
      renderWithRouter(<TermsOfService />)

      expect(screen.getByText('5. Acceptable Use')).toBeInTheDocument()
    })

    it('renders AI-Generated Content section', () => {
      renderWithRouter(<TermsOfService />)

      expect(screen.getByText('6. AI-Generated Content')).toBeInTheDocument()
    })

    it('renders Intellectual Property section', () => {
      renderWithRouter(<TermsOfService />)

      expect(screen.getByText('7. Intellectual Property')).toBeInTheDocument()
    })

    it('renders Third-Party Services section', () => {
      renderWithRouter(<TermsOfService />)

      expect(screen.getByText('8. Third-Party Services')).toBeInTheDocument()
    })

    it('renders Limitation of Liability section', () => {
      renderWithRouter(<TermsOfService />)

      expect(screen.getByText('9. Limitation of Liability')).toBeInTheDocument()
    })

    it('renders Indemnification section', () => {
      renderWithRouter(<TermsOfService />)

      expect(screen.getByText('10. Indemnification')).toBeInTheDocument()
    })

    it('renders Service Availability section', () => {
      renderWithRouter(<TermsOfService />)

      expect(screen.getByText('11. Service Availability')).toBeInTheDocument()
    })

    it('renders Modifications to Terms section', () => {
      renderWithRouter(<TermsOfService />)

      expect(screen.getByText('12. Modifications to Terms')).toBeInTheDocument()
    })

    it('renders Termination section', () => {
      renderWithRouter(<TermsOfService />)

      expect(screen.getByText('13. Termination')).toBeInTheDocument()
    })

    it('renders Governing Law section', () => {
      renderWithRouter(<TermsOfService />)

      expect(screen.getByText('14. Governing Law')).toBeInTheDocument()
    })

    it('renders Contact section', () => {
      renderWithRouter(<TermsOfService />)

      expect(screen.getByText('15. Contact')).toBeInTheDocument()
    })
  })

  describe('payment subsections', () => {
    it('renders Usage-Based Pricing subsection', () => {
      renderWithRouter(<TermsOfService />)

      expect(screen.getByText('Usage-Based Pricing')).toBeInTheDocument()
    })

    it('renders Deposits subsection', () => {
      renderWithRouter(<TermsOfService />)

      expect(screen.getByText('Deposits')).toBeInTheDocument()
    })

    it('renders BYOK subsection', () => {
      renderWithRouter(<TermsOfService />)

      expect(screen.getByText('BYOK (Bring Your Own Key)')).toBeInTheDocument()
    })
  })

  describe('footer links', () => {
    it('renders Privacy Policy link', () => {
      renderWithRouter(<TermsOfService />)

      expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy')
    })

    it('renders Return to Quinthesis link', () => {
      renderWithRouter(<TermsOfService />)

      expect(screen.getByRole('link', { name: 'Return to Quinthesis' })).toHaveAttribute('href', '/')
    })
  })

  describe('external links', () => {
    it('renders GitHub repository link', () => {
      renderWithRouter(<TermsOfService />)

      expect(screen.getByRole('link', { name: 'GitHub repository' })).toHaveAttribute('href', 'https://github.com/test/repo')
    })
  })

  describe('important notices', () => {
    it('highlights AI-Generated Content warning', () => {
      renderWithRouter(<TermsOfService />)

      expect(screen.getByText(/should not be treated as professional advice/)).toBeInTheDocument()
    })

    it('mentions non-refundable deposits', () => {
      renderWithRouter(<TermsOfService />)

      expect(screen.getByText('Deposits are non-refundable')).toBeInTheDocument()
    })
  })
})
