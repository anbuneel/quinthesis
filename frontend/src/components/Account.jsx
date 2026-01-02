import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { billing, auth } from '../api';
import BalanceCard from './BalanceCard';
import TransactionLedger from './TransactionLedger';
import './Account.css';

function Account({ onRefreshBalance }) {
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState(null);
  const [balance, setBalance] = useState(null);
  const [depositOptions, setDepositOptions] = useState([]);
  const [usageHistory, setUsageHistory] = useState([]);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    await Promise.all([
      loadUserInfo(),
      loadBalance(),
      loadDepositOptions(),
      loadUsageHistory(),
    ]);
  };

  const loadUserInfo = async () => {
    try {
      const user = await auth.getMe();
      setUserInfo(user);
    } catch (err) {
      console.error('Failed to load user info:', err);
    }
  };

  const loadBalance = async () => {
    setIsLoadingBalance(true);
    try {
      const data = await billing.getBalance();
      setBalance(data);
      if (onRefreshBalance) onRefreshBalance();
    } catch (err) {
      setError('Failed to load balance');
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const loadDepositOptions = async () => {
    setIsLoadingOptions(true);
    try {
      const data = await billing.getDepositOptions();
      setDepositOptions(data);
    } catch (err) {
      console.error('Failed to load deposit options:', err);
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
      console.error('Failed to load usage history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleDeposit = async (optionId) => {
    setIsPurchasing(true);
    setError('');
    try {
      await billing.purchaseDeposit(optionId);
      // Redirect happens in purchaseDeposit
    } catch (err) {
      setError(err.message || 'Failed to process deposit');
      setIsPurchasing(false);
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="account-page">
      {/* Decorative corner flourishes */}
      <div className="account-flourish account-flourish-tl" aria-hidden="true" />
      <div className="account-flourish account-flourish-tr" aria-hidden="true" />
      <div className="account-flourish account-flourish-bl" aria-hidden="true" />
      <div className="account-flourish account-flourish-br" aria-hidden="true" />

      {/* Header / Masthead */}
      <header className="account-masthead">
        <button className="account-back" onClick={handleBack} aria-label="Return to Council">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Return to Council</span>
        </button>

        <div className="account-masthead-center">
          <div className="account-masthead-rule" />
          <h1 className="account-title">Account</h1>
          <p className="account-subtitle">Financial Record & Membership</p>
          <div className="account-masthead-rule" />
        </div>

        <div className="account-masthead-date">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>
      </header>

      {/* Section divider */}
      <div className="account-divider">
        <span className="account-divider-ornament">&#10041;</span>
      </div>

      {error && (
        <div className="account-error">
          <span className="account-error-icon">!</span>
          {error}
        </div>
      )}

      {/* Main content - two column layout */}
      <main className="account-content">
        {/* Left column: Balance + Funds */}
        <section className="account-column account-column-left">
          <BalanceCard
            balance={balance}
            isLoading={isLoadingBalance}
          />

          <div className="account-section-header">
            <span className="account-section-rule" />
            <h2>Add Funds</h2>
            <span className="account-section-rule" />
          </div>

          <div className="deposit-options">
            {isLoadingOptions ? (
              <div className="deposit-loading">
                <div className="loading-line" />
                <div className="loading-line" />
                <div className="loading-line" />
              </div>
            ) : (
              depositOptions.map((option, index) => (
                <button
                  key={option.id}
                  className={`deposit-card ${index === 1 ? 'deposit-card-featured' : ''}`}
                  onClick={() => handleDeposit(option.id)}
                  disabled={isPurchasing}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="deposit-card-inner">
                    <span className="deposit-amount">
                      ${(option.amount_cents / 100).toFixed(0)}
                    </span>
                    <span className="deposit-label">{option.name}</span>
                    <span className="deposit-estimate">
                      ~{Math.round(option.amount_cents / 5)} inquiries
                    </span>
                  </div>
                  <div className="deposit-card-action">
                    {isPurchasing ? 'Processing...' : 'Deposit'}
                  </div>
                </button>
              ))
            )}
          </div>

          <p className="deposit-note">
            Each inquiry costs approximately $0.02–$0.10 depending on the AI models used.
            You pay only for what you use, plus a 10% service fee.
          </p>

          {/* Member info card */}
          {userInfo && (
            <>
              <div className="account-section-header">
                <span className="account-section-rule" />
                <h2>Membership</h2>
                <span className="account-section-rule" />
              </div>

              <div className="member-card">
                <div className="member-card-header">
                  <span className="member-badge">Member</span>
                </div>
                <div className="member-details">
                  <div className="member-row">
                    <span className="member-label">Email</span>
                    <span className="member-value">{userInfo.email}</span>
                  </div>
                  <div className="member-row">
                    <span className="member-label">Provider</span>
                    <span className="member-value member-provider">
                      {userInfo.oauth_provider === 'google' && (
                        <svg viewBox="0 0 24 24" className="provider-icon">
                          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                      )}
                      {userInfo.oauth_provider === 'github' && (
                        <svg viewBox="0 0 24 24" className="provider-icon">
                          <path fill="currentColor" d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                        </svg>
                      )}
                      {userInfo.oauth_provider}
                    </span>
                  </div>
                  <div className="member-row">
                    <span className="member-label">Member since</span>
                    <span className="member-value">{formatDate(userInfo.created_at)}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Right column: Transaction Ledger */}
        <section className="account-column account-column-right">
          <div className="account-section-header">
            <span className="account-section-rule" />
            <h2>Transaction Ledger</h2>
            <span className="account-section-rule" />
          </div>

          <TransactionLedger
            transactions={usageHistory}
            isLoading={isLoadingHistory}
          />
        </section>
      </main>

      {/* Footer */}
      <footer className="account-footer">
        <div className="account-footer-rule" />
        <p className="account-footer-text">
          The AI Council &middot; Est. 2024 &middot; Transparent Usage-Based Billing
        </p>
      </footer>
    </div>
  );
}

export default Account;
