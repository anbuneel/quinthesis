/**
 * API client for the LLM Council backend.
 * Uses JWT-based authentication.
 */

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080';

// ============== Token Management ==============

let accessToken = localStorage.getItem('ai_council_access_token');
let refreshToken = localStorage.getItem('ai_council_refresh_token');

/**
 * Store JWT tokens.
 */
export function setTokens(access, refresh) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('ai_council_access_token', access);
  localStorage.setItem('ai_council_refresh_token', refresh);
}

/**
 * Clear stored tokens.
 */
export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('ai_council_access_token');
  localStorage.removeItem('ai_council_refresh_token');
}

/**
 * Check if tokens are stored.
 */
export function hasTokens() {
  return !!accessToken;
}

/**
 * Try to refresh the access token using the refresh token.
 */
async function tryRefreshToken() {
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      setTokens(data.access_token, data.refresh_token);
      return true;
    }
  } catch (e) {
    console.error('Token refresh failed:', e);
  }
  return false;
}

/**
 * Fetch wrapper that includes JWT auth header and handles token refresh.
 */
async function fetchWithAuth(url, options = {}) {
  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const makeRequest = async (token) => {
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    };

    return fetch(url, {
      ...options,
      headers,
    });
  };

  let response = await makeRequest(accessToken);

  // Handle token expiration
  if (response.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      // Retry with new token
      response = await makeRequest(accessToken);
    } else {
      clearTokens();
      throw new Error('Authentication failed');
    }
  }

  return response;
}

// ============== Auth API ==============

export const auth = {
  /**
   * Start OAuth flow - redirects to provider.
   */
  async startOAuth(provider) {
    const response = await fetch(`${API_BASE}/api/auth/oauth/${provider}`);

    if (!response.ok) {
      let message = 'Failed to start OAuth';
      try {
        const error = await response.json();
        message = error.detail || message;
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    const data = await response.json();
    // Store state for CSRF validation
    sessionStorage.setItem('oauth_state', data.state);
    // Redirect to provider
    window.location.href = data.authorization_url;
  },

  /**
   * Complete OAuth flow - exchange code for tokens.
   */
  async completeOAuth(provider, code, state) {
    // Validate state (CSRF protection) - fail hard if mismatch
    const storedState = sessionStorage.getItem('oauth_state');
    sessionStorage.removeItem('oauth_state');

    if (!storedState) {
      throw new Error('OAuth state not found - please start login again');
    }
    if (!state) {
      throw new Error('OAuth state missing from callback - possible attack');
    }
    if (storedState !== state) {
      throw new Error('OAuth state mismatch - possible CSRF attack');
    }

    const response = await fetch(`${API_BASE}/api/auth/oauth/${provider}/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state }),
    });

    if (!response.ok) {
      let message = 'OAuth authentication failed';
      try {
        const error = await response.json();
        message = error.detail || message;
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    const data = await response.json();
    setTokens(data.access_token, data.refresh_token);
    return data;
  },

  /**
   * Logout (clear tokens).
   */
  logout() {
    clearTokens();
  },

  /**
   * Get current user info.
   */
  async getMe() {
    const response = await fetchWithAuth(`${API_BASE}/api/auth/me`);
    if (!response.ok) {
      throw new Error('Failed to get user info');
    }
    return response.json();
  },
};

// ============== Settings API ==============

export const settings = {
  /**
   * Save or update API key.
   */
  async saveApiKey(apiKey, provider = 'openrouter') {
    const response = await fetchWithAuth(`${API_BASE}/api/settings/api-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, provider }),
    });

    if (!response.ok) {
      let message = 'Failed to save API key';
      try {
        const error = await response.json();
        message = error.detail || message;
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    return response.json();
  },

  /**
   * List saved API keys (metadata only).
   */
  async listApiKeys() {
    const response = await fetchWithAuth(`${API_BASE}/api/settings/api-keys`);
    if (!response.ok) {
      throw new Error('Failed to list API keys');
    }
    return response.json();
  },

  /**
   * Delete an API key.
   */
  async deleteApiKey(provider) {
    const response = await fetchWithAuth(
      `${API_BASE}/api/settings/api-key/${provider}`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      throw new Error('Failed to delete API key');
    }

    return response.json();
  },
};

// ============== Credits API (Legacy) ==============

export const credits = {
  /**
   * Get current credit balance (legacy endpoint).
   */
  async getBalance() {
    const response = await fetchWithAuth(`${API_BASE}/api/credits`);
    if (!response.ok) {
      throw new Error('Failed to get credit balance');
    }
    return response.json();
  },

  /**
   * Get available credit packs (legacy).
   */
  async getPacks() {
    const response = await fetchWithAuth(`${API_BASE}/api/credits/packs`);
    if (!response.ok) {
      throw new Error('Failed to get credit packs');
    }
    return response.json();
  },

  /**
   * Get credit transaction history (legacy).
   */
  async getHistory() {
    const response = await fetchWithAuth(`${API_BASE}/api/credits/history`);
    if (!response.ok) {
      throw new Error('Failed to get credit history');
    }
    return response.json();
  },

  /**
   * Create checkout session and redirect to Stripe (legacy).
   */
  async purchasePack(packId) {
    const successUrl = `${window.location.origin}/credits/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${window.location.origin}/credits/cancel`;

    const response = await fetchWithAuth(`${API_BASE}/api/credits/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pack_id: packId,
        success_url: successUrl,
        cancel_url: cancelUrl,
      }),
    });

    if (!response.ok) {
      let message = 'Failed to create checkout session';
      try {
        const error = await response.json();
        message = error.detail || message;
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    const data = await response.json();
    // Redirect to Stripe Checkout
    window.location.href = data.checkout_url;
  },

  /**
   * Retry OpenRouter key provisioning for users who have credits but no key.
   */
  async retryProvisioning() {
    const response = await fetchWithAuth(`${API_BASE}/api/credits/provision-key`, {
      method: 'POST',
    });

    if (!response.ok) {
      let message = 'Failed to provision API key';
      try {
        const error = await response.json();
        message = error.detail || message;
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    return response.json();
  },
};

// ============== Billing API (Usage-Based) ==============

export const billing = {
  /**
   * Get current dollar balance and billing info.
   * Returns { balance, total_deposited, total_spent, has_openrouter_key }
   */
  async getBalance() {
    const response = await fetchWithAuth(`${API_BASE}/api/balance`);
    if (!response.ok) {
      throw new Error('Failed to get balance');
    }
    return response.json();
  },

  /**
   * Get available deposit options.
   * Returns [{ id, name, amount_cents }, ...]
   */
  async getDepositOptions() {
    const response = await fetchWithAuth(`${API_BASE}/api/deposits/options`);
    if (!response.ok) {
      throw new Error('Failed to get deposit options');
    }
    return response.json();
  },

  /**
   * Get usage history with cost breakdowns.
   * Returns [{ id, conversation_id, openrouter_cost, margin_cost, total_cost, model_breakdown, created_at }, ...]
   */
  async getUsageHistory() {
    const response = await fetchWithAuth(`${API_BASE}/api/usage/history`);
    if (!response.ok) {
      throw new Error('Failed to get usage history');
    }
    return response.json();
  },

  /**
   * Create checkout session for a deposit and redirect to Stripe.
   */
  async purchaseDeposit(optionId) {
    const successUrl = `${window.location.origin}/credits/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${window.location.origin}/credits/cancel`;

    const response = await fetchWithAuth(`${API_BASE}/api/deposits/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        option_id: optionId,
        success_url: successUrl,
        cancel_url: cancelUrl,
      }),
    });

    if (!response.ok) {
      let message = 'Failed to create checkout session';
      try {
        const error = await response.json();
        message = error.detail || message;
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    const data = await response.json();
    // Redirect to Stripe Checkout
    window.location.href = data.checkout_url;
  },
};

// ============== Main API ==============

export const api = {
  /**
   * List all conversations.
   */
  async listConversations() {
    const response = await fetchWithAuth(`${API_BASE}/api/conversations`);
    if (!response.ok) {
      throw new Error('Failed to list conversations');
    }
    return response.json();
  },

  /**
   * Create a new conversation.
   */
  async createConversation(options = {}) {
    const response = await fetchWithAuth(`${API_BASE}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });
    if (!response.ok) {
      let message = 'Failed to create conversation';
      try {
        const data = await response.json();
        if (data?.detail) {
          message = data.detail;
        }
      } catch (err) {
        // ignore JSON parse errors
      }
      throw new Error(message);
    }
    return response.json();
  },

  /**
   * List available models and defaults.
   */
  async listModels() {
    const response = await fetchWithAuth(`${API_BASE}/api/models`);
    if (!response.ok) {
      let message = 'Failed to load models';
      try {
        const data = await response.json();
        if (data?.detail) {
          message = data.detail;
        }
      } catch (err) {
        // ignore JSON parse errors
      }
      throw new Error(message);
    }
    return response.json();
  },

  /**
   * Get a specific conversation.
   */
  async getConversation(conversationId) {
    const response = await fetchWithAuth(
      `${API_BASE}/api/conversations/${conversationId}`
    );
    if (!response.ok) {
      throw new Error('Failed to get conversation');
    }
    return response.json();
  },

  /**
   * Delete a conversation.
   */
  async deleteConversation(conversationId) {
    const response = await fetchWithAuth(
      `${API_BASE}/api/conversations/${conversationId}`,
      { method: 'DELETE' }
    );
    if (!response.ok) {
      throw new Error('Failed to delete conversation');
    }
    return response.json();
  },

  /**
   * Send a message in a conversation.
   */
  async sendMessage(conversationId, content) {
    const response = await fetchWithAuth(
      `${API_BASE}/api/conversations/${conversationId}/message`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      }
    );
    if (!response.ok) {
      throw new Error('Failed to send message');
    }
    return response.json();
  },

  /**
   * Send a message and receive streaming updates.
   * @param {string} conversationId - The conversation ID
   * @param {string} content - The message content
   * @param {function} onEvent - Callback function for each event: (eventType, data) => void
   * @returns {Promise<void>}
   */
  async sendMessageStream(conversationId, content, onEvent) {
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    };

    let response;
    try {
      response = await fetch(
        `${API_BASE}/api/conversations/${conversationId}/message/stream`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ content }),
        }
      );
    } catch (fetchError) {
      // Network error, CORS issue, or server unreachable
      console.error('Stream fetch failed:', fetchError);
      throw new Error(`Network error: ${fetchError.message}. Check if the backend is running at ${API_BASE}`);
    }

    if (response.status === 401) {
      // Try to refresh token
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        // Retry the stream request
        return this.sendMessageStream(conversationId, content, onEvent);
      }
      clearTokens();
      throw new Error('Authentication failed');
    }

    if (!response.ok) {
      let errorDetail = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData?.detail) {
          errorDetail = errorData.detail;
        }
      } catch {
        // Ignore JSON parse errors
      }
      throw new Error(`Failed to send message: ${errorDetail}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Append new chunk to buffer, using stream mode to handle partial UTF-8 sequences
      buffer += decoder.decode(value, { stream: true });

      // Split on newlines, keeping incomplete line in buffer
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Last element is incomplete line (or empty if ended with \n)

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const event = JSON.parse(data);
            onEvent(event.type, event);
          } catch (e) {
            console.error('Failed to parse SSE event:', e);
          }
        }
      }
    }

    // Flush any remaining bytes from the decoder
    buffer += decoder.decode();

    // Process any remaining data in buffer
    if (buffer.startsWith('data: ')) {
      const data = buffer.slice(6);
      try {
        const event = JSON.parse(data);
        onEvent(event.type, event);
      } catch (e) {
        console.error('Failed to parse final SSE event:', e);
      }
    }
  },

  /**
   * Test if authentication is valid.
   */
  async testCredentials() {
    if (!accessToken) return false;
    try {
      const response = await fetchWithAuth(`${API_BASE}/api/auth/me`);
      return response.ok;
    } catch {
      return false;
    }
  },
};
