import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function DELETE(
    req: Request,
    { params }: { params: { projectId: string, relationId: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        const userId = session?.user ? (session.user as any).id : null

        await prisma.themeRelation.delete({
            where: { id: params.relationId }
        })

        await prisma.auditLog.create({
            data: {
                projectId: params.projectId,
                userId,
                eventType: 'THEME_RELATION_DELETED',
                entityType: 'ThemeRelation',
                entityId: params.relationId,
                note: `Relation deleted`
            }
        })

        return NextResponse.json({ success: true })
    } catch (e) {
        console.error('Failed to delete theme relation:', e)
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
    }
}
