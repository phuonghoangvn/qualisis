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
            },
            orderBy: { createdAt: 'desc' }
        })

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
        const header = ['THEME', 'CODE', 'DEFINITION', 'SAMPLE EVIDENCE', 'PARTICIPANT IDS']
        const rows: string[][] = []

        for (const theme of rawThemes) {
            const validLinks = theme.codeLinks.filter(l => l.codebookEntry.codeAssignments.length > 0)

            let themeParticipants = new Set<string>()
            let themePieces = 0
            for (const l of validLinks) {
                themePieces += l.codebookEntry.codeAssignments.length
                l.codebookEntry.codeAssignments.forEach((ca: any) => {
                    if (ca.segment?.transcript) themeParticipants.add(ca.segment.transcript.title)
                })
            }

            const themeLabel = `${sanitise(theme.name)} (${themeParticipants.size} part., ${themePieces} pieces)`

            if (validLinks.length === 0) {
                rows.push([themeLabel, '-', '', '', ''])
            } else {
                for (const link of validLinks) {
                    const stats = getCodeStats(link.codebookEntry.codeAssignments)
                    const definition = link.codebookEntry.definition || link.codebookEntry.examplesIn || ''
                    rows.push([
                        themeLabel,
                        sanitise(link.codebookEntry.name),
                        sanitise(definition),
                        sanitise(stats.sampleEvidence),
                        sanitise(stats.participantIds),
                    ])
                }
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
