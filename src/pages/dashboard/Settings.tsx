import { useState } from 'react';
import { Database, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { threadsApi } from '../../lib/threadsApi';
import { useAuth } from '../../contexts/AuthContext';

export const Settings = () => {
    const { user } = useAuth();
    const [seeding, setSeeding] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleSeedData = async () => {
        if (!user) return;
        setSeeding(true);
        setMessage(null);

        const dummyData = [
            {
                user_id: user.id,
                content: 'Just launched my new project! 🚀 #coding #indiehackers',
                status: 'scheduled',
                scheduled_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
            },
            {
                user_id: user.id,
                content: 'Drafting some ideas for next week... \n\n1. React Tips\n2. CSS Tricks\n3. Vite Configs',
                status: 'draft',
                scheduled_time: null,
            },
            {
                user_id: user.id,
                content: 'This is a published thread history item properly stored in Supabase.',
                status: 'published',
                scheduled_time: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
            },
            {
                user_id: user.id,
                content: 'Another scheduled post for the upcoming campaign.',
                status: 'scheduled',
                scheduled_time: new Date(Date.now() + 172800000).toISOString(), // 2 days later
            }
        ];

        const { error } = await supabase.from('threads').insert(dummyData);

        if (error) {
            setMessage({ type: 'error', text: `Failed to insert data: ${error.message}` });
        } else {
            setMessage({ type: 'success', text: 'Dummy data inserted successfully! Check the Queue.' });
        }
        setSeeding(false);
    };

    const handleConnectThreads = () => {
        const appId = import.meta.env.VITE_THREADS_APP_ID;
        // Use current origin to automatically support both localhost and production
        const redirectUri = `${window.location.origin}/auth/callback`;
        // const redirectUri = import.meta.env.VITE_THREADS_REDIRECT_URI;
        const scope = 'threads_basic,threads_content_publish,threads_manage_replies';

        // Validation
        if (!appId || !redirectUri) {
            setMessage({ type: 'error', text: 'Missing Environment Variables used for Auth flow.' });
            return;
        }

        window.location.href = `https://threads.net/oauth/authorize?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`;
    };

    return (
        <div style={{ maxWidth: '600px' }}>
            <h2 style={{ marginBottom: '2rem' }}>Settings</h2>

            <div className="glass-panel p-8 flex-col gap-4 flex">

                {/* Threads Connection Section */}
                <div className="mb-6">
                    <h3>Threads Connection</h3>
                    <p style={{ color: '#a1a1aa', fontSize: '0.9rem', marginTop: '4px', marginBottom: '1rem' }}>
                        Connect your Threads account to start scheduling posts.
                    </p>

                    {localStorage.getItem('threads_access_token') ? (
                        <div className="flex items-center gap-4">
                            <div className="glass px-4 py-2 rounded-lg flex items-center gap-2 text-green-400 bg-green-500/10 border border-green-500/20">
                                <Check size={18} />
                                <span>Connected as {localStorage.getItem('threads_user_id')}</span>
                            </div>
                            <button
                                onClick={() => {
                                    localStorage.removeItem('threads_access_token');
                                    localStorage.removeItem('threads_user_id');
                                    window.location.reload();
                                }}
                                className="text-sm text-red-400 hover:text-red-300"
                            >
                                Disconnect
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={handleConnectThreads}
                            className="glass"
                            style={{
                                padding: '10px 16px',
                                borderRadius: '8px',
                                background: '#000',
                                border: '1px solid #333',
                                color: '#fff',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                            }}
                        >
                            Connect Threads Account
                        </button>
                    )}

                    {localStorage.getItem('threads_access_token') && (
                        <button
                            onClick={async () => {
                                setVerifying(true);
                                try {
                                    setMessage(null);
                                    const token = localStorage.getItem('threads_access_token');
                                    if (!token) throw new Error('No token found');

                                    const profile = await threadsApi.getUserProfile(token);

                                    const storedId = localStorage.getItem('threads_user_id');

                                    if (profile.id !== storedId) {
                                        const msg = `ID Mismatch! Token is for ${profile.id}, but stored ID is ${storedId}. Please Disconnect & Reconnect.`;
                                        setMessage({ type: 'error', text: msg });
                                        alert(msg);
                                    } else {
                                        const msg = `Connection Verified! Logged in as @${profile.username} (${profile.id})`;
                                        setMessage({ type: 'success', text: msg });
                                        alert(msg);
                                    }
                                } catch (e: any) {
                                    console.error(e);
                                    const errMsg = `Verification Failed: ${e.message || JSON.stringify(e)}`;
                                    setMessage({ type: 'error', text: errMsg });
                                    alert(errMsg);
                                } finally {
                                    setVerifying(false);
                                }
                            }}
                            disabled={verifying}
                            className="mt-4 text-xs text-gray-400 hover:text-white underline"
                        >
                            {verifying ? 'Verifying...' : 'Verify Connection Debug'}
                        </button>
                    )}
                    <div className="divider" style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '1.5rem 0' }}></div>
                </div>


                <div>
                    <h3>Profile Information</h3>
                    <p style={{ color: '#a1a1aa', fontSize: '0.9rem', marginTop: '4px' }}>Update your account details and profile.</p>
                </div>

                <div className="flex-col gap-2 flex" style={{ marginTop: '1rem' }}>
                    <label style={{ fontSize: '0.9rem' }}>Email Address</label>
                    <input type="email" className="glass-input" defaultValue={user?.email || ''} disabled />
                </div>

                <div className="divider" style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '1rem 0' }}></div>

                <div>
                    <h3>Developer Tools</h3>
                    <p style={{ color: '#a1a1aa', fontSize: '0.9rem', marginTop: '4px' }}>Utilities for testing the application.</p>
                </div>

                <button
                    onClick={handleSeedData}
                    disabled={seeding}
                    className="glass"
                    style={{
                        padding: '10px 16px',
                        borderRadius: '8px',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        color: '#ddd',
                        cursor: seeding ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: 'fit-content'
                    }}
                >
                    <Database size={16} />
                    {seeding ? 'Inserting...' : 'Generate Dummy Data'}
                </button>

                {message && (
                    <div style={{
                        padding: '10px',
                        borderRadius: '8px',
                        background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: message.type === 'success' ? '#34d399' : '#ef4444',
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        {message.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                        {message.text}
                    </div>
                )}

            </div>
        </div>
    );
};
