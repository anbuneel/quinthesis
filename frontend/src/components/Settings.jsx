import { useState, useEffect, useRef } from 'react';
import { settings } from '../api';
import ConfirmDialog from './ConfirmDialog';
import './Settings.css';

function Settings({ isOpen, onClose, userEmail }) {
  const [apiKey, setApiKey] = useState('');
  const [savedKeys, setSavedKeys] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteProvider, setPendingDeleteProvider] = useState(null);
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);

  useEffect(() => {
    if (isOpen) {
      loadApiKeys();
      // Store the previously focused element
      previousActiveElement.current = document.activeElement;
      // Focus the modal
      setTimeout(() => modalRef.current?.focus(), 0);
    } else {
      // Restore focus when modal closes
      previousActiveElement.current?.focus();
    }
  }, [isOpen]);

  // Handle Escape key and focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !confirmOpen) {
        onClose();
        return;
      }

      // Focus trap
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, confirmOpen, onClose]);

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

  const handleDeleteKey = (provider) => {
    setPendingDeleteProvider(provider);
    setConfirmOpen(true);
  };

  const confirmDeleteKey = async () => {
    setConfirmOpen(false);
    if (!pendingDeleteProvider) return;

    try {
      await settings.deleteApiKey(pendingDeleteProvider);
      setSuccess('API key removed');
      loadApiKeys();
    } catch (err) {
      setError(err.message);
    } finally {
      setPendingDeleteProvider(null);
    }
  };

  const cancelDeleteKey = () => {
    setConfirmOpen(false);
    setPendingDeleteProvider(null);
  };

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose} role="presentation">
      <div
        className="settings-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        ref={modalRef}
        tabIndex={-1}
      >
        <div className="settings-header">
          <button className="settings-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <div className="settings-title-wrapper">
            <span className="settings-title-rule"></span>
            <h2 id="settings-title">Settings</h2>
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
      <ConfirmDialog
        isOpen={confirmOpen}
        title="Remove API Key"
        message="Are you sure you want to remove this API key? You will need to add a new key to continue using the Council."
        variant="danger"
        icon="warning"
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={confirmDeleteKey}
        onCancel={cancelDeleteKey}
      />
    </div>
  );
}

export default Settings;
