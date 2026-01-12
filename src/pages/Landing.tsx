import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle, Zap, Shield } from 'lucide-react';
import '../styles/Landing.css';

export const Landing = () => {
    const navigate = useNavigate();

    return (
        <div className="landing-page">
            <nav className="landing-nav glass">
                <div className="logo gradient-text">ThreadMaster</div>
                <div className="nav-links">
                    <button onClick={() => navigate('/login')} className="btn-text">Log in</button>
                    <button onClick={() => navigate('/signup')} className="btn-primary">Get Started</button>
                </div>
            </nav>

            <header className="hero-section">
                <div className="hero-content">
                    <h1 className="hero-title">
                        Master Your <span className="gradient-text">Threads</span> <br />
                        Strategy with AI
                    </h1>
                    <p className="hero-subtitle">
                        Schedule, analyze, and grow your audience with the most powerful formatting and scheduling tool content creators.
                    </p>
                    <div className="hero-cta">
                        <button onClick={() => navigate('/signup')} className="btn-primary btn-lg flex items-center gap-2">
                            Start for free <ArrowRight size={20} />
                        </button>
                        <span className="hero-note">No credit card required</span>
                    </div>
                </div>
                <div className="hero-visual glass-panel">
                    {/* Mock UI representation */}
                    <div className="mock-window-dots">
                        <span></span><span></span><span></span>
                    </div>
                    <div className="mock-ui-content">
                        <div className="mock-sidebar"></div>
                        <div className="mock-main">
                            <div className="mock-input-area"></div>
                            <div className="mock-post"></div>
                            <div className="mock-post"></div>
                        </div>
                    </div>
                </div>
            </header>

            <section className="features-section">
                <div className="feature-card glass-panel">
                    <Zap className="feature-icon" size={32} color="#8b5cf6" />
                    <h3>Smart Scheduling</h3>
                    <p>Auto-queue optimizes your posts for maximum engagement times.</p>
                </div>
                <div className="feature-card glass-panel">
                    <CheckCircle className="feature-icon" size={32} color="#ec4899" />
                    <h3>Thread Finisher</h3>
                    <p>Automatically number your threads and add a call-to-action.</p>
                </div>
                <div className="feature-card glass-panel">
                    <Shield className="feature-icon" size={32} color="#3b82f6" />
                    <h3>Analytics Safe</h3>
                    <p>Secure authentication and analytics that don't compromise your account.</p>
                </div>
            </section>
        </div>
    );
};
