import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    try {
        const relations = await prisma.themeRelation.findMany({
            where: {
                source: { projectId: params.projectId }
            }
        })
        return NextResponse.json(relations)
    } catch (e) {
        console.error('Failed to fetch theme relations:', e)
        return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
    }
}

export async function POST(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        const userId = session?.user ? (session.user as any).id : null

        const body = await req.json()
        const { sourceId, targetId, relationType, description } = body

        if (!sourceId || !targetId || !relationType) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
        }

        const relation = await prisma.themeRelation.create({
            data: {
                sourceId,
                targetId,
                relationType,
                description: description || null
            }
        })

        await prisma.auditLog.create({
            data: {
                projectId: params.projectId,
                userId,
                eventType: 'THEME_RELATION_CREATED',
                entityType: 'ThemeRelation',
                entityId: relation.id,
                newValue: JSON.stringify(relation),
            }
        })

        return NextResponse.json(relation, { status: 201 })
    } catch (e) {
        console.error('Failed to create theme relation:', e)
        return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
    }
}
