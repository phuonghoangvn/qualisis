import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    try {
        const edges = await prisma.knowledgeEdge.findMany({
            where: { projectId: params.projectId },
            orderBy: { createdAt: 'asc' }
        })
        return NextResponse.json(edges)
    } catch (e) {
        console.error('Failed to fetch knowledge edges:', e)
        return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
    }
}

export async function POST(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    try {
        const body = await req.json()
        const { sourceNodeId, targetNodeId, relationType, description } = body

        if (!sourceNodeId || !targetNodeId || !relationType) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
        }

        // Prevent duplicate edges
        const existing = await prisma.knowledgeEdge.findFirst({
            where: { projectId: params.projectId, sourceNodeId, targetNodeId }
        })
        if (existing) {
            return NextResponse.json({ error: 'Edge already exists' }, { status: 409 })
        }

        const edge = await prisma.knowledgeEdge.create({
            data: {
                projectId: params.projectId,
                sourceNodeId,
                targetNodeId,
                relationType,
                description: description || null
            }
        })
        return NextResponse.json(edge, { status: 201 })
    } catch (e) {
        console.error('Failed to create knowledge edge:', e)
        return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    try {
        const body = await req.json()
        const { edgeId, relationType, description } = body
        if (!edgeId) return NextResponse.json({ error: 'Missing edgeId' }, { status: 400 })

        const updated = await prisma.knowledgeEdge.update({
            where: { id: edgeId },
            data: {
                ...(relationType ? { relationType } : {}),
                ...(description !== undefined ? { description } : {}),
            }
        })
        return NextResponse.json(updated)
    } catch (e) {
        console.error('Failed to update knowledge edge:', e)
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    try {
        const { searchParams } = new URL(req.url)
        const edgeId = searchParams.get('edgeId')
        if (!edgeId) return NextResponse.json({ error: 'Missing edgeId' }, { status: 400 })

        await prisma.knowledgeEdge.delete({ where: { id: edgeId } })
        return NextResponse.json({ success: true })
    } catch (e) {
        console.error('Failed to delete knowledge edge:', e)
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
    }
}
