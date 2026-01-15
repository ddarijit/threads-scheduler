import { useState, useRef, useEffect } from 'react';
import { X, Calendar as CalendarIcon, Loader2, Image as ImageIcon, MessageCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Thread } from '../pages/dashboard/Queue'; // Assuming Thread interface is exported or I will define a local partial one
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import '../styles/Modal.css';

interface CreateThreadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    threadToEdit?: Thread | null;
}

export const CreateThreadModal = ({ isOpen, onClose, onSuccess, threadToEdit }: CreateThreadModalProps) => {
    const { user } = useAuth();
    const [content, setContent] = useState('');
    const [firstComment, setFirstComment] = useState('');
    const [showFirstComment, setShowFirstComment] = useState(false);
    const [scheduledTime, setScheduledTime] = useState('');

    const [accounts, setAccounts] = useState<any[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<string>('');

    // Fetch accounts
    useEffect(() => {
        if (user) {
            supabase.from('user_tokens').select('*').eq('user_id', user.id)
                .then(({ data }) => {
                    const accs = data || [];
                    setAccounts(accs);
                    if (accs.length > 0 && !selectedAccount) {
                        // If editing, use the thread's account if possible, else default to first
                        if (threadToEdit && (threadToEdit as any).threads_user_id) {
                            setSelectedAccount((threadToEdit as any).threads_user_id);
                        } else if (localStorage.getItem('threads_user_id')) {
                            // Use last active or stored one
                            setSelectedAccount(localStorage.getItem('threads_user_id') || accs[0].threads_user_id);
                        } else {
                            setSelectedAccount(accs[0].threads_user_id);
                        }
                    }
                });
        }
    }, [user, threadToEdit]);

    // Media State
    // We need to handle both raw Files (new uploads) and string URLs (existing)
    // Actually simplicity: separate them? Or unified?
    // Unified approach: `mediaItems: { type: 'file' | 'url', data: File | string }[]`
    const [mediaItems, setMediaItems] = useState<{ type: 'file' | 'url', data: File | string, preview: string }[]>([]);

    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialize from threadToEdit
    useEffect(() => {
        if (isOpen) {
            if (threadToEdit) {
                setContent(threadToEdit.content || '');
                setFirstComment(threadToEdit.first_comment || '');
                setShowFirstComment(!!threadToEdit.first_comment);

                // ISO string to datetime-local format: YYYY-MM-DDTHH:mm
                if (threadToEdit.scheduled_time) {
                    const date = new Date(threadToEdit.scheduled_time);
                    const localIso = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                    setScheduledTime(localIso);
                } else {
                    setScheduledTime('');
                }

                if (threadToEdit.media_urls && Array.isArray(threadToEdit.media_urls)) {
                    setMediaItems(threadToEdit.media_urls.map((url: string) => ({
                        type: 'url',
                        data: url,
                        preview: url
                    })));
                } else {
                    setMediaItems([]);
                }
            } else {
                // Reset for new thread
                setContent('');
                setFirstComment('');
                setShowFirstComment(false);
                setScheduledTime('');
                setMediaItems([]);
            }
        }
    }, [isOpen, threadToEdit]);

    if (!isOpen) return null;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);

            // Filter out unsupported types
            const validFiles = newFiles.filter(file => {
                const isValid = file.type === 'image/jpeg' ||
                    file.type === 'image/png' ||
                    file.type.startsWith('video/');
                if (!isValid) {
                    alert(`Skipped ${file.name}: Only JPEG, PNG, and Video files are supported by Threads.`);
                }
                return isValid;
            });

            if (validFiles.length > 0) {
                const newItems = validFiles.map(file => ({
                    type: 'file' as const,
                    data: file,
                    preview: URL.createObjectURL(file)
                }));
                setMediaItems(prev => [...prev, ...newItems]);
            }
        }
    };

    const removeMedia = (index: number) => {
        setMediaItems(prev => prev.filter((_, i) => i !== index));
    };

    const moveMedia = (index: number, direction: 'left' | 'right') => {
        setMediaItems(prev => {
            const newItems = [...prev];
            if (direction === 'left' && index > 0) {
                [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
            } else if (direction === 'right' && index < newItems.length - 1) {
                [newItems[index + 1], newItems[index]] = [newItems[index], newItems[index + 1]];
            }
            return newItems;
        });
    };

    const uploadMedia = async (file: File) => {
        // 1. Get Presigned URL
        // FORCE Render URL in production to avoid Vercel env var overrides
        const API_URL = import.meta.env.PROD
            ? 'https://threads-scheduler-backend.onrender.com'
            : (import.meta.env.VITE_API_URL || 'http://localhost:3000');

        const response = await fetch(`${API_URL}/generate-upload-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileName: file.name,
                fileType: file.type,
                userId: user?.id
            })
        });

        if (!response.ok) {
            throw new Error('Failed to get upload URL');
        }

        const { uploadUrl, publicUrl } = await response.json();

        // 2. Upload to R2
        const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            body: file,
            headers: {
                'Content-Type': file.type
            }
        });

        if (!uploadResponse.ok) {
            throw new Error('Failed to upload file to storage');
        }

        return publicUrl;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() && mediaItems.length === 0) return;

        if (!selectedAccount && accounts.length > 0) {
            alert('Please select an account to post to.');
            return;
        }

        // Fallback for no accounts connected
        if (accounts.length === 0 && !selectedAccount) {
            alert('No connected Threads account found. Please connect in Settings.');
            return;
        }

        setLoading(true);
        try {
            let finalMediaUrls: string[] = [];

            // Process all media items
            // If it's a file, upload it. If it's a URL, keep it.
            if (mediaItems.length > 0) {
                finalMediaUrls = await Promise.all(mediaItems.map(async (item) => {
                    if (item.type === 'file') {
                        return await uploadMedia(item.data as File);
                    } else {
                        return item.data as string;
                    }
                }));
            }

            const status = scheduledTime ? 'scheduled' : 'draft';

            // Common payload
            const payload = {
                user_id: user?.id,
                content,
                first_comment: firstComment.trim() || null,
                scheduled_time: scheduledTime ? new Date(scheduledTime).toISOString() : null,
                status,
                media_urls: finalMediaUrls.length > 0 ? finalMediaUrls : null,
                threads_user_id: selectedAccount // NEW: Save the selected account
            };

            if (threadToEdit) {
                // UPDATE existing thread
                const { error } = await supabase
                    .from('threads')
                    .update(payload)
                    .eq('id', threadToEdit.id);
                if (error) throw error;
            } else {
                // INSERT new thread
                const { error } = await supabase
                    .from('threads')
                    .insert(payload);
                if (error) throw error;
            }



            setContent('');
            setFirstComment('');
            setShowFirstComment(false);
            setScheduledTime('');
            setMediaItems([]);
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error creating thread:', error);
            alert('Failed to create thread: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content glass-panel">
                <div className="modal-header">
                    <h3>{threadToEdit ? 'Edit Thread' : 'New Thread'}</h3>
                    <button onClick={onClose} className="icon-btn"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Account Selector */}
                    {accounts.length > 0 && (
                        <div className="form-group mb-3">
                            <label className="text-xs text-gray-400 mb-1 block">Post to</label>
                            <select
                                value={selectedAccount}
                                onChange={(e) => setSelectedAccount(e.target.value)}
                                className="glass-input text-sm p-2 w-full"
                            >
                                {accounts.map(acc => (
                                    <option key={acc.threads_user_id} value={acc.threads_user_id}>
                                        Threads User ({acc.threads_user_id.slice(0, 6)}...)
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="form-group">
                        <textarea
                            placeholder="What's new?"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            rows={5}
                            className="thread-input"
                            autoFocus
                        />
                        {mediaItems.length > 0 && (
                            <div className="media-preview-list flex gap-2 overflow-x-auto mt-2 pb-2">
                                {mediaItems.map((item, index) => (
                                    <div key={index} className="relative flex-shrink-0 group" style={{ width: '150px' }}>
                                        {/* Render Video or Image */}
                                        {(item.type === 'file' && (item.data as File).type.startsWith('video/')) || (item.type === 'url' && (item.data as string).match(/\.(mp4|mov|avi|webm)($|\?)/i)) ? (
                                            <video
                                                src={item.preview}
                                                className="rounded-lg border border-white/10"
                                                style={{ width: '150px', height: '150px', objectFit: 'cover', backgroundColor: '#000' }}
                                            />
                                        ) : (
                                            <img
                                                src={item.preview}
                                                alt={`Preview ${index}`}
                                                className="rounded-lg border border-white/10"
                                                style={{ width: '150px', height: '150px', objectFit: 'cover' }}
                                            />
                                        )}

                                        {/* Delete Button */}
                                        <button
                                            type="button"
                                            onClick={() => removeMedia(index)}
                                            className="absolute top-1 right-1 bg-black/70 p-1 rounded-full text-white hover:bg-red-500 transition-colors z-10"
                                        >
                                            <X size={12} />
                                        </button>

                                        {/* Reorder Controls */}
                                        {mediaItems.length > 1 && (
                                            <div className="absolute bottom-1 left-1 right-1 flex justify-between px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    type="button"
                                                    disabled={index === 0}
                                                    onClick={() => moveMedia(index, 'left')}
                                                    className="bg-black/70 p-1 rounded-full text-white hover:bg-purple-500 disabled:opacity-30 disabled:hover:bg-black/70"
                                                >
                                                    <ChevronLeft size={12} />
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={index === mediaItems.length - 1}
                                                    onClick={() => moveMedia(index, 'right')}
                                                    className="bg-black/70 p-1 rounded-full text-white hover:bg-purple-500 disabled:opacity-30 disabled:hover:bg-black/70"
                                                >
                                                    <ChevronRight size={12} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* First Comment Section */}
                    {showFirstComment ? (
                        <div className="form-group mt-2 border-l-2 border-white/10 pl-3">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-sm text-gray-400">First Comment</span>
                                <button type="button" onClick={() => setShowFirstComment(false)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                            </div>
                            <textarea
                                placeholder="Add to thread..."
                                value={firstComment}
                                onChange={(e) => setFirstComment(e.target.value)}
                                rows={2}
                                className="thread-input text-sm bg-white/5"
                            />
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setShowFirstComment(true)}
                            className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-2 mb-2"
                        >
                            <MessageCircle size={14} />
                            <span>Add First Comment / Thread</span>
                        </button>
                    )}

                    <div className="form-actions mt-4">
                        <div className="flex items-center gap-2">
                            <div className="date-picker-wrapper">
                                <CalendarIcon size={18} className="text-gray-400" />
                                <input
                                    type="datetime-local"
                                    value={scheduledTime}
                                    onChange={(e) => setScheduledTime(e.target.value)}
                                    className="date-input"
                                />
                            </div>
                            <button
                                type="button"
                                className="icon-btn"
                                onClick={() => fileInputRef.current?.click()}
                                title="Add Image or Video"
                            >
                                <ImageIcon size={18} className="text-gray-400 hover:text-white" />
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                accept="image/*,video/*"
                                multiple
                                style={{ display: 'none' }}
                            />
                        </div>

                        <button type="submit" className="btn-primary" disabled={loading || (!content.trim() && mediaItems.length === 0)}>
                            {loading ? <Loader2 className="animate-spin" size={18} /> : (scheduledTime ? (threadToEdit ? 'Update Schedule' : 'Schedule') : (threadToEdit ? 'Update Draft' : 'Save Draft'))}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
