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
            // 1. Create the new mega/overarching theme (container only — no code links)
            const newTheme = await tx.theme.create({
                data: {
                    name,
                    description,
                    projectId: params.projectId,
                    status: 'DRAFT',
                    memo: 'META:Synthesized container theme'
                }
            })
            newThemeId = newTheme.id

            // 2. Link sub-themes to the mega-theme via ThemeRelation (SUBTHEME_OF)
            //    Sub-themes stay alive (status stays DRAFT) — they are NOT hidden
            for (const subThemeId of uniqueMergedIds) {
                // Check if the relation already exists before creating
                const existing = await tx.themeRelation.findFirst({
                    where: { sourceId: subThemeId, targetId: newTheme.id, relationType: 'SUBTHEME_OF' }
                })
                if (!existing) {
                    await tx.themeRelation.create({
                        data: {
                            sourceId: subThemeId,
                            targetId: newTheme.id,
                            relationType: 'SUBTHEME_OF'
                        }
                    })
                }
            }
        })

        return NextResponse.json({ success: true, newThemeId })
    } catch (e) {
        console.error('Theme merge error:', e)
        return NextResponse.json({ error: 'Failed to merge themes' }, { status: 500 })
    }
}
