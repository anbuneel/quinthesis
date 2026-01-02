import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { billing, auth } from '../api';
import ConfirmDialog from './ConfirmDialog';
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

  // BYOK state
  const [apiMode, setApiMode] = useState(null);
  const [byokKeyInput, setByokKeyInput] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [isDeletingKey, setIsDeletingKey] = useState(false);
  const [keyError, setKeyError] = useState('');

  // Account deletion state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    loadAllData();
  }, []);

  // Auto-dismiss export error after 5 seconds
  useEffect(() => {
    if (exportError) {
      const timer = setTimeout(() => setExportError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [exportError]);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [user, balanceData, options, history, modeData] = await Promise.all([
        auth.getMe(),
        billing.getBalance(),
        billing.getDepositOptions(),
        billing.getUsageHistory(),
        billing.getApiMode(),
      ]);
      setUserInfo(user);
      setBalance(balanceData);
      setDepositOptions(options);
      setUsageHistory(history);
      setApiMode(modeData);
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

  const handleSaveByokKey = async () => {
    if (!byokKeyInput.trim()) {
      setKeyError('Please enter an API key');
      return;
    }
    setIsSavingKey(true);
    setKeyError('');
    try {
      const result = await billing.setBYOKKey(byokKeyInput.trim());
      setApiMode({
        mode: result.mode,
        has_byok_key: result.has_byok_key,
        byok_key_preview: result.byok_key_preview,
        byok_validated_at: result.byok_validated_at,
        has_provisioned_key: result.has_provisioned_key,
        balance: result.balance,
      });
      setByokKeyInput('');
    } catch (err) {
      setKeyError(err.message || 'Failed to save API key');
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleDeleteByokKey = async () => {
    setIsDeletingKey(true);
    setKeyError('');
    try {
      await billing.deleteBYOKKey();
      // Reload API mode after deletion
      const modeData = await billing.getApiMode();
      setApiMode(modeData);
    } catch (err) {
      setKeyError(err.message || 'Failed to remove API key');
    } finally {
      setIsDeletingKey(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      await auth.deleteAccount();
      // Account deleted, redirect to login
      onLogout();
      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to delete account');
      setShowDeleteConfirm(false);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    setExportError('');
    try {
      await auth.exportData();
    } catch (err) {
      setExportError(err.message || 'Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
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

          {/* Balance + Add Funds Row */}
          <div className="account-row">
            {/* Balance Section */}
            <section className="account-card">
              <div className="card-header">
                <h2 className="card-title">Account Balance</h2>
              </div>
              <div className="card-content card-content-center">
                <div className="balance-display">
                  <span className="balance-currency">$</span>
                  <span className="balance-amount">{balance?.balance?.toFixed(2) || '0.00'}</span>
                </div>
                <span className="balance-label">available</span>
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
              </div>
              <div className="card-content card-content-center">
                <div className="deposit-stack">
                  {depositOptions.map((option) => (
                    <button
                      key={option.id}
                      className="deposit-card"
                      onClick={() => handleDeposit(option.id)}
                      disabled={isPurchasing}
                    >
                      <span className="deposit-amount">{formatPrice(option.amount_cents)}</span>
                      <span className="deposit-meta">
                        <span className="deposit-estimate">~{Math.round(option.amount_cents / 5)} inquiries</span>
                        {isPurchasing && <span className="deposit-loading">Processing...</span>}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="deposit-note">~$0.02–$0.10 per inquiry</p>
              </div>
            </section>
          </div>

          {/* API Settings Section */}
          <section className="account-card">
            <div className="card-header">
              <h2 className="card-title">API Settings</h2>
              <span className={`mode-badge mode-badge-${apiMode?.mode || 'credits'}`}>
                {apiMode?.mode === 'byok' ? 'Using Your Key' : 'Using Credits'}
              </span>
            </div>
            <div className="card-content">
              <div className="api-settings-content">
                {keyError && (
                  <div className="key-error">{keyError}</div>
                )}

                {apiMode?.has_byok_key ? (
                  // BYOK mode - show current key and option to remove
                  <div className="byok-active">
                    <div className="byok-status">
                      <span className="byok-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                        </svg>
                      </span>
                      <div className="byok-details">
                        <span className="byok-label">Your OpenRouter API Key</span>
                        <span className="byok-preview">{apiMode.byok_key_preview}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="byok-remove-btn"
                      onClick={handleDeleteByokKey}
                      disabled={isDeletingKey}
                    >
                      {isDeletingKey ? 'Removing...' : 'Remove Key'}
                    </button>
                  </div>
                ) : (
                  // Credits mode - show option to add BYOK key
                  <div className="byok-setup">
                    <p className="byok-description">
                      Use your own OpenRouter API key to bypass the credit system.
                      You'll pay OpenRouter directly for API usage.
                    </p>
                    <div className="byok-input-group">
                      <input
                        type="password"
                        className="byok-input"
                        placeholder="sk-or-v1-..."
                        value={byokKeyInput}
                        onChange={(e) => setByokKeyInput(e.target.value)}
                        disabled={isSavingKey}
                      />
                      <button
                        type="button"
                        className="byok-save-btn"
                        onClick={handleSaveByokKey}
                        disabled={isSavingKey || !byokKeyInput.trim()}
                      >
                        {isSavingKey ? 'Validating...' : 'Save Key'}
                      </button>
                    </div>
                    <p className="byok-hint">
                      Get your API key from{' '}
                      <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">
                        openrouter.ai/keys
                      </a>
                    </p>
                  </div>
                )}
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

          {/* Data & Privacy Section */}
          <section className="account-card">
            <div className="card-header">
              <h2 className="card-title">Data &amp; Privacy</h2>
            </div>
            <div className="card-content">
              {/* Export Data */}
              <div className="data-action">
                <div className="data-action-info">
                  <h3 className="data-action-title">Export Your Data</h3>
                  <p className="data-action-description">
                    Download a ZIP file containing all your conversations (as Markdown) and account
                    data (as JSON).
                  </p>
                </div>
                <button
                  type="button"
                  className="data-action-btn"
                  onClick={handleExportData}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <>
                      <span className="btn-spinner"></span>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                      </svg>
                      Download
                    </>
                  )}
                </button>
                {exportError && (
                  <div className="export-error">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {exportError}
                  </div>
                )}
              </div>

              {/* Delete Account */}
              <div className="danger-zone">
                <div className="danger-info">
                  <h3 className="danger-title">Delete Account</h3>
                  <p className="danger-description">
                    Permanently delete your account and all associated data. This cannot be undone.
                  </p>
                </div>
                <button
                  type="button"
                  className="danger-btn"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Delete Account
                </button>
              </div>

              <div className="legal-links-footer">
                <a href="/privacy" className="legal-link">Privacy Policy</a>
                <span className="legal-divider">|</span>
                <a href="/terms" className="legal-link">Terms of Service</a>
              </div>
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

      {/* Delete Account Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Account"
        message="Are you sure you want to delete your account? This will permanently remove all your conversations, transaction history, and account data. This action cannot be undone."
        variant="danger"
        icon="warning"
        confirmLabel={isDeletingAccount ? 'Deleting...' : 'Delete My Account'}
        cancelLabel="Cancel"
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmDisabled={isDeletingAccount}
      />
    </div>
  );
}

export default Account;
