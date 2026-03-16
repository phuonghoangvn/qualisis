'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AIComparePanel from './AIComparePanel'
import HumanCodePanel from './HumanCodePanel'
import HumanHighlightTooltip from './HumanHighlightTooltip'
import { DEFAULT_PROMPT } from '@/lib/ai'
import { buildSystematicPrompt } from '@/lib/prompts'

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

type Transcript = {
    id: string
    title: string
    content: string
    status: string
    segments: Segment[]
    dataset: { name: string }
    metadata?: any
}

type Stats = { totalHighlights: number; assignedCodes: number; pendingReview: number }

type ActivePanel =
    | { type: 'ai'; segment: Segment }
    | { type: 'human'; text: string; codeName: string; spanEl?: HTMLSpanElement }
    | null

export default function TranscriptWorkspace({
    transcript,
    projectId,
    stats: initialStats,
}: {
    transcript: Transcript
    projectId: string
    stats: Stats
}) {
    const router = useRouter()
    const [segments, setSegments] = useState<Segment[]>(transcript.segments)
    const [stats, setStats] = useState(initialStats)
    const [analysisRun, setAnalysisRun] = useState(transcript.segments.length > 0)
    const [activePanel, setActivePanel] = useState<ActivePanel>(null)
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [selectedModels, setSelectedModels] = useState<Record<string, boolean>>({ gpt: true })
    const [showModelPicker, setShowModelPicker] = useState(false)

    const [researchContext, setResearchContext] = useState(DEFAULT_PROMPT)
    const [showFullPrompt, setShowFullPrompt] = useState(false)

    // Build the full prompt preview so user can see what is actually sent
    const fullPromptPreview = buildSystematicPrompt(
        researchContext,
        transcript.metadata || {},
        '(Summary will be auto-generated before analysis)'
    )

    // Click handler for human highlighted text
    const handleTranscriptClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('h-human')) {
            const title = target.getAttribute('title') || '';
            const codeName = title.replace('Human Code: ', '');
            setActivePanel({ type: 'human', text: target.innerText, codeName });
        }
    };

    // Run AI analysis
    const runAnalysis = useCallback(async () => {
        setIsAnalyzing(true)
        setShowModelPicker(false)
        setActivePanel(null)
        const models = Object.entries(selectedModels)
            .filter(([, v]) => v)
            .map(([k]) => k)

        try {
            const res = await fetch(`/api/transcripts/${transcript.id}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ models, researchContext }),
            })
            
            if (!res.ok) {
                const data = await res.json().catch(() => ({ error: 'Unknown server error' }))
                throw new Error(data.error || 'Failed to start analysis')
            }

            // Refresh page data from server
            router.refresh()
            setAnalysisRun(true)
        } catch (e: any) {
            alert('Analysis failed: ' + (e.message || String(e)))
        } finally {
            setIsAnalyzing(false)
        }
    }, [transcript.id, selectedModels, researchContext, router])

    // Group suggestions by modelProvider for display
    const getModelSuggestions = (seg: Segment) => {
        const byModel: Record<string, Suggestion> = {}
        for (const s of seg.suggestions) {
            if (s.modelProvider) byModel[s.modelProvider] = s
        }
        return byModel
    }

    const renderTranscript = () => {
        const content = transcript.content;
        
        // 1. Identify Speaker Tags using Regex
        type DisplaySegment = 
            | { type: 'highlight', id: string, startIndex: number, endIndex: number, seg: Segment }
            | { type: 'speaker', id: string, startIndex: number, endIndex: number, label: string }

        const displaySegments: DisplaySegment[] = [];
        
        // Match things like "P1:", "Interviewer:", "Participant 1 :" at the beginning of lines
        const speakerRegex = /^([A-Za-z0-9_ -]+)\s*:\s*/gm;
        let match;
        while ((match = speakerRegex.exec(content)) !== null) {
            const rawTag = match[1].trim();
            let label = rawTag.toUpperCase() + ' :'; // Default fallback
            
            // Map against metadata if available
            if (transcript.metadata) {
                const { interviewer, participants } = transcript.metadata;
                if (interviewer && interviewer['Speaker Tag']?.toLowerCase() === rawTag.toLowerCase()) {
                    label = 'INTERVIEWER :';
                } else if (participants) {
                    const p = participants.find((p: any) => p['Speaker Tag']?.toLowerCase() === rawTag.toLowerCase());
                    if (p) {
                        label = `PARTICIPANT (${rawTag}) :`;
                    }
                }
            }

            displaySegments.push({
                type: 'speaker',
                id: `spk-${match.index}`,
                startIndex: match.index,
                endIndex: match.index + match[0].length,
                label
            });
        }

        // Add AI segments if analysis has run
        if (analysisRun && segments.length > 0) {
            for (const seg of segments) {
                displaySegments.push({
                    type: 'highlight',
                    id: seg.id,
                    startIndex: seg.startIndex,
                    endIndex: seg.endIndex,
                    seg
                });
            }
        }

        // Sort all segments by startIndex
        displaySegments.sort((a, b) => a.startIndex - b.startIndex);

        const parts: React.ReactNode[] = [];
        let cursor = 0;

        for (const ds of displaySegments) {
            let actualStart = Math.max(ds.startIndex, cursor);

            // Skip entirely overlapped segments
            if (actualStart >= ds.endIndex && ds.endIndex > ds.startIndex) {
                // If it's a speaker tag but purely overlapped, still render the tag itself, just no new text prepended.
                if (ds.type !== 'speaker') continue;
            }

            // Text before segment
            if (actualStart > cursor) {
                parts.push(
                    <span key={`pre-${ds.id}`}>
                        {content.slice(cursor, actualStart)}
                    </span>
                );
            }

            if (ds.type === 'speaker') {
                parts.push(
                    <div key={ds.id} className="mt-10 mb-5 text-[11px] font-extrabold text-slate-400 uppercase tracking-[0.15em] select-none block w-full text-left break-normal">
                        {ds.label}
                    </div>
                );
                cursor = Math.max(cursor, ds.endIndex);
            } else if (ds.type === 'highlight') {
                const seg = ds.seg!;
                const validSuggestions = seg.suggestions.filter(s => s.status !== 'REJECTED');
                if (validSuggestions.length === 0) continue;

                const accepted = validSuggestions.some(s => s.status === 'APPROVED');
                const overridden = validSuggestions.some(s => s.status === 'MODIFIED');
                const label = validSuggestions.find(s => s.status === 'APPROVED' || s.status === 'MODIFIED')?.label 
                           ?? validSuggestions[0]?.label ?? 'AI Code';

                const modelProviders = Array.from(new Set(validSuggestions.map(s => s.modelProvider).filter(Boolean)));
                const hasGPT = modelProviders.some(m => m?.includes('GPT') || m?.includes('gpt'));
                const hasGemini = modelProviders.some(m => m?.includes('Gemini') || m?.includes('gemini'));
                const hasClaude = modelProviders.some(m => m?.includes('Claude') || m?.includes('claude'));

                const activeColors: string[] = [];
                const activeBgRgb: string[] = [];

                if (hasGPT) {
                    activeColors.push('#f59e0b'); // Yellow/Amber for GPT
                    activeBgRgb.push('251, 191, 36');
                }
                if (hasGemini) {
                    activeColors.push('#10b981'); // Green for Gemini
                    activeBgRgb.push('52, 211, 153');
                }
                if (hasClaude) {
                    activeColors.push('#0ea5e9'); // Blue for Claude
                    activeBgRgb.push('56, 189, 248');
                }

                let inlineStyle: React.CSSProperties = {};

                if (accepted) {
                    inlineStyle.backgroundColor = 'rgba(52, 211, 153, 0.2)';
                    activeColors.length = 0; activeColors.push('#10b981');
                } else if (overridden) {
                    inlineStyle.backgroundColor = 'rgba(167, 139, 250, 0.2)';
                    activeColors.length = 0; activeColors.push('#8b5cf6');
                } else {
                    if (activeColors.length === 1) {
                        // Make single model background extremely light so it's not overwhelmingly "yellow" or "blue"
                        inlineStyle.backgroundColor = `rgba(${activeBgRgb[0]}, 0.15)`;
                    } else if (activeColors.length > 1) {
                        // Striped background for multiple models
                        const gradientParts = activeBgRgb.map((rgb, i) => {
                            const start = i * 8;
                            const end = (i + 1) * 8;
                            return `rgba(${rgb}, 0.15) ${start}px, rgba(${rgb}, 0.15) ${end}px`;
                        });
                        inlineStyle.backgroundImage = `repeating-linear-gradient(-45deg, ${gradientParts.join(', ')})`;
                    } else {
                        inlineStyle.backgroundColor = 'transparent';
                    }
                }

                let cls = 'h-ai relative group cursor-pointer transition-colors rounded-sm ';

                if (activeColors.length > 0) {
                    // Remove inline-block to allow natural text wrapping!
                    const shadows = activeColors.map((c, i) => `0 ${ (i + 1) * 3 }px 0 0 ${c}`);
                    inlineStyle.boxShadow = shadows.join(', ');
                    inlineStyle.paddingBottom = '2px';
                }

                // Safe text extraction
                const textEnd = Math.max(actualStart, ds.endIndex);
                const textToRender = content.slice(actualStart, textEnd);
                
                if (textToRender.length > 0) {
                    parts.push(
                        <span
                            key={`${seg.id}-${actualStart}`}
                            className={cls}
                            style={inlineStyle}
                            title={`${label} (${modelProviders.join(', ')})`}
                            onClick={() => setActivePanel({ type: 'ai', segment: seg })}
                        >
                            <span className="whitespace-pre-wrap">{textToRender}</span>
                        </span>
                    );
                }
                cursor = textEnd;
            }
        }

        // Trailing text
        if (cursor < content.length) {
            parts.push(<span key="trail">{content.slice(cursor)}</span>);
        }

        return parts;
    }

    const aiModels = [
        { key: 'gpt', label: 'GPT-4o', color: 'yellow' },
        { key: 'gemini', label: 'Gemini Flash', color: 'green' },
        { key: 'claude', label: 'Claude Haiku', color: 'blue' },
    ]

    return (
        <div className="flex bg-slate-50/50 h-full overflow-hidden w-full">
            {/* ── Main Content Area: Transcript ── */}
            <div className="flex-1 flex flex-col overflow-hidden relative border-r border-slate-200/60 shadow-sm z-10">

                {/* Header (Screenshot 1 top portion) */}
                <div className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-100 flex-shrink-0 z-20 sticky top-0">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push(`/projects/${projectId}`)} className="text-slate-400 hover:text-indigo-600 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-left"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
                        </button>
                        <div className="w-px h-8 bg-slate-200"></div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-lg font-extrabold text-slate-800 tracking-tight">{transcript.title}</h1>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-sm font-medium text-slate-500">
                                <span>{transcript.title.toLowerCase().replace(/\s+/g, '_')}.txt</span>
                                <button className="text-slate-400 hover:text-indigo-600 ml-1"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></button>
                                <button className="text-slate-400 hover:text-red-500"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Export Button */}
                        <button className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm bg-white">
                            Export
                        </button>

                        {/* Analysis Dropdown Button */}
                        <div className="relative">
                            <div className={`flex items-center rounded-lg shadow-sm transition-all border border-transparent ${
                                isAnalyzing ? 'bg-indigo-400 text-white cursor-not-allowed' : 'bg-indigo-600 shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] text-white hover:bg-indigo-700 hover:-translate-y-0.5'
                            }`}>
                                <button
                                    onClick={runAnalysis}
                                    disabled={isAnalyzing}
                                    className="flex items-center gap-2 text-sm font-semibold px-4 py-2"
                                >
                                    {isAnalyzing ? (
                                        <>
                                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            Analyzing...
                                        </>
                                    ) : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sparkles"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a4.42 4.42 0 0 1 0-8.962L8.5 1.936A2 2 0 0 0 9.937.5l1.582-6.135a4.42 4.42 0 0 1 8.962 0L22.063 8.5A2 2 0 0 0 23.5 9.937l6.135 1.582a4.42 4.42 0 0 1 0 8.962l-6.135 1.582a2 2 0 0 0-1.437 1.438l-1.582 6.135a4.42 4.42 0 0 1-8.962 0z"/></svg> 
                                            {analysisRun ? 'Re-run Analysis' : 'Run Initial Analysis'}
                                        </>
                                    )}
                                </button>
                                <button 
                                    onClick={() => setShowModelPicker(prev => !prev)} 
                                    disabled={isAnalyzing} 
                                    className="px-2 py-2 border-l border-indigo-500/50 hover:bg-indigo-500 rounded-r-lg transition-colors flex items-center justify-center cursor-pointer"
                                    aria-label="Toggle models"
                                    type="button"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                </button>
                            </div>

                            {/* Dropdown Menu */}
                            {showModelPicker && (
                                <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-[100] p-4 flex flex-col gap-3">
                                    <div className="flex flex-col gap-1">
                                        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-1">Configure AI Models</p>
                                        <div className="flex flex-col gap-1 mt-1">
                                            {aiModels.map(m => (
                                                <label key={m.key} className="flex items-center gap-3 px-2 py-1.5 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
                                                    <input 
                                                        type="checkbox" 
                                                        className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500" 
                                                        checked={!!selectedModels[m.key as keyof typeof selectedModels]}
                                                        onChange={e => setSelectedModels(prev => ({ ...prev, [m.key]: e.target.checked }))}
                                                    />
                                                    <span className="text-sm font-semibold text-slate-700">{m.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="border-t border-slate-100 pt-3 flex flex-col gap-2">
                                        <div className="flex items-center justify-between px-1">
                                            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Research Instructions</label>
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={() => setShowFullPrompt(!showFullPrompt)}
                                                    className={`text-[9px] font-bold transition-colors uppercase tracking-widest ${showFullPrompt ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-500'}`}
                                                >
                                                    {showFullPrompt ? 'Hide Full Prompt' : 'Show Full Prompt'}
                                                </button>
                                                <button 
                                                    onClick={() => setResearchContext(DEFAULT_PROMPT)}
                                                    className="text-[9px] font-bold text-indigo-500 hover:text-indigo-700 transition-colors uppercase tracking-widest"
                                                >
                                                    Reset
                                                </button>
                                            </div>
                                        </div>
                                        <textarea
                                            value={researchContext}
                                            onChange={e => setResearchContext(e.target.value)}
                                            placeholder="Inform the AI about your research goals to improve thematic coding..."
                                            className="w-full h-28 text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-y font-medium custom-scrollbar leading-relaxed"
                                        />
                                        <p className="text-[9px] text-slate-400 px-0.5">↑ Your research instructions are injected into the full systematic prompt below</p>
                                        
                                        {showFullPrompt && (
                                            <div className="mt-2">
                                                <div className="flex items-center gap-1.5 mb-1.5">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
                                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Full Prompt Sent to AI</span>
                                                </div>
                                                <pre className="w-full max-h-64 text-[10px] p-3 border border-slate-200 rounded-lg bg-slate-50 overflow-y-auto custom-scrollbar font-mono leading-relaxed text-slate-600 whitespace-pre-wrap break-words">
                                                    {fullPromptPreview}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Transcript body (White Paper UI) */}
                <div className="flex-1 overflow-y-auto w-full flex justify-center items-start py-10 px-8 bg-slate-50/50 custom-scrollbar">
                    <div className="w-full max-w-[850px] bg-white rounded-3xl p-16 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-100 h-fit min-h-full flex flex-col">
                        <div onClick={handleTranscriptClick} className="text-[14.5px] leading-[3rem] text-slate-700 whitespace-pre-wrap break-words w-full max-w-full font-medium text-left">
                            {renderTranscript()}
                        </div>
                    </div>
                </div>

                {/* Human highlight tooltip (floating) */}
                <HumanHighlightTooltip
                    transcriptId={transcript.id}
                    onCodeApplied={() => router.refresh()}
                />
            </div>

            {/* ── Right: Panel ── */}
            <div className="w-80 flex-shrink-0 flex flex-col bg-slate-50 border-l border-slate-200 overflow-hidden">
                {activePanel === null && (
                    <EmptyPanel analysisRun={analysisRun} onRunAnalysis={runAnalysis} isAnalyzing={isAnalyzing} stats={stats} />
                )}
                {activePanel?.type === 'ai' && (
                    <AIComparePanel
                        key={activePanel.segment.id}
                        segment={activePanel.segment}
                        onClose={() => setActivePanel(null)}
                        onDecision={(segId: string, action: string, label?: string) => {
                            // Optimistic update: mark segment suggestions
                            setSegments(prev => prev.map(s =>
                                s.id === segId
                                    ? {
                                        ...s,
                                        suggestions: s.suggestions.map(sg => ({
                                            ...sg,
                                            status: action === 'ACCEPT' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'MODIFIED'
                                        }))
                                    }
                                    : s
                            ))
                            setStats(prev => ({
                                ...prev,
                                assignedCodes: action !== 'REJECT' ? prev.assignedCodes + 1 : prev.assignedCodes,
                                pendingReview: Math.max(0, prev.pendingReview - 1),
                            }))
                        }}
                    />
                )}
                {activePanel?.type === 'human' && (
                    <HumanCodePanel
                        text={activePanel.text}
                        codeName={activePanel.codeName}
                        onClose={() => setActivePanel(null)}
                    />
                )}
            </div>
        </div>
    )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="flex items-center gap-2">
            <span className={`text-lg font-bold ${color}`}>{value}</span>
            <span className="text-[11px] text-slate-500">{label}</span>
        </div>
    )
}

function LegendDot({ color, label }: { color: string; label: string }) {
    return (
        <span className="flex items-center gap-1">
            <span className={`w-2.5 h-2.5 rounded-sm ${color} inline-block`} />
            {label}
        </span>
    )
}

function EmptyPanel({ analysisRun, onRunAnalysis, isAnalyzing, stats }: {
    analysisRun: boolean
    onRunAnalysis: () => void
    isAnalyzing: boolean
    stats?: Stats
}) {
    if (analysisRun && stats) {
        return (
            <div className="flex-1 flex flex-col bg-slate-50/50 relative overflow-y-auto">
                <div className="p-8 pb-12 text-center flex flex-col items-center">
                    <div className="w-16 h-16 rounded-3xl bg-indigo-50 flex items-center justify-center mb-6 shadow-sm border border-indigo-100/50 text-indigo-500">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mouse-pointer-click"><path d="M14 4.1 12 6"/><path d="m5.1 8-2.9 1.2"/><path d="m21.3 13.7-2.6-1.5"/><path d="M22 22l-7.7-7.7"/><path d="m14.6 10.5 7.4-7.4"/></svg>
                    </div>
                    <h3 className="text-base font-extrabold text-slate-800 tracking-tight mb-2">Select a Segment</h3>
                    <p className="text-[13px] font-medium text-slate-500 leading-relaxed mb-8">
                        Click a highlighted quote or drag to select new text to begin thematic coding.
                    </p>
                </div>

                <div className="px-6 pb-6">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-4 px-2">Transcript Progress</p>
                    <div className="space-y-3">
                        <div className="bg-white border text-left border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center font-bold flex-shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-highlighter"><path d="m8 16 2.05-2.05a5.55 5.55 0 0 0-7.85-7.85L5 3"/><path d="m14 8 2.3 2.3c.9.9 2.5.9 3.4 0l.6-.6c.9-.9.9-2.5 0-3.4l-2.3-2.3"/><path d="m21 21-1-1"/><path d="m16 8 4 4"/><path d="M4 16h6v5H4v-5Z"/></svg>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="text-[13px] font-bold text-slate-800 truncate">Total Highlights</h4>
                                    <p className="text-[10px] text-slate-500 font-medium truncate">Quotes identified</p>
                                </div>
                            </div>
                            <span className="text-xl font-extrabold text-indigo-700 pl-4">{stats.totalHighlights}</span>
                        </div>
                        
                        <div className="bg-white border text-left border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center font-bold flex-shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check-circle-2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="text-[13px] font-bold text-slate-800 truncate">Assigned Codes</h4>
                                    <p className="text-[10px] text-slate-500 font-medium truncate">Human & AI verified</p>
                                </div>
                            </div>
                            <span className="text-xl font-extrabold text-emerald-700 pl-4">{stats.assignedCodes}</span>
                        </div>

                        <div className="bg-white border text-left border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center font-bold flex-shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-clock"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="text-[13px] font-bold text-slate-800 truncate">Pending AI Review</h4>
                                    <p className="text-[10px] text-slate-500 font-medium truncate">Awaiting your approval</p>
                                </div>
                            </div>
                            <span className="text-xl font-extrabold text-amber-600 pl-4">{stats.pendingReview}</span>
                        </div>
                    </div>

                    {/* Model Color Legend */}
                    <div className="mt-6 pt-4 border-t border-slate-100">
                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3 px-2">Highlight Colors</p>
                        <div className="grid grid-cols-1 gap-1.5 text-[11px] font-medium px-1">
                            <div className="flex items-center gap-2">
                                <span className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-300 flex-shrink-0" />
                                <span className="text-slate-600">GPT-4o only</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-300 flex-shrink-0" />
                                <span className="text-slate-600">Gemini only</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3.5 h-3.5 rounded bg-sky-100 border border-sky-300 flex-shrink-0" />
                                <span className="text-slate-600">Claude only</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3.5 h-3.5 rounded bg-indigo-200 border border-indigo-400 flex-shrink-0" />
                                <span className="text-slate-600">2 models agree</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-3.5 h-3.5 rounded bg-purple-200 border border-purple-400 flex-shrink-0" />
                                <span className="text-slate-600">All 3 models agree</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-400 flex-shrink-0" />
                                <span className="text-slate-600">Accepted</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col p-8 pt-12 items-center text-center bg-slate-50/50 shadow-[-4px_0_24px_rgba(0,0,0,0.02)] z-20 overflow-y-auto">
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 flex items-center justify-center mb-6 border border-indigo-100/50 shadow-inner">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sparkles text-indigo-500"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a4.42 4.42 0 0 1 0-8.962L8.5 1.936A2 2 0 0 0 9.937.5l1.582-6.135a4.42 4.42 0 0 1 8.962 0L22.063 8.5A2 2 0 0 0 23.5 9.937l6.135 1.582a4.42 4.42 0 0 1 0 8.962l-6.135 1.582a2 2 0 0 0-1.437 1.438l-1.582 6.135a4.42 4.42 0 0 1-8.962 0z"/></svg>
            </div>
            
            <h3 className="text-lg font-extrabold text-slate-800 mb-2 tracking-tight">Get started with coding</h3>
            <p className="text-sm text-slate-500 mb-10 leading-relaxed font-medium">
                Choose how you'd like to begin <br/>analysing this transcript
            </p>

            <div className="w-full flex flex-col gap-8">
                {/* Run Initial Analysis Box */}
                <div onClick={onRunAnalysis} className={`w-full p-5 rounded-[20px] text-left transition-all border shadow-sm group ${isAnalyzing ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-70' : 'border-indigo-100 bg-white cursor-pointer hover:border-indigo-300 hover:shadow-md'}`}>
                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sparkles"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a4.42 4.42 0 0 1 0-8.962L8.5 1.936A2 2 0 0 0 9.937.5l1.582-6.135a4.42 4.42 0 0 1 8.962 0L22.063 8.5A2 2 0 0 0 23.5 9.937l6.135 1.582a4.42 4.42 0 0 1 0 8.962l-6.135 1.582a2 2 0 0 0-1.437 1.438l-1.582 6.135a4.42 4.42 0 0 1-8.962 0z"/></svg> 
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-slate-800 mb-1">{isAnalyzing ? 'Analyzing...' : 'Run Initial Analysis'}</h4>
                            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                                Click the Run Initial Analysis button above to let AI suggest initial codes across the transcript automatically.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="w-full border-t border-slate-200"></div>
                    </div>
                    <div className="relative flex justify-center">
                        <span className="bg-slate-50/50 px-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-300">OR</span>
                    </div>
                </div>

                {/* Highlight manually Box */}
                <div className="w-full p-5 rounded-[20px] bg-white border border-slate-200 shadow-sm text-left hover:border-slate-300 hover:shadow-md transition-all cursor-pointer">
                    <div className="flex gap-4">
                         <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center flex-shrink-0 shadow-inner">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-highlighter"><path d="m8 16 2.05-2.05a5.55 5.55 0 0 0-7.85-7.85L5 3"/><path d="m14 8 2.3 2.3c.9.9 2.5.9 3.4 0l.6-.6c.9-.9.9-2.5 0-3.4l-2.3-2.3"/><path d="m21 21-1-1"/><path d="m16 8 4 4"/><path d="M4 16h6v5H4v-5Z"/></svg>
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-slate-800 mb-1">Highlight manually</h4>
                            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                                Select any text in the transcript by dragging to create a highlight and assign your own code.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
