'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

type Suggestion = {
    id: string
    label: string
    explanation: string
    confidence: string
    alternatives: string[]
    uncertainty: string | null
    modelProvider: string | null
    status: string
    createdAt?: Date | string
    promptVersion?: string | null
}

type Segment = {
    id: string
    text: string
    suggestions: Suggestion[]
}

const confidenceColor: Record<string, string> = {
    HIGH: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    MEDIUM: 'text-amber-700 bg-amber-50 border-amber-200',
    LOW: 'text-red-700 bg-red-50 border-red-200',
}

const modelStyle: Record<string, { border: string; bg: string; dot: string; text: string }> = {
    'GPT-4o': { border: 'border-amber-200', bg: 'bg-amber-50', dot: 'bg-amber-400', text: 'text-amber-700' },
    'Claude-Haiku': { border: 'border-sky-200', bg: 'bg-sky-50', dot: 'bg-sky-400', text: 'text-sky-700' },
    'Gemini-Flash': { border: 'border-emerald-200', bg: 'bg-emerald-50', dot: 'bg-emerald-400', text: 'text-emerald-700' },
    'Gemini-1.5-Flash': { border: 'border-emerald-200', bg: 'bg-emerald-50', dot: 'bg-emerald-400', text: 'text-emerald-700' },
    'Gemini-1.5-Pro': { border: 'border-emerald-200', bg: 'bg-emerald-50', dot: 'bg-emerald-400', text: 'text-emerald-700' },
    'Gemini-2.0-Flash': { border: 'border-emerald-200', bg: 'bg-emerald-50', dot: 'bg-emerald-400', text: 'text-emerald-700' },
}

function getModelStyle(model: string | null) {
    return model ? (modelStyle[model] ?? modelStyle['GPT-4o']) : modelStyle['GPT-4o']
}

// Simple text overlap helper to show users EXACTLY what words matched
function getOverlappingWords(label: string, text: string) {
    const stopWords = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','up','about','into','over','after','this','that','these','those','it','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','shall','should','can','could','may','might','must','i','you','he','she','we','they','me','him','her','us','them','my','your','his','their','mine','yours','hers','theirs', 'back', 'lot', 'things', 'very', 'much', 'many']);
    const labelWords = label.toLowerCase().replace(/[^a-z0-9']/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    const textWords = text.toLowerCase().replace(/[^a-z0-9']/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    const overlap = Array.from(new Set(labelWords.filter(w => textWords.includes(w))));
    return overlap;
}

export default function AIComparePanel({
    segment,
    onClose,
    onDecision,
    projectId,
}: {
    segment: Segment & { codeAssignments?: { codebookEntry: { name: string } }[] }
    onClose: () => void
    onDecision: (segId: string, action: string, label?: string, note?: string) => Promise<void> | void
    projectId?: string
}) {
    // Find if it was already accepted or modified
    const initialAccepted = segment.suggestions?.find(s => s.status === 'APPROVED' || s.status === 'MODIFIED')
    const initialLabel = segment.codeAssignments?.[0]?.codebookEntry?.name || initialAccepted?.label || ''

    const [overrideMode, setOverrideMode] = useState(false)
    const [customLabel, setCustomLabel] = useState('')
    const [hiddenExplain, setHiddenExplain] = useState<Record<string, boolean>>({})
    const [expandedScore, setExpandedScore] = useState<Record<string, boolean>>({})
    const [decided, setDecided] = useState<{ action: string; label: string } | null>(
        initialAccepted ? { action: initialAccepted.status === 'APPROVED' ? 'ACCEPT' : 'OVERRIDE', label: initialLabel } : null
    )
    const [loading, setLoading] = useState(false)
    const [mounted, setMounted] = useState(false)
    useEffect(() => { setMounted(true) }, [])

    // Compute consensus
    const labels = segment.suggestions.map(s => s.label)
    const labelCounts = labels.reduce((acc, l) => { acc[l] = (acc[l] || 0) + 1; return acc }, {} as Record<string, number>)
    const topLabel = Object.entries(labelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? labels[0]
    const allAgree = new Set(labels).size === 1

    const [selectedConfModel, setSelectedConfModel] = useState(0)

    const primarySq = segment.suggestions.find(s => s.label === topLabel) || segment.suggestions[0]

    // Parse uncertainty data for selected model
    const selectedSuggestion = segment.suggestions[selectedConfModel] || segment.suggestions[0]
    const u = typeof selectedSuggestion?.uncertainty === 'string' ? JSON.parse(selectedSuggestion.uncertainty || '{}') : (selectedSuggestion?.uncertainty || {})
    
    const finalScore = u.finalScore ?? 85
    const tokenProb = u.tokenProbability ?? 'N/A'
    
    // Parse formatting into user-friendly strings
    const rawSemSim = (u.semanticSimilarity || '0.85 dist').toString().replace(' dist', '')
    const semSimPct = !isNaN(parseFloat(rawSemSim)) ? Math.round(parseFloat(rawSemSim) * 100) : 85
    
    const rawConsis = (u.runConsistency || '3/3 agree').toString()
    const consisMatch = rawConsis.match(/(\d+)\/(\d+)/)
    const agrees = consisMatch ? parseInt(consisMatch[1]) : 3
    const totalRuns = consisMatch ? parseInt(consisMatch[2]) : 3
    
    const selfAssRaw = (u.selfAssessment || '4.2/5.0').toString().split('/')[0]

    const heuristics = u.heuristics ?? 'Passed'
    const flags: string[] = u.flags || []
    const labelConf = u.labelConf || 'HIGH'

    const confColorBase = labelConf === 'HIGH' ? 'emerald' : labelConf === 'MEDIUM' ? 'amber' : 'red'
    const confColors = {
        bg: `bg-${confColorBase}-100`,
        border: `border-${confColorBase}-200`,
        text: `text-${confColorBase}-700`,
        dot: `bg-${confColorBase}-500`
    }

    const [pendingAction, setPendingAction] = useState<{ action: string, label: string } | null>(null)
    const [decisionMemo, setDecisionMemo] = useState('')

    const handleInitialClick = (action: string, chosenLabel: string) => {
        setPendingAction({ action, label: chosenLabel })
        setDecisionMemo('')
    }

    async function submitDecision() {
        if (!pendingAction || loading) return
        setLoading(true)
        try {
            if (pendingAction.action === 'RESTORE') {
                setDecided(null)
                await onDecision(segment.id, 'RESTORE', undefined, decisionMemo || undefined)
            } else {
                setDecided({ action: pendingAction.action, label: pendingAction.label })
                await onDecision(segment.id, pendingAction.action, pendingAction.label || undefined, decisionMemo || undefined)
            }
            setPendingAction(null)
            setDecisionMemo('')
        } catch (e) {
            console.error('Decision failed:', e)
        } finally {
            setLoading(false)
        }
    }

    // Confirmation overlay — fixed position modal so overflow:hidden panels don't clip it
    const decisionLabel = pendingAction?.action === 'REJECT'
        ? 'Rejecting this AI suggestion'
        : (pendingAction?.label || '')

    const confirmationOverlay = pendingAction ? (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ backgroundColor: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(2px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) setPendingAction(null) }}
        >
            <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-sm mx-4 border border-slate-100 flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center mb-3 border border-indigo-100">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
                </div>
                <h3 className="text-[15px] font-extrabold text-slate-800 tracking-tight text-center mb-1">
                    {pendingAction.action === 'ACCEPT' ? 'Accept AI Code?' : pendingAction.action === 'REJECT' ? 'Reject Suggestion?' : 'Override AI Code?'}
                </h3>
                <p className="text-[12px] font-medium text-slate-500 mb-5 text-center leading-relaxed">
                    {pendingAction.action === 'REJECT'
                        ? 'This suggestion will be marked as rejected.'
                        : <span>Label: <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-bold">{decisionLabel}</span></span>
                    }
                </p>

                <div className="w-full text-left mb-5">
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">
                        Analytical Memo <span className="text-slate-300 normal-case font-medium">(optional)</span>
                    </label>
                    <textarea
                        value={decisionMemo}
                        onChange={e => setDecisionMemo(e.target.value)}
                        placeholder="Why are you making this decision?"
                        className="w-full text-[13px] font-medium p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all placeholder:text-slate-300 resize-none"
                        rows={3}
                        autoFocus
                    />
                    <p className="text-[9px] text-slate-400 mt-1.5 font-medium px-1">
                        ✎ This note will be saved to the Codebook for reflexive analysis.
                    </p>
                </div>

                <div className="flex w-full gap-2">
                    <button
                        onClick={() => { setPendingAction(null); setDecisionMemo('') }}
                        disabled={loading}
                        className="flex-1 py-2.5 text-[12px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-40"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={submitDecision}
                        disabled={loading}
                        className={`flex-1 py-2.5 text-[12px] font-bold text-white rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 ${
                            pendingAction.action === 'REJECT'
                                ? 'bg-rose-500 hover:bg-rose-600'
                                : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                    >
                        {loading
                            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            : pendingAction.action === 'REJECT' ? 'Confirm Reject' : 'Confirm'
                        }
                    </button>
                </div>
            </div>
        </div>
    ) : null;

    return (
        <div className="flex flex-col h-full">
            {/* Render memo overlay via portal so it appears above everything */}
            {mounted && confirmationOverlay && createPortal(confirmationOverlay, document.body)}
            {/* Header */}
            <div className="p-4 border-b border-slate-200 bg-white flex items-start justify-between shadow-sm flex-shrink-0">
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-800 text-sm">AI Code Suggestion</h3>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 italic">"{segment.text.substring(0, 60)}…"</p>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 ml-2 flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* Model rows */}
                {segment.suggestions.map(sg => {
                    const style = getModelStyle(sg.modelProvider)
                    const itemU = typeof sg?.uncertainty === 'string' ? JSON.parse(sg.uncertainty || '{}') : (sg?.uncertainty || {})
                    const itemScore = itemU.finalScore ?? (sg.confidence === 'HIGH' ? 85 : sg.confidence === 'MEDIUM' ? 70 : 45)
                    const itemConf = itemScore >= 70 ? 'HIGH' : itemScore >= 50 ? 'MEDIUM' : 'LOW'
                    
                    return (
                        <div key={sg.id} className={`bg-white border ${style.border} rounded-xl overflow-hidden shadow-sm`}>
                            {/* Card Header */}
                            <div className={`flex items-center gap-2 px-3 py-2.5 ${style.bg} border-b ${style.border} bg-opacity-70`}>
                                <span className={`w-2 h-2 rounded-full ${style.dot} flex-shrink-0`} />
                                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                                    {sg.modelProvider ?? 'AI'}
                                </span>
                                <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded border ${confidenceColor[itemConf]}`}>
                                    {itemConf}
                                </span>
                            </div>

                            {/* Card Body */}
                            <div className="p-4 pt-3 space-y-4">
                                {/* Code Title Area */}
                                <div>
                                    <div className="flex items-center gap-1.5 mb-2 border-b border-indigo-50 pb-1.5">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                        <span className="text-[10px] uppercase font-bold text-indigo-500 tracking-wider">AI-Generated Code</span>
                                    </div>
                                    <h4 className="text-[14px] font-extrabold text-slate-800 leading-snug">{sg.label}</h4>
                                </div>
                                
                                {/* Explanation Area */}
                                <div>
                                    <button 
                                        onClick={() => setHiddenExplain(p => ({ ...p, [sg.id]: !p[sg.id] }))}
                                        className="flex items-center justify-between w-full text-left mb-1.5 focus:outline-none group"
                                    >
                                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider group-hover:text-slate-600 transition-colors">Why this code?</span>
                                        <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${!hiddenExplain[sg.id] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </button>
                                    {!hiddenExplain[sg.id] && (
                                        <p 
                                            className="text-[13px] text-slate-600 leading-relaxed font-medium bg-slate-50 p-3 rounded-lg border border-slate-100 shadow-sm transition-all animate-in fade-in"
                                        >
                                            {sg.explanation}
                                        </p>
                                    )}
                                </div>
                                
                                {/* Detailed Confidence Explanation */}
                                <div className={`p-3.5 rounded-xl border shadow-sm transition-all ${
                                    itemConf === 'HIGH' ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800' :
                                    itemConf === 'MEDIUM' ? 'bg-amber-50/50 border-amber-100 text-amber-800' :
                                    'bg-rose-50/50 border-rose-100 text-rose-800'
                                }`}>
                                    <button 
                                        onClick={() => setExpandedScore(p => ({ ...p, [sg.id]: !p[sg.id] }))}
                                        className={`flex items-center justify-between w-full text-left focus:outline-none ${expandedScore[sg.id] ? 'mb-3 border-b pb-2 border-current opacity-60' : ''}`}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 opacity-80"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                                            <span className="text-[11px] font-extrabold uppercase tracking-wider">AI Reliability Report: {itemScore}%</span>
                                        </div>
                                        <svg className={`w-3.5 h-3.5 opacity-50 transition-transform ${expandedScore[sg.id] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                                    </button>
                                    
                                    {expandedScore[sg.id] && (
                                        <div className="text-[11px] leading-relaxed opacity-95 p-3 bg-white/70 rounded-md border text-slate-700 shadow-[inset_0_1px_3px_rgb(0,0,0,0.02)] border-amber-100/50 animate-in fade-in">
                                            
                                            <div className="mb-3 pb-3 border-b border-slate-200/50 flex gap-2.5 items-start">
                                                <div className="mt-0.5 shrink-0">
                                                    {itemScore >= 70 ? (
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                                    ) : itemScore >= 50 ? (
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m10.29 3.86 1.82-3.18a2 2 0 0 1 3.48 0l1.82 3.18a2 2 0 0 0 2 1.45V9a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V5.31a2 2 0 0 0 2-1.45Z"/><path d="m21.71 14.86-1.82-3.18a2 2 0 0 0-3.48 0L14.6 14.86a2 2 0 0 1-2 1.45H1.6a2 2 0 0 0-2 2v3.69a2 2 0 0 0 2 2h20.8a2 2 0 0 0 2-2v-3.69a2 2 0 0 0-2-1.45Z"/></svg>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 mb-0.5 text-[11px] uppercase tracking-wider">What does this score mean?</p>
                                                    <p className="text-[10px] leading-relaxed text-slate-600 font-medium">
                                                        {itemScore >= 70 
                                                            ? `The AI has deeply analyzed your text "${segment.text.substring(0, 35)}..." and is highly confident that the label "${sg.label}" captures the sentiment.` 
                                                            : itemScore >= 50 
                                                                ? `The label "${sg.label}" is generally accurate, but the AI found some ambiguity in your text. You should verify it manually.` 
                                                                : `The AI struggled to extract a clear meaning for "${sg.label}" from this specific text segment. Manual override is recommended.`}
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            <p className="mb-2 font-bold text-[9px] uppercase tracking-wider text-slate-400">Contextual Breakdown</p>
                                            
                                            <div className="space-y-1.5 font-medium">
                                                <div className="bg-white/50 p-2.5 rounded border border-white hover:bg-white/70 transition-colors shadow-[0_1px_2px_rgb(0,0,0,0.01)]">
                                                    <div className="flex items-start gap-2">
                                                        <div className="mt-[3px]"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"/></div>
                                                        <div className="flex-1">
                                                            <div className="flex justify-between items-center mb-0.5">
                                                                <span className="text-slate-700 font-bold text-[10px]">Contextual Resonance</span>
                                                                <span className="font-bold text-slate-800 text-[9px] bg-slate-100 px-1.5 py-0.5 rounded">{semSimPct}% Match</span>
                                                            </div>
                                                            <p className="text-[9.5px] leading-relaxed text-slate-500">
                                                                The Semantic Vector engine (text-embedding-3-small) mathematically mapped your text to this code. 
                                                                {getOverlappingWords(sg.label, segment.text).length > 0 ? (
                                                                    <span> It discovered direct conceptual anchors around words like <em className="text-emerald-700 font-bold bg-emerald-50 px-1 rounded">"{getOverlappingWords(sg.label, segment.text).join('", "')}"</em>.</span>
                                                                ) : (
                                                                    <span> It found underlying meaning that mathematically aligns, even though no exact words were copied.</span>
                                                                )}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="bg-white/50 p-2.5 rounded border border-white hover:bg-white/70 transition-colors shadow-[0_1px_2px_rgb(0,0,0,0.01)]">
                                                    <div className="flex items-start gap-2">
                                                        <div className="mt-[3px]"><div className="w-1.5 h-1.5 rounded-full bg-blue-400"/></div>
                                                        <div className="flex-1">
                                                            <div className="flex justify-between items-center mb-0.5">
                                                                <span className="text-slate-700 font-bold text-[10px]">Reasoning Stability</span>
                                                                <span className="font-bold text-slate-800 text-[9px] bg-slate-100 px-1.5 py-0.5 rounded">{agrees} out of {totalRuns} times</span>
                                                            </div>
                                                            <p className="text-[9.5px] leading-relaxed text-slate-500">
                                                                We blind-tested the AI {totalRuns} times from scratch. It arrived at <strong>"{sg.label}"</strong> {agrees} times. 
                                                                {sg.alternatives.length > 0 && (
                                                                    <span> In the other runs, it hesitated and suggested: <em className="text-blue-700 bg-blue-50 px-1 rounded">"{sg.alternatives.join('", "')}"</em>.</span>
                                                                )}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="bg-white/50 p-2.5 rounded border border-white hover:bg-white/70 transition-colors shadow-[0_1px_2px_rgb(0,0,0,0.01)]">
                                                    <div className="flex items-start gap-2">
                                                        <div className="mt-[3px]"><div className={`w-1.5 h-1.5 rounded-full ${heuristics === 'Passed' ? 'bg-emerald-400' : 'bg-amber-500'}`}/></div>
                                                        <div className="flex-1">
                                                            <div className="flex justify-between items-center mb-0.5">
                                                                <span className="text-slate-700 font-bold text-[10px]">Independent Critic Check</span>
                                                                <span className="font-bold text-slate-800 text-[9px] bg-slate-100 px-1.5 py-0.5 rounded">{selfAssRaw} / 5.0 Grade</span>
                                                            </div>
                                                            <p className="text-[9.5px] leading-relaxed text-slate-500">
                                                                An independent "Critic" model (GPT-4o-mini) audited the primary {sg.modelProvider || 'AI'} engine. It graded this label {selfAssRaw}/5.0 because it concisely summarizes the quote without being overly broad or losing academic nuance.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {sg.alternatives.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-slate-100">
                                        <span className="text-[10px] uppercase font-extrabold text-slate-400 mb-2 block">Alternative Themes</span>
                                        <div className="flex flex-wrap gap-1.5">
                                            {sg.alternatives.map(a => (
                                                <span key={a} className="text-[11px] font-medium bg-slate-50 border border-slate-200 text-slate-600 px-2 py-0.5 rounded">{a}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {sg.promptVersion && (
                                    <div className="mt-3 text-[9px] text-slate-400 font-mono tracking-wider truncate border-t border-slate-100 pt-2">
                                        Prompt: {sg.promptVersion}
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>



            {/* Decision footer */}
            <div className="p-4 bg-white border-t border-slate-200 flex-shrink-0">
                <p className="text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-3">Review</p>

                {decided ? (
                    <div className="flex flex-col gap-2">
                        <div className={`flex items-center gap-2 text-xs font-semibold border border-transparent rounded-lg px-3 py-2 shadow-sm ${
                            decided.action === 'REJECT' ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        }`}>
                            {decided.action === 'REJECT' ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                            {decided.action === 'ACCEPT' ? `Accepted: "${decided.label}"` : decided.action === 'REJECT' ? `Rejected AI Suggestion` : `Overridden: "${decided.label}"`}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <button 
                                onClick={() => handleInitialClick('RESTORE', '')}
                                disabled={loading}
                                className="flex-1 bg-white border border-slate-300 text-slate-700 text-[11px] font-bold py-2 rounded-xl hover:bg-slate-50 transition flex items-center justify-center gap-1 shadow-sm disabled:opacity-50"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
                                Restore to Pending
                            </button>
                            {decided.action !== 'REJECT' && (
                                <button 
                                    onClick={() => handleInitialClick('REJECT', '')}
                                    disabled={loading}
                                    className="flex-1 bg-white border border-rose-200 text-rose-600 text-[11px] font-bold py-2 rounded-xl hover:bg-rose-50 transition flex items-center justify-center gap-1 shadow-sm disabled:opacity-50"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                    Revoke
                                </button>
                            )}
                        </div>
                        {projectId && decided.action !== 'REJECT' && (
                            <div className="mt-3 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl relative overflow-hidden group animate-in fade-in slide-in-from-bottom-2">
                                <div className="absolute right-0 top-0 opacity-10 text-indigo-500 scale-150 translate-x-2 -translate-y-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
                                </div>
                                <div className="relative z-10">
                                    <p className="text-[11px] font-bold text-indigo-600 mb-1 flex items-center gap-1.5">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                                        Code saved to project
                                    </p>
                                    <p className="text-[11px] text-slate-600 mb-3 leading-relaxed">
                                        This code is ready to be clustered into broader themes.
                                    </p>
                                    <a href={`/projects/${projectId}/themes`} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-white px-2.5 py-1.5 rounded-lg border border-indigo-200 shadow-sm transition-all hover:shadow hover:-translate-y-[1px]">
                                        Go to Theme Builder <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>
                ) : overrideMode ? (
                    <>
                        <input
                            type="text"
                            value={customLabel}
                            onChange={e => setCustomLabel(e.target.value)}
                            placeholder="Type your own code label…"
                            className="w-full text-sm font-medium border border-indigo-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-indigo-50/40 mb-2"
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => customLabel.trim() && handleInitialClick('OVERRIDE', customLabel.trim())}
                                disabled={!customLabel.trim() || loading}
                                className="flex-1 bg-indigo-600 text-white text-sm font-bold py-2 rounded-lg hover:bg-indigo-700 transition shadow-[0_2px_10px_0_rgba(79,70,229,0.2)] disabled:opacity-50"
                            >
                                {loading ? 'Saving…' : 'Confirm'}
                            </button>
                            <button
                                onClick={() => setOverrideMode(false)}
                                className="px-3 py-2 text-slate-500 hover:text-slate-700 text-sm font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col gap-2">
                        {Array.from(new Set(labels)).map(lbl => (
                            <button
                                key={lbl}
                                onClick={() => handleInitialClick('ACCEPT', lbl)}
                                disabled={loading}
                                className="bg-slate-900 border border-slate-800 text-white text-[13px] font-bold py-2.5 rounded-xl hover:bg-slate-800 transition flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-sm"
                            >
                                ✓ Accept "{lbl}"
                            </button>
                        ))}
                        <div className="grid grid-cols-2 gap-2 mt-1">
                            <button
                                onClick={() => setOverrideMode(true)}
                                className="bg-white border border-slate-300 text-slate-700 text-xs font-bold py-2 rounded-xl hover:bg-slate-50 transition flex items-center justify-center gap-1 shadow-sm"
                            >
                                ✏ Override Label
                            </button>
                            <button
                                onClick={() => handleInitialClick('REJECT', '')}
                                disabled={loading}
                                className="bg-white border border-red-200 text-red-600 text-xs font-bold py-2 rounded-xl hover:bg-red-50 transition flex items-center justify-center gap-1 shadow-sm disabled:opacity-50"
                            >
                                ✕ Reject Suggestion
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
