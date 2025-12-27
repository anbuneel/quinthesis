import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import Login from './components/Login';
import NewConversationModal from './components/NewConversationModal';
import { api, hasCredentials, clearCredentials } from './api';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNewConversationOpen, setIsNewConversationOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState([]);
  const [defaultModels, setDefaultModels] = useState([]);
  const [defaultLeadModel, setDefaultLeadModel] = useState('');
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState('');
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [createError, setCreateError] = useState('');

  // Check for existing credentials on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (hasCredentials()) {
        // Verify credentials are still valid
        const isValid = await api.testCredentials();
        if (isValid) {
          setIsAuthenticated(true);
        }
      }
      setIsCheckingAuth(false);
    };
    checkAuth();
  }, []);

  // Load conversations and models when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
      loadModelOptions();
    }
  }, [isAuthenticated]);

  // Load conversation details when selected
  useEffect(() => {
    if (currentConversationId) {
      loadConversation(currentConversationId);
    }
  }, [currentConversationId]);

  // Keyboard shortcuts and escape handling
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Escape key - close sidebar or modal
      if (event.key === 'Escape') {
        if (isNewConversationOpen) {
          setIsNewConversationOpen(false);
        } else if (isSidebarOpen) {
          setIsSidebarOpen(false);
        }
        return;
      }

      // Don't trigger shortcuts when typing in input/textarea
      const target = event.target;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const isMod = event.metaKey || event.ctrlKey;

      // Cmd/Ctrl + K - Toggle archive drawer
      if (isMod && event.key === 'k') {
        event.preventDefault();
        setIsSidebarOpen((prev) => !prev);
        return;
      }

      // Cmd/Ctrl + N - New inquiry (go to home/composer)
      if (isMod && event.key === 'n') {
        event.preventDefault();
        handleGoToComposer();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarOpen, isNewConversationOpen]);

  const loadConversations = async () => {
    try {
      const convs = await api.listConversations();
      setConversations(convs);
    } catch (error) {
      console.error('Failed to load conversations:', error);
      if (error.message === 'Authentication failed') {
        setIsAuthenticated(false);
      }
    }
  };

  const loadConversation = async (id) => {
    try {
      const conv = await api.getConversation(id);
      setCurrentConversation(conv);
    } catch (error) {
      console.error('Failed to load conversation:', error);
      if (error.message === 'Authentication failed') {
        setIsAuthenticated(false);
      }
    }
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    clearCredentials();
    setIsAuthenticated(false);
    setConversations([]);
    setCurrentConversationId(null);
    setCurrentConversation(null);
    setIsSidebarOpen(false);
    setIsNewConversationOpen(false);
  };

  const loadModelOptions = async () => {
    setIsLoadingModels(true);
    setModelsError('');
    try {
      const data = await api.listModels();
      const models = data.models || [];
      setAvailableModels(models);
      setDefaultModels(data.default_models || models);
      setDefaultLeadModel(data.default_lead_model || models[0] || '');
    } catch (error) {
      console.error('Failed to load models:', error);
      if (error.message === 'Authentication failed') {
        setIsAuthenticated(false);
      } else {
        setModelsError('Unable to load models.');
      }
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleGoToComposer = () => {
    setCurrentConversationId(null);
    setCurrentConversation(null);
    setIsSidebarOpen(false);
    setCreateError('');
  };

  const handleNewConversation = async () => {
    try {
      setCreateError('');
      setIsNewConversationOpen(true);
      if (availableModels.length === 0 && !isLoadingModels) {
        await loadModelOptions();
      }
      setIsSidebarOpen(false);
    } catch (error) {
      console.error('Failed to open conversation modal:', error);
    }
  };

  // New unified handler: create conversation + send message in one action
  const handleCreateAndSubmit = async ({ question, models, lead_model }) => {
    setIsCreatingConversation(true);
    setCreateError('');
    try {
      // Step 1: Create the conversation
      const newConv = await api.createConversation({ models, lead_model });

      // Add to conversation list
      setConversations((prev) => [
        { id: newConv.id, created_at: newConv.created_at, title: newConv.title, message_count: 0 },
        ...prev,
      ]);

      // Set as current conversation
      setCurrentConversationId(newConv.id);

      // Create a minimal conversation object for immediate display
      const now = new Date().toISOString();
      const userMessage = { role: 'user', content: question, created_at: now };
      const assistantMessage = {
        role: 'assistant',
        stage1: null,
        stage2: null,
        stage3: null,
        metadata: null,
        created_at: now,
        updated_at: now,
        loading: { stage1: false, stage2: false, stage3: false },
      };

      setCurrentConversation({
        ...newConv,
        messages: [userMessage, assistantMessage],
      });

      setIsCreatingConversation(false);
      setIsLoading(true);

      // Step 2: Send the message with streaming
      await api.sendMessageStream(newConv.id, question, (eventType, event) => {
        switch (eventType) {
          case 'stage1_start':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.loading.stage1 = true;
              lastMsg.updated_at = new Date().toISOString();
              return { ...prev, messages };
            });
            break;

          case 'stage1_complete':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.stage1 = event.data;
              lastMsg.loading.stage1 = false;
              lastMsg.updated_at = new Date().toISOString();
              return { ...prev, messages };
            });
            break;

          case 'stage2_start':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.loading.stage2 = true;
              lastMsg.updated_at = new Date().toISOString();
              return { ...prev, messages };
            });
            break;

          case 'stage2_complete':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.stage2 = event.data;
              lastMsg.metadata = event.metadata;
              lastMsg.loading.stage2 = false;
              lastMsg.updated_at = new Date().toISOString();
              return { ...prev, messages };
            });
            break;

          case 'stage3_start':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.loading.stage3 = true;
              lastMsg.updated_at = new Date().toISOString();
              return { ...prev, messages };
            });
            break;

          case 'stage3_complete':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.stage3 = event.data;
              lastMsg.loading.stage3 = false;
              lastMsg.updated_at = new Date().toISOString();
              return { ...prev, messages };
            });
            break;

          case 'title_complete':
            loadConversations();
            break;

          case 'complete':
            loadConversations();
            setIsLoading(false);
            break;

          case 'error':
            console.error('Stream error:', event.message);
            setIsLoading(false);
            break;

          default:
            console.log('Unknown event type:', eventType);
        }
      });
    } catch (error) {
      console.error('Failed to create and submit:', error);
      if (error.message === 'Authentication failed') {
        setIsAuthenticated(false);
      } else {
        setCreateError(error.message || 'Failed to submit inquiry.');
      }
      setIsCreatingConversation(false);
      setIsLoading(false);
    }
  };

  const handleCloseNewConversation = () => {
    setIsNewConversationOpen(false);
    setCreateError('');
    setModelsError('');
  };

  const handleCreateConversation = async ({ models, lead_model }) => {
    setIsCreatingConversation(true);
    setCreateError('');
    try {
      const newConv = await api.createConversation({ models, lead_model });
      setConversations((prev) => [
        { id: newConv.id, created_at: newConv.created_at, title: newConv.title, message_count: 0 },
        ...prev,
      ]);
      setCurrentConversationId(newConv.id);
      setIsNewConversationOpen(false);
    } catch (error) {
      console.error('Failed to create conversation:', error);
      if (error.message === 'Authentication failed') {
        setIsAuthenticated(false);
      } else {
        setCreateError(error.message || 'Failed to create inquiry.');
      }
    } finally {
      setIsCreatingConversation(false);
    }
  };

  const handleSelectConversation = (id) => {
    setCurrentConversationId(id);
    setIsSidebarOpen(false);
  };

  const handleDeleteConversation = async (id) => {
    // Confirm before deleting
    if (!window.confirm('Delete this inquiry? This cannot be undone.')) {
      return;
    }

    try {
      await api.deleteConversation(id);

      // Refresh conversation list
      await loadConversations();

      // If the deleted conversation was selected, clear selection
      if (id === currentConversationId) {
        setCurrentConversationId(null);
        setCurrentConversation(null);
      }
      setIsSidebarOpen(false);
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      if (err.message === 'Authentication failed') {
        setIsAuthenticated(false);
      } else {
        alert('Failed to delete inquiry');
      }
    }
  };

  const handleToggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const handleCloseSidebar = () => {
    setIsSidebarOpen(false);
  };

  const handleSendMessage = async (content) => {
    if (!currentConversationId) return;

    setIsLoading(true);
    try {
      const now = new Date().toISOString();
      // Optimistically add user message to UI
      const userMessage = { role: 'user', content, created_at: now };
      setCurrentConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
      }));

      // Create a partial assistant message that will be updated progressively
      const assistantMessage = {
        role: 'assistant',
        stage1: null,
        stage2: null,
        stage3: null,
        metadata: null,
        created_at: now,
        updated_at: now,
        loading: {
          stage1: false,
          stage2: false,
          stage3: false,
        },
      };

      // Add the partial assistant message
      setCurrentConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
      }));

      // Send message with streaming
      await api.sendMessageStream(currentConversationId, content, (eventType, event) => {
        switch (eventType) {
          case 'stage1_start':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.loading.stage1 = true;
              lastMsg.updated_at = new Date().toISOString();
              return { ...prev, messages };
            });
            break;

          case 'stage1_complete':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.stage1 = event.data;
              lastMsg.loading.stage1 = false;
              lastMsg.updated_at = new Date().toISOString();
              return { ...prev, messages };
            });
            break;

          case 'stage2_start':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.loading.stage2 = true;
              lastMsg.updated_at = new Date().toISOString();
              return { ...prev, messages };
            });
            break;

          case 'stage2_complete':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.stage2 = event.data;
              lastMsg.metadata = event.metadata;
              lastMsg.loading.stage2 = false;
              lastMsg.updated_at = new Date().toISOString();
              return { ...prev, messages };
            });
            break;

          case 'stage3_start':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.loading.stage3 = true;
              lastMsg.updated_at = new Date().toISOString();
              return { ...prev, messages };
            });
            break;

          case 'stage3_complete':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.stage3 = event.data;
              lastMsg.loading.stage3 = false;
              lastMsg.updated_at = new Date().toISOString();
              return { ...prev, messages };
            });
            break;

          case 'title_complete':
            // Reload conversations to get updated title
            loadConversations();
            break;

          case 'complete':
            // Stream complete, reload conversations list
            loadConversations();
            setIsLoading(false);
            break;

          case 'error':
            console.error('Stream error:', event.message);
            setIsLoading(false);
            break;

          default:
            console.log('Unknown event type:', eventType);
        }
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      if (error.message === 'Authentication failed') {
        setIsAuthenticated(false);
      } else {
        // Remove optimistic messages on error
        setCurrentConversation((prev) => ({
          ...prev,
          messages: prev.messages.slice(0, -2),
        }));
      }
      setIsLoading(false);
    }
  };

  // Show loading while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app-layout">
      <Sidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleGoToComposer}
        onDeleteConversation={handleDeleteConversation}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={handleCloseSidebar}
      />
      <main className="main-pane">
        <ChatInterface
          conversation={currentConversation}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          onToggleSidebar={handleToggleSidebar}
          isSidebarOpen={isSidebarOpen}
          // Inquiry composer props
          availableModels={availableModels}
          defaultModels={defaultModels}
          defaultLeadModel={defaultLeadModel}
          isLoadingModels={isLoadingModels}
          modelsError={modelsError}
          onCreateAndSubmit={handleCreateAndSubmit}
          isCreating={isCreatingConversation}
          createError={createError}
        />
      </main>
      <div
        className={`sidebar-overlay ${isSidebarOpen ? 'visible' : ''}`}
        onClick={handleCloseSidebar}
        role="presentation"
        aria-hidden={!isSidebarOpen}
      />
      <NewConversationModal
        isOpen={isNewConversationOpen}
        onClose={handleCloseNewConversation}
        onCreate={handleCreateConversation}
        availableModels={availableModels}
        defaultModels={defaultModels}
        defaultLeadModel={defaultLeadModel}
        isLoading={isLoadingModels}
        loadError={modelsError}
        submitError={createError}
        isSubmitting={isCreatingConversation}
      />
    </div>
  );
}

export default App;
