'use client'

import React, { useMemo, useState } from 'react'
import ConfirmModal from './ConfirmModal'

type Suggestion = {
    id: string
    label: string
    explanation: string
    confidence: string
    alternatives: string[]
    uncertainty: string | null
    modelProvider: string | null
    status: string
    reviewDecision: { action: string; note: string | null } | null
}

type Segment = {
    id: string
    text: string
    startIndex: number
    endIndex: number
    speaker: string | null
    order: number
    suggestions: Suggestion[]
    codeAssignments: { codebookEntry: { name: string } }[]
}

type MassReviewModalProps = {
    segments: Segment[]
    initialTab: 'ALL' | 'PENDING' | 'ACCEPTED' | 'REJECTED'
    transcriptTitle: string
    onClose: () => void
    onDecision: (segmentId: string, action: string, newLabel?: string, note?: string, suggestionId?: string) => void | Promise<void>
    onTrace: (segmentId: string) => void
}

export default function MassReviewModal({ segments, initialTab, transcriptTitle, onClose, onDecision, onTrace }: MassReviewModalProps) {
    const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'ACCEPTED' | 'REJECTED'>(initialTab);
    const [editingRow, setEditingRow] = useState<string | null>(null);
    const [editLabel, setEditLabel] = useState("");
    const [acceptAllLoading, setAcceptAllLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // Decision overlay state
    const [pendingDecision, setPendingDecision] = useState<{ segmentId: string, action: string, label: string, suggestionId?: string } | null>(null);
    const [decisionMemo, setDecisionMemo] = useState("");
    const [decisionLoading, setDecisionLoading] = useState(false);

    const submitPendingDecision = async () => {
        if (!pendingDecision) return;
        setDecisionLoading(true);
        await onDecision(pendingDecision.segmentId, pendingDecision.action, pendingDecision.label, decisionMemo, pendingDecision.suggestionId);
        setPendingDecision(null);
        setDecisionMemo("");
        setDecisionLoading(false);
        setEditingRow(null);
    };

    const getConfStyle = (c: string, u?: string | null) => {
        let score = parseInt(c) || 0;
        if (!score) {
            try {
                const parsed = JSON.parse(u || '{}');
                if (parsed.finalScore) score = parseInt(parsed.finalScore);
            } catch {}
        }
        
        let label = score > 0 ? `${score}%` : 'NO CONF';
        if (score === 0) {
            const up = String(c || '').toUpperCase();
            if (up.includes('HIGH')) { score = 90; label = '90%'; }
            else if (up.includes('MED')) { score = 60; label = '60%'; }
            else if (up.includes('LOW')) { score = 30; label = '30%'; }
        }

        if (score >= 80) return { bg: 'bg-emerald-100 text-emerald-700', label };
        if (score >= 50) return { bg: 'bg-amber-100 text-amber-700', label };
        return { bg: 'bg-rose-100 text-rose-700', label };
    }

    const renderTraceability = (raw: string) => {
        try {
            const data = JSON.parse(raw);
            if (data.finalScore !== undefined) {
                const isHighConsensus = data.runConsistency?.includes('3/3');
                const isMedConsensus = data.runConsistency?.includes('2/3');
                
                return (
                    <div className="flex flex-col gap-1.5 mt-1">
                        <div className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                            <span>
                                <strong className="font-bold">AI Agreement:</strong> {
                                    isHighConsensus ? 'Strong (All models independently agreed on this code)' : 
                                    isMedConsensus ? 'Moderate (Models had some debate but mostly agreed)' : 
                                    'Low (Only one model suggested this)'
                                }
                            </span>
                        </div>
                        {data.semanticSimilarity && (
                            <div className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                                <span>
                                    <strong className="font-bold">Quote Relevance:</strong> {
                                        parseFloat(data.semanticSimilarity) >= 0.75 ? "The quote's exact words very clearly express this concept." :
                                        parseFloat(data.semanticSimilarity) >= 0.50 ? "The quote implies this concept, but requires some interpretation." :
                                        "This concept is only weakly connected to the text."
                                    }
                                </span>
                            </div>
                        )}
                        {data.flags && data.flags.length > 0 && data.flags[0] !== "Flags: Low" && data.flags[0] !== "None" && (
                            <div className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 flex-shrink-0" />
                                <span>
                                    <strong className="font-bold text-rose-600">AI Caution:</strong> {data.flags.join(', ').replace('Flags: ', '')}
                                </span>
                            </div>
                        )}
                    </div>
                );
            }
            return <span className="opacity-90 leading-relaxed">{raw}</span>;
        } catch {
            return <span className="opacity-90 leading-relaxed">{raw}</span>;
        }
    }

    const rows = useMemo(() => {
        const flat: Array<{
            segment: Segment
            suggestion: Suggestion
            isHuman: boolean
        }> = [];

        for (const seg of segments) {
            const valid = seg.suggestions.filter(s => s.status !== 'REJECTED');
            const isHuman = valid.length === 0 && seg.codeAssignments.length > 0;
            
            if (isHuman) {
                flat.push({
                    segment: seg,
                    suggestion: {
                        id: seg.id + '-human',
                        label: seg.codeAssignments[0].codebookEntry.name,
                        status: 'APPROVED',
                        confidence: '100',
                        explanation: 'Human created',
                        alternatives: [],
                        uncertainty: null,
                        modelProvider: 'Human',
                        reviewDecision: null
                    },
                    isHuman: true
                });
                continue;
            }

            for (const sug of seg.suggestions) {
                // If there's an approved or modified suggestion, we only show that one for the segment to avoid duplication,
                // OR we show all AI suggestions grouped. For mass review, we list the "best" or "current consensus" suggestion per segment.
                // Let's just list the "leading" suggestion: either the APPROVED one, or the one with highest confidence.
            }
            
            // To make it simple: 1 row per segment that has suggestions.
            if (seg.suggestions.length > 0) {
                const approved = seg.suggestions.find(s => s.status === 'APPROVED' || s.status === 'MODIFIED');
                if (approved) {
                    flat.push({ segment: seg, suggestion: approved, isHuman: false });
                } else {
                    // Pick highest confidence pending
                    const pending = seg.suggestions.filter(s => s.status === 'SUGGESTED' || s.status === 'UNDER_REVIEW');
                    if (pending.length > 0) {
                        const top = [...pending].sort((a, b) => parseInt(b.confidence || '0') - parseInt(a.confidence || '0'))[0];
                        flat.push({ segment: seg, suggestion: top, isHuman: false });
                    } else if (seg.suggestions.every(s => s.status === 'REJECTED') && seg.suggestions.length > 0) {
                        // All rejected
                        flat.push({ segment: seg, suggestion: seg.suggestions[0], isHuman: false });
                    }
                }
            }
        }

        let filtered = flat;
        if (filter === 'PENDING') {
            filtered = flat.filter(r => r.suggestion.status === 'SUGGESTED' || r.suggestion.status === 'UNDER_REVIEW');
        } else if (filter === 'ACCEPTED') {
            filtered = flat.filter(r => r.suggestion.status === 'APPROVED' || r.suggestion.status === 'MODIFIED');
        } else if (filter === 'REJECTED') {
            filtered = flat.filter(r => r.suggestion.status === 'REJECTED');
        }

        // Sort by confidence desc
        return filtered.sort((a, b) => {
            const getVal = (c: string) => {
                const up = String(c || '').toUpperCase();
                if (up.includes('HIGH')) return 90;
                if (up.includes('MED')) return 50;
                if (up.includes('LOW')) return 10;
                return parseInt(c || '0') || 0;
            }
            return getVal(b.suggestion.confidence) - getVal(a.suggestion.confidence);
        });
    }, [segments, filter]);

    const counts = useMemo(() => {
        let p = 0, a = 0, r = 0;
        for (const seg of segments) {
            const hasApproved = seg.suggestions.some(s => s.status === 'APPROVED' || s.status === 'MODIFIED');
            const allRejected = seg.suggestions.length > 0 && seg.suggestions.every(s => s.status === 'REJECTED');
            const hasHuman = seg.suggestions.length === 0 && seg.codeAssignments.length > 0;
            
            if (hasApproved || hasHuman) a++;
            else if (allRejected) r++;
            else if (seg.suggestions.length > 0) p++;
        }
        return { pending: p, accepted: a, rejected: r, all: p + a + r };
    }, [segments]);

    const handleAcceptAllClick = () => {
        const pendingRows = rows.filter(r => r.suggestion.status === 'SUGGESTED' || r.suggestion.status === 'UNDER_REVIEW');
        if (pendingRows.length === 0) return;
        setShowConfirm(true);
    };

    const confirmAcceptAll = async () => {
        setShowConfirm(false);
        const pendingRows = rows.filter(r => r.suggestion.status === 'SUGGESTED' || r.suggestion.status === 'UNDER_REVIEW');
        if (pendingRows.length === 0) return;
        
        setAcceptAllLoading(true);
        try {
            // Process sequentially to avoid overwhelming the API
            for (const r of pendingRows) {
                // Pass the specific suggestionId so only that one suggestion gets accepted (not all 3 from GPT/Claude/Gemini)
                await onDecision(r.segment.id, 'ACCEPT', r.suggestion.label, undefined, r.suggestion.id);
            }
        } finally {
            setAcceptAllLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-8 animate-in fade-in duration-200">
            {/* ── Decision Confirmation Overlay ── */}
            {pendingDecision && (
                <div className="absolute inset-0 z-[600] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-white p-7 rounded-2xl shadow-2xl w-full max-w-[400px] border border-slate-100 flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center mb-4 border border-indigo-100/50">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22v-5"/><path d="M9 7V2"/><path d="M15 7V2"/><path d="M12 7v5"/><path d="M5 17l4-4"/><path d="M15 13l4 4"/><path d="M22 12h-5"/><path d="M7 12H2"/></svg>
                        </div>
                        <h3 className="text-lg font-extrabold text-slate-800 tracking-tight text-center mb-2">
                            {pendingDecision.action === 'ACCEPT' ? 'Accept AI Code?' : pendingDecision.action === 'REJECT' ? 'Reject AI Code?' : 'Override AI Code?'}
                        </h3>
                        <p className="text-[13px] font-bold text-slate-500 mb-6 text-center leading-relaxed">
                            Label: <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{pendingDecision.label}</span>
                        </p>
                        
                        <div className="w-full text-left mb-7">
                            <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-2">
                                Analytical Memo (Optional)
                            </label>
                            <textarea
                                value={decisionMemo}
                                onChange={e => setDecisionMemo(e.target.value)}
                                placeholder="Why are you making this decision?"
                                className="w-full text-sm font-medium p-3.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all placeholder:text-slate-300 resize-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                                rows={3}
                                autoFocus
                            />
                            <p className="text-[10px] text-slate-400 mt-2 font-medium px-1 flex items-start gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 text-indigo-400"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                                This note will be logged to the Theme codebook.
                            </p>
                        </div>

                        <div className="flex w-full gap-3">
                            <button onClick={() => { setPendingDecision(null); setDecisionMemo(''); }} disabled={decisionLoading} className="flex-1 py-3 text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                                Cancel
                            </button>
                            <button onClick={submitPendingDecision} disabled={decisionLoading} className="flex-1 py-3 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-transform hover:scale-[1.02] flex items-center justify-center gap-2">
                                {decisionLoading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white w-full h-full max-w-[1400px] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 relative">
                
                {/* Header */}
                <div className="px-8 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 flex-shrink-0">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-xl font-extrabold text-slate-800">Mass Review AI Suggestions</h2>
                            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{transcriptTitle}</span>
                        </div>
                        <p className="text-sm text-slate-500 font-medium tracking-tight">Review, accept, or reject generated codes in bulk before adding them to the Codebook.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {filter === 'PENDING' && counts.pending > 0 && (
                            <button onClick={handleAcceptAllClick} disabled={acceptAllLoading} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-extrabold rounded-lg shadow-sm transition-colors flex items-center gap-2">
                                {acceptAllLoading ? (
                                    <>
                                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                        Accepting...
                                    </>
                                ) : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                                        Accept All Pending
                                    </>
                                )}
                            </button>
                        )}
                        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors border border-slate-200 shadow-sm bg-white">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-4 px-8 py-3 border-b border-slate-100 bg-white">
                    <button onClick={() => setFilter('ALL')} className={`text-sm font-bold px-3 py-1.5 rounded-md transition-colors ${filter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>All ({counts.all})</button>
                    <button onClick={() => setFilter('PENDING')} className={`text-sm font-bold px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${filter === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'text-slate-500 hover:bg-slate-100'}`}>Pending <span className="bg-white/50 px-1.5 rounded-sm">{counts.pending}</span></button>
                    <button onClick={() => setFilter('ACCEPTED')} className={`text-sm font-bold px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${filter === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:bg-slate-100'}`}>Accepted <span className="bg-white/50 px-1.5 rounded-sm">{counts.accepted}</span></button>
                    <button onClick={() => setFilter('REJECTED')} className={`text-sm font-bold px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${filter === 'REJECTED' ? 'bg-rose-100 text-rose-700' : 'text-slate-500 hover:bg-slate-100'}`}>Rejected <span className="bg-white/50 px-1.5 rounded-sm">{counts.rejected}</span></button>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto bg-slate-50/50">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-white sticky top-0 z-10 shadow-sm border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 text-xs font-extrabold text-slate-400 uppercase tracking-widest w-[15%]">Code / Score</th>
                                <th className="px-6 py-4 text-xs font-extrabold text-slate-400 uppercase tracking-widest w-[40%]">Excerpt from Transcript</th>
                                <th className="px-6 py-4 text-xs font-extrabold text-slate-400 uppercase tracking-widest w-[25%]">Rationale & Memos</th>
                                <th className="px-6 py-4 text-xs font-extrabold text-slate-400 uppercase tracking-widest w-[20%] text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rows.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-16 text-center text-slate-400">
                                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                                        </div>
                                        <p className="font-bold text-[15px]">No highlights found in this category.</p>
                                    </td>
                                </tr>
                            ) : rows.map(r => (
                                <tr key={r.segment.id} className="hover:bg-indigo-50/30 transition-colors group bg-white">
                                    <td className="px-6 py-5 align-top">
                                        <div className="flex flex-col gap-1.5 items-start">
                                            {editingRow === r.segment.id ? (
                                                <div className="flex flex-col items-start gap-1">
                                                    <input 
                                                        autoFocus
                                                        value={editLabel}
                                                        onChange={e => setEditLabel(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') {
                                                                if(editLabel.trim()) setPendingDecision({ segmentId: r.segment.id, action: 'OVERRIDE', label: editLabel, suggestionId: r.suggestion.id });
                                                            } else if (e.key === 'Escape') setEditingRow(null);
                                                        }}
                                                        className="border border-indigo-300 rounded px-2 py-1.5 text-[11px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 w-[180px] shadow-sm"
                                                    />
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={() => { if(editLabel.trim()) setPendingDecision({ segmentId: r.segment.id, action: 'OVERRIDE', label: editLabel, suggestionId: r.suggestion.id }); }} className="text-[9px] uppercase tracking-wider font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Save</button>
                                                        <button onClick={() => setEditingRow(null)} className="text-[9px] uppercase tracking-wider font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">Cancel</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="inline-flex text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded text-xs font-bold shadow-sm max-w-[200px] whitespace-normal">
                                                    {r.suggestion.label}
                                                </span>
                                            )}
                                            {!r.isHuman && (
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded shadow-sm ${getConfStyle(r.suggestion.confidence, r.suggestion.uncertainty).bg}`}>
                                                        {getConfStyle(r.suggestion.confidence, r.suggestion.uncertainty).label}
                                                    </span>
                                                </div>
                                            )}
                                            {r.isHuman && <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider bg-purple-100 text-purple-700 mt-1">HUMAN</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 align-top">
                                        <div className="relative pl-3 border-l-2 border-indigo-200">
                                            <p className="text-[13px] text-slate-700 leading-relaxed italic line-clamp-4 group-hover:line-clamp-none transition-all">"{r.segment.text}"</p>
                                        </div>
                                        <button 
                                            onClick={() => { onClose(); onTrace(r.segment.id); }}
                                            className="mt-3 text-[10px] font-extrabold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-2 py-1 rounded transition-colors flex items-center gap-1"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/></svg>
                                            Trace in Document
                                        </button>
                                    </td>
                                    <td className="px-6 py-5 align-top">
                                        <div className="flex flex-col gap-3">
                                            {/* AI Rationale */}
                                            <div>
                                                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                                    {r.suggestion.explanation || 'No AI explanation provided.'}
                                                </p>
                                                {(r.suggestion.uncertainty && r.suggestion.uncertainty !== 'None' && r.suggestion.uncertainty.toLowerCase() !== 'low') && (
                                                    <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-600 shadow-sm">
                                                        <strong className="flex items-center gap-1.5 uppercase tracking-widest text-[9px] mb-2 font-extrabold text-slate-400">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg> 
                                                            AI Reliance Report
                                                        </strong>
                                                        {renderTraceability(r.suggestion.uncertainty)}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Human Memo (if handled) */}
                                            {r.suggestion.reviewDecision?.note && (
                                                <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 mt-1">
                                                    <strong className="flex items-center gap-1.5 uppercase tracking-widest text-[9px] mb-1.5 font-extrabold text-purple-600">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                                        Researcher Memo
                                                    </strong>
                                                    <p className="text-[11px] text-purple-900 leading-relaxed italic">"{r.suggestion.reviewDecision.note}"</p>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 align-top">
                                        <div className="flex flex-col gap-2 w-full max-w-[140px] mx-auto">
                                            {(r.suggestion.status === 'SUGGESTED' || r.suggestion.status === 'UNDER_REVIEW') && !r.isHuman ? (
                                                <>
                                                    <button onClick={() => setPendingDecision({ segmentId: r.segment.id, action: 'ACCEPT', label: r.suggestion.label, suggestionId: r.suggestion.id })} className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded shadow-sm text-xs font-bold transition-colors">
                                                        Accept
                                                    </button>
                                                    <div className="flex gap-1.5 w-full">
                                                        <button onClick={() => { setEditLabel(r.suggestion.label); setEditingRow(r.segment.id); }} className="flex-1 py-1.5 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-600 rounded text-xs font-bold transition-colors shadow-sm">
                                                            Edit
                                                        </button>
                                                        <button onClick={() => setPendingDecision({ segmentId: r.segment.id, action: 'REJECT', label: r.suggestion.label, suggestionId: r.suggestion.id })} className="flex-1 py-1.5 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 rounded text-xs font-bold transition-colors shadow-sm">
                                                            Reject
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="w-full text-center">
                                                    {r.suggestion.status === 'REJECTED' ? (
                                                        <>
                                                            <div className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 py-1.5 rounded mb-2 w-full">REJECTED</div>
                                                            <button onClick={() => onDecision(r.segment.id, 'RESTORE')} className="text-[10px] font-bold text-indigo-500 hover:underline">Undo</button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 py-1.5 rounded mb-2 w-full flex items-center justify-center gap-1.5">
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                                                                ACCEPTED
                                                            </div>
                                                            {!r.isHuman && (
                                                                <div className="flex items-center justify-center gap-3">
                                                                    <button onClick={() => onDecision(r.segment.id, 'RESTORE')} className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 transition">Restore</button>
                                                                    <span className="text-slate-200 text-[10px]">|</span>
                                                                    <button onClick={() => setPendingDecision({ segmentId: r.segment.id, action: 'REJECT', label: r.suggestion.label })} className="text-[10px] font-bold text-rose-400 hover:text-rose-600 transition">Revoke</button>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <ConfirmModal
                isOpen={showConfirm}
                title="Accept All Pending"
                message={`Are you sure you want to accept all ${rows.filter(r => r.suggestion.status === 'SUGGESTED' || r.suggestion.status === 'UNDER_REVIEW').length} pending highlights?\n\nThis will add them permanently to the Codebook.`}
                confirmText="Accept All"
                onConfirm={confirmAcceptAll}
                onCancel={() => setShowConfirm(false)}
            />
        </div>
    )
}
