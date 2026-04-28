import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { projectId: string } }) {
    try {
        // Fetch all segments with any AI suggestions or human codes across all transcripts in this project
        const segments = await prisma.segment.findMany({
            where: {
                transcript: {
                    dataset: { projectId: params.projectId }
                },
                OR: [
                    { suggestions: { some: {} } },
                    { codeAssignments: { some: { aiSuggestionId: null } } }
                ]
            },
            include: {
                transcript: {
                    select: { id: true, title: true }
                },
                suggestions: {
                    orderBy: { confidence: 'desc' }
                },
                codeAssignments: {
                    include: { codebookEntry: { select: { name: true } } }
                }
            },
            orderBy: { transcript: { title: 'asc' } }
        })

        // Shape: flatten to one row per segment
        const rows = segments.map(seg => {
            const humanAssignments = seg.codeAssignments.filter(c => !c.aiSuggestionId);
            const isHuman = seg.suggestions.length === 0 && humanAssignments.length > 0;
            
            let topSuggestion = seg.suggestions[0];
            
            if (isHuman) {
                const hCode = humanAssignments[0];
                topSuggestion = {
                    id: 'human-' + hCode.id,
                    label: hCode.codebookEntry.name,
                    confidence: null,
                    explanation: 'Human created',
                    uncertainty: null,
                    modelProvider: null,
                    status: 'HUMAN'
                } as any;
            } else {
                const approved = seg.suggestions.find(s => s.status === 'APPROVED' || s.status === 'MODIFIED');
                if (approved) topSuggestion = approved;
            }

            return {
                segmentId: seg.id,
                text: seg.text,
                transcriptId: seg.transcript.id,
                transcriptTitle: seg.transcript.title,
                suggestion: {
                    id: topSuggestion?.id || '',
                    label: topSuggestion?.label || '',
                    confidence: topSuggestion?.confidence,
                    explanation: topSuggestion?.explanation,
                    uncertainty: topSuggestion?.uncertainty,
                    modelProvider: topSuggestion?.modelProvider,
                    status: topSuggestion?.status,
                },
                isHuman,
                humanCodes: humanAssignments.map(c => c.codebookEntry.name),
                totalSuggestions: seg.suggestions.length,
            }
        })

        // Sort rows by action priority:
        // 1. HUMAN
        // 2. PENDING (SUGGESTED, UNDER_REVIEW)
        // 3. ACCEPTED (APPROVED, MODIFIED)
        // 4. REJECTED
        rows.sort((a, b) => {
            const getRank = (status: string | undefined) => {
                if (status === 'HUMAN') return 1;
                if (status === 'SUGGESTED' || status === 'UNDER_REVIEW') return 2;
                if (status === 'APPROVED' || status === 'MODIFIED') return 3;
                if (status === 'REJECTED') return 4;
                return 5;
            };
            
            const rankA = getRank(a.suggestion.status);
            const rankB = getRank(b.suggestion.status);
            
            if (rankA !== rankB) return rankA - rankB;
            // Secondary sort by transcript title if ranks are equal
            return a.transcriptTitle.localeCompare(b.transcriptTitle);
        });

        return NextResponse.json({ rows, total: rows.length })
    } catch (e) {
        console.error('compare-codes error', e)
        return NextResponse.json({ error: 'Failed to fetch comparison codes' }, { status: 500 })
    }
}
