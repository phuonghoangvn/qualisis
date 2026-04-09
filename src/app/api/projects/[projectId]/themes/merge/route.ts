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

        // Run this in a transaction
        let newThemeId: string = ''
        await prisma.$transaction(async (tx) => {
            // 1. Create the new overarching theme
            const newTheme = await tx.theme.create({
                data: {
                    name,
                    description,
                    projectId: params.projectId,
                    status: 'DRAFT',
                    memo: 'Synthesized from multiple smaller themes.'
                }
            });
            newThemeId = newTheme.id

            // 2. Find all codeLinks from the merged themes
            const links = await tx.themeCodeLink.findMany({
                where: { themeId: { in: mergedThemeIds } }
            });

            const uniqueCodeIds = Array.from(new Set(links.map(l => l.codebookEntryId)));

            // 3. Attach these codes to the new theme
            for (const codeId of uniqueCodeIds) {
                await tx.themeCodeLink.create({
                    data: {
                        themeId: newTheme.id,
                        codebookEntryId: codeId
                    }
                });
            }

            // 4. Create references to the child themes (for undo/hierarchy)
            for (const oldThemeId of mergedThemeIds) {
                await tx.themeRelation.create({
                    data: {
                        sourceId: oldThemeId,
                        targetId: newTheme.id,
                        relationType: 'SUBTHEME_OF'
                    }
                });
            }

            // 5. Soft-delete the old themes
            await tx.theme.updateMany({
                where: { id: { in: mergedThemeIds } },
                data: { status: 'MERGED' }
            });
        });

        return NextResponse.json({ success: true, newThemeId });
    } catch (e) {
        console.error('Theme merge error:', e);
        return NextResponse.json({ error: 'Failed to merge themes' }, { status: 500 });
    }
}
