import { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import './Stage1.css';

const PREVIEW_LIMIT = 160;

// Convert index to councilor letter (A, B, C, etc.)
const getCouncilorLetter = (index) => String.fromCharCode(65 + index);

const getPreviewText = (text) => {
  if (!text) return '';
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= PREVIEW_LIMIT) {
    return collapsed;
  }
  return `${collapsed.slice(0, PREVIEW_LIMIT).trim()}...`;
};

export default function Stage1({ responses }) {
  const [activeTab, setActiveTab] = useState(0);
  const [expandedByIndex, setExpandedByIndex] = useState({});
  const tabsRef = useRef([]);

  if (!responses || responses.length === 0) {
    return null;
  }

  const getModelShortName = (model) => model.split('/')[1] || model;
  const activeResponse = responses[activeTab];
  const previewText = getPreviewText(activeResponse.response);
  const isLong = (activeResponse.response || '').replace(/\s+/g, ' ').trim().length > PREVIEW_LIMIT;
  const isExpanded = expandedByIndex[activeTab] || false;
  const showFull = isExpanded || !isLong;
  const panelId = `stage1-panel-${activeTab}`;
  const responseId = `stage1-response-${activeTab}`;

  const toggleExpanded = () => {
    setExpandedByIndex((prev) => ({
      ...prev,
      [activeTab]: !prev[activeTab],
    }));
  };

  const handleTabKeyDown = (event, index) => {
    const count = responses.length;
    let nextIndex = null;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (index + 1) % count;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (index - 1 + count) % count;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = count - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    setActiveTab(nextIndex);
    tabsRef.current[nextIndex]?.focus();
  };

  return (
    <div className="stage stage1">
      <div className="stage-heading">
        <h3 className="stage-title">Stage I: First Opinions</h3>
        <p className="stage-desc">Initial perspectives from each expert</p>
      </div>

      <div className="councilor-tabs" role="tablist" aria-label="Stage one opinions">
        {responses.map((resp, index) => (
          <button
            key={index}
            className={`councilor-tab ${activeTab === index ? 'active' : ''}`}
            onClick={() => setActiveTab(index)}
            title={getModelShortName(resp.model)}
            role="tab"
            id={`stage1-tab-${index}`}
            aria-selected={activeTab === index}
            aria-controls={`stage1-panel-${index}`}
            tabIndex={activeTab === index ? 0 : -1}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
            ref={(el) => {
              tabsRef.current[index] = el;
            }}
          >
            <span className="councilor-letter">{getCouncilorLetter(index)}</span>
            <span className="councilor-label">Expert {getCouncilorLetter(index)}</span>
          </button>
        ))}
      </div>

      <div className="councilor-content" role="tabpanel" id={panelId} aria-labelledby={`stage1-tab-${activeTab}`}>
        <div className="councilor-header">
          <span className="councilor-badge">Expert {getCouncilorLetter(activeTab)}</span>
          <span className="model-identifier">{activeResponse.model}</span>
        </div>

        <div id={responseId}>
          {!showFull && <p className="response-preview">{previewText}</p>}
          {showFull && (
            <div className="response-text markdown-content">
              <ReactMarkdown>{activeResponse.response}</ReactMarkdown>
            </div>
          )}
        </div>

        {isLong && (
          <button
            className="response-toggle"
            onClick={toggleExpanded}
            type="button"
            aria-expanded={showFull}
            aria-controls={responseId}
          >
            {isExpanded ? 'Hide full response' : 'Show full response'}
          </button>
        )}
      </div>
    </div>
  );
}
