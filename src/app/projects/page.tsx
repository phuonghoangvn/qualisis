import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import CreateProjectButton from '@/components/CreateProjectButton'
import DeleteProjectButton from '@/components/DeleteProjectButton'
import { Network, Home, Settings, Plus, FolderOpen, FileText } from 'lucide-react'

export default async function ProjectsDashboard() {
    const projects = await prisma.project.findMany({
        include: {
            datasets: {
                include: { _count: { select: { transcripts: true } } }
            }
        },
        orderBy: { updatedAt: 'desc' }
    })

    return (
        <div className="flex h-screen w-full bg-slate-50/50 overflow-hidden">
            {/* LEFT SIDEBAR (Home Version) */}
            <aside className="w-1/5 min-w-[250px] max-w-[300px] border-r border-slate-200/60 bg-slate-50 flex flex-col z-20 flex-shrink-0">
                <div className="p-6 border-b border-slate-200/60 flex-shrink-0">
                    <h1 className="font-extrabold text-xl text-slate-800 flex items-center gap-2 tracking-tight">
                        <Network className="w-6 h-6 text-indigo-600" />
                        QualiSIS
                    </h1>
                    <p className="text-[11px] font-medium text-slate-500 mt-1 uppercase tracking-widest">
                        Traceable AI Workstation
                    </p>
                </div>

                <div className="p-4 flex-1 overflow-y-auto">
                    <nav className="space-y-1.5">
                        <Link href="/projects" className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg bg-white text-indigo-700 shadow-sm border border-slate-200 transition-all">
                            <Home className="w-4 h-4" /> Home / Projects
                        </Link>
                    </nav>
                </div>

                <div className="mt-auto p-4 border-t border-slate-200/60 bg-transparent flex-shrink-0">
                    <button className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-all py-2.5 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 hover:shadow-sm">
                        <Settings className="w-4 h-4" /> Platform Settings
                    </button>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col h-full bg-slate-50/50 overflow-y-auto relative">
                {/* Header */}
                <div className="h-16 border-b border-slate-200/60 bg-white/80 backdrop-blur-md flex items-center justify-between px-8 flex-shrink-0 sticky top-0 z-10 w-full">
                    <h2 className="text-lg font-bold text-slate-800 tracking-tight">Projects Dashboard</h2>
                    <CreateProjectButton />
                </div>

                <div className="p-10 max-w-6xl mx-auto w-full">
                    {/* Hero Section */}
                    <div className="mb-10">
                        <h1 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">Projects Overview</h1>
                        <p className="text-slate-500 font-medium">Manage your qualitative research projects and datasets.</p>
                    </div>

                    {/* Projects Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Always show Create New Project Card first */}
                        {/* Note: This is a visually large button that matches the design. We will use a Client component wrapper or just link to the button's action */}
                        {/* For simplicity we will just render the button logic inside CreateProjectButton. But to make this clickable card trigger modal, we can let CreateProjectButton accept a children prop! */}
                        {/* Actually, I will just make the card trigger router.push('/projects/new') or similar, but since CreateProjectButton handles modal, let's keep it simple. */}
                        <div className="relative">
                            <CreateProjectCardTrigger />
                        </div>

                        {projects.map(p => {
                            const totalTranscripts = p.datasets.reduce((sum, ds) => sum + ds._count.transcripts, 0)
                            return (
                                <Link 
                                    href={`/projects/${p.id}`}
                                    key={p.id}
                                    className="bg-white border text-left border-slate-200 rounded-2xl p-6 hover:shadow-md hover:border-indigo-300 transition-all group relative overflow-hidden h-64 flex flex-col"
                                >
                                    <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <DeleteProjectButton projectId={p.id} projectName={p.name} />
                                    <h3 className="font-bold text-slate-800 text-lg mb-2 pr-8">{p.name}</h3>
                                    <p className="text-slate-500 text-sm line-clamp-3 mb-auto h-16">
                                        {p.description || "No description provided."}
                                    </p>
                                    
                                    <div className="flex items-center justify-between text-sm text-slate-500 border-t border-slate-100 pt-4 mt-auto w-full">
                                        <div className="flex gap-4">
                                            <span className="flex items-center gap-1.5 font-medium" title="Datasets">
                                                <FolderOpen className="w-4 h-4" /> {p.datasets.length}
                                            </span>
                                            <span className="flex items-center gap-1.5 font-medium" title="Transcripts">
                                                <FileText className="w-4 h-4" /> {totalTranscripts}
                                            </span>
                                        </div>
                                        <span className="text-xs font-medium">
                                            {p.updatedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            </main>
        </div>
    )
}

function CreateProjectCardTrigger() {
    return (
        <CreateProjectButton asCard />
    )
}
