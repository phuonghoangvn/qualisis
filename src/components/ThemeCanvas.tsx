'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    Node,
    NodeProps,
    Handle,
    Position,
    ReactFlowProvider,
    useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

// ─── Types ───────────────────────────────────────────────────────────────────
type CodeLink = {
    codebookEntry: {
        id: string
        name: string
        type: string
        _count: { codeAssignments: number }
        participants?: { id: string; name: string }[]
    }
}

export type ThemeNodeData = {
    id: string
    name: string
    description: string | null
    memo: string | null
    status: string
    codeLinks: CodeLink[]
    participantsCount?: number
    // callbacks
    onEdit: (id: string, name: string, description: string) => void
    onDelete: (id: string, name: string) => void
    onRemoveCode: (themeId: string, codeId: string) => void
    onDropCode: (themeId: string, codeId: string, fromThemeId?: string) => void
    draggingCodeId: string | null
    draggingFromThemeId: string | null
}

// ─── Theme Card Node ──────────────────────────────────────────────────────────
function ThemeNode({ data, selected }: NodeProps) {
    const d = data as ThemeNodeData
    const [isDragOver, setIsDragOver] = useState(false)
    const [expanded, setExpanded] = useState(false)

    const codesArr = d.codeLinks || []
    const codesToShow = expanded ? codesArr : codesArr.slice(0, 4)
    const hiddenCount = codesArr.length - 4

    const isDropTarget = d.draggingCodeId !== null

    return (
        <div
            onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={e => {
                e.preventDefault()
                setIsDragOver(false)
                if (d.draggingCodeId) {
                    d.onDropCode(d.id, d.draggingCodeId, d.draggingFromThemeId ?? undefined)
                }
            }}
            className={`w-[320px] rounded-2xl border transition-all shadow-sm bg-white flex flex-col relative
                ${isDragOver ? 'border-indigo-500 shadow-lg shadow-indigo-100 bg-indigo-50/30' : ''}
                ${isDropTarget && !isDragOver ? 'border-indigo-300 border-dashed' : ''}
                ${!isDropTarget && !isDragOver ? 'border-slate-200/80 hover:border-slate-300 hover:shadow-md' : ''}
                ${selected ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}
            `}
            style={{ cursor: 'default' }}
        >
            {/* Left accent strip */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-300 rounded-l-2xl" />

            {/* Drop hint overlay */}
            {isDragOver && (
                <div className="absolute inset-0 rounded-2xl pointer-events-none z-10 flex items-end justify-center pb-3">
                    <span className="bg-indigo-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                        Drop to add code
                    </span>
                </div>
            )}

            <div className="p-4 flex flex-col gap-2.5">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-extrabold text-slate-800 leading-snug break-words flex-1">{d.name}</p>
                    <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                        <button
                            className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                            title="Edit theme"
                            onMouseDown={e => e.stopPropagation()}
                            onClick={e => { e.stopPropagation(); d.onEdit(d.id, d.name, d.description || '') }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                        </button>
                        <button
                            className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                            title="Delete theme"
                            onMouseDown={e => e.stopPropagation()}
                            onClick={e => { e.stopPropagation(); d.onDelete(d.id, d.name) }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </button>
                    </div>
                </div>

                {/* Description */}
                {d.description && (
                    <p className="text-[11px] text-slate-500 leading-relaxed break-words">{d.description}</p>
                )}

                {/* Code chips */}
                <div className="flex flex-col gap-1 min-h-[28px] p-2 -mx-1 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                    {codesArr.length === 0 && (
                        <p className="text-[10px] text-slate-400 italic text-center py-1">Drop codes here</p>
                    )}
                    {codesToShow.map(link => (
                        <span
                            key={link.codebookEntry.id}
                            className={`flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold group/chip ${
                                link.codebookEntry.type === 'OBSERVATION'
                                    ? 'bg-violet-50 text-violet-700 border border-violet-100'
                                    : 'bg-white text-slate-700 border border-slate-200'
                            }`}
                        >
                            <span className="truncate">{link.codebookEntry.name}</span>
                            <button
                                className="opacity-0 group-hover/chip:opacity-100 text-slate-300 hover:text-rose-500 transition-all flex-shrink-0"
                                title="Remove code"
                                onMouseDown={e => e.stopPropagation()}
                                onClick={e => { e.stopPropagation(); d.onRemoveCode(d.id, link.codebookEntry.id) }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                        </span>
                    ))}
                    {hiddenCount > 0 && !expanded && (
                        <button
                            className="text-[10px] text-indigo-500 font-bold text-center hover:text-indigo-700 transition-colors py-0.5"
                            onMouseDown={e => e.stopPropagation()}
                            onClick={e => { e.stopPropagation(); setExpanded(true) }}
                        >
                            +{hiddenCount} more
                        </button>
                    )}
                    {expanded && codesArr.length > 4 && (
                        <button
                            className="text-[10px] text-slate-400 font-bold text-center hover:text-slate-600 transition-colors py-0.5"
                            onMouseDown={e => e.stopPropagation()}
                            onClick={e => { e.stopPropagation(); setExpanded(false) }}
                        >
                            Show less
                        </button>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-0.5">
                    <span className="text-[10px] text-slate-400 font-medium">{codesArr.length} codes</span>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        {d.participantsCount || 0}
                    </div>
                </div>
            </div>

            {/* Hidden handles for ReactFlow — not used visually */}
            <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: 'none' }} />
            <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />
        </div>
    )
}

const nodeTypes = { themeCard: ThemeNode }

// ─── Inner Canvas (needs to be inside ReactFlowProvider) ─────────────────────
interface ThemeCanvasInnerProps {
    themes: ThemeNodeData[]
    projectId: string
    draggingCodeId: string | null
    draggingFromThemeId: string | null
    onDropCode: (themeId: string, codeId: string, fromThemeId?: string) => void
    onDropOnCanvas: (codeId: string, x: number, y: number, fromThemeId?: string) => void
    onEdit: (id: string, name: string, description: string) => void
    onDelete: (id: string, name: string) => void
    onRemoveCode: (themeId: string, codeId: string) => void
    onPositionSave: (themeId: string, x: number, y: number) => void
    onDoubleClickCanvas: (x: number, y: number) => void
}

function ThemeCanvasInner({
    themes,
    projectId,
    draggingCodeId,
    draggingFromThemeId,
    onDropCode,
    onDropOnCanvas,
    onEdit,
    onDelete,
    onRemoveCode,
    onPositionSave,
    onDoubleClickCanvas,
}: ThemeCanvasInnerProps) {
    const { screenToFlowPosition } = useReactFlow()
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Convert themes to ReactFlow nodes
    const makeNodes = useCallback((ts: ThemeNodeData[]): Node[] => {
        return ts.map((theme, i) => ({
            id: theme.id,
            type: 'themeCard',
            position: {
                x: (theme as any).positionX ?? (i % 4) * 380 + 40,
                y: (theme as any).positionY ?? Math.floor(i / 4) * 380 + 40,
            },
            data: {
                ...theme,
                onEdit,
                onDelete,
                onRemoveCode,
                onDropCode,
                draggingCodeId,
                draggingFromThemeId,
            },
            dragHandle: '.drag-handle',
        }))
    }, [onEdit, onDelete, onRemoveCode, onDropCode, draggingCodeId, draggingFromThemeId])

    const [nodes, setNodes, onNodesChange] = useNodesState(makeNodes(themes))
    const [edges, , onEdgesChange] = useEdgesState([])

    // Sync external theme changes into nodes
    useEffect(() => {
        setNodes(prev => {
            const newNodes = makeNodes(themes)
            return newNodes.map(n => {
                const existing = prev.find(p => p.id === n.id)
                return existing ? { ...n, position: existing.position } : n
            })
        })
    }, [themes, makeNodes, setNodes])

    // Update draggingCodeId live on all nodes
    useEffect(() => {
        setNodes(prev => prev.map(n => ({
            ...n,
            data: {
                ...n.data,
                draggingCodeId,
                draggingFromThemeId,
            }
        })))
    }, [draggingCodeId, draggingFromThemeId, setNodes])

    const handleNodeDragStop = useCallback((_: any, node: Node) => {
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(() => {
            onPositionSave(node.id, node.position.x, node.position.y)
        }, 600)
    }, [onPositionSave])

    // Handle drag-over from left panel onto canvas (empty space)
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        if (!draggingCodeId) return

        const bounds = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const clientX = e.clientX - bounds.left
        const clientY = e.clientY - bounds.top
        const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })

        // Check if dropped on a node — if so, do nothing (node's own onDrop handles it)
        onDropOnCanvas(draggingCodeId, flowPos.x, flowPos.y, draggingFromThemeId ?? undefined)
    }, [draggingCodeId, draggingFromThemeId, screenToFlowPosition, onDropOnCanvas])

    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement
        // Only react if double-clicked on the background pane
        if (target.classList.contains('react-flow__pane') || target.closest('.react-flow__background')) {
            const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
            onDoubleClickCanvas(flowPos.x, flowPos.y)
        }
    }, [screenToFlowPosition, onDoubleClickCanvas])

    return (
        <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={handleNodeDragStop}
            nodeTypes={nodeTypes}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDoubleClick={handleDoubleClick}
            minZoom={0.2}
            maxZoom={2}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            proOptions={{ hideAttribution: true }}
            className="bg-slate-50/50"
        >
            <Background color="#e2e8f0" gap={24} size={1} />
            <Controls
                className="!shadow-sm !border !border-slate-200 !rounded-xl overflow-hidden"
                showInteractive={false}
            />
            <MiniMap
                nodeColor="#6366f1"
                maskColor="rgba(241,245,249,0.7)"
                className="!rounded-xl !border !border-slate-200 !shadow-sm"
            />
        </ReactFlow>
    )
}

// ─── Public Export ────────────────────────────────────────────────────────────
interface ThemeCanvasProps {
    themes: ThemeNodeData[]
    projectId: string
    draggingCodeId: string | null
    draggingFromThemeId: string | null
    onDropCode: (themeId: string, codeId: string, fromThemeId?: string) => void
    onDropOnCanvas: (codeId: string, x: number, y: number, fromThemeId?: string) => void
    onEdit: (id: string, name: string, description: string) => void
    onDelete: (id: string, name: string) => void
    onRemoveCode: (themeId: string, codeId: string) => void
    onPositionSave: (themeId: string, x: number, y: number) => void
    onDoubleClickCanvas: (x: number, y: number) => void
}

export default function ThemeCanvas(props: ThemeCanvasProps) {
    return (
        <ReactFlowProvider>
            <ThemeCanvasInner {...props} />
        </ReactFlowProvider>
    )
}
