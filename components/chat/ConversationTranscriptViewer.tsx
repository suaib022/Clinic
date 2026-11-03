'use client';

import React, { useState, useMemo } from 'react';
import {
    Search,
    Filter,
    Copy,
    Check,
    RefreshCw,
    Code,
    MessageSquare,
    User,
    Bot,
    FileText,
    Image as ImageIcon,
    ExternalLink,
    Download,
    ChevronDown,
    ChevronUp,
    Paperclip
} from 'lucide-react';

export interface TranscriptTurn {
    role: 'user' | 'agent' | 'system';
    speaker?: string;
    message: string;
    timestamp?: string;
    attachments?: {
        name: string;
        type: string;
        url?: string;
        size?: number;
    }[];
}

export interface EvidenceItem {
    id: string;
    filename: string;
    file_type?: string;
    storage_path?: string;
    public_url?: string;
    signed_url?: string;
    file_size?: number;
}

interface ConversationTranscriptViewerProps {
    conversationId: string;
    triageRef?: string;
    transcript: TranscriptTurn[];
    evidence?: EvidenceItem[];
    onSyncSession?: () => Promise<void>;
    isSyncing?: boolean;
}

export default function ConversationTranscriptViewer({
    conversationId,
    triageRef,
    transcript = [],
    evidence = [],
    onSyncSession,
    isSyncing = false
}: ConversationTranscriptViewerProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [speakerFilter, setSpeakerFilter] = useState<'all' | 'user' | 'agent'>('all');
    const [viewMode, setViewMode] = useState<'bubbles' | 'raw'>('bubbles');
    const [copiedConvId, setCopiedConvId] = useState(false);
    const [evidenceOpen, setEvidenceOpen] = useState(true);
    const [previewEvidence, setPreviewEvidence] = useState<EvidenceItem | null>(null);

    const handleCopyConvId = () => {
        if (!navigator.clipboard) return;
        navigator.clipboard.writeText(conversationId);
        setCopiedConvId(true);
        setTimeout(() => setCopiedConvId(false), 2000);
    };

    // Filtered and searched turns
    const filteredTurns = useMemo(() => {
        return transcript.filter(turn => {
            if (speakerFilter !== 'all' && turn.role !== speakerFilter) {
                return false;
            }
            if (searchQuery.trim()) {
                return turn.message.toLowerCase().includes(searchQuery.toLowerCase());
            }
            return true;
        });
    }, [transcript, speakerFilter, searchQuery]);

    // Raw script text
    const rawScript = useMemo(() => {
        return transcript
            .map(t => {
                const speaker = t.role === 'user' ? 'Patient' : t.role === 'agent' ? 'Aura (AI)' : 'System';
                return `[${speaker}]: ${t.message}`;
            })
            .join('\n\n');
    }, [transcript]);

    // Highlighting matching search terms with <mark>
    const renderHighlightedText = (text: string) => {
        if (!searchQuery.trim()) return text;
        const regex = new RegExp(`(${searchQuery.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
        const parts = text.split(regex);
        return parts.map((part, i) =>
            regex.test(part) ? (
                <mark key={i} className="bg-amber-200 text-amber-900 rounded-xs px-0.5 font-semibold">
                    {part}
                </mark>
            ) : (
                part
            )
        );
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs font-sans">
            {/* Top Toolbar */}
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
                {/* Conversation Meta */}
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Conversation ID:
                    </span>
                    <button
                        type="button"
                        onClick={handleCopyConvId}
                        className="btn btn-sm btn-light border py-1 px-2.5 text-xs font-mono font-bold d-inline-flex align-items-center gap-1.5 text-gray-700 hover:bg-gray-100"
                        title="Click to copy full Conversation ID"
                    >
                        {copiedConvId ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                        <span>{conversationId || 'No Session Active'}</span>
                    </button>
                    {triageRef && (
                        <span className="badge bg-teal-100 text-teal-800 font-mono text-xs px-2 py-1">
                            {triageRef}
                        </span>
                    )}
                </div>

                {/* Right Actions: View Mode & Sync */}
                <div className="flex items-center gap-2">
                    {/* View mode toggle */}
                    <div className="btn-group btn-group-sm" role="group">
                        <button
                            type="button"
                            onClick={() => setViewMode('bubbles')}
                            className={`btn btn-sm py-1 px-2.5 ${
                                viewMode === 'bubbles' ? 'btn-primary text-white' : 'btn-outline-secondary'
                            }`}
                            style={viewMode === 'bubbles' ? { backgroundColor: '#0D7D72', borderColor: '#0D7D72' } : {}}
                            title="Chat Bubble View"
                        >
                            <MessageSquare size={14} className="me-1 inline" />
                            Chat
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('raw')}
                            className={`btn btn-sm py-1 px-2.5 ${
                                viewMode === 'raw' ? 'btn-primary text-white' : 'btn-outline-secondary'
                            }`}
                            style={viewMode === 'raw' ? { backgroundColor: '#0D7D72', borderColor: '#0D7D72' } : {}}
                            title="Raw Script View"
                        >
                            <Code size={14} className="me-1 inline" />
                            Raw
                        </button>
                    </div>

                    {/* Manual Sync Button */}
                    {onSyncSession && (
                        <button
                            type="button"
                            onClick={onSyncSession}
                            disabled={isSyncing}
                            className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1 py-1 px-2.5 text-xs font-semibold"
                            style={{ borderColor: '#0D7D72', color: '#0D7D72' }}
                            title="Sync session transcripts and attachments from ElevenLabs"
                        >
                            <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                            <span>{isSyncing ? 'Syncing...' : 'Sync Session'}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="p-3 border-b border-gray-100 bg-white flex flex-wrap items-center justify-between gap-2.5">
                {/* Search with input highlighting */}
                <div className="relative flex-grow max-w-sm">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search transcript by keyword..."
                        className="w-full text-xs py-1.5 pl-8 pr-3 border border-gray-300 rounded-lg focus:outline-hidden focus:border-teal-700"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Speaker Filter Pills */}
                <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-gray-400 flex items-center gap-1">
                        <Filter size={12} /> Speaker:
                    </span>
                    <button
                        type="button"
                        onClick={() => setSpeakerFilter('all')}
                        className={`px-2.5 py-1 rounded-full font-medium transition ${
                            speakerFilter === 'all'
                                ? 'bg-teal-700 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        style={speakerFilter === 'all' ? { backgroundColor: '#0D7D72' } : {}}
                    >
                        All ({transcript.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setSpeakerFilter('user')}
                        className={`px-2.5 py-1 rounded-full font-medium transition ${
                            speakerFilter === 'user'
                                ? 'bg-teal-700 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        style={speakerFilter === 'user' ? { backgroundColor: '#0D7D72' } : {}}
                    >
                        Patient
                    </button>
                    <button
                        type="button"
                        onClick={() => setSpeakerFilter('agent')}
                        className={`px-2.5 py-1 rounded-full font-medium transition ${
                            speakerFilter === 'agent'
                                ? 'bg-teal-700 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        style={speakerFilter === 'agent' ? { backgroundColor: '#0D7D72' } : {}}
                    >
                        Aura (AI)
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="p-4 max-h-[460px] overflow-y-auto">
                {viewMode === 'raw' ? (
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs whitespace-pre-wrap leading-relaxed select-text">
                        {rawScript || 'No transcript turns recorded for this conversation.'}
                    </div>
                ) : (
                    <div className="space-y-3.5">
                        {filteredTurns.length === 0 ? (
                            <div className="text-center py-8 text-gray-400 text-sm">
                                {searchQuery ? 'No transcript turns matched your search.' : 'No transcript recorded yet.'}
                            </div>
                        ) : (
                            filteredTurns.map((turn, i) => {
                                const isUser = turn.role === 'user';
                                const isAgent = turn.role === 'agent';

                                return (
                                    <div key={i} className={`flex gap-3 ${isUser ? 'flex-row' : 'flex-row'}`}>
                                        {/* Avatar / Initials */}
                                        <div
                                            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold shadow-xs ${
                                                isUser
                                                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                                    : isAgent
                                                    ? 'bg-teal-100 text-teal-800 border border-teal-200'
                                                    : 'bg-gray-200 text-gray-600'
                                            }`}
                                        >
                                            {isUser ? 'PT' : isAgent ? 'AI' : 'SYS'}
                                        </div>

                                        {/* Turn Bubble */}
                                        <div className="flex-grow">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-bold text-gray-700">
                                                    {isUser ? 'Patient' : isAgent ? 'Aura (AI Assistant)' : 'System'}
                                                </span>
                                                {turn.timestamp && (
                                                    <span className="text-[11px] text-gray-400">{turn.timestamp}</span>
                                                )}
                                            </div>

                                            <div
                                                className={`p-3 rounded-xl text-xs leading-relaxed ${
                                                    isUser
                                                        ? 'bg-blue-50/70 border border-blue-100 text-gray-800'
                                                        : isAgent
                                                        ? 'bg-gray-50 border border-gray-200 text-gray-800'
                                                        : 'bg-amber-50 border border-amber-200 text-amber-900'
                                                }`}
                                            >
                                                {renderHighlightedText(turn.message)}

                                                {/* Attachments if any */}
                                                {turn.attachments && turn.attachments.length > 0 && (
                                                    <div className="mt-2 pt-2 border-t border-gray-200 flex flex-wrap gap-2">
                                                        {turn.attachments.map((att, attIdx) => (
                                                            <div
                                                                key={attIdx}
                                                                className="flex items-center gap-1.5 bg-white border border-gray-200 px-2 py-1 rounded text-[11px]"
                                                            >
                                                                <Paperclip size={12} className="text-gray-400" />
                                                                <span className="truncate max-w-[140px] font-medium">{att.name}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>

            {/* Collapsible Evidence Viewer (Photos & Lab PDFs) */}
            <div className="border-t border-gray-200 bg-gray-50/60">
                <button
                    type="button"
                    onClick={() => setEvidenceOpen(!evidenceOpen)}
                    className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-gray-700 hover:bg-gray-100 transition"
                >
                    <div className="flex items-center gap-2">
                        <Paperclip size={14} className="text-teal-700" />
                        <span>ATTACHED CLINICAL EVIDENCE & LAB REPORTS ({evidence.length})</span>
                    </div>
                    {evidenceOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {evidenceOpen && (
                    <div className="p-4 pt-1 border-t border-gray-100 bg-white">
                        {evidence.length === 0 ? (
                            <p className="text-xs text-gray-400 italic mb-0 py-2">
                                No uploaded images or PDF test reports associated with this intake session.
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {evidence.map((item) => {
                                    const isPdf = item.filename?.toLowerCase().endsWith('.pdf') || item.file_type === 'application/pdf';
                                    const fileUrl = item.signed_url || item.public_url || '#';

                                    return (
                                        <div
                                            key={item.id}
                                            className="border border-gray-200 rounded-lg p-3 bg-gray-50/50 hover:bg-white hover:shadow-xs transition"
                                        >
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div className="flex items-center gap-1.5 truncate">
                                                    {isPdf ? (
                                                        <FileText size={16} className="text-rose-600 flex-shrink-0" />
                                                    ) : (
                                                        <ImageIcon size={16} className="text-teal-600 flex-shrink-0" />
                                                    )}
                                                    <span className="text-xs font-semibold text-gray-800 truncate" title={item.filename}>
                                                        {item.filename}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Inline Viewer / Preview Button */}
                                            <div className="flex items-center gap-1.5 mt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewEvidence(item)}
                                                    className="btn btn-sm btn-outline-secondary py-0.5 px-2 text-[11px] flex-grow"
                                                >
                                                    {isPdf ? 'Inspect PDF' : 'Inspect Photo'}
                                                </button>
                                                {fileUrl !== '#' && (
                                                    <a
                                                        href={fileUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="btn btn-sm btn-light border py-0.5 px-2 text-[11px] text-gray-600"
                                                        title="Download / Open Full File"
                                                    >
                                                        <Download size={12} />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal Inspector for Evidence (PDF iframe or High-Res Image) */}
            {previewEvidence && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs"
                    onClick={() => setPreviewEvidence(null)}
                >
                    <div
                        className="bg-white rounded-xl shadow-2xl overflow-hidden w-full max-w-3xl max-h-[85vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-4 py-3 bg-gray-900 text-white flex items-center justify-between">
                            <span className="text-xs font-bold truncate max-w-md">{previewEvidence.filename}</span>
                            <div className="flex items-center gap-2">
                                {(previewEvidence.signed_url || previewEvidence.public_url) && (
                                    <a
                                        href={previewEvidence.signed_url || previewEvidence.public_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-gray-300 hover:text-white text-xs flex items-center gap-1"
                                    >
                                        <ExternalLink size={14} /> Open Tab
                                    </a>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setPreviewEvidence(null)}
                                    className="text-gray-400 hover:text-white p-1"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="p-4 flex-grow overflow-auto flex items-center justify-center bg-gray-100 min-h-[350px]">
                            {previewEvidence.filename?.toLowerCase().endsWith('.pdf') ? (
                                <iframe
                                    src={`${previewEvidence.signed_url || previewEvidence.public_url || ''}#toolbar=0`}
                                    className="w-full h-[550px] border-0 rounded"
                                    title="Embedded PDF Viewer"
                                />
                            ) : (
                                <img
                                    src={previewEvidence.signed_url || previewEvidence.public_url}
                                    alt={previewEvidence.filename}
                                    className="max-h-[550px] max-w-full object-contain rounded shadow-xs"
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

