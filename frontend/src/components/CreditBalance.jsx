import './CreditBalance.css';

function CreditBalance({ credits, onClick }) {
  return (
    <button className="credit-balance-btn" onClick={onClick} title="View credits">
      <span className="credit-balance-icon">&#9830;</span>
      <span className="credit-balance-count">{credits ?? 0}</span>
    </button>
  );
}

export default CreditBalance;
