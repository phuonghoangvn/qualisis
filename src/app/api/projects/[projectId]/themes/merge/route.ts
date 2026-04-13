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

        // Deduplicate IDs so we don't process the same theme twice
        const uniqueMergedIds: string[] = Array.from(new Set<string>(mergedThemeIds))
        if (uniqueMergedIds.length < 2) {
            return NextResponse.json({ error: 'Need at least 2 distinct themes to merge' }, { status: 400 })
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
                where: { themeId: { in: uniqueMergedIds } }
            });

            const uniqueCodeIds = Array.from(new Set<string>(links.map(l => l.codebookEntryId)));

            // 3. Attach codes to the new theme — skip duplicates safely
            await tx.themeCodeLink.createMany({
                data: uniqueCodeIds.map(codeId => ({
                    themeId: newTheme.id,
                    codebookEntryId: codeId
                })),
                skipDuplicates: true
            });

            // 4. Create references to the child themes (for undo/hierarchy) — skip if already exists
            for (const oldThemeId of uniqueMergedIds) {
                try {
                    await tx.themeRelation.create({
                        data: {
                            sourceId: oldThemeId,
                            targetId: newTheme.id,
                            relationType: 'SUBTHEME_OF'
                        }
                    });
                } catch {
                    // Skip duplicate relations silently
                }
            }

            // 5. Soft-delete the old themes
            await tx.theme.updateMany({
                where: { id: { in: uniqueMergedIds } },
                data: { status: 'MERGED' }
            });
        });

        return NextResponse.json({ success: true, newThemeId });
    } catch (e) {
        console.error('Theme merge error:', e);
        return NextResponse.json({ error: 'Failed to merge themes' }, { status: 500 });
    }
}
