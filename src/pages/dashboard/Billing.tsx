import { Check } from 'lucide-react';

export const Billing = () => {
    return (
        <div>
            <h2 style={{ marginBottom: '2rem' }}>Billing & Plans</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
                {/* Free Plan */}
                <div className="glass-panel p-8 flex flex-col">
                    <h3 style={{ fontSize: '1.5rem' }}>Starter</h3>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '1rem 0' }}>$0<span style={{ fontSize: '1rem', color: '#a1a1aa', fontWeight: 'normal' }}>/mo</span></div>
                    <p style={{ color: '#a1a1aa', marginBottom: '2rem', flex: 1 }}>Perfect for getting started with thread scheduling.</p>

                    <ul style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                        <li className="flex items-center gap-2"><Check size={16} color="#8b5cf6" /> 5 Scheduled Threads</li>
                        <li className="flex items-center gap-2"><Check size={16} color="#8b5cf6" /> Basic Analytics</li>
                        <li className="flex items-center gap-2"><Check size={16} color="#8b5cf6" /> 7 Days History</li>
                    </ul>

                    <button className="glass btn-primary" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>Current Plan</button>
                </div>

                {/* Pro Plan */}
                <div className="glass-panel p-8 flex flex-col" style={{ borderColor: 'var(--primary-color)', boxShadow: '0 0 40px -10px rgba(139, 92, 246, 0.3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '1.5rem' }}>Pro</h3>
                        <span style={{ background: 'var(--primary-color)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>POPULAR</span>
                    </div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '1rem 0' }}>$12<span style={{ fontSize: '1rem', color: '#a1a1aa', fontWeight: 'normal' }}>/mo</span></div>
                    <p style={{ color: '#a1a1aa', marginBottom: '2rem', flex: 1 }}>For serious creators growing their audience.</p>

                    <ul style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                        <li className="flex items-center gap-2"><Check size={16} color="#ec4899" /> Unlimited Threads</li>
                        <li className="flex items-center gap-2"><Check size={16} color="#ec4899" /> Advanced Analytics</li>
                        <li className="flex items-center gap-2"><Check size={16} color="#ec4899" /> Auto-Retweet</li>
                        <li className="flex items-center gap-2"><Check size={16} color="#ec4899" /> Priority Support</li>
                    </ul>

                    <button className="btn-primary">Upgrade to Pro</button>
                </div>
            </div>
        </div>
    );
};
