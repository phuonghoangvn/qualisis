import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/codebook/[codeId]/merge — merge this code into another
export async function POST(
    req: Request,
    { params }: { params: { codeId: string } }
) {
    try {
        const { targetId } = await req.json()
        
        if (!targetId) {
            return NextResponse.json({ error: 'Missing targetId' }, { status: 400 })
        }

        // Move all code assignments from source to target
        await prisma.codeAssignment.updateMany({
            where: { codebookEntryId: params.codeId },
            data: { codebookEntryId: targetId }
        })

        // Move theme links (delete duplicates first)
        const existingLinks = await prisma.themeCodeLink.findMany({
            where: { codebookEntryId: targetId },
            select: { themeId: true }
        })
        const existingThemeIds = new Set(existingLinks.map(l => l.themeId))

        // Update non-duplicate links
        const sourceLinks = await prisma.themeCodeLink.findMany({
            where: { codebookEntryId: params.codeId }
        })
        for (const link of sourceLinks) {
            if (!existingThemeIds.has(link.themeId)) {
                await prisma.themeCodeLink.update({
                    where: { id: link.id },
                    data: { codebookEntryId: targetId }
                })
            } else {
                await prisma.themeCodeLink.delete({ where: { id: link.id } })
            }
        }

        // Set mapping reference
        await prisma.codebookEntry.update({
            where: { id: params.codeId },
            data: { mappedToId: targetId }
        })

        // Delete the source code
        await prisma.codeAssignment.deleteMany({ where: { codebookEntryId: params.codeId } })
        await prisma.themeCodeLink.deleteMany({ where: { codebookEntryId: params.codeId } })
        await prisma.codebookEntry.delete({ where: { id: params.codeId } })

        return NextResponse.json({ success: true, mergedInto: targetId })
    } catch (e) {
        console.error('Merge codebook entry error:', e)
        return NextResponse.json({ error: 'Failed to merge code' }, { status: 500 })
    }
}
