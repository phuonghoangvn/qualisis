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

export async function PATCH(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    try {
        const body = await req.json()
        const { relationId, relationType, description } = body

        if (!relationId) {
            return NextResponse.json({ error: 'Missing relationId' }, { status: 400 })
        }

        const updated = await prisma.themeRelation.update({
            where: { id: relationId },
            data: {
                ...(relationType ? { relationType } : {}),
                ...(description !== undefined ? { description } : {}),
            }
        })

        return NextResponse.json(updated)
    } catch (e) {
        console.error('Failed to update theme relation:', e)
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    try {
        const { searchParams } = new URL(req.url)
        const relationId = searchParams.get('relationId')

        if (!relationId) {
            return NextResponse.json({ error: 'Missing relationId' }, { status: 400 })
        }

        await prisma.themeRelation.delete({ where: { id: relationId } })
        return NextResponse.json({ success: true })
    } catch (e) {
        console.error('Failed to delete theme relation:', e)
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
    }
}
