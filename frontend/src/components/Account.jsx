import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { billing, auth } from '../api';
import AvatarMenu from './AvatarMenu';
import CreditBalance from './CreditBalance';
import './Account.css';

function Account({ userEmail, userBalance, onLogout, onRefreshBalance, onToggleSidebar, isSidebarOpen }) {
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

  const handleOpenAccount = () => navigate('/account');

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
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatMemberDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Masthead component (shared across pages)
  const renderMasthead = () => (
    <header className="masthead">
      <div className="masthead-row">
        <button
          type="button"
          className="sidebar-toggle"
          onClick={onToggleSidebar}
          aria-label="Open archive (Ctrl+K)"
          aria-expanded={isSidebarOpen}
          aria-controls="sidebar"
          title="Open archive (Ctrl+K)"
        >
          Archive
        </button>
        <div className="masthead-center">
          <h1 className="masthead-title">The AI Council</h1>
          <p className="masthead-tagline">Synthesized knowledge from AI experts</p>
        </div>
        <div className="masthead-actions">
          <button
            type="button"
            className="masthead-btn masthead-btn-new"
            onClick={handleBack}
            title="Back to Home"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span className="masthead-btn-label">Home</span>
          </button>
          <CreditBalance balance={userBalance} onClick={handleOpenAccount} />
          <AvatarMenu userEmail={userEmail} onLogout={onLogout} />
        </div>
      </div>
    </header>
  );

  if (isLoading) {
    return (
      <div className="account-page">
        {renderMasthead()}
        <div className="account-content">
          <div className="account-loading">
            <div className="loading-spinner"></div>
            <p>Loading account...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="account-page">
      {renderMasthead()}

      <div className="account-content">
        <div className="account-inner">
          {error && (
            <div className="account-error">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Balance Section */}
          <section className="account-card">
            <div className="card-header">
              <h2 className="card-title">Account Balance</h2>
              {userInfo && (
                <span className="card-subtitle">{userInfo.email}</span>
              )}
            </div>
            <div className="card-content">
              <div className="balance-display">
                <span className="balance-currency">$</span>
                <span className="balance-amount">{balance?.balance?.toFixed(2) || '0.00'}</span>
                <span className="balance-label">available</span>
              </div>
              <div className="balance-stats">
                <div className="stat">
                  <span className="stat-value">{formatBalance(balance?.total_deposited)}</span>
                  <span className="stat-label">deposited</span>
                </div>
                <div className="stat-divider"></div>
                <div className="stat">
                  <span className="stat-value">{formatBalance(balance?.total_spent)}</span>
                  <span className="stat-label">spent</span>
                </div>
              </div>
            </div>
          </section>

          {/* Add Funds Section */}
          <section className="account-card">
            <div className="card-header">
              <h2 className="card-title">Add Funds</h2>
              <span className="card-subtitle">~$0.02–$0.10 per inquiry</span>
            </div>
            <div className="card-content">
              <div className="deposit-grid">
                {depositOptions.map((option) => (
                  <button
                    key={option.id}
                    className="deposit-card"
                    onClick={() => handleDeposit(option.id)}
                    disabled={isPurchasing}
                  >
                    <span className="deposit-amount">{formatPrice(option.amount_cents)}</span>
                    <span className="deposit-estimate">~{Math.round(option.amount_cents / 5)} inquiries</span>
                    {isPurchasing && <span className="deposit-loading">Processing...</span>}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Usage History Section */}
          <section className="account-card">
            <div className="card-header">
              <h2 className="card-title">Usage History</h2>
              <span className="card-subtitle">{usageHistory.length} transactions</span>
            </div>
            <div className="card-content card-content-flush">
              {usageHistory.length === 0 ? (
                <div className="history-empty">
                  <p>No usage yet. Submit an inquiry to see your usage history.</p>
                </div>
              ) : (
                <div className="history-ledger">
                  {usageHistory.map((tx) => (
                    <div key={tx.id} className="ledger-row">
                      <button
                        type="button"
                        className="ledger-main"
                        onClick={() => setExpandedTx(expandedTx === tx.id ? null : tx.id)}
                        aria-expanded={expandedTx === tx.id}
                      >
                        <span className="ledger-date">{formatDate(tx.created_at)}</span>
                        <span className="ledger-type">Query</span>
                        <span className="ledger-amount">−{formatCost(tx.total_cost)}</span>
                        <span className="ledger-chevron">{expandedTx === tx.id ? '▾' : '▸'}</span>
                      </button>
                      {expandedTx === tx.id && (
                        <div className="ledger-details">
                          <div className="detail-row">
                            <span>API Cost</span>
                            <span>{formatCost(tx.openrouter_cost)}</span>
                          </div>
                          <div className="detail-row">
                            <span>Service Fee (10%)</span>
                            <span>{formatCost(tx.margin_cost)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Member Info Footer */}
          {userInfo && (
            <footer className="account-footer">
              <div className="member-info">
                <span className="member-badge">
                  <span className="badge-icon">M</span>
                  <span className="badge-text">Member since {formatMemberDate(userInfo.created_at)}</span>
                </span>
                <span className="member-provider">via {userInfo.oauth_provider}</span>
              </div>
            </footer>
          )}
        </div>
      </div>
    </div>
  );
}

export default Account;
