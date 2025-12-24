import ReactMarkdown from 'react-markdown';
import './Stage3.css';

export default function Stage3({ finalResponse }) {
  if (!finalResponse) {
    return null;
  }

  const getModelShortName = (model) => model.split('/')[1] || model;

  return (
    <div className="stage stage3">
      <div className="verdict-header">
        <span className="verdict-icon">3</span>
        <div className="verdict-titles">
          <h3 className="stage-title">Final Answer</h3>
          <p className="verdict-subtitle">
            Synthesized by Lead {getModelShortName(finalResponse.model)}
          </p>
        </div>
      </div>

      <div className="verdict-content">
        <div className="verdict-text markdown-content">
          <ReactMarkdown>{finalResponse.response}</ReactMarkdown>
        </div>
      </div>

      <div className="verdict-footer">
        <span className="chairman-badge">
          <span className="badge-icon">L</span>
          <span className="badge-model">{finalResponse.model}</span>
        </span>
      </div>
    </div>
  );
}
