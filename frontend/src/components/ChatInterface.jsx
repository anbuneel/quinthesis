import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import Stage1 from './Stage1';
import Stage2 from './Stage2';
import Stage3 from './Stage3';
import './ChatInterface.css';

export default function ChatInterface({
    conversation,
    onSendMessage,
    isLoading,
    onToggleSidebar,
    isSidebarOpen,
}) {
    const [input, setInput] = useState('');
    const [isQuestionCollapsed, setIsQuestionCollapsed] = useState(false);
    const [activeTab, setActiveTab] = useState('final');
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [conversation]);

    useEffect(() => {
        setIsQuestionCollapsed(false);
    }, [conversation?.id]);

    useEffect(() => {
        setActiveTab('stage1');
    }, [conversation?.id]);

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

    const getStatusDetails = (msg) => {
        if (msg.loading?.stage1) {
            return { label: 'Gathering responses', tone: 'pending' };
        }
        if (msg.loading?.stage2) {
            return { label: 'Reviewing responses', tone: 'pending' };
        }
        if (msg.loading?.stage3) {
            return { label: 'Final answer', tone: 'pending' };
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

    const allMessages = conversation?.messages || [];
    const userMessages = allMessages.filter((msg) => msg.role === 'user');
    const assistantMessages = allMessages.filter((msg) => msg.role === 'assistant');
    const questionText = userMessages[0]?.content || '';
    const hasQuestion = userMessages.length > 0;
    const latestAssistant = assistantMessages[assistantMessages.length - 1];
    const status = latestAssistant ? getStatusDetails(latestAssistant) : { label: 'Pending', tone: 'pending' };
    const lastUpdated = formatUpdatedAt(latestAssistant?.updated_at || conversation?.created_at);
    const hasResponse = Boolean(latestAssistant);
    const hasStage1 = Boolean(latestAssistant?.stage1?.length);
    const hasStage2 = Boolean(latestAssistant?.stage2?.length);

    useEffect(() => {
        if (!latestAssistant) {
            return;
        }
        if (latestAssistant?.loading?.stage1) {
            setActiveTab('stage1');
            return;
        }
        if (latestAssistant?.loading?.stage2) {
            setActiveTab('stage2');
            return;
        }
        if (latestAssistant?.loading?.stage3) {
            setActiveTab('final');
            return;
        }
        if (latestAssistant?.stage3) {
            setActiveTab('final');
        }
    }, [latestAssistant]);

    useEffect(() => {
        if (conversation && latestAssistant?.stage3 && hasQuestion) {
            setIsQuestionCollapsed(true);
        }
    }, [conversation, latestAssistant?.stage3, hasQuestion]);

    if (!conversation) {
        return (
            <div className="chat-interface">
                <header className="masthead">
                    <button
                        type="button"
                        className="sidebar-toggle"
                        onClick={onToggleSidebar}
                        aria-label="Open archive"
                        aria-expanded={isSidebarOpen}
                        aria-controls="sidebar"
                    >
                        Archive
                    </button>
                    <h1 className="masthead-title">The AI Council</h1>
                    <div className="masthead-spacer" />
                </header>
                <div className="empty-state">
                    <div className="empty-icon">NEW INQUIRY</div>
                    <h2>Submit Your Question</h2>
                    <p>Select your models and pose a question to receive synthesized insights from the Council.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="chat-interface">
            <header className="masthead">
                <button
                    type="button"
                    className="sidebar-toggle"
                    onClick={onToggleSidebar}
                    aria-label="Open archive"
                    aria-expanded={isSidebarOpen}
                    aria-controls="sidebar"
                >
                    Archive
                </button>
                <h1 className="masthead-title">The AI Council</h1>
                <div className="masthead-spacer" />
            </header>

            <div className="question-panel">
                <div className="panel-inner">
                    <div className="question-panel-header">
                        <div className="question-panel-title">Filed Inquiry</div>
                        {hasQuestion && (
                            <button
                                type="button"
                                className="question-toggle"
                                onClick={() => setIsQuestionCollapsed((prev) => !prev)}
                                aria-expanded={!isQuestionCollapsed}
                            >
                                {isQuestionCollapsed ? 'Expand' : 'Collapse'}
                            </button>
                        )}
                    </div>
                    {hasQuestion ? (
                        <>
                            {!isQuestionCollapsed && (
                                <div className="question-panel-text markdown-content">
                                    <ReactMarkdown>{questionText}</ReactMarkdown>
                                </div>
                            )}
                            <div className="question-panel-meta">
                                <span className={`question-status ${status.tone}`}>
                                    {status.label}
                                </span>
                                {lastUpdated && (
                                    <span className="last-updated">Updated {lastUpdated}</span>
                                )}
                            </div>
                        </>
                    ) : (
                        <form className="question-form" onSubmit={handleSubmit}>
                            <textarea
                                className="message-input"
                                placeholder="Ask a question... (Shift+Enter for new line)"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isLoading}
                                rows={4}
                            />
                            <button
                                type="submit"
                                className="send-button"
                                disabled={!input.trim() || isLoading}
                            >
                                Send
                            </button>
                        </form>
                    )}
                </div>
            </div>

            <div className="docket-scroll">
                {!hasResponse ? (
                    <div className="empty-state">
                        <div className="empty-icon">RESPONSE</div>
                        <h2>Responses will appear here</h2>
                        <p>Submit a question to start the run.</p>
                    </div>
                ) : (
                    <div className="response-panel">
                        <div className="panel-inner">
                            <div className="response-tabs" role="tablist" aria-label="Response tabs">
                                <button
                                    type="button"
                                    className={`response-tab ${activeTab === 'final' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('final')}
                                    role="tab"
                                    aria-selected={activeTab === 'final'}
                                >
                                    Final Answer
                                </button>
                                <button
                                    type="button"
                                    className={`response-tab ${activeTab === 'stage1' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('stage1')}
                                    role="tab"
                                    aria-selected={activeTab === 'stage1'}
                                >
                                    Stage 1
                                </button>
                                <button
                                    type="button"
                                    className={`response-tab ${activeTab === 'stage2' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('stage2')}
                                    role="tab"
                                    aria-selected={activeTab === 'stage2'}
                                >
                                    Stage 2
                                </button>
                            </div>

                            <div className="response-tab-panels">
                                {activeTab === 'final' && (
                                    <div className="response-tab-panel" role="tabpanel">
                                        {latestAssistant?.loading?.stage3 && !latestAssistant?.stage3 && (
                                            <div className="stage-loading">
                                                <div className="spinner"></div>
                                                <span>Synthesizing final answer...</span>
                                            </div>
                                        )}
                                        {latestAssistant?.stage3 ? (
                                            <Stage3 finalResponse={latestAssistant.stage3} />
                                        ) : (
                                            !latestAssistant?.loading?.stage3 && (
                                                <div className="tab-empty">Final answer is pending.</div>
                                            )
                                        )}
                                    </div>
                                )}

                                {activeTab === 'stage1' && (
                                    <div className="response-tab-panel" role="tabpanel">
                                        {latestAssistant?.loading?.stage1 && !hasStage1 && (
                                            <div className="stage-loading">
                                                <div className="spinner-small"></div>
                                                <span>Gathering responses...</span>
                                            </div>
                                        )}
                                        {hasStage1 ? (
                                            <Stage1 responses={latestAssistant.stage1} />
                                        ) : (
                                            !latestAssistant?.loading?.stage1 && (
                                                <div className="tab-empty">Stage 1 responses are pending.</div>
                                            )
                                        )}
                                    </div>
                                )}

                                {activeTab === 'stage2' && (
                                    <div className="response-tab-panel" role="tabpanel">
                                        {latestAssistant?.loading?.stage2 && !hasStage2 && (
                                            <div className="stage-loading">
                                                <div className="spinner-small"></div>
                                                <span>Reviewing responses...</span>
                                            </div>
                                        )}
                                        {hasStage2 ? (
                                            <Stage2
                                                rankings={latestAssistant.stage2}
                                                labelToModel={latestAssistant.metadata?.label_to_model}
                                                aggregateRankings={latestAssistant.metadata?.aggregate_rankings}
                                            />
                                        ) : (
                                            !latestAssistant?.loading?.stage2 && (
                                                <div className="tab-empty">Stage 2 reviews are pending.</div>
                                            )
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>
        </div>
    );
}
