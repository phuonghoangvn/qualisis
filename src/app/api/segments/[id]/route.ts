import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions)
        const userId = session?.user ? (session.user as any).id : null

        const segment = await prisma.segment.findUnique({
            where: { id: params.id },
            include: { transcript: { include: { dataset: true } } }
        })

        if (!segment) return NextResponse.json({ success: true }) // Already gone

        await prisma.segment.delete({
            where: { id: params.id },
        })

        const projectId = segment.transcript.dataset.projectId;

        // Audit log human deletion
        await prisma.auditLog.create({
            data: {
                projectId,
                userId,
                eventType: 'HUMAN_HIGHLIGHT_DELETED',
                entityType: 'Segment',
                entityId: params.id,
                newValue: JSON.stringify({ text: segment.text.substring(0, 100) + '...' })
            }
        })

        return NextResponse.json({ success: true })
    } catch (e) {
        console.error('Delete segment error', e)
        return NextResponse.json({ error: 'Failed to delete segment' }, { status: 500 })
    }
}
