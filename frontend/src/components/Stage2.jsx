import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import './Stage2.css';

// Convert index to councilor letter (A, B, C, etc.)
const getCouncilorLetter = (index) => String.fromCharCode(65 + index);

function deAnonymizeText(text, labelToModel) {
  if (!labelToModel) return text;

  let result = text;
  // Replace each "Response X" with the actual model name
  Object.entries(labelToModel).forEach(([label, model]) => {
    const modelShortName = model.split('/')[1] || model;
    result = result.replace(new RegExp(label, 'g'), `**${modelShortName}**`);
  });
  return result;
}

export default function Stage2({ rankings, labelToModel, aggregateRankings }) {
  const [activeTab, setActiveTab] = useState(0);

  if (!rankings || rankings.length === 0) {
    return null;
  }

  const getModelShortName = (model) => model.split('/')[1] || model;

  return (
    <div className="stage stage2">
      <h3 className="stage-title">Stage II: The Review</h3>
      <p className="stage-desc">
        Each councilor evaluated all responses anonymously and provided rankings
      </p>

      {aggregateRankings && aggregateRankings.length > 0 && (
        <div className="council-standing">
          <h4 className="standing-title">Council Standing</h4>
          <p className="standing-desc">
            Combined results across all peer evaluations (lower score is better)
          </p>
          <div className="standing-list">
            {aggregateRankings.map((agg, index) => (
              <div
                key={index}
                className={`standing-item ${index === 0 ? 'top-ranked' : ''}`}
              >
                <span className={`position-badge ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''}`}>
                  {index + 1}
                </span>
                <span className="standing-model">
                  {getModelShortName(agg.model)}
                </span>
                <span className="standing-score">
                  {agg.average_rank.toFixed(2)}
                </span>
                <span className="standing-votes">
                  {agg.rankings_count} {agg.rankings_count === 1 ? 'vote' : 'votes'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="evaluations-section">
        <h4 className="evaluations-title">Individual Evaluations</h4>
        <p className="evaluations-desc">
          Model names shown in <strong>bold</strong> for readability; original evaluations used anonymous labels
        </p>

        <div className="reviewer-tabs">
          {rankings.map((rank, index) => (
            <button
              key={index}
              className={`reviewer-tab ${activeTab === index ? 'active' : ''}`}
              onClick={() => setActiveTab(index)}
              title={getModelShortName(rank.model)}
            >
              <span className="reviewer-letter">{getCouncilorLetter(index)}</span>
            </button>
          ))}
        </div>

        <div className="evaluation-content">
          <div className="evaluation-header">
            <span className="reviewer-badge">Reviewer {getCouncilorLetter(activeTab)}</span>
            <span className="reviewer-model">{rankings[activeTab].model}</span>
          </div>

          <div className="evaluation-text markdown-content">
            <ReactMarkdown>
              {deAnonymizeText(rankings[activeTab].ranking, labelToModel)}
            </ReactMarkdown>
          </div>

          {rankings[activeTab].parsed_ranking &&
           rankings[activeTab].parsed_ranking.length > 0 && (
            <div className="extracted-ranking">
              <span className="extracted-label">Extracted Ranking:</span>
              <ol className="extracted-list">
                {rankings[activeTab].parsed_ranking.map((label, i) => (
                  <li key={i}>
                    {labelToModel && labelToModel[label]
                      ? getModelShortName(labelToModel[label])
                      : label}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
