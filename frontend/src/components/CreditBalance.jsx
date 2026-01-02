import './CreditBalance.css';

function CreditBalance({ balance, onClick }) {
  // Format balance as currency
  const formatBalance = (amount) => {
    if (amount === null || amount === undefined) return '$0.00';
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  return (
    <button className="credit-balance-btn" onClick={onClick} title="View balance">
      <span className="credit-balance-icon">$</span>
      <span className="credit-balance-count">{formatBalance(balance)}</span>
    </button>
  );
}

export default CreditBalance;
