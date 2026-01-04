import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import Stage1 from './Stage1';
import Stage2 from './Stage2';
import Stage3 from './Stage3';
import Masthead from './Masthead';
import demos from '../demoData/demos.json';
import './DemoView.css';

export default function DemoView() {
    const navigate = useNavigate();
    const [selectedDemoId, setSelectedDemoId] = useState(null);
    const [activeTab, setActiveTab] = useState('final');
    const questionRef = useRef(null);

    const selectedDemo = demos.demos.find(d => d.id === selectedDemoId);

    // Focus management: move focus to question when demo is selected
    useEffect(() => {
        if (selectedDemo && questionRef.current) {
            questionRef.current.focus();
        }
    }, [selectedDemo]);

    // SEO meta tags for social sharing
    useEffect(() => {
        const originalTitle = document.title;
        document.title = 'Example Deliberations | Quinthesis';

        // Set Open Graph meta tags
        const setMetaTag = (property, content) => {
            let meta = document.querySelector(`meta[property="${property}"]`);
            if (!meta) {
                meta = document.createElement('meta');
                meta.setAttribute('property', property);
                document.head.appendChild(meta);
            }
            meta.setAttribute('content', content);
        };

        setMetaTag('og:title', 'Quinthesis - Example Deliberations');
        setMetaTag('og:description', 'See how multiple AI models collaborate to answer complex questions through structured deliberation.');
        setMetaTag('og:type', 'website');

        return () => {
            document.title = originalTitle;
        };
    }, []);

    // Transform demo data to match Stage component expectations
    const getStage1Data = (demo) => {
        return demo.stage1.map(item => ({
            role: 'councilor',
            response: item.response,
            model: item.model
        }));
    };

    const getStage2Data = (demo) => {
        return demo.stage2.map(item => ({
            model: item.model,
            ranking: item.ranking,
            parsed_ranking: item.parsed_ranking
        }));
    };

    const getStage3Data = (demo) => {
        return {
            role: 'chairman',
            response: demo.stage3.response,
            model: demo.stage3.model
        };
    };

    const handleSelectDemo = (demoId) => {
        setSelectedDemoId(demoId);
        setActiveTab('final');
    };

    const handleBack = () => {
        setSelectedDemoId(null);
    };

    const handleSignUp = () => {
        navigate('/');
    };

    // Sign Up CTA button component
    const SignUpButton = ({ large = false }) => (
        <button
            type="button"
            className={`demo-cta-btn ${large ? 'demo-cta-large' : ''}`}
            onClick={handleSignUp}
        >
            Sign Up
        </button>
    );

    // Error handling: invalid demo ID selected
    if (selectedDemoId && !selectedDemo) {
        return (
            <div className="demo-view">
                <Masthead variant="centered" />
                <div className="demo-content">
                    <div className="demo-error">
                        <h2>Demo Not Found</h2>
                        <p>The requested demo could not be found.</p>
                        <button
                            type="button"
                            className="demo-cta-btn"
                            onClick={handleBack}
                        >
                            View All Examples
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Demo list view
    if (!selectedDemo) {
        return (
            <div className="demo-view">
                <Masthead variant="full">
                    <SignUpButton />
                </Masthead>

                <div className="demo-content">
                    <div className="demo-intro">
                        <h2>Example Deliberations</h2>
                        <p>
                            Quinthesis gathers responses from multiple AI models, has them review each other's answers,
                            then synthesizes a comprehensive final answer. Click any example below to see the full deliberation process.
                        </p>
                    </div>

                    <div className="demo-grid">
                        {demos.demos.map(demo => (
                            <button
                                key={demo.id}
                                type="button"
                                className="demo-card"
                                onClick={() => handleSelectDemo(demo.id)}
                            >
                                <div className="demo-card-question">
                                    {demo.question}
                                </div>
                                <div className="demo-card-meta">
                                    <span className="demo-card-models">
                                        {demo.models.length} models
                                    </span>
                                    <span className="demo-card-arrow">View deliberation</span>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="demo-footer">
                        <p>Ready to ask your own questions?</p>
                        <button
                            type="button"
                            className="demo-cta-btn demo-cta-large"
                            onClick={handleSignUp}
                        >
                            Get Started
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Demo detail view
    return (
        <div className="demo-view">
            <Masthead variant="minimal">
                <button
                    type="button"
                    className="demo-view-all-btn"
                    onClick={handleBack}
                >
                    View All
                </button>
                <SignUpButton />
            </Masthead>

            <div className="demo-question-panel">
                <div className="panel-inner">
                    <div className="demo-question-display">
                        <div
                            ref={questionRef}
                            tabIndex="-1"
                            className="demo-question-text"
                        >
                            <div className="markdown-content">
                                <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                                    {selectedDemo.question}
                                </ReactMarkdown>
                            </div>
                        </div>
                        <div className="demo-question-meta">
                            <span className="demo-status">Example</span>
                            <span className="demo-models-used">
                                {selectedDemo.models.length} models consulted
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="response-tabs-bar">
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
            </div>

            <div className="demo-scroll">
                <div className="response-panel reveal-stagger">
                    <div className="panel-inner">
                        <div className="response-tab-panels">
                            {activeTab === 'final' && (
                                <div className="response-tab-panel" role="tabpanel">
                                    <Stage3 finalResponse={getStage3Data(selectedDemo)} />
                                </div>
                            )}

                            {activeTab === 'stage1' && (
                                <div className="response-tab-panel" role="tabpanel">
                                    <Stage1 responses={getStage1Data(selectedDemo)} />
                                </div>
                            )}

                            {activeTab === 'stage2' && (
                                <div className="response-tab-panel" role="tabpanel">
                                    <Stage2
                                        rankings={getStage2Data(selectedDemo)}
                                        labelToModel={selectedDemo.metadata.label_to_model}
                                        aggregateRankings={selectedDemo.metadata.aggregate_rankings}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="demo-cta-footer">
                    <div className="demo-cta-content">
                        <p>Want to ask your own questions and get answers from multiple AI models?</p>
                        <button
                            type="button"
                            className="demo-cta-btn demo-cta-large"
                            onClick={handleSignUp}
                        >
                            Sign Up to Get Started
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
