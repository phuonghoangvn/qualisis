import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/codebook?projectId=xxx
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')

    try {
        const entries = await prisma.codebookEntry.findMany({
            where: projectId ? { projectId } : undefined,
            include: {
                _count: { select: { codeAssignments: true } },
                themeLinks: { include: { theme: true } },
                codeAssignments: { 
                    select: { aiSuggestionId: true },
                    take: 1
                }
            },
            orderBy: { createdAt: 'desc' }
        })
        
        // Filter out orphan codes (codes that have lost all their highlights/excerpts)
        const validEntries = entries.filter(e => e._count.codeAssignments > 0)
        
        return NextResponse.json(validEntries)
    } catch (e) {
        return NextResponse.json({ error: 'Failed to fetch codebook' }, { status: 500 })
    }
}

// POST /api/codebook
export async function POST(req: Request) {
    try {
        const body = await req.json()
        const entry = await prisma.codebookEntry.create({
            data: {
                projectId: body.projectId,
                name: body.name,
                definition: body.definition ?? '',
                type: body.type ?? 'RAW',
                examplesIn: body.examplesIn ?? '',
                examplesOut: body.examplesOut ?? '',
                memo: body.memo ?? null,
            }
        })
        return NextResponse.json(entry, { status: 201 })
    } catch (e) {
        return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 })
    }
}
