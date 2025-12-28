import { useState, useEffect } from 'react';
import { settings, auth } from '../api';
import './Settings.css';

function Settings({ isOpen, onClose, userEmail }) {
  const [apiKey, setApiKey] = useState('');
  const [savedKeys, setSavedKeys] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadApiKeys();
    }
  }, [isOpen]);

  const loadApiKeys = async () => {
    setIsLoading(true);
    setError('');
    try {
      const keys = await settings.listApiKeys();
      setSavedKeys(keys);
    } catch (err) {
      setError('Failed to load API keys');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveKey = async (e) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      await settings.saveApiKey(apiKey.trim());
      setApiKey('');
      setSuccess('API key saved successfully');
      loadApiKeys();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteKey = async (provider) => {
    if (!window.confirm('Remove this API key?')) return;

    try {
      await settings.deleteApiKey(provider);
      setSuccess('API key removed');
      loadApiKeys();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <button className="settings-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <div className="settings-title-wrapper">
            <span className="settings-title-rule"></span>
            <h2>Settings</h2>
            <span className="settings-title-rule"></span>
          </div>
          <div className="settings-header-divider">
            <span className="settings-divider-line"></span>
            <span className="settings-divider-ornament">&#9830;</span>
            <span className="settings-divider-line"></span>
          </div>
        </div>

        <div className="settings-body">
          {error && <div className="settings-message settings-error">{error}</div>}
          {success && <div className="settings-message settings-success">{success}</div>}

          <section className="settings-section">
            <h3>Account</h3>
            <div className="account-info">
              <span className="account-label">Email:</span>
              <span className="account-value">{userEmail || 'Unknown'}</span>
            </div>
          </section>

          <div className="settings-section-divider">
            <span className="settings-section-divider-ornament">&#167;</span>
          </div>

          <section className="settings-section">
            <h3>OpenRouter API Key</h3>
            <p className="settings-desc">
              Your API key is encrypted and stored securely. Each user provides their own key.
              Get yours at{' '}
              <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">
                openrouter.ai/keys
              </a>
            </p>

            {isLoading ? (
              <p className="settings-loading">Loading...</p>
            ) : (
              <>
                {savedKeys.length > 0 && (
                  <div className="saved-keys">
                    {savedKeys.map((key) => (
                      <div key={key.id} className="saved-key">
                        <div className="key-info">
                          <span className="key-provider">{key.provider}</span>
                          <span className="key-hint">{key.key_hint}</span>
                        </div>
                        <button
                          className="key-delete"
                          onClick={() => handleDeleteKey(key.provider)}
                          aria-label="Remove API key"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleSaveKey} className="api-key-form">
                  <input
                    type="password"
                    placeholder="sk-or-v1-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    disabled={isSaving}
                    className="api-key-input"
                  />
                  <button
                    type="submit"
                    disabled={isSaving || !apiKey.trim()}
                    className="api-key-submit"
                  >
                    {savedKeys.length > 0 ? 'Update Key' : 'Save Key'}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default Settings;
