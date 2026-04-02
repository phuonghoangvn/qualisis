import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import CreateProjectButton from '@/components/CreateProjectButton'
import DeleteProjectButton from '@/components/DeleteProjectButton'
import { UserDropdown } from '@/components/UserDropdown'
import GlobalSignOutButton from '@/components/GlobalSignOutButton'
import { Network, Home, Settings, Plus, FolderOpen, FileText } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ProjectsDashboard() {
    const session = await getServerSession(authOptions)
    const userId = session?.user ? (session.user as any).id : null

    if (!userId) {
        redirect('/login')
    }

    const projects = await prisma.project.findMany({
        where: {
            members: {
                some: { userId }
            }
        },
        include: {
            datasets: {
                include: { _count: { select: { transcripts: true } } }
            }
        },
        orderBy: { updatedAt: 'desc' }
    })

    return (
        <div className="flex h-screen w-full bg-slate-50/50 overflow-hidden">
            {/* MAIN CONTENT (No Sidebar for Dashboard) */}
            <main className="flex-1 flex flex-col h-full bg-slate-50/50 overflow-y-auto relative w-full">
                {/* Header Navbar */}
                <div className="h-16 border-b border-slate-200/60 bg-white/80 backdrop-blur-md flex items-center justify-between px-8 flex-shrink-0 sticky top-0 z-50 w-full shadow-sm">
                    {/* Logo Area */}
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0 text-white font-bold shadow-sm">
                            <Network className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-extrabold text-slate-800 tracking-tight leading-tight">QualiSIS</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Traceable AI Workstation</span>
                        </div>
                    </div>

                    {/* Actions Area */}
                    <div className="flex items-center gap-5">
                        <CreateProjectButton />
                        <div className="h-6 w-px bg-slate-200"></div>
                        <UserDropdown />
                    </div>
                </div>

                <div className="p-10 max-w-6xl mx-auto w-full">
                    {/* Hero Section (Soft, Airy & Animated) */}
                    <div className="mb-12 relative overflow-hidden rounded-3xl bg-white border border-indigo-50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] animate-[fade-in_0.5s_ease-out]">
                        {/* Soft background glow */}
                        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-indigo-50/50 rounded-full blur-3xl pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-purple-50/50 rounded-full blur-3xl pointer-events-none"></div>
                        
                        <div className="p-12 relative z-10">
                            <h1 className="text-[28px] font-extrabold mb-3 tracking-tight text-slate-800">
                                Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">QualiSIS</span>
                            </h1>
                            <p className="text-slate-500 font-medium text-[15px] mb-8 leading-relaxed max-w-2xl">
                                Your traceable AI workstation for human-led qualitative research. QualiSIS empowers you to collaborate with AI—accelerating the coding process, mapping themes, and drafting reports—while you retain full analytical control and traceability back to source quotes.
                            </p>
                            
                            {/* Workflow Steps - Soft Cards */}
                            <div className="grid grid-cols-4 gap-5 text-left">
                                {[
                                    { step: 1, title: 'Create Project', desc: 'Setup workspace & data' },
                                    { step: 2, title: 'Human-AI Coding', desc: 'Review AI suggestions' },
                                    { step: 3, title: 'Map Themes', desc: 'Synthesize codebook' },
                                    { step: 4, title: 'Draft Report', desc: 'Evidence-backed narrative' },
                                ].map((s, i) => (
                                    <div 
                                        key={i} 
                                        className="bg-slate-50 border border-slate-100 rounded-2xl p-4 transition-all hover:shadow-md hover:border-indigo-100 group relative overflow-hidden"
                                        style={{ animation: `fade-in-up 0.5s ease-out ${(i + 1) * 0.1}s both` }}
                                    >
                                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 to-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        <div className="text-indigo-400 font-black text-[10px] mb-1.5 uppercase tracking-widest">Step {s.step}</div>
                                        <div className="text-slate-800 font-extrabold text-[13px] leading-tight mb-1">{s.title}</div>
                                        <div className="text-slate-400 text-[11px] font-medium leading-tight">{s.desc}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Your Projects</h2>
                    </div>

                    {/* Projects Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="relative animate-[fade-in-up_0.5s_ease-out_0.5s_both]">
                            <CreateProjectCardTrigger />
                        </div>

                        {projects.map((p, index) => {
                            const totalTranscripts = p.datasets.reduce((sum, ds) => sum + ds._count.transcripts, 0)
                            return (
                                <div 
                                    key={p.id}
                                    className="bg-white border text-left border-slate-200 rounded-2xl p-6 hover:shadow-lg hover:border-indigo-300 transition-all group relative overflow-hidden h-64 flex flex-col"
                                    style={{ animation: `fade-in-up 0.5s ease-out ${0.5 + (index * 0.1)}s both` }}
                                >
                                    <Link href={`/projects/${p.id}`} className="absolute inset-0 z-0" aria-label={`View ${p.name}`} />
                                    <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity z-0" />
                                    
                                    <DeleteProjectButton projectId={p.id} projectName={p.name} />
                                    
                                    <h3 className="relative z-10 font-bold text-slate-800 text-lg mb-2 pr-8 pointer-events-none group-hover:text-indigo-700 transition-colors">{p.name}</h3>
                                    <p className="relative z-10 text-slate-500 text-sm line-clamp-3 mb-auto h-16 pointer-events-none">
                                        {p.description || "No description provided."}
                                    </p>
                                    
                                    <div className="relative z-10 flex items-center justify-between text-sm text-slate-500 border-t border-slate-100 pt-4 mt-auto w-full pointer-events-none">
                                        <div className="flex gap-4">
                                            <span className="flex items-center gap-1.5 font-medium" title="Datasets">
                                                <FolderOpen className="w-4 h-4 text-slate-400" /> {p.datasets.length}
                                            </span>
                                            <span className="flex items-center gap-1.5 font-medium" title="Transcripts">
                                                <FileText className="w-4 h-4 text-slate-400" /> {totalTranscripts}
                                            </span>
                                        </div>
                                        <span className="text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded">
                                            {p.updatedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <style dangerouslySetInnerHTML={{__html: `
                    @keyframes fade-in {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    @keyframes fade-in-up {
                        from { opacity: 0; transform: translateY(15px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `}} />
            </main>
        </div>
    )
}

function CreateProjectCardTrigger() {
    return (
        <CreateProjectButton asCard />
    )
}
