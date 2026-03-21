'use client'
import { useState } from 'react'

export default function SettingsClient({ projectId, initialSettings, logs }: { 
    projectId: string, 
    initialSettings: any, 
    logs: any[] 
}) {
    const [activeTab, setActiveTab] = useState<'API' | 'LOGS'>('API')
    const [settings, setSettings] = useState(initialSettings || {})
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        setSaving(true)
        try {
            await fetch(`/api/projects/${projectId}/settings`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ aiSettings: settings })
            })
            alert('Settings saved successfully!')
        } catch (e) {
            console.error(e)
            alert('Failed to save settings')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2 border-b border-slate-200">
                <button 
                    onClick={() => setActiveTab('API')}
                    className={`px-4 py-3 text-sm font-extrabold transition-colors border-b-2 ${activeTab === 'API' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                    AI Engines & Rules
                </button>
                <button 
                    onClick={() => setActiveTab('LOGS')}
                    className={`px-4 py-3 text-sm font-extrabold transition-colors border-b-2 ${activeTab === 'LOGS' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                    Audit & System Logs
                </button>
            </div>

            {activeTab === 'API' && (
                <div className="space-y-6">
                    <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 flex flex-col gap-4">
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>
                                Default Suggestion Engline
                            </h3>
                            <p className="text-[11px] text-slate-500">The primary model used to initially tag highlights</p>
                            <select 
                                value={settings.defaultModel || 'gpt-4o-mini'}
                                onChange={e => setSettings({ ...settings, defaultModel: e.target.value })}
                                className="mt-2 w-full max-w-sm rounded-lg border-slate-300 text-sm focus:ring-indigo-500 focus:border-indigo-500 p-2 border"
                            >
                                <option value="gpt-4o-mini">GPT-4o Mini (Cost-effective, Fast)</option>
                                <option value="gpt-4o">GPT-4o (High-Accuracy, Expensive)</option>
                                <option value="claude-3-5-sonnet">Claude 3.5 Sonnet (Nuanced)</option>
                            </select>
                        </div>
                        
                        <div className="pt-4 border-t border-slate-200">
                            <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
                                Scoring / Validation Engine
                            </h3>
                            <p className="text-[11px] text-slate-500">The model that cross-checks other AI suggestions to calculate confidence scores (0-100%).</p>
                            <select 
                                value={settings.scoringModel || 'gpt-4o-mini'}
                                onChange={e => setSettings({ ...settings, scoringModel: e.target.value })}
                                className="mt-2 w-full max-w-sm rounded-lg border-slate-300 text-sm focus:ring-indigo-500 focus:border-indigo-500 p-2 border"
                            >
                                <option value="gpt-4o-mini">GPT-4o Mini (Fast)</option>
                                <option value="gpt-4o">GPT-4o (Strict/Rigorous Scoring)</option>
                            </select>
                        </div>
                    </div>

                    <button 
                        onClick={handleSave} 
                        disabled={saving}
                        className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl shadow-sm hover:bg-indigo-700 hover:shadow-md transition-all flex items-center gap-2"
                    >
                        {saving ? 'Saving...' : 'Save Configuration'}
                    </button>
                    <p className="text-[10px] text-slate-400 font-medium">Any changes apply only to future Analysis / AI runs within this project.</p>
                </div>
            )}

            {activeTab === 'LOGS' && (
                <div className="space-y-4">
                    <p className="text-xs text-slate-500 font-medium mb-2">A read-only trail of all significant actions and AI runs within this project.</p>
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
                                    <div key={log.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors">
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
                                                        {log.oldValue && log.newValue && !isAnalysis && !isAutoClean && (
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
