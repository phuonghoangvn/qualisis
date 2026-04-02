import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

const statusConfig: Record<string, { label: string; className: string }> = {
    PENDING:   { label: 'Pending',   className: 'bg-amber-50 text-amber-600 border-amber-200' },
    REVIEWING: { label: 'In Review', className: 'bg-blue-50 text-blue-600 border-blue-200' },
    CODED:     { label: 'Coded',     className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    DONE:      { label: 'Done',      className: 'bg-slate-100 text-slate-500 border-slate-200' },
}

export default async function CodingPage({ params }: { params: { projectId: string } }) {
    const project = await prisma.project.findUnique({
        where: { id: params.projectId },
        include: {
            datasets: {
                include: {
                    transcripts: {
                        include: { _count: { select: { segments: true } } },
                        orderBy: { createdAt: 'desc' }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }
        }
    })
    if (!project) notFound()

    const allTranscripts = project.datasets.flatMap((d) =>
        d.transcripts.map((t) => ({ ...t, datasetName: d.name }))
    )
    const codedCount = allTranscripts.filter((t) => t.status === 'CODED' || t.status === 'DONE').length

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <header className="px-8 py-5 border-b border-slate-200 flex items-center justify-between bg-white flex-shrink-0">
                <div>
                    <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">② Coding</h1>
                    <p className="text-sm text-slate-500 mt-0.5 font-medium">
                        Select a transcript to review AI codes and add manual annotations
                    </p>
                </div>
                {allTranscripts.length > 0 && (
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Coded</p>
                            <p className="text-sm font-extrabold text-slate-700">{codedCount} / {allTranscripts.length}</p>
                        </div>
                        <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-indigo-500 rounded-full transition-all"
                                style={{ width: `${(codedCount / allTranscripts.length) * 100}%` }}
                            />
                        </div>
                    </div>
                )}
            </header>

            {/* Transcript List */}
            <main className="flex-1 overflow-y-auto bg-slate-50/30">
                {allTranscripts.length === 0 ? (
                    <div className="flex items-center justify-center h-full p-8">
                        <div className="text-center max-w-sm">
                            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300">
                                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
                                    <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
                                </svg>
                            </div>
                            <p className="font-bold text-slate-500 mb-1">No transcripts yet</p>
                            <p className="text-sm text-slate-400 mb-5">Upload data in <strong>① Prepare Data</strong> first.</p>
                            <Link
                                href={`/projects/${params.projectId}`}
                                className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
                                Go to Prepare Data
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="max-w-3xl mx-auto w-full p-8">
                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-slate-100">
                            {allTranscripts.map((t) => {
                                const s = statusConfig[t.status] ?? { label: t.status, className: 'bg-slate-100 text-slate-500 border-slate-200' }
                                return (
                                    <Link
                                        key={t.id}
                                        href={`/projects/${params.projectId}/transcripts/${t.id}`}
                                        className="flex items-center gap-4 px-6 py-4 hover:bg-indigo-50/50 transition-colors group"
                                    >
                                        {/* Icon */}
                                        <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0 group-hover:border-indigo-200 group-hover:bg-indigo-50 transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 group-hover:text-indigo-500 transition-colors">
                                                <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
                                                <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
                                            </svg>
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2.5 mb-0.5">
                                                <span className="text-[14px] font-bold text-slate-800 truncate group-hover:text-indigo-700 transition-colors">
                                                    {t.title}
                                                </span>
                                                <span className={`flex-shrink-0 text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${s.className}`}>
                                                    {s.label}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[12px] text-slate-400 font-medium">
                                                <span className="text-[10px] bg-slate-100 text-slate-400 font-bold px-2 py-0.5 rounded border border-slate-200">
                                                    {t.datasetName}
                                                </span>
                                                <span>·</span>
                                                <span>{t._count.segments} segments</span>
                                                <span>·</span>
                                                <span>Added {new Date(t.createdAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>

                                        {/* Arrow */}
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all flex-shrink-0">
                                            <path d="m9 18 6-6-6-6"/>
                                        </svg>
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
