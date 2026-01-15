import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import '../styles/Auth.css';

export const AuthCallback = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Authenticating with Threads...');

    useEffect(() => {
        const code = searchParams.get('code');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (code) {
            exchangeToken(code);
        } else if (error) {
            setStatus('error');
            setMessage(errorDescription || `Error: ${error}`);
        } else {
            setStatus('error');
            setMessage('No authorization code received.');
        }
    }, [searchParams]);

    const exchangeToken = async (code: string) => {
        try {
            // Call our backend serverless function
            const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://threads-scheduler-backend.onrender.com' : 'http://localhost:3000');
            const response = await fetch(`${API_URL}/exchange-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code,
                    redirect_uri: `${window.location.origin}/auth/callback`
                }),
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.error?.message || 'Failed to exchange token');
            }

            // Save tokens to Supabase
            // We use the current authenticated user's ID
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                throw new Error('User not authenticated');
            }

            const { error } = await supabase
                .from('user_tokens')
                .upsert({
                    user_id: user.id,
                    threads_access_token: data.access_token,
                    threads_user_id: data.user_id,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id, threads_user_id'
                });

            if (error) throw error;

            // Also keep in localStorage for immediate client-side use if needed (optional, but good for caching)
            localStorage.setItem('threads_access_token', data.access_token);
            localStorage.setItem('threads_user_id', data.user_id);

            setStatus('success');
            setMessage('Connected successfully! Redirecting...');

            setTimeout(() => {
                navigate('/dashboard/settings');
            }, 2000);

        } catch (err: any) {
            console.error(err);
            setStatus('error');
            setMessage(err.message || 'Authentication failed');
        }
    };

    return (
        <div className="auth-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <div className="glass-panel p-8 text-center flex flex-col items-center gap-4">
                {status === 'loading' && <Loader2 className="animate-spin text-blue-500" size={48} />}
                {status === 'success' && <CheckCircle className="text-green-500" size={48} />}
                {status === 'error' && <XCircle className="text-red-500" size={48} />}

                <h2 className="text-xl font-bold">Threads Connection</h2>
                <p className="text-gray-400">{message}</p>

                {status === 'error' && (
                    <button onClick={() => navigate('/dashboard/settings')} className="btn btn-secondary mt-4">
                        Return to Settings
                    </button>
                )}
            </div>
        </div>
    );
};
