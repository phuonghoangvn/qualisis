import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const body = await req.json()
        const { projectId, text, codeName, startIndex, endIndex } = body

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
                    examplesIn: '',
                    examplesOut: ''
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

        return NextResponse.json({ success: true, codeEntry })
    } catch (e) {
        console.error('Human code creation error', e)
        return NextResponse.json({ error: 'Failed to create human code' }, { status: 500 })
    }
}
