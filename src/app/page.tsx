import Link from 'next/link'
import { ArrowRight, Network } from 'lucide-react'

export default function LandingPage() {
    return (
        <div className="flex flex-col h-screen w-full bg-gradient-to-br from-slate-50 relative via-white to-indigo-50/40 overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMTk5LCAyMTAsIDI1NCwgMC4yKSIvPjwvc3ZnPg==')] opacity-50 pointer-events-none"></div>
            <div className="flex-1 flex flex-col items-center justify-center p-12 max-w-4xl mx-auto w-full text-center relative z-10">
                <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mb-8 mx-auto shadow-xl shadow-indigo-100/50 border border-indigo-50">
                    <Network className="w-12 h-12 text-indigo-600" />
                </div>
                <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 mb-6 tracking-tight">
                    Traceable AI <span className="text-indigo-600">Qualitative Analysis</span>
                </h1>
                <p className="text-lg md:text-xl text-slate-500 mb-12 leading-relaxed max-w-2xl mx-auto font-medium">
                    A structured academic workstation designed to bring rigorous, transparent, and reproducible AI assistance to your qualitative research workflows.
                </p>
                <Link href="/projects" className="flex items-center gap-3 px-8 py-4 text-base font-semibold text-white bg-indigo-600 rounded-full hover:bg-indigo-700 transition-all hover:-translate-y-1 shadow-[0_8px_20px_-6px_rgba(79,70,229,0.5)] mx-auto">
                    Start Your Analysis Workspace <ArrowRight className="w-5 h-5" />
                </Link>
            </div>
        </div>
    )
}
