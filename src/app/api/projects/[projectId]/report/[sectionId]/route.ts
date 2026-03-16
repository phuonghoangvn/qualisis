import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PATCH /api/projects/[projectId]/report/[sectionId] — update section content
export async function PATCH(
    req: Request,
    { params }: { params: { projectId: string; sectionId: string } }
) {
    try {
        const body = await req.json()
        const { title, content, sortOrder } = body

        const section = await prisma.reportSection.update({
            where: { id: params.sectionId, projectId: params.projectId },
            data: {
                ...(title !== undefined && { title }),
                ...(content !== undefined && { content }),
            }
        })

        return NextResponse.json(section)
    } catch (e) {
        console.error('Failed to update report section:', e)
        return NextResponse.json({ error: 'Failed to update section' }, { status: 500 })
    }
}

// DELETE /api/projects/[projectId]/report/[sectionId] — delete section
export async function DELETE(
    req: Request,
    { params }: { params: { projectId: string; sectionId: string } }
) {
    try {
        await prisma.reportSection.delete({
            where: { id: params.sectionId, projectId: params.projectId }
        })

        await prisma.auditLog.create({
            data: {
                projectId: params.projectId,
                eventType: 'REPORT_SECTION_DELETED',
                entityType: 'ReportSection',
                entityId: params.sectionId,
                newValue: JSON.stringify({ sectionId: params.sectionId }),
            }
        })

        return NextResponse.json({ success: true })
    } catch (e) {
        console.error('Failed to delete report section:', e)
        return NextResponse.json({ error: 'Failed to delete section' }, { status: 500 })
    }
}
