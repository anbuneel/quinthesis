import { useState } from 'react';
import './TransactionLedger.css';

function TransactionLedger({ transactions, isLoading }) {
  const [expandedId, setExpandedId] = useState(null);

  const formatCost = (dollars) => {
    if (dollars === null || dollars === undefined) return '$0.0000';
    return `$${parseFloat(dollars).toFixed(4)}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return {
      day: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      year: date.getFullYear(),
    };
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (isLoading) {
    return (
      <div className="ledger ledger-loading">
        <div className="ledger-header-row">
          <span className="ledger-col-date">Date</span>
          <span className="ledger-col-desc">Description</span>
          <span className="ledger-col-amount">Amount</span>
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="ledger-row ledger-row-loading" style={{ animationDelay: `${i * 0.1}s` }}>
            <div className="ledger-loading-line" />
          </div>
        ))}
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="ledger ledger-empty">
        <div className="ledger-header-row">
          <span className="ledger-col-date">Date</span>
          <span className="ledger-col-desc">Description</span>
          <span className="ledger-col-amount">Amount</span>
        </div>
        <div className="ledger-empty-state">
          <div className="ledger-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              <path d="M9 14l2 2 4-4" />
            </svg>
          </div>
          <p className="ledger-empty-title">No Transactions Yet</p>
          <p className="ledger-empty-text">
            Your usage history will appear here after your first inquiry.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ledger">
      {/* Ledger header */}
      <div className="ledger-header-row">
        <span className="ledger-col-date">Date</span>
        <span className="ledger-col-desc">Description</span>
        <span className="ledger-col-amount">Amount</span>
      </div>

      {/* Ledger entries */}
      <div className="ledger-body">
        {transactions.map((tx, index) => {
          const date = formatDate(tx.created_at);
          const isExpanded = expandedId === tx.id;

          return (
            <div
              key={tx.id}
              className={`ledger-row ${isExpanded ? 'ledger-row-expanded' : ''}`}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <button
                className="ledger-row-main"
                onClick={() => toggleExpand(tx.id)}
                aria-expanded={isExpanded}
              >
                <span className="ledger-col-date">
                  <span className="ledger-date-day">{date.day}</span>
                  <span className="ledger-date-time">{date.time}</span>
                </span>
                <span className="ledger-col-desc">
                  <span className="ledger-type-badge">Query</span>
                  <span className="ledger-desc-text">
                    AI Council Inquiry
                  </span>
                </span>
                <span className="ledger-col-amount">
                  <span className="ledger-amount negative">
                    -{formatCost(tx.total_cost)}
                  </span>
                  <svg
                    className={`ledger-expand-icon ${isExpanded ? 'expanded' : ''}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </button>

              {isExpanded && (
                <div className="ledger-row-details">
                  <div className="ledger-detail-grid">
                    <div className="ledger-detail">
                      <span className="ledger-detail-label">API Cost</span>
                      <span className="ledger-detail-value">
                        {formatCost(tx.openrouter_cost)}
                      </span>
                    </div>
                    <div className="ledger-detail">
                      <span className="ledger-detail-label">Service Fee (10%)</span>
                      <span className="ledger-detail-value">
                        {formatCost(tx.margin_cost)}
                      </span>
                    </div>
                    <div className="ledger-detail ledger-detail-total">
                      <span className="ledger-detail-label">Total</span>
                      <span className="ledger-detail-value">
                        {formatCost(tx.total_cost)}
                      </span>
                    </div>
                  </div>
                  {tx.model_breakdown && Object.keys(tx.model_breakdown).length > 0 && (
                    <div className="ledger-models">
                      <span className="ledger-models-label">Models Used</span>
                      <div className="ledger-models-list">
                        {Object.entries(tx.model_breakdown).map(([model, cost]) => (
                          <div key={model} className="ledger-model-item">
                            <span className="ledger-model-name">{model}</span>
                            <span className="ledger-model-cost">{formatCost(cost)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Ledger footer */}
      <div className="ledger-footer">
        <span className="ledger-footer-count">
          {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

export default TransactionLedger;
