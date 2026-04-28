import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const body = await req.json()
        const { projectId, text, codeName, codeDescription, startIndex, endIndex } = body

        const session = await getServerSession(authOptions)
        const userId = session?.user ? (session.user as any).id : null

        // Find or create CodebookEntry
        let codeEntry = await prisma.codebookEntry.findFirst({
            where: { projectId, name: codeName }
        })

        if (!codeEntry) {
            codeEntry = await prisma.codebookEntry.create({
                data: {
                    projectId,
                    name: codeName,
                    type: 'HUMAN',
                    definition: codeDescription || '',
                    examplesIn: '',
                    examplesOut: ''
                }
            })
            // Audit Log code creation
            await prisma.auditLog.create({
                data: {
                    projectId,
                    userId,
                    eventType: 'HUMAN_CODE_CREATED',
                    entityType: 'CodebookEntry',
                    entityId: codeEntry.id,
                    newValue: JSON.stringify({ name: codeName }),
                }
            })
        }

        // Create Segment
        const segment = await prisma.segment.create({
            data: {
                transcriptId: params.id,
                text,
                startIndex: startIndex || 0,
                endIndex: endIndex || 0,
            }
        })

        // Create CodeAssignment
        await prisma.codeAssignment.create({
            data: {
                segmentId: segment.id,
                codebookEntryId: codeEntry.id,
            }
        })

        // Audit Log segment highlighted
        await prisma.auditLog.create({
            data: {
                projectId,
                userId,
                eventType: 'HUMAN_HIGHLIGHT_ADDED',
                entityType: 'Segment',
                entityId: segment.id,
                note: `Manually coded as "${codeName}"`,
                newValue: JSON.stringify({ text: text.substring(0, 100) + '...' })
            }
        })

        return NextResponse.json({ success: true, codeEntry, segment })
    } catch (e) {
        console.error('Human code creation error', e)
        return NextResponse.json({ error: 'Failed to create human code' }, { status: 500 })
    }
}
