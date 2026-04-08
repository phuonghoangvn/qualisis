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
                    select: { 
                        aiSuggestionId: true,
                        segment: { 
                            select: { 
                                transcript: {
                                    select: { id: true, title: true }
                                }
                            } 
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        })
        
        // Filter out orphan codes (0 assignments), EXCEPT OBSERVATION type codes
        // which intentionally have no transcript segments
        const validEntries = entries
            .filter(e => e.type === 'OBSERVATION' || e._count.codeAssignments > 0)
            .map(e => {
                const participantsMap = new Map<string, {id: string, name: string}>()
                let hasAISuggestion = false
                
                for (const ca of e.codeAssignments) {
                    if (ca.aiSuggestionId) hasAISuggestion = true
                    const tr = ca.segment?.transcript
                    if (tr && !participantsMap.has(tr.id)) {
                        participantsMap.set(tr.id, { id: tr.id, name: tr.title })
                    }
                }
                
                // If it's an OBSERVATION, keep it. Otherwise compute AI-ASSISTED or MANUAL
                const computedType = e.type === 'OBSERVATION' ? 'OBSERVATION' : (hasAISuggestion ? 'AI-ASSISTED' : 'MANUAL')

                // Remove codeAssignments to save bandwidth
                const { codeAssignments, type, ...rest } = e as any
                
                return {
                    ...rest,
                    type: computedType,
                    participants: Array.from(participantsMap.values())
                }
            })
        
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
