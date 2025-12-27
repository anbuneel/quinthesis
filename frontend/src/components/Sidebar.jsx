import './Sidebar.css';

export default function Sidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onLogout,
  isOpen = false,
  onClose,
}) {
  // Determine if a case is "resolved" (has messages) or "in deliberation"
  const getCaseStatus = (conv) => {
    return conv.message_count > 0 ? 'resolved' : 'pending';
  };

  const handleDelete = (e, convId) => {
    e.stopPropagation(); // Prevent selecting the conversation
    onDeleteConversation(convId);
  };

  const handleNewConversation = () => {
    onNewConversation();
    onClose?.();
  };

  const handleSelectConversation = (convId) => {
    onSelectConversation(convId);
    onClose?.();
  };

  const handleLogout = () => {
    onLogout();
    onClose?.();
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`} id="sidebar" aria-label="Inquiry list">
      <div className="sidebar-header">
        <h1 className="sidebar-title">AI Council</h1>
        <button className="new-case-btn" onClick={handleNewConversation} title="New inquiry (Ctrl+N)">
          <span className="btn-icon">+</span>
          <span>New Inquiry</span>
        </button>
      </div>

      <div className="case-list">
        <div className="section-label">Inquiries</div>
        {conversations.length === 0 ? (
          <div className="no-cases">No inquiries yet</div>
        ) : (
          conversations.map((conv) => {
            const status = getCaseStatus(conv);
            return (
              <div
                key={conv.id}
                className={`case-item ${conv.id === currentConversationId ? 'active' : ''
                  }`}
                onClick={() => handleSelectConversation(conv.id)}
              >
                <span className={`case-status ${status}`} title={status === 'resolved' ? 'Completed' : 'In Progress'}></span>
                <div className="case-content">
                  <div className="case-title">
                    {conv.title || 'Untitled Inquiry'}
                  </div>
                  <div className="case-meta">
                    {conv.message_count} {conv.message_count === 1 ? 'entry' : 'entries'}
                  </div>
                </div>
                <button
                  className="delete-btn"
                  onClick={(e) => handleDelete(e, conv.id)}
                  title="Delete inquiry"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            );
          })
        )}
      </div>

      {onLogout && (
        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      )}
    </aside>
  );
}

