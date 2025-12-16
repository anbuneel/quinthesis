import { useState } from 'react';
import './RightPanel.css';

// Council composition - these would ideally come from backend config API
const COUNCIL_MODELS = [
  { id: 'openai/gpt-5.1', name: 'GPT-5.1', provider: 'OpenAI' },
  { id: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro', provider: 'Google' },
  { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', provider: 'Anthropic' },
  { id: 'x-ai/grok-4', name: 'Grok 4', provider: 'xAI' },
];

const CHAIRMAN_MODEL = { id: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro', provider: 'Google' };

function RightPanel({ isCollapsed, onToggle }) {
  const [blindMode, setBlindMode] = useState(false);

  return (
    <>
      <button
        className={`panel-toggle ${isCollapsed ? 'collapsed' : ''}`}
        onClick={onToggle}
        title={isCollapsed ? 'Show Council Members' : 'Hide Council Members'}
      >
        <span className="toggle-icon">{isCollapsed ? '‹' : '›'}</span>
      </button>

      <aside className={`right-panel ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="panel-content">
          <h2 className="panel-title">The Council</h2>

          <section className="panel-section">
            <h3 className="section-title">Council Members</h3>
            <div className="council-members">
              {COUNCIL_MODELS.map((model, index) => (
                <div key={model.id} className="member-card">
                  <span className="member-letter">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <div className="member-info">
                    <span className="member-name">{model.name}</span>
                    <span className="member-provider">{model.provider}</span>
                  </div>
                  <span className="member-status active" title="Active"></span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel-section">
            <h3 className="section-title">Chairman</h3>
            <div className="chairman-card">
              <div className="chairman-icon">⚖</div>
              <div className="member-info">
                <span className="member-name">{CHAIRMAN_MODEL.name}</span>
                <span className="member-provider">{CHAIRMAN_MODEL.provider}</span>
              </div>
            </div>
          </section>

          <section className="panel-section">
            <h3 className="section-title">Settings</h3>
            <label className="toggle-setting">
              <span className="setting-label">Blind Mode</span>
              <span className="setting-desc">Hide model names during review</span>
              <div className="toggle-switch">
                <input
                  type="checkbox"
                  checked={blindMode}
                  onChange={(e) => setBlindMode(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </div>
            </label>
          </section>
        </div>
      </aside>
    </>
  );
}

export default RightPanel;
