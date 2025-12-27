import './Sidebar.css';

export default function Sidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onLogout,
  onOpenSettings,
  isOpen = false,
  onClose,
  userEmail,
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

  const handleSettings = () => {
    onOpenSettings?.();
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

      <div className="sidebar-footer">
        {userEmail && (
          <div className="user-info">
            <span className="user-email" title={userEmail}>
              {userEmail}
            </span>
          </div>
        )}
        <div className="footer-buttons">
          {onOpenSettings && (
            <button className="settings-btn" onClick={handleSettings} title="Settings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              Settings
            </button>
          )}
          {onLogout && (
            <button className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

