import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './AvatarMenu.css';

/**
 * Avatar dropdown menu for user account actions.
 * Shows user initial or profile picture, with dropdown for account/logout.
 */
export default function AvatarMenu({
  userEmail,
  avatarUrl,
  onLogout,
}) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Get user initial from email
  const initial = userEmail ? userEmail.charAt(0).toUpperCase() : '?';

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleAccount = () => {
    setIsOpen(false);
    navigate('/account');
  };

  const handleLogout = () => {
    setIsOpen(false);
    onLogout?.();
  };

  return (
    <div className="avatar-menu" ref={menuRef}>
      <button
        type="button"
        className="avatar-btn"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Account menu"
        title={userEmail || 'Account'}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" />
        ) : (
          initial
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="avatar-menu-overlay"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="avatar-dropdown" role="menu">
            <div className="avatar-dropdown-header">
              <span className="avatar-dropdown-email">{userEmail}</span>
            </div>
            <div className="avatar-dropdown-items">
              <button
                type="button"
                className="avatar-dropdown-item"
                onClick={handleAccount}
                role="menuitem"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                Account
              </button>
              <div className="avatar-dropdown-divider" role="separator" />
              <button
                type="button"
                className="avatar-dropdown-item logout"
                onClick={handleLogout}
                role="menuitem"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                Logout
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
