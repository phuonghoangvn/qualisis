import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/codebook/[codeId]/sentiment — Extract sentiment from AI suggestion data
export async function GET(
    req: Request,
    { params }: { params: { codeId: string } }
) {
    try {
        // Find code assignments for this codebook entry
        const assignments = await prisma.codeAssignment.findMany({
            where: { codebookEntryId: params.codeId },
            include: {
                aiSuggestion: {
                    select: { uncertainty: true, label: true }
                }
            },
            take: 10
        })

        // Try to extract sentiment from AI suggestion uncertainty JSON
        for (const assignment of assignments) {
            if (assignment.aiSuggestion?.uncertainty) {
                try {
                    const parsed = JSON.parse(assignment.aiSuggestion.uncertainty)
                    if (parsed.sentiment) {
                        return NextResponse.json({ sentiment: parsed.sentiment })
                    }
                } catch { /* not valid JSON */ }
            }
        }

        // No sentiment found
        return NextResponse.json({ sentiment: null })
    } catch (e) {
        console.error('Fetch sentiment error:', e)
        return NextResponse.json({ sentiment: null })
    }
}
