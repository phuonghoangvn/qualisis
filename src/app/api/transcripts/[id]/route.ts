import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/transcripts/[id]
export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const transcript = await prisma.transcript.findUnique({
            where: { id: params.id },
            include: {
                segments: {
                    include: {
                        suggestions: {
                            include: {
                                evidenceSpans: true,
                                reviewDecision: true,
                            }
                        },
                        codeAssignments: {
                            include: { codebookEntry: true }
                        }
                    },
                    orderBy: { order: 'asc' }
                }
            }
        })

        if (!transcript) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        // Compute stats
        const totalHighlights = transcript.segments.reduce(
            (acc, s) => acc + s.suggestions.length, 0
        )
        const assignedCodes = transcript.segments.reduce(
            (acc, s) => acc + s.codeAssignments.length, 0
        )
        const pendingReview = transcript.segments.reduce(
            (acc, s) => acc + s.suggestions.filter(sg =>
                sg.status === 'SUGGESTED' || sg.status === 'UNDER_REVIEW'
            ).length, 0
        )

        return NextResponse.json({
            ...transcript,
            stats: { totalHighlights, assignedCodes, pendingReview }
        })
    } catch (e) {
        console.error(e)
        return NextResponse.json({ error: 'Failed to fetch transcript' }, { status: 500 })
    }
}

// PATCH /api/transcripts/[id] — update status, title etc
export async function PATCH(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const body = await req.json()
        const transcript = await prisma.transcript.update({
            where: { id: params.id },
            data: body,
        })
        return NextResponse.json(transcript)
    } catch (e) {
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    }
}
