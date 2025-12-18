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
    const [expandedStages, setExpandedStages] = useState({});
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

    const toggleStageExpansion = (key) => {
        setExpandedStages(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    if (!conversation) {
        return (
            <div className="chat-interface">
                <div className="empty-state">
                    <div className="empty-icon">⚖</div>
                    <h2>Welcome to the Council</h2>
                    <p>Start a new conversation to get expert perspectives</p>
                </div>
            </div>
        );
    }

    // Extract the user's question and last assistant response
    const userMessage = conversation.messages.find(msg => msg.role === 'user');
    const lastAssistantMsg = [...conversation.messages].reverse().find(msg => msg.role === 'assistant');
    const { completed: completedStages, current: currentStage } = lastAssistantMsg
        ? getStageProgress(lastAssistantMsg)
        : { completed: [], current: null };

    return (
        <div className="chat-interface">
            {conversation.messages.length > 0 && userMessage && (
                <div className="sticky-header">
                    <div className="header-question">
                        <div className="question-label">Your Question</div>
                        <div className="question-text">
                            <ReactMarkdown>{userMessage.content}</ReactMarkdown>
                        </div>
                    </div>
                    {lastAssistantMsg && (
                        <div className="header-progress">
                            <ProgressOrbit
                                currentStage={currentStage}
                                completedStages={completedStages}
                            />
                        </div>
                    )}
                </div>
            )}

            <div className="messages-container">
                {conversation.messages.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">⚖</div>
                        <h2>Start a Conversation</h2>
                        <p>Submit your question for the Council to evaluate</p>
                    </div>
                ) : (
                    conversation.messages.map((msg, index) => {
                        const { completed, current } = msg.role === 'assistant' ? getStageProgress(msg) : { completed: [], current: null };
                        const stageKey = `msg-${index}`;
                        const isExpanded = expandedStages[stageKey];

                        return (
                            <div key={index} className="message-group">
                                {msg.role === 'user' ? (
                                    null // Skip rendering user message here, it's in sticky header
                                ) : (
                                    <div className="assistant-message">
                                        <div className="message-label">The Council's Response</div>

                                        {/* Stage 1 - Collapsible */}
                                        {(msg.loading?.stage1 || msg.stage1) && (
                                            <div className="collapsible-stage">
                                                <button
                                                    className="stage-toggle"
                                                    onClick={() => toggleStageExpansion(`${stageKey}-stage1`)}
                                                >
                                                    <span className="toggle-icon">{expandedStages[`${stageKey}-stage1`] ? '▼' : '▶'}</span>
                                                    <span className="toggle-label">I. Opinions</span>
                                                    {msg.stage1 && <span className="toggle-count">({msg.stage1.length} responses)</span>}
                                                    {msg.loading?.stage1 && <span className="toggle-status">Loading...</span>}
                                                </button>
                                                {expandedStages[`${stageKey}-stage1`] && (
                                                    <>
                                                        {msg.loading?.stage1 && !msg.stage1 && (
                                                            <div className="stage-loading">
                                                                <div className="spinner"></div>
                                                                <span>The Council is forming first opinions...</span>
                                                            </div>
                                                        )}
                                                        {msg.stage1 && <Stage1 responses={msg.stage1} />}
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {/* Stage 2 - Collapsible */}
                                        {(msg.loading?.stage2 || msg.stage2) && (
                                            <div className="collapsible-stage">
                                                <button
                                                    className="stage-toggle"
                                                    onClick={() => toggleStageExpansion(`${stageKey}-stage2`)}
                                                >
                                                    <span className="toggle-icon">{expandedStages[`${stageKey}-stage2`] ? '▼' : '▶'}</span>
                                                    <span className="toggle-label">II. Peer Review</span>
                                                    {msg.stage2 && msg.metadata?.aggregate_rankings && <span className="toggle-count">({msg.metadata.aggregate_rankings.length} ranked)</span>}
                                                    {msg.loading?.stage2 && <span className="toggle-status">Loading...</span>}
                                                </button>
                                                {expandedStages[`${stageKey}-stage2`] && (
                                                    <>
                                                        {msg.loading?.stage2 && !msg.stage2 && (
                                                            <div className="stage-loading">
                                                                <div className="spinner"></div>
                                                                <span>Experts are reviewing each other's positions...</span>
                                                            </div>
                                                        )}
                                                        {msg.stage2 && (
                                                            <Stage2
                                                                rankings={msg.stage2}
                                                                labelToModel={msg.metadata?.label_to_model}
                                                                aggregateRankings={msg.metadata?.aggregate_rankings}
                                                            />
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {/* Stage 3 - Always expanded */}
                                        {(msg.loading?.stage3 || msg.stage3) && (
                                            <div className="final-stage">
                                                {msg.loading?.stage3 && !msg.stage3 && (
                                                    <div className="stage-loading">
                                                        <div className="spinner"></div>
                                                        <span>The Chairman is synthesizing the final answer...</span>
                                                    </div>
                                                )}
                                                {msg.stage3 && <Stage3 finalResponse={msg.stage3} />}
                                            </div>
                                        )}
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
                        placeholder="Ask the Council... (Shift+Enter for new line)"
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
