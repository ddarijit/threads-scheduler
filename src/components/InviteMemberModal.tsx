import { useState } from 'react';
import { X, Mail, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface InviteMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    threadsUserId: string;
    accountNickname?: string;
    onInviteSent: () => void;
}

export const InviteMemberModal = ({ isOpen, onClose, threadsUserId, accountNickname, onInviteSent }: InviteMemberModalProps) => {
    const { user } = useAuth();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    if (!isOpen) return null;

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !user) return;

        setLoading(true);
        setError(null);

        try {
            // 1. Check if already invited
            const { data: existing } = await supabase
                .from('account_access')
                .select('id')
                .eq('threads_user_id', threadsUserId)
                .eq('invite_email', email)
                .single();

            if (existing) {
                throw new Error('This user has already been invited to this account.');
            }

            // 2. Create Invite Record
            // Note: In a real app, this might trigger a Supabase Edge Function to send an email.
            // For this MVP, we just create the record. usage: User B signs in, we match email.
            const { error: insertError } = await supabase
                .from('account_access')
                .insert({
                    owner_id: user.id,
                    threads_user_id: threadsUserId,
                    invite_email: email.toLowerCase().trim(),
                    status: 'pending' // pending until they login/accept
                });

            if (insertError) throw insertError;

            setSuccess(true);
            setTimeout(() => {
                onInviteSent();
                onClose();
                setSuccess(false);
                setEmail('');
            }, 1500);

        } catch (err: any) {
            console.error('Invite error:', err);
            setError(err.message || 'Failed to send invite');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#18181b] border border-white/10 rounded-xl w-full max-w-md p-6 shadow-2xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="mb-6">
                    <h2 className="text-xl font-bold text-white mb-2">Invite Team Member</h2>
                    <p className="text-sm text-gray-400">
                        Grant access to <span className="text-white font-medium">{accountNickname || 'this account'}</span>.
                        They will be able to schedule posts but cannot delete the account.
                    </p>
                </div>

                {success ? (
                    <div className="flex flex-col items-center justify-center py-8 text-green-400 animate-fade-in">
                        <CheckCircle size={48} className="mb-4" />
                        <p className="font-semibold">Invite Sent!</p>
                    </div>
                ) : (
                    <form onSubmit={handleInvite}>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="colleague@example.com"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 p-3 rounded-lg">
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-white text-black font-semibold py-2.5 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading && <Loader2 size={16} className="animate-spin" />}
                                {loading ? 'Sending...' : 'Send Invite'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};
