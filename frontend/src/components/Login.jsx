import { useState } from 'react';
import { auth } from '../api';
import './Login.css';

function Login({ onLogin }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate
    if (isRegistering) {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }
    }

    setIsLoading(true);

    try {
      if (isRegistering) {
        await auth.register(email, password);
      } else {
        await auth.login(email, password);
      }
      onLogin();
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setError('');
    setConfirmPassword('');
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <div className="council-emblem">
            <span className="emblem-icon">AI</span>
          </div>
          <h1 className="login-title">AI Council</h1>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              autoComplete="email"
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete={isRegistering ? 'new-password' : 'current-password'}
              disabled={isLoading}
              minLength={isRegistering ? 8 : undefined}
            />
          </div>

          {isRegistering && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                autoComplete="new-password"
                disabled={isLoading}
              />
            </div>
          )}

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="button-spinner"></span>
                <span>{isRegistering ? 'Creating account...' : 'Signing in...'}</span>
              </>
            ) : (
              isRegistering ? 'Create account' : 'Sign in'
            )}
          </button>
        </form>

        <p className="login-switch">
          {isRegistering ? (
            <>
              Already have an account?{' '}
              <button type="button" onClick={toggleMode} className="switch-button">
                Sign in
              </button>
            </>
          ) : (
            <>
              Don&apos;t have an account?{' '}
              <button type="button" onClick={toggleMode} className="switch-button">
                Create one
              </button>
            </>
          )}
        </p>

        <p className="login-footer">
          A council of AI models working together
        </p>
      </div>
    </div>
  );
}

export default Login;
