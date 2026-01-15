import { useState } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle, Check } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImportSuccess: () => void;
}

interface ParsedThread {
    content: string;
    scheduled_time: string;
    media_urls?: string;
    first_comment?: string;
}

export const ImportModal = ({ isOpen, onClose, onImportSuccess }: ImportModalProps) => {
    const { user } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<ParsedThread[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);

    if (!isOpen) return null;

    const processData = (data: any[]) => {
        // Simple mapping: look for keys regardless of case
        const mappedData: ParsedThread[] = data.map((row: any) => {
            // Find keys that match our expected columns (case-insensitive)
            const keys = Object.keys(row);
            const contentKey = keys.find(k => k.toLowerCase().includes('content')) || '';
            const timeKey = keys.find(k => k.toLowerCase().includes('time') || k.toLowerCase().includes('date') || k.toLowerCase().includes('schedule')) || '';
            const mediaKey = keys.find(k => k.toLowerCase().includes('media') || k.toLowerCase().includes('url')) || '';
            const commentKey = keys.find(k => k.toLowerCase().includes('comment')) || '';

            return {
                content: row[contentKey] || '',
                scheduled_time: row[timeKey] || '',
                media_urls: row[mediaKey] || '',
                first_comment: row[commentKey] || ''
            };
        }).filter(item => item.content && item.scheduled_time); // Filter invalid rows

        if (mappedData.length === 0) {
            setError('No valid rows found. Please ensure your file has "content" and "scheduled_time" columns.');
        } else {
            setPreviewData(mappedData);
            setError(null);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setError(null);
        setPreviewData([]);

        const fileExt = selectedFile.name.split('.').pop()?.toLowerCase();

        if (fileExt === 'csv') {
            Papa.parse(selectedFile, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    processData(results.data);
                },
                error: (err) => {
                    setError(`CSV Parsing Error: ${err.message}`);
                }
            });
        } else if (fileExt === 'xlsx' || fileExt === 'xls') {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);
                processData(data);
            };
            reader.readAsBinaryString(selectedFile);
        } else {
            setError('Unsupported file format. Please upload .csv or .xlsx');
        }
    };

    const handleImport = async () => {
        if (!user || previewData.length === 0) return;

        setImporting(true);
        try {
            const threadsToInsert = previewData.map(item => {
                // Parse scheduled time
                let scheduledTime = new Date(item.scheduled_time);
                if (isNaN(scheduledTime.getTime())) {
                    // Try to parse basic formats if auto-parse fails, or default to tomorrow
                    scheduledTime = new Date(Date.now() + 86400000);
                }

                // Parse media URLs
                // Assuming comma-separated
                let mediaUrls: string[] = [];
                if (item.media_urls) {
                    mediaUrls = item.media_urls.split(',').map(u => u.trim()).filter(u => u.length > 0);
                }

                return {
                    user_id: user.id,
                    content: item.content,
                    scheduled_time: scheduledTime.toISOString(),
                    media_urls: mediaUrls, // Supabase expects array? Check schema if needed, usually Postgres array is mapped from JS array
                    first_comment: item.first_comment || null,
                    status: 'scheduled'
                };
            });

            const { error: insertError } = await supabase
                .from('threads')
                .insert(threadsToInsert);

            if (insertError) throw insertError;

            onImportSuccess();
            onClose();
        } catch (err: any) {
            console.error('Import error:', err);
            setError(err.message || 'Failed to import threads.');
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col p-6 rounded-2xl border border-white/10 shadow-2xl bg-zinc-900/90">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <FileSpreadsheet className="text-purple-400" />
                            Bulk Import Threads
                        </h2>
                        <p className="text-sm text-zinc-400 mt-1">
                            Upload a CSV or Excel file to schedule multiple threads at once.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                        <X size={20} className="text-zinc-400" />
                    </button>
                </div>

                <div className="space-y-6">
                    {/* File Drop Zone */}
                    <div className="border-2 border-dashed border-zinc-700 hover:border-purple-500/50 rounded-xl p-8 transition-colors flex flex-col items-center justify-center text-center bg-zinc-900/50">
                        <Upload size={32} className="text-zinc-500 mb-3" />
                        <p className="text-zinc-300 font-medium mb-1">
                            {file ? file.name : "Click to upload or drag & drop"}
                        </p>
                        <p className="text-xs text-zinc-500">
                            .CSV or .XLSX (Columns: content, scheduled_time, media_urls, first_comment)
                        </p>
                        <input
                            type="file"
                            accept=".csv, .xlsx, .xls"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={handleFileChange}
                        />
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg text-sm flex items-start gap-2">
                            <AlertCircle size={16} className="mt-0.5 shrink-0" />
                            <div>{error}</div>
                        </div>
                    )}

                    {/* Preview Table */}
                    {previewData.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-medium text-zinc-300">
                                    Preview ({previewData.length} threads)
                                </h3>
                            </div>

                            <div className="glass rounded-lg overflow-hidden border border-white/5 max-h-[300px] overflow-y-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-white/5 text-zinc-400 font-medium sticky top-0 backdrop-blur-md">
                                        <tr>
                                            <th className="p-3">Content</th>
                                            <th className="p-3">Schedule</th>
                                            <th className="p-3">Media</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 text-zinc-300">
                                        {previewData.map((row, i) => (
                                            <tr key={i} className="hover:bg-white/5 transition-colors">
                                                <td className="p-3 max-w-[200px] truncate" title={row.content}>{row.content}</td>
                                                <td className="p-3 whitespace-nowrap">{row.scheduled_time}</td>
                                                <td className="p-3 max-w-[100px] truncate" title={row.media_urls}>{row.media_urls || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Example Template Info */}
                    {!previewData.length && !error && (
                        <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-4">
                            <h4 className="text-xs font-bold text-blue-400 mb-2 uppercase tracking-wider">Required Columns</h4>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                    <span className="text-zinc-300 font-mono bg-white/5 px-1 py-0.5 rounded">content</span>
                                    <span className="text-zinc-500 block mt-1">The text of the thread</span>
                                </div>
                                <div>
                                    <span className="text-zinc-300 font-mono bg-white/5 px-1 py-0.5 rounded">scheduled_time</span>
                                    <span className="text-zinc-500 block mt-1">ISO 8601 or YYYY-MM-DD HH:mm:ss</span>
                                </div>
                                <div>
                                    <span className="text-zinc-300 font-mono bg-white/5 px-1 py-0.5 rounded">media_urls</span>
                                    <span className="text-zinc-500 block mt-1">Comma-separated URLs (Optional)</span>
                                </div>
                                <div>
                                    <span className="text-zinc-300 font-mono bg-white/5 px-1 py-0.5 rounded">first_comment</span>
                                    <span className="text-zinc-500 block mt-1">First comment text (Optional)</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-8 flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-zinc-400 hover:text-white transition-colors text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={previewData.length === 0 || importing}
                        className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-lg shadow-purple-900/20"
                    >
                        {importing ? (
                            <>Importing...</>
                        ) : (
                            <>
                                <Check size={16} />
                                Import {previewData.length > 0 ? `${previewData.length} Threads` : ''}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
