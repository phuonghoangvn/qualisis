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
                    memo: 'Merged from multiple themes'
                }
            })
            newThemeId = newTheme.id

            // 2. Find all code entries linked to the sub-themes
            const existingLinks = await tx.themeCode.findMany({
                where: { themeId: { in: uniqueMergedIds } }
            })

            // 3. Deduplicate codes so they are only added once
            const uniqueCodeIds = Array.from(new Set(existingLinks.map(l => l.codebookEntryId)))

            // 4. Link these codes to the new theme
            for (const codeId of uniqueCodeIds) {
                await tx.themeCode.create({
                    data: {
                        themeId: newThemeId,
                        codebookEntryId: codeId
                    }
                })
            }

            // 5. Delete the old themes entirely
            await tx.theme.deleteMany({
                where: { id: { in: uniqueMergedIds } }
            })
        })

        return NextResponse.json({ success: true, newThemeId })
    } catch (e) {
        console.error('Theme merge error:', e)
        return NextResponse.json({ error: 'Failed to merge themes' }, { status: 500 })
    }
}
