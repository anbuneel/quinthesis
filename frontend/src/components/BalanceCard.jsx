import './BalanceCard.css';

function BalanceCard({ balance, isLoading }) {
  const formatBalance = (amount) => {
    if (amount === null || amount === undefined) return '0.00';
    return parseFloat(amount).toFixed(2);
  };

  const formatStat = (amount) => {
    if (amount === null || amount === undefined) return '$0.00';
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <div className="balance-card balance-card-loading">
        <div className="balance-card-frame">
          <div className="balance-loading-shimmer" />
        </div>
      </div>
    );
  }

  return (
    <div className="balance-card">
      {/* Ornate frame corners */}
      <div className="balance-card-corner balance-card-corner-tl" aria-hidden="true" />
      <div className="balance-card-corner balance-card-corner-tr" aria-hidden="true" />
      <div className="balance-card-corner balance-card-corner-bl" aria-hidden="true" />
      <div className="balance-card-corner balance-card-corner-br" aria-hidden="true" />

      <div className="balance-card-frame">
        <div className="balance-header">
          <span className="balance-header-ornament">&#9830;</span>
          <span className="balance-header-text">Current Balance</span>
          <span className="balance-header-ornament">&#9830;</span>
        </div>

        <div className="balance-amount-wrapper">
          <span className="balance-currency">$</span>
          <span className="balance-amount">{formatBalance(balance?.balance)}</span>
        </div>

        <div className="balance-indicator">
          <span className="balance-indicator-dot" />
          <span className="balance-indicator-text">Available</span>
        </div>

        <div className="balance-stats">
          <div className="balance-stat">
            <span className="balance-stat-label">Total Deposited</span>
            <span className="balance-stat-value positive">
              {formatStat(balance?.total_deposited)}
            </span>
          </div>
          <div className="balance-stat-divider" />
          <div className="balance-stat">
            <span className="balance-stat-label">Total Spent</span>
            <span className="balance-stat-value negative">
              {formatStat(balance?.total_spent)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BalanceCard;
