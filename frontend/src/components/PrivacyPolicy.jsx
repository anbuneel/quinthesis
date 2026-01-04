import { useNavigate } from 'react-router-dom';
import { LEGAL_CONFIG } from '../legalConfig';
import Masthead from './Masthead';
import './LegalPage.css';

function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="legal-page">
      <Masthead variant="minimal" />
      <div className="legal-content">
        <header className="legal-header">
          <h1 className="legal-title">Privacy Policy</h1>
          <p className="legal-date">Last updated: {LEGAL_CONFIG.privacyPolicyLastUpdated}</p>
        </header>

        <article className="legal-body">
          <section className="legal-section">
            <h2>Overview</h2>
            <p>
              Quinthesis ("we", "us", "our") is committed to protecting your privacy. This policy explains
              what data we collect, how we use it, and your rights regarding that data.
            </p>
          </section>

          <section className="legal-section">
            <h2>Data We Collect</h2>

            <h3>Account Information</h3>
            <p>When you sign in via Google or GitHub OAuth, we receive and store:</p>
            <ul>
              <li><strong>Email address</strong> - for identification and account linking</li>
              <li><strong>Display name</strong> - shown in the interface</li>
              <li><strong>Avatar URL</strong> - your profile picture from the OAuth provider</li>
              <li><strong>OAuth provider</strong> - "google" or "github"</li>
            </ul>
            <p>We do not receive or store your password. Authentication is handled entirely by Google or GitHub.</p>

            <h3>Conversation Data</h3>
            <p>When you submit inquiries, we store:</p>
            <ul>
              <li>Your questions (user messages)</li>
              <li>AI model responses from each stage of deliberation</li>
              <li>Conversation titles and timestamps</li>
              <li>Selected models and configuration</li>
            </ul>

            <h3>Financial Data</h3>
            <p>If you add funds to your account:</p>
            <ul>
              <li>Account balance and spending totals</li>
              <li>Transaction history (deposits and query costs)</li>
              <li>Stripe customer ID (for repeat purchases)</li>
            </ul>
            <p>
              <strong>Important:</strong> Credit card numbers and payment details are handled entirely by Stripe
              and never touch our servers.
            </p>

            <h3>API Keys (BYOK Users)</h3>
            <p>
              If you provide your own OpenRouter API key, it is encrypted at rest using Fernet symmetric
              encryption before being stored. The encryption key is kept in environment variables, never in
              the database.
            </p>
          </section>

          <section className="legal-section">
            <h2>Third-Party Data Sharing</h2>
            <p className="important-notice">
              Your queries are processed by third-party AI model providers.
            </p>

            <h3>OpenRouter</h3>
            <p>
              All inquiries are sent to <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer">OpenRouter</a>,
              which routes them to underlying AI providers including:
            </p>
            <ul>
              <li>OpenAI (GPT models)</li>
              <li>Google (Gemini models)</li>
              <li>Anthropic (Claude models)</li>
              <li>xAI (Grok models)</li>
            </ul>
            <p>
              These providers may retain query data according to their own privacy policies. We recommend
              reviewing OpenRouter's privacy policy and the policies of individual AI providers.
            </p>

            <h3>Stripe</h3>
            <p>
              Payment processing is handled by <a href="https://stripe.com" target="_blank" rel="noopener noreferrer">Stripe</a>.
              When you add funds, Stripe receives your email and payment information. We receive confirmation
              of payment but never your card details.
            </p>

            <h3>OAuth Providers</h3>
            <p>
              Google and GitHub provide us with the account information listed above when you sign in.
              We only receive what you authorize during the OAuth flow.
            </p>
          </section>

          <section className="legal-section">
            <h2>Data Retention</h2>
            <ul>
              <li><strong>Conversations:</strong> Stored indefinitely. No automatic deletion.</li>
              <li><strong>Account data:</strong> Retained as long as your account exists.</li>
              <li><strong>Transaction history:</strong> Retained for financial record-keeping.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>Data Security</h2>
            <ul>
              <li><strong>Encryption at rest:</strong> Database encryption via Supabase</li>
              <li><strong>API key encryption:</strong> Fernet symmetric encryption for BYOK keys</li>
              <li><strong>Transport security:</strong> HTTPS enforced for all connections</li>
              <li><strong>Authentication:</strong> OAuth 2.0 with PKCE</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>Your Rights</h2>
            <table className="rights-table">
              <thead>
                <tr>
                  <th>Right</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>View your data</td>
                  <td>Available (Account page, conversation history)</td>
                </tr>
                <tr>
                  <td>Export your data</td>
                  <td>Available (Account page &gt; Data &amp; Privacy)</td>
                </tr>
                <tr>
                  <td>Delete your account</td>
                  <td>Available (Account page &gt; Data &amp; Privacy)</td>
                </tr>
                <tr>
                  <td>Delete conversations</td>
                  <td>Available (via Archive)</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="legal-section">
            <h2>What We Don't Collect</h2>
            <ul>
              <li>Passwords (OAuth-only authentication)</li>
              <li>Credit card numbers (Stripe handles these)</li>
              <li>Browser fingerprints (not collected)</li>
              <li>Tracking cookies (we don't use third-party trackers)</li>
            </ul>

            <h3>IP Addresses</h3>
            <p>
              IP addresses are used transiently for rate limiting to prevent abuse but are not
              stored in our database. They may appear in infrastructure logs (hosting provider)
              which are retained for a limited period for security purposes.
            </p>
          </section>

          <section className="legal-section">
            <h2>Data Location</h2>
            <p>Your data is stored in:</p>
            <ul>
              <li><strong>Supabase PostgreSQL</strong> - User accounts, conversations, encrypted keys</li>
              <li><strong>Stripe</strong> - Payment information (external)</li>
              <li><strong>OpenRouter and AI providers</strong> - Query processing (external)</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>Contact</h2>
            <p>
              For privacy-related questions or requests, please open an issue on our{' '}
              <a href={LEGAL_CONFIG.repositoryUrl} target="_blank" rel="noopener noreferrer">
                GitHub repository
              </a>.
            </p>
          </section>
        </article>

        <footer className="legal-footer">
          <a href="/terms" className="footer-link">Terms of Service</a>
          <span className="footer-divider">|</span>
          <a href="/" className="footer-link">Return to Quinthesis</a>
        </footer>
      </div>
    </div>
  );
}

export default PrivacyPolicy;
