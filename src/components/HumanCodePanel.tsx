'use client'
import { useState } from 'react'

export default function HumanCodePanel({
    text,
    codeName,
    segmentId,
    onClose,
    onRemove,
}: {
    text: string
    codeName: string
    segmentId: string
    onClose: () => void
    onRemove?: (segId: string) => Promise<void>
    projectId?: string
}) {
    const ts = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    const [isDeleting, setIsDeleting] = useState(false)

    const handleDelete = async () => {
        if (!segmentId) return;
        setIsDeleting(true)
        try {
            const res = await fetch(`/api/segments/${segmentId}`, {
                method: 'DELETE',
            })
            if (!res.ok) throw new Error('Failed to delete segment')
            if (onRemove) {
                await onRemove(segmentId)
            } else {
                onClose()
            }
        } catch (error) {
            console.error('Failed to remove human highlight:', error)
            alert('Failed to remove the highlight.')
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between shadow-sm">
                <div>
                    <h3 className="font-semibold text-slate-800 text-sm">Human Code</h3>
                    <p className="text-xs text-slate-500">Researcher-assigned</p>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
                <div className="flex items-center gap-2 mb-5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200">
                        <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" /> Human Coded
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{ts}</span>
                </div>

                <div className="mb-5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Code Label</label>
                    <p className="text-xl font-bold text-slate-800">{codeName}</p>
                </div>

                <div className="mb-5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Source Text</label>
                    <p className="text-sm italic text-slate-600 border-l-2 border-purple-400 pl-3 py-1 leading-relaxed">"{text}"</p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-500 leading-relaxed">
                    <p className="font-semibold text-slate-600 mb-1">ℹ Researcher-initiated code</p>
                    This segment was highlighted and coded directly by the researcher. No AI baseline exists for comparison.
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Audit Trail</p>
                    <div className="text-[11px] text-slate-500 space-y-1 font-mono bg-slate-50 p-2.5 rounded border border-slate-100">
                        <div className="flex justify-between"><span className="text-slate-400">Coded by</span><span className="text-purple-600">Human (Researcher)</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Timestamp</span><span>{ts}</span></div>
                    </div>
                </div>

                {projectId && (
                    <div className="mt-5 p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl relative overflow-hidden group animate-in fade-in slide-in-from-bottom-2">
                        <div className="absolute right-0 top-0 opacity-10 text-indigo-500 scale-150 translate-x-2 -translate-y-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
                        </div>
                        <div className="relative z-10">
                            <p className="text-[11px] font-bold text-indigo-600 mb-1 flex items-center gap-1.5">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                                Code saved to project
                            </p>
                            <p className="text-[11px] text-slate-600 mb-3 leading-relaxed">
                                This code is ready to be clustered into broader themes.
                            </p>
                            <a href={`/projects/${projectId}/themes`} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-white px-2.5 py-1.5 rounded-lg border border-indigo-200 shadow-sm transition-all hover:shadow hover:-translate-y-[1px]">
                                Go to Theme Builder <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                            </a>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 bg-white border-t border-slate-200 space-y-2">
                <button className="w-full flex items-center justify-center gap-2 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition">
                    ✏ Edit Code Label
                </button>
                <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="w-full flex items-center justify-center gap-2 py-2 border border-red-200 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                >
                    {isDeleting ? 'Removing...' : '🗑 Remove Highlight'}
                </button>
            </div>
        </div>
    )
}

