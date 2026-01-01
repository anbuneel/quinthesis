import { useState, useEffect, useRef } from 'react';
import { credits } from '../api';
import './Settings.css';

function Settings({ isOpen, onClose, userEmail, userCredits, onRefreshCredits }) {
  const [packs, setPacks] = useState([]);
  const [history, setHistory] = useState([]);
  const [isLoadingPacks, setIsLoadingPacks] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);

  useEffect(() => {
    if (isOpen) {
      loadPacks();
      // Store the previously focused element
      previousActiveElement.current = document.activeElement;
      // Focus the modal
      setTimeout(() => modalRef.current?.focus(), 0);
    } else {
      // Restore focus when modal closes
      previousActiveElement.current?.focus();
    }
  }, [isOpen]);

  // Handle Escape key and focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Focus trap
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const loadPacks = async () => {
    setIsLoadingPacks(true);
    setError('');
    try {
      const data = await credits.getPacks();
      setPacks(data);
    } catch (err) {
      setError('Failed to load credit packs');
    } finally {
      setIsLoadingPacks(false);
    }
  };

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const data = await credits.getHistory();
      setHistory(data);
    } catch (err) {
      // Non-critical, don't show error
      console.error('Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleToggleHistory = () => {
    if (!showHistory && history.length === 0) {
      loadHistory();
    }
    setShowHistory(!showHistory);
  };

  const handlePurchase = async (packId) => {
    setIsPurchasing(true);
    setError('');
    try {
      await credits.purchasePack(packId);
      // Redirect happens in purchasePack
    } catch (err) {
      setError(err.message);
      setIsPurchasing(false);
    }
  };

  const formatPrice = (cents) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose} role="presentation">
      <div
        className="settings-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        ref={modalRef}
        tabIndex={-1}
      >
        <div className="settings-header">
          <button className="settings-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <div className="settings-title-wrapper">
            <span className="settings-title-rule"></span>
            <h2 id="settings-title">Settings</h2>
            <span className="settings-title-rule"></span>
          </div>
          <div className="settings-header-divider">
            <span className="settings-divider-line"></span>
            <span className="settings-divider-ornament">&#9830;</span>
            <span className="settings-divider-line"></span>
          </div>
        </div>

        <div className="settings-body">
          {error && <div className="settings-message settings-error">{error}</div>}

          <section className="settings-section">
            <h3>Account</h3>
            <div className="account-info">
              <span className="account-label">Email:</span>
              <span className="account-value">{userEmail || 'Unknown'}</span>
            </div>
          </section>

          <div className="settings-section-divider">
            <span className="settings-section-divider-ornament">&#167;</span>
          </div>

          <section className="settings-section">
            <h3>Credits</h3>
            <div className="credits-balance">
              <span className="credits-balance-value">{userCredits ?? 0}</span>
              <span className="credits-balance-label">credits available</span>
            </div>
            <p className="settings-desc">
              Each inquiry uses 1 credit. Purchase credits below to continue using AI Council.
            </p>
          </section>

          <div className="settings-section-divider">
            <span className="settings-section-divider-ornament">&#167;</span>
          </div>

          <section className="settings-section">
            <h3>Purchase Credits</h3>

            {isLoadingPacks ? (
              <p className="settings-loading">Loading packs...</p>
            ) : (
              <div className="credit-packs">
                {packs.map((pack) => (
                  <div key={pack.id} className="credit-pack">
                    <div className="pack-info">
                      <span className="pack-name">{pack.name}</span>
                      <span className="pack-credits">{pack.credits} credits</span>
                    </div>
                    <button
                      className="pack-buy-btn"
                      onClick={() => handlePurchase(pack.id)}
                      disabled={isPurchasing}
                    >
                      {formatPrice(pack.price_cents)}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="settings-section-divider">
            <span className="settings-section-divider-ornament">&#167;</span>
          </div>

          <section className="settings-section">
            <button
              className="history-toggle"
              onClick={handleToggleHistory}
              aria-expanded={showHistory}
            >
              <span>Transaction History</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`history-toggle-icon ${showHistory ? 'expanded' : ''}`}
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            {showHistory && (
              <div className="transaction-history">
                {isLoadingHistory ? (
                  <p className="settings-loading">Loading history...</p>
                ) : history.length === 0 ? (
                  <p className="history-empty">No transactions yet</p>
                ) : (
                  <div className="history-list">
                    {history.map((tx) => (
                      <div key={tx.id} className="history-item">
                        <div className="history-item-info">
                          <span className={`history-amount ${tx.amount > 0 ? 'positive' : 'negative'}`}>
                            {tx.amount > 0 ? '+' : ''}{tx.amount}
                          </span>
                          <span className="history-type">{tx.transaction_type}</span>
                        </div>
                        <div className="history-item-meta">
                          <span className="history-desc">{tx.description || '-'}</span>
                          <span className="history-date">{formatDate(tx.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default Settings;
