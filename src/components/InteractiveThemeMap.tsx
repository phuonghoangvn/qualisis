import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactFlow, { Background, Controls, MiniMap, Node, Edge, useNodesState, useEdgesState, Connection, Handle, Position, addEdge, getBezierPath, EdgeLabelRenderer, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';

// We reuse the ReactFlow logic. Each theme is a node. 

const CustomThemeNode = ({ data, selected }: any) => {
    return (
        <div 
            className={`bg-white border-2 rounded-2xl shadow-sm hover:shadow-md transition-all w-[320px] pb-4 flex flex-col ${selected ? 'border-indigo-500 ring-4 ring-indigo-500/20' : 'border-slate-200'}`}
            onDragOver={data.onDragOver}
            onDrop={(e) => data.onDrop(e, data.theme.id)}
        >
            <Handle type="target" position={Position.Top} className="w-3 h-3 bg-indigo-500" />
            <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-indigo-500" />
            
            <div className="bg-slate-50 flex items-center justify-between p-3 border-b border-slate-100 rounded-t-2xl drag-handle cursor-move">
                <h3 className="text-sm font-extrabold text-slate-800">{data.theme.name}</h3>
                <div className="flex items-center gap-1">
                    <button onClick={() => data.onEditClick(data.theme)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:bg-slate-200 rounded nodrag">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                    </button>
                    <button onClick={() => data.onDeleteClick(data.theme)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded nodrag">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                </div>
            </div>
            
            {data.theme.description && (
                <p className="text-xs text-slate-500 leading-relaxed px-4 py-3 border-b border-slate-50">{data.theme.description}</p>
            )}

            <div className="px-4 pt-3 flex-1 flex flex-col nodrag cursor-default">
                <div className="flex flex-wrap gap-1.5 min-h-[50px] p-2 bg-slate-50/80 rounded-xl border border-dashed border-slate-200">
                    {(!data.theme.codeLinks || data.theme.codeLinks.length === 0) && (
                        <div className="text-[10px] text-slate-400 font-medium italic w-full text-center py-2">Drop codes here</div>
                    )}
                    {data.theme.codeLinks?.map((link: any) => (
                        <span 
                            key={link.codebookEntry.id} 
                            draggable
                            onDragStart={(e) => data.onCodeDragStart(e, link.codebookEntry.id, data.theme.id)}
                            className="group flex items-center gap-1.5 bg-white border border-indigo-200 text-indigo-700 text-[10px] font-semibold pl-2 pr-1.5 py-1 rounded-md shadow-sm cursor-grab active:cursor-grabbing hover:border-indigo-400"
                        >
                            <span className="truncate max-w-[200px]">{link.codebookEntry.name}</span>
                            <div className="flex gap-0.5 border-l border-indigo-100 pl-1 ml-1">
                                <button onClick={() => data.onTraceClick(link.codebookEntry)} title="View quotes" className="text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 p-1 rounded">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/></svg>
                                </button>
                                <button onClick={() => data.onRemoveCode(data.theme.id, link.codebookEntry.id)} title="Remove code" className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-1 rounded">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                </button>
                            </div>
                        </span>
                    ))}
                </div>
                <div className="flex items-center justify-between mt-3 px-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{data.theme.codeLinks?.length || 0} Codes</span>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{data.theme.participantsCount || 0} Pax</span>
                </div>
            </div>
        </div>
    );
};

const RelationEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd, style }: any) => {
    const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
    const [hovered, setHovered] = useState(false);
    return (
        <>
            <path d={edgePath} fill="none" strokeWidth={20} stroke="transparent" style={{ cursor: 'pointer' }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} />
            <path id={id} className="react-flow__edge-path" d={edgePath} markerEnd={markerEnd} style={style} />
            <EdgeLabelRenderer>
                <div style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'all' }} className="nodrag nopan" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-white shadow-sm transition-all border-indigo-200">
                        <span className="text-[10px] font-bold text-indigo-600">{data?.label || "Connected"}</span>
                        {hovered && (
                            <button className="w-4 h-4 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center hover:bg-rose-200 transition-colors" onClick={() => data?.onDelete?.(id, data.relationId)}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                        )}
                    </div>
                </div>
            </EdgeLabelRenderer>
        </>
    );
};

const nodeTypes = { customTheme: CustomThemeNode };
const edgeTypes = { relation: RelationEdge };

export default function InteractiveThemeMap({ 
    themes, 
    projectId, 
    handleDragOver, 
    handleDropOnTheme, 
    handleDragStart,
    openTrace, 
    setNewThemeModal, 
    deleteTheme,
    removeCodeFromTheme
}: any) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    // Sync nodes from DB when themes change
    useEffect(() => {
        setNodes(nds => {
            const existing = new Map(nds.map(n => [n.id, n]));
            return themes.map((theme: any, idx: number) => {
                const isNew = !existing.has(theme.id);
                return {
                    id: theme.id,
                    type: 'customTheme',
                    position: theme.positionX && theme.positionY ? { x: theme.positionX, y: theme.positionY } : 
                              (existing.get(theme.id)?.position || { x: 100 + (idx % 3) * 360, y: 100 + Math.floor(idx / 3) * 360 }),
                    data: {
                        theme,
                        onDragOver: handleDragOver,
                        onDrop: handleDropOnTheme,
                        onCodeDragStart: handleDragStart,
                        onEditClick: (t: any) => setNewThemeModal({ open: true, id: t.id, name: t.name, description: t.description || '' }),
                        onDeleteClick: (t: any) => deleteTheme(t.id, t.name),
                        onTraceClick: (c: any) => openTrace(c.id, c.name),
                        onRemoveCode: (tid: string, cid: string) => removeCodeFromTheme(tid, cid)
                    },
                    dragHandle: '.drag-handle'
                };
            });
        });
    }, [themes, handleDragOver, handleDropOnTheme, handleDragStart, openTrace, setNewThemeModal, deleteTheme, removeCodeFromTheme]);

    // Load relations
    useEffect(() => {
        const loadRelations = async () => {
            try {
                const res = await fetch(`/api/projects/${projectId}/themes/relations`);
                if (!res.ok) return;
                const data = await res.json();
                setEdges(data.map((r: any) => ({
                    id: r.id,
                    source: r.sourceId,
                    target: r.targetId,
                    type: 'relation',
                    style: { stroke: '#818cf8', strokeWidth: 2 },
                    markerEnd: { type: MarkerType.ArrowClosed, color: '#818cf8' },
                    data: { label: r.relationType.replace(/_/g, ' '), relationId: r.id, onDelete: handleDeleteEdge }
                })));
            } catch (e) {}
        };
        loadRelations();
    }, [projectId]);

    const handleDeleteEdge = useCallback((edgeId: string, relationId: string) => {
        if (!confirm('Delete this connection?')) return;
        setEdges(eds => eds.filter(e => e.id !== edgeId));
        if (relationId) fetch(`/api/projects/${projectId}/themes/relations/${relationId}`, { method: 'DELETE' });
    }, [projectId]);

    const onConnect = useCallback(async (connection: Connection) => {
        if (connection.source === connection.target) return;
        
        try {
            const res = await fetch(`/api/projects/${projectId}/themes/relations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sourceId: connection.source, targetId: connection.target, relationType: 'RELATED_TO' })
            });
            if (res.ok) {
                const r = await res.json();
                setEdges(eds => [...eds, {
                    id: r.id,
                    source: r.sourceId,
                    target: r.targetId,
                    type: 'relation',
                    style: { stroke: '#818cf8', strokeWidth: 2 },
                    markerEnd: { type: MarkerType.ArrowClosed, color: '#818cf8' },
                    data: { label: 'RELATED TO', relationId: r.id, onDelete: handleDeleteEdge }
                }]);
            }
        } catch (e) {}
    }, [projectId]);

    const onNodeDragStop = useCallback((_: any, node: Node) => {
        const existing = saveTimers.current.get(node.id);
        if (existing) clearTimeout(existing);
        const timer = setTimeout(() => {
            fetch(`/api/projects/${projectId}/themes/${node.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ positionX: node.position.x, positionY: node.position.y })
            }).catch(e => console.error(e));
            saveTimers.current.delete(node.id);
        }, 600);
        saveTimers.current.set(node.id, timer);
    }, [projectId]);

    return (
        <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.1}
            maxZoom={2}
        >
            <Background color="#cbd5e1" gap={24} size={1.5} />
            <Controls className="bg-white border text-slate-500 shadow-lg rounded-xl overflow-hidden" showInteractive={false} />
            <MiniMap pannable zoomable className="rounded-xl border border-slate-200 shadow-md" />
        </ReactFlow>
    );
}
