import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(
    request: Request,
    { params }: { params: { projectId: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        const userId = session?.user ? (session.user as any).id : null

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const project = await prisma.project.findUnique({
            where: { id: params.projectId },
            include: {
                datasets: { select: { id: true, transcripts: { select: { id: true } } } }
            }
        })
        
        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 })
        }

        // Calculate participant count
        let participantCount = 0
        project.datasets.forEach(d => {
            participantCount += d.transcripts.length
        })

        return NextResponse.json({ ...project, participantCount })
    } catch (error) {
        console.error('Error fetching project:', error)
        return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: { projectId: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        const userId = session?.user ? (session.user as any).id : null

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const projectId = params.projectId
        const json = await request.json()
        const { name, description, coreOntology, researchQuestion } = json

        // Update the project
        const updatedProject = await prisma.project.update({
            where: { id: projectId },
            data: {
                name,
                description,
                coreOntology,
                researchQuestion
            }
        })

        // Log the action
        await prisma.auditLog.create({
            data: {
                projectId,
                userId,
                eventType: 'PROJECT_UPDATED',
                entityType: 'Project',
                entityId: projectId,
                note: `Updated project details: ${Object.keys(json).join(', ')}`
            }
        })

        return NextResponse.json(updatedProject)
    } catch (error) {
        console.error('Error updating project:', error)
        return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: { projectId: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        const userId = session?.user ? (session.user as any).id : null

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const projectId = params.projectId

        // Verify the user is a member of this project
        const member = await prisma.projectMember.findUnique({
            where: {
                projectId_userId: { projectId, userId }
            }
        })

        if (!member) {
            return NextResponse.json({ error: 'Unauthorized: You are not a member of this project' }, { status: 403 })
        }

        // Delete in order to avoid FK constraint violations
        // 1. Clear CodebookEntry self-references first
        await prisma.codebookEntry.updateMany({
            where: { projectId },
            data: { mappedToId: null }
        })

        // 2. Delete audit logs
        await prisma.auditLog.deleteMany({ where: { projectId } })

        // 3. Delete report sections
        await prisma.reportSection.deleteMany({ where: { projectId } })

        // 4. Delete theme relations
        const themes = await prisma.theme.findMany({ where: { projectId }, select: { id: true } })
        const themeIds = themes.map(t => t.id)
        if (themeIds.length > 0) {
            await prisma.themeRelation.deleteMany({
                where: { OR: [{ sourceId: { in: themeIds } }, { targetId: { in: themeIds } }] }
            })
            await prisma.themeCodeLink.deleteMany({ where: { themeId: { in: themeIds } } })
        }
        await prisma.theme.deleteMany({ where: { projectId } })

        // 5. Delete segments data (suggestions, evidence, reviews, code assignments)
        const datasets = await prisma.dataset.findMany({ where: { projectId }, select: { id: true } })
        const datasetIds = datasets.map(d => d.id)
        if (datasetIds.length > 0) {
            const transcripts = await prisma.transcript.findMany({
                where: { datasetId: { in: datasetIds } },
                select: { id: true }
            })
            const transcriptIds = transcripts.map(t => t.id)
            if (transcriptIds.length > 0) {
                const segments = await prisma.segment.findMany({
                    where: { transcriptId: { in: transcriptIds } },
                    select: { id: true }
                })
                const segmentIds = segments.map(s => s.id)
                if (segmentIds.length > 0) {
                    // Delete code assignments
                    await prisma.codeAssignment.deleteMany({ where: { segmentId: { in: segmentIds } } })
                    // Delete AI suggestion evidence & review decisions
                    const suggestions = await prisma.aISuggestion.findMany({
                        where: { segmentId: { in: segmentIds } },
                        select: { id: true }
                    })
                    const suggestionIds = suggestions.map(s => s.id)
                    if (suggestionIds.length > 0) {
                        await prisma.aISuggestionEvidence.deleteMany({ where: { aiSuggestionId: { in: suggestionIds } } })
                        await prisma.reviewDecision.deleteMany({ where: { aiSuggestionId: { in: suggestionIds } } })
                    }
                    await prisma.aISuggestion.deleteMany({ where: { segmentId: { in: segmentIds } } })
                    await prisma.segment.deleteMany({ where: { transcriptId: { in: transcriptIds } } })
                }
                await prisma.transcript.deleteMany({ where: { datasetId: { in: datasetIds } } })
            }
            await prisma.dataset.deleteMany({ where: { projectId } })
        }

        // 6. Delete codebook entries (after code assignments are gone)
        await prisma.codebookEntry.deleteMany({ where: { projectId } })

        // 7. Delete project members
        await prisma.projectMember.deleteMany({ where: { projectId } })

        // 8. Finally delete the project
        await prisma.project.delete({ where: { id: projectId } })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting project:', error)
        return NextResponse.json({ error: 'Failed to delete project', details: String(error) }, { status: 500 })
    }
}
