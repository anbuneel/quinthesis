import { useState, useMemo } from 'react';
import './Sidebar.css';

/**
 * Group conversations by date: Today, Yesterday, This Week, This Month, Older
 */
function groupByDate(conversations) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(thisWeekStart.getDate() - today.getDay());
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const groups = {
    today: [],
    yesterday: [],
    thisWeek: [],
    thisMonth: [],
    older: [],
  };

  conversations.forEach((conv) => {
    const convDate = new Date(conv.created_at);
    const convDay = new Date(convDate.getFullYear(), convDate.getMonth(), convDate.getDate());

    if (convDay.getTime() === today.getTime()) {
      groups.today.push(conv);
    } else if (convDay.getTime() === yesterday.getTime()) {
      groups.yesterday.push(conv);
    } else if (convDay >= thisWeekStart) {
      groups.thisWeek.push(conv);
    } else if (convDay >= thisMonthStart) {
      groups.thisMonth.push(conv);
    } else {
      groups.older.push(conv);
    }
  });

  return groups;
}

export default function Sidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  isOpen = false,
  onClose,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedSections, setCollapsedSections] = useState({});

  const handleDelete = (e, convId) => {
    e.stopPropagation();
    onDeleteConversation(convId);
  };

  const handleSelectConversation = (convId) => {
    onSelectConversation(convId);
    onClose?.();
  };

  const toggleSection = (section) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Filter conversations by search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const query = searchQuery.toLowerCase();
    return conversations.filter(
      (conv) => (conv.title || '').toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  // Group filtered conversations by date
  const groupedConversations = useMemo(
    () => groupByDate(filteredConversations),
    [filteredConversations]
  );

  const sections = [
    { key: 'today', label: 'Today', items: groupedConversations.today },
    { key: 'yesterday', label: 'Yesterday', items: groupedConversations.yesterday },
    { key: 'thisWeek', label: 'This Week', items: groupedConversations.thisWeek },
    { key: 'thisMonth', label: 'This Month', items: groupedConversations.thisMonth },
    { key: 'older', label: 'Older', items: groupedConversations.older },
  ];

  const hasResults = filteredConversations.length > 0;

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`} id="sidebar" aria-label="Inquiry list">
      <div className="sidebar-header">
        <div className="sidebar-title">Archive</div>
      </div>
      <div className="sidebar-search">
        <input
          type="text"
          className="search-input"
          placeholder="Search inquiries..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search inquiries"
        />
        {searchQuery && (
          <button
            type="button"
            className="search-clear"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
      </div>

      <div className="case-list">
        {conversations.length === 0 ? (
          <div className="no-cases">No inquiries yet</div>
        ) : !hasResults ? (
          <div className="no-cases">No matches found</div>
        ) : (
          sections.map(({ key, label, items }) =>
            items.length > 0 ? (
              <div key={key} className="date-section">
                <button
                  type="button"
                  className={`section-header ${collapsedSections[key] ? 'collapsed' : ''}`}
                  onClick={() => toggleSection(key)}
                  aria-expanded={!collapsedSections[key]}
                >
                  <span className="section-label">{label}</span>
                  <span className="section-count">{items.length}</span>
                  <svg
                    className="section-chevron"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                {!collapsedSections[key] && (
                  <div className="section-items">
                    {items.map((conv) => (
                      <div
                        key={conv.id}
                        className={`case-item ${conv.id === currentConversationId ? 'active' : ''}`}
                        onClick={() => handleSelectConversation(conv.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelectConversation(conv.id);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-current={conv.id === currentConversationId ? 'true' : undefined}
                      >
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
                    ))}
                  </div>
                )}
              </div>
            ) : null
          )
        )}
      </div>
    </aside>
  );
}
