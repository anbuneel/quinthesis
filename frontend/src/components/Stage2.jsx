import { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
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
  const [showAllRankings, setShowAllRankings] = useState(false);
  const tabsRef = useRef([]);

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

  const activeRanking = rankings[activeTab];
  const evaluationText = deAnonymizeText(activeRanking.ranking, labelToModel);
  const panelId = `stage2-panel-${activeTab}`;

  const handleTabKeyDown = (event, index) => {
    const count = rankings.length;
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
    <div className="stage stage2">
      <div className="stage-heading">
        <h3 className="stage-title">Stage 2: Review</h3>
        <p className="stage-desc">
          Each model evaluated all responses anonymously and ranked them.
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

        <div className="reviewer-tabs" role="tablist" aria-label="Stage 2 evaluations">
          {rankings.map((rank, index) => (
            <button
              key={index}
              className={`reviewer-tab ${activeTab === index ? 'active' : ''}`}
              onClick={() => setActiveTab(index)}
              title={getModelShortName(rank.model)}
              role="tab"
              id={`stage2-tab-${index}`}
              aria-selected={activeTab === index}
              aria-controls={`stage2-panel-${index}`}
              tabIndex={activeTab === index ? 0 : -1}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              ref={(el) => {
                tabsRef.current[index] = el;
              }}
            >
              <span className="reviewer-letter">{getCouncilorLetter(index)}</span>
              <span className="reviewer-label">Model {getCouncilorLetter(index)}</span>
            </button>
          ))}
        </div>

        <div className="reviewer-content" role="tabpanel" id={panelId} aria-labelledby={`stage2-tab-${activeTab}`}>
          <div className="reviewer-header">
            <span className="reviewer-badge">Model {getCouncilorLetter(activeTab)}</span>
            <span className="model-identifier">{activeRanking.model}</span>
          </div>

          <div className="evaluation-text markdown-content">
            <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{evaluationText}</ReactMarkdown>
          </div>

          {activeRanking.parsed_ranking && activeRanking.parsed_ranking.length > 0 && (
            <div className="extracted-ranking">
              <span className="extracted-label">Extracted Ranking:</span>
              <ol className="extracted-list">
                {activeRanking.parsed_ranking.map((label, i) => (
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
