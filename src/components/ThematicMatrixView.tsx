'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// ─── Types ──────────────────────────────────────────────────────────────────

type CodeLink = {
    codebookEntry: {
        id: string
        name: string
        definition?: string | null
        participants?: { id: string; name: string }[]
    }
}

type ThemeData = {
    id: string
    name: string
    description: string | null
    status: string
    positionX?: number | null
    positionY?: number | null
    codeLinks: CodeLink[]
    participantsCount?: number
}

const PALETTE = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4', '#f43f5e', '#84cc16']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name: string) {
    return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function avatarColor(name: string) {
    const palette = [
        { bg: '#e0e7ff', text: '#4338ca' },
        { bg: '#fce7f3', text: '#be185d' },
        { bg: '#fef3c7', text: '#b45309' },
        { bg: '#d1fae5', text: '#065f46' },
        { bg: '#ede9fe', text: '#6d28d9' },
        { bg: '#cffafe', text: '#0e7490' },
        { bg: '#fee2e2', text: '#b91c1c' },
        { bg: '#d9f99d', text: '#365314' },
    ]
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    return palette[Math.abs(hash) % palette.length]
}

// ─── Cell Detail Panel ───────────────────────────────────────────────────────

function CellDetail({ participant, participantId, theme, codes, onClose }: {
    participant: string
    participantId: string
    theme: ThemeData
    codes: CodeLink[]
    onClose: () => void
}) {
    const av = avatarColor(participant)
    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
            <div
                className="relative bg-white rounded-[2rem] shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between flex-shrink-0 bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-[15px] font-black flex-shrink-0 shadow-lg rotate-3 group-hover:rotate-0 transition-transform" style={{ background: av.bg, color: av.text }}>
                            {initials(participant)}
                        </div>
                        <div>
                            <p className="text-[11px] text-indigo-500 font-black uppercase tracking-[0.1em] mb-0.5">{participant}</p>
                            <h3 className="text-[18px] font-black text-slate-800 leading-tight tracking-tight">{theme.name}</h3>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-white hover:border-slate-300 transition-all shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                </div>

                {/* Codes & Evidence */}
                <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 custom-scrollbar">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.15em]">
                            {codes.length} analytical code{codes.length > 1 ? 's' : ''} identified
                        </p>
                    </div>
                    {codes.map(link => (
                        <EvidenceCard 
                            key={link.codebookEntry.id} 
                            code={link.codebookEntry} 
                            participantId={participantId} 
                        />
                    ))}
                </div>
                
                {/* Footer Footer */}
                <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-center">
                    <p className="text-[10px] text-slate-400 font-bold italic">Analytical Trace: Cross-referencing {participant}'s experience with {theme.name}</p>
                </div>
            </div>
        </div>
    )
}

function EvidenceCard({ code, participantId }: { code: any, participantId: string }) {
    const router = useRouter()
    const [quotes, setQuotes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchEvidence = async () => {
            try {
                const res = await fetch(`/api/codebook/${code.id}/quotes`)
                if (res.ok) {
                    const data = await res.json()
                    // Filter quotes strictly for this participant
                    // The API returns { transcriptId, transcriptName, quotes: [...] }
                    const participantQuotes = data
                        .filter((t: any) => t.transcriptId === participantId)
                    
                    setQuotes(participantQuotes)
                }
            } catch (err) {}
            setLoading(false)
        }
        fetchEvidence()
    }, [code.id, participantId])

    return (
        <div className="group/card bg-white border border-slate-200 rounded-[1.5rem] overflow-hidden hover:border-indigo-200 hover:shadow-xl transition-all duration-300">
            <div className="px-5 py-4 bg-slate-50/50 border-b border-slate-100 flex items-start justify-between">
                <div className="flex-1">
                    <h4 className="text-[14px] font-black text-slate-800 leading-snug group-hover/card:text-indigo-600 transition-colors">{code.name}</h4>
                    {code.definition && <p className="text-[11px] text-slate-500 mt-1 italic leading-relaxed">{code.definition}</p>}
                </div>
            </div>
            
            <div className="p-5 space-y-4">
                {loading ? (
                    <div className="py-4 flex items-center gap-3 animate-pulse">
                        <div className="w-4 h-4 rounded-full bg-slate-200 animate-bounce"></div>
                        <span className="text-[11px] font-bold text-slate-300 tracking-wider">Locating evidence...</span>
                    </div>
                ) : quotes.length > 0 ? (
                    quotes.flatMap((t: any) => t.quotes.map((q: any) => (
                        <div key={q.segmentId} className="relative pl-4 border-l-4 border-indigo-100 hover:border-indigo-400 transition-colors">
                            <p className="text-[13px] text-slate-700 leading-relaxed italic">"{q.text}"</p>
                            <div className="mt-2.5 flex items-center justify-between">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>
                                    Source: {t.transcriptName}
                                </span>
                                <button 
                                    onClick={() => router.push(`/projects/${t.projectId}/transcripts/${t.transcriptId}?segment=${q.segmentId}`)}
                                    className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-indigo-100 flex items-center gap-1.5"
                                >
                                    Trace Insight
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                                </button>
                            </div>
                        </div>
                    )))
                ) : (
                    <p className="text-[11px] text-slate-400 font-bold italic">No transcript segments linked to this participant for this specific code.</p>
                )}
            </div>
        </div>
    )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ThematicMatrixView({ themes, assignedCount }: {
    themes: ThemeData[]
    assignedCount: number
}) {
    const [view, setView] = useState<'matrix' | 'saturation'>('matrix')
    const [selectedCell, setSelectedCell] = useState<{ participantId: string; themeId: string } | null>(null)
    const [hoveredParticipant, setHoveredParticipant] = useState<string | null>(null)
    const [hoveredTheme, setHoveredTheme] = useState<string | null>(null)

    // ── Derive all unique participants ────────────────────────────────────────
    const allParticipants = useMemo(() => {
        const map = new Map<string, string>()
        for (const theme of themes) {
            for (const link of theme.codeLinks) {
                for (const p of link.codebookEntry.participants || []) {
                    if (!map.has(p.id)) map.set(p.id, p.name)
                }
            }
        }
        return Array.from(map.entries())
            .map(([id, name]) => ({ id, name }))
            // Filter out ONLY very specific aggregate/hidden rows meant for system-wide stats
            .filter(p => {
                const n = p.name.toLowerCase().trim()
                // Only exclude the literal 'dataset_all' or 'all' aggregate rows
                return n !== 'dataset_all' && n !== 'all' && n !== 'dataset' && n !== 'aggregate'
            })
            .sort((a, b) => a.name.localeCompare(b.name))
    }, [themes])

    // ── For each (participant, theme) → list of matching codes ───────────────
    const getCellCodes = (participantId: string, themeId: string) => {
        const theme = themes.find(t => t.id === themeId)
        if (!theme) return []
        return theme.codeLinks.filter(link =>
            link.codebookEntry.participants?.some(p => p.id === participantId)
        )
    }

    // ── Saturation: for each theme, how many of all participants mentioned it ─
    const saturationData = useMemo(() => {
        const validParticipantIds = new Set(allParticipants.map(p => p.id))
        return themes.map((theme, idx) => {
            const themeParticipants = new Set<string>()
            for (const link of theme.codeLinks) {
                for (const p of link.codebookEntry.participants || []) {
                    if (validParticipantIds.has(p.id)) {
                        themeParticipants.add(p.id)
                    }
                }
            }
            const count = themeParticipants.size
            const total = allParticipants.length
            const coverage = total > 0 ? Math.round((count / total) * 100) : 0
            return {
                theme,
                count,
                total,
                coverage,
                color: PALETTE[idx % PALETTE.length],
            }
        }).sort((a, b) => b.coverage - a.coverage)
    }, [themes, allParticipants])

    const selectedCellData = selectedCell
        ? { codes: getCellCodes(selectedCell.participantId, selectedCell.themeId) }
        : null

    const selectedCellParticipant = selectedCell ? allParticipants.find(p => p.id === selectedCell.participantId) : null
    const selectedCellTheme = selectedCell ? themes.find(t => t.id === selectedCell.themeId) : null

    return (
        <div className="absolute inset-0 bg-[#f8fafc] z-20 flex flex-col overflow-hidden">

            {/* ── Toolbar ──────────────────────────────────────────────────── */}
            <div className="flex-shrink-0 px-6 py-3 border-b border-slate-200 flex items-center justify-between bg-white">
                <div>
                    <h2 className="text-[15px] font-extrabold text-slate-800">Thematic Analysis Views</h2>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                        {allParticipants.length} participants · {themes.length} themes · {assignedCount} codes
                    </p>
                </div>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setView('matrix')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${view === 'matrix' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h7v7H3z"/><path d="M14 3h7v7h-7z"/><path d="M14 14h7v7h-7z"/><path d="M3 14h7v7H3z"/></svg>
                        Cross-Theme Discovery
                    </button>
                    <button
                        onClick={() => setView('saturation')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${view === 'saturation' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>
                        Theme Saturation
                    </button>
                </div>
            </div>

            {/* ── MATRIX VIEW ──────────────────────────────────────────────── */}
            {view === 'matrix' && (
                <div className="flex-1 overflow-auto p-6 md:p-10">
                    <div className="max-w-[1400px] mx-auto space-y-8">
                        {/* Header Logic Explanation */}
                        <div className="bg-gradient-to-br from-indigo-50 to-white rounded-3xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden text-left border border-indigo-100">
                             <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500 opacity-[0.03] blur-[100px] rounded-full -mr-32 -mt-32"></div>
                             <div className="relative z-10 max-w-2xl">
                                <h3 className="text-xl font-black text-slate-800 mb-2 tracking-tight">Cross-Theme Discovery Canvas</h3>
                                <p className="text-[13px] text-slate-500 leading-relaxed font-medium">
                                    Compare <strong className="text-slate-800">Participants (rows)</strong> against <strong className="text-slate-800">Themes (columns)</strong> to find hidden patterns. 
                                    Darker cells indicate a higher frequency of quotes, showing which insights are most prominent for each person.
                                </p>
                            </div>
                            <div className="relative z-10 flex items-center gap-4 text-[10px] bg-white border border-indigo-100 p-3 rounded-xl px-5 shadow-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-sm bg-indigo-500/20 shadow-inner"></div>
                                    <span className="text-slate-500 font-bold uppercase tracking-wider">Mentioned</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-sm border border-dashed border-slate-300"></div>
                                    <span className="text-slate-400 font-bold uppercase tracking-wider">No Data</span>
                                </div>
                            </div>
                        </div>

                    {allParticipants.length === 0 || themes.length === 0 ? (
                        <div className="flex items-center justify-center py-20 text-slate-300">
                            <div className="text-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
                                <p className="text-sm font-bold">No data yet — assign codes to themes and participants first</p>
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto bg-white rounded-3xl border border-slate-200 shadow-sm p-4">
                            <table className="border-collapse" style={{ minWidth: themes.length * 150 + 180 }}>
                                <thead>
                                    <tr>
                                        {/* Top-left corner */}
                                        <th className="sticky left-0 z-20 bg-[#f8fafc] w-40 min-w-[160px]" />
                                        {themes.map((theme, idx) => {
                                            const color = PALETTE[idx % PALETTE.length]
                                            const isHovered = hoveredTheme === theme.id
                                            return (
                                                <th
                                                    key={theme.id}
                                                    className="pb-3 px-2 text-left align-bottom"
                                                    style={{ minWidth: 140 }}
                                                    onMouseEnter={() => setHoveredTheme(theme.id)}
                                                    onMouseLeave={() => setHoveredTheme(null)}
                                                >
                                                    <div
                                                        className="rounded-xl px-3 py-2.5 transition-all duration-150"
                                                        style={{
                                                            background: isHovered ? `${color}15` : `${color}08`,
                                                            borderTop: `3px solid ${color}`,
                                                        }}
                                                    >
                                                        <p className="text-[12px] font-extrabold text-slate-800 leading-snug line-clamp-2">{theme.name}</p>
                                                        <p className="text-[9px] text-slate-400 mt-1 font-semibold">{theme.codeLinks.length} codes</p>
                                                    </div>
                                                </th>
                                            )
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {allParticipants.map(participant => {
                                        const av = avatarColor(participant.name)
                                        const isRowHovered = hoveredParticipant === participant.id
                                        return (
                                            <tr key={participant.id}
                                                onMouseEnter={() => setHoveredParticipant(participant.id)}
                                                onMouseLeave={() => setHoveredParticipant(null)}
                                            >
                                                {/* Row header: participant */}
                                                <td className="sticky left-0 z-10 pr-4 py-1.5" style={{ background: '#f8fafc' }}>
                                                    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${isRowHovered ? 'bg-white shadow-sm' : ''}`}>
                                                        <div
                                                            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-extrabold flex-shrink-0"
                                                            style={{ background: av.bg, color: av.text }}
                                                        >
                                                            {initials(participant.name)}
                                                        </div>
                                                        <span className="text-[12px] font-bold text-slate-700 whitespace-nowrap truncate max-w-[90px]" title={participant.name}>
                                                            {participant.name}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Cells */}
                                                {themes.map((theme, idx) => {
                                                    const color = PALETTE[idx % PALETTE.length]
                                                    const codes = getCellCodes(participant.id, theme.id)
                                                    const active = codes.length > 0
                                                    const isCellSelected = selectedCell?.participantId === participant.id && selectedCell?.themeId === theme.id
                                                    const isColHovered = hoveredTheme === theme.id

                                                    return (
                                                        <td key={theme.id} className="py-2 px-1 text-center">
                                                            {active ? (
                                                                <button
                                                                    onClick={() => setSelectedCell({ participantId: participant.id, themeId: theme.id })}
                                                                    className="w-full min-h-[58px] rounded-xl border flex flex-col items-center justify-center gap-1 transition-all hover:scale-[1.03] hover:shadow-lg relative group/cell overflow-hidden cursor-pointer active:scale-95"
                                                                    style={{
                                                                        background: isCellSelected ? color : `${color}10`,
                                                                        borderColor: isCellSelected ? color : `${color}25`,
                                                                    }}
                                                                    title={`${participant.name} · ${theme.name} · ${codes.length} code(s)`}
                                                                >
                                                                    {/* Heatmap overlay based on frequency */}
                                                                    {!isCellSelected && (
                                                                        <div 
                                                                            className="absolute inset-0 opacity-[0.4] transition-opacity" 
                                                                            style={{ background: color, opacity: Math.min(0.05 + (codes.length * 0.1), 0.4) }}
                                                                        ></div>
                                                                    )}
                                                                    
                                                                    {/* Code count badge */}
                                                                    <div className="relative z-10 flex flex-col items-center">
                                                                        <span
                                                                            className="text-[13px] font-black tracking-tight"
                                                                            style={{ color: isCellSelected ? 'white' : color }}
                                                                        >
                                                                            {codes.length}
                                                                        </span>
                                                                        <span
                                                                            className="text-[8px] font-black uppercase tracking-[0.05em] mt-[-2px]"
                                                                            style={{ color: isCellSelected ? 'rgba(255,255,255,0.7)' : `${color}bb` }}
                                                                        >
                                                                            insight{codes.length > 1 ? 's' : ''}
                                                                        </span>
                                                                    </div>
                                                                </button>
                                                            ) : (
                                                                // Empty cell
                                                                <div
                                                                    className="w-full min-h-[52px] rounded-xl border border-dashed flex items-center justify-center transition-all"
                                                                    style={{
                                                                        borderColor: (isRowHovered || isColHovered) ? '#cbd5e1' : '#e2e8f0',
                                                                        background: (isRowHovered || isColHovered) ? '#f8fafc' : 'transparent',
                                                                    }}
                                                                >
                                                                    <span className="text-[10px] text-slate-300 select-none">—</span>
                                                                </div>
                                                            )}
                                                        </td>
                                                    )
                                                })}
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>

                            {/* Legend */}
                            <div className="mt-6 flex items-center gap-4 text-[10px] text-slate-400 font-semibold">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-4 h-4 rounded bg-indigo-100 border-2 border-indigo-300" />
                                    <span>Participant mentioned this theme</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-4 h-4 rounded border border-dashed border-slate-300" />
                                    <span>Not mentioned</span>
                                </div>
                                <span className="text-slate-300">· Click any cell to see codes</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

            {/* ── SATURATION VIEW ──────────────────────────────────────────── */}
            {view === 'saturation' && (
                <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-slate-50/50">
                    <div className="max-w-5xl mx-auto space-y-8">

                        {/* Premium Header Container */}
                        <div className="bg-gradient-to-br from-slate-50 to-white rounded-3xl p-6 md:p-10 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-8 relative overflow-hidden text-left border border-slate-200">
                                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500 opacity-[0.03] blur-[100px] rounded-full -mr-32 -mt-32"></div>
                                <div className="relative z-10 max-w-2xl">
                                <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight text-center md:text-left">Is your evidence strong enough?</h3>
                                <p className="text-[14px] text-slate-600 leading-relaxed font-medium">
                                    In qualitative research, a theme is <strong className="text-slate-900 font-extrabold">saturated</strong> when most participants share similar views. 
                                    This chart helps you identify patterns that are firmly grounded in your data versus those that need more evidence.
                                    <br/><br/>
                                    <span className="text-emerald-500 font-black">●</span> <strong className="text-emerald-700 font-extrabold">Everyone/Most:</strong> High saturation. The pattern is widely shared across the group.
                                    <br/>
                                    <span className="text-amber-500 font-black">●</span> <strong className="text-amber-700 font-extrabold">Some/Few:</strong> Low saturation. This might be a unique outlier or an emerging theme.
                                </p>
                            </div>
                            <div className="relative z-10 flex-shrink-0 bg-white border border-slate-200 p-6 rounded-2xl flex flex-col gap-4 min-w-[240px] shadow-sm">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Quick Legend</div>
                                <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[10px] font-black text-indigo-500 shadow-sm">AB</div>
                                    <div className="flex flex-col">
                                        <span className="text-[12px] text-slate-800 font-extrabold">Colored</span>
                                        <span className="text-[10px] text-slate-400 font-medium leading-none">Mentioned this theme</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400">AB</div>
                                    <div className="flex flex-col">
                                        <span className="text-[12px] text-slate-800 font-extrabold">Grayscale</span>
                                        <span className="text-[10px] text-slate-400 font-medium leading-none">Did not mention yet</span>
                                    </div>
                                </div>
                                <div className="mt-2 pt-3 border-t border-slate-100">
                                    <span className="text-[10px] text-slate-400 italic">Click any icon to trace its <strong className="text-indigo-600">Evidence</strong>.</span>
                                </div>
                            </div>
                        </div>

                        {/* Data Table */}
                        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                            <table className="w-full text-left border-collapse min-w-[700px]">
                                <thead>
                                    <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                                        <th className="px-6 py-4 w-[35%] tracking-widest">Theme</th>
                                        <th className="px-6 py-4 w-[20%] tracking-widest">Coverage</th>
                                        <th className="px-6 py-4 w-[45%] tracking-widest">Participant Evidence <span className="normal-case font-medium text-slate-400 tracking-normal ml-1">· Click avatar to view quotes</span></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {saturationData.map(({ theme, count, total, coverage, color }) => {
                                        const level =
                                            count === 0 ? { label: 'No data', tag: 'No data', tagBg: '#f1f5f9', tagText: '#64748b', dot: '#cbd5e1' } :
                                            count === total ? { label: `${count} of ${total} participants`, tag: 'Everyone', tagBg: '#ecfdf5', tagText: '#059669', dot: '#10b981' } :
                                            count / total >= 0.6 ? { label: `${count} of ${total} participants`, tag: 'Most', tagBg: '#eff6ff', tagText: '#2563eb', dot: '#3b82f6' } :
                                            count / total >= 0.3 ? { label: `${count} of ${total} participants`, tag: 'Some', tagBg: '#fefce8', tagText: '#ca8a04', dot: '#eab308' } :
                                            { label: `${count} of ${total} participants`, tag: 'Few', tagBg: '#fef2f2', tagText: '#dc2626', dot: '#ef4444' }

                                        return (
                                            <tr key={theme.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-6 py-5 align-top">
                                                    <p className="text-[13px] font-extrabold text-slate-800 leading-snug group-hover:text-indigo-600 transition-colors">{theme.name}</p>
                                                    {theme.description ? (
                                                        <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed line-clamp-2">{theme.description}</p>
                                                    ) : (
                                                        <p className="text-[11px] text-slate-400 mt-1.5 italic">No description provided</p>
                                                    )}
                                                </td>
                                                <td className="px-6 py-5 align-top">
                                                    <div className="flex flex-col items-start gap-1.5">
                                                        <span 
                                                            className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-md whitespace-nowrap shadow-sm border border-black/5" 
                                                            style={{ background: level.tagBg, color: level.tagText }}
                                                        >
                                                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: level.dot }}></span>
                                                            {level.tag}
                                                        </span>
                                                        <span className="text-[10px] font-semibold text-slate-500 ml-0.5 tracking-wide">
                                                            {level.label}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 align-top">
                                                    <div className="flex flex-wrap gap-3">
                                                        {allParticipants.map(p => {
                                                            const codes = getCellCodes(p.id, theme.id)
                                                            const mentioned = codes.length > 0
                                                            const av = avatarColor(p.name)
                                                            return (
                                                                <button
                                                                    key={p.id}
                                                                    onClick={() => mentioned && setSelectedCell({ participantId: p.id, themeId: theme.id })}
                                                                    title={`${p.name}: ${mentioned ? `✓ Click to view ${codes.length} quotes` : 'did not mention'}`}
                                                                    className={`flex items-center gap-2 pr-3 py-1 rounded-full transition-all ring-1 ring-slate-100 ${mentioned ? 'hover:bg-slate-100 hover:shadow-md hover:ring-indigo-200 cursor-pointer active:scale-95' : 'cursor-default opacity-50 grayscale select-none'}`}
                                                                >
                                                                    <div
                                                                        className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-extrabold shadow-sm transition-all ring-2 ring-white"
                                                                        style={mentioned
                                                                            ? { background: av.bg, color: av.text, outline: `2px solid ${color}`, outlineOffset: 1 }
                                                                            : { background: '#f1f5f9', color: '#94a3b8' }
                                                                        }
                                                                    >
                                                                        {initials(p.name)}
                                                                    </div>
                                                                    <span className="text-[10px] font-bold" style={{ color: mentioned ? '#334155' : '#94a3b8' }}>
                                                                        {p.name.split(' ')[0]} 
                                                                        {mentioned && <span className="ml-1 opacity-60 font-semibold">({codes.length})</span>}
                                                                    </span>
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {themes.length === 0 && (
                            <div className="text-center py-16 text-slate-300">
                                <p className="text-sm font-bold">No themes yet</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Cell Detail Modal ─────────────────────────────────────────── */}
            {selectedCell && selectedCellParticipant && selectedCellTheme && selectedCellData && (
                <CellDetail
                    participant={selectedCellParticipant.name}
                    participantId={selectedCellParticipant.id}
                    theme={selectedCellTheme}
                    codes={selectedCellData.codes}
                    onClose={() => setSelectedCell(null)}
                />
            )}
        </div>
    )
}
