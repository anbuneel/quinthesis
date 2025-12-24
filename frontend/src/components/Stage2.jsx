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
  const [showAllRankings, setShowAllRankings] = useState(false);
  const [expandedReviews, setExpandedReviews] = useState({});

  if (!rankings || rankings.length === 0) {
    return null;
  }

  const getModelShortName = (model) => model.split('/')[1] || model;
  const hasAggregate = aggregateRankings && aggregateRankings.length > 0;
  const visibleRankings = hasAggregate
    ? (showAllRankings ? aggregateRankings : aggregateRankings.slice(0, 3))
    : [];
  const canToggleRankings = hasAggregate && aggregateRankings.length > 3;
  const standingsId = 'stage2-standings';

  const toggleReview = (index) => {
    setExpandedReviews((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  return (
    <div className="stage stage2">
      <div className="stage-heading">
        <h3 className="stage-title">Stage II: Peer Review</h3>
        <p className="stage-desc">
          Each expert evaluated all responses anonymously and provided rankings.
        </p>
      </div>

      {hasAggregate && (
        <div className="council-standing">
          <div className="standing-header">
            <div>
              <h4 className="standing-title">Rankings</h4>
              <p className="standing-desc">
                Combined results across peer evaluations (lower score is better).
              </p>
            </div>
            {canToggleRankings && (
              <button
                type="button"
                className="standing-toggle"
                onClick={() => setShowAllRankings((prev) => !prev)}
                aria-expanded={showAllRankings}
                aria-controls={standingsId}
              >
                {showAllRankings ? 'Show top 3' : 'Show all'}
              </button>
            )}
          </div>

          <div className="standing-list" id={standingsId}>
            {visibleRankings.map((agg, index) => (
              <div
                key={agg.model}
                className={`standing-item ${index === 0 ? 'top-ranked' : ''}`}
              >
                <span
                  className={`position-badge ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''}`}
                >
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
        <div className="evaluations-header">
          <h4 className="evaluations-title">Individual Evaluations</h4>
          <p className="evaluations-desc">
            Model names shown in <strong>bold</strong> for readability.
          </p>
        </div>

        <div className="review-list" aria-label="Peer evaluations">
          {rankings.map((rank, index) => {
            const isExpanded = expandedReviews[index] || false;
            const reviewId = `stage2-review-${index}`;
            const reviewButtonId = `stage2-review-toggle-${index}`;
            return (
              <div key={rank.model} className={`review-card ${isExpanded ? 'expanded' : ''}`}>
                <button
                  type="button"
                  className="review-header"
                  onClick={() => toggleReview(index)}
                  aria-expanded={isExpanded}
                  aria-controls={reviewId}
                  id={reviewButtonId}
                >
                  <div className="reviewer-left">
                    <span className="reviewer-letter">{getCouncilorLetter(index)}</span>
                    <div className="reviewer-meta">
                      <span className="reviewer-name">Expert {getCouncilorLetter(index)}</span>
                      <span className="reviewer-model">{rank.model}</span>
                    </div>
                  </div>
                  <span className="review-toggle">{isExpanded ? 'Hide' : 'Show'}</span>
                </button>

                {isExpanded && (
                  <div className="review-body" id={reviewId} role="region" aria-labelledby={reviewButtonId}>
                    <div className="evaluation-text markdown-content">
                      <ReactMarkdown>
                        {deAnonymizeText(rank.ranking, labelToModel)}
                      </ReactMarkdown>
                    </div>

                    {rank.parsed_ranking && rank.parsed_ranking.length > 0 && (
                      <div className="extracted-ranking">
                        <span className="extracted-label">Extracted Ranking:</span>
                        <ol className="extracted-list">
                          {rank.parsed_ranking.map((label, i) => (
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
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
