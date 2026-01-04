import { useNavigate } from 'react-router-dom';
import AvatarMenu from './AvatarMenu';
import CreditBalance from './CreditBalance';
import './Masthead.css';

/**
 * Shared Masthead component with variants:
 * - "full": Archive button + title + actions (ChatInterface, Account, DemoView)
 * - "centered": Just title/tagline, no controls (Login) - title not clickable
 * - "minimal": Title (clickable to home) + tagline (Legal, Payment pages)
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
    // Custom tagline
    tagline = 'Synthesized knowledge from AI experts',
    // Custom actions (for DemoView CTA button)
    children,
}) {
    const navigate = useNavigate();
    const handleOpenAccount = () => navigate('/account');
    const handleGoHome = () => navigate('/');

    if (variant === 'centered') {
        return (
            <header className="masthead masthead-centered">
                <div className="masthead-row">
                    <div className="masthead-spacer" />
                    <div className="masthead-center">
                        <h1 className="masthead-title">Quinthesis</h1>
                        <p className="masthead-tagline">{tagline}</p>
                    </div>
                    <div className="masthead-spacer" />
                </div>
            </header>
        );
    }

    if (variant === 'minimal') {
        return (
            <header className="masthead masthead-minimal">
                <div className="masthead-row">
                    <div className="masthead-spacer" />
                    <div className="masthead-center">
                        <h1 className="masthead-title masthead-title-link" onClick={handleGoHome} role="link" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && handleGoHome()}>
                            Quinthesis
                        </h1>
                        {tagline && <p className="masthead-tagline">{tagline}</p>}
                    </div>
                    <div className="masthead-actions">{children}</div>
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
                    <h1 className="masthead-title masthead-title-link" onClick={handleGoHome} role="link" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && handleGoHome()}>
                        Quinthesis
                    </h1>
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
