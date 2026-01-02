import { useState, useEffect, useRef } from 'react';
import { billing } from '../api';
import './Settings.css';

function Settings({ isOpen, onClose, userEmail, userBalance, onRefreshBalance }) {
  const [depositOptions, setDepositOptions] = useState([]);
  const [usageHistory, setUsageHistory] = useState([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);

  useEffect(() => {
    if (isOpen) {
      loadDepositOptions();
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

  const loadDepositOptions = async () => {
    setIsLoadingOptions(true);
    setError('');
    try {
      const data = await billing.getDepositOptions();
      setDepositOptions(data);
    } catch (err) {
      setError('Failed to load deposit options');
    } finally {
      setIsLoadingOptions(false);
    }
  };

  const loadUsageHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const data = await billing.getUsageHistory();
      setUsageHistory(data);
    } catch (err) {
      // Non-critical, don't show error
      console.error('Failed to load usage history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleToggleHistory = () => {
    if (!showHistory && usageHistory.length === 0) {
      loadUsageHistory();
    }
    setShowHistory(!showHistory);
  };

  const handleDeposit = async (optionId) => {
    setIsPurchasing(true);
    setError('');
    try {
      await billing.purchaseDeposit(optionId);
      // Redirect happens in purchaseDeposit
    } catch (err) {
      setError(err.message);
      setIsPurchasing(false);
    }
  };

  const formatPrice = (cents) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatCost = (dollars) => {
    return `$${parseFloat(dollars).toFixed(4)}`;
  };

  const formatBalance = (dollars) => {
    if (dollars === null || dollars === undefined) return '$0.00';
    return `$${parseFloat(dollars).toFixed(2)}`;
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
            <h3>Balance</h3>
            <div className="credits-balance">
              <span className="credits-balance-value">{formatBalance(userBalance)}</span>
              <span className="credits-balance-label">available</span>
            </div>
            <p className="settings-desc">
              Each inquiry costs approximately $0.02-0.10 depending on the AI models used.
              You pay only for what you use, plus a 10% service fee.
            </p>
          </section>

          <div className="settings-section-divider">
            <span className="settings-section-divider-ornament">&#167;</span>
          </div>

          <section className="settings-section">
            <h3>Add Funds</h3>

            {isLoadingOptions ? (
              <p className="settings-loading">Loading options...</p>
            ) : (
              <div className="credit-packs">
                {depositOptions.map((option) => (
                  <div key={option.id} className="credit-pack">
                    <div className="pack-info">
                      <span className="pack-name">{option.name}</span>
                      <span className="pack-credits">~{Math.round(option.amount_cents / 5)} inquiries</span>
                    </div>
                    <button
                      className="pack-buy-btn"
                      onClick={() => handleDeposit(option.id)}
                      disabled={isPurchasing}
                    >
                      {formatPrice(option.amount_cents)}
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
              <span>Usage History</span>
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
                ) : usageHistory.length === 0 ? (
                  <p className="history-empty">No usage yet</p>
                ) : (
                  <div className="history-list">
                    {usageHistory.map((usage) => (
                      <div key={usage.id} className="history-item">
                        <div className="history-item-info">
                          <span className="history-amount negative">
                            -{formatCost(usage.total_cost)}
                          </span>
                          <span className="history-type">Query</span>
                        </div>
                        <div className="history-item-meta">
                          <span className="history-desc">
                            API: {formatCost(usage.openrouter_cost)} + Fee: {formatCost(usage.margin_cost)}
                          </span>
                          <span className="history-date">{formatDate(usage.created_at)}</span>
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
