import { useEffect, useState } from 'react';
import './NewConversationModal.css';

const MIN_MODELS = 2;

const getModelLabel = (model) => {
  const parts = model.split('/');
  return parts[1] || model;
};

const getModelProvider = (model) => {
  const parts = model.split('/');
  return parts[0] || '';
};

export default function NewConversationModal({
  isOpen,
  onClose,
  onCreate,
  availableModels,
  defaultModels,
  defaultLeadModel,
  isLoading,
  loadError,
  submitError,
  isSubmitting,
}) {
  const [selectedModels, setSelectedModels] = useState([]);
  const [leadModel, setLeadModel] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const fallbackModels = defaultModels?.length
      ? defaultModels
      : availableModels.slice(0, MIN_MODELS);
    setSelectedModels(fallbackModels);
    setLeadModel(defaultLeadModel || availableModels[0] || '');
  }, [isOpen, defaultModels, defaultLeadModel, availableModels]);

  const selectionCount = selectedModels.length;
  const isValid = selectionCount >= MIN_MODELS && leadModel;
  const leadInSelection = selectedModels.includes(leadModel);

  const toggleModel = (model) => {
    if (isSubmitting || isLoading) {
      return;
    }
    setSelectedModels((prev) => {
      const next = prev.includes(model)
        ? prev.filter((item) => item !== model)
        : [...prev, model];
      return availableModels.filter((item) => next.includes(item));
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!isValid || isSubmitting) {
      return;
    }
    onCreate({ models: selectedModels, lead_model: leadModel });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="new-conversation-overlay" onClick={onClose}>
      <div
        className="new-conversation-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="new-conversation-header">
          <h2>New Inquiry</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="new-conversation-body">
            {(loadError || submitError) && (
              <div className="modal-error">{loadError || submitError}</div>
            )}

            {isLoading ? (
              <div className="modal-loading">Loading models...</div>
            ) : (
              <>
                <section className="modal-section">
                  <div className="section-header">
                    <div>
                      <h3>Models</h3>
                      <p>Select at least {MIN_MODELS} models for the run.</p>
                    </div>
                    <span className="selection-count">
                      {selectionCount} of {availableModels.length} selected
                    </span>
                  </div>

                  <div className="model-grid">
                    {availableModels.length === 0 && (
                      <div className="model-empty">No models available.</div>
                    )}
                    {availableModels.map((model) => {
                      const selected = selectedModels.includes(model);
                      return (
                        <label
                          key={model}
                          className={`model-option ${selected ? 'selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleModel(model)}
                            disabled={isSubmitting || isLoading}
                          />
                          <div className="model-details">
                            <span className="model-name">{getModelLabel(model)}</span>
                            <span className="model-meta">
                              {getModelProvider(model)} - {model}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  {selectionCount < MIN_MODELS && (
                    <div className="selection-warning">
                      Choose at least {MIN_MODELS} models to continue.
                    </div>
                  )}
                </section>

                <section className="modal-section">
                  <div className="section-header">
                    <div>
                      <h3>Lead model</h3>
                      <p>Pick the model that will synthesize the final answer.</p>
                    </div>
                  </div>
                  <div className="lead-select">
                    {availableModels.length === 0 ? (
                      <div className="model-empty">No models available.</div>
                    ) : (
                      <select
                        value={leadModel}
                        onChange={(event) => setLeadModel(event.target.value)}
                        disabled={isSubmitting || isLoading}
                      >
                        {availableModels.map((model) => (
                          <option key={model} value={model}>
                            {getModelLabel(model)}
                          </option>
                        ))}
                      </select>
                    )}
                    {!leadInSelection && leadModel && (
                      <span className="lead-note">
                        Lead model is not in the selected list.
                      </span>
                    )}
                  </div>
                </section>
              </>
            )}
          </div>

          <div className="new-conversation-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button-primary"
              disabled={!isValid || isSubmitting || isLoading}
            >
              {isSubmitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
