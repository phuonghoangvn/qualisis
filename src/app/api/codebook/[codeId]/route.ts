import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// DELETE /api/codebook/[codeId] — delete a codebook entry
export async function DELETE(
    req: Request,
    { params }: { params: { codeId: string } }
) {
    try {
        // Delete code assignments first
        await prisma.codeAssignment.deleteMany({ where: { codebookEntryId: params.codeId } })
        // Delete theme links
        await prisma.themeCodeLink.deleteMany({ where: { codebookEntryId: params.codeId } })
        // Clear self-references
        await prisma.codebookEntry.updateMany({
            where: { mappedToId: params.codeId },
            data: { mappedToId: null }
        })
        // Delete the entry
        await prisma.codebookEntry.delete({ where: { id: params.codeId } })
        return NextResponse.json({ success: true })
    } catch (e) {
        console.error('Delete codebook entry error:', e)
        return NextResponse.json({ error: 'Failed to delete code' }, { status: 500 })
    }
}
