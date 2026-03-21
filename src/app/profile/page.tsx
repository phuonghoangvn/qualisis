import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Network, Home, Settings, User } from 'lucide-react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import GlobalSignOutButton from '@/components/GlobalSignOutButton'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
        redirect('/login')
    }

    const user = await prisma.user.findUnique({
        where: { id: (session.user as any).id },
        include: {
            _count: { select: { auditLogs: true } }
        }
    })

    if (!user) {
        redirect('/login')
    }

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
                        <Link href="/projects" className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg text-slate-600 hover:bg-white hover:text-indigo-700 transition-all border border-transparent hover:border-slate-200">
                            <Home className="w-4 h-4" /> Home / Projects
                        </Link>
                    </nav>
                </div>

                <div className="mt-auto p-4 border-t border-slate-200/60 flex flex-col gap-2 flex-shrink-0">
                    <div className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-indigo-700 bg-indigo-50 transition-all rounded-lg border border-indigo-100">
                        <Settings className="w-4 h-4" /> Profile & Settings
                    </div>
                    <GlobalSignOutButton />
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col h-full bg-slate-50/50 overflow-y-auto relative">
                <div className="h-16 border-b border-slate-200/60 bg-white/80 backdrop-blur-md flex items-center px-8 flex-shrink-0 sticky top-0 z-10 w-full">
                    <h2 className="text-lg font-bold text-slate-800 tracking-tight">Profile & Global Settings</h2>
                </div>

                <div className="p-10 max-w-4xl mx-auto w-full">
                    <div className="mb-10">
                        <h1 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">Your Profile</h1>
                        <p className="text-slate-500 font-medium">Manage your personal researcher details.</p>
                    </div>

                    <div className="bg-white border text-left border-slate-200 rounded-2xl p-8 shadow-sm">
                        <div className="flex items-start gap-6">
                            <div className="w-24 h-24 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
                                <User className="w-10 h-10" />
                            </div>
                            <div className="flex-1 space-y-4 pt-2">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Full Name</h3>
                                    <p className="text-xl font-bold text-slate-900">{user.name || 'Anonymous Researcher'}</p>
                                </div>
                                
                                <div>
                                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Email Address</h3>
                                    <p className="text-base font-medium text-slate-700">{user.email}</p>
                                </div>

                                <div>
                                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Role</h3>
                                    <p className="text-sm font-semibold inline-flex items-center px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-widest">{user.role}</p>
                                </div>
                                
                                <div className="pt-4 border-t border-slate-100">
                                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Total Audit Actions Logged</h3>
                                    <p className="text-sm font-medium text-slate-600">{user._count.auditLogs} trace(s) stored under your ID.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
