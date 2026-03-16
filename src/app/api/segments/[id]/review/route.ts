import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/segments/[id]/review
// body: { action: "ACCEPT" | "OVERRIDE" | "REJECT", note?: string, customLabel?: string, suggestionId: string }
export async function POST(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const body = await req.json()
        const { action, note, customLabel, suggestionId } = body

        if (!suggestionId || !action) {
            return NextResponse.json({ error: 'suggestionId and action are required' }, { status: 400 })
        }

        // Verify suggestion exists
        const suggestion = await prisma.aISuggestion.findUnique({
            where: { id: suggestionId },
            include: { segment: true }
        })
        if (!suggestion) {
            return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })
        }

        // Create or update ReviewDecision
        const decision = await prisma.reviewDecision.upsert({
            where: { aiSuggestionId: suggestionId },
            update: { action, note: note ?? null },
            create: {
                aiSuggestionId: suggestionId,
                action,
                note: note ?? null,
                reviewerId: 'researcher-1', // No auth mode: use default
            }
        })

        // Update suggestion status
        const newStatus =
            action === 'ACCEPT' ? 'APPROVED' :
            action === 'REJECT' ? 'REJECTED' :
            action === 'OVERRIDE' ? 'MODIFIED' : 'UNDER_REVIEW'

        await prisma.aISuggestion.update({
            where: { id: suggestionId },
            data: { status: newStatus }
        })

        // If ACCEPT or OVERRIDE: create/update CodeAssignment
        if (action === 'ACCEPT' || action === 'OVERRIDE') {
            const finalLabel = action === 'OVERRIDE' && customLabel ? customLabel : suggestion.label

            // Find or create codebook entry
            let codebookEntry = await prisma.codebookEntry.findFirst({
                where: {
                    name: { equals: finalLabel, mode: 'insensitive' },
                    projectId: { not: undefined }
                }
            })

            // Get projectId via segment → transcript → dataset → project chain
            const transcriptData = await prisma.transcript.findUnique({
                where: { id: suggestion.segment.transcriptId },
                include: { dataset: true }
            })
            const projectId = transcriptData?.dataset.projectId

            if (!codebookEntry && projectId) {
                codebookEntry = await prisma.codebookEntry.create({
                    data: {
                        projectId,
                        name: finalLabel,
                        definition: suggestion.explanation,
                        type: 'RAW',
                        examplesIn: `"${suggestion.segment.text.substring(0, 100)}"`,
                        examplesOut: '',
                    }
                })
            }

            if (codebookEntry) {
                await prisma.codeAssignment.upsert({
                    where: { aiSuggestionId: suggestionId },
                    update: {
                        codebookEntryId: codebookEntry.id,
                        confidence: suggestion.confidence,
                    },
                    create: {
                        segmentId: params.id,
                        codebookEntryId: codebookEntry.id,
                        aiSuggestionId: suggestionId,
                        confidence: suggestion.confidence,
                    }
                })
            }
        }

        // Audit log
        await prisma.auditLog.create({
            data: {
                eventType: 'REVIEW_DECISION_MADE',
                entityType: 'AISuggestion',
                entityId: suggestionId,
                oldValue: suggestion.status,
                newValue: newStatus,
                note: note ?? null,
            }
        })

        return NextResponse.json({ success: true, decision, newStatus })
    } catch (e) {
        console.error('Review error:', e)
        return NextResponse.json({ error: 'Failed to save review', details: String(e) }, { status: 500 })
    }
}
