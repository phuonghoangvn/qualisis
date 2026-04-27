import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    try {
        const body = await req.json()
        const { name, description, mergedThemeIds } = body

        if (!name || !mergedThemeIds || mergedThemeIds.length === 0) {
            return NextResponse.json({ error: 'Missing requirements' }, { status: 400 })
        }

        // Deduplicate IDs
        const uniqueMergedIds: string[] = Array.from(new Set<string>(mergedThemeIds))
        if (uniqueMergedIds.length < 2) {
            return NextResponse.json({ error: 'Need at least 2 distinct themes to merge' }, { status: 400 })
        }

        let newThemeId: string = ''
        await prisma.$transaction(async (tx) => {
            // 1. Create the new combined theme
            const newTheme = await tx.theme.create({
                data: {
                    name,
                    description,
                    projectId: params.projectId,
                    status: 'DRAFT',
                    memo: `Merged from multiple themes:${uniqueMergedIds.join(',')}`
                }
            })
            newThemeId = newTheme.id

            // 2. Find all code entries linked to the sub-themes
            const existingLinks = await tx.themeCodeLink.findMany({
                where: { themeId: { in: uniqueMergedIds } }
            })

            // 3. Deduplicate codes so they are only added once
            const uniqueCodeIds = Array.from(new Set(existingLinks.map(l => l.codebookEntryId)))

            // 4. Link these codes to the new theme
            for (const codeId of uniqueCodeIds) {
                await tx.themeCodeLink.create({
                    data: {
                        themeId: newThemeId,
                        codebookEntryId: codeId
                    }
                })
            }

            // 5. Soft-delete the old themes by setting their status to MERGED
            // This allows us to undo the merge later
            await tx.theme.updateMany({
                where: { id: { in: uniqueMergedIds } },
                data: { status: 'MERGED' }
            })
        })

        return NextResponse.json({ success: true, newThemeId })
    } catch (e) {
        console.error('Theme merge error:', e)
        return NextResponse.json({ error: 'Failed to merge themes' }, { status: 500 })
    }
}
