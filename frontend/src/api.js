/**
 * API client for the LLM Council backend.
 */

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080';

/**
 * Store credentials in localStorage.
 */
export function setCredentials(username, password) {
  const encoded = btoa(`${username}:${password}`);
  localStorage.setItem('ai_council_credentials', encoded);
}

/**
 * Clear stored credentials.
 */
export function clearCredentials() {
  localStorage.removeItem('ai_council_credentials');
}

/**
 * Check if credentials are stored.
 */
export function hasCredentials() {
  return !!localStorage.getItem('ai_council_credentials');
}

/**
 * Get the Authorization header value.
 */
function getAuthHeader() {
  const credentials = localStorage.getItem('ai_council_credentials');
  if (credentials) {
    return `Basic ${credentials}`;
  }
  return null;
}

/**
 * Fetch wrapper that includes auth header.
 */
async function fetchWithAuth(url, options = {}) {
  const authHeader = getAuthHeader();

  const headers = {
    ...options.headers,
  };

  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearCredentials();
    throw new Error('Authentication failed');
  }

  return response;
}

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
  async createConversation() {
    const response = await fetchWithAuth(`${API_BASE}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      throw new Error('Failed to create conversation');
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
    const authHeader = getAuthHeader();
    const headers = {
      'Content-Type': 'application/json',
    };

    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/message/stream`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ content }),
      }
    );

    if (response.status === 401) {
      clearCredentials();
      throw new Error('Authentication failed');
    }

    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

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
  },

  /**
   * Test if credentials are valid by making a test API call.
   */
  async testCredentials() {
    try {
      const response = await fetchWithAuth(`${API_BASE}/api/conversations`);
      return response.ok;
    } catch {
      return false;
    }
  },
};
