import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// DELETE /api/datasets/[datasetId]
export async function DELETE(
    req: Request,
    { params }: { params: { datasetId: string } }
) {
    try {
        const datasetId = params.datasetId

        // Get all transcripts in this dataset
        const transcripts = await prisma.transcript.findMany({
            where: { datasetId },
            select: { id: true }
        })

        for (const transcript of transcripts) {
            // Get all segments
            const segments = await prisma.segment.findMany({
                where: { transcriptId: transcript.id },
                select: { id: true }
            })
            const segmentIds = segments.map(s => s.id)

            if (segmentIds.length > 0) {
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

                await prisma.codeAssignment.deleteMany({ where: { segmentId: { in: segmentIds } } })
                await prisma.segment.deleteMany({ where: { transcriptId: transcript.id } })
            }

            await prisma.transcript.delete({ where: { id: transcript.id } })
        }

        // Delete the dataset itself
        await prisma.dataset.delete({ where: { id: datasetId } })

        return NextResponse.json({ success: true })
    } catch (e) {
        console.error('Delete dataset error:', e)
        return NextResponse.json({ error: 'Failed to delete dataset', details: String(e) }, { status: 500 })
    }
}

// PATCH /api/datasets/[datasetId]
export async function PATCH(
    req: Request,
    { params }: { params: { datasetId: string } }
) {
    try {
        const { name } = await req.json()
        const datasetId = params.datasetId

        if (!name || typeof name !== 'string') {
            return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
        }

        const updatedDataset = await prisma.dataset.update({
            where: { id: datasetId },
            data: { name: name.trim() }
        })

        return NextResponse.json(updatedDataset)
    } catch (e) {
        console.error('Update dataset error:', e)
        return NextResponse.json({ error: 'Failed to update dataset', details: String(e) }, { status: 500 })
    }
}
