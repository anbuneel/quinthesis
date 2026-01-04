import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { billing } from '../api';
import Masthead from './Masthead';
import './PaymentResult.css';

function PaymentSuccess({ onRefreshBalance }) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [newBalance, setNewBalance] = useState(null);

  useEffect(() => {
    const loadBalance = async () => {
      try {
        // Refresh balance after successful payment
        const data = await billing.getBalance();
        setNewBalance(data.balance);
        if (onRefreshBalance) {
          onRefreshBalance();
        }
      } catch (err) {
        console.error('Failed to load balance:', err);
      } finally {
        setIsLoading(false);
      }
    };

    // Small delay to ensure webhook has processed
    const timer = setTimeout(loadBalance, 1500);
    return () => clearTimeout(timer);
  }, [onRefreshBalance]);

  const handleContinue = () => {
    navigate('/');
  };

  const formatBalance = (amount) => {
    if (amount === null || amount === undefined) return '$0.00';
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  return (
    <div className="payment-result">
      <Masthead variant="minimal" />
      <div className="payment-result-card success">
        <div className="payment-icon-wrapper success">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>

        <h1>Payment Successful</h1>

        {isLoading ? (
          <p className="payment-loading">Updating your balance...</p>
        ) : (
          <div className="payment-details">
            <p>Your funds have been added to your account.</p>
            {newBalance !== null && (
              <div className="new-balance">
                <span className="balance-label">Current Balance</span>
                <span className="balance-value">{formatBalance(newBalance)}</span>
              </div>
            )}
          </div>
        )}

        <button className="payment-continue-btn" onClick={handleContinue}>
          Continue to Quinthesis
        </button>
      </div>
    </div>
  );
}

export default PaymentSuccess;
