import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import Stage1 from './Stage1';
import Stage2 from './Stage2';
import Stage3 from './Stage3';
import ProgressOrbit from './ProgressOrbit';
import './ChatInterface.css';

export default function ChatInterface({
  conversation,
  onSendMessage,
  isLoading,
}) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input);
      setInput('');
    }
  };

  const handleKeyDown = (e) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Determine current stage and completed stages for the last message
  const getStageProgress = (msg) => {
    const completed = [];
    let current = null;

    if (msg.stage1) completed.push('stage1');
    if (msg.stage2) completed.push('stage2');
    if (msg.stage3) completed.push('stage3');

    if (msg.loading?.stage1 && !msg.stage1) current = 'stage1';
    else if (msg.loading?.stage2 && !msg.stage2) current = 'stage2';
    else if (msg.loading?.stage3 && !msg.stage3) current = 'stage3';

    return { completed, current };
  };

  if (!conversation) {
    return (
      <div className="chat-interface">
        <div className="empty-state">
          <div className="empty-icon">⚖</div>
          <h2>Welcome to the Chamber</h2>
          <p>File a new case to begin deliberation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-interface">
      <div className="messages-container">
        {conversation.messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">⚖</div>
            <h2>Present Your Case</h2>
            <p>Submit a question for the Council to deliberate</p>
          </div>
        ) : (
          conversation.messages.map((msg, index) => {
            const { completed, current } = msg.role === 'assistant' ? getStageProgress(msg) : { completed: [], current: null };
            const isLastAssistant = msg.role === 'assistant' && index === conversation.messages.length - 1;
            const showProgress = msg.role === 'assistant' && (current || completed.length > 0);

            return (
              <div key={index} className="message-group">
                {msg.role === 'user' ? (
                  <div className="user-message">
                    <div className="message-label">Petitioner</div>
                    <div className="message-content">
                      <div className="markdown-content">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="assistant-message">
                    <div className="message-label">The Council</div>

                    {showProgress && (
                      <ProgressOrbit
                        currentStage={current}
                        completedStages={completed}
                      />
                    )}

                    {/* Stage 1 */}
                    {msg.loading?.stage1 && !msg.stage1 && (
                      <div className="stage-loading">
                        <div className="spinner"></div>
                        <span>The Council is forming first opinions...</span>
                      </div>
                    )}
                    {msg.stage1 && <Stage1 responses={msg.stage1} />}

                    {/* Stage 2 */}
                    {msg.loading?.stage2 && !msg.stage2 && (
                      <div className="stage-loading">
                        <div className="spinner"></div>
                        <span>Councilors are reviewing each other's positions...</span>
                      </div>
                    )}
                    {msg.stage2 && (
                      <Stage2
                        rankings={msg.stage2}
                        labelToModel={msg.metadata?.label_to_model}
                        aggregateRankings={msg.metadata?.aggregate_rankings}
                      />
                    )}

                    {/* Stage 3 */}
                    {msg.loading?.stage3 && !msg.stage3 && (
                      <div className="stage-loading">
                        <div className="spinner"></div>
                        <span>The Chairman is synthesizing the final ruling...</span>
                      </div>
                    )}
                    {msg.stage3 && <Stage3 finalResponse={msg.stage3} />}
                  </div>
                )}
              </div>
            );
          })
        )}

        {isLoading && conversation.messages.length > 0 && (
          <div className="loading-indicator">
            <div className="spinner"></div>
            <span>The Council is in session...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {conversation.messages.length === 0 && (
        <form className="input-form" onSubmit={handleSubmit}>
          <textarea
            className="message-input"
            placeholder="Present your case to the Council... (Shift+Enter for new line)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={3}
          />
          <button
            type="submit"
            className="send-button"
            disabled={!input.trim() || isLoading}
          >
            Deliberate
          </button>
        </form>
      )}
    </div>
  );
}
