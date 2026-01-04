import { useNavigate } from 'react-router-dom';
import Masthead from './Masthead';
import './PaymentResult.css';

function PaymentCancel() {
  const navigate = useNavigate();

  const handleGoBack = () => {
    navigate('/');
  };

  return (
    <div className="payment-result">
      <Masthead variant="minimal" />
      <div className="payment-result-card cancel">
        <div className="payment-icon-wrapper cancel">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </div>

        <h1>Payment Cancelled</h1>

        <p>Your payment was cancelled. No charges were made.</p>

        <button className="payment-continue-btn" onClick={handleGoBack}>
          Return to Quinthesis
        </button>
      </div>
    </div>
  );
}

export default PaymentCancel;
