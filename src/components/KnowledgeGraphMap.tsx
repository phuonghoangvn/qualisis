'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactFlow, {
    Background, Controls, MiniMap,
    Handle, Position, MarkerType,
    useNodesState, useEdgesState,
    getBezierPath, EdgeLabelRenderer, BaseEdge, getStraightPath,
    Connection, NodeProps, EdgeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { getTranscriptIdentity } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const RELATION_TYPES = [
    { value: 'SUPPORTS',     label: 'Supports',     color: '#10b981', bg: '#d1fae5', desc: 'Reinforces or provides evidence for' },
    { value: 'CONTRADICTS',  label: 'Contradicts',  color: '#ef4444', bg: '#fee2e2', desc: 'Conflicts or presents opposing views' },
    { value: 'CAUSES',       label: 'Causes',       color: '#f59e0b', bg: '#fef3c7', desc: 'Acts as antecedent or trigger' },
    { value: 'MITIGATES',    label: 'Mitigates',    color: '#06b6d4', bg: '#cffafe', desc: 'Reduces or moderates the effect' },
    { value: 'RELATED_TO',   label: 'Related To',   color: '#8b5cf6', bg: '#ede9fe', desc: 'Shares conceptual overlap' },
    { value: 'SUBTHEME_OF',  label: 'Sub-theme of', color: '#6366f1', bg: '#e0e7ff', desc: 'Is a subdivision or refinement' },
];

const PALETTE = [
    { solid: '#6366f1', pale: '#e0e7ff', ring: '#a5b4fc' },
    { solid: '#ec4899', pale: '#fce7f3', ring: '#f9a8d4' },
    { solid: '#f59e0b', pale: '#fef3c7', ring: '#fcd34d' },
    { solid: '#10b981', pale: '#d1fae5', ring: '#6ee7b7' },
    { solid: '#06b6d4', pale: '#cffafe', ring: '#67e8f9' },
    { solid: '#8b5cf6', pale: '#ede9fe', ring: '#c4b5fd' },
];

function getRelationMeta(type: string) {
    if (!type) return RELATION_TYPES[4]; // Fallback to 'RELATED_TO' for undefined types

    const predefined = RELATION_TYPES.find(r => r.value === type);
    if (predefined) return predefined;

    // Generate consistent hash-based color for custom types
    const safeType = String(type);
    const hash = safeType.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    const colorTheme = PALETTE[Math.abs(hash) % PALETTE.length];

    return {
        value: safeType,
        label: safeType,
        color: colorTheme.solid,
        bg: colorTheme.pale,
        desc: 'Custom relationship'
    };
}

function themeColor(label: string) {
    const idx = Math.abs(label.charCodeAt(0) + label.length) % PALETTE.length;
    return PALETTE[idx];
}

// ─── Node Components ──────────────────────────────────────────────────────────

const ThemeNode = ({ data, selected }: NodeProps) => {
    const p = themeColor(data.label);
    return (
        <div style={{ minWidth: 160 }} className="group relative">
            <Handle type="target" position={Position.Top} className="opacity-0 group-hover:opacity-100 transition-opacity w-3 h-3 bg-indigo-400 border-2 border-white" />
            <Handle type="target" position={Position.Bottom} className="opacity-0 group-hover:opacity-100 transition-opacity w-3 h-3 bg-indigo-400 border-2 border-white" />
            <Handle type="target" position={Position.Left} className="opacity-0 group-hover:opacity-100 transition-opacity w-3 h-3 bg-indigo-400 border-2 border-white" />
            <Handle type="target" position={Position.Right} className="opacity-0 group-hover:opacity-100 transition-opacity w-3 h-3 bg-indigo-400 border-2 border-white" />
            <div
                className="rounded-2xl border-2 shadow-lg px-4 py-3 transition-all duration-200 flex items-center gap-3 relative z-10"
                style={{
                    borderColor: selected ? p.solid : '#e2e8f0',
                    background: `linear-gradient(135deg, #ffffff, ${p.pale}55)`,
                    boxShadow: selected
                        ? `0 0 0 3px ${p.ring}, 0 4px 16px rgba(0,0,0,0.1)`
                        : '0 2px 10px rgba(0,0,0,0.08)',
                }}
            >
                <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-extrabold flex-shrink-0"
                    style={{ backgroundColor: p.solid }}
                >
                    {data.codeCount || 0}
                </div>
                <span className="text-[13px] font-extrabold text-slate-800 leading-tight">{data.label}</span>
            </div>
            <Handle type="source" position={Position.Bottom} className="opacity-0 group-hover:opacity-100 transition-opacity w-3 h-3 bg-indigo-400 border-2 border-white" />
            <Handle type="source" position={Position.Top} className="opacity-0 group-hover:opacity-100 transition-opacity w-3 h-3 bg-indigo-400 border-2 border-white" />
            <Handle type="source" position={Position.Left} className="opacity-0 group-hover:opacity-100 transition-opacity w-3 h-3 bg-indigo-400 border-2 border-white" />
            <Handle type="source" position={Position.Right} className="opacity-0 group-hover:opacity-100 transition-opacity w-3 h-3 bg-indigo-400 border-2 border-white" />
        </div>
    );
};

const CodeNode = ({ data, selected }: NodeProps) => {
    const p = themeColor(data.themeId || data.label);
    return (
        <div className="group relative">
            <Handle type="target" position={Position.Top} className="opacity-0 group-hover:opacity-100 transition-opacity w-2.5 h-2.5 bg-indigo-400 border-2 border-white" />
            <Handle type="target" position={Position.Bottom} className="opacity-0 group-hover:opacity-100 transition-opacity w-2.5 h-2.5 bg-indigo-400 border-2 border-white" />
            <Handle type="target" position={Position.Left} className="opacity-0 group-hover:opacity-100 transition-opacity w-2.5 h-2.5 bg-indigo-400 border-2 border-white" />
            <Handle type="target" position={Position.Right} className="opacity-0 group-hover:opacity-100 transition-opacity w-2.5 h-2.5 bg-indigo-400 border-2 border-white" />
            <div
                className="rounded-xl border-2 px-3 py-1.5 flex items-center gap-2 transition-all duration-200 relative z-10"
                style={{
                    borderColor: selected ? p.solid : p.ring + '88',
                    background: selected ? p.pale : '#ffffff',
                    boxShadow: selected
                        ? `0 0 0 2px ${p.ring}`
                        : '0 1px 5px rgba(0,0,0,0.06)',
                    maxWidth: 180,
                }}
            >
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.solid }} />
                <span className="text-[11px] font-bold text-slate-700 truncate">{data.label}</span>
                <span className="text-[9px] font-extrabold text-slate-400 ml-auto whitespace-nowrap">{data.count}×</span>
            </div>
            <Handle type="source" position={Position.Bottom} className="opacity-0 group-hover:opacity-100 transition-opacity w-2.5 h-2.5 bg-indigo-400 border-2 border-white" />
            <Handle type="source" position={Position.Top} className="opacity-0 group-hover:opacity-100 transition-opacity w-2.5 h-2.5 bg-indigo-400 border-2 border-white" />
            <Handle type="source" position={Position.Left} className="opacity-0 group-hover:opacity-100 transition-opacity w-2.5 h-2.5 bg-indigo-400 border-2 border-white" />
            <Handle type="source" position={Position.Right} className="opacity-0 group-hover:opacity-100 transition-opacity w-2.5 h-2.5 bg-indigo-400 border-2 border-white" />
        </div>
    );
};

const ParticipantNode = ({ data, selected }: NodeProps) => {
    const identity = getTranscriptIdentity(data.label);
    return (
        <div className="group relative">
            <Handle type="source" position={Position.Bottom} className="opacity-0 group-hover:opacity-100 transition-opacity w-2.5 h-2.5 bg-slate-400 border-2 border-white" />
            <Handle type="target" position={Position.Top} className="opacity-0 group-hover:opacity-100 transition-opacity w-2.5 h-2.5 bg-slate-400 border-2 border-white" />
            <div className="px-3 py-2 rounded-xl border-2 flex items-center gap-2 bg-white shadow-sm transition-all duration-200 relative z-10"
                style={{
                    borderColor: selected ? '#94a3b8' : '#e2e8f0',
                    boxShadow: selected ? '0 0 0 3px #cbd5e1' : '0 1px 4px rgba(0,0,0,0.06)',
                }}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold ${identity.color} ${identity.text}`}>
                    {identity.initials}
                </div>
                <span className="text-[10px] font-bold text-slate-600 truncate max-w-[110px]">{data.label}</span>
            </div>
        </div>
    );
};

// ─── Edge Components ──────────────────────────────────────────────────────────

const BelongsToEdge = ({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps) => {
    const [path] = getStraightPath({ sourceX, sourceY, targetX, targetY });
    return (
        <path
            id={id}
            d={path}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={1.5}
        />
    );
};

const ParticipantEdge = ({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps) => {
    const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY });
    const w = Math.min(1 + (data?.weight || 1) * 0.3, 3);
    return (
        <path id={id} d={path} fill="none" stroke="#cbd5e1" strokeWidth={w} strokeDasharray="5 4" />
    );
};

const KnowledgeEdgeComponent = ({ id, sourceX, sourceY, targetX, targetY, data, markerEnd }: EdgeProps) => {
    const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY });
    const meta = getRelationMeta(data?.relationType as string);

    return (
        <>
            <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={{ stroke: meta.color, strokeWidth: 2 }} />
            <EdgeLabelRenderer>
                <div style={{ position: 'absolute', transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'none' }}>
                    <div
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold shadow-sm border"
                        style={{ background: meta.bg, color: meta.color, borderColor: meta.color + '44' }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                        {meta.label}
                    </div>
                </div>
            </EdgeLabelRenderer>
        </>
    );
};

const nodeTypes = { themeNode: ThemeNode, codeNode: CodeNode, participantNode: ParticipantNode };

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface ModalState {
    open: boolean;
    edgeId?: string;
    relationType: string;
    description: string;
    isNew?: boolean;
    sourceNodeId?: string;
    targetNodeId?: string;
}

function EditModal({ state, onSave, onDelete, onClose }: {
    state: ModalState;
    onSave: (t: string, d: string) => void;
    onDelete: () => void;
    onClose: () => void;
}) {
    const [type, setType] = useState(state.relationType || 'RELATED_TO');
    const [customType, setCustomType] = useState('');
    const [desc, setDesc] = useState(state.description || '');

    useEffect(() => { 
        const isPredefined = RELATION_TYPES.some(r => r.value === state.relationType);
        if (state.relationType && !isPredefined && state.relationType !== 'RELATED_TO') {
            setType('CUSTOM');
            setCustomType(state.relationType);
        } else {
            setType(state.relationType || 'RELATED_TO'); 
            setCustomType('');
        }
        setDesc(state.description || ''); 
    }, [state]);

    if (!state.open) return null;

    const handleSave = () => {
        const finalType = type === 'CUSTOM' ? (customType.trim() || 'RELATED_TO') : type;
        onSave(finalType, desc);
    };
    return (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-slate-200 mx-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[15px] font-extrabold text-slate-800">{state.isNew ? 'Create Connection' : 'Edit Connection'}</h3>
                    <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    </button>
                </div>

                <div className="mb-4">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Relationship Type</label>
                    <div className="grid grid-cols-2 gap-1.5 mb-2">
                        {RELATION_TYPES.map(r => (
                            <button key={r.value} onClick={() => setType(r.value)}
                                className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border-2 text-[11px] font-bold transition-all text-left"
                                style={{
                                    borderColor: type === r.value ? r.color : '#e2e8f0',
                                    background: type === r.value ? r.bg : '#f8fafc',
                                    color: type === r.value ? r.color : '#64748b',
                                }}
                            >
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                                {r.label}
                            </button>
                        ))}
                        
                        <button onClick={() => setType('CUSTOM')}
                            className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border-2 text-[11px] font-bold transition-all text-left col-span-2"
                            style={{
                                borderColor: type === 'CUSTOM' ? '#334155' : '#e2e8f0',
                                background: type === 'CUSTOM' ? '#f1f5f9' : '#f8fafc',
                                color: type === 'CUSTOM' ? '#334155' : '#64748b',
                            }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                            Custom Label...
                        </button>
                    </div>
                    
                    {type === 'CUSTOM' ? (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                            <input 
                                type="text"
                                value={customType}
                                onChange={e => setCustomType(e.target.value)}
                                placeholder="E.g., Evolves Into, Contextualizes..."
                                className="w-full text-[12px] font-bold p-2.5 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-slate-500 text-slate-800 placeholder:text-slate-400 placeholder:font-normal"
                                autoFocus
                            />
                        </div>
                    ) : (
                        <p className="text-[10px] text-slate-400 italic">{getRelationMeta(type).desc}</p>
                    )}
                </div>

                <div className="mb-5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Analytical Note (optional)</label>
                    <textarea
                        value={desc} onChange={e => setDesc(e.target.value)} rows={2}
                        placeholder="Why does this connection exist? What evidence in the data supports it?"
                        className="w-full text-[11px] p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none text-slate-700 placeholder:text-slate-300"
                    />
                </div>

                <div className="flex items-center justify-between">
                    {!state.isNew
                        ? <button onClick={onDelete} className="flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                            Delete
                        </button>
                        : <div />
                    }
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-1.5 text-[12px] font-semibold text-slate-500 hover:text-slate-700">Cancel</button>
                        <button onClick={handleSave} disabled={type === 'CUSTOM' && !customType.trim()} className="px-4 py-1.5 bg-indigo-600 text-white text-[12px] font-bold rounded-lg hover:bg-indigo-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-opacity">
                            {state.isNew ? 'Create' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Layout Algorithm ─────────────────────────────────────────────────────────

function computeLayout(
    themeNodes: any[],
    codeNodes: any[],
    participantNodes: any[],
    showCodes: boolean,
    showParticipants: boolean
): Map<string, { x: number; y: number }> {
    const positions = new Map<string, { x: number; y: number }>();
    const CX = 600, CY = 420;
    const THEME_R = Math.max(200, themeNodes.length * 45);
    const CODE_OFFSET = 130;
    const PARTICIPANT_R = THEME_R + (showCodes ? CODE_OFFSET + 120 : 140);

    themeNodes.forEach((node, i) => {
        const angle = (2 * Math.PI / themeNodes.length) * i - Math.PI / 2;
        const tx = CX + THEME_R * Math.cos(angle);
        const ty = CY + THEME_R * Math.sin(angle);
        positions.set(node.id, { x: tx, y: ty });

        if (showCodes) {
            // Place codes in arc radiating outward from theme center
            const themeCodes = codeNodes.filter(c => c.data.themeId === node.data.themeId);
            const n = themeCodes.length;
            if (n === 0) return;
            const ARC = Math.min(Math.PI * 0.7, n * 0.28);
            themeCodes.forEach((codeNode, j) => {
                const spread = n > 1 ? ARC : 0;
                const codeAngle = angle + (j - (n - 1) / 2) * (spread / Math.max(n - 1, 1));
                positions.set(codeNode.id, {
                    x: tx + CODE_OFFSET * Math.cos(codeAngle),
                    y: ty + CODE_OFFSET * Math.sin(codeAngle),
                });
            });
        }
    });

    if (showParticipants) {
        participantNodes.forEach((node, i) => {
            const angle = (2 * Math.PI / participantNodes.length) * i - Math.PI / 4;
            positions.set(node.id, {
                x: CX + PARTICIPANT_R * Math.cos(angle),
                y: CY + PARTICIPANT_R * Math.sin(angle),
            });
        });
    }

    return positions;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function KnowledgeGraphMap({ projectId }: { projectId: string }) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [loading, setLoading] = useState(true);
    const [showLegend, setShowLegend] = useState(true);
    const [showCodes, setShowCodes] = useState(true);
    const [showParticipants, setShowParticipants] = useState(true);
    const [modal, setModal] = useState<ModalState>({ open: false, relationType: 'RELATED_TO', description: '' });

    // ── Persist dragged positions across graph refreshes ──────────────────────
    // When user drags nodes, we save their positions here.
    // loadGraph will use these saved positions instead of recomputing layout.
    const savedPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

    // Connect state for point-and-click UX
    const [connectSource, setConnectSource] = useState<string | null>(null);

    const openEdit = useCallback((edgeId: string, currentEdges: any[]) => {
        const edge = currentEdges.find(e => e.data?.edgeId === edgeId);
        if (!edge) return;
        setModal({ open: true, edgeId, relationType: edge.data.relationType, description: edge.data.description || '', isNew: false });
    }, []);

    const buildDisplayEdges = useCallback((rawEdges: any[], edgeList: any[]) => {
        return rawEdges.map(e => ({
            ...e,
            markerEnd: e.type === 'knowledgeEdge' ? {
                type: MarkerType.ArrowClosed, width: 14, height: 14,
                color: getRelationMeta(e.data?.relationType).color,
            } : undefined,
            data: {
                ...e.data,
                onEdit: e.type === 'knowledgeEdge'
                    ? (id: string) => openEdit(id, edgeList)
                    : undefined,
            }
        }));
    }, [openEdit]);

    const loadGraph = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/projects/${projectId}/themes/graph-data`);
            if (!res.ok) throw new Error("API failed");
            const data = await res.json();

            const themeNodes = data.nodes.filter((n: any) => n.type === 'themeNode');
            const codeNodes = data.nodes.filter((n: any) => n.type === 'codeNode');
            const participantNodes = data.nodes.filter((n: any) => n.type === 'participantNode');

            // Compute layout for nodes that don't have a saved position yet
            const computedPositions = computeLayout(themeNodes, codeNodes, participantNodes, showCodes, showParticipants);

            const layoutNodes = data.nodes
                .filter((n: any) => {
                    if (n.type === 'codeNode' && !showCodes) return false;
                    if (n.type === 'participantNode' && !showParticipants) return false;
                    return true;
                })
                .map((node: any) => {
                    // Prefer the user's last-dragged position if available, fall back to computed layout
                    const userPos = savedPositionsRef.current.get(node.id);
                    const position = userPos ?? computedPositions.get(node.id) ?? { x: 400, y: 400 };
                    return {
                        ...node,
                        position,
                        draggable: true,
                    };
                });

            const filteredEdges = data.edges.filter((e: any) => {
                if (e.type === 'belongsToEdge' && !showCodes) return false;
                if (e.type === 'participantEdge' && !showParticipants) return false;
                if (e.type === 'knowledgeEdge') {
                    // Hide if either endpoint is hidden
                    const src = e.source;
                    const tgt = e.target;
                    if (src.startsWith('code-') && !showCodes) return false;
                    if (tgt.startsWith('code-') && !showCodes) return false;
                    if (src.startsWith('participant-') && !showParticipants) return false;
                    if (tgt.startsWith('participant-') && !showParticipants) return false;
                }
                return true;
            });

            const builtEdges = buildDisplayEdges(filteredEdges, filteredEdges);
            setNodes(layoutNodes);
            setEdges(builtEdges);
        } catch (e) { console.error(e); }
        setLoading(false);
    }, [projectId, showCodes, showParticipants, setNodes, setEdges, buildDisplayEdges]);

    useEffect(() => { loadGraph(); }, [loadGraph]);

    // Intercept node position changes to persist dragged positions
    const handleNodesChange = useCallback((changes: any[]) => {
        // In ReactFlow, `change.position` is only present while dragging (dragging=true).
        // On drag END event (dragging=false), position is undefined — so we must save
        // on every event that has a position, not just the final one.
        changes.forEach(change => {
            if (change.type === 'position' && change.position) {
                savedPositionsRef.current.set(change.id, change.position);
            }
        });
        onNodesChange(changes);
    }, [onNodesChange]);

    // Keep edge callbacks fresh
    useEffect(() => {
        setEdges(prev => prev.map(e => ({
            ...e,
            data: {
                ...e.data,
                onEdit: e.type === 'knowledgeEdge'
                    ? (id: string) => openEdit(id, prev)
                    : undefined,
            }
        })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [openEdit]);

    const onNodeClick = useCallback((_: React.MouseEvent, node: any) => {
        if (!connectSource) {
            // First click: select source
            setConnectSource(node.id);
        } else {
            // Second click: select target and open modal
            const src = connectSource;
            const tgt = node.id;
            
            // Validation
            if (src === tgt) { setConnectSource(null); return; }
            if (src.startsWith('participant-') && tgt.startsWith('participant-')) { setConnectSource(tgt); return; }
            if (src.startsWith('code-') && tgt.startsWith('theme-') && src.replace('code-', '') === tgt.replace('theme-', '')) { setConnectSource(tgt); return; }
            
            setModal({ open: true, relationType: 'RELATED_TO', description: '', isNew: true, sourceNodeId: src, targetNodeId: tgt });
            setConnectSource(null);
        }
    }, [connectSource]);

    const onPaneClick = useCallback(() => {
        setConnectSource(null);
    }, []);

    const onConnect = useCallback((params: Connection) => {
        if (!params.source || !params.target) return;
        setModal({ open: true, relationType: 'RELATED_TO', description: '', isNew: true, sourceNodeId: params.source, targetNodeId: params.target });
    }, []);

    const onEdgeClick = useCallback((_: React.MouseEvent, edge: any) => {
        if (edge.type === 'knowledgeEdge' && edge.data?.edgeId) {
            openEdit(edge.data.edgeId, edges);
        }
    }, [openEdit, edges]);

    const handleSave = async (relationType: string, description: string) => {
        if (modal.isNew) {
            await fetch(`/api/projects/${projectId}/knowledge-edges`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sourceNodeId: modal.sourceNodeId, targetNodeId: modal.targetNodeId, relationType, description }),
            });
        } else {
            await fetch(`/api/projects/${projectId}/knowledge-edges`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ edgeId: modal.edgeId, relationType, description }),
            });
        }
        setModal({ open: false, relationType: 'RELATED_TO', description: '' });
        loadGraph();
    };

    const handleDelete = async () => {
        if (!modal.edgeId) return;
        await fetch(`/api/projects/${projectId}/knowledge-edges?edgeId=${modal.edgeId}`, { method: 'DELETE' });
        setModal({ open: false, relationType: 'RELATED_TO', description: '' });
        loadGraph();
    };

    const edgeTypes = useMemo(() => ({
        belongsToEdge: BelongsToEdge,
        participantEdge: ParticipantEdge,
        knowledgeEdge: KnowledgeEdgeComponent,
    }), []);

    if (loading) return (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50">
            <svg className="w-8 h-8 animate-spin mb-4 text-indigo-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm font-bold text-slate-600">Building Knowledge Graph...</p>
            <p className="text-xs text-slate-400 mt-1">Mapping themes, codes & relationships</p>
        </div>
    );

    return (
        <div className="flex-1 relative w-full h-full bg-slate-50 overflow-hidden">

            {/* ── Top Controls ── */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
                <div className="bg-white/90 backdrop-blur border border-slate-200 shadow-sm rounded-xl px-4 py-2 flex items-center gap-4 text-[11px]">
                    <span className="font-extrabold text-slate-400 uppercase tracking-widest">Show:</span>
                    {[
                        { key: 'codes', label: 'Codes', value: showCodes, set: setShowCodes },
                        { key: 'participants', label: 'Participants', value: showParticipants, set: setShowParticipants },
                    ].map(({ key, label, value, set }) => (
                        <label key={key} className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-600">
                            <input type="checkbox" checked={value} onChange={e => set(e.target.checked)} className="accent-indigo-600 rounded" />
                            {label}
                        </label>
                    ))}
                    <div className="w-px h-4 bg-slate-200" />
                    <button onClick={() => setShowLegend(s => !s)} className="font-semibold text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
                        {showLegend ? 'Hide' : 'Show'} Guide
                    </button>
                    <button onClick={loadGraph} className="font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg>
                        Refresh
                    </button>
                    <div className="w-px h-4 bg-slate-200" />
                    <div className="px-2 py-1 rounded bg-slate-100 text-[9px] font-extrabold text-slate-400">
                        {connectSource ? <span className="text-rose-500 animate-pulse">Select target...</span> : 'Click nodes to connect'}
                    </div>
                </div>
            </div>

            {/* ── Legend / Guide Panel ── */}
            {showLegend && (
                <div className="absolute top-14 left-4 z-10 w-[230px]">
                    <div className="bg-white/95 backdrop-blur border border-slate-200 shadow-lg rounded-2xl p-4 space-y-3">

                        <div>
                            <h3 className="text-[11px] font-extrabold text-slate-700 flex items-center gap-1.5 mb-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" x2="15.42" y1="13.51" y2="17.49" /><line x1="15.41" x2="8.59" y1="6.51" y2="10.49" /></svg>
                                Knowledge Graph
                            </h3>
                            <p className="text-[9.5px] text-slate-500 leading-relaxed">A reflexive exploration canvas. Drag between any two nodes to hypothesise connections and discover meaning across your data.</p>
                        </div>

                        <div className="border-t border-slate-100 pt-3">
                            <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">Nodes</p>
                            <div className="space-y-1.5 text-[10px] text-slate-600">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[8px] font-extrabold">4</div>
                                    <span><b>Theme</b> — central concept group</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="px-2 py-0.5 rounded-lg border-2 border-indigo-200 bg-white text-[9px] font-bold text-slate-600">code</div>
                                    <span><b>Code</b> — radiates from theme</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-md bg-slate-200 flex-shrink-0" />
                                    <span><b>Participant</b> — data source</span>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-slate-100 pt-3">
                            <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">Connections</p>
                            <div className="space-y-1 text-[10px] text-slate-500">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 border-t border-slate-200 flex-shrink-0" />
                                    <span>Theme owns Code (implicit)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-8 border-t-2 border-dashed border-slate-300 flex-shrink-0" />
                                    <span>Participant data in Theme</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-8 border-t-2 border-indigo-400 flex-shrink-0" />
                                    <span>Your custom connection</span>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-slate-100 pt-3">
                            <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">Relationship Types</p>
                            <div className="space-y-1">
                                {RELATION_TYPES.map(r => (
                                    <div key={r.value} className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                                        <span className="text-[10px] font-bold" style={{ color: r.color }}>{r.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="border-t border-slate-100 pt-3 bg-indigo-50 -mx-4 -mb-4 px-4 pb-4 rounded-b-2xl">
                            <p className="text-[9.5px] text-indigo-600 font-semibold leading-relaxed">
                                💡 <b>Tip:</b> Click any node, then click another node to connect them. Or simply drag between their handles!
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── ReactFlow ── */}
            <ReactFlow
                nodes={nodes.map(n => ({
                    ...n,
                    style: {
                        ...n.style,
                        opacity: connectSource && n.id !== connectSource ? 0.6 : 1,
                        cursor: connectSource ? 'crosshair' : 'grab'
                    }
                }))}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                onConnect={onConnect}
                onEdgeClick={onEdgeClick}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                fitViewOptions={{ padding: 0.15 }}
                minZoom={0.1}
                connectionLineStyle={{ stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '6 3' }}
                connectionLineType={'bezier' as any}
                elementsSelectable={true}
            >
                <Background color="#e2e8f0" gap={24} size={1} />
                <Controls showInteractive={false} className="shadow-md" />
                <MiniMap zoomable pannable className="rounded-xl overflow-hidden border border-slate-200 shadow-md" />
            </ReactFlow>

            {/* ── Modal ── */}
            <EditModal
                state={modal}
                onSave={handleSave}
                onDelete={handleDelete}
                onClose={() => setModal({ open: false, relationType: 'RELATED_TO', description: '' })}
            />
        </div>
    );
}
