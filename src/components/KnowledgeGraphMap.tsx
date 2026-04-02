'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, { Background, Controls, MiniMap, Handle, Position, MarkerType, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';
import { getTranscriptIdentity } from '@/lib/utils';

const PALETTE = [
    { border: 'border-indigo-300', light: 'bg-indigo-50', solid: '#6366f1', pale: '#e0e7ff' },
    { border: 'border-pink-300', light: 'bg-pink-50', solid: '#ec4899', pale: '#fce7f3' },
    { border: 'border-amber-300', light: 'bg-amber-50', solid: '#f59e0b', pale: '#fef3c7' },
    { border: 'border-emerald-300', light: 'bg-emerald-50', solid: '#10b981', pale: '#d1fae5' },
    { border: 'border-cyan-300', light: 'bg-cyan-50', solid: '#06b6d4', pale: '#cffafe' },
    { border: 'border-violet-300', light: 'bg-violet-50', solid: '#8b5cf6', pale: '#ede9fe' },
];

// Custom Theme Node
const ThemeNode = ({ data, selected }: any) => {
    const idx = (data.label.length % PALETTE.length);
    const p = PALETTE[idx];
    return (
        <div className={`px-4 py-2 rounded-full border-2 bg-gradient-to-br from-white to-slate-50 flex items-center gap-2 shadow-sm transition-all duration-300 ${selected ? 'ring-4 ring-offset-2 scale-110 shadow-lg' : ''}`} style={{ borderColor: selected ? p.solid : '#cbd5e1' }}>
            <Handle type="target" position={Position.Top} className="opacity-0" />
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: p.solid }}>
                {data.codeCount || 0}
            </div>
            <span className={`text-[11px] font-extrabold ${selected ? 'text-slate-900' : 'text-slate-700'}`}>
                {data.label}
            </span>
            <Handle type="source" position={Position.Bottom} className="opacity-0" />
        </div>
    );
};

// Custom Participant Node
const ParticipantNode = ({ data, selected }: any) => {
    const identity = getTranscriptIdentity(data.label);
    return (
        <div className={`px-3 py-1.5 rounded-lg border-2 flex items-center gap-2 bg-white shadow-sm transition-all duration-300 ${selected ? 'ring-4 ring-offset-2 scale-110 shadow-md ring-slate-200 border-slate-400' : 'border-slate-200'}`}>
            <Handle type="source" position={Position.Bottom} className="opacity-0" />
            <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold ${identity.color} ${identity.text}`}>
                {identity.initials}
            </div>
            <span className="text-[10px] font-bold text-slate-600 truncate max-w-[100px]">{data.label}</span>
            <Handle type="target" position={Position.Top} className="opacity-0" />
        </div>
    );
};

const nodeTypes = {
    themeNode: ThemeNode,
    participantNode: ParticipantNode
};

export default function KnowledgeGraphMap({ projectId, onThemeSelect }: { projectId: string, onThemeSelect?: (id: string | null) => void }) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [loading, setLoading] = useState(true);
    
    // Highlight logic
    const [highlightedNode, setHighlightedNode] = useState<string | null>(null);

    const loadGraph = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/projects/${projectId}/themes/graph-data`);
            if (!res.ok) return;
            const data = await res.json();
            
            // Simple Concentric Circular Layout
            const themeNodes = data.nodes.filter((n: any) => n.type === 'themeNode');
            const participantNodes = data.nodes.filter((n: any) => n.type === 'participantNode');
            
            const layoutNodes: any[] = [];
            
            // Themes in inner circle
            const tRadius = Math.max(150, themeNodes.length * 30);
            themeNodes.forEach((node: any, i: number) => {
                const angle = (2 * Math.PI / themeNodes.length) * i;
                layoutNodes.push({
                    ...node,
                    position: { x: 400 + tRadius * Math.cos(angle), y: 350 + tRadius * Math.sin(angle) }
                });
            });
            
            // Participants in outer circle
            const pRadius = tRadius + 220;
            participantNodes.forEach((node: any, i: number) => {
                const angle = (2 * Math.PI / participantNodes.length) * i - Math.PI / 4;
                layoutNodes.push({
                    ...node,
                    position: { x: 400 + pRadius * Math.cos(angle), y: 350 + pRadius * Math.sin(angle) }
                });
            });

            const parsedEdges = data.edges.map((edge: any) => ({
                ...edge,
                style: { strokeWidth: edge.data.weight * 1.5, stroke: '#cbd5e1' },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' }
            }));

            setNodes(layoutNodes);
            setEdges(parsedEdges);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    }, [projectId, setNodes, setEdges]);

    useEffect(() => {
        loadGraph();
    }, [loadGraph]);

    const onNodeClick = (_: any, node: any) => {
        const isSelected = highlightedNode === node.id;
        const targetId = isSelected ? null : node.id;
        
        setHighlightedNode(targetId);
        
        // Notify Parent to open Theme Sidebar if theme selected
        if (targetId && node.type === 'themeNode' && onThemeSelect) {
            onThemeSelect(node.data.themeId);
        } else if (!targetId && onThemeSelect) {
            onThemeSelect(null);
        }
    };

    const displayNodes = useMemo(() => {
        if (!highlightedNode) return nodes;
        
        // Find connected edges
        const connectedEdgeIds = new Set(edges.filter(e => e.source === highlightedNode || e.target === highlightedNode).flatMap(e => [e.source, e.target]));
        connectedEdgeIds.add(highlightedNode);
        
        return nodes.map((n) => ({
            ...n,
            style: { ...n.style, opacity: connectedEdgeIds.has(n.id) ? 1 : 0.2 }
        }));
    }, [nodes, edges, highlightedNode]);

    const displayEdges = useMemo(() => {
        if (!highlightedNode) return edges;
        return edges.map((e) => ({
            ...e,
            style: { ...e.style, stroke: (e.source === highlightedNode || e.target === highlightedNode) ? '#6366f1' : '#f1f5f9', opacity: (e.source === highlightedNode || e.target === highlightedNode) ? 1 : 0.1 }
        }));
    }, [edges, highlightedNode]);


    if (loading) return (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-white relative">
            <svg className="w-8 h-8 animate-spin mb-4 text-indigo-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm font-bold text-slate-700">Assembling Knowledge Graph...</p>
        </div>
    );

    return (
        <div className="flex-1 relative w-full h-full bg-slate-50 overflow-hidden">
            <div className="absolute top-4 left-4 z-10 pointer-events-none">
                <div className="bg-white/80 backdrop-blur border border-slate-200 shadow-sm p-3 rounded-xl pointer-events-auto">
                    <h3 className="text-xs font-extrabold text-slate-800 mb-2 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>
                        Graph Filters
                    </h3>
                    <p className="text-[10px] text-slate-500 max-w-[200px] mb-2 leading-relaxed">
                        Click on any Participant or Theme node to isolate its relationships.
                    </p>
                    {highlightedNode && (
                        <button onClick={() => { setHighlightedNode(null); if(onThemeSelect) onThemeSelect(null); }} className="w-full text-[10px] font-bold text-white bg-slate-800 hover:bg-slate-900 py-1.5 rounded transition-colors flex justify-center items-center gap-1">
                            Clear Filter
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
                    )}
                </div>
            </div>

            <ReactFlow
                nodes={displayNodes}
                edges={displayEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.2}
            >
                <Background color="#cbd5e1" gap={20} size={1} />
                <Controls showInteractive={false} className="shadow-lg border-none" />
                <MiniMap zoomable pannable className="rounded-xl overflow-hidden border border-slate-200 shadow-md" />
            </ReactFlow>
        </div>
    );
}
