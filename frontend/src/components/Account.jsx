import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { billing, auth } from '../api';
import './Account.css';

function Account({ onRefreshBalance }) {
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState(null);
  const [balance, setBalance] = useState(null);
  const [depositOptions, setDepositOptions] = useState([]);
  const [usageHistory, setUsageHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState('');
  const [expandedTx, setExpandedTx] = useState(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [user, balanceData, options, history] = await Promise.all([
        auth.getMe(),
        billing.getBalance(),
        billing.getDepositOptions(),
        billing.getUsageHistory(),
      ]);
      setUserInfo(user);
      setBalance(balanceData);
      setDepositOptions(options);
      setUsageHistory(history);
      if (onRefreshBalance) onRefreshBalance();
    } catch (err) {
      setError('Failed to load account data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeposit = async (optionId) => {
    setIsPurchasing(true);
    setError('');
    try {
      await billing.purchaseDeposit(optionId);
    } catch (err) {
      setError(err.message || 'Failed to process deposit');
      setIsPurchasing(false);
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  const formatBalance = (amount) => {
    if (amount === null || amount === undefined) return '$0.00';
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  const formatCost = (dollars) => {
    if (dollars === null || dollars === undefined) return '$0.0000';
    return `$${parseFloat(dollars).toFixed(4)}`;
  };

  const formatPrice = (cents) => {
    return `$${(cents / 100).toFixed(0)}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="account-page">
        <div className="account-container">
          <p className="account-loading">Loading account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="account-page">
      <div className="account-container">
        {/* Header */}
        <header className="account-header">
          <button className="account-back" onClick={handleBack}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="account-title-wrapper">
            <span className="account-title-rule"></span>
            <h1>Account</h1>
            <span className="account-title-rule"></span>
          </div>
        </header>

        {error && <div className="account-error">{error}</div>}

        {/* Two column layout */}
        <div className="account-content">
          {/* Left column */}
          <div className="account-column">
            {/* Balance */}
            <section className="account-section">
              <h2>Balance</h2>
              <div className="balance-card">
                <span className="balance-value">{formatBalance(balance?.balance)}</span>
                <span className="balance-label">available</span>
              </div>
              <div className="balance-stats">
                <div className="balance-stat">
                  <span className="balance-stat-label">Total Deposited</span>
                  <span className="balance-stat-value">{formatBalance(balance?.total_deposited)}</span>
                </div>
                <div className="balance-stat">
                  <span className="balance-stat-label">Total Spent</span>
                  <span className="balance-stat-value">{formatBalance(balance?.total_spent)}</span>
                </div>
              </div>
            </section>

            <div className="account-divider">
              <span className="account-divider-ornament">&#167;</span>
            </div>

            {/* Add Funds */}
            <section className="account-section">
              <h2>Add Funds</h2>
              <div className="deposit-options">
                {depositOptions.map((option) => (
                  <div key={option.id} className="deposit-option">
                    <div className="deposit-info">
                      <span className="deposit-name">{option.name}</span>
                      <span className="deposit-estimate">~{Math.round(option.amount_cents / 5)} inquiries</span>
                    </div>
                    <button
                      className="deposit-btn"
                      onClick={() => handleDeposit(option.id)}
                      disabled={isPurchasing}
                    >
                      {formatPrice(option.amount_cents)}
                    </button>
                  </div>
                ))}
              </div>
              <p className="account-note">
                Each inquiry costs approximately $0.02–$0.10 depending on the AI models used.
              </p>
            </section>

            <div className="account-divider">
              <span className="account-divider-ornament">&#167;</span>
            </div>

            {/* Member Info */}
            {userInfo && (
              <section className="account-section">
                <h2>Membership</h2>
                <div className="member-info">
                  <div className="member-row">
                    <span className="member-label">Email</span>
                    <span className="member-value">{userInfo.email}</span>
                  </div>
                  <div className="member-row">
                    <span className="member-label">Provider</span>
                    <span className="member-value">{userInfo.oauth_provider}</span>
                  </div>
                  <div className="member-row">
                    <span className="member-label">Member since</span>
                    <span className="member-value">
                      {new Date(userInfo.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* Right column */}
          <div className="account-column">
            <section className="account-section">
              <h2>Usage History</h2>
              {usageHistory.length === 0 ? (
                <p className="history-empty">No usage yet</p>
              ) : (
                <div className="history-list">
                  {usageHistory.map((tx) => (
                    <div key={tx.id} className="history-item">
                      <button
                        className="history-item-main"
                        onClick={() => setExpandedTx(expandedTx === tx.id ? null : tx.id)}
                      >
                        <div className="history-item-info">
                          <span className="history-amount">-{formatCost(tx.total_cost)}</span>
                          <span className="history-type">Query</span>
                        </div>
                        <span className="history-date">{formatDate(tx.created_at)}</span>
                      </button>
                      {expandedTx === tx.id && (
                        <div className="history-details">
                          <div className="history-detail">
                            <span>API Cost:</span>
                            <span>{formatCost(tx.openrouter_cost)}</span>
                          </div>
                          <div className="history-detail">
                            <span>Service Fee:</span>
                            <span>{formatCost(tx.margin_cost)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Account;
