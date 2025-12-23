import { useState } from 'react';
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

  if (!responses || responses.length === 0) {
    return null;
  }

  const getModelShortName = (model) => model.split('/')[1] || model;
  const activeResponse = responses[activeTab];
  const previewText = getPreviewText(activeResponse.response);
  const isLong = (activeResponse.response || '').replace(/\s+/g, ' ').trim().length > PREVIEW_LIMIT;
  const isExpanded = expandedByIndex[activeTab] || false;
  const showFull = isExpanded || !isLong;

  const toggleExpanded = () => {
    setExpandedByIndex((prev) => ({
      ...prev,
      [activeTab]: !prev[activeTab],
    }));
  };

  return (
    <div className="stage stage1">
      <div className="stage-heading">
        <h3 className="stage-title">Stage I: First Opinions</h3>
        <p className="stage-desc">Initial perspectives from each expert</p>
      </div>

      <div className="councilor-tabs">
        {responses.map((resp, index) => (
          <button
            key={index}
            className={`councilor-tab ${activeTab === index ? 'active' : ''}`}
            onClick={() => setActiveTab(index)}
            title={getModelShortName(resp.model)}
          >
            <span className="councilor-letter">{getCouncilorLetter(index)}</span>
            <span className="councilor-label">Expert {getCouncilorLetter(index)}</span>
          </button>
        ))}
      </div>

      <div className="councilor-content">
        <div className="councilor-header">
          <span className="councilor-badge">Expert {getCouncilorLetter(activeTab)}</span>
          <span className="model-identifier">{activeResponse.model}</span>
        </div>

        {!showFull && <p className="response-preview">{previewText}</p>}
        {showFull && (
          <div className="response-text markdown-content">
            <ReactMarkdown>{activeResponse.response}</ReactMarkdown>
          </div>
        )}

        {isLong && (
          <button className="response-toggle" onClick={toggleExpanded} type="button">
            {isExpanded ? 'Hide full response' : 'Show full response'}
          </button>
        )}
      </div>
    </div>
  );
}
