import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import Stage3 from './Stage3'

const mockFinalResponse = {
  model: 'google/gemini-pro',
  response: 'This is the **final synthesized answer** based on all responses.',
}

const mockQuestion = 'What is the meaning of life?'

describe('Stage3', () => {
  describe('rendering', () => {
    it('renders null when finalResponse is undefined', () => {
      const { container } = render(<Stage3 finalResponse={undefined} />)
      expect(container.firstChild).toBeNull()
    })

    it('renders null when finalResponse is null', () => {
      const { container } = render(<Stage3 finalResponse={null} />)
      expect(container.firstChild).toBeNull()
    })

    it('renders Quintessence title', () => {
      render(<Stage3 finalResponse={mockFinalResponse} />)
      expect(screen.getByText('Quintessence')).toBeInTheDocument()
    })

    it('renders lead model name in subtitle', () => {
      render(<Stage3 finalResponse={mockFinalResponse} />)
      expect(screen.getByText(/Synthesized by Lead gemini-pro/i)).toBeInTheDocument()
    })

    it('renders full model name in footer badge', () => {
      render(<Stage3 finalResponse={mockFinalResponse} />)
      expect(screen.getByText('google/gemini-pro')).toBeInTheDocument()
    })

    it('renders response content with markdown', () => {
      render(<Stage3 finalResponse={mockFinalResponse} />)

      // Check that the response text is rendered
      expect(screen.getByText(/final synthesized answer/i)).toBeInTheDocument()

      // Check that markdown is rendered (bold text)
      const boldText = screen.getByText('final synthesized answer')
      expect(boldText.tagName).toBe('STRONG')
    })

    it('renders Copy and Download buttons', () => {
      render(<Stage3 finalResponse={mockFinalResponse} />)

      expect(screen.getByRole('button', { name: /Copy/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Download/i })).toBeInTheDocument()
    })

    it('renders leader badge with L icon', () => {
      render(<Stage3 finalResponse={mockFinalResponse} />)

      expect(screen.getByText('L')).toBeInTheDocument()
    })
  })

  describe('model name handling', () => {
    it('extracts short name from model with provider prefix', () => {
      render(<Stage3 finalResponse={{ model: 'openai/gpt-4', response: 'Test' }} />)
      expect(screen.getByText(/Synthesized by Lead gpt-4/i)).toBeInTheDocument()
    })

    it('uses full name when no provider prefix', () => {
      render(<Stage3 finalResponse={{ model: 'custom-model', response: 'Test' }} />)
      expect(screen.getByText(/Synthesized by Lead custom-model/i)).toBeInTheDocument()
    })

    it('shows full model identifier in footer', () => {
      render(<Stage3 finalResponse={{ model: 'anthropic/claude-3', response: 'Test' }} />)
      expect(screen.getByText('anthropic/claude-3')).toBeInTheDocument()
    })
  })

  describe('button attributes', () => {
    it('copy button has correct title', () => {
      render(<Stage3 finalResponse={mockFinalResponse} />)

      const copyBtn = screen.getByRole('button', { name: /Copy/i })
      expect(copyBtn).toHaveAttribute('title', 'Copy question and answer as markdown')
    })

    it('download button has correct title', () => {
      render(<Stage3 finalResponse={mockFinalResponse} />)

      const downloadBtn = screen.getByRole('button', { name: /Download/i })
      expect(downloadBtn).toHaveAttribute('title', 'Download as markdown file')
    })

    it('copy button has action-btn class', () => {
      render(<Stage3 finalResponse={mockFinalResponse} />)

      const copyBtn = screen.getByRole('button', { name: /Copy/i })
      expect(copyBtn).toHaveClass('action-btn')
    })
  })

  describe('response content', () => {
    it('renders markdown lists correctly', () => {
      const responseWithList = {
        model: 'test/model',
        response: '1. First item\n2. Second item\n3. Third item',
      }
      render(<Stage3 finalResponse={responseWithList} />)

      expect(screen.getByText('First item')).toBeInTheDocument()
      expect(screen.getByText('Second item')).toBeInTheDocument()
      expect(screen.getByText('Third item')).toBeInTheDocument()
    })

    it('renders markdown code blocks', () => {
      const responseWithCode = {
        model: 'test/model',
        response: 'Here is code:\n\n```javascript\nconst x = 1;\n```',
      }
      render(<Stage3 finalResponse={responseWithCode} />)

      expect(screen.getByText(/const x = 1/i)).toBeInTheDocument()
    })

    it('sanitizes potentially dangerous HTML', () => {
      const responseWithScript = {
        model: 'test/model',
        response: 'Normal text <script>alert("xss")</script>',
      }
      render(<Stage3 finalResponse={responseWithScript} />)

      // Script tag should not be rendered
      expect(document.querySelector('script')).toBeNull()
      // The text is rendered but script content is stripped
      expect(screen.getByText(/Normal text/)).toBeInTheDocument()
    })
  })

  describe('empty response handling', () => {
    it('renders with empty response string', () => {
      render(<Stage3 finalResponse={{ model: 'test/model', response: '' }} />)

      expect(screen.getByText('Quintessence')).toBeInTheDocument()
      expect(screen.getByText(/Synthesized by Lead model/i)).toBeInTheDocument()
    })
  })
})
