import { useState, useEffect } from 'react'; // Added useEffect
import { Database, Check, AlertCircle, XCircle, Users, Mail, Trash2 } from 'lucide-react'; // Added icons
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { InviteMemberModal } from '../../components/InviteMemberModal'; // Import Modal

export const Settings = () => {
    const { user } = useAuth();
    const [seeding, setSeeding] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [accounts, setAccounts] = useState<any[]>([]);
    const [teamMembers, setTeamMembers] = useState<any[]>([]); // Store all access rows
    const [loadingAccounts, setLoadingAccounts] = useState(true);

    const [inviteModalOpen, setInviteModalOpen] = useState(false);
    const [selectedAccountForInvite, setSelectedAccountForInvite] = useState<{ id: string, name: string } | null>(null);

    // Fetch accounts and team members on mount
    const fetchData = async () => {
        if (!user) return;
        setLoadingAccounts(true);

        // 1. Fetch My Accounts & Shared Accounts (RLS handles visibility)
        const { data: allAccounts } = await supabase.from('user_tokens').select('*');
        setAccounts(allAccounts || []);

        // 2. Fetch Team Members (OUTBOUND invites I sent)
        const { data: members } = await supabase
            .from('account_access')
            .select('*')
            .eq('owner_id', user.id);

        setTeamMembers(members || []);
        setLoadingAccounts(false);
    };

    useEffect(() => {
        fetchData();
    }, [user]);

    const handleOpenInvite = (threadsUserId: string, nickname: string) => {
        setSelectedAccountForInvite({ id: threadsUserId, name: nickname });
        setInviteModalOpen(true);
    };

    const handleRevokeAccess = async (accessId: string) => {
        if (!confirm('Are you sure you want to revoke access for this user?')) return;

        const { error } = await supabase.from('account_access').delete().eq('id', accessId);

        if (error) {
            setMessage({ type: 'error', text: 'Failed to revoke access' });
        } else {
            setTeamMembers(prev => prev.filter(m => m.id !== accessId));
            setMessage({ type: 'success', text: 'Access revoked' });
        }
    };

    const AccountList = () => {
        if (loadingAccounts) return <p className="text-sm text-gray-500 animate-pulse">Loading accounts...</p>;

        const myAccounts = accounts.filter(acc => acc.user_id === user?.id);
        const sharedAccounts = accounts.filter(acc => acc.user_id !== user?.id);

        if (accounts.length === 0) return (
            <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-center">
                <p className="text-sm text-gray-400">No accounts connected yet.</p>
            </div>
        );

        return (
            <div className="flex flex-col gap-8">
                {/* My Accounts */}
                <div>
                    <h4 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">My Accounts</h4>
                    {myAccounts.length === 0 ? <p className="text-sm text-gray-500 italic">You haven't connected any accounts.</p> : (
                        <div className="flex flex-col gap-4">
                            {myAccounts.map(acc => {
                                const members = teamMembers.filter(m => m.threads_user_id === acc.threads_user_id);

                                return (
                                    <div key={acc.threads_user_id} className="p-5 rounded-xl bg-white/5 border border-white/10 transition-all duration-200">
                                        {/* Account Header */}
                                        <div className="flex justify-between items-center mb-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-sm font-bold text-white shadow-inner flex-shrink-0">
                                                    {acc.threads_user_id ? acc.threads_user_id.substring(0, 2).toUpperCase() : '??'}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-semibold text-white">
                                                        {acc.nickname || `Threads User ${acc.threads_user_id.slice(0, 8)}`}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                                                        <span className="text-xs text-gray-400 font-medium">Connected (Owner)</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={async () => {
                                                    if (!confirm('Are you sure you want to disconnect this account?')) return;
                                                    await supabase.from('user_tokens').delete().match({ user_id: user?.id, threads_user_id: acc.threads_user_id });
                                                    setAccounts(prev => prev.filter(a => a.threads_user_id !== acc.threads_user_id));
                                                }}
                                                className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                title="Disconnect Account"
                                            >
                                                <XCircle size={20} />
                                            </button>
                                        </div>

                                        {/* Team Section */}
                                        <div className="mt-4 pt-4 border-t border-white/10">
                                            <div className="flex justify-between items-center mb-3">
                                                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                                    <Users size={12} />
                                                    Team Members
                                                </h4>
                                                <button
                                                    onClick={() => handleOpenInvite(acc.threads_user_id, acc.nickname)}
                                                    className="text-xs bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded transition-colors flex items-center gap-1"
                                                >
                                                    + Invite
                                                </button>
                                            </div>

                                            {members.length === 0 ? (
                                                <p className="text-xs text-gray-600 italic">No one else has access to this account.</p>
                                            ) : (
                                                <div className="flex flex-col gap-2">
                                                    {members.map(member => (
                                                        <div key={member.id} className="flex justify-between items-center bg-black/20 p-2 rounded border border-white/5">
                                                            <div className="flex items-center gap-2">
                                                                <Mail size={12} className="text-gray-500" />
                                                                <span className="text-sm text-gray-300">{member.invite_email}</span>
                                                                {member.status === 'pending' && (
                                                                    <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded">Pending</span>
                                                                )}
                                                                {member.status === 'active' && (
                                                                    <span className="text-[10px] bg-green-500/20 text-green-500 px-1.5 py-0.5 rounded">Active</span>
                                                                )}
                                                            </div>
                                                            <button
                                                                onClick={() => handleRevokeAccess(member.id)}
                                                                className="text-gray-500 hover:text-red-400 transition-colors p-1"
                                                                title="Revoke Access"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Shared Accounts */}
                {sharedAccounts.length > 0 && (
                    <div>
                        <h4 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Shared With Me</h4>
                        <div className="flex flex-col gap-4">
                            {sharedAccounts.map(acc => (
                                <div key={acc.threads_user_id} className="p-5 rounded-xl bg-white/5 border border-white/10 flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 flex items-center justify-center text-sm font-bold text-white shadow-inner flex-shrink-0">
                                            {acc.threads_user_id ? acc.threads_user_id.substring(0, 2).toUpperCase() : '??'}
                                        </div>
                                        <div>
                                            <div className="text-sm font-semibold text-white">
                                                {acc.nickname || `Threads User ${acc.threads_user_id.slice(0, 8)}`}
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></span>
                                                <span className="text-xs text-blue-400 font-medium">Team Access</span>
                                            </div>
                                        </div>
                                    </div>
                                    {/* No actions for shared accounts (can't delete/invite) */}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

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

                <div className="mb-6">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h3>Threads Connections</h3>
                            <p style={{ color: '#a1a1aa', fontSize: '0.9rem', marginTop: '4px' }}>
                                Manage your connected Threads accounts.
                            </p>
                        </div>
                        <button
                            onClick={handleConnectThreads}
                            className="btn btn-secondary text-xs"
                        >
                            + Connect New Account
                        </button>
                    </div>

                    <div className="flex flex-col gap-3">
                        <AccountList />
                    </div>
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

            <InviteMemberModal
                isOpen={inviteModalOpen}
                onClose={() => setInviteModalOpen(false)}
                threadsUserId={selectedAccountForInvite?.id || ''}
                accountNickname={selectedAccountForInvite?.name}
                onInviteSent={fetchData}
            />
        </div>
    );
};
