import './Sidebar.css';

export default function Sidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onLogout,
}) {
  // Determine if a case is "resolved" (has messages) or "in deliberation"
  const getCaseStatus = (conv) => {
    return conv.message_count > 0 ? 'resolved' : 'pending';
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title">AI Council</h1>
        <p className="sidebar-tagline">Where AI Minds Convene</p>
        <button className="new-case-btn" onClick={onNewConversation}>
          <span className="btn-icon">+</span>
          <span>New Case</span>
        </button>
      </div>

      <div className="case-list">
        <div className="section-label">The Docket</div>
        {conversations.length === 0 ? (
          <div className="no-cases">No cases filed yet</div>
        ) : (
          conversations.map((conv) => {
            const status = getCaseStatus(conv);
            return (
              <div
                key={conv.id}
                className={`case-item ${
                  conv.id === currentConversationId ? 'active' : ''
                }`}
                onClick={() => onSelectConversation(conv.id)}
              >
                <span className={`case-status ${status}`} title={status === 'resolved' ? 'Resolved' : 'Pending'}></span>
                <div className="case-content">
                  <div className="case-title">
                    {conv.title || 'New Case'}
                  </div>
                  <div className="case-meta">
                    {conv.message_count} {conv.message_count === 1 ? 'exchange' : 'exchanges'}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {onLogout && (
        <div className="sidebar-footer">
          <button className="logout-btn" onClick={onLogout}>
            Leave Chamber
          </button>
        </div>
      )}
    </aside>
  );
}
