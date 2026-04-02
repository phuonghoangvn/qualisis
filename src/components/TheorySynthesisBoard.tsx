'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import ReactFlow, {
    Background, Controls, Edge, Node, MarkerType,
    useNodesState, useEdgesState, addEdge, Connection,
    Handle, Position, NodeProps, EdgeProps, getBezierPath,
    EdgeLabelRenderer,
} from 'reactflow'
import 'reactflow/dist/style.css'

// ─── Types ─────────────────────────────────────────────────────────────────

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

type RelationData = {
    id: string
    sourceId: string
    targetId: string
    relationType: string
    description?: string | null
}

const RELATION_TYPES = [
    {
        value: 'CAUSES',
        label: 'Leads to',
        shortLabel: 'Leads to',
        description: 'Theme A directly causes or triggers Theme B',
        icon: '→',
        color: '#f59e0b',
    },
    {
        value: 'CONTRADICTS',
        label: 'Conflicts with',
        shortLabel: 'Conflicts with',
        description: 'The two themes present opposing or conflicting ideas',
        icon: '↔',
        color: '#ef4444',
    },
    {
        value: 'SUPPORTS',
        label: 'Reinforces',
        shortLabel: 'Reinforces',
        description: 'Theme A provides evidence or support for Theme B',
        icon: '↑',
        color: '#10b981',
    },
    {
        value: 'RELATED_TO',
        label: 'Connected to',
        shortLabel: 'Connected to',
        description: 'The themes are related but the direction is unclear',
        icon: '—',
        color: '#6366f1',
    },
    {
        value: 'SUBTHEME_OF',
        label: 'Part of',
        shortLabel: 'Part of',
        description: 'Theme A is a subset or sub-topic within Theme B',
        icon: '⊂',
        color: '#8b5cf6',
    },
    {
        value: 'MITIGATES',
        label: 'Reduces / Copes with',
        shortLabel: 'Reduces',
        description: 'Theme A moderates, reduces or manages Theme B',
        icon: '↓',
        color: '#06b6d4',
    },
]

const PALETTE = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4', '#f43f5e', '#84cc16']

function getRelationStyle(type: string) {
    return RELATION_TYPES.find(r => r.value === type) || RELATION_TYPES[3]
}

// ─── Custom Theme Node ──────────────────────────────────────────────────────

function ThemeNodeComponent({ data, selected }: NodeProps) {
    const { theme, color, expanded, onToggle } = data as {
        theme: ThemeData
        color: string
        expanded: boolean
        onToggle: () => void
    }

    return (
        <div
            className="relative bg-white rounded-xl shadow-md transition-all duration-200"
            style={{
                borderTop: `5px solid ${color}`,
                border: `1.5px solid ${selected ? color : '#e2e8f0'}`,
                borderTopWidth: '5px',
                boxShadow: selected ? `0 0 0 3px ${color}33, 0 4px 16px ${color}22` : '0 2px 8px #0001',
                minWidth: 240,
                maxWidth: 300,
            }}
        >
            {/* Handles */}
            <Handle type="target" position={Position.Top} style={{ background: color, width: 10, height: 10, border: '2px solid white' }} />
            <Handle type="source" position={Position.Bottom} style={{ background: color, width: 10, height: 10, border: '2px solid white' }} />
            <Handle type="target" position={Position.Left} style={{ background: color, width: 10, height: 10, border: '2px solid white' }} />
            <Handle type="source" position={Position.Right} style={{ background: color, width: 10, height: 10, border: '2px solid white' }} />

            {/* Header */}
            <div className="px-3 pt-3 pb-2">
                <div className="flex items-start justify-between gap-2">
                    <div className="font-extrabold text-slate-800 text-[14px] leading-snug">{theme.name}</div>
                    <button
                        onClick={onToggle}
                        className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition-colors nodrag"
                        title={expanded ? 'Collapse codes' : 'Expand codes'}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            {expanded ? <path d="M5 12h14" /> : <><path d="M5 12h14" /><path d="M12 5v14" /></>}
                        </svg>
                    </button>
                </div>
                <div className="flex gap-1.5 mt-1.5">
                    <span style={{ background: `${color}15`, color }} className="text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {theme.codeLinks?.length || 0} codes
                    </span>
                    {(theme.participantsCount || 0) > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                            {theme.participantsCount} pax
                        </span>
                    )}
                </div>
            </div>

            {/* Codes list */}
            {expanded && theme.codeLinks && theme.codeLinks.length > 0 && (
                <div className="px-2.5 pb-2.5 flex flex-col gap-1 nodrag">
                    <div className="h-px bg-slate-100 mb-1" />
                    {theme.codeLinks.slice(0, 8).map(link => (
                        <div
                            key={link.codebookEntry.id}
                            className="flex items-start gap-1.5 text-[11px] text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 hover:bg-white hover:border-slate-300 transition-colors cursor-default select-none"
                        >
                            <span style={{ color, fontSize: 8 }} className="mt-[3px] flex-shrink-0">●</span>
                            <span className="leading-snug">{link.codebookEntry.name}</span>
                        </div>
                    ))}
                    {theme.codeLinks.length > 8 && (
                        <div className="text-[10px] text-slate-400 italic text-center py-0.5">
                            +{theme.codeLinks.length - 8} more codes…
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ─── Custom Edge with label and delete ─────────────────────────────────────

function RelationEdge({
    id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd, style
}: EdgeProps) {
    const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
    const relStyle = getRelationStyle((data?.relationType as string) || 'RELATED_TO')
    const [hovered, setHovered] = useState(false)

    return (
        <>
            {/* Wider invisible hit area for hover detection */}
            <path
                d={edgePath}
                fill="none"
                strokeWidth={18}
                stroke="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
            />
            <path
                id={id}
                className="react-flow__edge-path"
                d={edgePath}
                markerEnd={markerEnd as string}
                style={style}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
            />
            <EdgeLabelRenderer>
                <div
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        pointerEvents: 'all',
                    }}
                    className="nodrag nopan"
                    onMouseEnter={() => setHovered(true)}
                    onMouseLeave={() => setHovered(false)}
                >
                    <div
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold shadow-sm transition-all"
                        style={{ background: 'white', borderColor: relStyle.color, color: relStyle.color }}
                    >
                        <span>{relStyle.shortLabel}</span>
                        {hovered && (
                            <button
                                className="flex items-center justify-center w-4 h-4 rounded-full bg-red-100 text-red-500 hover:bg-red-200 transition-colors ml-0.5"
                                onClick={() => data?.onDelete?.(id, data?.relationId)}
                                title="Remove this relationship"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                        )}
                    </div>
                </div>
            </EdgeLabelRenderer>
        </>
    )
}

// ─── Relation Picker Modal ──────────────────────────────────────────────────

function RelationPickerModal({ connection, sourceName, targetName, onConfirm, onCancel }: {
    connection: Connection
    sourceName: string
    targetName: string
    onConfirm: (type: string) => void
    onCancel: () => void
}) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={onCancel}>
            <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" />
            <div
                className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-[380px] overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-50 to-white px-5 pt-5 pb-4 border-b border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">New Connection</p>
                    <div className="flex items-center gap-2">
                        <span className="bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px] font-bold px-2.5 py-1.5 rounded-lg max-w-[130px] truncate">{ sourceName }</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" className="text-slate-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                        <span className="bg-violet-50 border border-violet-200 text-violet-800 text-[11px] font-bold px-2.5 py-1.5 rounded-lg max-w-[130px] truncate">{ targetName }</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-3">How does the first theme relate to the second?</p>
                </div>

                {/* Relation options */}
                <div className="p-3 grid grid-cols-2 gap-2">
                    {RELATION_TYPES.map(r => (
                        <button
                            key={r.value}
                            onClick={() => onConfirm(r.value)}
                            className="flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-xl border-2 hover:shadow-md transition-all text-left group"
                            style={{ borderColor: `${r.color}40`, background: `${r.color}08` }}
                        >
                            <div className="flex items-center gap-1.5">
                                <span
                                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                                    style={{ background: `${r.color}20`, color: r.color }}
                                >
                                    {r.icon}
                                </span>
                                <span className="text-[12px] font-extrabold" style={{ color: r.color }}>{r.label}</span>
                            </div>
                            <p className="text-[9.5px] text-slate-400 leading-relaxed pl-[26px]">{r.description}</p>
                        </button>
                    ))}
                </div>

                <div className="px-4 pb-4">
                    <button onClick={onCancel} className="w-full text-[11px] text-slate-400 hover:text-slate-600 py-2 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                </div>
            </div>
        </div>
    )
}

// ─── AI Suggestion Panel (sidebar) ─────────────────────────────────────────

function AISuggestionPanel({ themes, onAccept, onDismiss, suggestions, loading }: {
    themes: ThemeData[]
    suggestions: { sourceId: string; targetId: string; reason: string; relationType: string }[]
    loading: boolean
    onAccept: (s: { sourceId: string; targetId: string; relationType: string }) => void
    onDismiss: (i: number) => void
}) {
    const getThemeName = (id: string) => themes.find(t => t.id === id)?.name || id

    return (
        <div className="w-72 border-l border-slate-200 bg-white flex flex-col overflow-hidden z-10">
            <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-violet-50">
                <div className="flex items-center gap-2 mb-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                    <p className="text-[11px] font-extrabold text-indigo-700 uppercase tracking-widest">AI Suggestions</p>
                </div>
                <p className="text-[10px] text-slate-500">Potential relationships found in your data.</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                {loading && (
                    <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-400">
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        <p className="text-[11px]">Analyzing relationships…</p>
                    </div>
                )}
                {!loading && suggestions.length === 0 && (
                    <div className="text-center py-8 text-[11px] text-slate-400 italic">No suggestions yet. Click "Find Connections" above.</div>
                )}
                {suggestions.map((s, i) => {
                    const rel = getRelationStyle(s.relationType)
                    return (
                        <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                            <div className="flex items-start gap-2">
                                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: rel.color }} />
                                <div>
                                    <p className="text-[11px] font-bold text-slate-700 leading-snug">
                                        "{getThemeName(s.sourceId)}"
                                        <span className="font-normal text-slate-400 mx-1">{rel.label}</span>
                                        "{getThemeName(s.targetId)}"
                                    </p>
                                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{s.reason}</p>
                                </div>
                            </div>
                            <div className="flex gap-1.5">
                                <button
                                    onClick={() => onAccept(s)}
                                    className="flex-1 text-[10px] font-bold py-1.5 rounded-lg text-white transition-colors"
                                    style={{ background: rel.color }}
                                >
                                    Accept →
                                </button>
                                <button
                                    onClick={() => onDismiss(i)}
                                    className="text-[10px] font-bold py-1.5 px-2 rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-100 transition-colors"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ─── Node/Edge types (outside component to prevent re-renders) ──────────────

const nodeTypes = { themeNode: ThemeNodeComponent }
const edgeTypes = { relation: RelationEdge }

// ─── Main Board ─────────────────────────────────────────────────────────────

export default function TheorySynthesisBoard({ themes, assignedCount, projectId }: {
    themes: ThemeData[]
    assignedCount: number
    projectId: string
}) {
    const [rfNodes, setNodes, onNodesChange] = useNodesState([])
    const [rfEdges, setEdges, onEdgesChange] = useEdgesState([])

    const [pendingConnection, setPendingConnection] = useState<Connection | null>(null)
    const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set())

    const [showAI, setShowAI] = useState(false)
    const [aiSuggestions, setAiSuggestions] = useState<any[]>([])
    const [aiLoading, setAiLoading] = useState(false)

    const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

    // ── Toggle expand/collapse ──────────────────────────────────────────────
    const toggleExpand = useCallback((themeId: string) => {
        setExpandedThemes(prev => {
            const next = new Set(prev)
            next.has(themeId) ? next.delete(themeId) : next.add(themeId)
            return next
        })
    }, [])

    // ── Build nodes from themes ──────────────────────────────────────────────
    useEffect(() => {
        setNodes(nds => {
            const existing = new Map(nds.map(n => [n.id, n]))
            return themes.map((theme, idx) => {
                const old = existing.get(theme.id)
                const color = PALETTE[idx % PALETTE.length]
                return {
                    id: theme.id,
                    type: 'themeNode',
                    // Preserve current position if node already placed & dragged
                    position: old ? old.position : {
                        x: theme.positionX ?? (80 + (idx % 3) * 340),
                        y: theme.positionY ?? (80 + Math.floor(idx / 3) * 260),
                    },
                    data: {
                        theme,
                        color,
                        expanded: expandedThemes.has(theme.id),
                        onToggle: () => toggleExpand(theme.id),
                    },
                }
            })
        })
    }, [themes, expandedThemes, toggleExpand, setNodes])

    // ── Load saved relations ─────────────────────────────────────────────────
    useEffect(() => {
        const loadRelations = async () => {
            try {
                const res = await fetch(`/api/projects/${projectId}/themes/relations`)
                if (!res.ok) return
                const data: RelationData[] = await res.json()
                setEdges(data.map(r => buildEdge(r)))
            } catch {}
        }
        loadRelations()
    }, [projectId, setEdges])

    function buildEdge(r: RelationData): Edge {
        const rel = getRelationStyle(r.relationType)
        return {
            id: r.id,
            source: r.sourceId,
            target: r.targetId,
            type: 'relation',
            style: { stroke: rel.color, strokeWidth: 2.5 },
            markerEnd: { type: MarkerType.ArrowClosed, color: rel.color },
            data: {
                relationType: r.relationType,
                relationId: r.id,
                onDelete: handleDeleteEdge,
            },
        }
    }

    // ── Connect: show picker modal ───────────────────────────────────────────
    const onConnect = useCallback((connection: Connection) => {
        if (connection.source === connection.target) return
        setPendingConnection(connection)
    }, [])

    const confirmConnection = useCallback(async (relationType: string) => {
        if (!pendingConnection) return
        const { source, target } = pendingConnection
        setPendingConnection(null)
        try {
            const res = await fetch(`/api/projects/${projectId}/themes/relations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sourceId: source, targetId: target, relationType })
            })
            if (res.ok) {
                const r: RelationData = await res.json()
                setEdges(eds => [...eds, buildEdge(r)])
            }
        } catch {}
    }, [pendingConnection, projectId, setEdges])

    // ── Delete edge ──────────────────────────────────────────────────────────
    const handleDeleteEdge = useCallback((edgeId: string, relationId?: string) => {
        if (!confirm('Delete this relationship?')) return
        setEdges(eds => eds.filter(e => e.id !== edgeId))
        if (relationId) {
            fetch(`/api/projects/${projectId}/themes/relations/${relationId}`, { method: 'DELETE' }).catch(console.error)
        }
    }, [projectId, setEdges])

    // ── Drag stop: debounced position save ───────────────────────────────────
    const onNodeDragStop = useCallback((_: any, node: Node) => {
        const existing = saveTimers.current.get(node.id)
        if (existing) clearTimeout(existing)
        const timer = setTimeout(() => {
            fetch(`/api/projects/${projectId}/themes/${node.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ positionX: node.position.x, positionY: node.position.y })
            }).catch(console.error)
            saveTimers.current.delete(node.id)
        }, 600)
        saveTimers.current.set(node.id, timer)
    }, [projectId])

    // ── AI: Find connections ─────────────────────────────────────────────────
    const findAIConnections = useCallback(async () => {
        setAiLoading(true)
        setShowAI(true)
        setAiSuggestions([])
        try {
            const payload = themes.map(t => ({
                id: t.id,
                name: t.name,
                codes: t.codeLinks.map(l => l.codebookEntry.name)
            }))
            const res = await fetch(`/api/projects/${projectId}/themes/ai-relations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ themes: payload })
            })
            if (res.ok) {
                const data = await res.json()
                setAiSuggestions(data.suggestions || [])
            }
        } catch {}
        setAiLoading(false)
    }, [themes, projectId])

    const acceptAISuggestion = useCallback(async (s: { sourceId: string; targetId: string; relationType: string }) => {
        try {
            const res = await fetch(`/api/projects/${projectId}/themes/relations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sourceId: s.sourceId, targetId: s.targetId, relationType: s.relationType })
            })
            if (res.ok) {
                const r: RelationData = await res.json()
                setEdges(eds => [...eds, buildEdge(r)])
            }
        } catch {}
        setAiSuggestions(prev => prev.filter(x => x.sourceId !== s.sourceId || x.targetId !== s.targetId))
    }, [projectId, setEdges])

    const dismissAISuggestion = useCallback((i: number) => {
        setAiSuggestions(prev => prev.filter((_, idx) => idx !== i))
    }, [])

    return (
        <div className="absolute inset-0 bg-[#f8fafc] z-20 flex flex-col overflow-hidden">
            {/* ── Toolbar ───────────────────────────────────────────────── */}
            <div className="flex-shrink-0 px-6 py-3 border-b border-slate-200 flex items-center justify-between bg-white">
                <div>
                    <h2 className="text-[15px] font-extrabold text-slate-800 flex items-center gap-2">
                        Theory Synthesis Board
                        <span className="text-[9px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">Axial Coding</span>
                    </h2>
                    <p className="text-[10px] text-slate-400 mt-0.5">Drag node handles to draw relationships. Click node ⊕/⊖ to expand codes.</p>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full">
                        {themes.length} themes · {assignedCount} codes
                    </span>
                    <button
                        onClick={findAIConnections}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700 shadow-sm transition-all hover:shadow-md"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                        AI: Find Connections
                    </button>
                    {showAI && (
                        <button onClick={() => setShowAI(false)} className="text-[11px] font-bold text-slate-400 hover:text-slate-600 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                            Hide AI ×
                        </button>
                    )}
                </div>
            </div>

            {/* ── Canvas + Sidebar ──────────────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 relative overflow-hidden">
                    {themes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-300">
                            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
                            <p className="text-sm font-bold">No themes yet — create some in Builder first</p>
                        </div>
                    ) : (
                        <ReactFlow
                            nodes={rfNodes}
                            edges={rfEdges}
                            nodeTypes={nodeTypes}
                            edgeTypes={edgeTypes}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            onNodeDragStop={onNodeDragStop}
                            nodesDraggable
                            fitView
                            fitViewOptions={{ padding: 0.25 }}
                            minZoom={0.2}
                            maxZoom={2.5}
                            proOptions={{ hideAttribution: true }}
                        >
                            <Background color="#cbd5e1" gap={24} size={1} />
                            <Controls className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden" showInteractive={false} />
                        </ReactFlow>
                    )}
                </div>

                {/* ── AI Suggestions Sidebar ─────────────────────────────── */}
                {showAI && (
                    <AISuggestionPanel
                        themes={themes}
                        suggestions={aiSuggestions}
                        loading={aiLoading}
                        onAccept={acceptAISuggestion}
                        onDismiss={dismissAISuggestion}
                    />
                )}
            </div>

            {/* ── Relation Picker Modal ─────────────────────────────────── */}
            {pendingConnection && (
                <RelationPickerModal
                    connection={pendingConnection}
                    sourceName={themes.find(t => t.id === pendingConnection.source)?.name || pendingConnection.source || ''}
                    targetName={themes.find(t => t.id === pendingConnection.target)?.name || pendingConnection.target || ''}
                    onConfirm={confirmConnection}
                    onCancel={() => setPendingConnection(null)}
                />
            )}
        </div>
    )
}
