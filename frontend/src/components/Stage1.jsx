import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import './Stage1.css';

// Convert index to councilor letter (A, B, C, etc.)
const getCouncilorLetter = (index) => String.fromCharCode(65 + index);

export default function Stage1({ responses }) {
  const [activeTab, setActiveTab] = useState(0);

  if (!responses || responses.length === 0) {
    return null;
  }

  const getModelShortName = (model) => model.split('/')[1] || model;

  return (
    <div className="stage stage1">
      <h3 className="stage-title">Stage I: First Opinions</h3>
      <p className="stage-desc">Individual responses from each council member</p>

      <div className="councilor-tabs">
        {responses.map((resp, index) => (
          <button
            key={index}
            className={`councilor-tab ${activeTab === index ? 'active' : ''}`}
            onClick={() => setActiveTab(index)}
            title={getModelShortName(resp.model)}
          >
            <span className="councilor-letter">{getCouncilorLetter(index)}</span>
            <span className="councilor-label">Councilor {getCouncilorLetter(index)}</span>
          </button>
        ))}
      </div>

      <div className="councilor-content">
        <div className="councilor-header">
          <span className="councilor-badge">Councilor {getCouncilorLetter(activeTab)}</span>
          <span className="model-identifier">{responses[activeTab].model}</span>
        </div>
        <div className="response-text markdown-content">
          <ReactMarkdown>{responses[activeTab].response}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
