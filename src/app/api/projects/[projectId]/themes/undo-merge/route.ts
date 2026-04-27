import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    try {
        const body = await req.json()
        const { themeId } = body

        if (!themeId) {
            return NextResponse.json({ error: 'Missing themeId' }, { status: 400 })
        }

        const theme = await prisma.theme.findUnique({
            where: { id: themeId }
        })

        if (!theme || !theme.memo || !theme.memo.startsWith('Merged from multiple themes:')) {
            return NextResponse.json({ error: 'Invalid or missing merge data' }, { status: 400 })
        }

        // Extract the original theme IDs
        const idsString = theme.memo.split(':')[1]
        if (!idsString) {
            return NextResponse.json({ error: 'Could not parse original theme IDs' }, { status: 400 })
        }
        
        const originalThemeIds = idsString.split(',')

        await prisma.$transaction(async (tx) => {
            // 1. Delete the newly created merged theme (cascades and deletes its ThemeCodeLinks)
            await tx.theme.delete({
                where: { id: themeId }
            })

            // 2. Restore the original themes by setting their status back to DRAFT
            await tx.theme.updateMany({
                where: { id: { in: originalThemeIds } },
                data: { status: 'DRAFT' }
            })
        })

        return NextResponse.json({ success: true })
    } catch (e) {
        console.error('Undo merge error:', e)
        return NextResponse.json({ error: 'Failed to undo merge' }, { status: 500 })
    }
}
