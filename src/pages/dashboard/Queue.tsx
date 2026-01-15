import { useEffect, useState } from 'react';
import { Clock, MoreHorizontal, AlertCircle, Send, Loader2, Trash2, FileSpreadsheet } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { threadsApi } from '../../lib/threadsApi';
import { CreateThreadModal } from '../../components/CreateThreadModal';
import { ImportModal } from '../../components/ImportModal';
import '../../styles/Queue.css';

interface Thread {
    id: string;
    content: string;
    first_comment?: string | null;
    scheduled_time: string | null;
    status: 'draft' | 'scheduled' | 'published' | 'failed';
    created_at: string;
    media_urls?: string[] | null;
    error_message?: string | null;
}

export type { Thread }; // Export for CreateThreadModal

export const Queue = () => {
    const { user } = useAuth();
    const [threads, setThreads] = useState<Thread[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'scheduled' | 'draft' | 'published'>('scheduled');
    const [stats, setStats] = useState({ scheduled: 0, drafts: 0, published: 0 });
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingThread, setEditingThread] = useState<Thread | null>(null);

    // New state for publishing
    const [publishingId, setPublishingId] = useState<string | null>(null);
    const [threadsToken, setThreadsToken] = useState<string | null>(null);

    useEffect(() => {
        // Check for Threads Token
        const token = localStorage.getItem('threads_access_token');
        setThreadsToken(token);
    }, []);

    useEffect(() => {
        if (user) {
            fetchThreads();
            fetchStats();
        }
    }, [user, filter]);

    const fetchStats = async () => {
        const { data } = await supabase.from('threads').select('status');
        if (data) {
            const counts = data.reduce((acc: any, curr: any) => {
                if (curr.status === 'scheduled') acc.scheduled++;
                if (curr.status === 'draft') acc.drafts++;
                if (curr.status === 'published') acc.published++;
                return acc;
            }, { scheduled: 0, drafts: 0, published: 0 });
            setStats(counts);
        }
    };

    const fetchThreads = async () => {
        setLoading(true);
        let query = supabase
            .from('threads')
            .select('*')
            .order('created_at', { ascending: false });

        if (filter !== 'all') {
            if (filter === 'scheduled') query = query.eq('status', 'scheduled');
            if (filter === 'draft') query = query.eq('status', 'draft');
            if (filter === 'published') query = query.in('status', ['published', 'failed']);
        }

        const { data, error } = await query;

        if (error) {
            setError(error.message);
        } else {
            setThreads(data || []);
        }
        setLoading(false);
    };

    const [activeMenu, setActiveMenu] = useState<string | null>(null);

    const handleDelete = async (threadId: string) => {
        if (!confirm('Are you sure you want to delete this thread?')) return;

        try {
            const { error } = await supabase.from('threads').delete().eq('id', threadId);
            if (error) throw error;

            setThreads(prev => prev.filter(t => t.id !== threadId));
            fetchStats();
        } catch (err: any) {
            alert('Failed to delete thread: ' + err.message);
        }
    };

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setActiveMenu(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const handlePublishNow = async (thread: Thread) => {
        if (!threadsToken || !user) {
            alert('Please connect your Threads account in Settings first.');
            return;
        }

        if (!confirm('Are you sure you want to publish this thread to Threads right now?')) return;

        setPublishingId(thread.id);
        try {
            // 1. Publish to Threads
            // Ideally we should use the specialized Threads User ID, but for now we rely on the token identifying the user context
            // The API requires a user ID, we stored it in localStorage in AuthCallback
            const threadsUserId = localStorage.getItem('threads_user_id');

            if (!threadsUserId) {
                throw new Error('Threads User ID missing. Please reconnect in Settings.');
            }

            const mediaUrls = thread.media_urls || [];

            // postThread now handles Single/Carousel logic internally based on array length
            // We pass 'TEXT' as default mediaType, but if mediaUrls is present, postThread logic takes over.
            const publishedThreadId = await threadsApi.postThread(threadsToken, threadsUserId, thread.content, 'TEXT', mediaUrls);
            console.log('Main thread published:', publishedThreadId);

            // 1.5 Publish First Comment (if exists)
            if (thread.first_comment && publishedThreadId) {
                console.log('Publishing first comment...');
                await threadsApi.replyToThread(threadsToken, threadsUserId, publishedThreadId, thread.first_comment);
                console.log('First comment published!');
            }

            // 2. Update status in Supabase
            const { error: dbError } = await supabase
                .from('threads')
                .update({ status: 'published', scheduled_time: new Date().toISOString() })
                .eq('id', thread.id);

            if (dbError) throw dbError;

            // 3. Refresh UI
            alert('Thread published successfully! 🎉');
            fetchThreads();
            fetchStats();

        } catch (err: any) {
            console.error(err);
            alert(`Failed to publish: ${err.message}`);
        } finally {
            setPublishingId(null);
        }
    };

    return (
        <div className="queue-container">
            <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                <div className="glass-panel p-4 flex flex-col items-center justify-center">
                    <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#8b5cf6' }}>{stats.scheduled}</span>
                    <span style={{ color: '#a1a1aa', fontSize: '0.9rem' }}>Scheduled</span>
                </div>
                <div className="glass-panel p-4 flex flex-col items-center justify-center">
                    <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ffffff' }}>{stats.drafts}</span>
                    <span style={{ color: '#a1a1aa', fontSize: '0.9rem' }}>Drafts</span>
                </div>
                <div className="glass-panel p-4 flex flex-col items-center justify-center">
                    <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>{stats.published}</span>
                    <span style={{ color: '#a1a1aa', fontSize: '0.9rem' }}>Published</span>
                </div>
            </div>

            <div className="queue-header">
                <div className="header-left">
                    <h3>Upcoming Threads</h3>
                    <div className="tabs">
                        <button onClick={() => setFilter('scheduled')} className={`tab ${filter === 'scheduled' ? 'active' : ''}`}>Scheduled</button>
                        <button onClick={() => setFilter('draft')} className={`tab ${filter === 'draft' ? 'active' : ''}`}>Drafts</button>
                        <button onClick={() => setFilter('published')} className={`tab ${filter === 'published' ? 'active' : ''}`}>History</button>
                    </div>
                </div>
                <button
                    onClick={() => setIsImportModalOpen(true)}
                    className="btn-secondary"
                >
                    <FileSpreadsheet size={16} />
                    Import
                </button>
            </div>

            {!threadsToken && (
                <div className="mb-6 p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/10 text-yellow-200 flex items-center gap-3">
                    <AlertCircle size={20} />
                    <span>Threads not connected. Go to Settings to connect your account.</span>
                </div>
            )}

            {loading ? (
                <div className="p-8 text-center text-gray-500">Loading threads...</div>
            ) : error ? (
                <div className="glass-panel p-4 flex items-center gap-2 text-red-400">
                    <AlertCircle size={20} />
                    <span>Failed to load threads: {error}</span>
                </div>
            ) : threads.length === 0 ? (
                <div className="glass-panel p-8 text-center text-gray-500">
                    No threads found in this category.
                </div>
            ) : (
                <div className="thread-list">
                    {threads.map((thread) => (
                        <div key={thread.id} className="thread-card glass-panel">
                            {thread.media_urls && thread.media_urls.length > 0 && (
                                <div className="thread-media mb-3 flex gap-2 overflow-x-auto pb-2">
                                    {thread.media_urls.map((url, idx) => (
                                        <div key={idx} className="flex-shrink-0">
                                            {url.match(/\.(mp4|mov|avi|webm)($|\?)/i) ? (
                                                <video
                                                    src={url}
                                                    className="rounded-md border border-white/10"
                                                    style={{ height: '150px', width: 'auto' }}
                                                    controls
                                                />
                                            ) : (
                                                <img
                                                    src={url}
                                                    alt={`Attachment ${idx + 1}`}
                                                    className="rounded-md border border-white/10"
                                                    style={{ height: '150px', width: 'auto' }}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="thread-content">
                                <p>{thread.content}</p>
                            </div>
                            <div className="thread-meta">
                                <div className="meta-info">
                                    <Clock size={14} />
                                    <span>
                                        {thread.scheduled_time
                                            ? new Date(thread.scheduled_time).toLocaleString()
                                            : 'Unscheduled'}
                                    </span>
                                    <span className={`status-badge ${thread.status}`}>{thread.status}</span>
                                    {thread.status === 'failed' && thread.error_message && (
                                        <div className="mt-1 text-xs text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20">
                                            Error: {thread.error_message}
                                        </div>
                                    )}
                                </div>
                                <div className="actions flex items-center gap-2">
                                    {(thread.status === 'scheduled' || thread.status === 'draft') && (
                                        <button
                                            onClick={() => handlePublishNow(thread)}
                                            className="icon-btn text-blue-400 hover:text-blue-300"
                                            title="Post to Threads Now"
                                            disabled={!!publishingId}
                                        >
                                            {publishingId === thread.id ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                                        </button>
                                    )}
                                    <div style={{ position: 'relative' }}>
                                        <button
                                            className="icon-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveMenu(activeMenu === thread.id ? null : thread.id);
                                            }}
                                        >
                                            <MoreHorizontal size={16} />
                                        </button>

                                        {activeMenu === thread.id && (
                                            <div className="dropdown-menu">
                                                {thread.status !== 'published' && (
                                                    <button
                                                        className="dropdown-item"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingThread(thread);
                                                            setIsCreateModalOpen(true);
                                                            setActiveMenu(null);
                                                        }}
                                                    >
                                                        <FileSpreadsheet size={14} /> {/* Reusing icon, maybe change to Edit/Pencil later */}
                                                        Edit
                                                    </button>
                                                )}
                                                <button
                                                    className="dropdown-item danger"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(thread.id);
                                                    }}
                                                >
                                                    <Trash2 size={14} />
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </div>                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}


            {/* Create/Edit Thread Modal */}
            <CreateThreadModal
                isOpen={isCreateModalOpen || !!editingThread}
                onClose={() => {
                    setIsCreateModalOpen(false);
                    setEditingThread(null);
                }}
                onSuccess={() => {
                    fetchThreads();
                    fetchStats();
                    setIsCreateModalOpen(false);
                    setEditingThread(null);
                }}
                threadToEdit={editingThread}
            />

            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImportSuccess={() => {
                    fetchThreads();
                    fetchStats();
                }}
            />
        </div>
    );
};
