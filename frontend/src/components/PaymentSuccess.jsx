import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { credits } from '../api';
import './PaymentResult.css';

function PaymentSuccess({ onRefreshCredits }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [newBalance, setNewBalance] = useState(null);

  useEffect(() => {
    const loadCredits = async () => {
      try {
        // Refresh credits after successful payment
        const data = await credits.getBalance();
        setNewBalance(data.credits);
        if (onRefreshCredits) {
          onRefreshCredits();
        }
      } catch (err) {
        console.error('Failed to load credits:', err);
      } finally {
        setIsLoading(false);
      }
    };

    // Small delay to ensure webhook has processed
    const timer = setTimeout(loadCredits, 1500);
    return () => clearTimeout(timer);
  }, [onRefreshCredits]);

  const handleContinue = () => {
    navigate('/');
  };

  return (
    <div className="payment-result">
      <div className="payment-result-card success">
        <div className="payment-icon-wrapper success">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>

        <h1>Payment Successful</h1>

        {isLoading ? (
          <p className="payment-loading">Updating your credits...</p>
        ) : (
          <div className="payment-details">
            <p>Your credits have been added to your account.</p>
            {newBalance !== null && (
              <div className="new-balance">
                <span className="balance-label">Current Balance</span>
                <span className="balance-value">{newBalance}</span>
                <span className="balance-unit">credits</span>
              </div>
            )}
          </div>
        )}

        <button className="payment-continue-btn" onClick={handleContinue}>
          Continue to AI Council
        </button>
      </div>
    </div>
  );
}

export default PaymentSuccess;
