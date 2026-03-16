import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
    req: Request,
    { params }: { params: { codeId: string } }
) {
    try {
        const assignments = await prisma.codeAssignment.findMany({
            where: { codebookEntryId: params.codeId },
            include: {
                segment: {
                    select: {
                        id: true,
                        text: true,
                        transcript: {
                            select: { 
                                id: true, 
                                title: true,
                                dataset: {
                                    select: { projectId: true }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        })
        
        // Group by transcript for clean UI
        const quotesByTranscript = assignments.reduce((acc: any, assignment: any) => {
            const tr = assignment.segment.transcript
            if (!acc[tr.id]) {
                acc[tr.id] = { transcriptId: tr.id, transcriptName: tr.title, projectId: tr.dataset.projectId, quotes: [] }
            }
            acc[tr.id].quotes.push({
                segmentId: assignment.segment.id,
                text: assignment.segment.text,
                confidence: assignment.confidence
            })
            return acc
        }, {})

        return NextResponse.json(Object.values(quotesByTranscript))
    } catch (e) {
        console.error('Fetch quotes fail', e)
        return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 })
    }
}
