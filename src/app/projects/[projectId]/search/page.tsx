'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface SearchResult {
    transcriptId: string
    transcriptName: string
    datasetName: string
    segments: Array<{
        id: string
        text: string
        codes: Array<{ id: string, name: string }>
    }>
}

interface ParsedQuery {
    condition: 'AND' | 'OR'
    rules: Array<{ codeName: string, operator: 'INCLUDES' | 'EXCLUDES' }>
}

function HighlightedText({ text, query }: { text: string, query: string }) {
    if (!query) return <span>{text}</span>
    const parts = text.split(new RegExp(`(${query})`, 'gi'))
    return (
        <span>
            {parts.map((part, i) => 
                part.toLowerCase() === query.toLowerCase() 
                    ? <mark key={i} className="bg-amber-200 text-amber-900 rounded-[2px] px-0.5 font-medium">{part}</mark>
                    : part
            )}
        </span>
    )
}

export default function SearchPage() {
    const params = useParams()
    const router = useRouter()
    const projectId = params.projectId as string

    const [mode, setMode] = useState<'TEXT' | 'AI'>('TEXT')
    const [query, setQuery] = useState('')
    const [lastQuery, setLastQuery] = useState('')
    const [results, setResults] = useState<SearchResult[]>([])
    const [totalSegments, setTotalSegments] = useState(0)
    const [loading, setLoading] = useState(false)
    const [hasSearched, setHasSearched] = useState(false)
    
    // AI Mode specifics
    const [aiExplanation, setAiExplanation] = useState<string | null>(null)
    const [aiParsedQuery, setAiParsedQuery] = useState<ParsedQuery | null>(null)

    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        inputRef.current?.focus()
    }, [mode])

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        if (!query.trim()) return

        setLoading(true)
        setHasSearched(true)
        setLastQuery(query.trim())
        setAiExplanation(null)
        setAiParsedQuery(null)

        try {
            if (mode === 'TEXT') {
                const res = await fetch(`/api/projects/${projectId}/search?q=${encodeURIComponent(query)}`)
                const data = await res.json()
                setResults(data.results || [])
                setTotalSegments(data.totalSegments || 0)
            } else {
                const res = await fetch(`/api/projects/${projectId}/search/ai`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: query.trim() })
                })
                const data = await res.json()
                setResults(data.results || [])
                setTotalSegments(data.totalSegments || 0)
                setAiExplanation(data.explanation || null)
                setAiParsedQuery(data.parsedQuery || null)
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header / Search Bar */}
            <div className={`flex-shrink-0 border-b border-slate-200 px-8 py-8 flex flex-col items-center justify-center relative transition-colors ${mode === 'AI' ? 'bg-[#3E3A86] text-white shadow-inner' : 'bg-white'}`}>
                
                {/* Mode Toggle */}
                <div className="flex bg-slate-100/10 p-1 rounded-xl mb-6 border border-slate-200/20">
                    <button 
                        onClick={() => { setMode('TEXT'); setHasSearched(false); setQuery('') }}
                        className={`px-4 py-1.5 rounded-lg text-[12px] font-bold transition-all flex items-center gap-1.5 ${mode === 'TEXT' ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>
                        Keyword Search
                    </button>
                    <button 
                        onClick={() => { setMode('AI'); setHasSearched(false); setQuery('') }}
                        className={`px-4 py-1.5 rounded-lg text-[12px] font-bold transition-all flex items-center gap-1.5 ${mode === 'AI' ? 'bg-indigo-500 text-white shadow-sm border border-indigo-400' : 'text-slate-400 hover:text-slate-700'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                        AI Smart Filter
                    </button>
                </div>

                <form 
                    onSubmit={handleSearch}
                    className={`w-full max-w-2xl relative shadow-md rounded-2xl group ${mode === 'AI' ? 'ring-2 ring-indigo-400/50' : ''}`}
                >
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        {mode === 'AI' ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-300"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 group-focus-within:text-indigo-500 transition-colors"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                        )}
                    </div>
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder={mode === 'TEXT' ? "Search across all transcripts..." : "e.g. Find quotes coded with anxiety BUT NOT medication"}
                        className={`w-full pl-12 pr-24 py-4 rounded-2xl border-2 font-medium text-[15px] focus:outline-none transition-all shadow-inner ${
                            mode === 'AI' 
                                ? 'border-indigo-500/50 bg-[#2D2A68] text-white focus:bg-[#34307A] focus:border-indigo-300 placeholder:text-indigo-300/50' 
                                : 'border-slate-200 bg-slate-50 text-slate-800 focus:border-indigo-500 focus:bg-white placeholder:text-slate-400'
                        }`}
                    />
                    <div className="absolute inset-y-0 right-2 flex items-center">
                        <button
                            type="submit"
                            disabled={!query.trim() || loading}
                            className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50 ${
                                mode === 'AI' ? 'bg-indigo-500 hover:bg-indigo-400 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-slate-300'
                            }`}
                        >
                            {loading ? 'Searching...' : 'Search'}
                        </button>
                    </div>
                </form>
                {/* Micro-navigation / Hints */}
                <div className={`mt-4 flex items-center gap-4 text-[11px] font-medium ${mode === 'AI' ? 'text-indigo-200/70' : 'text-slate-400'}`}>
                    {mode === 'TEXT' ? (
                        <>
                            <span className="flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Case-insensitive</span>
                            <span className="flex items-center gap-1 opacity-50"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg> Text matching only</span>
                        </>
                    ) : (
                        <>
                            <span className="flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg> Converts natural language to Boolean (AND/OR/NOT)</span>
                            <span className="flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Filters by Assigned Codes</span>
                        </>
                    )}
                </div>
            </div>

            {/* Results Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                {!hasSearched ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-300">
                        {mode === 'TEXT' ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                        ) : (
                            <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                            </div>
                        )}
                        <p className="text-sm font-semibold text-slate-400">
                            {mode === 'TEXT' ? 'Enter a keyword to search text' : 'Ask AI to filter segments based on your codes'}
                        </p>
                    </div>
                ) : loading ? (
                    <div className="flex flex-col items-center justify-center h-full py-12">
                        <svg className="w-8 h-8 animate-spin text-indigo-400 mb-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span className="text-sm font-bold text-slate-500">
                            {mode === 'TEXT' ? 'Scanning transcripts...' : 'AI is translating query and filtering codes...'}
                        </span>
                    </div>
                ) : results.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-16 h-16 bg-slate-100 text-slate-300 rounded-2xl flex items-center justify-center mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><line x1="8" x2="14" y1="11" y2="11"/></svg>
                        </div>
                        <h3 className="text-base font-extrabold text-slate-700 mb-1">No results found</h3>
                        <p className="text-sm text-slate-400 max-w-md text-center">
                            {aiExplanation || `Couldn't find any segments matching "${lastQuery}".`}
                        </p>
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto space-y-6">
                        {/* Meta banner */}
                        <div className="flex items-start justify-between pb-4 border-b border-slate-200">
                            <div>
                                <h2 className="text-[14px] font-extrabold text-slate-800 flex items-center gap-2">
                                    Found {totalSegments} match{totalSegments !== 1 ? 'es' : ''} across {results.length} transcript{results.length !== 1 ? 's' : ''}
                                </h2>
                                {mode === 'AI' && aiExplanation && (
                                    <p className="text-[11px] text-slate-500 mt-1 font-medium italic border-l-2 border-indigo-200 pl-2">
                                        " {aiExplanation} "
                                    </p>
                                )}
                            </div>
                            
                            {/* Visual representation of the AI rule */}
                            {mode === 'AI' && aiParsedQuery && (
                                <div className="flex flex-wrap gap-1.5 justify-end max-w-sm mt-1">
                                    {aiParsedQuery.rules.map((rule, idx) => (
                                        <div key={idx} className="flex items-center gap-1 text-[10px] font-extrabold">
                                            {idx > 0 && <span className="text-slate-300 mx-0.5">{aiParsedQuery.condition}</span>}
                                            <span className={`px-2 py-0.5 rounded shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)] text-white uppercase tracking-wider ${rule.operator === 'INCLUDES' ? 'bg-indigo-500' : 'bg-rose-500'}`}>
                                                {rule.operator === 'EXCLUDES' ? 'NOT ' : ''}{rule.codeName}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {mode === 'TEXT' && (
                                <div className="text-[11px] font-bold text-slate-400 bg-white px-2 py-1 rounded border border-slate-200 mt-1">
                                    for "{lastQuery}"
                                </div>
                            )}
                        </div>

                        {/* Transcript Groups */}
                        {results.map((group) => (
                            <div key={group.transcriptId} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                {/* Group Header */}
                                <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>
                                        <h3 className="text-[13px] font-extrabold text-slate-800">{group.transcriptName}</h3>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1.5 py-0.5 bg-slate-200/50 rounded ml-2">
                                            {group.datasetName}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-400">{group.segments.length} segment{group.segments.length !== 1 ? 's' : ''}</span>
                                        <button 
                                            onClick={() => router.push(`/projects/${projectId}/transcripts/${group.transcriptId}`)}
                                            className="text-[10px] font-bold bg-white text-slate-600 border border-slate-200 px-2 py-1 rounded hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                                        >
                                            Open Document
                                        </button>
                                    </div>
                                </div>

                                {/* Segments */}
                                <div className="divide-y divide-slate-100">
                                    {group.segments.map((seg) => {
                                        // Which codes matched the rule?
                                        const aiTargetCodes = mode === 'AI' && aiParsedQuery ? aiParsedQuery.rules.map(r => r.codeName.toLowerCase()) : []
                                        
                                        return (
                                            <div key={seg.id} className="p-5 hover:bg-slate-50/50 transition-colors group/seg">
                                                <p className="text-[14px] leading-relaxed text-slate-700">
                                                    {mode === 'TEXT' ? (
                                                        <HighlightedText text={seg.text} query={lastQuery} />
                                                    ) : (
                                                        seg.text
                                                    )}
                                                </p>
                                                
                                                {/* Footer of segment: Codes + Action */}
                                                <div className="mt-3 flex items-center justify-between">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {seg.codes.length === 0 ? (
                                                            <span className="text-[10px] font-medium text-slate-300 italic">Uncoded</span>
                                                        ) : (
                                                            seg.codes.map(c => {
                                                                const isTarget = mode === 'AI' && aiTargetCodes.includes(c.name.toLowerCase())
                                                                return (
                                                                    <span key={c.id} className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold shadow-sm border
                                                                        ${isTarget ? 'bg-indigo-500 text-white border-indigo-600' : 'bg-indigo-50 border-indigo-100 text-indigo-700 opacity-60'}
                                                                    `}>
                                                                        {c.name}
                                                                    </span>
                                                                )
                                                            })
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => router.push(`/projects/${projectId}/transcripts/${group.transcriptId}?segment=${seg.id}`)}
                                                        className="opacity-0 group-hover/seg:opacity-100 flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-md transition-all ml-4 flex-shrink-0"
                                                    >
                                                        Go to source
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
