import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function sanitise(value: string | null | undefined): string {
    return (value || '').replace(/[\r\n]+/g, ' ').replace(/"/g, '""').trim()
}

export async function GET(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    try {
        const rawThemes = await prisma.theme.findMany({
            where: { projectId: params.projectId, status: { not: 'MERGED' } },
            include: {
                codeLinks: {
                    include: {
                        codebookEntry: {
                            select: {
                                id: true,
                                name: true,
                                definition: true,
                                examplesIn: true,
                                // Fetch ALL assignments to compute unique participants + evidence
                                codeAssignments: {
                                    select: {
                                        segment: {
                                            select: {
                                                text: true,
                                                transcript: { select: { title: true } }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                relationsIn: { where: { relationType: 'SUBTHEME_OF' }, select: { sourceId: true } },
                relationsOut: { where: { relationType: 'SUBTHEME_OF' }, select: { targetId: true } },
            },
            orderBy: { createdAt: 'desc' }
        })

        // Build hierarchy
        const themeMap = new Map(rawThemes.map(t => [t.id, t]))
        const getParentId = (t: typeof rawThemes[0]) => t.relationsOut[0]?.targetId ?? null
        const isMeta = (t: typeof rawThemes[0]) => t.relationsIn.length > 0
        const topLevel = rawThemes.filter(t => !getParentId(t))

        // Helper: compute stats from codeAssignments
        type Assignment = { segment: { text: string; transcript: { title: string } | null } | null }
        const getCodeStats = (codeAssignments: Assignment[]) => {
            const participantSet = new Set<string>()
            let sampleEvidence = ''
            for (const a of codeAssignments) {
                const pName = a.segment?.transcript?.title
                if (pName) participantSet.add(pName)
                if (!sampleEvidence && a.segment?.text) sampleEvidence = a.segment.text
            }
            return {
                numParticipants: participantSet.size,
                numPieces: codeAssignments.length,
                sampleEvidence,
                participantIds: Array.from(participantSet).join('; ')
            }
        }

        const BOM = '\uFEFF'
        const header = ['Mega-themes', 'Themes', 'Num participants', 'Num pieces', 'Code', 'Definition', 'Sample Evidence', 'Participant IDs']

        const rows: string[][] = []

        const buildCodeRows = (megaName: string, theme: typeof rawThemes[0]) => {
            const validLinks = theme.codeLinks.filter(l => l.codebookEntry.codeAssignments.length > 0)
            if (validLinks.length === 0) {
                rows.push([megaName, sanitise(theme.name), '0', '0', '', '', '', ''])
            } else {
                for (const link of validLinks) {
                    const stats = getCodeStats(link.codebookEntry.codeAssignments)
                    // Definition: prioritise codebookEntry.definition, fallback to examplesIn
                    const definition = link.codebookEntry.definition || link.codebookEntry.examplesIn || ''
                    rows.push([
                        megaName,
                        sanitise(theme.name),
                        String(stats.numParticipants),
                        String(stats.numPieces),
                        sanitise(link.codebookEntry.name),
                        sanitise(definition),
                        sanitise(stats.sampleEvidence),
                        sanitise(stats.participantIds),
                    ])
                }
            }
        }

        for (const theme of topLevel) {
            if (isMeta(theme)) {
                const children = theme.relationsIn.map(r => themeMap.get(r.sourceId)).filter(Boolean) as typeof rawThemes
                if (children.length === 0) {
                    rows.push([sanitise(theme.name), '', '0', '0', '', '', '', ''])
                } else {
                    for (const child of children) {
                        buildCodeRows(sanitise(theme.name), child)
                    }
                }
            } else {
                buildCodeRows('(standalone)', theme)
            }
        }

        const csv = BOM + [header, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\r\n')

        return new NextResponse(csv, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': 'attachment; filename="codebook.csv"',
                'Cache-Control': 'no-store',
            }
        })
    } catch (e) {
        console.error('CSV export error:', e)
        return NextResponse.json({ error: 'Failed to export codebook' }, { status: 500 })
    }
}
