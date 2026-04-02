import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q')

    if (!query || query.trim().length === 0) {
        return NextResponse.json({ results: [] })
    }

    try {
        // Find segments containing the query term
        // Mode insensitive works well in PostgreSQL for text containing
        const segments = await prisma.segment.findMany({
            where: {
                transcript: {
                    dataset: {
                        projectId: params.projectId
                    }
                },
                text: {
                    contains: query,
                    mode: 'insensitive'
                }
            },
            include: {
                transcript: {
                    select: {
                        id: true,
                        title: true,
                        dataset: { select: { name: true } }
                    }
                },
                codeAssignments: {
                    include: {
                        codebookEntry: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                }
            },
            orderBy: [
                { transcript: { title: 'asc' } },
                { order: 'asc' }
            ],
            take: 200 // Limit to prevent overwhelming payload
        })

        // Group by transcript for better UI presentation
        const groupedResults = segments.reduce((acc, segment) => {
            const tId = segment.transcriptId
            if (!acc[tId]) {
                acc[tId] = {
                    transcriptId: tId,
                    transcriptName: segment.transcript.title,
                    datasetName: segment.transcript.dataset.name,
                    segments: []
                }
            }
            acc[tId].segments.push({
                id: segment.id,
                text: segment.text,
                codes: segment.codeAssignments.map(ca => ({
                    id: ca.codebookEntry.id,
                    name: ca.codebookEntry.name
                }))
            })
            return acc
        }, {} as Record<string, any>)

        return NextResponse.json({
            results: Object.values(groupedResults),
            totalSegments: segments.length
        })

    } catch (e: any) {
        console.error('Search error:', e)
        return NextResponse.json({ error: 'Search failed' }, { status: 500 })
    }
}
