import { useState, useRef } from 'react';
import { X, Calendar as CalendarIcon, Loader2, Image as ImageIcon, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import '../styles/Modal.css';

interface CreateThreadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const CreateThreadModal = ({ isOpen, onClose, onSuccess }: CreateThreadModalProps) => {
    const { user } = useAuth();
    const [content, setContent] = useState('');
    const [firstComment, setFirstComment] = useState('');
    const [showFirstComment, setShowFirstComment] = useState(false);
    const [scheduledTime, setScheduledTime] = useState('');
    const [mediaFiles, setMediaFiles] = useState<File[]>([]);
    const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);

            // Filter out unsupported types (specifically WebP)
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
                setMediaFiles(prev => [...prev, ...validFiles]);
                const newPreviews = validFiles.map(file => URL.createObjectURL(file));
                setMediaPreviews(prev => [...prev, ...newPreviews]);
            }
        }
    };

    const removeMedia = (index: number) => {
        setMediaFiles(prev => prev.filter((_, i) => i !== index));
        setMediaPreviews(prev => prev.filter((_, i) => i !== index));
    };

    const uploadMedia = async (file: File) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user?.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('thread-media')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('thread-media').getPublicUrl(filePath);
        return data.publicUrl;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() && mediaFiles.length === 0) return;

        setLoading(true);
        try {
            let mediaUrls: string[] = [];
            if (mediaFiles.length > 0) {
                // Upload all files in parallel
                mediaUrls = await Promise.all(mediaFiles.map(file => uploadMedia(file)));
            }

            const status = scheduledTime ? 'scheduled' : 'draft';

            console.log('DEBUG: Attempting to insert thread');
            console.log('DEBUG: User ID:', user?.id);
            const { data: sessionData } = await supabase.auth.getSession();
            console.log('DEBUG: Supabase Session User:', sessionData.session?.user?.id);

            const { error } = await supabase.from('threads').insert({
                user_id: user?.id,
                content,
                first_comment: firstComment.trim() || null,
                // Convert local input time to UTC ISO string before saving
                scheduled_time: scheduledTime ? new Date(scheduledTime).toISOString() : null,
                status,
                media_urls: mediaUrls.length > 0 ? mediaUrls : null
            });

            if (error) throw error;

            setContent('');
            setFirstComment('');
            setShowFirstComment(false);
            setScheduledTime('');
            setMediaFiles([]);
            setMediaPreviews([]);
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
                    <h3>New Thread</h3>
                    <button onClick={onClose} className="icon-btn"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <textarea
                            placeholder="What's new?"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            rows={5}
                            className="thread-input"
                            autoFocus
                        />
                        {mediaPreviews.length > 0 && (
                            <div className="media-preview-list flex gap-2 overflow-x-auto mt-2 pb-2">
                                {mediaPreviews.map((preview, index) => (
                                    <div key={index} className="relative flex-shrink-0" style={{ width: '150px' }}>
                                        {mediaFiles[index]?.type.startsWith('video/') ? (
                                            <video
                                                src={preview}
                                                className="rounded-lg border border-white/10"
                                                style={{ width: '150px', height: '150px', objectFit: 'cover', backgroundColor: '#000' }}
                                            />
                                        ) : (
                                            <img
                                                src={preview}
                                                alt={`Preview ${index}`}
                                                className="rounded-lg border border-white/10"
                                                style={{ width: '150px', height: '150px', objectFit: 'cover' }}
                                            />
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => removeMedia(index)}
                                            className="absolute top-1 right-1 bg-black/70 p-1 rounded-full text-white hover:bg-black/90 transition-colors"
                                        >
                                            <X size={12} />
                                        </button>
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

                        <button type="submit" className="btn-primary" disabled={loading || (!content.trim() && mediaFiles.length === 0)}>
                            {loading ? <Loader2 className="animate-spin" size={18} /> : (scheduledTime ? 'Schedule' : 'Save Draft')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
