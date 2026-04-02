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

// DELETE /api/transcripts/[id]
export async function DELETE(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const transcriptId = params.id

        // Get transcript to know which dataset it belongs to
        const transcript = await prisma.transcript.findUnique({
            where: { id: transcriptId },
            select: { datasetId: true }
        })
        if (!transcript) {
            return NextResponse.json({ error: 'Transcript not found' }, { status: 404 })
        }
        const { datasetId } = transcript

        // Get all segment IDs for this transcript
        const segments = await prisma.segment.findMany({
            where: { transcriptId },
            select: { id: true }
        })
        const segmentIds = segments.map(s => s.id)

        if (segmentIds.length > 0) {
            // Get all suggestion IDs for these segments
            const suggestions = await prisma.aISuggestion.findMany({
                where: { segmentId: { in: segmentIds } },
                select: { id: true }
            })
            const suggestionIds = suggestions.map(s => s.id)

            if (suggestionIds.length > 0) {
                await prisma.reviewDecision.deleteMany({ where: { aiSuggestionId: { in: suggestionIds } } })
                await prisma.codeAssignment.deleteMany({ where: { aiSuggestionId: { in: suggestionIds } } })
                await prisma.aISuggestionEvidence.deleteMany({ where: { aiSuggestionId: { in: suggestionIds } } })
                await prisma.aISuggestion.deleteMany({ where: { id: { in: suggestionIds } } })
            }

            // Delete remaining code assignments (human-coded)
            await prisma.codeAssignment.deleteMany({ where: { segmentId: { in: segmentIds } } })
            await prisma.segment.deleteMany({ where: { transcriptId } })
        }

        // Delete the transcript itself
        await prisma.transcript.delete({ where: { id: transcriptId } })

        // Auto-delete the parent dataset if it now has no remaining transcripts
        const remainingCount = await prisma.transcript.count({ where: { datasetId } })
        if (remainingCount === 0) {
            await prisma.dataset.delete({ where: { id: datasetId } })
        }

        return NextResponse.json({ success: true })
    } catch (e) {
        console.error('Delete transcript error:', e)
        return NextResponse.json(
            { error: 'Failed to delete transcript', details: String(e) },
            { status: 500 }
        )
    }
}
