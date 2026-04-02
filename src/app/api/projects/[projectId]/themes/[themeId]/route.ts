import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// DELETE /api/projects/[projectId]/themes/[themeId]
export async function DELETE(
    req: Request,
    { params }: { params: { projectId: string; themeId: string } }
) {
    try {
        const { projectId, themeId } = params

        // Delete code links first (cascade might handle it, but be explicit)
        await prisma.themeCodeLink.deleteMany({
            where: { themeId }
        })

        await prisma.theme.delete({
            where: { id: themeId, projectId }
        })

        await prisma.auditLog.create({
            data: {
                projectId,
                eventType: 'THEME_DELETED',
                entityType: 'Theme',
                entityId: themeId,
                newValue: JSON.stringify({ themeId }),
            }
        })

        return NextResponse.json({ success: true })
    } catch (e) {
        console.error('Failed to delete theme:', e)
        return NextResponse.json({ error: 'Failed to delete theme' }, { status: 500 })
    }
}

// PATCH /api/projects/[projectId]/themes/[themeId] — rename or update a theme
export async function PATCH(
    req: Request,
    { params }: { params: { projectId: string; themeId: string } }
) {
    try {
        const { themeId, projectId } = params
        const body = await req.json()
        const { name, description, memo, status, positionX, positionY } = body

        const theme = await prisma.theme.update({
            where: { id: themeId, projectId },
            data: {
                ...(name !== undefined && { name }),
                ...(description !== undefined && { description }),
                ...(memo !== undefined && { memo }),
                ...(status !== undefined && { status }),
                ...(positionX !== undefined && { positionX }),
                ...(positionY !== undefined && { positionY }),
            }
        })

        return NextResponse.json(theme)
    } catch (e: any) {
        console.error('Failed to update theme:', e)
        return NextResponse.json({ 
            error: 'Failed to update theme', 
            details: e.message,
            code: e.code 
        }, { status: 500 })
    }
}
