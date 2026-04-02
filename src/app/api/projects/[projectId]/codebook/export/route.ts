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
        const themes = await prisma.theme.findMany({
            where: { projectId: params.projectId },
            include: {
                codeLinks: {
                    include: {
                        codebookEntry: {
                            select: {
                                id: true,
                                name: true,
                                definition: true,
                                _count: { select: { codeAssignments: true } },
                                codeAssignments: {
                                    take: 1,
                                    select: {
                                        segment: {
                                            select: {
                                                transcript: { select: { title: true } }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        })

        const BOM = '\uFEFF'
        const header = ['Theme', 'Theme Description', 'Code', 'Definition', 'Frequency', 'Sample Participant']

        const rows: string[][] = []
        for (const theme of themes) {
            const validLinks = theme.codeLinks.filter(l => l.codebookEntry._count.codeAssignments > 0)
            if (validLinks.length === 0) {
                rows.push([
                    sanitise(theme.name),
                    sanitise(theme.description),
                    '', '', '0', ''
                ])
            } else {
                for (const link of validLinks) {
                    const sampleParticipant = link.codebookEntry.codeAssignments[0]?.segment?.transcript?.title || ''
                    rows.push([
                        sanitise(theme.name),
                        sanitise(theme.description),
                        sanitise(link.codebookEntry.name),
                        sanitise(link.codebookEntry.definition),
                        String(link.codebookEntry._count.codeAssignments),
                        sanitise(sampleParticipant),
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
