import { useNavigate } from 'react-router-dom';
import AvatarMenu from './AvatarMenu';
import CreditBalance from './CreditBalance';
import './Masthead.css';

/**
 * Shared Masthead component with variants:
 * - "full": Archive button + title + actions (ChatInterface, Account, DemoView)
 * - "centered": Just title/tagline, no controls (Login)
 * - "minimal": Back link + title (Legal, Payment pages)
 */
export default function Masthead({
    variant = 'full',
    // Full variant props
    onToggleSidebar,
    isSidebarOpen,
    userEmail,
    userBalance,
    onLogout,
    onNewInquiry,
    showNewInquiry = false,
    // Minimal variant props
    backTo,
    backLabel = 'Back',
    onBack, // Custom back handler (takes precedence over backTo)
    // Custom tagline
    tagline = 'Synthesized knowledge from AI experts',
    // Custom actions (for DemoView CTA button)
    children,
}) {
    const navigate = useNavigate();
    const handleOpenAccount = () => navigate('/account');
    const handleBack = onBack || (() => navigate(backTo || '/'));

    if (variant === 'centered') {
        return (
            <header className="masthead masthead-centered">
                <div className="masthead-row">
                    <div className="masthead-center">
                        <h1 className="masthead-title">The AI Council</h1>
                        <p className="masthead-tagline">{tagline}</p>
                    </div>
                </div>
            </header>
        );
    }

    if (variant === 'minimal') {
        const showBackButton = Boolean(backTo || onBack);
        return (
            <header className="masthead masthead-minimal">
                <div className="masthead-row">
                    {showBackButton ? (
                        <button
                            type="button"
                            className="masthead-back-btn"
                            onClick={handleBack}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="19" y1="12" x2="5" y2="12"></line>
                                <polyline points="12 19 5 12 12 5"></polyline>
                            </svg>
                            <span className="masthead-back-label">{backLabel}</span>
                        </button>
                    ) : (
                        <div className="masthead-spacer"></div>
                    )}
                    <div className="masthead-center">
                        <h1 className="masthead-title">The AI Council</h1>
                        {tagline && <p className="masthead-tagline">{tagline}</p>}
                    </div>
                    {children ? (
                        <div className="masthead-actions">{children}</div>
                    ) : (
                        <div className="masthead-spacer"></div>
                    )}
                </div>
            </header>
        );
    }

    // Default: full variant
    const hasArchive = Boolean(onToggleSidebar);
    const hasUserControls = Boolean(userEmail || userBalance !== undefined);

    return (
        <header className="masthead">
            <div className="masthead-row">
                {hasArchive ? (
                    <button
                        type="button"
                        className="sidebar-toggle"
                        onClick={onToggleSidebar}
                        aria-label="Open archive (Ctrl+K)"
                        aria-expanded={isSidebarOpen}
                        aria-controls="sidebar"
                        title="Open archive (Ctrl+K)"
                    >
                        Archive
                    </button>
                ) : (
                    <div className="masthead-spacer"></div>
                )}
                <div className="masthead-center">
                    <h1 className="masthead-title">The AI Council</h1>
                    <p className="masthead-tagline">{tagline}</p>
                </div>
                <div className="masthead-actions">
                    {showNewInquiry && onNewInquiry && (
                        <button
                            type="button"
                            className="masthead-btn masthead-btn-new"
                            onClick={onNewInquiry}
                            title="New Inquiry (Ctrl+N)"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            <span className="masthead-btn-label">New Inquiry</span>
                        </button>
                    )}
                    {children}
                    {userBalance !== undefined && (
                        <CreditBalance balance={userBalance} onClick={handleOpenAccount} />
                    )}
                    {userEmail && (
                        <AvatarMenu
                            userEmail={userEmail}
                            onLogout={onLogout}
                        />
                    )}
                    {!hasArchive && !hasUserControls && !children && (
                        <div className="masthead-spacer"></div>
                    )}
                </div>
            </div>
        </header>
    );
}
