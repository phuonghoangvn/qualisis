import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import TranscriptWorkspace from '@/components/TranscriptWorkspace'

export const dynamic = 'force-dynamic'

export default async function TranscriptPage({
    params,
}: {
    params: { projectId: string; transcriptId: string }
}) {
    const transcript = await prisma.transcript.findUnique({
        where: { id: params.transcriptId },
        include: {
            segments: {
                include: {
                    suggestions: {
                        include: { evidenceSpans: true, reviewDecision: true },
                        orderBy: { createdAt: 'asc' }
                    },
                    codeAssignments: { include: { codebookEntry: true } }
                },
                orderBy: { order: 'asc' }
            },
            dataset: true,
        }
    })

    if (!transcript) notFound()

    const totalHighlights = transcript.segments.reduce(
        (a, s) => a + s.suggestions.length, 0
    )
    const assignedCodes = transcript.segments.reduce(
        (a, s) => a + s.codeAssignments.length, 0
    )
    const pendingReview = transcript.segments.reduce(
        (a, s) => a + s.suggestions.filter(sg =>
            sg.status === 'SUGGESTED' || sg.status === 'UNDER_REVIEW'
        ).length, 0
    )

    return (
        <TranscriptWorkspace
            transcript={transcript as any}
            projectId={params.projectId}
            stats={{ totalHighlights, assignedCodes, pendingReview }}
        />
    )
}
