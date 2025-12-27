import { useState, useEffect, useRef } from 'react';
import './InquiryComposer.css';

const MIN_MODELS = 2;

const getModelLabel = (model) => {
  const parts = model.split('/');
  return parts[1] || model;
};

export default function InquiryComposer({
  availableModels,
  defaultModels,
  defaultLeadModel,
  isLoadingModels,
  modelsError,
  onSubmit,
  isSubmitting,
  submitError,
}) {
  const [question, setQuestion] = useState('');
  const [selectedModels, setSelectedModels] = useState([]);
  const [leadModel, setLeadModel] = useState('');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const textareaRef = useRef(null);

  // Initialize models when available
  useEffect(() => {
    if (availableModels.length > 0 && selectedModels.length === 0) {
      const fallbackModels = defaultModels?.length
        ? defaultModels
        : availableModels.slice(0, MIN_MODELS);
      setSelectedModels(fallbackModels);
      setLeadModel(defaultLeadModel || availableModels[0] || '');
    }
  }, [availableModels, defaultModels, defaultLeadModel, selectedModels.length]);

  // Focus textarea on mount
  useEffect(() => {
    if (textareaRef.current && !isLoadingModels) {
      textareaRef.current.focus();
    }
  }, [isLoadingModels]);

  const selectionCount = selectedModels.length;
  const isValid = question.trim() && selectionCount >= MIN_MODELS && leadModel;

  const toggleModel = (model) => {
    if (isSubmitting) return;
    setSelectedModels((prev) => {
      const next = prev.includes(model)
        ? prev.filter((item) => item !== model)
        : [...prev, model];
      return availableModels.filter((item) => next.includes(item));
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;
    onSubmit({
      question: question.trim(),
      models: selectedModels,
      lead_model: leadModel,
    });
  };

  const handleKeyDown = (e) => {
    // Submit on Cmd/Ctrl + Enter
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="inquiry-composer">
      <div className="composer-inner">
        <h2 className="composer-heading">What would you like to ask the Council?</h2>

        <form onSubmit={handleSubmit} className="composer-form">
          {(modelsError || submitError) && (
            <div className="composer-error">{modelsError || submitError}</div>
          )}

          <div className="composer-input-wrapper">
            <textarea
              ref={textareaRef}
              className="composer-textarea"
              placeholder="Enter your question here..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSubmitting || isLoadingModels}
              rows={5}
            />
            <span className="composer-hint">⌘/Ctrl + Enter to submit</span>
          </div>

          <div className="composer-config">
            <button
              type="button"
              className="config-toggle"
              onClick={() => setIsConfigOpen(!isConfigOpen)}
              aria-expanded={isConfigOpen}
              aria-controls="council-config"
              disabled={isLoadingModels}
            >
              <span className="config-toggle-icon">{isConfigOpen ? '▾' : '▸'}</span>
              <span className="config-toggle-text">
                {isLoadingModels ? (
                  'Loading models...'
                ) : (
                  <>Configure Council ({selectionCount} model{selectionCount !== 1 ? 's' : ''})</>
                )}
              </span>
            </button>

            {isConfigOpen && !isLoadingModels && (
              <div className="config-panel" id="council-config">
                <div className="config-section">
                  <div className="config-label">Select models for deliberation</div>
                  <div className="model-chips">
                    {availableModels.map((model) => {
                      const selected = selectedModels.includes(model);
                      return (
                        <button
                          key={model}
                          type="button"
                          className={`model-chip ${selected ? 'selected' : ''}`}
                          onClick={() => toggleModel(model)}
                          disabled={isSubmitting}
                          title={model}
                        >
                          <span className="chip-check">{selected ? '✓' : ''}</span>
                          <span className="chip-label">{getModelLabel(model)}</span>
                        </button>
                      );
                    })}
                  </div>
                  {selectionCount < MIN_MODELS && (
                    <div className="config-warning">
                      Select at least {MIN_MODELS} models
                    </div>
                  )}
                </div>

                <div className="config-section">
                  <div className="config-label">Lead model (synthesizes final answer)</div>
                  <select
                    className="lead-select"
                    value={leadModel}
                    onChange={(e) => setLeadModel(e.target.value)}
                    disabled={isSubmitting}
                  >
                    {availableModels.map((model) => (
                      <option key={model} value={model}>
                        {getModelLabel(model)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="composer-submit"
            disabled={!isValid || isSubmitting || isLoadingModels}
          >
            {isSubmitting ? (
              <>
                <span className="submit-spinner"></span>
                Convening...
              </>
            ) : (
              'Convene the Council'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
