import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import Stage1 from './Stage1';
import Stage2 from './Stage2';
import Stage3 from './Stage3';
import CouncilInfoModal from './CouncilInfoModal';
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

    // State for modal
    const [isCouncilInfoOpen, setIsCouncilInfoOpen] = useState(false);

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
                <div className="chat-header">
                    <div className="header-title">Council Chamber</div>
                    <button
                        className="council-info-btn"
                        onClick={() => setIsCouncilInfoOpen(true)}
                        title="View Council Members"
                    >
                        <span>🏛️</span> Council Info
                    </button>
                </div>

                <div className="empty-state">
                    <div className="empty-icon">⚖</div>
                    <h2>Welcome to the Council</h2>
                    <p>Start a new conversation to get expert perspectives</p>
                </div>

                <CouncilInfoModal
                    isOpen={isCouncilInfoOpen}
                    onClose={() => setIsCouncilInfoOpen(false)}
                />
            </div>
        );
    }

    return (
        <div className="chat-interface">
            <div className="chat-header">
                <div className="header-title">Council Chamber</div>
                <button
                    className="council-info-btn"
                    onClick={() => setIsCouncilInfoOpen(true)}
                    title="View Council Members"
                >
                    <span>🏛️</span> Council Info
                </button>
            </div>

            <div className="messages-container">
                {conversation.messages.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">⚖</div>
                        <h2>Start a Conversation</h2>
                        <p>Submit your question for the Council to evaluate</p>
                    </div>
                ) : (
                    conversation.messages.map((msg, index) => {
                        // User Message
                        if (msg.role === 'user') {
                            return (
                                <div key={index} className="message-row user">
                                    <div className="user-message-bubble">
                                        <div className="message-role">Petitioner</div>
                                        <div className="message-content">
                                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        // Assistant Message
                        const { completed, current } = getStageProgress(msg);
                        const stageKey = `msg-${index}-deliberation`;

                        // Auto-expand deliberation if loading and not explicitly collapsed
                        // Or if explicitly expanded
                        // Default to collapsed for historical messages
                        const isDeliberationActive = msg.loading?.stage1 || msg.loading?.stage2;
                        const isExpanded = expandedStages[stageKey] !== undefined
                            ? expandedStages[stageKey]
                            : isDeliberationActive; // Expand by default only if active

                        const totalOpinions = msg.stage1?.length || 0;
                        const totalReviews = msg.metadata?.aggregate_rankings?.length || 0;

                        return (
                            <div key={index} className="message-row assistant">
                                <div className="council-session-card">
                                    <div className="session-header">
                                        <span className="session-id">Session #{Math.ceil((index + 1) / 2)}</span>
                                        <span className="session-status">
                                            {msg.loading && !msg.stage3 ? 'Deliberating...' : 'Quorum Reached'}
                                        </span>
                                    </div>

                                    {/* Deliberation Process (Accordion) */}
                                    <div className={`deliberation-accordion ${isExpanded ? 'expanded' : ''}`}>
                                        <button
                                            className="deliberation-summary"
                                            onClick={() => toggleStageExpansion(stageKey)}
                                        >
                                            <div className="summary-left">
                                                <span className="summary-icon">{isExpanded ? '📂' : '📁'}</span>
                                                <span className="summary-title">Deliberation Process</span>
                                            </div>
                                            <div className="summary-right">
                                                {totalOpinions > 0 && <span className="summary-pill">{totalOpinions} Opinions</span>}
                                                {totalReviews > 0 && <span className="summary-pill">{totalReviews} Reviews</span>}
                                                <span className="summary-chevron">{isExpanded ? '▲' : '▼'}</span>
                                            </div>
                                        </button>

                                        {isExpanded && (
                                            <div className="deliberation-content">
                                                {/* Stage 1 */}
                                                <div className="process-stage">
                                                    <div className="stage-header">I. Initial Opinions</div>
                                                    {msg.loading?.stage1 && !msg.stage1 && (
                                                        <div className="stage-loading">
                                                            <div className="spinner-small"></div>
                                                            <span>Gathering perspectives...</span>
                                                        </div>
                                                    )}
                                                    {msg.stage1 && <Stage1 responses={msg.stage1} />}
                                                </div>

                                                {/* Stage 2 */}
                                                {(msg.stage2 || msg.loading?.stage2) && (
                                                    <div className="process-stage">
                                                        <div className="stage-header">II. Peer Review</div>
                                                        {msg.loading?.stage2 && !msg.stage2 && (
                                                            <div className="stage-loading">
                                                                <div className="spinner-small"></div>
                                                                <span>Reviewing arguments...</span>
                                                            </div>
                                                        )}
                                                        {msg.stage2 && (
                                                            <Stage2
                                                                rankings={msg.stage2}
                                                                labelToModel={msg.metadata?.label_to_model}
                                                                aggregateRankings={msg.metadata?.aggregate_rankings}
                                                            />
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Stage 3 - Final Verdict */}
                                    <div className="final-verdict-section">
                                        <div className="verdict-header">
                                            <span className="verdict-icon">⚖</span>
                                            <span>Chairman's Synthesis</span>
                                        </div>

                                        {msg.loading?.stage3 && !msg.stage3 && (
                                            <div className="stage-loading">
                                                <div className="spinner"></div>
                                                <span>Synthesizing final answer...</span>
                                            </div>
                                        )}

                                        {msg.stage3 && (
                                            <div className="verdict-content">
                                                <Stage3 finalResponse={msg.stage3} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}

                {isLoading && conversation.messages.length > 0 && conversation.messages[conversation.messages.length - 1].role === 'user' && (
                    <div className="loading-indicator">
                        <div className="spinner"></div>
                        <span>The Council is convening...</span>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <form className="input-form" onSubmit={handleSubmit}>
                <textarea
                    className="message-input"
                    placeholder="Ask the Council... (Shift+Enter for new line)"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    rows={1}
                    style={{ height: 'auto', minHeight: '44px' }}
                />
                <button
                    type="submit"
                    className="send-button"
                    disabled={!input.trim() || isLoading}
                >
                    Deliberate
                </button>
            </form>

            <CouncilInfoModal
                isOpen={isCouncilInfoOpen}
                onClose={() => setIsCouncilInfoOpen(false)}
            />
        </div>
    );
}
