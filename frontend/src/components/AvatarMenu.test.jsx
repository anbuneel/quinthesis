import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import AvatarMenu from './AvatarMenu'

// Mock navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

function renderWithRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

const defaultProps = {
  userEmail: 'test@example.com',
  avatarUrl: null,
  onLogout: vi.fn(),
}

describe('AvatarMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders avatar button', () => {
      renderWithRouter(<AvatarMenu {...defaultProps} />)

      expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument()
    })

    it('shows user initial when no avatar URL', () => {
      renderWithRouter(<AvatarMenu {...defaultProps} />)

      expect(screen.getByText('T')).toBeInTheDocument()
    })

    it('shows avatar image when URL provided', () => {
      renderWithRouter(
        <AvatarMenu {...defaultProps} avatarUrl="https://example.com/avatar.jpg" />
      )

      // img with empty alt has role="presentation", so use querySelector
      const img = document.querySelector('img')
      expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg')
    })

    it('shows ? when no email', () => {
      renderWithRouter(<AvatarMenu {...defaultProps} userEmail={null} />)

      expect(screen.getByText('?')).toBeInTheDocument()
    })

    it('has title attribute with email', () => {
      renderWithRouter(<AvatarMenu {...defaultProps} />)

      expect(screen.getByRole('button', { name: 'Account menu' })).toHaveAttribute('title', 'test@example.com')
    })
  })

  describe('dropdown behavior', () => {
    it('dropdown is closed by default', () => {
      renderWithRouter(<AvatarMenu {...defaultProps} />)

      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('opens dropdown when button clicked', async () => {
      const user = userEvent.setup()
      renderWithRouter(<AvatarMenu {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: 'Account menu' }))

      expect(screen.getByRole('menu')).toBeInTheDocument()
    })

    it('shows email in dropdown header', async () => {
      const user = userEvent.setup()
      renderWithRouter(<AvatarMenu {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: 'Account menu' }))

      expect(screen.getByText('test@example.com')).toBeInTheDocument()
    })

    it('shows Account and Logout menu items', async () => {
      const user = userEvent.setup()
      renderWithRouter(<AvatarMenu {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: 'Account menu' }))

      expect(screen.getByRole('menuitem', { name: 'Account' })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: 'Logout' })).toBeInTheDocument()
    })

    it('closes dropdown when button clicked again', async () => {
      const user = userEvent.setup()
      renderWithRouter(<AvatarMenu {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: 'Account menu' }))
      expect(screen.getByRole('menu')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Account menu' }))
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('closes dropdown when overlay clicked', async () => {
      const user = userEvent.setup()
      renderWithRouter(<AvatarMenu {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: 'Account menu' }))
      expect(screen.getByRole('menu')).toBeInTheDocument()

      // Click the overlay
      await user.click(document.querySelector('.avatar-menu-overlay'))
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
  })

  describe('keyboard interactions', () => {
    it('closes dropdown on Escape key', async () => {
      const user = userEvent.setup()
      renderWithRouter(<AvatarMenu {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: 'Account menu' }))
      expect(screen.getByRole('menu')).toBeInTheDocument()

      await user.keyboard('{Escape}')
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
  })

  describe('menu actions', () => {
    it('navigates to /account when Account clicked', async () => {
      const user = userEvent.setup()
      renderWithRouter(<AvatarMenu {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: 'Account menu' }))
      await user.click(screen.getByRole('menuitem', { name: 'Account' }))

      expect(mockNavigate).toHaveBeenCalledWith('/account')
    })

    it('closes dropdown after Account click', async () => {
      const user = userEvent.setup()
      renderWithRouter(<AvatarMenu {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: 'Account menu' }))
      await user.click(screen.getByRole('menuitem', { name: 'Account' }))

      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('calls onLogout when Logout clicked', async () => {
      const user = userEvent.setup()
      renderWithRouter(<AvatarMenu {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: 'Account menu' }))
      await user.click(screen.getByRole('menuitem', { name: 'Logout' }))

      expect(defaultProps.onLogout).toHaveBeenCalled()
    })

    it('closes dropdown after Logout click', async () => {
      const user = userEvent.setup()
      renderWithRouter(<AvatarMenu {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: 'Account menu' }))
      await user.click(screen.getByRole('menuitem', { name: 'Logout' }))

      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has aria-expanded attribute', async () => {
      const user = userEvent.setup()
      renderWithRouter(<AvatarMenu {...defaultProps} />)

      const button = screen.getByRole('button', { name: 'Account menu' })
      expect(button).toHaveAttribute('aria-expanded', 'false')

      await user.click(button)
      expect(button).toHaveAttribute('aria-expanded', 'true')
    })

    it('has aria-haspopup attribute', () => {
      renderWithRouter(<AvatarMenu {...defaultProps} />)

      expect(screen.getByRole('button', { name: 'Account menu' })).toHaveAttribute('aria-haspopup', 'true')
    })

    it('dropdown has menu role', async () => {
      const user = userEvent.setup()
      renderWithRouter(<AvatarMenu {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: 'Account menu' }))

      expect(screen.getByRole('menu')).toBeInTheDocument()
    })

    it('menu items have menuitem role', async () => {
      const user = userEvent.setup()
      renderWithRouter(<AvatarMenu {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: 'Account menu' }))

      expect(screen.getAllByRole('menuitem')).toHaveLength(2)
    })

    it('has separator between menu sections', async () => {
      const user = userEvent.setup()
      renderWithRouter(<AvatarMenu {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: 'Account menu' }))

      expect(screen.getByRole('separator')).toBeInTheDocument()
    })
  })
})
