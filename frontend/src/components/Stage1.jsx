import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import './Stage1.css';

// Convert index to councilor letter (A, B, C, etc.)
const getCouncilorLetter = (index) => String.fromCharCode(65 + index);

export default function Stage1({ responses }) {
  const [expandedResponses, setExpandedResponses] = useState({});

  if (!responses || responses.length === 0) {
    return null;
  }

  const getModelShortName = (model) => model.split('/')[1] || model;

  const toggleResponse = (index) => {
    setExpandedResponses((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  return (
    <div className="stage stage1">
      <div className="stage-heading">
        <h3 className="stage-title">Stage 1: Responses</h3>
        <p className="stage-desc">Initial responses from each model</p>
      </div>

      <div className="response-list" aria-label="Model responses">
        {responses.map((resp, index) => {
          const isExpanded = expandedResponses[index] || false;
          const responseId = `stage1-response-${index}`;
          const responseButtonId = `stage1-response-toggle-${index}`;
          return (
            <div key={resp.model} className={`response-card ${isExpanded ? 'expanded' : ''}`}>
              <button
                type="button"
                className="response-header"
                onClick={() => toggleResponse(index)}
                aria-expanded={isExpanded}
                aria-controls={responseId}
                id={responseButtonId}
              >
                <div className="responder-left">
                  <span className="responder-letter">{getCouncilorLetter(index)}</span>
                  <div className="responder-meta">
                    <span className="responder-name">Model {getCouncilorLetter(index)}</span>
                    <span className="responder-model">{resp.model}</span>
                  </div>
                </div>
                <span className="response-toggle">{isExpanded ? 'Hide' : 'Show'}</span>
              </button>

              {isExpanded && (
                <div className="response-body" id={responseId} role="region" aria-labelledby={responseButtonId}>
                  <div className="response-text markdown-content">
                    <ReactMarkdown>{resp.response}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
