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
    segment: Segment & { codeAssignments?: { codebookEntry: { name: string } }[] }
    onClose: () => void
    onDecision: (segId: string, action: string, label?: string) => void
}) {
    // Find if it was already accepted or modified
    const initialAccepted = segment.suggestions?.find(s => s.status === 'APPROVED' || s.status === 'MODIFIED')
    const initialLabel = segment.codeAssignments?.[0]?.codebookEntry?.name || initialAccepted?.label || ''

    const [overrideMode, setOverrideMode] = useState(false)
    const [customLabel, setCustomLabel] = useState('')
    const [decided, setDecided] = useState<{ action: string; label: string } | null>(
        initialAccepted ? { action: initialAccepted.status === 'APPROVED' ? 'ACCEPT' : 'OVERRIDE', label: initialLabel } : null
    )
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

        if (action === 'RESTORE') {
            setDecided(null)
            onDecision(segment.id, 'RESTORE', undefined)
        } else {
            setDecided({ action, label: finalLabel })
            onDecision(segment.id, action, finalLabel)
        }
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
                        <div key={sg.id} className={`bg-white border ${style.border} rounded-xl overflow-hidden shadow-sm`}>
                            {/* Card Header */}
                            <div className={`flex items-center gap-2 px-3 py-2.5 ${style.bg} border-b ${style.border} bg-opacity-70`}>
                                <span className={`w-2 h-2 rounded-full ${style.dot} flex-shrink-0`} />
                                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                                    {sg.modelProvider ?? 'AI'}
                                </span>
                                <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded border ${confidenceColor[sg.confidence]}`}>
                                    {sg.confidence}
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
                                    <span className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 block tracking-wider">Why this code?</span>
                                    <p className="text-[13px] text-slate-600 leading-relaxed font-medium bg-slate-50 p-3 rounded-lg border border-slate-100 shadow-sm">
                                        {sg.explanation}
                                    </p>
                                </div>
                                
                                {/* Detailed Confidence Explanation */}
                                <div className={`p-3.5 rounded-xl border shadow-sm ${
                                    sg.confidence === 'HIGH' ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800' :
                                    sg.confidence === 'MEDIUM' ? 'bg-amber-50/50 border-amber-100 text-amber-800' :
                                    'bg-rose-50/50 border-rose-100 text-rose-800'
                                }`}>
                                    <div className="flex items-center gap-1.5 mb-3 border-b border-amber-100/50 pb-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                                        <span className="text-[11px] font-extrabold uppercase tracking-wider">AI Confidence Score: {finalScore}%</span>
                                    </div>
                                    
                                    <div className="text-[11px] leading-relaxed opacity-90 p-2.5 bg-white/60 rounded-md border border-amber-100/30 text-slate-700">
                                        <p className="mb-1">
                                            This score indicates that the AI is <strong>{finalScore}% confident</strong> in the thematic match between its suggested code and the participant's context.
                                        </p>
                                        <p>
                                            A higher score typically means the AI found direct textual evidence, while lower scores indicate it relied on broader inference. <em>Regardless of the score, human review is essential to ensure nuanced interpretation.</em>
                                        </p>
                                    </div>
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
                        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 shadow-sm">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {decided.action === 'ACCEPT' ? `✓ Accepted: "${decided.label}"` : `✏ Overridden: "${decided.label}"`}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <button 
                                onClick={() => submitDecision('RESTORE')}
                                disabled={loading}
                                className="flex-1 bg-white border border-slate-300 text-slate-700 text-[11px] font-bold py-2 rounded-xl hover:bg-slate-50 transition flex items-center justify-center gap-1 shadow-sm disabled:opacity-50"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
                                Restore to Pending
                            </button>
                            <button 
                                onClick={() => submitDecision('REJECT')}
                                disabled={loading}
                                className="flex-1 bg-white border border-rose-200 text-rose-600 text-[11px] font-bold py-2 rounded-xl hover:bg-rose-50 transition flex items-center justify-center gap-1 shadow-sm disabled:opacity-50"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                Revoke Code
                            </button>
                        </div>
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
                                ✕ Reject Suggestion
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
