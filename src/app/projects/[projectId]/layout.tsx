import { prisma } from '@/lib/prisma'
import Sidebar from '@/components/Sidebar'

export default async function ProjectLayout({
    children,
    params,
}: {
    children: React.ReactNode
    params: { projectId: string }
}) {
    const project = await prisma.project.findUnique({
        where: { id: params.projectId },
        include: {
            datasets: {
                include: {
                    transcripts: {
                        select: { id: true, title: true, status: true },
                        orderBy: { createdAt: 'asc' }
                    }
                }
            }
        }
    })

    if (!project) return <div className="p-8">Project not found</div>

    return (
        <div className="flex h-screen overflow-hidden bg-slate-100">
            <Sidebar project={project} />
            <main className="flex-1 overflow-hidden">
                {children}
            </main>
        </div>
    )
}
