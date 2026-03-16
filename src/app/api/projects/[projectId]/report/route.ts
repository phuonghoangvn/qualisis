import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/projects/[projectId]/report — get all report sections
export async function GET(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    try {
        const sections = await prisma.reportSection.findMany({
            where: { projectId: params.projectId },
            include: {
                theme: {
                    select: { id: true, name: true, status: true }
                }
            },
            orderBy: { createdAt: 'asc' }
        })
        return NextResponse.json(sections)
    } catch (e) {
        console.error('Failed to fetch report sections:', e)
        return NextResponse.json({ error: 'Failed to fetch report sections' }, { status: 500 })
    }
}

// POST /api/projects/[projectId]/report — create a new report section
export async function POST(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    try {
        const body = await req.json()
        const { type, title, content, themeId } = body

        if (!type || !title) {
            return NextResponse.json({ error: 'Type and title are required' }, { status: 400 })
        }

        const section = await prisma.reportSection.create({
            data: {
                projectId: params.projectId,
                type,
                title,
                content: content ?? '',
                themeId: themeId ?? null,
            },
            include: {
                theme: { select: { id: true, name: true, status: true } }
            }
        })

        await prisma.auditLog.create({
            data: {
                projectId: params.projectId,
                eventType: 'REPORT_SECTION_CREATED',
                entityType: 'ReportSection',
                entityId: section.id,
                newValue: JSON.stringify({ type, title }),
            }
        })

        return NextResponse.json(section, { status: 201 })
    } catch (e) {
        console.error('Failed to create report section:', e)
        return NextResponse.json({ error: 'Failed to create report section' }, { status: 500 })
    }
}
