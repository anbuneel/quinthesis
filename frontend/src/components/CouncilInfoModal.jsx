import React from 'react';
import './CouncilInfoModal.css';

// Council composition - hardcoded for now as in original RightPanel
const COUNCIL_MODELS = [
    { id: 'openai/gpt-5.1', name: 'GPT-5.1', provider: 'OpenAI' },
    { id: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro', provider: 'Google' },
    { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', provider: 'Anthropic' },
    { id: 'x-ai/grok-4', name: 'Grok 4', provider: 'xAI' },
];

const CHAIRMAN_MODEL = { id: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro', provider: 'Google' };

export default function CouncilInfoModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="council-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Models</h2>
                    <button className="close-btn" onClick={onClose}>Close</button>
                </div>

                <div className="modal-content">
                    <section className="council-section">
                        <h3>Lead Model</h3>
                        <div className="chairman-card">
                            <div className="chairman-icon">L</div>
                            <div className="member-info">
                                <span className="member-name">{CHAIRMAN_MODEL.name}</span>
                                <span className="member-provider">{CHAIRMAN_MODEL.provider}</span>
                            </div>
                        </div>
                    </section>

                    <section className="council-section">
                        <h3>Models</h3>
                        <div className="council-grid">
                            {COUNCIL_MODELS.map((model, index) => (
                                <div key={model.id} className="member-card">
                                    <span className="member-letter">
                                        {String.fromCharCode(65 + index)}
                                    </span>
                                    <div className="member-info">
                                        <span className="member-name">{model.name}</span>
                                        <span className="member-provider">{model.provider}</span>
                                    </div>
                                    <div className="status-indicator active" title="Present"></div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="council-section settings-section">
                        <h3>Session Settings</h3>
                        <div className="setting-item">
                            <div className="setting-info">
                                <span className="setting-label">Anonymous Review</span>
                                <span className="setting-desc">Hide model names during review stages</span>
                            </div>
                            <label className="toggle-switch">
                                <input type="checkbox" />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
