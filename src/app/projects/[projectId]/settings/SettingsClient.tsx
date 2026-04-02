'use client'
import { useState } from 'react'

export default function SettingsClient({ projectId, project, initialSettings, logs, userProfile }: { 
    projectId: string, 
    project: any,
    initialSettings: any, 
    logs: any[],
    userProfile?: { name: string, email: string }
}) {
    const [activeTab, setActiveTab] = useState<'DETAILS' | 'LOGS'>('DETAILS')
    const [saving, setSaving] = useState(false)
    const [projectData, setProjectData] = useState({
        name: project.name || '',
        description: project.description || '',
        coreOntology: project.coreOntology || '',
        researchQuestion: project.researchQuestion || ''
    })

    const handleSaveProject = async () => {
        setSaving(true)
        try {
            const res = await fetch(`/api/projects/${projectId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(projectData)
            })
            if (!res.ok) throw new Error('Failed to update')
            alert('Project updated successfully!')
        } catch (e) {
            console.error(e)
            alert('Failed to update project')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2 border-b border-slate-200">
                <button 
                    onClick={() => setActiveTab('DETAILS')}
                    className={`px-4 py-3 text-sm font-extrabold transition-colors border-b-2 ${activeTab === 'DETAILS' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                    Project Detail
                </button>
                <button 
                    onClick={() => setActiveTab('LOGS')}
                    className={`px-4 py-3 text-sm font-extrabold transition-colors border-b-2 ${activeTab === 'LOGS' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                    Audit & System Logs
                </button>
            </div>

            {activeTab === 'DETAILS' && (
                <div className="space-y-6">
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col gap-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Project Name</label>
                                <input 
                                    type="text" 
                                    className="w-full rounded-xl border border-slate-300 text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 p-3 bg-white transition-all shadow-sm"
                                    value={projectData.name}
                                    onChange={e => setProjectData({ ...projectData, name: e.target.value })}
                                    placeholder="Enter project name..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Description</label>
                                <input 
                                    type="text" 
                                    className="w-full rounded-xl border border-slate-300 text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 p-3 bg-white transition-all shadow-sm"
                                    value={projectData.description}
                                    onChange={e => setProjectData({ ...projectData, description: e.target.value })}
                                    placeholder="Brief summary of the study..."
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Research Topic / Focus</label>
                            <textarea 
                                className="w-full rounded-xl border border-slate-300 text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 p-3 bg-white transition-all shadow-sm min-h-[100px]"
                                value={projectData.coreOntology}
                                onChange={e => setProjectData({ ...projectData, coreOntology: e.target.value })}
                                placeholder="Define the core domain, ontology, or specific topic being researched..."
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Research Question(s)</label>
                            <textarea 
                                className="w-full rounded-xl border border-slate-300 text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 p-3 bg-white transition-all shadow-sm min-h-[100px]"
                                value={projectData.researchQuestion}
                                onChange={e => setProjectData({ ...projectData, researchQuestion: e.target.value })}
                                placeholder="What critical questions is this research trying to answer?"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button 
                            onClick={handleSaveProject}
                            disabled={saving}
                            className="px-8 py-3 bg-indigo-600 text-white text-sm font-extrabold rounded-xl shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    Updating...
                                </>
                            ) : 'Save Project Details'}
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'LOGS' && (
                <div className="space-y-4">
                    <p className="text-xs text-slate-500 font-medium mb-2 pl-1">A read-only trail of all significant actions within this project.</p>
                    {logs.length === 0 ? (
                        <div className="p-12 text-center text-slate-300 text-sm flex flex-col items-center gap-3">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/></svg>
                            <span className="font-semibold">No activity logs yet. Logs appear after running analysis or making decisions.</span>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {logs.map(log => {
                                let parsed: any = {}
                                try { parsed = JSON.parse(log.newValue || '{}') } catch {}

                                const isAnalysis = log.eventType === 'AI_ANALYSIS_COMPLETE'
                                const isAutoClean = log.eventType === 'AUTO_CLEAN_COMPLETE'
                                const isReview = log.eventType.includes('REVIEW_DECISION')
                                const isDelete = log.eventType.includes('DELETED') || log.eventType.includes('REMOVED')
                                const isAdd = log.eventType.includes('CREATED') || log.eventType.includes('ADDED')

                                const badgeColor = isAnalysis ? 'bg-purple-100 text-purple-700'
                                    : isAutoClean ? 'bg-sky-100 text-sky-700'
                                    : isReview ? 'bg-emerald-100 text-emerald-700'
                                    : isDelete ? 'bg-rose-100 text-rose-700'
                                    : isAdd ? 'bg-indigo-100 text-indigo-700'
                                    : 'bg-slate-100 text-slate-500'

                                return (
                                    <div key={log.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors shadow-sm">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-start gap-3 min-w-0">
                                                <span className={`mt-0.5 flex-shrink-0 px-2 py-0.5 rounded-md font-extrabold uppercase tracking-wider text-[9px] ${badgeColor}`}>
                                                    {log.eventType.replace(/_/g, ' ')}
                                                </span>
                                                <div className="min-w-0">
                                                    {log.note && <p className="text-[12px] font-medium text-slate-700 leading-snug">{log.note}</p>}
                                                    <div className="flex flex-wrap gap-2 mt-1.5">
                                                        {isAnalysis && parsed.durationLabel && (
                                                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">⏱ {parsed.durationLabel}</span>
                                                        )}
                                                        {isAnalysis && parsed.modelsUsed?.length > 0 && (
                                                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">🤖 {parsed.modelsUsed.join(', ')}</span>
                                                        )}
                                                        {isAnalysis && parsed.segmentsFound !== undefined && (
                                                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">📌 {parsed.segmentsFound} segments</span>
                                                        )}
                                                        {isAnalysis && parsed.transcriptTitle && (
                                                            <span className="text-[10px] font-semibold text-indigo-500 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5">📄 {parsed.transcriptTitle}</span>
                                                        )}
                                                        {isAutoClean && parsed.droppedCount !== undefined && (
                                                            <span className="text-[10px] font-semibold text-sky-600 bg-sky-50 border border-sky-100 rounded px-1.5 py-0.5">🧹 {parsed.droppedCount} dropped</span>
                                                        )}
                                                        {log.eventType === 'TRANSCRIPT_VIEWED' && parsed.durationSeconds && (
                                                            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">👁️ {parsed.durationSeconds}s read</span>
                                                        )}
                                                        {log.oldValue && log.newValue && !isAnalysis && !isAutoClean && log.eventType !== 'TRANSCRIPT_VIEWED' && (
                                                            <span className="text-[10px] font-mono text-slate-400">{log.oldValue} → {log.newValue}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                                                    {new Date(log.createdAt).toLocaleString()}
                                                </span>
                                                {log.user?.name && (
                                                    <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                                        {log.user.name}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
