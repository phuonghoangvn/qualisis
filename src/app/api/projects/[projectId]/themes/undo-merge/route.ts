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

        await prisma.$transaction(async (tx) => {
            // Find all relationships where this theme was the target (i.e. old themes merged into this one)
            const relations = await tx.themeRelation.findMany({
                where: { targetId: themeId, relationType: 'SUBTHEME_OF' }
            });

            const sourceIds = relations.map(r => r.sourceId);

            if (sourceIds.length > 0) {
                // Restore the old themes back to DRAFT or ACTIVE
                await tx.theme.updateMany({
                    where: { id: { in: sourceIds } },
                    data: { status: 'DRAFT' } // restores them so they appear on UI again
                });
            }

            // The new "merged" theme can just be deleted.
            // Deleting it will cascade and delete its ThemeCodeLinks and ThemeRelations.
            await tx.theme.delete({
                where: { id: themeId }
            });
        });

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('Theme undo merge error:', e);
        return NextResponse.json({ error: 'Failed to undo merge' }, { status: 500 });
    }
}
