import { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import './Stage1.css';

// Convert index to councilor letter (A, B, C, etc.)
const getCouncilorLetter = (index) => String.fromCharCode(65 + index);

export default function Stage1({ responses }) {
  const [activeTab, setActiveTab] = useState(0);
  const tabsRef = useRef([]);

  if (!responses || responses.length === 0) {
    return null;
  }

  const getModelShortName = (model) => model.split('/')[1] || model;
  const activeResponse = responses[activeTab];
  const panelId = `stage1-panel-${activeTab}`;

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
        <h3 className="stage-title">Stage 1: Responses</h3>
        <p className="stage-desc">Initial responses from each model</p>
      </div>

      <div className="councilor-tabs" role="tablist" aria-label="Stage 1 responses">
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
            <span className="councilor-label">Model {getCouncilorLetter(index)}</span>
          </button>
        ))}
      </div>

      <div className="councilor-content" role="tabpanel" id={panelId} aria-labelledby={`stage1-tab-${activeTab}`}>
        <div className="councilor-header">
          <span className="councilor-badge">Model {getCouncilorLetter(activeTab)}</span>
          <span className="model-identifier">{activeResponse.model}</span>
        </div>

        <div className="response-text markdown-content">
          <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{activeResponse.response}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
