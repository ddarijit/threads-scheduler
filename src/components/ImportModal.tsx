import { useState } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle, Check, Download } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import './ImportModal.css';

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
        const mappedData: ParsedThread[] = data.map((row: any) => {
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
        }).filter(item => item.content && item.scheduled_time);

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
                let scheduledTime = new Date(item.scheduled_time);
                if (isNaN(scheduledTime.getTime())) {
                    scheduledTime = new Date(Date.now() + 86400000);
                }

                let mediaUrls: string[] = [];
                if (item.media_urls) {
                    mediaUrls = item.media_urls.split(',').map(u => u.trim()).filter(u => u.length > 0);
                }

                return {
                    user_id: user.id,
                    content: item.content,
                    scheduled_time: scheduledTime.toISOString(),
                    media_urls: mediaUrls,
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
        <div className="modal-overlay">
            <div className="modal-content glass-panel">
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">
                            <FileSpreadsheet className="text-purple-400" size={24} color="#a78bfa" />
                            Bulk Import Threads
                        </h2>
                        <p className="modal-subtitle">
                            Upload a CSV or Excel file to schedule multiple threads at once.
                        </p>
                    </div>
                    <button onClick={onClose} className="close-btn">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-col gap-4 flex">
                    {/* File Drop Zone */}
                    <div className="drop-zone">
                        <Upload size={32} color="#71717a" style={{ marginBottom: '12px' }} />
                        <p style={{ color: '#d4d4d8', fontWeight: 500, marginBottom: '4px' }}>
                            {file ? file.name : "Click to upload or drag & drop"}
                        </p>
                        <p style={{ fontSize: '12px', color: '#71717a' }}>
                            .CSV or .XLSX (Columns: content, scheduled_time, media_urls, first_comment)
                        </p>
                        <input
                            type="file"
                            accept=".csv, .xlsx, .xls"
                            className="file-input"
                            onChange={handleFileChange}
                        />
                    </div>

                    <div className="flex justify-center gap-4 text-sm" style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '-0.5rem' }}>
                        <a href="/templates/template.csv" download className="text-purple-400 hover:text-purple-300 flex items-center gap-1" style={{ color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                            <Download size={14} /> Download CSV Template
                        </a>
                        <span className="text-zinc-600" style={{ color: '#52525b' }}>|</span>
                        <a href="/templates/template.xlsx" download className="text-purple-400 hover:text-purple-300 flex items-center gap-1" style={{ color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                            <Download size={14} /> Download Excel Template
                        </a>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="error-message">
                            <AlertCircle size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
                            <div>{error}</div>
                        </div>
                    )}

                    {/* Preview Table */}
                    {previewData.length > 0 && (
                        <div className="preview-section">
                            <div className="preview-title">
                                Preview ({previewData.length} threads)
                            </div>

                            <div className="table-container">
                                <table className="preview-table">
                                    <thead>
                                        <tr>
                                            <th>Content</th>
                                            <th>Schedule</th>
                                            <th>Media</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewData.map((row, i) => (
                                            <tr key={i}>
                                                <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.content}>{row.content}</td>
                                                <td style={{ whiteSpace: 'nowrap' }}>{row.scheduled_time}</td>
                                                <td style={{ maxWidth: '100px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.media_urls}>{row.media_urls || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Example Template Info */}
                    {!previewData.length && !error && (
                        <div className="info-box">
                            <h4 className="info-title">Required Columns</h4>
                            <div className="info-grid">
                                <div>
                                    <span className="info-tag">content</span>
                                    <span className="info-desc">The text of the thread</span>
                                </div>
                                <div>
                                    <span className="info-tag">scheduled_time</span>
                                    <span className="info-desc">ISO 8601 or YYYY-MM-DD HH:mm:ss</span>
                                </div>
                                <div>
                                    <span className="info-tag">media_urls</span>
                                    <span className="info-desc">Comma-separated URLs</span>
                                </div>
                                <div>
                                    <span className="info-tag">first_comment</span>
                                    <span className="info-desc">First comment text</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-actions">
                    <button
                        onClick={onClose}
                        className="btn-cancel"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={previewData.length === 0 || importing}
                        className="btn-import"
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
