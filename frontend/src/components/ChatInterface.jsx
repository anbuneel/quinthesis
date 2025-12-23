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
    onToggleSidebar,
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

    const toggleStageExpansion = (key) => {
        setExpandedStages(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const getQuestionForAssistant = (messages, assistantIndex) => {
        for (let i = assistantIndex - 1; i >= 0; i -= 1) {
            if (messages[i]?.role === 'user') {
                return messages[i].content;
            }
        }
        return '';
    };

    const getStatusDetails = (msg) => {
        if (msg.loading?.stage1) {
            return { label: 'Gathering opinions', tone: 'pending' };
        }
        if (msg.loading?.stage2) {
            return { label: 'Peer review', tone: 'pending' };
        }
        if (msg.loading?.stage3) {
            return { label: 'Final synthesis', tone: 'pending' };
        }
        if (msg.stage3) {
            return { label: 'Finalized', tone: 'resolved' };
        }
        return { label: 'Pending', tone: 'pending' };
    };

    const formatUpdatedAt = (value) => {
        if (!value) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return null;
        }
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (!conversation) {
        return (
            <div className="chat-interface">
                <div className="chat-header">
                    <div className="header-left">
                        <button
                            type="button"
                            className="sidebar-toggle"
                            onClick={onToggleSidebar}
                            aria-label="Toggle conversations list"
                        >
                            Menu
                        </button>
                        <div className="header-title">Council Docket</div>
                    </div>
                    <button
                        className="council-info-btn"
                        onClick={() => setIsCouncilInfoOpen(true)}
                        title="View Council Members"
                    >
                        Council Info
                    </button>
                </div>

                <div className="empty-state">
                    <div className="empty-icon">DOCKET</div>
                    <h2>Open a Docket</h2>
                    <p>Start a new docket to request Council deliberation</p>
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
                <div className="header-left">
                    <button
                        type="button"
                        className="sidebar-toggle"
                        onClick={onToggleSidebar}
                        aria-label="Toggle conversations list"
                    >
                        Menu
                    </button>
                    <div className="header-title">Council Docket</div>
                </div>
                <button
                    className="council-info-btn"
                    onClick={() => setIsCouncilInfoOpen(true)}
                    title="View Council Members"
                >
                    Council Info
                </button>
            </div>

            <div className="docket-scroll">
                {conversation.messages.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">DOCKET</div>
                        <h2>File a Question</h2>
                        <p>Enter a question for the Council to evaluate</p>
                    </div>
                ) : (
                    conversation.messages.map((msg, index) => {
                        if (msg.role !== "assistant") {
                            return null;
                        }

                        const questionText = getQuestionForAssistant(conversation.messages, index);
                        const stageKey = `msg-${index}-deliberation`;
                        const isExpanded = expandedStages[stageKey] || false;
                        const totalOpinions = msg.stage1?.length || 0;
                        const totalReviews = msg.stage2?.length || 0;
                        const status = getStatusDetails(msg);
                        const lastUpdated = formatUpdatedAt(msg.updated_at || conversation.created_at);
                        const isDeliberationActive = msg.loading?.stage1 || msg.loading?.stage2;

                        return (
                            <article key={index} className="docket-entry">
                                <div className="docket-question">
                                    <div className="question-label">Filed Question</div>
                                    <div className="question-text markdown-content">
                                        <ReactMarkdown>{questionText || "Question not available."}</ReactMarkdown>
                                    </div>
                                    <div className="docket-meta">
                                        <span className={`question-status ${status.tone}`}>
                                            {status.label}
                                        </span>
                                        {lastUpdated && (
                                            <span className="last-updated">Updated {lastUpdated}</span>
                                        )}
                                    </div>
                                </div>

                                <section className="docket-section docket-final">
                                    {msg.loading?.stage3 && !msg.stage3 && (
                                        <div className="stage-loading">
                                            <div className="spinner"></div>
                                            <span>Synthesizing final answer...</span>
                                        </div>
                                    )}

                                    {msg.stage3 && <Stage3 finalResponse={msg.stage3} />}
                                </section>

                                <section className="docket-section docket-deliberation">
                                    <button
                                        className="docket-toggle"
                                        onClick={() => toggleStageExpansion(stageKey)}
                                    >
                                        <div className="toggle-left">
                                            <span className="toggle-title">Deliberation Records</span>
                                            {isDeliberationActive && (
                                                <span className="toggle-status">In progress</span>
                                            )}
                                        </div>
                                        <div className="toggle-right">
                                            {totalOpinions > 0 && (
                                                <span className="docket-pill">{totalOpinions} Opinions</span>
                                            )}
                                            {totalReviews > 0 && (
                                                <span className="docket-pill">{totalReviews} Reviews</span>
                                            )}
                                            <span className="toggle-chevron">
                                                {isExpanded ? "Hide" : "Show"}
                                            </span>
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="docket-details">
                                            <div className="docket-stage">
                                                {msg.loading?.stage1 && !msg.stage1 && (
                                                    <div className="stage-loading">
                                                        <div className="spinner-small"></div>
                                                        <span>Gathering perspectives...</span>
                                                    </div>
                                                )}
                                                {msg.stage1 && <Stage1 responses={msg.stage1} />}
                                            </div>

                                            {(msg.stage2 || msg.loading?.stage2) && (
                                                <div className="docket-stage">
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
                                </section>
                            </article>
                        );
                    })
                )}

                <div ref={messagesEndRef} />
            </div>
            <form className="input-form" onSubmit={handleSubmit}>
                <textarea
                    className="message-input"
                    placeholder="File a question... (Shift+Enter for new line)"
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
                    File
                </button>
            </form>

            <CouncilInfoModal
                isOpen={isCouncilInfoOpen}
                onClose={() => setIsCouncilInfoOpen(false)}
            />
        </div>
    );
}
