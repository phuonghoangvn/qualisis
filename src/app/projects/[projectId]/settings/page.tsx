import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import SettingsClient from './SettingsClient'

export default async function SettingsPage({ params }: { params: { projectId: string } }) {
    const project = await prisma.project.findUnique({
        where: { id: params.projectId },
    })

    if (!project) notFound()

    // Fetch logs (last 100 for simplicity)
    const logs = await prisma.auditLog.findMany({
        where: { projectId: params.projectId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { user: { select: { name: true, email: true } } }
    })

    // Parse aiSettings safely
    let aiSettings = {}
    try {
        if (project.aiSettings) {
             aiSettings = typeof project.aiSettings === 'string' ? JSON.parse(project.aiSettings) : project.aiSettings
        }
    } catch(e) {}

    return (
        <div className="flex bg-slate-50 min-h-[calc(100vh-60px)] w-full">
            <div className="flex-1 overflow-y-auto px-8 py-10 flex justify-center">
                <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-3xl shadow-sm p-8">
                    <div className="mb-8">
                        <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-3">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                            Platform Settings
                        </h1>
                        <p className="text-sm font-medium text-slate-500 mt-2 tracking-wide">
                            Configure project intelligence and monitor system activity logs.
                        </p>
                    </div>

                    <SettingsClient 
                        projectId={params.projectId} 
                        initialSettings={aiSettings} 
                        logs={logs as any[]} 
                    />
                </div>
            </div>
        </div>
    )
}
