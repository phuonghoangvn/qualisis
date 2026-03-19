'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'

type CodeEntry = {
    id: string
    name: string
    type: string
    instances: number
    definition?: string
}

type ThemeSuggestion = {
    name: string
    tags: string[]
    description: string
    reason?: string
    confidenceScore?: number
    codes: CodeEntry[]
}

type ThemeData = {
    id: string
    name: string
    description: string | null
    status: string
    codeLinks: {
        codebookEntry: {
            id: string
            name: string
            type: string
            definition?: string | null
            examplesIn?: string | null
            _count: { codeAssignments: number }
        }
    }[]
}

// ─── CodebookRow: Fetches sample excerpt + sentiment for each code ───
function CodebookRow({ theme, link, isFirstInTheme, themeRowSpan, onTrace, projectId }: {
    theme: ThemeData
    link: ThemeData['codeLinks'][0]
    isFirstInTheme: boolean
    themeRowSpan: number
    onTrace: (codeId: string, codeName: string) => void
    projectId: string
}) {
    const router = useRouter()
    const [excerpt, setExcerpt] = useState<{ text: string; transcriptId: string; transcriptName: string; projectId: string } | null>(null)
    const [sentiment, setSentiment] = useState<string | null>(null)
    const [loaded, setLoaded] = useState(false)

    useEffect(() => {
        let cancelled = false
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/codebook/${link.codebookEntry.id}/quotes`)
                if (res.ok && !cancelled) {
                    const data = await res.json()
                    // Get the first quote as sample excerpt
                    if (Array.isArray(data) && data.length > 0 && data[0].quotes?.length > 0) {
                        setExcerpt({
                            text: data[0].quotes[0].text,
                            transcriptId: data[0].transcriptId,
                            transcriptName: data[0].transcriptName,
                            projectId: data[0].projectId
                        })
                    }
                }
            } catch {}

            // Try to extract sentiment from the AI suggestion uncertainty JSON
            try {
                const sugRes = await fetch(`/api/codebook/${link.codebookEntry.id}/sentiment`)
                if (sugRes.ok && !cancelled) {
                    const sentData = await sugRes.json()
                    if (sentData.sentiment) setSentiment(sentData.sentiment)
                }
            } catch {}

            if (!cancelled) setLoaded(true)
        }
        fetchData()
        return () => { cancelled = true }
    }, [link.codebookEntry.id])

    const sentimentColor = sentiment === 'Positive' || sentiment === 'POSITIVE'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : sentiment === 'Negative' || sentiment === 'NEGATIVE'
        ? 'bg-rose-50 text-rose-700 border-rose-200'
        : 'bg-slate-50 text-slate-600 border-slate-200'

    const sentimentLabel = sentiment === 'POSITIVE' ? 'Positive' : sentiment === 'NEGATIVE' ? 'Negative' : sentiment === 'NEUTRAL' ? 'Neutral' : sentiment || '—'

    return (
        <tr className="hover:bg-slate-50/50 transition-colors group">
            {isFirstInTheme && (
                <td className="px-6 py-4 border-b border-r border-slate-200 align-top" rowSpan={themeRowSpan}>
                    <span className="text-[13px] font-extrabold text-slate-800 leading-snug block">{theme.name}</span>
                </td>
            )}
            <td className="px-6 py-4 border-b border-r border-slate-200">
                <span className="font-semibold text-slate-700 text-[13px] leading-snug">{link.codebookEntry.name}</span>
            </td>
            <td className="px-6 py-4 border-b border-r border-slate-200">
                {!loaded ? (
                    <span className="text-[11px] text-slate-300 italic">Loading...</span>
                ) : excerpt ? (
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-[12px] text-slate-600 leading-relaxed line-clamp-3 italic">"{excerpt.text}"</p>
                        <button
                            onClick={() => {
                                router.push(`/projects/${excerpt.projectId}/transcripts/${excerpt.transcriptId}`)
                            }}
                            title={`Go to source: ${excerpt.transcriptName}`}
                            className="flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] font-bold text-indigo-500 hover:text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-md hover:bg-indigo-100"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
                            Trace
                        </button>
                    </div>
                ) : (
                    <span className="text-[11px] text-slate-300 italic">No excerpt available</span>
                )}
            </td>
            <td className="px-6 py-4 border-b border-slate-200 text-center">
                {loaded && sentiment ? (
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${sentimentColor}`}>
                        {sentimentLabel}
                    </span>
                ) : loaded ? (
                    <span className="text-[11px] text-slate-300">—</span>
                ) : (
                    <span className="text-[11px] text-slate-300 italic">...</span>
                )}
            </td>
        </tr>
    )
}

export default function ThemesPage() {
    const params = useParams()
    const router = useRouter()
    const projectId = params.projectId as string

    const [activeTab, setActiveTab] = useState('Builder')
    const [unassignedCodes, setUnassignedCodes] = useState<CodeEntry[]>([])
    const [themes, setThemes] = useState<ThemeData[]>([])
    const [themeSuggestions, setThemeSuggestions] = useState<ThemeSuggestion[]>([])
    const [loading, setLoading] = useState(true)
    const [suggestionsLoading, setSuggestionsLoading] = useState(false)
    const [acceptingId, setAcceptingId] = useState<number | null>(null)
    // Selected theme in Thematic Map for drill-down
    const [mapSelectedTheme, setMapSelectedTheme] = useState<ThemeData | null>(null)

    // Prompt editor state for theme suggestions
    const DEFAULT_THEME_PROMPT = `Group these codes into meaningful THEMES based on:
1. Code co-occurrence patterns (codes that appear in the same interview segments)
2. Semantic similarity (codes that describe related concepts)
3. Theoretical coherence (codes that form a meaningful narrative together)

For each suggested theme, provide:
- A clear theme name (3-6 words)
- 1-2 emotional/conceptual tags
- A brief description explaining WHY these codes belong together
- Which specific code names belong in this theme

Rules:
- Each code should appear in at most ONE theme
- A theme should have at least 2 codes
- Create 3-6 themes maximum
- Be specific and grounded in the data`
    const [themePrompt, setThemePrompt] = useState(DEFAULT_THEME_PROMPT)
    const [showPromptEditor, setShowPromptEditor] = useState(false)

    // Trace modal states
    const [tracingCode, setTracingCode] = useState<{id: string, name: string} | null>(null)
    const [tracingQuotes, setTracingQuotes] = useState<any[]>([])
    const [tracingLoading, setTracingLoading] = useState(false)

    // Code Clean states
    type CleanSuggestion = {
        codeId: string
        codeName: string
        action: 'DROP' | 'MERGE'
        mergeInto?: string
        reasons: string[]
        confidence: string
        instances?: number
    }
    const [cleanSuggestions, setCleanSuggestions] = useState<CleanSuggestion[]>([])
    const [cleanLoading, setCleanLoading] = useState(false)
    const [showCleanPanel, setShowCleanPanel] = useState(false)

    // Run code cleaning analysis
    const runCodeClean = async () => {
        setCleanLoading(true)
        setShowCleanPanel(true)
        try {
            const res = await fetch('/api/codebook/clean', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId })
            })
            if (res.ok) {
                const data = await res.json()
                setCleanSuggestions(data.suggestions || [])
            }
        } catch (e) {
            console.error('Clean error:', e)
        }
        setCleanLoading(false)
    }

    // Apply a clean action (drop or merge)
    const applyCleanAction = async (suggestion: CleanSuggestion) => {
        try {
            if (suggestion.action === 'DROP') {
                // Delete the code from codebook
                await fetch(`/api/codebook/${suggestion.codeId}`, { method: 'DELETE' })
            } else if (suggestion.action === 'MERGE' && suggestion.mergeInto) {
                // Move assignments to target code, then delete source
                await fetch(`/api/codebook/${suggestion.codeId}/merge`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ targetId: suggestion.mergeInto })
                })
            }
            // Remove from suggestions list
            setCleanSuggestions(prev => prev.filter(s => s.codeId !== suggestion.codeId))
            fetchData()
        } catch (e) {
            console.error('Apply clean action error:', e)
        }
    }

    // Code Drag & Drop Helpers
    const handleDragStart = (e: React.DragEvent, payload: { codeId: string, fromThemeId?: string }) => {
        e.dataTransfer.setData('application/json', JSON.stringify(payload))
        e.dataTransfer.effectAllowed = 'move'
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
    }

    const handleDropOnUnassigned = async (e: React.DragEvent) => {
        e.preventDefault()
        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'))
            // If dragging from a theme -> Unassigned: remove code from theme
            if (data.fromThemeId && data.codeId) {
                await fetch(`/api/projects/${projectId}/themes`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ themeId: data.fromThemeId, action: 'REMOVE_CODE', codeId: data.codeId })
                })
                fetchData()
            }
        } catch (err) {}
    }

    const handleDropOnTheme = async (e: React.DragEvent, targetThemeId: string) => {
        e.preventDefault()
        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'))
            if (data.fromThemeId === targetThemeId) return // Already in this theme
            
            // If moving from another theme, remove from old theme first
            if (data.fromThemeId) {
                await fetch(`/api/projects/${projectId}/themes`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ themeId: data.fromThemeId, action: 'REMOVE_CODE', codeId: data.codeId })
                })
            }
            // Add to new theme
            await fetch(`/api/projects/${projectId}/themes`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ themeId: targetThemeId, action: 'ADD_CODE', codeId: data.codeId })
            })
            fetchData()
        } catch (err) {}
    }

    // Delete a theme
    const deleteTheme = async (themeId: string, themeName: string) => {
        if (!confirm(`Delete theme "${themeName}"? All code assignments will be removed.`)) return
        await fetch(`/api/projects/${projectId}/themes/${themeId}`, { method: 'DELETE' })
        fetchData()
    }

    // Load Quotes for a specific Code
    const openTrace = async (codeId: string, codeName: string) => {
        setTracingCode({ id: codeId, name: codeName })
        setTracingLoading(true)
        setTracingQuotes([])
        try {
            const res = await fetch(`/api/codebook/${codeId}/quotes`)
            if (res.ok) {
                const data = await res.json()
                setTracingQuotes(data)
            }
        } catch (err) {}
        setTracingLoading(false)
    }

    // Fetch codebook entries + existing themes
    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const [codesRes, themesRes] = await Promise.all([
                fetch(`/api/codebook?projectId=${projectId}`),
                fetch(`/api/projects/${projectId}/themes`)
            ])

            const allCodes = await codesRes.json()
            const allThemes = await themesRes.json()

            setThemes(Array.isArray(allThemes) ? allThemes : [])

            // Determine which codes are already assigned to themes
            const assignedCodeIds = new Set<string>()
            if (Array.isArray(allThemes)) {
                allThemes.forEach((theme: ThemeData) => {
                    theme.codeLinks?.forEach(link => {
                        assignedCodeIds.add(link.codebookEntry.id)
                    })
                })
            }

            // Filter to unassigned codes only
            const unassigned = (Array.isArray(allCodes) ? allCodes : [])
                .filter((c: any) => !assignedCodeIds.has(c.id))
                .map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    type: c.type === 'RAW' ? (c.name ? 'AI' : 'HUMAN') : c.type,
                    instances: c._count?.codeAssignments ?? 0,
                    definition: c.definition
                }))

            // Infer type from how the codebook entry was created
            // If it has AI suggestion links, mark as AI, else HUMAN  
            const enriched = unassigned.map((code: CodeEntry) => {
                // Find the original code to check assignments
                const origCode = allCodes.find((c: any) => c.id === code.id)
                const hasAISuggestion = origCode?.codeAssignments?.some((a: any) => a.aiSuggestionId)
                return {
                    ...code,
                    type: hasAISuggestion ? 'AI' : 'HUMAN'
                }
            })

            setUnassignedCodes(enriched)
        } catch (e) {
            console.error('Failed to fetch data:', e)
        } finally {
            setLoading(false)
        }
    }, [projectId])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    // Generate AI theme suggestions
    const generateSuggestions = useCallback(async () => {
        setSuggestionsLoading(true)
        try {
            const res = await fetch(`/api/projects/${projectId}/themes/suggest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customPrompt: themePrompt })
            })
            const data = await res.json()
            setThemeSuggestions(data.suggestions || [])
        } catch (e) {
            console.error('Failed to generate suggestions:', e)
        } finally {
            setSuggestionsLoading(false)
        }
    }, [projectId, themePrompt])

    // Auto-generate suggestions when codes are loaded
    useEffect(() => {
        if (unassignedCodes.length >= 2 && themeSuggestions.length === 0 && !suggestionsLoading) {
            generateSuggestions()
        }
    }, [unassignedCodes, themeSuggestions.length, suggestionsLoading, generateSuggestions])

    // Accept a theme suggestion → create theme in DB
    const acceptSuggestion = async (index: number) => {
        const suggestion = themeSuggestions[index]
        if (!suggestion) return

        setAcceptingId(index)
        try {
            const res = await fetch(`/api/projects/${projectId}/themes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: suggestion.name,
                    description: suggestion.description,
                    codeIds: suggestion.codes.map(c => c.id)
                })
            })

            if (res.ok) {
                // Remove accepted suggestion
                setThemeSuggestions(prev => prev.filter((_, i) => i !== index))
                // Refresh data
                await fetchData()
            }
        } catch (e) {
            console.error('Failed to accept theme:', e)
        } finally {
            setAcceptingId(null)
        }
    }

    const totalCodes = unassignedCodes.length + themes.reduce((acc, t) => acc + (t.codeLinks?.length || 0), 0)
    const assignedCount = themes.reduce((acc, t) => acc + (t.codeLinks?.length || 0), 0)

    return (
        <div className="flex h-full bg-white text-slate-800">
            {/* Main Content Column */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="flex-shrink-0 border-b border-slate-200 bg-white">
                    <div className="px-8 flex items-center justify-between h-20">
                        <h1 className="text-[22px] font-extrabold tracking-tight">Themes</h1>
                        <button
                            onClick={() => {
                                const name = prompt('Enter theme name:')
                                if (name?.trim()) {
                                    fetch(`/api/projects/${projectId}/themes`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ name: name.trim() })
                                    }).then(() => fetchData())
                                }
                            }}
                            className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-900 transition-colors shadow-sm"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                            New Theme
                        </button>
                    </div>
                    
                    <div className="px-8 flex items-center justify-between">
                        <div className="flex items-center space-x-8">
                            {['Builder', 'Thematic Map', 'Codebook'].map(tab => (
                                <button 
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`py-4 text-[13px] font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === tab ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                >
                                    {tab === 'Builder' && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={activeTab === 'Builder' ? "text-indigo-600" : "text-slate-400"}><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>}
                                    {tab === 'Thematic Map' && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={activeTab === 'Thematic Map' ? "text-indigo-600" : "text-slate-400"}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>}
                                    {tab === 'Codebook' && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={activeTab === 'Codebook' ? "text-indigo-600" : "text-slate-400"}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>}
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Tab-Content Area — relative so overlays only cover this area, not the header/tabs above */}
                <div className="flex-1 overflow-hidden relative">
                {/* Builder Layout — fills the space */}
                <div className="absolute inset-0 flex overflow-hidden">
                    {/* Left Panel: Unassigned Codes */}
                    <div 
                        className="w-[300px] border-r border-slate-200 bg-slate-50/50 flex flex-col flex-shrink-0"
                        onDragOver={handleDragOver}
                        onDrop={handleDropOnUnassigned}
                    >
                        <div className="p-4 border-b border-slate-200/50 flex items-center justify-between">
                            <h2 className="text-sm font-bold flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                                Unassigned Codes
                            </h2>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={runCodeClean}
                                    disabled={cleanLoading || unassignedCodes.length === 0}
                                    className="text-[10px] font-bold text-orange-600 hover:text-orange-800 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-2 py-1 rounded-lg transition-colors disabled:opacity-40 flex items-center gap-1"
                                    title="AI code cleanup: duplicates, low-quality, mergeable"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                                    {cleanLoading ? '...' : 'Clean'}
                                </button>
                                <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full shadow-sm">
                                    {unassignedCodes.length}
                                </span>
                            </div>
                        </div>

                        {/* Code Clean Panel */}
                        {showCleanPanel && (
                            <div className="border-b border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 max-h-[50%] overflow-y-auto custom-scrollbar flex-shrink-0">
                                <div className="px-3 py-2 flex items-center justify-between border-b border-orange-100">
                                    <span className="text-[10px] font-extrabold text-orange-700 uppercase tracking-widest flex items-center gap-1">
                                        ✦ Code Cleanup ({cleanSuggestions.length})
                                    </span>
                                    <button onClick={() => setShowCleanPanel(false)} className="text-orange-400 hover:text-orange-700 text-xs">✕</button>
                                </div>
                                {cleanLoading ? (
                                    <div className="flex items-center justify-center py-6 text-orange-500">
                                        <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                        <span className="text-[11px] font-semibold">Analyzing codes...</span>
                                    </div>
                                ) : cleanSuggestions.length === 0 ? (
                                    <div className="p-3 text-center">
                                        <p className="text-[11px] font-semibold text-orange-600">All codes look good! ✓</p>
                                        <p className="text-[10px] text-orange-400 mt-0.5">No duplicates or low-quality codes detected.</p>
                                    </div>
                                ) : (
                                    <div className="p-2 space-y-1.5">
                                        {cleanSuggestions.map(cs => (
                                            <div key={cs.codeId} className="bg-white border border-orange-200 rounded-lg p-2 shadow-sm">
                                                <div className="flex items-start justify-between gap-1 mb-1">
                                                    <span className="text-[11px] font-bold text-slate-800 leading-tight">{cs.codeName}</span>
                                                    <span className={`text-[8px] font-extrabold px-1 py-0.5 rounded flex-shrink-0 ${cs.action === 'DROP' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{cs.action}</span>
                                                </div>
                                                <ul className="mb-1.5">
                                                    {(cs.reasons || []).slice(0, 2).map((r, i) => (
                                                        <li key={i} className="text-[9px] text-slate-500">• {r}</li>
                                                    ))}
                                                </ul>
                                                <div className="flex gap-1">
                                                    <button onClick={() => applyCleanAction(cs)} className={`flex-1 text-[9px] font-bold py-0.5 rounded transition-colors ${cs.action === 'DROP' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                                                        {cs.action === 'DROP' ? '✕ Drop' : '↗ Merge'}
                                                    </button>
                                                    <button onClick={() => setCleanSuggestions(prev => prev.filter(s => s.codeId !== cs.codeId))} className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Keep</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="p-4 flex-1 overflow-y-auto custom-scrollbar space-y-3">
                            <p className="text-xs text-slate-400 mb-4 font-medium">Drag codes to themes on the right</p>
                            
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                    <svg className="w-6 h-6 animate-spin mb-3" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    <span className="text-xs font-medium">Loading codes...</span>
                                </div>
                            ) : unassignedCodes.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
                                    </div>
                                    <p className="text-xs font-semibold text-slate-500 mb-1">No unassigned codes</p>
                                    <p className="text-[11px] text-slate-400">All codes have been assigned to themes, or no codes exist yet. Run AI analysis on transcripts first.</p>
                                </div>
                            ) : (
                                unassignedCodes.map(code => (
                                    <div 
                                        key={code.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, { codeId: code.id })}
                                        className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all cursor-grab active:cursor-grabbing group"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <h3 className="text-[13px] font-bold text-slate-800 leading-snug pr-4">{code.name}</h3>
                                            <button className="text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[11px] font-medium text-slate-500">{code.instances} instances</span>
                                                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${code.type === 'HUMAN' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                                    {code.type}
                                                </span>
                                            </div>
                                            <button 
                                                onClick={() => openTrace(code.id, code.name)} 
                                                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                                title="View original quotes"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/></svg>
                                                Trace
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Center Panel: Built Themes */}
                    <div className="flex-1 bg-slate-50 relative flex flex-col overflow-hidden">
                        <div className="absolute inset-0 z-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] opacity-70"></div>
                        
                        {themes.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center relative z-10">
                                <div className="bg-white border border-slate-200/80 rounded-3xl p-12 max-w-md w-full shadow-xl shadow-slate-200/40 text-center mx-8">
                                    <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-slate-200/50">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
                                    </div>
                                    <h2 className="text-xl font-extrabold text-slate-800 mb-2">No themes yet</h2>
                                    <p className="text-sm font-medium text-slate-500 mb-8 leading-relaxed">
                                        Click &quot;+ New Theme&quot; to create your first category, then drag codes from the left panel.
                                    </p>
                                    <button
                                        onClick={() => {
                                            const name = prompt('Enter theme name:')
                                            if (name?.trim()) {
                                                fetch(`/api/projects/${projectId}/themes`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ name: name.trim() })
                                                }).then(() => fetchData())
                                            }
                                        }}
                                        className="bg-indigo-600 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-md hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 mx-auto w-full max-w-[200px]"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                                        Create First Theme
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto p-6 relative z-10 custom-scrollbar">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-4xl mx-auto">
                                    {themes.map(theme => (
                                        <div 
                                            key={theme.id} 
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => handleDropOnTheme(e, theme.id)}
                                            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative group/card"
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <h3 className="text-sm font-extrabold text-slate-800">{theme.name}</h3>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => deleteTheme(theme.id, theme.name)}
                                                        title="Delete theme"
                                                        className="opacity-0 group-hover/card:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-md"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                                                    </button>
                                                </div>
                                            </div>
                                            {theme.description && (
                                                <p className="text-xs text-slate-500 mb-3 leading-relaxed line-clamp-2">{theme.description}</p>
                                            )}
                                            <div className="flex flex-wrap gap-1.5 mb-3 min-h-[30px] p-2 -mx-2 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                                                {theme.codeLinks?.length === 0 && (
                                                    <div className="text-[10px] text-slate-400 font-medium italic mx-auto w-full text-center py-1">Drop codes here</div>
                                                )}
                                                {theme.codeLinks?.map(link => (
                                                    <span 
                                                        key={link.codebookEntry.id} 
                                                        draggable
                                                        onDragStart={(e) => {
                                                            e.stopPropagation()
                                                            handleDragStart(e, { codeId: link.codebookEntry.id, fromThemeId: theme.id })
                                                        }}
                                                        className="group flex items-center gap-1 bg-white border border-indigo-200 text-indigo-700 text-[10px] font-semibold pl-2 pr-1 py-1 rounded-md shadow-sm cursor-grab active:cursor-grabbing hover:border-indigo-400"
                                                    >
                                                        {link.codebookEntry.name}
                                                        <div className="flex gap-0.5 border-l border-indigo-100 pl-1 ml-1">
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    openTrace(link.codebookEntry.id, link.codebookEntry.name)
                                                                }}
                                                                title="View quotes"
                                                                className="text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 p-0.5 rounded transition-colors"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/></svg>
                                                            </button>
                                                            <button 
                                                                onClick={async (e) => {
                                                                    e.stopPropagation()
                                                                    await fetch(`/api/projects/${projectId}/themes`, {
                                                                        method: 'PATCH',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ themeId: theme.id, action: 'REMOVE_CODE', codeId: link.codebookEntry.id })
                                                                    })
                                                                    fetchData()
                                                                }}
                                                                title="Remove code from theme"
                                                                className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-0.5 rounded transition-colors"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                                            </button>
                                                        </div>
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="text-[11px] font-medium text-slate-400">
                                                {theme.codeLinks?.length || 0} codes assigned
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                {/* Thematic Map Tab */}
                {activeTab === 'Thematic Map' && (() => {
                    const PALETTE = [
                        { border: 'border-indigo-300', text: 'text-indigo-500', dot: 'bg-indigo-500', light: 'bg-indigo-50' },
                        { border: 'border-pink-300', text: 'text-pink-500', dot: 'bg-pink-500', light: 'bg-pink-50' },
                        { border: 'border-amber-300', text: 'text-amber-500', dot: 'bg-amber-500', light: 'bg-amber-50' },
                        { border: 'border-emerald-300', text: 'text-emerald-500', dot: 'bg-emerald-500', light: 'bg-emerald-50' },
                        { border: 'border-violet-300', text: 'text-violet-500', dot: 'bg-violet-500', light: 'bg-violet-50' },
                        { border: 'border-cyan-300', text: 'text-cyan-500', dot: 'bg-cyan-500', light: 'bg-cyan-50' },
                        { border: 'border-rose-300', text: 'text-rose-500', dot: 'bg-rose-500', light: 'bg-rose-50' },
                    ]
                    const maxCodes = Math.max(1, ...themes.map(t => t.codeLinks?.length || 0))
                    return (
                        <div className="absolute inset-0 bg-white z-20 flex flex-col overflow-hidden">
                            {/* Header */}
                            <div className="flex-shrink-0 px-6 py-3 border-b border-slate-200 flex items-center justify-between bg-white">
                                <div>
                                    <h2 className="text-base font-extrabold text-slate-800">Thematic Map</h2>
                                    <p className="text-[11px] text-slate-400">Click a bubble to explore codes &amp; original quotes</p>
                                </div>
                                <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-3 py-1 rounded-full">{themes.length} themes · {assignedCount} codes</span>
                            </div>
                            <div className="flex-1 flex overflow-hidden">
                                {/* Canvas */}
                                <div className="flex-1 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 relative overflow-hidden">
                                    {/* Subtle grid */}
                                    <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_0.8px,transparent_0.8px)] [background-size:24px_24px] opacity-40" />
                                    
                                    {themes.length === 0 ? (
                                        <div className="flex items-center justify-center h-full">
                                            <p className="text-sm font-bold text-slate-300">No themes yet — create some in Builder</p>
                                        </div>
                                    ) : (() => {
                                        // Circular layout around center
                                        const cx = 50, cy = 48 // center %
                                        const radius = themes.length <= 3 ? 28 : themes.length <= 5 ? 32 : 35
                                        const angleStep = (2 * Math.PI) / themes.length
                                        const startAngle = -Math.PI / 2 // start from top
                                        
                                        const nodePositions = themes.map((_, i) => ({
                                            x: cx + radius * Math.cos(startAngle + i * angleStep),
                                            y: cy + radius * Math.sin(startAngle + i * angleStep),
                                        }))

                                        // Find connections: themes that share code-name keywords
                                        const connections: Array<{ from: number; to: number; strength: number }> = []
                                        for (let i = 0; i < themes.length; i++) {
                                            for (let j = i + 1; j < themes.length; j++) {
                                                const words1 = themes[i].codeLinks?.flatMap(l => l.codebookEntry.name.toLowerCase().split(/\s+/)) || []
                                                const words2Set = new Set(themes[j].codeLinks?.flatMap(l => l.codebookEntry.name.toLowerCase().split(/\s+/)) || [])
                                                const shared = words1.filter(w => words2Set.has(w) && w.length > 3).length
                                                if (shared > 0) connections.push({ from: i, to: j, strength: Math.min(shared, 4) })
                                            }
                                        }

                                        return (
                                            <>
                                                {/* SVG Connections Layer */}
                                                <svg className="absolute inset-0 w-full h-full pointer-events-none z-[1]">
                                                    <defs>
                                                        <filter id="glow">
                                                            <feGaussianBlur stdDeviation="2" result="blur"/>
                                                            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                                                        </filter>
                                                    </defs>
                                                    {/* Lines from center to each node */}
                                                    {nodePositions.map((pos, idx) => {
                                                        const isSelected = mapSelectedTheme?.id === themes[idx].id
                                                        return (
                                                            <line
                                                                key={`center-${idx}`}
                                                                x1={`${cx}%`} y1={`${cy}%`}
                                                                x2={`${pos.x}%`} y2={`${pos.y}%`}
                                                                stroke={isSelected ? '#6366f1' : '#cbd5e1'}
                                                                strokeWidth={isSelected ? 2.5 : 1.5}
                                                                strokeDasharray={isSelected ? 'none' : '6 4'}
                                                                opacity={isSelected ? 0.8 : 0.5}
                                                                className="transition-all duration-300"
                                                            />
                                                        )
                                                    })}
                                                    {/* Connections between related themes */}
                                                    {connections.map((conn, ci) => (
                                                        <line
                                                            key={`conn-${ci}`}
                                                            x1={`${nodePositions[conn.from].x}%`}
                                                            y1={`${nodePositions[conn.from].y}%`}
                                                            x2={`${nodePositions[conn.to].x}%`}
                                                            y2={`${nodePositions[conn.to].y}%`}
                                                            stroke="#a78bfa"
                                                            strokeWidth={conn.strength * 0.8}
                                                            strokeDasharray="4 6"
                                                            opacity={0.35}
                                                        />
                                                    ))}
                                                </svg>

                                                {/* Central hub */}
                                                <div
                                                    className="absolute z-[2] flex flex-col items-center"
                                                    style={{ top: `${cy}%`, left: `${cx}%`, transform: 'translate(-50%, -50%)' }}
                                                >
                                                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-200 flex items-center justify-center border-2 border-white">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>
                                                        </svg>
                                                    </div>
                                                    <p className="text-[9px] font-extrabold text-indigo-500 mt-1.5 uppercase tracking-wider">Research</p>
                                                </div>

                                                {/* Theme nodes */}
                                                {themes.map((theme, idx) => {
                                                    const count = theme.codeLinks?.length || 0
                                                    const p = PALETTE[idx % PALETTE.length]
                                                    const pos = nodePositions[idx]
                                                    const ratio = count / maxCodes
                                                    const size = Math.round(64 + ratio * 48)
                                                    const isSelected = mapSelectedTheme?.id === theme.id
                                                    const colorHex = ['#6366f1','#ec4899','#f59e0b','#10b981','#8b5cf6','#06b6d4','#f43f5e'][idx % 7]
                                                    return (
                                                        <div
                                                            key={theme.id}
                                                            className="absolute z-[3] flex flex-col items-center cursor-pointer group"
                                                            style={{ top: `${pos.y}%`, left: `${pos.x}%`, transform: 'translate(-50%, -50%)' }}
                                                            onClick={() => setMapSelectedTheme(isSelected ? null : theme)}
                                                        >
                                                            {/* Glow ring on selected */}
                                                            {isSelected && (
                                                                <div 
                                                                    className="absolute rounded-full animate-ping opacity-20"
                                                                    style={{ width: size + 16, height: size + 16, backgroundColor: colorHex }}
                                                                />
                                                            )}
                                                            <div
                                                                className={`rounded-full flex flex-col items-center justify-center shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl ${
                                                                    isSelected ? 'ring-4 ring-offset-2 scale-110' : ''
                                                                }`}
                                                                style={{ 
                                                                    width: size, height: size,
                                                                    background: `linear-gradient(135deg, ${colorHex}15, ${colorHex}30)`,
                                                                    border: `${count === 0 ? 2 : count < 3 ? 3 : 4}px solid ${colorHex}`,
                                                                    boxShadow: isSelected ? `0 0 0 4px ${colorHex}40` : undefined,
                                                                }}
                                                            >
                                                                <span style={{ color: colorHex }} className="font-extrabold text-xl leading-none">{count}</span>
                                                                <span className="text-[8px] text-slate-400 font-bold mt-0.5">codes</span>
                                                            </div>
                                                            <div className="mt-2 text-center max-w-[120px]">
                                                                <p className={`text-[10px] font-extrabold leading-tight ${isSelected ? 'text-indigo-600' : 'text-slate-700'}`}>
                                                                    {theme.name.length > 22 ? theme.name.slice(0, 20) + '…' : theme.name}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </>
                                        )
                                    })()}
                                </div>

                                {/* Right panel: legend or detail */}
                                <div className="w-72 border-l border-slate-200 bg-white flex flex-col overflow-hidden">
                                    {mapSelectedTheme ? (
                                        <>
                                            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                                <div>
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Theme</p>
                                                    <h3 className="text-sm font-extrabold text-slate-800 mt-0.5">{mapSelectedTheme.name}</h3>
                                                </div>
                                                <button onClick={() => setMapSelectedTheme(null)} className="w-7 h-7 flex items-center justify-center rounded-full border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                                </button>
                                            </div>
                                            {mapSelectedTheme.description && (
                                                <p className="px-4 py-2 text-[11px] text-slate-500 border-b border-slate-100 leading-relaxed">{mapSelectedTheme.description}</p>
                                            )}
                                            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                                                {mapSelectedTheme.codeLinks?.length === 0 ? (
                                                    <p className="text-xs text-slate-300 italic text-center py-8">No codes assigned yet</p>
                                                ) : mapSelectedTheme.codeLinks?.map(link => (
                                                    <div key={link.codebookEntry.id} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 hover:border-indigo-200 transition-colors group">
                                                        <div className="flex items-start justify-between">
                                                            <p className="text-[12px] font-bold text-slate-700 leading-snug">{link.codebookEntry.name}</p>
                                                            <button
                                                                onClick={() => openTrace(link.codebookEntry.id, link.codebookEntry.name)}
                                                                title="View original quotes"
                                                                className="flex-shrink-0 ml-2 flex items-center gap-1 text-[10px] font-bold text-indigo-500 hover:text-indigo-700 bg-white border border-indigo-100 px-1.5 py-0.5 rounded hover:bg-indigo-50 transition-colors"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/></svg>
                                                                Trace
                                                            </button>
                                                        </div>
                                                        {link.codebookEntry.definition && (
                                                            <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{link.codebookEntry.definition}</p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="bg-[#1C1A3A] px-4 py-3 text-white flex gap-2 items-center text-xs font-bold flex-shrink-0">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                                                All Themes ({themes.length})
                                            </div>
                                            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                                                {themes.map((theme, idx) => {
                                                    const count = theme.codeLinks?.length || 0
                                                    const p = PALETTE[idx % PALETTE.length]
                                                    return (
                                                        <button key={theme.id} onClick={() => setMapSelectedTheme(theme)} className="w-full flex items-start gap-3 bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors text-left">
                                                            <div className={`w-2.5 h-2.5 rounded-full ${p.dot} mt-0.5 flex-shrink-0`} />
                                                            <div className="min-w-0">
                                                                <p className="text-[11px] font-bold text-slate-800 truncate">{theme.name}</p>
                                                                <p className="text-[9px] text-slate-400 mt-0.5">{count} code{count !== 1 ? 's' : ''} · Click to explore</p>
                                                            </div>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })()}

                {/* Codebook Tab */}
                {activeTab === 'Codebook' && (
                    <div className="absolute inset-0 bg-white z-20 flex flex-col overflow-hidden">
                        <div className="flex-shrink-0 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-extrabold text-slate-800">Codebook for themes</h2>
                                <p className="text-[11px] text-slate-400">Structured codebook — Theme, Code, Sample Excerpt, Sentiment</p>
                            </div>
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-3 py-1 rounded-full">{themes.length} themes · {assignedCount} codes</span>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {themes.length === 0 ? (
                                <div className="flex items-center justify-center h-full">
                                    <p className="text-sm font-bold text-slate-300">No themes yet — create some in Builder</p>
                                </div>
                            ) : (
                                <div className="border-b border-slate-200">
                                    <table className="w-full text-left text-sm text-slate-600">
                                        <thead className="bg-slate-50 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-6 py-3 border-b border-r border-slate-200 w-[18%] text-xs font-bold uppercase tracking-wide text-slate-500">Theme</th>
                                                <th className="px-6 py-3 border-b border-r border-slate-200 w-[24%] text-xs font-bold uppercase tracking-wide text-slate-500">Code</th>
                                                <th className="px-6 py-3 border-b border-r border-slate-200 text-xs font-bold uppercase tracking-wide text-slate-500">Sample Excerpt</th>
                                                <th className="px-6 py-3 border-b border-slate-200 w-[100px] text-xs font-bold uppercase tracking-wide text-slate-500 text-center">Sentiment</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {themes.flatMap((theme) =>
                                                theme.codeLinks && theme.codeLinks.length > 0 ? theme.codeLinks.map((link, lIdx) => (
                                                    <CodebookRow 
                                                        key={link.codebookEntry.id}
                                                        theme={theme}
                                                        link={link}
                                                        isFirstInTheme={lIdx === 0}
                                                        themeRowSpan={theme.codeLinks.length}
                                                        onTrace={(codeId, codeName) => openTrace(codeId, codeName)}
                                                        projectId={projectId}
                                                    />
                                                )) : [
                                                    <tr key={`empty-${theme.id}`}>
                                                        <td className="px-6 py-4 border-b border-r border-slate-200 font-extrabold text-slate-700 text-[13px]">{theme.name}</td>
                                                        <td colSpan={3} className="px-6 py-4 border-b border-slate-200 text-[12px] italic text-slate-300">No codes assigned yet</td>
                                                    </tr>
                                                ]
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                </div>
            </div>

            {/* Right Panel: AI Suggestions — only on Builder tab */}
            {activeTab === 'Builder' && <div className="w-[360px] bg-slate-50 flex flex-col flex-shrink-0 border-l border-slate-200 z-10">
                <div className="p-6 pb-4 bg-[#3E3A86] text-white">
                    <h2 className="text-[17px] font-extrabold flex items-center gap-2 mb-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-300"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
                        AI Theme Suggestions
                    </h2>
                    <p className="text-xs text-indigo-200/80 font-medium">Based on code co-occurrence</p>
                </div>

                {/* Prompt Editor Toggle */}
                <div className="border-b border-slate-200 bg-white">
                    <button
                        onClick={() => setShowPromptEditor(!showPromptEditor)}
                        className="w-full px-5 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                            <span className="text-[11px] font-bold text-slate-600">View/Edit Prompt</span>
                            {themePrompt !== DEFAULT_THEME_PROMPT && <span className="text-[8px] font-extrabold bg-amber-50 text-amber-600 px-1 py-0.5 rounded">MODIFIED</span>}
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-slate-400 transition-transform ${showPromptEditor ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                    {showPromptEditor && (
                        <div className="px-4 pb-3">
                            <div className="flex items-center justify-between mb-1.5">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">AI Instructions</p>
                                {themePrompt !== DEFAULT_THEME_PROMPT && (
                                    <button onClick={() => setThemePrompt(DEFAULT_THEME_PROMPT)} className="text-[9px] font-bold text-indigo-500 hover:text-indigo-700 flex items-center gap-0.5">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                                        Reset
                                    </button>
                                )}
                            </div>
                            <textarea
                                value={themePrompt}
                                onChange={e => setThemePrompt(e.target.value)}
                                className="w-full h-36 text-[10px] p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-y font-mono leading-relaxed custom-scrollbar bg-slate-50"
                            />
                        </div>
                    )}
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4 bg-slate-50">
                    {suggestionsLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 text-indigo-400">
                            <svg className="w-8 h-8 animate-spin mb-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            <span className="text-sm font-bold text-indigo-600">Analyzing code patterns...</span>
                            <span className="text-xs text-indigo-400 mt-1">AI is grouping your codes into themes</span>
                        </div>
                    ) : themeSuggestions.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                            </div>
                            <p className="text-xs font-bold text-slate-600 mb-1">No suggestions yet</p>
                            <p className="text-[11px] text-slate-400 mb-4">Need at least 2 codes to generate theme suggestions.</p>
                            {unassignedCodes.length >= 2 && (
                                <button
                                    onClick={generateSuggestions}
                                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors"
                                >
                                    Generate Suggestions
                                </button>
                            )}
                        </div>
                    ) : (
                        themeSuggestions.map((suggestion, idx) => (
                            <div key={idx} className="bg-indigo-50 border border-indigo-100/80 rounded-xl p-4 shadow-sm relative overflow-hidden">
                                <div className="relative z-10">
                                    <div className="flex items-start justify-between mb-2 gap-2">
                                        <h3 className="text-sm font-extrabold text-slate-800 leading-tight">{suggestion.name}</h3>
                                        <div className="flex gap-1 flex-wrap justify-end items-center">
                                            {suggestion.confidenceScore !== undefined && (
                                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-sm tracking-wide ${
                                                    suggestion.confidenceScore >= 80 ? 'bg-emerald-100 text-emerald-700' :
                                                    suggestion.confidenceScore >= 50 ? 'bg-amber-100 text-amber-700' :
                                                    'bg-rose-100 text-rose-700'
                                                }`}>
                                                    {suggestion.confidenceScore}% conf
                                                </span>
                                            )}
                                            {suggestion.tags?.map(tag => (
                                                <span key={tag} className="bg-[#E5DFFF] text-[#554CB1] text-[10px] font-extrabold px-2 py-0.5 rounded-sm tracking-wide">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <p className="text-[12px] text-[#474DBB] font-medium leading-relaxed mb-2 pr-1">
                                        {suggestion.description}
                                    </p>
                                    {/* Reasoning */}
                                    {suggestion.reason && (
                                        <div className="bg-white/60 border border-indigo-100 rounded-lg p-2.5 mb-3">
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                                                Reasoning
                                            </p>
                                            <p className="text-[11px] text-slate-600 leading-relaxed">{suggestion.reason}</p>
                                        </div>
                                    )}
                                    <div className="flex flex-wrap gap-1.5 mb-4">
                                        {suggestion.codes?.map(code => (
                                            <span key={code.id || code.name} className="bg-white border text-indigo-700/80 border-indigo-100 text-[11px] font-semibold px-2 py-1 rounded shadow-sm">
                                                {code.name}
                                            </span>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => acceptSuggestion(idx)}
                                        disabled={acceptingId === idx}
                                        className="w-full py-2 bg-[#5B55D6] hover:bg-[#4C47B2] disabled:bg-indigo-300 text-white text-[13px] font-extrabold rounded-md shadow-sm transition-colors flex items-center justify-center gap-1.5 focus:ring-4 focus:ring-indigo-100 outline-none"
                                    >
                                        {acceptingId === idx ? (
                                            <>
                                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                </svg>
                                                Creating...
                                            </>
                                        ) : (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                                                Accept as Theme
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                
                {/* Progress Sidebar Bottom */}
                <div className="p-6 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
                    <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-4">Progress</h4>
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-[13px] font-bold text-slate-800 mb-2">
                                <span>Codes assigned</span>
                                <span>{assignedCount} / {totalCodes}</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                                    style={{ width: totalCodes > 0 ? `${(assignedCount / totalCodes) * 100}%` : '0%' }}
                                ></div>
                            </div>
                        </div>
                        <div className="flex justify-between text-[13px] font-bold text-slate-800">
                            <span>Themes created</span>
                            <span>{themes.length}</span>
                        </div>
                        <div className="flex justify-between text-[13px] font-bold text-slate-800">
                            <span>Codes dropped</span>
                            <span className="text-rose-500">0</span>
                        </div>
                    </div>
                </div>
            </div>}

            {/* Trace Quotes Modal */}
            {tracingCode && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500"><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/></svg>
                                    Code Tracing: {tracingCode.name}
                                </h2>
                                <p className="text-xs font-semibold text-slate-500 mt-0.5">Original quotes assigned to this code</p>
                            </div>
                            <button 
                                onClick={() => setTracingCode(null)}
                                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 bg-white border border-slate-200 rounded-full shadow-sm hover:bg-slate-50"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                        </div>
                        
                        {/* Content area */}
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                            {tracingLoading ? (
                                <div className="flex flex-col items-center justify-center py-16 text-indigo-400">
                                    <svg className="w-8 h-8 animate-spin mb-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    <span className="text-sm font-bold text-indigo-600">Retrieving quotes from transcripts...</span>
                                </div>
                            ) : tracingQuotes.length === 0 ? (
                                <div className="text-center py-12 text-slate-400">
                                    <p className="text-sm font-semibold">No quotes found for this code.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {tracingQuotes.map((tq: any) => (
                                        <div key={tq.transcriptId} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                                                <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>
                                                    {tq.transcriptName}
                                                </h3>
                                                <span className="text-[10px] font-bold text-slate-400">{tq.quotes.length} highlights</span>
                                            </div>
                                            <div className="divide-y divide-slate-100">
                                                {tq.quotes.map((q: any) => (
                                                    <div key={q.segmentId} className="p-4 hover:bg-slate-50/80 transition-colors group">
                                                        <p className="text-[13px] leading-relaxed text-slate-700 italic border-l-2 border-indigo-200 pl-3">"{q.text}"</p>
                                                        <div className="mt-3 flex items-center justify-between">
                                                            <div>
                                                                {q.confidence && (
                                                                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider bg-slate-100 text-slate-500">
                                                                        AI Conf: {q.confidence}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <button 
                                                                onClick={() => {
                                                                    router.push(`/projects/${tq.projectId}/transcripts/${tq.transcriptId}`)
                                                                }}
                                                                className="opacity-0 group-hover:opacity-100 text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded shadow-sm hover:bg-indigo-100 hover:text-indigo-800 transition-all flex items-center gap-1"
                                                            >
                                                                Go to source
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
