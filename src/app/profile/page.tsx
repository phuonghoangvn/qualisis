import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Network, Home, User } from 'lucide-react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { UserDropdown } from '@/components/UserDropdown'

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
            {/* MAIN CONTENT (No Sidebar) */}
            <main className="flex-1 flex flex-col h-full bg-slate-50/50 overflow-y-auto relative w-full">
                {/* Header Navbar */}
                <div className="h-16 border-b border-slate-200/60 bg-white/80 backdrop-blur-md flex items-center justify-between px-8 flex-shrink-0 sticky top-0 z-50 w-full shadow-sm">
                    {/* Logo Area */}
                    <Link href="/projects" className="flex items-center gap-3 group hover:opacity-90 transition-opacity">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0 text-white font-bold shadow-sm">
                            <Network className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-extrabold text-slate-800 tracking-tight leading-tight group-hover:text-indigo-700 transition-colors">QualiSIS</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Traceable AI Workstation</span>
                        </div>
                    </Link>

                    {/* Actions Area */}
                    <div className="flex items-center gap-5">
                        <Link href="/projects" className="text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-2">
                            <Home className="w-4 h-4" /> Dashboard
                        </Link>
                        <div className="h-6 w-px bg-slate-200"></div>
                        <UserDropdown />
                    </div>
                </div>

                <div className="p-10 max-w-4xl mx-auto w-full">
                    <div className="mb-10 animate-[fade-in-up_0.3s_ease-out_both]">
                        <h1 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">Your Profile</h1>
                        <p className="text-slate-500 font-medium">Manage your personal researcher details.</p>
                    </div>

                    <div className="bg-white border text-left border-slate-200 rounded-2xl p-8 shadow-sm animate-[fade-in-up_0.5s_ease-out_both]">
                        <div className="flex items-start gap-6">
                            <div className="w-24 h-24 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
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

                <style dangerouslySetInnerHTML={{__html: `
                    @keyframes fade-in-up {
                        from { opacity: 0; transform: translateY(15px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `}} />
            </main>
        </div>
    )
}
