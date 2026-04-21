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
        const header = ['MEGA-THEME', 'THEME', 'CODE', 'DEFINITION', 'SAMPLE EVIDENCE', 'PARTICIPANT IDS']

        const rows: string[][] = []

        const buildCodeRows = (megaName: string, theme: typeof rawThemes[0], megaStats?: { part: number, pieces: number }) => {
            const validLinks = theme.codeLinks.filter(l => l.codebookEntry.codeAssignments.length > 0)
            
            // Calculate Theme stats
            let themeParticipants = new Set<string>()
            let themePieces = 0
            for (const l of validLinks) {
                themePieces += l.codebookEntry.codeAssignments.length
                l.codebookEntry.codeAssignments.forEach((ca: any) => {
                    if (ca.segment?.transcript) themeParticipants.add(ca.segment.transcript.title)
                })
            }
            
            const themeLabel = `${sanitise(theme.name)} (${themeParticipants.size} part., ${themePieces} pieces)`
            const megaLabel = megaName !== '-' ? `${megaName} (${megaStats?.part || 0} part., ${megaStats?.pieces || 0} pieces)` : '-'

            if (validLinks.length === 0) {
                // If it is an empty standalone theme, only put name in Theme
                rows.push([megaLabel, themeLabel, '-', '', '', ''])
            } else {
                for (const link of validLinks) {
                    const stats = getCodeStats(link.codebookEntry.codeAssignments)
                    // Definition: prioritise codebookEntry.definition, fallback to examplesIn
                    const definition = link.codebookEntry.definition || link.codebookEntry.examplesIn || ''
                    rows.push([
                        megaLabel,
                        themeLabel,
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
                    // Empty mega theme without sub-themes (6 columns)
                    rows.push([`${sanitise(theme.name)} (0 part., 0 pieces)`, '-', '-', '', '', ''])
                } else {
                    let megaParticipants = new Set<string>()
                    let megaPieces = 0
                    for (const child of children) {
                        const validLinks = child.codeLinks.filter(l => l.codebookEntry.codeAssignments.length > 0)
                        for (const l of validLinks) {
                            megaPieces += l.codebookEntry.codeAssignments.length
                            l.codebookEntry.codeAssignments.forEach((ca: any) => {
                                if (ca.segment?.transcript) megaParticipants.add(ca.segment.transcript.title)
                            })
                        }
                    }
                    
                    const megaStats = { part: megaParticipants.size, pieces: megaPieces }
                    for (const child of children) {
                        buildCodeRows(sanitise(theme.name), child, megaStats)
                    }
                }
            } else {
                buildCodeRows('-', theme)
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
