import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import UploadDatasetWrapper from '@/components/UploadDatasetWrapper'
import DeleteTranscriptButton from '@/components/DeleteTranscriptButton'
import DeleteDatasetButton from '@/components/DeleteDatasetButton'
import EditDatasetTitle from '@/components/EditDatasetTitle'
import EditTranscriptTitle from '@/components/EditTranscriptTitle'

export const dynamic = 'force-dynamic'

export default async function ProjectDashboard({
    params
}: {
    params: { projectId: string }
}) {
    const project = await prisma.project.findUnique({
        where: { id: params.projectId },
        include: {
            datasets: {
                include: {
                    transcripts: {
                        include: {
                            _count: { select: { segments: true } }
                        },
                        orderBy: { createdAt: 'desc' }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }
        }
    })

    if (!project) notFound()

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <header className="px-8 py-5 border-b border-slate-200/60 flex items-center justify-between bg-white flex-shrink-0 z-10 sticky top-0">
                <div className="flex items-center gap-4">
                    <Link href="/projects" className="text-slate-400 hover:text-indigo-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-left"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
                    </Link>
                    <div className="w-px h-6 bg-slate-200"></div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 tracking-tight">Data Management</h2>
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                            <span>{project.datasets.length === 0 ? 'No transcripts uploaded yet' : project.name}</span>
                        </div>
                    </div>
                </div>
                {project.datasets.length > 0 && (
                    <UploadDatasetWrapper projectId={project.id} />
                )}
            </header>

            {/* Content: Datasets List */}
            <main className="flex-1 flex overflow-y-auto bg-slate-50/50">
                {project.datasets.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center p-8 bg-slate-50/50">
                        <div className="max-w-4xl w-full bg-white border border-slate-100 p-10 rounded-[32px] shadow-xl shadow-slate-200/50 relative overflow-hidden flex flex-col md:flex-row gap-10 items-center">
                            {/* Left Side: Steps */}
                            <div className="flex-1 w-full md:pr-10 md:border-r border-slate-100 relative">
                                <h2 className="text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">Quick Start Guide</h2>
                                <p className="text-slate-500 mb-10 text-sm leading-relaxed font-medium">Follow these core steps to complete your qualitative analysis.</p>
                                
                                <div className="space-y-8 relative before:absolute before:inset-0 before:ml-[19px] before:-translate-x-px before:h-full before:w-[2px] before:bg-slate-100">
                                    <div className="relative flex items-start gap-5">
                                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center flex-shrink-0 z-10 border-4 border-white shadow-sm text-sm">1</div>
                                        <div className="pt-2">
                                            <h4 className="font-bold text-slate-800 text-sm">Transcripts & Coding</h4>
                                            <p className="text-sm text-slate-500 mt-1">Upload files, highlight text segments and assign codes.</p>
                                        </div>
                                    </div>
                                    <div className="relative flex items-start gap-5 opacity-50">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 font-extrabold flex items-center justify-center flex-shrink-0 z-10 border-4 border-white text-sm">2</div>
                                        <div className="pt-2">
                                            <h4 className="font-bold text-slate-800 text-sm">Build Themes</h4>
                                            <p className="text-sm text-slate-500 mt-1">Group your codes into overarching themes.</p>
                                        </div>
                                    </div>
                                    <div className="relative flex items-start gap-5 opacity-50">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 font-extrabold flex items-center justify-center flex-shrink-0 z-10 border-4 border-white text-sm">3</div>
                                        <div className="pt-2">
                                            <h4 className="font-bold text-slate-800 text-sm">Export Report</h4>
                                            <p className="text-sm text-slate-500 mt-1">Review the codebook and generate summaries.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Side: Upload Action */}
                            <div className="flex-[0.8] w-full flex flex-col items-center text-center py-6">
                                <div className="w-24 h-24 bg-indigo-50/80 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-indigo-100/50 shadow-inner">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/></svg>
                                </div>
                                <h3 className="text-xl font-extrabold text-slate-900 mb-2">Step 1: Get Started</h3>
                                <p className="text-sm text-slate-500 mb-8 px-4 font-medium">Create your first dataset to unlock the entire analysis workspace.</p>
                                
                                <div className="w-full max-w-[300px]">
                                    <UploadDatasetWrapper projectId={project.id} asCard />
                                </div>
                                <p className="text-xs font-medium text-slate-400 mt-5">Supported formats: TXT, DOCX, PDF, VTT.</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto space-y-8 w-full p-8">
                        {project.datasets.map(dataset => (
                            <section key={dataset.id} className="group/dataset bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                    <div className="flex-1 min-w-0 mr-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">📂</span>
                                            <EditDatasetTitle datasetId={dataset.id} initialName={dataset.name} />
                                        </div>
                                        {dataset.description && (
                                            <p className="text-xs text-slate-500 mt-1 pl-8">{dataset.description}</p>
                                        )}
                                    </div>
                                    <span className="text-xs font-semibold px-2 py-1 bg-white border border-slate-200 text-slate-500 rounded-lg shadow-sm">
                                        {dataset.transcripts.length} Transcripts
                                    </span>
                                    <DeleteDatasetButton datasetId={dataset.id} datasetName={dataset.name} />
                                </div>
                                
                                <div className="divide-y divide-slate-100">
                                    {dataset.transcripts.length === 0 ? (
                                        <div className="px-6 py-8 text-center text-sm text-slate-400">
                                            Empty dataset.
                                        </div>
                                    ) : (
                                        dataset.transcripts.map(t => (
                                            <div key={t.id} className="group relative flex items-center bg-white hover:bg-indigo-50/50 transition-colors border-b border-slate-100 last:border-0 pl-6 py-4">
                                                {/* Background Clickable Link overlay */}
                                                <Link 
                                                    href={`/projects/${project.id}/transcripts/${t.id}`}
                                                    className="absolute inset-0 z-0"
                                                />
                                                
                                                <div className="flex-1 min-w-0 pr-4 relative z-10 pointer-events-none">
                                                    <div className="flex items-center justify-between pointer-events-auto">
                                                        <div className="w-full">
                                                            <div className="-ml-3 mb-1 w-max">
                                                                <EditTranscriptTitle transcriptId={t.id} initialTitle={t.title} />
                                                            </div>
                                                            <div className="flex items-center gap-4 mt-1 ml-3 text-xs text-slate-500 pointer-events-none">
                                                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300"></span>{t.status}</span>
                                                                {t._count.segments > 0 && <span>{t._count.segments} segments</span>}
                                                                <span>Added {t.createdAt.toLocaleDateString()}</span>
                                                            </div>
                                                        </div>

                                                    </div>
                                                </div>
                                                <div className="pr-6 flex items-center justify-center relative z-10 pointer-events-auto">
                                                    <DeleteTranscriptButton transcriptId={t.id} transcriptTitle={t.title} />
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
}
