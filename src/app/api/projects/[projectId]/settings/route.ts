import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PATCH /api/projects/[projectId]/settings — update aiSettings
export async function PATCH(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    try {
        const { aiSettings } = await req.json()
        const project = await (prisma.project as any).update({
            where: { id: params.projectId },
            data: { aiSettings }
        })
        return NextResponse.json({ success: true, aiSettings: project.aiSettings })
    } catch (e) {
        console.error('Update settings error:', e)
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
    }
}

// GET /api/projects/[projectId]/settings — read current settings
export async function GET(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    try {
        const project = await (prisma.project as any).findUnique({
            where: { id: params.projectId },
            select: { aiSettings: true }
        })
        return NextResponse.json({ aiSettings: project?.aiSettings || {} })
    } catch (e) {
        return NextResponse.json({ error: 'Failed to get settings' }, { status: 500 })
    }
}
