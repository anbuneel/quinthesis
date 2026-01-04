import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import Toast from './Toast';
import './Stage3.css';

export default function Stage3({ finalResponse, question }) {
  const [copyText, setCopyText] = useState('Copy');
  const [showToast, setShowToast] = useState(false);

  const getMarkdown = useCallback(() => {
    return `## Question\n${question || 'No question'}\n\n## Quintessence\n${finalResponse?.response || ''}`;
  }, [finalResponse?.response, question]);

  const handleCopy = useCallback(async () => {
    if (!finalResponse?.response) return;

    try {
      await navigator.clipboard.writeText(getMarkdown());
      setCopyText('Copied!');
      setShowToast(true);
      setTimeout(() => setCopyText('Copy'), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [finalResponse?.response, getMarkdown]);

  const handleDownload = useCallback(() => {
    if (!finalResponse?.response) return;

    const blob = new Blob([getMarkdown()], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quintessence.md';
    a.click();
    URL.revokeObjectURL(url);
  }, [finalResponse?.response, getMarkdown]);

  if (!finalResponse) {
    return null;
  }

  const getModelShortName = (model) => model.split('/')[1] || model;

  return (
    <div className="stage stage3">
      <div className="verdict-header">
        <div className="verdict-titles">
          <h3 className="stage-title">Quintessence</h3>
          <p className="verdict-subtitle">
            Synthesized by Lead {getModelShortName(finalResponse.model)}
          </p>
        </div>
        <div className="verdict-actions">
          <button
            className={`action-btn ${copyText === 'Copied!' ? 'action-btn-success' : ''}`}
            onClick={handleCopy}
            title="Copy question and answer as markdown"
          >
            {copyText === 'Copied!' ? (
              <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
            <span>{copyText}</span>
          </button>
          <button
            className="action-btn"
            onClick={handleDownload}
            title="Download as markdown file"
          >
            <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Download</span>
          </button>
        </div>
      </div>

      <div className="verdict-content">
        <div className="verdict-text markdown-content">
          <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{finalResponse.response}</ReactMarkdown>
        </div>
      </div>

      <div className="verdict-footer">
        <span className="chairman-badge">
          <span className="badge-icon">L</span>
          <span className="badge-model">{finalResponse.model}</span>
        </span>
      </div>

      <Toast
        message="Copied to clipboard"
        show={showToast}
        onClose={() => setShowToast(false)}
      />
    </div>
  );
}
