'use client'

import { useState } from 'react'

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

export default function AIComparePanel({
    segment,
    onClose,
    onDecision,
}: {
    segment: Segment
    onClose: () => void
    onDecision: (segId: string, action: string, label?: string) => void
}) {
    const [overrideMode, setOverrideMode] = useState(false)
    const [customLabel, setCustomLabel] = useState('')
    const [decided, setDecided] = useState<{ action: string; label: string } | null>(null)
    const [loading, setLoading] = useState(false)

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
    const consis = u.runConsistency ?? 'N/A'
    const semSim = u.semanticSimilarity ?? 'N/A'
    const selfAss = u.selfAssessment ?? 'N/A'
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

    async function submitDecision(action: string, label?: string) {
        if (loading) return
        setLoading(true)
        const finalLabel = label ?? topLabel

        // Call API for each suggestion in segment
        await Promise.allSettled(
            segment.suggestions.map(sg =>
                fetch(`/api/segments/${segment.id}/review`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action, customLabel: finalLabel, suggestionId: sg.id }),
                })
            )
        )

        setDecided({ action, label: finalLabel })
        onDecision(segment.id, action, finalLabel)
        setLoading(false)
    }

    return (
        <div className="flex flex-col h-full">
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
                    return (
                        <div key={sg.id} className={`border ${style.border} ${style.bg} rounded-xl overflow-hidden`}>
                            <div className="flex items-center gap-2 px-3 py-2.5">
                                <span className={`w-2 h-2 rounded-full ${style.dot} flex-shrink-0`} />
                                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                                    {sg.modelProvider ?? 'AI'}
                                </span>
                                <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded border ${confidenceColor[sg.confidence]}`}>
                                    {sg.confidence}
                                </span>
                            </div>
                            <div className="px-3 pb-3">
                                <p className="text-sm font-semibold text-slate-800 mb-1.5">{sg.label}</p>
                                <details className="group">
                                    <summary className={`text-[11px] font-medium ${style.text} cursor-pointer flex items-center gap-1 select-none list-none`}>
                                        <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                        Why this code?
                                    </summary>
                                    <div className="mt-2 bg-white/70 p-2 rounded border border-slate-100">
                                        <p className="text-xs text-slate-600 leading-relaxed">
                                            {sg.explanation}
                                        </p>
                                        <div className="mt-2 text-[9px] text-slate-400 font-mono tracking-wider truncate">
                                            Prompt: {sg.promptVersion || 'quali-init-v2.1'} • {sg.createdAt ? new Date(sg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now'}
                                        </div>
                                    </div>
                                    {sg.alternatives.length > 0 && (
                                        <div className="mt-1.5 flex flex-wrap gap-1">
                                            <span className="text-[10px] text-slate-400">Alt:</span>
                                            {sg.alternatives.map(a => (
                                                <span key={a} className="text-[10px] bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">{a}</span>
                                            ))}
                                        </div>
                                    )}
                                </details>
                            </div>
                        </div>
                    )
                })}

                {/* Consensus */}
                <div className="pt-3 border-t border-slate-200">
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">Consensus Verdict</p>
                    <div className={`text-sm font-semibold rounded-xl p-3 border ${allAgree ? 'text-violet-800 bg-violet-50 border-violet-200' : 'text-amber-800 bg-amber-50 border-amber-200'}`}>
                        {allAgree ? `✓ All models agree: "${topLabel}"` : `⚠ Disagreement. Majority: "${topLabel}"`}
                    </div>
                </div>

                {/* Confidence Details */}
                <div className="pt-3 border-t border-slate-200 mt-2">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                            Confidence Scoring
                        </span>
                        <span className={`${confColors.text} font-bold ${confColors.bg} px-2 py-0.5 rounded border ${confColors.border} flex items-center gap-1 text-[11px]`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${confColors.dot}`}></div>
                            {finalScore}% ({labelConf})
                        </span>
                    </div>
                    {/* Model selector dropdown */}
                    {segment.suggestions.length > 1 && (
                        <div className="mb-2">
                            <select
                                value={selectedConfModel}
                                onChange={e => setSelectedConfModel(Number(e.target.value))}
                                className="w-full text-[11px] font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 cursor-pointer appearance-none"
                                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
                            >
                                {segment.suggestions.map((sg, idx) => {
                                    const sgU = typeof sg.uncertainty === 'string' ? JSON.parse(sg.uncertainty || '{}') : (sg.uncertainty || {})
                                    const sgScore = sgU.finalScore ?? '?'
                                    return (
                                        <option key={sg.id} value={idx}>
                                            {sg.modelProvider ?? 'AI'} — {sg.confidence} ({sgScore}%)
                                        </option>
                                    )
                                })}
                            </select>
                        </div>
                    )}
                    <details className="group">
                        <summary className="flex items-center justify-end cursor-pointer list-none select-none">
                            <span className="text-[11px] text-indigo-500 font-medium group-open:hidden">View Details</span>
                            <span className="text-[11px] text-indigo-500 font-medium hidden group-open:inline">Hide Details</span>
                        </summary>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-2 mt-2">
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-500 font-medium">Token probability <span className="text-[9px] text-slate-400 font-normal">(25%)</span></span>
                                <span className="text-slate-700 font-mono font-medium">{tokenProb}</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-500 font-medium">Run consistency <span className="text-[9px] text-slate-400 font-normal">(25%)</span></span>
                                <span className="text-slate-700 font-mono font-medium">{consis}</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-500 font-medium">Semantic similarity <span className="text-[9px] text-slate-400 font-normal">(20%)</span></span>
                                <span className="text-slate-700 font-mono font-medium">{semSim}</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-500 font-medium">Self-assessment <span className="text-[9px] text-slate-400 font-normal">(20%)</span></span>
                                <span className="text-slate-700 font-mono font-medium">{selfAss}</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] items-start">
                                <span className="text-slate-500 font-medium">Heuristics <span className="text-[9px] text-slate-400 font-normal">(10%)</span></span>
                                <span className={`${flags.length > 0 ? 'text-amber-600' : 'text-emerald-600'} text-right max-w-[140px] leading-tight font-medium flex-col flex items-end gap-1`}>
                                    <div className="flex items-center gap-1">
                                        {flags.length > 0 ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                                        )}
                                        {flags.length > 0 ? 'Flags detected' : 'Passed'}
                                    </div>
                                    {flags.map((f, i) => <div key={i} className="text-[9px] bg-white border border-slate-200 text-slate-500 px-1 py-0.5 rounded shadow-sm">{f}</div>)}
                                </span>
                            </div>
                        </div>
                    </details>
                </div>

                {/* Run Audit Trail */}
                <div className="pt-3 border-t border-slate-200 mt-2">
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21v-5h5"/></svg>
                        Run Audit Trail
                    </p>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-2 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-slate-200"></div>
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 font-medium">Run ID</span>
                            <span className="text-slate-700 font-mono font-bold">run_a7f2c1</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 font-medium">Timestamp</span>
                            <span className="text-slate-700 font-bold">{segment.suggestions[0]?.createdAt ? new Date(segment.suggestions[0].createdAt).toLocaleString('en-US', {month:'short', day:'numeric', hour: '2-digit', minute:'2-digit'}) : 'Just now'}</span>
                        </div>
                        <div className="flex flex-col gap-1.5 text-[11px]">
                            <details className="group">
                                <summary className="flex items-center justify-between cursor-pointer list-none select-none">
                                    <span className="text-slate-500 font-medium">System Prompt</span>
                                    <span className="text-indigo-500 font-medium group-open:hidden">View Details</span>
                                    <span className="text-indigo-500 font-medium hidden group-open:inline">Hide Details</span>
                                </summary>
                                <div className="mt-2 text-[10px] bg-white p-2.5 rounded border border-slate-200 text-slate-600 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto custom-scrollbar leading-relaxed">
                                    {segment.suggestions[0]?.promptVersion || 'quali-init-v2.1'}
                                </div>
                            </details>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 font-medium">Temperature</span>
                            <span className="text-slate-700 font-bold">0.3</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-150">
                            <span className="text-slate-500 font-medium">Coded by</span>
                            <div className="flex gap-1 items-center">
                                {Array.from(new Set(segment.suggestions.map(s => s.modelProvider))).map(provider => (
                                    <span key={provider} className="bg-white border text-slate-600 font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-[4px] text-[9px]">{provider}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Decision footer */}
            <div className="p-4 bg-white border-t border-slate-200 flex-shrink-0">
                <p className="text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-3">Review</p>

                {decided ? (
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {decided.action === 'ACCEPT' ? `✓ Accepted: "${decided.label}"` : `✏ Overridden: "${decided.label}"`}
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
                                onClick={() => customLabel.trim() && submitDecision('OVERRIDE', customLabel.trim())}
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
                                onClick={() => submitDecision('ACCEPT', lbl)}
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
                                onClick={() => submitDecision('REJECT')}
                                disabled={loading}
                                className="bg-white border border-red-200 text-red-600 text-xs font-bold py-2 rounded-xl hover:bg-red-50 transition flex items-center justify-center gap-1 shadow-sm disabled:opacity-50"
                            >
                                ✕ Reject All
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
