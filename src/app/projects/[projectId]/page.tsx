import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import UploadDatasetWrapper from '@/components/UploadDatasetWrapper'

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
                        <h2 className="text-lg font-bold text-slate-800 tracking-tight">Dataset Workspace</h2>
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
                        <div className="max-w-md w-full bg-white border border-slate-100 p-12 rounded-[24px] shadow-xl shadow-slate-200/50 text-center relative overflow-hidden">
                            <div className="w-24 h-24 bg-indigo-50/80 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-8 relative z-10 border border-indigo-100/50 shadow-inner">
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-upload-cloud"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/></svg>
                            </div>
                            <h2 className="text-2xl font-extrabold text-slate-900 mb-3 tracking-tight relative z-10">Upload your first transcript</h2>
                            <p className="text-slate-500 mb-8 leading-relaxed font-medium relative z-10">
                                Begin your qualitative analysis by importing interview transcripts, field notes, or focus group data.
                            </p>
                            
                            <UploadDatasetWrapper projectId={project.id} asCard />

                            <p className="text-xs font-medium text-slate-400 relative z-10 mt-5">Supported formats: TXT, DOCX, PDF, VTT.</p>
                        </div>
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto space-y-8 w-full p-8">
                        {project.datasets.map(dataset => (
                            <section key={dataset.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                            <span>📂</span> {dataset.name}
                                        </h2>
                                        {dataset.description && (
                                            <p className="text-xs text-slate-500 mt-1">{dataset.description}</p>
                                        )}
                                    </div>
                                    <span className="text-xs font-semibold px-2 py-1 bg-white border border-slate-200 text-slate-500 rounded-lg shadow-sm">
                                        {dataset.transcripts.length} Transcripts
                                    </span>
                                </div>
                                
                                <div className="divide-y divide-slate-100">
                                    {dataset.transcripts.length === 0 ? (
                                        <div className="px-6 py-8 text-center text-sm text-slate-400">
                                            Empty dataset.
                                        </div>
                                    ) : (
                                        dataset.transcripts.map(t => (
                                            <Link 
                                                key={t.id} 
                                                href={`/projects/${project.id}/transcripts/${t.id}`}
                                                className="block px-6 py-4 hover:bg-indigo-50/50 transition-colors group"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h4 className="font-semibold text-slate-800 text-[15px] group-hover:text-indigo-700 transition-colors">
                                                            {t.title}
                                                        </h4>
                                                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                                                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300"></span>{t.status}</span>
                                                            {t._count.segments > 0 && <span>{t._count.segments} segments</span>}
                                                            <span>Added {t.createdAt.toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                    <span className="text-indigo-400 group-hover:translate-x-1 transition-transform">
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                                    </span>
                                                </div>
                                            </Link>
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
