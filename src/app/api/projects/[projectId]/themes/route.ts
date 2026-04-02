import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/projects/[projectId]/themes — get all themes with their linked codes
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
                                type: true,
                                definition: true,
                                examplesIn: true,
                                examplesOut: true,
                                _count: { select: { codeAssignments: true } },
                                codeAssignments: {
                                    take: 3,
                                    select: {
                                        segment: { 
                                            select: {
                                                id: true,
                                                text: true,
                                                transcript: { select: { id: true, title: true } }
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
        
        // Remove code links that have 0 assignments (orphans) and compute participants
        const validThemes = themes.map(theme => {
            const themeParticipantMap = new Map<string, {id: string, name: string}>()

            const validLinks = theme.codeLinks.filter(link => link.codebookEntry._count.codeAssignments > 0).map(link => {
                const codeParticipantMap = new Map<string, {id: string, name: string}>()
                const sampleQuotes: { segmentId: string; text: string; participantName: string; transcriptId: string }[] = []

                for (const ca of link.codebookEntry.codeAssignments) {
                    const tr = ca.segment?.transcript
                    if (tr) {
                        if (!codeParticipantMap.has(tr.id)) {
                            codeParticipantMap.set(tr.id, { id: tr.id, name: tr.title })
                        }
                        if (!themeParticipantMap.has(tr.id)) {
                            themeParticipantMap.set(tr.id, { id: tr.id, name: tr.title })
                        }
                    }
                    if (ca.segment?.text && sampleQuotes.length < 2) {
                        sampleQuotes.push({
                            segmentId: ca.segment.id,
                            text: ca.segment.text,
                            participantName: ca.segment.transcript?.title || '',
                            transcriptId: ca.segment.transcript?.id || ''
                        })
                    }
                }

                // Strip codeAssignments from the final output payload to save bandwidth
                const { codeAssignments, ...restCodeEntry } = link.codebookEntry as any
                return {
                    ...link,
                    codebookEntry: {
                        ...restCodeEntry,
                        participants: Array.from(codeParticipantMap.values()),
                        sampleQuotes
                    }
                }
            })

            return {
                ...theme,
                codeLinks: validLinks,
                participantsCount: themeParticipantMap.size
            }
        })

        return NextResponse.json(validThemes)
    } catch (e) {
        console.error('Failed to fetch themes:', e)
        return NextResponse.json({ error: 'Failed to fetch themes' }, { status: 500 })
    }
}

// POST /api/projects/[projectId]/themes — create a theme (optionally with code links)
export async function POST(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    try {
        const body = await req.json()
        const { name, description, codeIds } = body

        const session = await getServerSession(authOptions)
        const userId = session?.user ? (session.user as any).id : null

        if (!name) {
            return NextResponse.json({ error: 'Theme name is required' }, { status: 400 })
        }

        const theme = await prisma.theme.create({
            data: {
                projectId: params.projectId,
                name,
                description: description ?? null,
                status: 'DRAFT',
                codeLinks: codeIds?.length ? {
                    create: codeIds.map((codeId: string) => ({
                        codebookEntryId: codeId
                    }))
                } : undefined
            },
            include: {
                codeLinks: {
                    include: {
                        codebookEntry: {
                            include: {
                                _count: { select: { codeAssignments: true } }
                            }
                        }
                    }
                }
            }
        })

        // Audit log
        await prisma.auditLog.create({
            data: {
                projectId: params.projectId,
                userId,
                eventType: 'THEME_CREATED',
                entityType: 'Theme',
                entityId: theme.id,
                newValue: JSON.stringify({ name, codeIds }),
            }
        })

        return NextResponse.json(theme, { status: 201 })
    } catch (e) {
        console.error('Failed to create theme:', e)
        return NextResponse.json({ error: 'Failed to create theme' }, { status: 500 })
    }
}

// PATCH /api/projects/[projectId]/themes — update theme details or code links
export async function PATCH(
    req: Request,
    { params }: { params: { projectId: string } }
) {
    try {
        const body = await req.json()
        const { themeId, action, codeId } = body

        const session = await getServerSession(authOptions)
        const userId = session?.user ? (session.user as any).id : null

        if (!themeId || !action || !codeId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        if (action === 'ADD_CODE') {
            await prisma.themeCodeLink.create({
                data: {
                    themeId,
                    codebookEntryId: codeId
                }
            })
            await prisma.auditLog.create({
                data: {
                    projectId: params.projectId,
                    userId,
                    eventType: 'THEME_CODE_ADDED',
                    entityType: 'ThemeCodeLink',
                    entityId: themeId,
                    note: `Code ${codeId} added to theme ${themeId}`,
                }
            })
        } else if (action === 'REMOVE_CODE') {
            await prisma.themeCodeLink.deleteMany({
                where: {
                    themeId,
                    codebookEntryId: codeId
                }
            })
            await prisma.auditLog.create({
                data: {
                    projectId: params.projectId,
                    userId,
                    eventType: 'THEME_CODE_REMOVED',
                    entityType: 'ThemeCodeLink',
                    entityId: themeId,
                    note: `Code ${codeId} removed from theme ${themeId}`,
                }
            })
        }

        return NextResponse.json({ success: true })
    } catch (e) {
        console.error('Failed to update theme codes:', e)
        return NextResponse.json({ error: 'Failed to update theme' }, { status: 500 })
    }
}
