import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { projectId: string } }) {
    try {
        // Fetch all segments with pending AI suggestions across all transcripts in this project
        const segments = await prisma.segment.findMany({
            where: {
                transcript: {
                    dataset: { projectId: params.projectId }
                },
                suggestions: {
                    some: {
                        status: { in: ['SUGGESTED', 'UNDER_REVIEW'] }
                    }
                }
            },
            include: {
                transcript: {
                    select: { id: true, title: true }
                },
                suggestions: {
                    where: { status: { in: ['SUGGESTED', 'UNDER_REVIEW'] } },
                    orderBy: { confidence: 'desc' }
                },
                codeAssignments: {
                    include: { codebookEntry: { select: { name: true } } }
                }
            },
            orderBy: { transcript: { title: 'asc' } }
        })

        // Shape: flatten to one row per segment (highest-confidence suggestion as representative)
        const rows = segments.map(seg => {
            const topSuggestion = seg.suggestions[0]
            const humanCodes = seg.codeAssignments.filter(c => !c.aiSuggestionId)
            return {
                segmentId: seg.id,
                text: seg.text,
                transcriptId: seg.transcript.id,
                transcriptTitle: seg.transcript.title,
                suggestion: {
                    id: topSuggestion.id,
                    label: topSuggestion.label,
                    confidence: topSuggestion.confidence,
                    explanation: topSuggestion.explanation,
                    uncertainty: topSuggestion.uncertainty,
                    modelProvider: topSuggestion.modelProvider,
                    status: topSuggestion.status,
                },
                humanCodes: humanCodes.map(c => c.codebookEntry.name),
                totalSuggestions: seg.suggestions.length,
            }
        })

        return NextResponse.json({ rows, total: rows.length })
    } catch (e) {
        console.error('pending-codes error', e)
        return NextResponse.json({ error: 'Failed to fetch pending codes' }, { status: 500 })
    }
}
